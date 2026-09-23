"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { formatDate } from "@/lib/date-utils";
import {
  createCustomerDocument,
  deleteCustomerDocument,
  fetchCustomerDocumentTypes,
  fetchCustomerDocuments,
  updateCustomerDocument,
  uploadCustomerDocumentFile,
  type CustomerDocument,
  type CustomerDocumentType,
} from "@/lib/data/customer-documents";
import { cn } from "@/lib/utils";

export interface CustomerDocumentsPanelProps {
  customerId: string | null | undefined;
  permissionModule: string;
  /** Expense Fix deep-link: type_key like `br` / `form_s1` / `testimonial` */
  focusTypeKey?: string | null;
  onFocusHandled?: () => void;
  className?: string;
  title?: string;
  emptyWithoutCustomerMessage?: string;
}

const emptyForm = {
  type_id: "",
  file_name: "",
  code_number: "",
  expiry_date: "",
  document_date: "",
  remarks: "",
};

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr: string | null, days = 30): boolean {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  const soon = new Date();
  soon.setDate(soon.getDate() + days);
  return expiry > new Date() && expiry <= soon;
}

function fileHref(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}

export default function CustomerDocumentsPanel({
  customerId,
  permissionModule,
  focusTypeKey,
  onFocusHandled,
  className,
  title = "客戶文件",
  emptyWithoutCustomerMessage = "請先選擇客戶後才能管理客戶文件。",
}: CustomerDocumentsPanelProps) {
  const { profile } = useAuth();
  const { canCreate, canEdit, canDelete } = usePermission();

  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [types, setTypes] = useState<CustomerDocumentType[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerDocument | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [typeLocked, setTypeLocked] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CustomerDocument | null>(null);
  const [highlightTypeKey, setHighlightTypeKey] = useState<string | null>(null);
  const focusAppliedRef = useRef<string | null>(null);

  const allowCreate = canCreate(permissionModule);
  const allowEdit = canEdit(permissionModule);
  const allowDelete = canDelete(permissionModule);

  const load = useCallback(async () => {
    if (!customerId) {
      setDocs([]);
      setTypes([]);
      return;
    }
    setLoading(true);
    try {
      const [d, t] = await Promise.all([
        fetchCustomerDocuments(customerId),
        fetchCustomerDocumentTypes(),
      ]);
      setDocs(d);
      setTypes(t);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Expense Control / deep-link: wait for types+docs, then open create/edit for that type.
  useEffect(() => {
    if (!focusTypeKey) {
      focusAppliedRef.current = null;
      return;
    }
    if (loading || types.length === 0) return;
    if (focusAppliedRef.current === focusTypeKey) return;
    focusAppliedRef.current = focusTypeKey;

    setExpanded(true);
    setHighlightTypeKey(focusTypeKey);

    const match = types.find((t) => t.type_key === focusTypeKey);
    const existing = docs.find((d) => d.type_key === focusTypeKey) ?? null;

    if (existing && allowEdit) {
      setEditing(existing);
      setSelectedFile(null);
      setTypeLocked(true);
      setForm({
        type_id: existing.type_id,
        file_name: existing.file_name || "",
        code_number: existing.code_number || "",
        expiry_date: existing.expiry_date
          ? existing.expiry_date.split("T")[0]
          : "",
        document_date: existing.document_date
          ? existing.document_date.split("T")[0]
          : "",
        remarks: existing.remarks || "",
      });
      setDialogOpen(true);
    } else if (match && allowCreate) {
      setEditing(null);
      setSelectedFile(null);
      setTypeLocked(true);
      setForm({
        ...emptyForm,
        type_id: match.id,
        file_name: match.type,
      });
      setDialogOpen(true);
    }
    onFocusHandled?.();
  }, [focusTypeKey, types, docs, loading, allowCreate, allowEdit, onFocusHandled]);

  const selectedType = types.find((t) => t.id === form.type_id);

  const docsByTypeId = new Map<string, CustomerDocument[]>();
  for (const doc of docs) {
    const list = docsByTypeId.get(doc.type_id) || [];
    list.push(doc);
    docsByTypeId.set(doc.type_id, list);
  }

  const uploadedTypeCount = types.filter(
    (t) => (docsByTypeId.get(t.id)?.length || 0) > 0
  ).length;

  function openCreate(presetTypeId?: string) {
    setEditing(null);
    setSelectedFile(null);
    const t = presetTypeId ? types.find((x) => x.id === presetTypeId) : null;
    setTypeLocked(!!presetTypeId);
    setForm({
      ...emptyForm,
      type_id: presetTypeId || "",
      file_name: t?.type || "",
    });
    setDialogOpen(true);
  }

  function openEdit(doc: CustomerDocument) {
    setEditing(doc);
    setSelectedFile(null);
    setTypeLocked(true);
    setForm({
      type_id: doc.type_id,
      file_name: doc.file_name || "",
      code_number: doc.code_number || "",
      expiry_date: doc.expiry_date ? doc.expiry_date.split("T")[0] : "",
      document_date: doc.document_date ? doc.document_date.split("T")[0] : "",
      remarks: doc.remarks || "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!customerId) return;
    if (!form.type_id) {
      alert("請選擇文件類型");
      return;
    }
    if (selectedType?.code_number_required && !form.code_number.trim()) {
      alert("此類型必須填寫 BR 號碼");
      return;
    }
    if (!editing && !selectedFile) {
      alert("請選擇檔案");
      return;
    }

    setSaving(true);
    try {
      let fileUrl = editing?.file || null;
      const typeKey = selectedType?.type_key || "misc";

      if (selectedFile) {
        const up = await uploadCustomerDocumentFile(customerId, typeKey, selectedFile);
        if (!up.success || !up.url) {
          alert(up.error || "上傳失敗");
          return;
        }
        fileUrl = up.url;
      }

      const payload = {
        type_id: form.type_id,
        file_name: form.file_name.trim() || selectedType?.type || null,
        file: fileUrl,
        code_number: form.code_number.trim() || null,
        expiry_date: form.expiry_date
          ? new Date(form.expiry_date).toISOString()
          : null,
        document_date: form.document_date
          ? new Date(form.document_date).toISOString()
          : null,
        remarks: form.remarks.trim() || null,
        created_by_id: profile?.id || null,
        migration_status: fileUrl ? "native" : "number_only",
      };

      if (editing) {
        const res = await updateCustomerDocument(editing.id, payload);
        if (!res.success) {
          alert(res.error || "更新失敗");
          return;
        }
      } else {
        const res = await createCustomerDocument(customerId, payload);
        if (!res.success) {
          alert(res.error || "新增失敗");
          return;
        }
      }

      setDialogOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await deleteCustomerDocument(deleting.id);
    if (!res.success) {
      alert(res.error || "刪除失敗");
      return;
    }
    setDeleting(null);
    await load();
  }

  if (!customerId) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed p-6 text-sm text-muted-foreground",
          className
        )}
      >
        {emptyWithoutCustomerMessage}
      </div>
    );
  }

  return (
    <Card
      className={cn("border border-gray-100 shadow-sm", className)}
      data-customer-docs-panel
    >
      <CardHeader className="pb-2 px-5 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-50">
              <FileText className="w-4 h-4 text-sky-500" />
            </div>
            <div>
              <CardTitle className="text-[15px] font-semibold text-gray-800">
                {title}
              </CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">Customer Documents</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              className={cn(
                "text-xs px-2.5 py-0.5 font-mono",
                types.length > 0 && uploadedTypeCount === types.length
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
              )}
            >
              {uploadedTypeCount} / {types.length || 0}
            </Badge>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-5 pb-4 pt-1">
          <Separator className="mb-3" />
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              載入中…
            </div>
          ) : types.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              尚未設定客戶文件類型
            </p>
          ) : (
            <div className="space-y-0">
              {types.map((dt) => {
                const uploadedDocs = docsByTypeId.get(dt.id) || [];
                const hasDoc = uploadedDocs.length > 0;
                const latestDoc = hasDoc ? uploadedDocs[0] : null;
                const expired = latestDoc ? isExpired(latestDoc.expiry_date) : false;
                const expiringSoon = latestDoc
                  ? isExpiringSoon(latestDoc.expiry_date)
                  : false;
                const isHighlighted =
                  !!highlightTypeKey && dt.type_key === highlightTypeKey;
                const numberOnly =
                  latestDoc?.migration_status === "number_only" && !latestDoc.file;

                return (
                  <div
                    key={dt.id}
                    className={cn(
                      "flex items-center justify-between py-3 px-3 rounded-lg transition-all group",
                      isHighlighted && "ring-2 ring-amber-400 bg-amber-50/70",
                      hasDoc ? "hover:bg-emerald-50/50" : "hover:bg-amber-50/50"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {hasDoc ? (
                        expired ? (
                          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                          </div>
                        ) : expiringSoon || numberOnly ? (
                          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          </div>
                        )
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <XCircle className="w-3.5 h-3.5 text-gray-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-[15px] font-medium truncate",
                            hasDoc ? "text-gray-800" : "text-gray-400"
                          )}
                        >
                          {dt.type}
                        </p>
                        {hasDoc && latestDoc && (
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[13px] text-gray-400 truncate">
                              {latestDoc.file_name ||
                                (latestDoc.code_number
                                  ? `號碼：${latestDoc.code_number}`
                                  : "已上載")}
                            </span>
                            {latestDoc.code_number && latestDoc.file_name && (
                              <span className="text-[13px] text-gray-400">
                                · {latestDoc.code_number}
                              </span>
                            )}
                            {latestDoc.expiry_date && (
                              <span
                                className={cn(
                                  "text-[13px]",
                                  expired
                                    ? "text-red-500"
                                    : expiringSoon
                                      ? "text-amber-500"
                                      : "text-gray-400"
                                )}
                              >
                                · 到期: {formatDate(latestDoc.expiry_date)}
                              </span>
                            )}
                            {numberOnly && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                僅號碼
                              </Badge>
                            )}
                            {latestDoc.migration_status === "copy_failed" && (
                              <Badge
                                variant="destructive"
                                className="text-[10px] px-1.5 py-0"
                              >
                                複製失敗
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {hasDoc && latestDoc ? (
                        <>
                          {expired && (
                            <Badge className="bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/10 text-[12px] px-1.5 py-0">
                              已過期
                            </Badge>
                          )}
                          {expiringSoon && !expired && (
                            <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/10 text-[12px] px-1.5 py-0">
                              即將到期
                            </Badge>
                          )}
                          {latestDoc.file && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={fileHref(latestDoc.file)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-md hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>檢視檔案</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {allowEdit && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => openEdit(latestDoc)}
                                    className="p-1.5 rounded-md hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-gray-400" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>編輯</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {allowDelete && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => setDeleting(latestDoc)}
                                    className="p-1.5 rounded-md hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>刪除</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </>
                      ) : allowCreate ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-[12px] px-2 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                          onClick={() => openCreate(dt.id)}
                        >
                          <Plus className="w-3 h-3" /> 新增
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "編輯客戶文件" : "新增客戶文件"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>文件類型</Label>
              <Select
                value={form.type_id}
                disabled={typeLocked}
                onValueChange={(v) => {
                  const t = types.find((x) => x.id === v);
                  setForm((f) => ({
                    ...f,
                    type_id: v,
                    file_name: f.file_name || t?.type || "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇類型" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>檔案名稱</Label>
              <Input
                value={form.file_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, file_name: e.target.value }))
                }
              />
            </div>

            {(selectedType?.code_number_required ||
              selectedType?.type_key === "br" ||
              !!form.code_number) && (
              <div className="space-y-1.5">
                <Label>
                  BR 號碼
                  {selectedType?.code_number_required && (
                    <span className="text-red-500"> *</span>
                  )}
                </Label>
                <Input
                  value={form.code_number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code_number: e.target.value }))
                  }
                />
              </div>
            )}

            {selectedType?.enable_expiry_date && (
              <div className="space-y-1.5">
                <Label>到期日</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expiry_date: e.target.value }))
                  }
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>文件日期</Label>
              <Input
                type="date"
                value={form.document_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, document_date: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>備註</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) =>
                  setForm((f) => ({ ...f, remarks: e.target.value }))
                }
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                檔案
                {!editing && <span className="text-red-500"> *</span>}
              </Label>
              {editing?.file && !selectedFile && (
                <div className="mb-1 text-xs text-muted-foreground truncate">
                  現有：{editing.file}
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-muted/50">
                <Upload className="h-4 w-4" />
                {selectedFile ? selectedFile.name : "選擇檔案上傳"}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) =>
                    setSelectedFile(e.target.files?.[0] || null)
                  }
                />
              </label>
              {editing?.migration_status === "number_only" && !editing.file && (
                <p className="text-xs text-muted-foreground">
                  此列目前僅有號碼；可只更新號碼，或補上檔案。
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除客戶文件？</AlertDialogTitle>
            <AlertDialogDescription>
              將刪除「{deleting?.file_name || deleting?.type_label}」。僅會移除
              customer-docs 儲存物件；外部/舊連結不會被刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
