"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  File,
  FileImage,
  FileArchive,
  FilePieChart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  fetchDocTypes,
  fetchProjectDocuments,
  createProjectDocument,
  updateProjectDocument,
  deleteProjectDocument,
  uploadProjectDocFile,
  deleteProjectDocFile,
  fetchProjectManHourImages,
  type DocType,
  type ProjectDocument,
  type ProjectDocFormData,
  type ManHourImage,
} from "@/lib/data-service";
import { AttachmentThumbnail } from "@/components/ui/attachment-thumbnail";
import { getAttachmentFileName, getAttachmentKind, isImageAttachmentUrl } from "@/lib/attachment-utils";
import { usePermission } from "@/hooks/use-permission";
import CustomerDocumentsPanel from "@/components/clients/CustomerDocumentsPanel";

export interface ProjectDocumentsFocus {
  highlightDocTypeIds?: string[];
  openUploadForDocTypeId?: string | null;
  /** Expense Fix — focus 客戶文件 (customer_document_types.type_key). */
  customerDocsFocusTypeKey?: string | null;
}

interface ProjectDocumentsPanelProps {
  projectId: string;
  /** Override the permission module used for CRUD checks. Defaults to "projects". */
  permissionModule?: string;
  /** Linked customer — renders 客戶文件 section when set. */
  customerId?: string | null;
  /** Expense Fix deep-link for customer docs (type_key: br | form_s1 | testimonial). */
  customerDocsFocusTypeKey?: string | null;
  onCustomerDocsFocusHandled?: () => void;
  /** Deep-link from Expense Control — highlight rows and/or open upload dialog. */
  docsFocus?: ProjectDocumentsFocus | null;
  onDocsFocusHandled?: () => void;
}

/** BR / Form S1 / Testimonial moved to customer_document_types — hide from project doc lists. */
function isMigratedCustomerProjectDocType(dt: DocType): boolean {
  const label = (dt.display || "").toLowerCase();
  return (
    label.includes("商業登記") ||
    /\bbr\b/.test(label) ||
    /form\s*s\s*1/.test(label) ||
    label.includes("testimonial") ||
    label.includes("推薦信")
  );
}

// ─── HELPERS ──────────────────────────────────────────────
import { formatDate } from "@/lib/date-utils";

function getFileIcon(url: string | null) {
  if (!url) return File;
  const lower = url.toLowerCase();
  if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)/)) return FileImage;
  if (lower.match(/\.(zip|rar|7z|tar|gz)/)) return FileArchive;
  if (lower.match(/\.(xls|xlsx|csv)/)) return FilePieChart;
  return FileText;
}

function getFileName(url: string | null): string {
  if (!url) return "";
  const parts = url.split("/");
  const last = parts[parts.length - 1];
  // Remove timestamp prefix like "1234567890_abc123."
  return last.replace(/^\d+_[a-z0-9]+\./, "file.");
}

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

