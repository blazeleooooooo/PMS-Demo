"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Loader2,
  FolderOpen,
  MessageCircle,
  FileText,
  Package,
  Star,
  ExternalLink,
  User,
  Plus,
  Pencil,
  Trash2,
  File as FileIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { fetchBWFProjectIdsByFactory } from "@/lib/data-service";
import { formatDate } from "@/lib/date-utils";
import { buildStorageObjectKey } from "@/lib/storage-utils";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { getOrderStatusChinese } from "@/components/projects/BWFOrderDialog";

interface ProjectItem {
  key: string;
  project_id: string;
  source: "bwa" | "bwf";
  project_name: string | null;
  handover_date: string | null;
  status: string | null;
  total_installment: number;
  total_paid: number;
  paid_percentage: number;
}

interface OrderItem {
  id: string;
  project_id: string | null;
  project_code: string | null;
  project_name: string | null;
  product_name: string | null;
  quantity: number | null;
  est_delivery_date: string | null;
  est_installation_date: string | null;
  status: string | null;
}

interface CommentItem {
  id: string;
  comment: string | null;
  point: number | null;
  created_date: string | null;
  evaluator: string | null;
  project: string | null;
}

interface FileItem {
  id: string;
  file_name: string | null;
  file: string | null;
  created_date: string | null;
}

function isImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|avif)(\?|$)/i.test(lower) ||
    lower.includes("image/") ||
    lower.includes("/render/file/")
  );
}

