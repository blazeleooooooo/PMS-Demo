"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Loader2,
  Download,
  CheckSquare,
  Square,
  ImageOff,
  Pencil,
  Upload,
  X,
  CalendarClock,
  FolderKanban} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter} from "@/components/ui/dialog";
import { usePermission } from "@/hooks/use-permission";
import { useToast } from "@/components/ui/use-toast";
import {
  fetchBrandWallCustomers,
  fetchProjectTypeOptions,
  fetchServiceTypeOptions,
  uploadCustomerLogo,
  updateBrandFields,
  type BrandRow,
  type LinkOption} from "@/lib/data-service";

// Normalize a possibly protocol-relative bubble.io URL for <img>.
function imgSrc(url: string | null): string | null {
  if (!url) return null;
  const t = url.trim();
  if (!t) return null;
  return t.startsWith("//") ? `https:${t}` : t;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

// Best display name for a brand (CN preferred, then EN, then customer fields).
function brandName(b: BrandRow): string {
  return (
    b.brand_name_cn ||
    b.brand_name_en ||
    b.company_name ||
    b.display_name ||
    b.customer_name ||
    "(未命名)"
  );
}

/** Match /clients view_system filter: BWA/BWF include Both. */
function matchesViewSystem(vs: string | null, filter: string): boolean {
  if (!filter || filter === "all") return true;
  const v = vs || "";
  if (filter === "BWA") {
    return ["BWA", "Both", "PMS", "PMS,BWF2", "BWF2,PMS"].includes(v);
  }
  if (filter === "BWF") {
    return ["BWF", "Both", "BWF2", "PMS,BWF2", "BWF2,PMS"].includes(v);
  }
  if (filter === "Both") {
    return ["Both", "PMS,BWF2", "BWF2,PMS"].includes(v);
  }
  return v === filter;
}

export default function BrandWall() {
  const { canEdit, loading: permLoading } = usePermission();
  const { toast } = useToast();

  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [projectTypes, setProjectTypes] = useState<LinkOption[]>([]);
  const [serviceTypes, setServiceTypes] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [systemFilter, setSystemFilter] = useState("all");
  const [projectType, setProjectType] = useState("all");
  const [serviceType, setServiceType] = useState("all");
  const [logoFilter, setLogoFilter] = useState<"all" | "with" | "without">("all");

  // Selection + download
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const editAllowed = canEdit("brands");

  async function load() {
    setLoading(true);
    const [b, pt, st] = await Promise.all([
      fetchBrandWallCustomers(),
      fetchProjectTypeOptions(),
      fetchServiceTypeOptions(),
    ]);
    setBrands(b);
    setProjectTypes(pt);
    setServiceTypes(st);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // ─── FILTER ────────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return brands
      .filter((b) => {
        if (!matchesViewSystem(b.view_system, systemFilter)) return false;
        if (projectType !== "all" && !b.project_type_ids.includes(projectType)) return false;
        if (serviceType !== "all" && !b.service_type_ids.includes(serviceType)) return false;
        const hasLogo = !!imgSrc(b.branding_icon);
        if (logoFilter === "with" && !hasLogo) return false;
        if (logoFilter === "without" && hasLogo) return false;
        if (q) {
          const hay = [
            b.brand_name_cn,
            b.brand_name_en,
            b.company_name,
            b.display_name,
            b.customer_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => brandName(a).localeCompare(brandName(b), "zh-Hant"));
  }, [brands, search, systemFilter, projectType, serviceType, logoFilter]);

  // Keep selection within the currently-visible set when filters change.
  const visibleIds = useMemo(() => new Set(visible.map((b) => b.id)), [visible]);
  const selectedVisible = useMemo(
    () => visible.filter((b) => selected.has(b.id)),
    [visible, selected]
  );
  const selectableVisible = useMemo(
    () => visible.filter((b) => imgSrc(b.branding_icon)),
    [visible]
  );
  const allSelected =
    selectableVisible.length > 0 &&
    selectableVisible.every((b) => selected.has(b.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const b of selectableVisible) next.delete(b.id);
      } else {
        for (const b of selectableVisible) next.add(b.id);
      }
      return next;
    });
  }

  // ─── BULK DOWNLOAD (server zips the logos) ─────────────────
  async function downloadSelected() {
    const items = selectedVisible
      .map((b) => ({ url: b.branding_icon || "", name: brandName(b) }))
      .filter((i) => i.url);
    if (items.length === 0) {
      toast({ title: "沒有可下載的標誌", description: "請先選擇有標誌的品牌。", variant: "destructive" });
      return;
    }
    setDownloading(true);
    try {
      const res = await fetch("/api/download-logos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })});
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg.error || `下載失敗 (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "brand-logos.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const failedCount = Number(res.headers.get("X-Failed-Count") || 0);
      toast({
        title: "下載完成",
        description: failedCount
          ? `已打包 ${items.length - failedCount} 個標誌，${failedCount} 個失敗。`
          : `已打包 ${items.length} 個標誌。`});
    } catch (err: any) {
      toast({ title: "下載失敗", description: err?.message || "未知錯誤", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  // ─── QUICK EDIT ────────────────────────────────────────────
  const [editing, setEditing] = useState<BrandRow | null>(null);

  const missingLogoCount = brands.filter((b) => !imgSrc(b.branding_icon)).length;

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">客戶品牌 Brand Wall</h1>
          <p className="text-sm text-gray-500 mt-1">
            知名品牌客戶標誌牆 — 篩選並批量下載品牌標誌。
            {!loading && (
              <span className="ml-1 text-gray-400">
                共 {brands.length} 個品牌
                {missingLogoCount > 0 && `，${missingLogoCount} 個未設定標誌`}。
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={downloadSelected}
          disabled={downloading || selectedVisible.length === 0}
          className="gap-2"
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          下載已選 ({selectedVisible.length})
        </Button>
      </div>

      {/* ─── FILTER BAR ─────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-500">搜尋品牌</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="搜尋中英文品牌名稱..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-white"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">系統分類</label>
          <Select value={systemFilter} onValueChange={setSystemFilter}>
            <SelectTrigger className="h-9 text-sm w-[140px] bg-white">
              <SelectValue placeholder="所有系統" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有系統</SelectItem>
              <SelectItem value="BWA">BWA</SelectItem>
              <SelectItem value="BWF">BWF</SelectItem>
              <SelectItem value="Both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">項目類型</label>
          <Select value={projectType} onValueChange={setProjectType}>
            <SelectTrigger className="h-9 text-sm w-[170px] bg-white">
              <SelectValue placeholder="所有項目類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有項目類型</SelectItem>
              {projectTypes.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">服務類型</label>
          <Select value={serviceType} onValueChange={setServiceType}>
            <SelectTrigger className="h-9 text-sm w-[170px] bg-white">
              <SelectValue placeholder="所有服務類型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有服務類型</SelectItem>
              {serviceTypes.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">標誌狀態</label>
          <Select value={logoFilter} onValueChange={(v) => setLogoFilter(v as any)}>
            <SelectTrigger className="h-9 text-sm w-[150px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="with">已設定標誌</SelectItem>
              <SelectItem value="without">未設定標誌</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── TOOLBAR ────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={toggleAll}
            disabled={selectableVisible.length === 0}
            className="flex items-center gap-2 text-gray-600 hover:text-bw-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-bw-blue" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {allSelected ? "取消全選" : "全選"} ({selectableVisible.length} 個有標誌)
          </button>
          <span className="text-gray-400">
            顯示 {visible.length} / {brands.length} 個品牌
          </span>
        </div>
      )}

      {/* ─── GRID ───────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-bw-blue" />
          <span className="ml-3 text-gray-500 text-sm">載入品牌資料...</span>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 text-gray-400">沒有符合條件的品牌</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {visible.map((b) => {
            const src = imgSrc(b.branding_icon);
            const isSelected = selected.has(b.id);
            return (
              <BrandCard
                key={b.id}
                brand={b}
                src={src}
                selected={isSelected}
                onToggle={() => toggle(b.id)}
                editAllowed={editAllowed}
                onEdit={() => setEditing(b)}
              />
            );
          })}
        </div>
      )}

      {/* ─── QUICK-EDIT DIALOG ──────────────────────── */}
      {editing && (
        <BrandEditDialog
          brand={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setBrands((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ─── BRAND CARD ───────────────────────────────────────────────
function BrandCard({
  brand,
  src,
  selected,
  onToggle,
  editAllowed,
  onEdit}: {
  brand: BrandRow;
  src: string | null;
  selected: boolean;
  onToggle: () => void;
  editAllowed: boolean;
  onEdit: () => void;
}) {
  const name = brandName(brand);
  const sub =
    brand.brand_name_cn && brand.brand_name_en ? brand.brand_name_en : null;

  return (
    <div
      className={`group relative bg-white border rounded-xl overflow-hidden shadow-sm transition-all ${
        selected ? "border-bw-blue ring-2 ring-bw-blue/30" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      {/* Select checkbox (only when there is a logo to download) */}
      {src && (
        <button
          onClick={onToggle}
          className="absolute top-2 left-2 z-10 bg-white/90 rounded p-0.5 shadow-sm"
          aria-label="select brand"
        >
          {selected ? (
            <CheckSquare className="w-5 h-5 text-bw-blue" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </button>
      )}

      {/* Quick-edit */}
      {editAllowed && (
        <button
          onClick={onEdit}
          className="absolute top-2 right-2 z-10 bg-white/90 rounded p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="edit brand"
          title="快速編輯"
        >
          <Pencil className="w-3.5 h-3.5 text-gray-500" />
        </button>
      )}

      {/* Logo */}
      <div
        className="h-28 flex items-center justify-center bg-gray-50 p-4 cursor-pointer"
        onClick={src ? onToggle : editAllowed ? onEdit : undefined}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-300">
            <ImageOff className="w-8 h-8" />
            <span className="text-[11px]">未設定標誌</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 border-t border-gray-100 space-y-1">
        <div className="font-medium text-sm text-gray-900 truncate" title={name}>
          {name}
        </div>
        {sub && <div className="text-xs text-gray-400 truncate">{sub}</div>}

        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pt-1">
          <FolderKanban className="w-3 h-3 shrink-0" />
          <span>{brand.project_count} 個項目</span>
        </div>
        {brand.latest_project && (
          <div className="flex items-start gap-1.5 text-[11px] text-gray-500" title="最近項目">
            <CalendarClock className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="truncate">
              {fmtDate(brand.latest_project.signed_date)} ·{" "}
              {brand.latest_project.project_name ||
                brand.latest_project.project_code ||
                "(未命名項目)"}
            </span>
          </div>
        )}
        {/* Older recent projects (2nd & 3rd), shown on hover for context */}
        {brand.recent_projects.length > 1 && (
          <div className="hidden group-hover:block pt-1 space-y-0.5 border-t border-gray-50 mt-1">
            {brand.recent_projects.slice(1).map((p) => (
              <div key={p.id} className="text-[11px] text-gray-400 truncate">
                {fmtDate(p.signed_date)} · {p.project_name || p.project_code || "(未命名)"}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── QUICK-EDIT DIALOG ────────────────────────────────────────
function BrandEditDialog({
  brand,
  onClose,
  onSaved}: {
  brand: BrandRow;
  onClose: () => void;
  onSaved: (updated: Partial<BrandRow> & { id: string }) => void;
}) {
  const { toast } = useToast();
  const [cn, setCn] = useState(brand.brand_name_cn || "");
  const [en, setEn] = useState(brand.brand_name_en || "");
  const [icon, setIcon] = useState(brand.branding_icon || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = imgSrc(icon);

  async function handleUpload(file: File) {
    setUploading(true);
    const res = await uploadCustomerLogo(brand.id, file);
    setUploading(false);
    if (res.success && res.url) {
      setIcon(res.url);
      toast({ title: "已上載", description: "標誌已上載，記得儲存。" });
    } else {
      toast({ title: "上載失敗", description: res.error || "未知錯誤", variant: "destructive" });
    }
  }

  async function save() {
    setSaving(true);
    const res = await updateBrandFields(brand.id, {
      brand_name_cn: cn.trim() || undefined,
      brand_name_en: en.trim() || undefined,
      branding_icon: icon.trim()});
    setSaving(false);
    if (res.success) {
      toast({ title: "已儲存", description: "品牌資料已更新。" });
      onSaved({
        id: brand.id,
        brand_name_cn: cn.trim() || null,
        brand_name_en: en.trim() || null,
        branding_icon: icon.trim() || null});
    } else {
      toast({ title: "儲存失敗", description: res.error || "未知錯誤", variant: "destructive" });
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>快速編輯品牌</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Logo preview + upload */}
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 shrink-0 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <ImageOff className="w-7 h-7 text-gray-300" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                上載標誌
              </Button>
              {icon && (
                <button
                  onClick={() => setIcon("")}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                >
                  <X className="w-3 h-3" /> 移除標誌
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">中文品牌名稱</label>
            <Input value={cn} onChange={(e) => setCn(e.target.value)} placeholder="中文品牌名稱" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">英文品牌名稱</label>
            <Input value={en} onChange={(e) => setEn(e.target.value)} placeholder="English brand name" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={save} disabled={saving || uploading} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