// ─── MAIN COMPONENT ──────────────────────────────────────
export default function ProjectDocumentsPanel({
  projectId,
  permissionModule = "projects",
  customerId,
  customerDocsFocusTypeKey,
  onCustomerDocsFocusHandled,
  docsFocus = null,
  onDocsFocusHandled,
}: ProjectDocumentsPanelProps) {
  const { canCreate, canEdit, canDelete } = usePermission();
  const _canCreate = canCreate(permissionModule);
  const _canEdit = canEdit(permissionModule);
  const _canDelete = canDelete(permissionModule);
  const [loading, setLoading] = useState(true);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ProjectDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [essentialExpanded, setEssentialExpanded] = useState(true);
  const [otherExpanded, setOtherExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // 工作匯報成果 — man-hour task result attachments
  const [manHourImages, setManHourImages] = useState<ManHourImage[]>([]);
  const [manHourExpanded, setManHourExpanded] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form state
  const [formDocName, setFormDocName] = useState("");
  const [formDocTypeId, setFormDocTypeId] = useState<string | null>(null);
  const [formDocDate, setFormDocDate] = useState("");
  const [formExpiryDate, setFormExpiryDate] = useState("");
  const [formRemark, setFormRemark] = useState("");
  const [formFileUrl, setFormFileUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docsFocusAppliedRef = useRef<string | null>(null);
  const [highlightedDocTypeIds, setHighlightedDocTypeIds] = useState<string[]>([]);

  // ─── Load data ──────────────────────────────────
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [types, docs, mhImages] = await Promise.all([
      fetchDocTypes(),
      fetchProjectDocuments(projectId),
      fetchProjectManHourImages(projectId),
    ]);
    setDocTypes(types);
    setDocuments(docs);
    setManHourImages(mhImages);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Derived data ──────────────────────────────
  const projectDocTypes = docTypes.filter((dt) => !isMigratedCustomerProjectDocType(dt));
  const essentialDocTypes = projectDocTypes.filter((dt) => dt.category === "必要文件");
  const allDocTypes = projectDocTypes;

  const effectiveCustomerDocsFocusTypeKey =
    customerDocsFocusTypeKey ?? docsFocus?.customerDocsFocusTypeKey ?? null;

  // Map: doc_type_id → uploaded documents for that type
  const docsByTypeId = new Map<string, ProjectDocument[]>();
  documents.forEach(doc => {
    if (doc.doc_type_id) {
      const list = docsByTypeId.get(doc.doc_type_id) || [];
      list.push(doc);
      docsByTypeId.set(doc.doc_type_id, list);
    }
  });

  // "Other" documents: those not in essential category
  const essentialTypeIds = new Set(essentialDocTypes.map(dt => dt.id));
  const otherDocuments = documents.filter(doc => !doc.doc_type_id || !essentialTypeIds.has(doc.doc_type_id));

  // Filter other documents by search
  const filteredOtherDocs = otherDocuments.filter(doc => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (doc.doc_name?.toLowerCase().includes(q)) ||
      (doc.doc_type_display?.toLowerCase().includes(q)) ||
      (doc.remark?.toLowerCase().includes(q))
    );
  });

  // Stats
  const essentialTotal = essentialDocTypes.length;
  const essentialUploaded = essentialDocTypes.filter(dt => (docsByTypeId.get(dt.id)?.length || 0) > 0).length;

  // ─── Dialog helpers ────────────────────────────
  const resetForm = () => {
    setFormDocName("");
    setFormDocTypeId(null);
    setFormDocDate("");
    setFormExpiryDate("");
    setFormRemark("");
    setFormFileUrl(null);
    setPendingFile(null);
    setEditingDoc(null);
  };

  const openCreateDialog = (presetDocTypeId?: string) => {
    resetForm();
    if (presetDocTypeId) {
      setFormDocTypeId(presetDocTypeId);
      const dt = docTypes.find(d => d.id === presetDocTypeId);
      if (dt?.display) setFormDocName(dt.display);
    }
    setShowDialog(true);
  };

  // Apply deep-link focus from Expense Control fix buttons (project docs only).
  useEffect(() => {
    if (!docsFocus) {
      docsFocusAppliedRef.current = null;
      return;
    }
    if (loading) return;

    const hasProjectDocsFocus =
      (docsFocus.highlightDocTypeIds?.length ?? 0) > 0 ||
      !!docsFocus.openUploadForDocTypeId;
    if (!hasProjectDocsFocus) return;

    const focusKey = JSON.stringify({
      highlightDocTypeIds: docsFocus.highlightDocTypeIds,
      openUploadForDocTypeId: docsFocus.openUploadForDocTypeId,
    });
    if (docsFocusAppliedRef.current === focusKey) return;
    docsFocusAppliedRef.current = focusKey;

    setEssentialExpanded(true);
    setOtherExpanded(true);

    if (docsFocus.highlightDocTypeIds?.length) {
      setHighlightedDocTypeIds(docsFocus.highlightDocTypeIds);
    }

    if (docsFocus.openUploadForDocTypeId && _canCreate) {
      resetForm();
      const presetId = docsFocus.openUploadForDocTypeId;
      setFormDocTypeId(presetId);
      const dt = docTypes.find((d) => d.id === presetId);
      if (dt?.display) setFormDocName(dt.display);
      setShowDialog(true);
    }

    onDocsFocusHandled?.();
  }, [docsFocus, loading, docTypes, _canCreate, onDocsFocusHandled]);

  const openEditDialog = (doc: ProjectDocument) => {
    setEditingDoc(doc);
    setFormDocName(doc.doc_name || "");
    setFormDocTypeId(doc.doc_type_id);
    setFormDocDate(doc.document_date?.split("T")[0] || "");
    setFormExpiryDate(doc.expiry_date?.split("T")[0] || "");
    setFormRemark(doc.remark || "");
    setFormFileUrl(doc.file);
    setPendingFile(null);
    setShowDialog(true);
  };

  // ─── File upload ───────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
    }
  };

  // ─── Save ──────────────────────────────────────
  const handleSave = async () => {
    if (!formDocName.trim()) return;
    setSaving(true);

    let fileUrl = formFileUrl;

    // Upload new file if pending
    if (pendingFile) {
      setUploading(true);
      const uploadResult = await uploadProjectDocFile(projectId, pendingFile);
      setUploading(false);
      if (uploadResult.success && uploadResult.url) {
        fileUrl = uploadResult.url;
      } else {
        console.error("Upload failed:", uploadResult.error);
        setSaving(false);
        return;
      }
    }

    const formData: ProjectDocFormData = {
      doc_name: formDocName.trim(),
      doc_type_id: formDocTypeId,
      document_date: formDocDate || null,
      expiry_date: formExpiryDate || null,
      remark: formRemark.trim() || null,
      file: fileUrl,
    };

    if (editingDoc) {
      const result = await updateProjectDocument(editingDoc.id, formData);
      if (result.success) {
        setShowDialog(false);
        resetForm();
        loadData(true);
      }
    } else {
      const result = await createProjectDocument(projectId, formData);
      if (result.success) {
        setShowDialog(false);
        resetForm();
        loadData(true);
      }
    }
    setSaving(false);
  };

  // ─── Delete ────────────────────────────────────
  const handleDelete = async (doc: ProjectDocument) => {
    if (!confirm(`確定要刪除文件「${doc.doc_name}」？`)) return;
    setDeletingId(doc.id);
    // Delete file from storage if it's a project-docs URL
    if (doc.file && doc.file.includes("project-docs")) {
      await deleteProjectDocFile(doc.file);
    }
    const result = await deleteProjectDocument(doc.id);
    setDeletingId(null);
    if (result.success) {
      loadData(true);
    }
  };

  // ─── Selected doc type info ────────────────────
  const selectedDocType = formDocTypeId ? docTypes.find(dt => dt.id === formDocTypeId) : null;

  // ─── Loading state ─────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-400">載入文件資料中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── CUSTOMER DOCUMENTS (shared across projects) ───── */}
      {customerId && (
        <CustomerDocumentsPanel
          customerId={customerId}
          permissionModule={permissionModule}
          focusTypeKey={effectiveCustomerDocsFocusTypeKey}
          onFocusHandled={onCustomerDocsFocusHandled}
        />
      )}

      {/* ─── ESSENTIAL DOCUMENTS CHECKLIST ─────────────────── */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 px-5 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50">
                <FileText className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-[15px] font-semibold text-gray-800">
                  必要文件
                </CardTitle>
                <p className="text-xs text-gray-400 mt-0.5">Essential Project Documents</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                className={cn(
                  "text-xs px-2.5 py-0.5 font-mono",
                  essentialUploaded === essentialTotal
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                )}
              >
                {essentialUploaded} / {essentialTotal}
              </Badge>
              <button
                onClick={() => setEssentialExpanded(!essentialExpanded)}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              >
                {essentialExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </CardHeader>
        {essentialExpanded && (
          <CardContent className="px-5 pb-4 pt-1">
            <Separator className="mb-3" />
            <div className="space-y-0">
              {essentialDocTypes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  尚未設定必要文件類型
                </p>
              ) : (
                essentialDocTypes.map((dt) => {
                  const uploadedDocs = docsByTypeId.get(dt.id) || [];
                  const hasDoc = uploadedDocs.length > 0;
                  const latestDoc = hasDoc ? uploadedDocs[0] : null;
                  const expired = latestDoc ? isExpired(latestDoc.expiry_date) : false;
                  const expiringSoon = latestDoc ? isExpiringSoon(latestDoc.expiry_date) : false;
                  const isHighlighted = highlightedDocTypeIds.includes(dt.id);

                  return (
                    <div
                      key={dt.id}
                      className={cn(
                        "flex items-center justify-between py-3 px-3 rounded-lg transition-all group",
                        isHighlighted && "ring-2 ring-amber-400 bg-amber-50/70",
                        hasDoc
                          ? "hover:bg-emerald-50/50"
                          : "hover:bg-amber-50/50"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {hasDoc ? (
                          expired ? (
                            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            </div>
                          ) : expiringSoon ? (
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
                          <p className={cn(
                            "text-[15px] font-medium truncate",
                            hasDoc ? "text-gray-800" : "text-gray-400"
                          )}>
                            {dt.display || "未命名文件類型"}
                          </p>
                          {hasDoc && latestDoc && (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[13px] text-gray-400">
                                {latestDoc.doc_name}
                              </span>
                              {latestDoc.expiry_date && (
                                <span className={cn(
                                  "text-[13px]",
                                  expired ? "text-red-500" : expiringSoon ? "text-amber-500" : "text-gray-400"
                                )}>
                                  · 到期: {formatDate(latestDoc.expiry_date)}
                                </span>
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
                                      href={latestDoc.file}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 rounded-md hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-blue-500" />
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent><p>檢視檔案</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {_canEdit && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => openEditDialog(latestDoc)}
                                    className="p-1.5 rounded-md hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-gray-400" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent><p>編輯</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            )}
                            {_canDelete && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleDelete(latestDoc)}
                                    disabled={deletingId === latestDoc.id}
                                    className="p-1.5 rounded-md hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    {deletingId === latestDoc.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent><p>刪除</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            )}
                          </>
                        ) : _canCreate ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-[12px] px-2 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                            onClick={() => openCreateDialog(dt.id)}
                          >
                            <Plus className="w-3 h-3" /> 新增
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ─── OTHER / ADDITIONAL DOCUMENTS ─────────────────── */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 px-5 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-50">
                <FileText className="w-4 h-4 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-[15px] font-semibold text-gray-800">
                  額外文件
                </CardTitle>
                <p className="text-xs text-gray-400 mt-0.5">Additional Project Documents</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {_canCreate && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-[14px]"
                onClick={() => openCreateDialog()}
              >
                <Plus className="w-3.5 h-3.5" /> 新增文件
              </Button>
              )}
              <button
                onClick={() => setOtherExpanded(!otherExpanded)}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              >
                {otherExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </CardHeader>
        {otherExpanded && (
          <CardContent className="px-5 pb-4 pt-1">
            <Separator className="mb-3" />

            {/* Search */}
            {otherDocuments.length > 0 && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  placeholder="搜尋文件名稱..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-xs"
                />
              </div>
            )}

            {filteredOtherDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                  <FileText className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-400 mb-1">
                  {searchQuery ? "找不到符合的文件" : "尚無額外文件"}
                </p>
                <p className="text-xs text-gray-300">
                  {searchQuery ? "請嘗試其他關鍵字" : "點擊「新增文件」上傳額外項目文件"}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/60">
                      <TableHead className="text-[13px] text-gray-500 font-medium h-9">文件名稱</TableHead>
                      <TableHead className="text-[13px] text-gray-500 font-medium h-9">文件類型</TableHead>
                      <TableHead className="text-[13px] text-gray-500 font-medium h-9">文件日期</TableHead>
                      <TableHead className="text-[13px] text-gray-500 font-medium h-9">到期日</TableHead>
                      <TableHead className="text-[13px] text-gray-500 font-medium h-9">備註</TableHead>
                      <TableHead className="text-[13px] text-gray-500 font-medium h-9 text-right w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOtherDocs.map((doc) => {
                      const FileIcon = getFileIcon(doc.file);
                      const expired = isExpired(doc.expiry_date);
                      const expiring = isExpiringSoon(doc.expiry_date);

                      return (
                        <TableRow
                          key={doc.id}
                          className="group hover:bg-gray-50/50 transition-colors"
                        >
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2">
                              <FileIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-[15px] font-medium text-gray-800 truncate max-w-[200px]">
                                {doc.doc_name || "未命名"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {doc.doc_type_display ? (
                              <Badge variant="outline" className="text-[12px] px-1.5 py-0">
                                {doc.doc_type_display}
                              </Badge>
                            ) : (
                              <span className="text-[13px] text-gray-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 text-[14px] text-gray-500 font-mono">
                            {formatDate(doc.document_date)}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className={cn(
                              "text-[14px] font-mono",
                              expired ? "text-red-500 font-medium" : expiring ? "text-amber-500" : "text-gray-500"
                            )}>
                              {formatDate(doc.expiry_date)}
                            </span>
                            {expired && (
                              <Badge className="ml-1 bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/10 text-[11px] px-1 py-0">
                                已過期
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 text-[14px] text-gray-500 max-w-[150px] truncate">
                            {doc.remark || "—"}
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {doc.file && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={doc.file}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-md hover:bg-blue-50 transition-colors"
                                      >
                                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent><p>檢視</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {_canEdit && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => openEditDialog(doc)}
                                      className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>編輯</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              )}
                              {_canDelete && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleDelete(doc)}
                                      disabled={deletingId === doc.id}
                                      className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                                    >
                                      {deletingId === doc.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>刪除</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ─── 工作匯報成果 / MAN-HOUR RESULT IMAGES ────────── */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 px-5 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50">
                <FileImage className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-[15px] font-semibold text-gray-800">
                  工作匯報成果
                </CardTitle>
                <p className="text-xs text-gray-400 mt-0.5">Man-Hour Report Results</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[12px] px-1.5 py-0">
                {manHourImages.length}
              </Badge>
              <button
                onClick={() => setManHourExpanded(!manHourExpanded)}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              >
                {manHourExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </CardHeader>
        {manHourExpanded && (
          <CardContent className="px-5 pb-4 pt-1">
            <Separator className="mb-3" />
            {manHourImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                  <FileImage className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-400 mb-1">尚無工作匯報成果附件</p>
                <p className="text-xs text-gray-300">工時記錄上傳的成果檔案會顯示在此處</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {manHourImages.map((img, idx) => (
                  <button
                    key={`${img.task_id}-${idx}`}
                    onClick={() => {
                      if (isImageAttachmentUrl(img.url)) setPreviewImage(img.url);
                      else if (getAttachmentKind(img.url) === "pdf" || getAttachmentKind(img.url) === "ppt") {
                        setPreviewImage(img.url);
                      } else {
                        window.open(img.url, "_blank", "noopener");
                      }
                    }}
                    className="group relative aspect-square rounded-lg overflow-hidden border border-gray-100 bg-gray-50 hover:border-bw-blue/40 hover:shadow-sm transition-all"
                    title={img.task_name || getAttachmentFileName(img.url)}
                  >
                    <AttachmentThumbnail
                      url={img.url}
                      alt={img.task_name || "成果附件"}
                      showLabel={!isImageAttachmentUrl(img.url)}
                    />
                    {img.task_name && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                        <p className="text-[11px] text-white truncate">{img.task_name}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ─── ATTACHMENT PREVIEW (images + PDF/PPT) ────────── */}
      <Dialog open={!!previewImage} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="sm:max-w-3xl p-2 bg-black/95 border-none">
          {previewImage && isImageAttachmentUrl(previewImage) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImage}
              alt="成果附件預覽"
              className="w-full max-h-[80vh] object-contain rounded"
            />
          )}
          {previewImage && !isImageAttachmentUrl(previewImage) && (
            <div className="flex flex-col items-center justify-center gap-3 py-4">
              <AttachmentThumbnail
                url={previewImage}
                alt={getAttachmentFileName(previewImage)}
                className="w-full max-h-[75vh] flex items-center justify-center"
                imgClassName="max-w-full max-h-[75vh] object-contain rounded"
                previewWidth={960}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-white/90 hover:text-white hover:bg-white/10"
                onClick={() => window.open(previewImage, "_blank", "noopener")}
              >
                開啟檔案
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── CREATE / EDIT DIALOG ────────────────────────── */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingDoc ? "編輯文件" : "新增項目文件"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Doc Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">文件名稱 <span className="text-red-400">*</span></label>
              <Input
                placeholder="輸入文件名稱..."
                value={formDocName}
                onChange={(e) => setFormDocName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Doc Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">文件類型</label>
              <Select
                value={formDocTypeId || "none"}
                onValueChange={(val) => setFormDocTypeId(val === "none" ? null : val)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="選擇文件類型..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— 不指定 —</SelectItem>
                  {allDocTypes.map((dt) => (
                    <SelectItem key={dt.id} value={dt.id}>
                      <span className="flex items-center gap-2">
                        {dt.display || "未命名"}
                        {dt.category && (
                          <Badge variant="outline" className="text-[11px] px-1 py-0 ml-1">
                            {dt.category}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              {(!selectedDocType || selectedDocType.enable_doc_date) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">文件日期</label>
                  <Input
                    type="date"
                    value={formDocDate}
                    onChange={(e) => setFormDocDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              )}
              {(!selectedDocType || selectedDocType.enable_expiry_date) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">到期日</label>
                  <Input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              )}
            </div>

            {/* File Upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">檔案</label>
              {formFileUrl && !pendingFile ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-gray-50/50">
                  <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <a
                    href={formFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate flex-1"
                  >
                    {getFileName(formFileUrl) || "已上傳的檔案"}
                  </a>
                  <button
                    onClick={() => setFormFileUrl(null)}
                    className="p-1 rounded hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              ) : pendingFile ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-blue-200 bg-blue-50/50">
                  <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-xs text-blue-700 truncate flex-1">{pendingFile.name}</span>
                  <button
                    onClick={() => setPendingFile(null)}
                    className="p-1 rounded hover:bg-blue-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                >
                  <Upload className="w-6 h-6 text-gray-300 mb-2" />
                  <p className="text-xs text-gray-400">點擊上傳檔案</p>
                  <p className="text-[12px] text-gray-300 mt-0.5">支援所有檔案格式</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Remark */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">備註</label>
              <Textarea
                placeholder="輸入備註..."
                value={formRemark}
                onChange={(e) => setFormRemark(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving || !formDocName.trim()}>
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  {uploading ? "上傳檔案中..." : "儲存中..."}
                </>
              ) : (
                editingDoc ? "更新" : "新增"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
