"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Building2,
  GripVertical,
  Upload,
  X,
  Image as ImageIcon,
  FileText,
  Stamp,
  Shield} from "lucide-react";
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
  DialogTitle} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { buildStorageObjectKey } from "@/lib/storage-utils";
import { useToast } from "@/components/ui/use-toast";
import {
  SETTINGS_FILL_CARD,
  SETTINGS_FILL_CARD_CONTENT,
  SETTINGS_FILL_CARD_HEADER,
  SETTINGS_FILL_LIST,
} from "@/components/settings/SettingsPageShell";

// ─── Types ───────────────────────────────────────────────────
interface CostCentre {
  id: string;
  bubble_id: string | null;
  bu_code: string | null;
  display: string | null;
  chinese_display: string | null;
  business_logo: string | null;
  bank_notes: string | null;
  company_chop: string | null;
  status: string | null;
  expense_control_enabled: boolean;
  created_at: string | null;
  modified_date: string | null;
}

// ─── Lazy Supabase Client ────────────────────────────────────
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient();
  }
  return _supabase;
}

// ─── Cost Centres Section ────────────────────────────────────
function CostCentresSection() {
  const { toast } = useToast();
  const [costCentres, setCostCentres] = useState<CostCentre[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CostCentre | null>(null);
  const [saving, setSaving] = useState(false);
  const [formBuCode, setFormBuCode] = useState("");
  const [formDisplay, setFormDisplay] = useState("");
  const [formChineseDisplay, setFormChineseDisplay] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [formBankNotes, setFormBankNotes] = useState("");
  const [formBusinessLogo, setFormBusinessLogo] = useState("");
  const [formCompanyChop, setFormCompanyChop] = useState("");
  const [formExpenseControlEnabled, setFormExpenseControlEnabled] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingChop, setUploadingChop] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const chopInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<CostCentre | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCostCentres = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    let query = supabase
      .from("cost_centres")
      .select("*")
      .order("bu_code", { ascending: true });

    if (!showInactive) {
      query = query.or("status.is.null,status.neq.inactive");
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setCostCentres(data || []);
    }
    setLoading(false);
  }, [showInactive, toast]);

  useEffect(() => {
    fetchCostCentres();
  }, [fetchCostCentres]);

  const openCreate = () => {
    setEditing(null);
    setFormBuCode("");
    setFormDisplay("");
    setFormChineseDisplay("");
    setFormStatus("active");
    setFormBankNotes("");
    setFormBusinessLogo("");
    setFormCompanyChop("");
    setFormExpenseControlEnabled(true);
    setDialogOpen(true);
  };

  const openEdit = (item: CostCentre) => {
    setEditing(item);
    setFormBuCode(item.bu_code || "");
    setFormDisplay(item.display || "");
    setFormChineseDisplay(item.chinese_display || "");
    setFormStatus(item.status || "active");
    setFormBankNotes(item.bank_notes || "");
    setFormBusinessLogo(item.business_logo || "");
    setFormCompanyChop(item.company_chop || "");
    setFormExpenseControlEnabled(item.expense_control_enabled !== false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formBuCode.trim()) {
      toast({ title: "錯誤", description: "BU Code 不能為空", variant: "destructive" });
      return;
    }
    setSaving(true);
    const supabase = getSupabase();
    const payload = {
      bu_code: formBuCode.trim().toUpperCase(),
      display: formDisplay.trim() || null,
      chinese_display: formChineseDisplay.trim() || null,
      status: formStatus,
      bank_notes: formBankNotes.trim() || null,
      business_logo: formBusinessLogo.trim() || null,
      company_chop: formCompanyChop.trim() || null,
      expense_control_enabled: formExpenseControlEnabled,
      modified_date: new Date().toISOString()};

    if (editing) {
      const { data, error } = await supabase
        .from("cost_centres")
        .update(payload)
        .eq("id", editing.id)
        .select();
      if (error) {
        toast({ title: "更新失敗", description: error.message, variant: "destructive" });
      } else if (!data || data.length === 0) {
        toast({ title: "更新失敗", description: "沒有權限或記錄不存在", variant: "destructive" });
      } else {
        toast({ title: "已更新", description: `「${formBuCode}」已成功更新` });
        setDialogOpen(false);
        fetchCostCentres();
      }
    } else {
      const { data, error } = await supabase
        .from("cost_centres")
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select();
      if (error) {
        toast({ title: "新增失敗", description: error.message, variant: "destructive" });
      } else if (!data || data.length === 0) {
        toast({ title: "新增失敗", description: "沒有權限執行此操作", variant: "destructive" });
      } else {
        toast({ title: "已新增", description: `「${formBuCode}」已成功新增` });
        setDialogOpen(false);
        fetchCostCentres();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = getSupabase();
    const { error } = await supabase
      .from("cost_centres")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "刪除失敗", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "已刪除", description: `「${deleteTarget.bu_code || deleteTarget.display}」已成功刪除` });
      fetchCostCentres();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const toggleStatus = async (item: CostCentre) => {
    const supabase = getSupabase();
    const newStatus = item.status === "inactive" ? "active" : "inactive";
    const { error } = await supabase
      .from("cost_centres")
      .update({ status: newStatus, modified_date: new Date().toISOString() })
      .eq("id", item.id);
    if (error) {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    } else {
      fetchCostCentres();
    }
  };

  // Quick-download a cost centre's logo / chop image. Fetches the asset as a
  // blob so the browser saves it (rather than navigating to it) with a tidy
  // filename like "BWA_chop.png".
  const handleImageDownload = async (
    item: CostCentre,
    field: "logo" | "chop"
  ) => {
    const url = field === "logo" ? item.business_logo : item.company_chop;
    if (!url) return;
    const labelEn = field === "logo" ? "logo" : "chop";
    const baseName = (item.bu_code || item.display || "company").replace(/[^\w-]+/g, "_");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const ext = url.split("?")[0].split(".").pop()?.slice(0, 5) || "png";
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${baseName}_${labelEn}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      toast({
        title: "下載失敗",
        description: err?.message || "無法下載圖片",
        variant: "destructive"});
    }
  };

  // Image upload handler
  const handleImageUpload = async (
    file: File,
    field: "logo" | "chop"
  ) => {
    const setter = field === "logo" ? setFormBusinessLogo : setFormCompanyChop;
    const loadingSetter = field === "logo" ? setUploadingLogo : setUploadingChop;

    loadingSetter(true);
    const supabase = getSupabase();
    const fileName = buildStorageObjectKey(field, file.name);

    const { error: uploadError } = await supabase.storage
      .from("cost-centres")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast({ title: "上傳失敗", description: uploadError.message, variant: "destructive" });
      loadingSetter(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("cost-centres")
      .getPublicUrl(fileName);

    if (urlData?.publicUrl) {
      setter(urlData.publicUrl);
    }
    loadingSetter(false);
  };

  const filtered = costCentres.filter(
    (c) =>
      (c.bu_code && c.bu_code.toLowerCase().includes(search.toLowerCase())) ||
      (c.display && c.display.toLowerCase().includes(search.toLowerCase())) ||
      (c.chinese_display && c.chinese_display.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Card className={SETTINGS_FILL_CARD}>
      <CardHeader className={SETTINGS_FILL_CARD_HEADER}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            成本中心 Cost Centres
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
              placeholder="搜尋成本中心..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="show-inactive-cc" className="text-xs text-gray-500 whitespace-nowrap">
              顯示停用
            </Label>
            <Switch
              id="show-inactive-cc"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className={SETTINGS_FILL_CARD_CONTENT}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {search ? "沒有符合的結果" : "暫無資料"}
          </div>
        ) : (
          <div className={SETTINGS_FILL_LIST}>
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors group ${
                  item.status !== "inactive"
                    ? "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
                    : "bg-gray-50 border-gray-100 opacity-60"
                }`}
              >
                <GripVertical className="w-3.5 h-3.5 text-gray-300" />
                {/* Logo thumbnail */}
                <div className="w-8 h-8 flex-shrink-0 rounded border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                  {item.business_logo ? (
                    <img src={item.business_logo} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className="w-4 h-4 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-5 border-blue-200 text-blue-600 bg-blue-50">
                      {item.bu_code || "—"}
                    </Badge>
                    <span className={`text-sm font-medium truncate ${item.status !== "inactive" ? "text-gray-900" : "text-gray-400"}`}>
                      {item.display || "—"}
                    </span>
                    {item.chinese_display && (
                      <span className={`text-xs truncate ${item.status !== "inactive" ? "text-gray-400" : "text-gray-300"}`}>
                        {item.chinese_display}
                      </span>
                    )}
                  </div>
                  {/* Indicators */}
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.bank_notes && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 bg-emerald-50 rounded px-1 py-0.5">
                        <FileText className="w-2.5 h-2.5" />
                        銀行資料
                      </span>
                    )}
                    {item.company_chop && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-600 bg-purple-50 rounded px-1 py-0.5">
                        <Stamp className="w-2.5 h-2.5" />
                        公司印章
                      </span>
                    )}
                    {item.expense_control_enabled === false && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 rounded px-1 py-0.5">
                        <Shield className="w-2.5 h-2.5" />
                        不適用出票控制
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={item.status !== "inactive"}
                    onCheckedChange={() => toggleStatus(item)}
                    className="scale-75"
                  />
                </div>
                {/* Quick download: company logo / chop */}
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30"
                    title={item.business_logo ? "下載公司 Logo" : "未有公司 Logo"}
                    disabled={!item.business_logo}
                    onClick={() => handleImageDownload(item, "logo")}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7 text-purple-500 hover:text-purple-600 hover:bg-purple-50 disabled:opacity-30"
                    title={item.company_chop ? "下載公司印章" : "未有公司印章"}
                    disabled={!item.company_chop}
                    onClick={() => handleImageDownload(item, "chop")}
                  >
                    <Stamp className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7"
                    onClick={() => openEdit(item)}
                  >
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
            ))}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <DialogTitle>{editing ? "編輯成本中心" : "新增成本中心"}</DialogTitle>
            <DialogDescription>
              {editing ? "修改成本中心的基本資料" : "新增一個成本中心"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label>BU Code <span className="text-red-500">*</span></Label>
              <Input
                value={formBuCode}
                onChange={(e) => setFormBuCode(e.target.value)}
                placeholder="例: BWA"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label>英文名稱</Label>
              <Input
                value={formDisplay}
                onChange={(e) => setFormDisplay(e.target.value)}
                placeholder="e.g. BW Architecture"
              />
            </div>
            <div className="space-y-2">
              <Label>中文名稱</Label>
              <Input
                value={formChineseDisplay}
                onChange={(e) => setFormChineseDisplay(e.target.value)}
                placeholder="例: 必維建築"
              />
            </div>

            {/* Bank Notes */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                銀行資料 Bank Notes
              </Label>
              <Textarea
                value={formBankNotes}
                onChange={(e) => setFormBankNotes(e.target.value)}
                placeholder="銀行名稱、帳號、戶名等資訊..."
                rows={4}
                className="text-sm resize-none"
              />
              <p className="text-[11px] text-gray-400">此資訊會顯示在發票/收據 PDF 文件中</p>
            </div>

            {/* Business Logo */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                公司 Logo Business Logo
              </Label>
              <p className="text-[11px] text-amber-600">
                建議使用 PNG 格式以保留透明背景 (Use PNG for a transparent background)
              </p>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, "logo");
                  e.target.value = "";
                }}
              />
              {formBusinessLogo ? (
                <div className="relative inline-block border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <img
                    src={formBusinessLogo}
                    alt="Business Logo"
                    className="h-16 max-w-[200px] object-contain"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-100 hover:bg-red-200 rounded-full"
                    onClick={() => setFormBusinessLogo("")}
                  >
                    <X className="w-3 h-3 text-red-600" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  上傳 Logo
                </Button>
              )}
            </div>

            {/* Company Chop */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Stamp className="w-3.5 h-3.5 text-purple-500" />
                公司印章 Company Chop
              </Label>
              <p className="text-[11px] text-amber-600">
                建議使用 PNG 格式以保留透明背景 (Use PNG for a transparent background)
              </p>
              <input
                ref={chopInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, "chop");
                  e.target.value = "";
                }}
              />
              {formCompanyChop ? (
                <div className="relative inline-block border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <img
                    src={formCompanyChop}
                    alt="Company Chop"
                    className="h-16 max-w-[200px] object-contain"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-100 hover:bg-red-200 rounded-full"
                    onClick={() => setFormCompanyChop("")}
                  >
                    <X className="w-3 h-3 text-red-600" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => chopInputRef.current?.click()}
                  disabled={uploadingChop}
                >
                  {uploadingChop ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  上傳印章
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="form-status-cc"
                checked={formStatus !== "inactive"}
                onCheckedChange={(checked) => setFormStatus(checked ? "active" : "inactive")}
              />
              <Label htmlFor="form-status-cc">啟用中</Label>
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="form-expense-control-cc"
                  checked={formExpenseControlEnabled}
                  onCheckedChange={setFormExpenseControlEnabled}
                />
                <Label htmlFor="form-expense-control-cc" className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                  適用出票控制 Expense Control
                </Label>
              </div>
              <p className="text-[11px] text-gray-400">
                關閉後，此成本中心名下的 BWA 項目不會出現在支出鎖定清單，也不會因 Expense Control 清單而限制出支票。
              </p>
            </div>
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
              確定要刪除「{deleteTarget?.bu_code || deleteTarget?.display}」嗎？此操作無法復原。
              如果有項目正在使用此成本中心，建議停用而非刪除。
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

// ─── Main Export ─────────────────────────────────────────────
export default function CostCentresSettings() {
  return <CostCentresSection />;
}
