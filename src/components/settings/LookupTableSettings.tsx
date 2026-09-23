"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  List as ListIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { usePermission } from "@/hooks/use-permission";
import {
  type LookupTableConfig,
  type LookupField,
} from "@/lib/lookup-tables-config";
import {
  SETTINGS_FILL_CARD,
  SETTINGS_FILL_CARD_CONTENT,
  SETTINGS_FILL_CARD_HEADER,
  SETTINGS_FILL_LIST,
} from "@/components/settings/SettingsPageShell";

// ─── Lazy Supabase Client ────────────────────────────────────
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createClient();
  return _supabase;
}

type Row = Record<string, any>;

// All writes go through the service-role /api/admin route so they bypass
// row-level security. Writing directly with the anon client fails on tables
// with restrictive RLS (e.g. project_types → "new row violates row-level
// security policy"). Reads stay on the client (SELECT is permitted by RLS).
async function adminWrite(body: Record<string, any>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || "網絡錯誤" };
  }
}

// Resolve the active-state column for a config.
function activeColumn(cfg: LookupTableConfig): string | null {
  if (cfg.activeMode === "none") return null;
  return cfg.activeCol ?? (cfg.activeMode === "status" ? "status" : "is_active");
}

// Is this row currently active? (true when there's no active concept.)
function isRowActive(cfg: LookupTableConfig, row: Row): boolean {
  const col = activeColumn(cfg);
  if (!col) return true;
  if (cfg.activeMode === "status") return (row[col] ?? "active") !== "inactive";
  return row[col] !== false; // is_active: null/undefined treated as active
}

// The value written to flip active state.
function activeValue(cfg: LookupTableConfig, active: boolean): any {
  return cfg.activeMode === "status" ? (active ? "active" : "inactive") : active;
}

// Build an empty form keyed by every editable field.
function emptyForm(cfg: LookupTableConfig): Row {
  const f: Row = {};
  for (const field of cfg.fields) f[field.col] = field.type === "bool" ? false : "";
  const col = activeColumn(cfg);
  if (col && cfg.activeMode === "is_active") f[col] = true;
  if (col && cfg.activeMode === "status") f[col] = "active";
  return f;
}

// Primary / secondary label resolution for the row list.
function primaryField(cfg: LookupTableConfig): LookupField {
  return cfg.fields.find((f) => f.primary) ?? cfg.fields[0];
}
function secondaryFields(cfg: LookupTableConfig): LookupField[] {
  return cfg.fields.filter((f) => f.secondary);
}