function FileThumbnail({
  url,
  fileName,
}: {
  url: string | null | undefined;
  fileName?: string | null;
}) {
  const [imgError, setImgError] = useState(false);

  if (!url) {
    return (
      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        <FileIcon className="w-5 h-5 text-gray-400" />
      </div>
    );
  }

  if (isImageUrl(url) && !imgError) {
    return (
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
        <img
          src={url}
          alt={fileName || "preview"}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200">
      <FileIcon className="w-5 h-5 text-gray-400" />
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="text-gray-400 text-[13px]">未設定</Badge>;
  const s = status.toLowerCase();
  const label = getOrderStatusChinese(status);
  if (status === "暫時完結")
    return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[13px] font-medium">{label}</Badge>;
  if (s.includes("complete") || s.includes("done") || s.includes("完成"))
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[13px] font-medium">{label}</Badge>;
  if (s.includes("install"))
    return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[13px] font-medium">{label}</Badge>;
  if (s.includes("production") || s.includes("生產"))
    return <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 text-[13px] font-medium">{label}</Badge>;
  if (s.includes("pending") || s.includes("wait") || s.includes("等待"))
    return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-[13px] font-medium">{label}</Badge>;
  return <Badge variant="outline" className="text-[13px]">{label}</Badge>;
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: React.ElementType;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <Icon className="w-8 h-8 mb-2 text-gray-300" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export default function FactoryDetailTabs({ factoryId }: { factoryId: string }) {
  const { profile } = useAuth();
  const { canEdit } = usePermission();
  const { formatMoney } = useFinancialFormat();
  const canEditFactory = canEdit("factories");

  const [activeTab, setActiveTab] = useState("projects");
  const [loading, setLoading] = useState(false);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);

  const [counts, setCounts] = useState({
    projects: 0,
    orders: 0,
    comments: 0,
    files: 0,
  });

  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [fileDeleteConfirmOpen, setFileDeleteConfirmOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [deletingFile, setDeletingFile] = useState<FileItem | null>(null);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCounts();
  }, [factoryId]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, factoryId]);

  async function loadCounts() {
    const [expRes, bwfProjectIds, orderRes, comRes, fileRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("project_id")
        .eq("factory_id", factoryId)
        .not("project_id", "is", null),
      fetchBWFProjectIdsByFactory(factoryId),
      supabase
        .from("bwf_orders")
        .select("id, bwf_project_id", { count: "exact", head: false })
        .eq("factory_id", factoryId),
      supabase
        .from("staff_supplier_comments")
        .select("id", { count: "exact", head: true })
        .eq("factory_id", factoryId),
      supabase
        .from("factory_files")
        .select("id", { count: "exact", head: true })
        .eq("factory_id", factoryId),
    ]);

    const bwaProjectIds = new Set(
      (expRes.data || []).map((e: { project_id: string | null }) => e.project_id).filter(Boolean)
    );
    const bwfProjectIdsSet = new Set(bwfProjectIds);
    (orderRes.data || []).forEach((o: { bwf_project_id: string | null }) => {
      if (o.bwf_project_id) bwfProjectIdsSet.add(o.bwf_project_id);
    });

    setCounts({
      projects: bwaProjectIds.size + bwfProjectIdsSet.size,
      orders: orderRes.count ?? (orderRes.data || []).length,
      comments: comRes.count || 0,
      files: fileRes.count || 0,
    });
  }

  async function loadTabData(tab: string) {
    setLoading(true);
    try {
      switch (tab) {
        case "projects":
          await loadProjects();
          break;
        case "orders":
          await loadOrders();
          break;
        case "comments":
          await loadComments();
          break;
        case "files":
          await loadFiles();
          break;
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    const { data: expenseRows } = await supabase
      .from("expenses")
      .select(
        "project_id, installment_amount, paid_amount, bwa_projects:bwa_projects!fk_expenses_project_id(id, project_name, project_code, handover_date, status)"
      )
      .eq("factory_id", factoryId)
      .not("project_id", "is", null);

    const map = new Map<string, ProjectItem>();

    (expenseRows ?? []).forEach((e: any) => {
      if (!e.project_id) return;
      const key = `bwa-${e.project_id}`;
      const installment = Number(e.installment_amount) || 0;
      const paid = Number(e.paid_amount) || 0;
      const existing = map.get(key);

      if (existing) {
        existing.total_installment += installment;
        existing.total_paid += paid;
        existing.paid_percentage =
          existing.total_installment > 0
            ? Math.round((existing.total_paid / existing.total_installment) * 100)
            : 0;
      } else {
        map.set(key, {
          key,
          project_id: e.project_id,
          source: "bwa",
          project_name:
            e.bwa_projects?.project_name || e.bwa_projects?.project_code || null,
          handover_date: e.bwa_projects?.handover_date || null,
          status: e.bwa_projects?.status || null,
          total_installment: installment,
          total_paid: paid,
          paid_percentage:
            installment > 0 ? Math.round((paid / installment) * 100) : 0,
        });
      }
    });

    const linkedBwfProjectIds = await fetchBWFProjectIdsByFactory(factoryId);
    const linkedBwfProjects =
      linkedBwfProjectIds.length > 0
        ? (
            await supabase
              .from("bwf_projects")
              .select("id, project_name, project_code, handover_date, status, estimated_income")
              .in("id", linkedBwfProjectIds)
          ).data
        : [];

    (linkedBwfProjects ?? []).forEach((p: any) => {
      const key = `bwf-${p.id}`;
      if (map.has(key)) return;
      map.set(key, {
        key,
        project_id: p.id,
        source: "bwf",
        project_name: p.project_name || p.project_code || null,
        handover_date: p.handover_date || null,
        status: p.status || null,
        total_installment: Number(p.estimated_income) || 0,
        total_paid: 0,
        paid_percentage: 0,
      });
    });

    const { data: orderProjectRows } = await supabase
      .from("bwf_orders")
      .select("bwf_project_id")
      .eq("factory_id", factoryId)
      .not("bwf_project_id", "is", null);

    const missingBwfIds = [
      ...new Set(
        (orderProjectRows ?? [])
          .map((o: { bwf_project_id: string | null }) => o.bwf_project_id)
          .filter((id): id is string => !!id && !map.has(`bwf-${id}`))
      ),
    ];

    if (missingBwfIds.length > 0) {
      const { data: extraProjects } = await supabase
        .from("bwf_projects")
        .select("id, project_name, project_code, handover_date, status, estimated_income")
        .in("id", missingBwfIds);

      (extraProjects ?? []).forEach((p: any) => {
        const key = `bwf-${p.id}`;
        map.set(key, {
          key,
          project_id: p.id,
          source: "bwf",
          project_name: p.project_name || p.project_code || null,
          handover_date: p.handover_date || null,
          status: p.status || null,
          total_installment: Number(p.estimated_income) || 0,
          total_paid: 0,
          paid_percentage: 0,
        });
      });
    }

    const items = Array.from(map.values());
    items.sort((a, b) => {
      if (!a.handover_date && !b.handover_date) return 0;
      if (!a.handover_date) return 1;
      if (!b.handover_date) return -1;
      return new Date(b.handover_date).getTime() - new Date(a.handover_date).getTime();
    });

    setProjects(items);
  }

  async function loadOrders() {
    const { data: rows } = await supabase
      .from("bwf_orders")
      .select(
        "id, bwf_project_id, product_id, quantity, site_arrival_date_est, complete_installation_date_est, o_order_status, created_date"
      )
      .eq("factory_id", factoryId)
      .order("created_date", { ascending: false })
      .limit(100);

    const orderRows = rows ?? [];
    const productIds = [...new Set(orderRows.map((r: any) => r.product_id).filter(Boolean))];
    const projectIds = [...new Set(orderRows.map((r: any) => r.bwf_project_id).filter(Boolean))];

    const [prodRes, projRes] = await Promise.all([
      productIds.length
        ? supabase.from("bwf_products").select("id, display").in("id", productIds)
        : Promise.resolve({ data: [] as any[] }),
      projectIds.length
        ? supabase
            .from("bwf_projects")
            .select("id, project_code, project_name")
            .in("id", projectIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const prodMap = new Map((prodRes.data ?? []).map((p: any) => [p.id, p.display]));
    const projMap = new Map((projRes.data ?? []).map((p: any) => [p.id, p]));

    setOrders(
      orderRows.map((r: any) => {
        const proj = r.bwf_project_id ? projMap.get(r.bwf_project_id) : null;
        return {
          id: r.id,
          project_id: r.bwf_project_id || null,
          project_code: proj?.project_code || null,
          project_name: proj?.project_name || null,
          product_name: r.product_id ? prodMap.get(r.product_id) || null : null,
          quantity: r.quantity,
          est_delivery_date: r.site_arrival_date_est,
          est_installation_date: r.complete_installation_date_est,
          status: r.o_order_status,
        };
      })
    );
  }

  async function loadComments() {
    const { data } = await supabase
      .from("staff_supplier_comments")
      .select(
        "id, comment, point, created_date, evaluator_id, project_id, bwf_project_id, staff:staff!fk_ssc_evaluator_id(id, name), bwa_projects:bwa_projects!fk_ssc_project_id(id, project_name, project_code), bwf_projects:bwf_projects!fk_ssc_bwf_project_id(id, project_name, project_code)"
      )
      .eq("factory_id", factoryId)
      .order("created_date", { ascending: false })
      .limit(50);

    setComments(
      (data || []).map((c: any) => ({
        id: c.id,
        comment: c.comment,
        point: c.point,
        created_date: c.created_date,
        evaluator: c.staff?.name || null,
        project:
          c.bwa_projects?.project_name ||
          c.bwa_projects?.project_code ||
          c.bwf_projects?.project_name ||
          c.bwf_projects?.project_code ||
          null,
      }))
    );
  }

  async function loadFiles() {
    const { data } = await supabase
      .from("factory_files")
      .select("id, file_name, file, created_date")
      .eq("factory_id", factoryId)
      .order("created_date", { ascending: false })
      .limit(50);

    setFiles(data || []);
  }

  function openCreateFileDialog() {
    setEditingFile(null);
    setSelectedFile(null);
    setFileName("");
    setFileDialogOpen(true);
  }

  function openEditFileDialog(file: FileItem) {
    setEditingFile(file);
    setSelectedFile(null);
    setFileName(file.file_name || "");
    setFileDialogOpen(true);
  }

  function openDeleteFileConfirm(file: FileItem) {
    setDeletingFile(file);
    setFileDeleteConfirmOpen(true);
  }

  async function handleFileSave() {
    if (!fileName.trim()) {
      alert("請填寫檔案名稱");
      return;
    }
    if (!editingFile && !selectedFile) {
      alert("請選擇檔案");
      return;
    }

    setFileSaving(true);
    try {
      let fileUrl = editingFile?.file || null;

      if (selectedFile) {
        setFileUploading(true);
        const filePath = buildStorageObjectKey(`factories/${factoryId}`, selectedFile.name);
        const { error: uploadError } = await supabase.storage
          .from("project-docs")
          .upload(filePath, selectedFile);

        if (uploadError) {
          alert("上傳失敗: " + uploadError.message);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("project-docs")
          .getPublicUrl(filePath);
        fileUrl = publicUrlData.publicUrl;
      }

      const record: Record<string, unknown> = {
        file_name: fileName.trim(),
        modified_date: new Date().toISOString(),
      };
      if (fileUrl) record.file = fileUrl;

      if (editingFile) {
        const { error } = await supabase
          .from("factory_files")
          .update(record)
          .eq("id", editingFile.id);
        if (error) alert("更新失敗: " + error.message);
      } else {
        const { error } = await supabase.from("factory_files").insert({
          ...record,
          factory_id: factoryId,
          created_date: new Date().toISOString(),
          created_by_id: profile?.id || null,
        });
        if (error) alert("新增失敗: " + error.message);
      }

      setFileDialogOpen(false);
      await loadFiles();
      await loadCounts();
    } finally {
      setFileSaving(false);
      setFileUploading(false);
    }
  }

  async function handleFileDelete() {
    if (!deletingFile) return;
    const { error } = await supabase
      .from("factory_files")
      .delete()
      .eq("id", deletingFile.id);

    if (error) alert("刪除失敗: " + error.message);

    setFileDeleteConfirmOpen(false);
    setDeletingFile(null);
    await loadFiles();
    await loadCounts();
  }

  function openProject(item: ProjectItem) {
    const url =
      item.source === "bwf"
        ? `/bwf/projects/${item.project_id}`
        : `/projects/bwa/${item.project_id}`;
    window.open(url, "_blank");
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-gray-100 px-5 pt-4">
          <TabsList className="bg-gray-50/80 h-9">
            <TabsTrigger value="projects" className="text-xs gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" />
              相關項目
              {counts.projects > 0 && (
                <Badge variant="secondary" className="text-[12px] px-1.5 py-0 h-4 ml-1">
                  {counts.projects}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-xs gap-1.5">
              <Package className="w-3.5 h-3.5" />
              訂單 Order
              {counts.orders > 0 && (
                <Badge variant="secondary" className="text-[12px] px-1.5 py-0 h-4 ml-1">
                  {counts.orders}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-xs gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              評價 Comment
              {counts.comments > 0 && (
                <Badge variant="secondary" className="text-[12px] px-1.5 py-0 h-4 ml-1">
                  {counts.comments}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="files" className="text-xs gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              檔案 Files
              {counts.files > 0 && (
                <Badge variant="secondary" className="text-[12px] px-1.5 py-0 h-4 ml-1">
                  {counts.files}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="p-5 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
              <span className="text-sm text-gray-400">載入中...</span>
            </div>
          ) : (
            <>
              <TabsContent value="projects" className="mt-0">
                {projects.length === 0 ? (
                  <EmptyState icon={FolderOpen} text="暫無相關項目" />
                ) : (
                  <div className="space-y-2">
                    <div className="hidden sm:grid grid-cols-[1fr_80px_100px_100px_100px_100px_120px] gap-2 px-3 py-2 text-[13px] font-medium text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <span>項目名稱</span>
                      <span>類型</span>
                      <span>交場日期</span>
                      <span>狀態</span>
                      <span className="text-right">期數金額</span>
                      <span className="text-right">已付金額</span>
                      <span className="text-right">付款進度</span>
                    </div>
                    {projects.map((p) => (
                      <div
                        key={p.key}
                        className="grid grid-cols-1 sm:grid-cols-[1fr_80px_100px_100px_100px_100px_120px] gap-2 items-center p-3 rounded-lg border border-gray-100 hover:bg-gray-50 hover:shadow-sm transition-all cursor-pointer"
                        onClick={() => openProject(p)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderOpen className="w-4 h-4 text-bw-amber shrink-0" />
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {p.project_name || "未命名項目"}
                          </p>
                        </div>
                        <div>
                          <Badge variant="outline" className="text-[11px]">
                            {p.source === "bwf" ? "BWF" : "BWA"}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                          {p.handover_date ? formatDate(p.handover_date) : "—"}
                        </div>
                        <div>
                          <ProjectStatusBadge status={p.status} className="text-[12px]" />
                        </div>
                        <div className="text-xs font-mono text-gray-700 text-right">
                          {p.total_installment > 0
                            ? formatMoney(p.total_installment)
                            : "—"}
                        </div>
                        <div className="text-xs font-mono text-gray-700 text-right">
                          {p.total_paid > 0
                            ? formatMoney(p.total_paid)
                            : "—"}
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          {p.source === "bwa" ? (
                            <>
                              <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    p.paid_percentage >= 100
                                      ? "bg-emerald-500"
                                      : p.paid_percentage >= 50
                                      ? "bg-amber-500"
                                      : p.paid_percentage > 0
                                      ? "bg-orange-400"
                                      : "bg-gray-200"
                                  }`}
                                  style={{ width: `${Math.min(p.paid_percentage, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium min-w-[36px] text-right text-gray-600">
                                {p.paid_percentage}%
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="orders" className="mt-0">
                {orders.length === 0 ? (
                  <EmptyState icon={Package} text="暫無訂單" />
                ) : (
                  <div className="space-y-2">
                    <div className="hidden sm:grid grid-cols-[100px_1fr_1fr_80px_100px_100px_100px] gap-2 px-3 py-2 text-[13px] font-medium text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <span>項目編號</span>
                      <span>項目名稱</span>
                      <span>產品</span>
                      <span className="text-right">數量</span>
                      <span>預計送貨</span>
                      <span>預計安裝</span>
                      <span>狀態</span>
                    </div>
                    {orders.map((o) => (
                      <div
                        key={o.id}
                        className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr_80px_100px_100px_100px] gap-2 items-center p-3 rounded-lg border border-gray-100 hover:bg-gray-50 hover:shadow-sm transition-all"
                      >
                        <div className="text-xs font-mono text-gray-600">
                          {o.project_code || "—"}
                        </div>
                        <div className="min-w-0">
                          {o.project_id ? (
                            <a
                              href={`/bwf/projects/${o.project_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-bw-blue hover:underline truncate block"
                            >
                              {o.project_name || "未命名項目"}
                            </a>
                          ) : (
                            <p className="text-sm text-gray-800 truncate">
                              {o.project_name || "—"}
                            </p>
                          )}
                        </div>
                        <div className="text-sm text-gray-700 truncate">
                          {o.product_name || "—"}
                        </div>
                        <div className="text-sm font-mono text-gray-700 text-right">
                          {o.quantity ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {o.est_delivery_date ? formatDate(o.est_delivery_date) : "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {o.est_installation_date
                            ? formatDate(o.est_installation_date)
                            : "—"}
                        </div>
                        <div>
                          <OrderStatusBadge status={o.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="comments" className="mt-0">
                {comments.length === 0 ? (
                  <EmptyState icon={MessageCircle} text="暫無評價" />
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg border border-gray-100 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {c.evaluator || "未知"}
                            </span>
                            {c.point != null && (
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3 h-3 ${
                                      i < (c.point || 0)
                                        ? "text-amber-400 fill-amber-400"
                                        : "text-gray-200"
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-[13px] text-gray-400">
                            {formatDate(c.created_date)}
                          </span>
                        </div>
                        {c.comment && (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {c.comment}
                          </p>
                        )}
                        {c.project && (
                          <p className="text-[13px] text-gray-400">項目: {c.project}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="files" className="mt-0">
                {canEditFactory && (
                  <div className="flex justify-end mb-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5 border-amber-200 text-amber-600 hover:bg-amber-50"
                      onClick={openCreateFileDialog}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增檔案
                    </Button>
                  </div>
                )}

                {files.length === 0 ? (
                  <EmptyState icon={FileText} text="暫無檔案" />
                ) : (
                  <div className="space-y-2">
                    {files.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors group"
                      >
                        <FileThumbnail url={f.file} fileName={f.file_name} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {f.file_name || "未命名檔案"}
                          </p>
                          {f.created_date && (
                            <p className="text-[13px] text-gray-400 mt-0.5">
                              {formatDate(f.created_date)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEditFactory && (
                            <>
                              <button
                                onClick={() => openEditFileDialog(f)}
                                className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                title="編輯"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openDeleteFileConfirm(f)}
                                className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                title="刪除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {f.file && (
                            <a
                              href={f.file}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                              title="開啟檔案"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingFile ? "編輯檔案" : "新增檔案"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div>
                        <Label>檔案名稱</Label>
                        <Input
                          value={fileName}
                          onChange={(e) => setFileName(e.target.value)}
                          placeholder="輸入檔案名稱"
                        />
                      </div>
                      <div>
                        <Label>檔案</Label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) =>
                            setSelectedFile(e.target.files?.[0] || null)
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-1"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {selectedFile ? selectedFile.name : "選擇檔案"}
                        </Button>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFileDialogOpen(false)}
                        disabled={fileSaving}
                      >
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleFileSave}
                        disabled={fileSaving}
                      >
                        {fileUploading ? "上傳中..." : editingFile ? "更新" : "上傳"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <AlertDialog
                  open={fileDeleteConfirmOpen}
                  onOpenChange={setFileDeleteConfirmOpen}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>確認刪除檔案?</AlertDialogTitle>
                      <AlertDialogDescription>
                        即將刪除「{deletingFile?.file_name || "未命名檔案"}」，此操作無法復原。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleFileDelete}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        確認刪除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