export default function LookupTableSettings({ config }: { config: LookupTableConfig }) {
  const { toast } = useToast();
  const { canView, loading: permLoading } = usePermission();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [boolFilterOn, setBoolFilterOn] = useState<Record<string, boolean>>({});
  // Select filters: col → selected value, or "" / "__all__" for no filter.
  const [selectFilterOn, setSelectFilterOn] = useState<Record<string, string>>({});
  // Dynamic select options keyed by field.col (from optionsFrom).
  const [fkOptions, setFkOptions] = useState<Record<string, { value: string; label: string }[]>>({});

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Row>(emptyForm(config));

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeCol = activeColumn(config);
  const orderBy = config.orderBy ?? primaryField(config).col;
  const permKey = config.permissionKey ?? "settings";

  const fieldOptions = useCallback(
    (field: LookupField): { value: string; label: string }[] =>
      fkOptions[field.col] ?? field.options ?? [],
    [fkOptions],
  );

  const resolveFieldLabel = useCallback(
    (field: LookupField, raw: unknown): string => {
      if (raw == null || raw === "") return "";
      const opts = fieldOptions(field);
      if (opts.length) {
        const hit = opts.find((o) => o.value === String(raw));
        if (hit) return hit.label;
      }
      return String(raw);
    },
    [fieldOptions],
  );

  // Load FK select options once per table config.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabase();
      const next: Record<string, { value: string; label: string }[]> = {};
      for (const field of config.fields) {
        if (!field.optionsFrom) continue;
        const { table, valueCol = "id", labelCol, orderBy: fkOrder } = field.optionsFrom;
        let query = supabase.from(table).select(`${valueCol}, ${labelCol}`);
        if (table === "supplier_types") {
          query = query.or("is_active.is.null,is_active.eq.true");
        }
        query = query.order(fkOrder ?? labelCol, { ascending: true });
        const { data, error } = await query;
        if (error) {
          console.error(`Failed to load options for ${field.col} from ${table}:`, error.message);
          continue;
        }
        next[field.col] = (data || []).map((r: Row) => ({
          value: String(r[valueCol]),
          label: String(r[labelCol] ?? r[valueCol] ?? ""),
        }));
      }
      if (!cancelled) setFkOptions(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [config.key, config.fields]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    let query = supabase.from(config.key).select("*").order(orderBy, { ascending: true });

    // Hide inactive rows unless the toggle is on (or table always shows them).
    if (activeCol && !showInactive && !config.alwaysShowInactive) {
      query =
        config.activeMode === "status"
          ? query.or(`${activeCol}.is.null,${activeCol}.neq.inactive`)
          : query.or(`${activeCol}.is.null,${activeCol}.neq.false`);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "載入失敗", description: error.message, variant: "destructive" });
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }, [config.key, config.activeMode, config.alwaysShowInactive, activeCol, orderBy, showInactive, toast]);

  useEffect(() => {
    if (!permLoading && canView(permKey)) fetchRows();
  }, [permLoading, canView, permKey, fetchRows]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(config));
    setDialogOpen(true);
  };

  const openEdit = (item: Row) => {
    setEditing(item);
    const f: Row = {};
    for (const field of config.fields) {
      f[field.col] =
        item[field.col] ?? (field.type === "bool" ? false : "");
    }
    if (activeCol) {
      f[activeCol] = isRowActive(config, item);
    }
    setForm(f);
    setDialogOpen(true);
  };

  // Coerce a field's form value into a DB-ready value.
  function coerce(field: LookupField, val: any): any {
    if (field.type === "bool") return !!val;
    if (field.type === "number") {
      if (val === "" || val == null) return null;
      const n = Number(val);
      return isNaN(n) ? null : n;
    }
    const s = typeof val === "string" ? val.trim() : val;
    if (s === "" || s == null) return null;
    return field.type === "code" ? String(s).toUpperCase() : s;
  }

  const handleSave = async () => {
    // Validate required fields.
    for (const field of config.fields) {
      if (field.required && coerce(field, form[field.col]) == null) {
        toast({ title: "錯誤", description: `「${field.labelZh}」不能為空`, variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    const payload: Row = {};
    for (const field of config.fields) payload[field.col] = coerce(field, form[field.col]);
    if (activeCol) payload[activeCol] = activeValue(config, !!form[activeCol]);
    payload.modified_date = new Date().toISOString();

    const labelCol = primaryField(config).col;
    const label = form[labelCol] || "記錄";

    if (editing) {
      const result = await adminWrite({
        action: "update",
        table: config.key,
        id: editing.id,
        updates: payload,
      });
      if (!result.success) {
        toast({ title: "更新失敗", description: result.error || "沒有權限或記錄不存在", variant: "destructive" });
      } else {
        toast({ title: "已更新", description: `「${label}」已成功更新` });
        setDialogOpen(false);
        fetchRows();
      }
    } else {
      // New rows default to active where the table tracks it (also set via form when activeCol).
      if (activeCol && config.activeMode === "status" && payload[activeCol] == null) {
        payload[activeCol] = "active";
      }
      if (activeCol && config.activeMode === "is_active" && payload[activeCol] == null) {
        payload[activeCol] = true;
      }
      const result = await adminWrite({
        action: "create",
        table: config.key,
        data: { ...payload, created_date: new Date().toISOString() },
      });
      if (!result.success) {
        toast({ title: "新增失敗", description: result.error || "沒有權限執行此操作", variant: "destructive" });
      } else {
        toast({ title: "已新增", description: `「${label}」已成功新增` });
        setDialogOpen(false);
        fetchRows();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const label = deleteTarget[primaryField(config).col] || "記錄";
    const guard = config.usageGuard;
    if (guard) {
      const { count, error: usageError } = await getSupabase()
        .from(guard.table)
        .select("id", { count: "exact", head: true })
        .eq(guard.fkCol, deleteTarget.id);
      if (usageError) {
        toast({ title: "刪除失敗", description: usageError.message, variant: "destructive" });
        setDeleting(false);
        return;
      }
      if ((count ?? 0) > 0) {
        toast({
          title: "無法刪除",
          description: guard.messageZh || "此項目已被使用，請改為停用。",
          variant: "destructive",
        });
        setDeleting(false);
        setDeleteTarget(null);
        return;
      }
    }
    const result = await adminWrite({ action: "delete", table: config.key, id: deleteTarget.id });
    if (!result.success) {
      toast({ title: "刪除失敗", description: result.error || "沒有權限執行此操作", variant: "destructive" });
    } else {
      toast({ title: "已刪除", description: `「${label}」已成功刪除` });
      fetchRows();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const toggleActive = async (item: Row) => {
    if (!activeCol) return;
    const next = activeValue(config, !isRowActive(config, item));
    const result = await adminWrite({
      action: "update",
      table: config.key,
      id: item.id,
      updates: { [activeCol]: next, modified_date: new Date().toISOString() },
    });
    if (!result.success) {
      toast({ title: "更新失敗", description: result.error || "沒有權限執行此操作", variant: "destructive" });
    } else {
      fetchRows();
    }
  };
  // ─── SEARCH + BOOL / SELECT FILTERS ────────────────────────
  const searchCols = config.fields.filter((f) => f.searchable);
  const q = search.toLowerCase();
  const filtered = rows.filter((r) => {
    if (
      q &&
      !searchCols.some((f) => {
        const raw = String(r[f.col] ?? "").toLowerCase();
        const label = resolveFieldLabel(f, r[f.col]).toLowerCase();
        return raw.includes(q) || label.includes(q);
      })
    ) {
      return false;
    }
    for (const bf of config.boolFilters ?? []) {
      if (boolFilterOn[bf.col] && r[bf.col] !== true) return false;
    }
    for (const sf of config.selectFilters ?? []) {
      const selected = selectFilterOn[sf.col];
      if (selected && selected !== "__all__" && String(r[sf.col] ?? "") !== selected) {
        return false;
      }
    }
    return true;
  });

  const hasActiveFilters =
    !!q ||
    Object.values(boolFilterOn).some(Boolean) ||
    Object.values(selectFilterOn).some((v) => v && v !== "__all__");

  const pField = primaryField(config);
  const sFields = secondaryFields(config);

  return (
    <Card className={SETTINGS_FILL_CARD}>
      <CardHeader className={SETTINGS_FILL_CARD_HEADER}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ListIcon className="w-4 h-4 text-blue-500" />
            {config.labelZh} {config.labelEn}
            <Badge variant="secondary" className="ml-2 text-xs">
              {filtered.length}
            </Badge>
          </CardTitle>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            新增
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder={`搜尋${config.labelZh}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {activeCol && !config.alwaysShowInactive && (
            <div className="flex items-center gap-1.5">
              <Label htmlFor="show-inactive" className="text-xs text-gray-500 whitespace-nowrap">
                顯示停用
              </Label>
              <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
            </div>
          )}
          {(config.boolFilters ?? []).map((bf) => (
            <div key={bf.col} className="flex items-center gap-1.5">
              <Label htmlFor={`bool-filter-${bf.col}`} className="text-xs text-gray-500 whitespace-nowrap">
                {bf.labelZh}
                {bf.labelEn ? ` ${bf.labelEn}` : ""}
              </Label>
              <Switch
                id={`bool-filter-${bf.col}`}
                checked={!!boolFilterOn[bf.col]}
                onCheckedChange={(on) => setBoolFilterOn((prev) => ({ ...prev, [bf.col]: on }))}
              />
            </div>
          ))}
          {(config.selectFilters ?? []).map((sf) => {
            const field = config.fields.find((f) => f.col === sf.col);
            const opts = field ? fieldOptions(field) : [];
            const value = selectFilterOn[sf.col] || "__all__";
            return (
              <div key={sf.col} className="flex items-center gap-1.5 shrink-0">
                <Label htmlFor={`select-filter-${sf.col}`} className="text-xs text-gray-500 whitespace-nowrap">
                  {sf.labelZh}
                  {sf.labelEn ? ` ${sf.labelEn}` : ""}
                </Label>
                <Select
                  value={value}
                  onValueChange={(v) => setSelectFilterOn((prev) => ({ ...prev, [sf.col]: v }))}
                >
                  <SelectTrigger id={`select-filter-${sf.col}`} className="h-8 w-[180px] text-sm">
                    <SelectValue placeholder={sf.allLabelZh ?? "全部"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{sf.allLabelZh ?? "全部"}</SelectItem>
                    {opts.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className={SETTINGS_FILL_CARD_CONTENT}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {hasActiveFilters ? "沒有符合的結果" : "暫無資料"}
          </div>
        ) : (
          <div className={SETTINGS_FILL_LIST}>
            {filtered.map((item) => {
              const active = isRowActive(config, item);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors group ${
                    active
                      ? "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
                      : "bg-gray-50/80 border-gray-100"
                  }`}
                >
                  {/* Optional colour swatch */}
                  {config.fields.some((f) => f.type === "color") && (
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-gray-200 shrink-0"
                      style={{
                        backgroundColor:
                          item[config.fields.find((f) => f.type === "color")!.col] || "#e5e7eb",
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Secondary "code"-like fields render as mono badges before the name */}
                      {sFields
                        .filter((f) => f.type === "code")
                        .map((f) =>
                          item[f.col] ? (
                            <Badge
                              key={f.col}
                              variant="outline"
                              className="text-xs font-mono px-1.5 py-0 h-5 border-blue-200 text-blue-600 bg-blue-50"
                            >
                              {resolveFieldLabel(f, item[f.col])}
                            </Badge>
                          ) : null,
                        )}
                      {/* Secondary fields flagged `badge` render as categorical pills */}
                      {sFields
                        .filter((f) => f.type !== "code" && f.badge)
                        .map((f) =>
                          item[f.col] ? (
                            <Badge
                              key={f.col}
                              variant="outline"
                              className="text-xs px-1.5 py-0 h-5 border-slate-200 text-slate-600 bg-slate-50"
                            >
                              {resolveFieldLabel(f, item[f.col])}
                            </Badge>
                          ) : null,
                        )}
                      <span
                        className={`text-sm font-medium truncate ${
                          active ? "text-gray-900" : "text-gray-400"
                        }`}
                      >
                        {item[pField.col] || "—"}
                      </span>
                      {!active && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-gray-200 text-gray-400 bg-gray-50">
                          已停用
                        </Badge>
                      )}
                      {/* Remaining non-code, non-badge secondary fields render muted */}
                      {sFields
                        .filter((f) => f.type !== "code" && !f.badge)
                        .map((f) =>
                          item[f.col] ? (
                            <span key={f.col} className={`text-xs truncate ${active ? "text-gray-400" : "text-gray-300"}`}>
                              {resolveFieldLabel(f, item[f.col])}
                            </span>
                          ) : null,
                        )}
                    </div>
                  </div>

                  {activeCol && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Label
                        htmlFor={`active-toggle-${item.id}`}
                        className={`text-xs whitespace-nowrap ${active ? "text-gray-600" : "text-gray-400"}`}
                      >
                        啟用
                      </Label>
                      <Switch
                        id={`active-toggle-${item.id}`}
                        checked={active}
                        onCheckedChange={() => toggleActive(item)}
                        className="scale-90"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(item)}>
                      <Pencil className="w-3.5 h-3.5 text-gray-500" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-7 h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <DialogTitle>
              {editing ? `編輯${config.labelZh}` : `新增${config.labelZh}`}
            </DialogTitle>
            <DialogDescription>
              {editing ? `修改${config.labelZh}的資料` : `新增一個${config.labelZh}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1">
            {config.fields.map((field) => (
              <div key={field.col} className="space-y-2">
                <Label>
                  {field.labelZh}
                  {field.labelEn ? ` ${field.labelEn}` : ""}
                  {field.required ? <span className="text-red-500"> *</span> : ""}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    value={form[field.col] ?? ""}
                    onChange={(e) => setForm({ ...form, [field.col]: e.target.value })}
                    placeholder={field.placeholder}
                    rows={4}
                    className="text-sm resize-none"
                  />
                ) : field.type === "bool" ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!form[field.col]}
                      onCheckedChange={(c) => setForm({ ...form, [field.col]: c })}
                    />
                    <span className="text-sm text-gray-500">
                      {form[field.col] ? "是 Yes" : "否 No"}
                    </span>
                  </div>
                ) : field.type === "select" && field.selectUi === "pills" ? (
                  <div className="flex flex-wrap gap-2">
                    {fieldOptions(field).length === 0 ? (
                      <p className="text-xs text-gray-400 py-1">沒有選項</p>
                    ) : (
                      fieldOptions(field).map((o) => {
                        const selected = String(form[field.col] ?? "") === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                [field.col]: selected && !field.required ? "" : o.value,
                              })
                            }
                            className={`rounded-full px-3 py-1 text-sm border transition-all ${
                              selected
                                ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {o.label}
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : field.type === "select" ? (
                  <Select
                    value={form[field.col] ?? ""}
                    onValueChange={(v) => setForm({ ...form, [field.col]: v })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="請選擇" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions(field).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "color" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form[field.col] || "#3b82f6"}
                      onChange={(e) => setForm({ ...form, [field.col]: e.target.value })}
                      className="h-9 w-12 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <Input
                      value={form[field.col] ?? ""}
                      onChange={(e) => setForm({ ...form, [field.col]: e.target.value })}
                      placeholder="#3b82f6"
                      className="font-mono text-sm flex-1"
                    />
                  </div>
                ) : (
                  <Input
                    value={form[field.col] ?? ""}
                    onChange={(e) => setForm({ ...form, [field.col]: e.target.value })}
                    placeholder={field.placeholder}
                    type={field.type === "number" ? "number" : "text"}
                    className={field.type === "code" ? "font-mono uppercase" : ""}
                  />
                )}
              </div>
            ))}
            {activeCol && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <Label htmlFor="form-is-active">啟用 Active</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="form-is-active"
                    checked={!!form[activeCol]}
                    onCheckedChange={(c) => setForm({ ...form, [activeCol]: c })}
                  />
                  <span className={`text-sm ${form[activeCol] ? "text-gray-700" : "text-gray-400"}`}>
                    {form[activeCol] ? "啟用中" : "已停用"}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t border-gray-100 shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {editing ? "儲存" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deleteTarget?.[primaryField(config).col]}」嗎？此操作無法復原。
              {config.usageGuard
                ? " 若此項目已被使用，將無法刪除，請改為停用。"
                : activeCol
                  ? " 如果有資料正在使用此項目，建議停用而非刪除。"
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
