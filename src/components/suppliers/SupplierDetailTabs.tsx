"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Loader2,
  FolderOpen,
  MessageCircle,
  FileText,
  DollarSign,
  Clock,
  Star,
  ExternalLink,
  User,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
  Image as ImageIcon,
  File as FileIcon,
  Search,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createClient } from "@/lib/supabase/client";
import { buildStorageObjectKey } from "@/lib/storage-utils";
import { formatDate, isDatePast, parseDate } from "@/lib/date-utils";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { AsanaIcon } from "@/components/ui/asana-icon";

// ─── TYPES ──────────────────────────────────────────────────

interface ProjectItem {
  project_id: string;
  project_name: string | null;
  start_date: string | null;
  handover_date: string | null;
  status: string | null;
  total_installment: number;
  total_paid: number;
  paid_percentage: number;
  work_percentage: number | null;
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
  type_name: string | null;
  type_id: string | null;
  code_number: string | null;
  expiry_date: string | null;
  institution: string | null;
  remarks: string | null;
  created_date: string | null;
}

interface SupplierFileType {
  id: string;
  type: string | null;
  bubble_id: string | null;
}

// Bubble IDs for dynamic file type behavior
const FILE_TYPE_BUBBLE_IDS = {
  BR: "1676954043864x461747642231550700",
  LABOUR_INSURANCE: "1676954038823x495971789208532500",
  REGISTRATION: "1720775616458x483137085118966460",
  ANNUAL_PO: "1749196857821x798736262308900500",
} as const;

// ─── File Thumbnail Helper ─────────────────────────────────
function isImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|avif)(\?|$)/i.test(lower) ||
    lower.includes("image/") ||
    lower.includes("/render/file/");
}

function isSupplierFileExpiringSoon(
  dateStr: string | null | undefined,
  days = 30
): boolean {
  if (!dateStr || isDatePast(dateStr)) return false;
  const expiry = parseDate(dateStr);
  if (!expiry) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  limit.setHours(23, 59, 59, 999);
  return expiry <= limit;
}

function isPdfUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.endsWith(".pdf") || lower.includes(".pdf?") || lower.includes("application/pdf");
}

// PDF first-page thumbnail renderer
function PdfThumbnail({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function renderPdf() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({ url, disableAutoFetch: true, disableStream: true });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Render at a scale that fits 48x48 display (render at 2x for retina)
        const desiredWidth = 96;
        const viewport = page.getViewport({ scale: 1 });
        const scale = desiredWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        if (!cancelled) setLoaded(true);
      } catch (e) {
        if (!cancelled) setError(true);
      }
    }
    renderPdf();
    return () => { cancelled = true; };
  }, [url]);

  if (error) {
    return (
      <div className="w-12 h-12 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
        <FileIcon className="w-5 h-5 text-red-400" />
      </div>
    );
  }

  return (
    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0 border border-gray-200 relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
        style={{ display: loaded ? "block" : "none" }}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

function FileThumbnail({ url, fileName }: { url: string | null | undefined; fileName?: string | null }) {
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

  if (isPdfUrl(url)) {
    return <PdfThumbnail url={url} />;
  }

  // Generic file - try to render as image (some URLs don't have extensions)
  if (!imgError) {
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

// Dynamic configuration per file type
function getFileTypeConfig(bubbleId: string | null | undefined) {
  switch (bubbleId) {
    case FILE_TYPE_BUBBLE_IDS.BR:
      return {
        defaultFileName: "商業登記證明",
        fileNamePlaceholder: "File Display",
        expiryRequired: true,
        expiryLabel: "到期日",
        institutionLabel: "Institution (發證機構)",
        institutionDefault: "稅務局",
        institutionPlaceholder: "Type here...",
        codeLabel: "Certificate Code (用於檢查資料真確性)",
        codePlaceholder: "Code for BR",
      };
    case FILE_TYPE_BUBBLE_IDS.LABOUR_INSURANCE:
      return {
        defaultFileName: "勞工保險",
        fileNamePlaceholder: "File Display",
        expiryRequired: true,
        expiryLabel: "到期日",
        institutionLabel: "Insurance Company (保險公司)",
        institutionDefault: "",
        institutionPlaceholder: "Insurance Company Name",
        codeLabel: "Policy No.",
        codePlaceholder: "Policy No.",
      };
    case FILE_TYPE_BUBBLE_IDS.REGISTRATION:
      return {
        defaultFileName: "",
        fileNamePlaceholder: "e.g. 小型工程承建商",
        expiryRequired: false,
        expiryLabel: "到期日",
        institutionLabel: "Institution (發證機構)",
        institutionDefault: "",
        institutionPlaceholder: "Type here...",
        codeLabel: "Certificate Code (用於檢查資料真確性)",
        codePlaceholder: "Code for Registration",
      };
    case FILE_TYPE_BUBBLE_IDS.ANNUAL_PO:
      return {
        defaultFileName: "全年採購單",
        fileNamePlaceholder: "File Display",
        expiryRequired: true,
        expiryLabel: "到期日",
        institutionLabel: "Institution (發證機構)",
        institutionDefault: "Acme",
        institutionPlaceholder: "Type here...",
        codeLabel: "Certificate Code (用於檢查資料真確性)",
        codePlaceholder: "Code for Annual PO",
      };
    default:
      return {
        defaultFileName: "",
        fileNamePlaceholder: "File Display",
        expiryRequired: false,
        expiryLabel: "到期日",
        institutionLabel: "Institution (發證機構)",
        institutionDefault: "",
        institutionPlaceholder: "Type here...",
        codeLabel: "Certificate Code (用於檢查資料真確性)",
        codePlaceholder: "輸入編號",
      };
  }
}

interface FileFormData {
  file_name: string;
  type_id: string;
  code_number: string;
  expiry_date: string;
  institution: string;
  remarks: string;
}

interface PricingItem {
  id: string;
  eng_name: string | null;
  chn_name: string | null;
  item_unit_price: number | null;
  unit: string | null;
  unit_ref: { eng_name: string | null; chi_name: string | null }[] | { eng_name: string | null; chi_name: string | null } | null;
  item_id: string | null;
  item_ref: { id: string; chinese_name: string | null; english_name: string | null; unit_price: number | null }[] | { id: string; chinese_name: string | null; english_name: string | null; unit_price: number | null } | null;
  unit_id: string | null;
  editor_id: string | null;
  created_date: string | null;
}

interface NosItem {
  id: string;
  chinese_name: string | null;
  english_name: string | null;
  unit_price: number | null;
  cost: number | null;
  section_id: string | null;
  unit_id: string | null;
  status: string | null;
}

interface NosSection {
  id: string;
  chinese_name: string | null;
  english_name: string | null;
}

interface NosQuoteProjectType {
  id: string;
  name: string | null;
}

interface NosUnit {
  id: string;
  chi_name: string | null;
  eng_name: string | null;
}

interface PricingFormData {
  item_id: string;
  item_unit_price: string;
  unit_id: string;
}

interface RecentStatusItem {
  id: string;
  text: string | null;
  created_date: string | null;
  created_by: string | null;
  creator_user: any;
}

// Helper: extract single object from Supabase FK join result (may be array or single)
function fkSingle<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  if (Array.isArray(val)) return val[0] || null;
  return val;
}

// ─── MAIN COMPONENT ─────────────────────────────────────────

export default function SupplierDetailTabs({
  supplierId,
  asanaLink,
}: {
  supplierId: string;
  asanaLink?: string | null;
}) {
  const { profile, staff } = useAuth();
  const { formatMoney } = useFinancialFormat();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("bwa-projects");
  const [loading, setLoading] = useState(false);

  // Data states
  const [bwaProjects, setBwaProjects] = useState<ProjectItem[]>([]);
  const [bwfProjects, setBwfProjects] = useState<ProjectItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [pricings, setPricings] = useState<PricingItem[]>([]);
  const [statuses, setStatuses] = useState<RecentStatusItem[]>([]);

  // File CRUD states
  const [fileTypes, setFileTypes] = useState<SupplierFileType[]>([]);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [fileDeleteConfirmOpen, setFileDeleteConfirmOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [deletingFile, setDeletingFile] = useState<FileItem | null>(null);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileForm, setFileForm] = useState<FileFormData>({
    file_name: "",
    type_id: "",
    code_number: "",
    expiry_date: "",
    institution: "",
    remarks: "",
  });

  // Pricing CRUD states
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [pricingDeleteConfirmOpen, setPricingDeleteConfirmOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<PricingItem | null>(null);
  const [deletingPricing, setDeletingPricing] = useState<PricingItem | null>(null);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingForm, setPricingForm] = useState<PricingFormData>({
    item_id: "",
    item_unit_price: "",
    unit_id: "",
  });

  // Item search states (for pricing)
  const [nosSections, setNosSections] = useState<NosSection[]>([]);
  const [nosQuoteProjectTypes, setNosQuoteProjectTypes] = useState<NosQuoteProjectType[]>([]);
  const [nosUnits, setNosUnits] = useState<NosUnit[]>([]);
  const [nosItemResults, setNosItemResults] = useState<NosItem[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [itemSearchSectionFilter, setItemSearchSectionFilter] = useState("");
  const [itemSearchProjectTypeFilter, setItemSearchProjectTypeFilter] = useState("");
  const [itemSearchLoading, setItemSearchLoading] = useState(false);
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [selectedItemDisplay, setSelectedItemDisplay] = useState("");
  const itemSearchRef = useRef<HTMLDivElement>(null);

  // Quick-add item popup states
  const [quickAddItemOpen, setQuickAddItemOpen] = useState(false);
  const [quickAddItemSaving, setQuickAddItemSaving] = useState(false);
  const [quickAddItemForm, setQuickAddItemForm] = useState({
    chinese_name: "",
    english_name: "",
    unit_price: "",
    cost: "",
    section_id: "",
    unit_id: "",
    remark: "",
    quote_project_type_ids: [] as string[],
  });

  // Status CRUD states
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDeleteConfirmOpen, setStatusDeleteConfirmOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<RecentStatusItem | null>(null);
  const [deletingStatus, setDeletingStatus] = useState<RecentStatusItem | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusForm, setStatusForm] = useState({ text: "" });

  // Counts for badges
  const [counts, setCounts] = useState({
    bwaProjects: 0,
    bwfProjects: 0,
    comments: 0,
    files: 0,
    pricings: 0,
    statuses: 0,
  });

  // Load counts on mount
  useEffect(() => {
    loadCounts();
    loadFileTypes();
    loadPricingLookups();
  }, [supplierId]);

  // Load active tab data when tab changes
  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, supplierId]);

  // Close item dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (itemSearchRef.current && !itemSearchRef.current.contains(e.target as Node)) {
        setItemDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadCounts() {
    const [expRes, comRes, fileRes, priceRes, statusRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("project_id, bwf_project_id")
        .eq("supplier_id", supplierId),
      supabase
        .from("staff_supplier_comments")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierId),
      supabase
        .from("supplier_files")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierId),
      supabase
        .from("supplier_pricings")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierId),
      supabase
        .from("supplier_recent_statuses")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierId),
    ]);

    const uniqueBwa = new Set(
      (expRes.data || []).map((e: any) => e.project_id).filter(Boolean)
    );
    const uniqueBwf = new Set(
      (expRes.data || []).map((e: any) => e.bwf_project_id).filter(Boolean)
    );

    setCounts({
      bwaProjects: uniqueBwa.size,
      bwfProjects: uniqueBwf.size,
      comments: comRes.count || 0,
      files: fileRes.count || 0,
      pricings: priceRes.count || 0,
      statuses: statusRes.count || 0,
    });
  }

  async function loadTabData(tab: string) {
    setLoading(true);
    try {
      switch (tab) {
        case "bwa-projects":
        case "projects": // legacy tab value
          await loadBwaProjects();
          break;
        case "bwf-projects":
          await loadBwfProjects();
          break;
        case "comments":
          await loadComments();
          break;
        case "files":
          await loadFiles();
          break;
        case "pricings":
          await loadPricings();
          break;
        case "statuses":
          await loadStatuses();
          break;
      }
    } finally {
      setLoading(false);
    }
  }

  function aggregateExpenseProjects(
    data: any[],
    projectIdKey: "project_id" | "bwf_project_id",
    joinKey: "bwa_projects" | "bwf_projects"
  ): ProjectItem[] {
    const map = new Map<string, {
      project_name: string | null;
      start_date: string | null;
      handover_date: string | null;
      status: string | null;
      total_installment: number;
      total_paid: number;
    }>();

    data.forEach((e: any) => {
      const pid = e[projectIdKey];
      if (!pid) return;
      const existing = map.get(pid);
      const installment = Number(e.installment_amount) || 0;
      const paid = Number(e.paid_amount) || 0;
      const joined = e[joinKey];

      if (existing) {
        existing.total_installment += installment;
        existing.total_paid += paid;
      } else {
        map.set(pid, {
          project_name: joined?.project_name || joined?.project_code || null,
          start_date: joined?.start_date || null,
          handover_date: joined?.handover_date || null,
          status: joined?.status || null,
          total_installment: installment,
          total_paid: paid,
        });
      }
    });

    const items: ProjectItem[] = Array.from(map.entries()).map(
      ([pid, info]) => ({
        project_id: pid,
        project_name: info.project_name,
        start_date: info.start_date,
        handover_date: info.handover_date,
        status: info.status,
        total_installment: info.total_installment,
        total_paid: info.total_paid,
        paid_percentage: info.total_installment > 0
          ? Math.round((info.total_paid / info.total_installment) * 100)
          : 0,
        work_percentage: computeWorkPercentage(info.start_date, info.handover_date),
      })
    );

    items.sort((a, b) => {
      if (!a.handover_date && !b.handover_date) return 0;
      if (!a.handover_date) return 1;
      if (!b.handover_date) return -1;
      return new Date(b.handover_date).getTime() - new Date(a.handover_date).getTime();
    });

    return items;
  }

  async function loadBwaProjects() {
    const { data } = await supabase
      .from("expenses")
      .select("project_id, installment_amount, paid_amount, bwa_projects:bwa_projects!fk_expenses_project_id(id, project_name, project_code, start_date, handover_date, status)")
      .eq("supplier_id", supplierId)
      .not("project_id", "is", null);

    if (data) {
      setBwaProjects(aggregateExpenseProjects(data, "project_id", "bwa_projects"));
    }
  }

  async function loadBwfProjects() {
    const { data } = await supabase
      .from("expenses")
      .select("bwf_project_id, installment_amount, paid_amount, bwf_projects:bwf_projects!fk_expenses_bwf_project_id(id, project_name, project_code, start_date, handover_date, status)")
      .eq("supplier_id", supplierId)
      .not("bwf_project_id", "is", null);

    if (data) {
      setBwfProjects(aggregateExpenseProjects(data, "bwf_project_id", "bwf_projects"));
    }
  }

  async function loadComments() {
    const { data } = await supabase
      .from("staff_supplier_comments")
      .select("id, comment, point, created_date, evaluator_id, project_id, staff:staff!fk_ssc_evaluator_id(id, name), bwa_projects:bwa_projects!fk_ssc_project_id(id, project_name, project_code)")
      .eq("supplier_id", supplierId)
      .order("created_date", { ascending: false })
      .limit(50);

    // Map joined data to display-friendly format
    const mapped = (data || []).map((c: any) => ({
      id: c.id,
      comment: c.comment,
      point: c.point,
      created_date: c.created_date,
      evaluator: c.staff?.name || null,
      project: c.bwa_projects?.project_name || c.bwa_projects?.project_code || null,
    }));

    setComments(mapped);
  }

  async function loadFiles() {
    const { data } = await supabase
      .from("supplier_files")
      .select(
        "id, file_name, file, type_name, type_id, code_number, expiry_date, institution, remarks, created_date"
      )
      .eq("supplier_id", supplierId)
      .order("created_date", { ascending: false })
      .limit(50);

    setFiles(data || []);
  }

  async function loadFileTypes() {
    const { data } = await supabase
      .from("supplier_file_types")
      .select("id, type, bubble_id")
      .order("type", { ascending: true });
    setFileTypes(data || []);
  }

  // ─── File CRUD Functions ─────────────────────────────────────

  function openCreateFileDialog() {
    setEditingFile(null);
    setSelectedFile(null);
    setFileForm({
      file_name: "",
      type_id: "",
      code_number: "",
      expiry_date: "",
      institution: "",
      remarks: "",
    });
    setFileDialogOpen(true);
  }

  function openEditFileDialog(file: FileItem) {
    setEditingFile(file);
    setSelectedFile(null);
    const matchingType = file.type_id
      ? fileTypes.find((t) => t.id === file.type_id)
      : fileTypes.find((t) => t.type === file.type_name);
    setFileForm({
      file_name: file.file_name || "",
      type_id: file.type_id || matchingType?.id || "",
      code_number: file.code_number || "",
      expiry_date: file.expiry_date ? file.expiry_date.split("T")[0] : "",
      institution: file.institution || "",
      remarks: file.remarks || "",
    });
    setFileDialogOpen(true);
  }

  function openDeleteFileConfirm(file: FileItem) {
    setDeletingFile(file);
    setFileDeleteConfirmOpen(true);
  }

  async function handleFileSave() {
    // Validate required fields based on file type
    const selectedType = fileTypes.find((t) => t.id === fileForm.type_id);
    const config = getFileTypeConfig(selectedType?.bubble_id);

    if (!fileForm.file_name.trim()) {
      alert("請填寫檔案名稱");
      return;
    }
    if (!fileForm.type_id) {
      alert("請選擇檔案類型");
      return;
    }
    if (config.expiryRequired && !fileForm.expiry_date) {
      alert("此類型必須填寫到期日");
      return;
    }
    if (!editingFile && !selectedFile) {
      alert("請選擇檔案");
      return;
    }

    setFileSaving(true);
    try {
      let fileUrl = editingFile?.file || null;

      // Upload file if a new one is selected
      if (selectedFile) {
        setFileUploading(true);
        const filePath = buildStorageObjectKey(supplierId, selectedFile.name);

        const { error: uploadError } = await supabase.storage
          .from("supplier-files")
          .upload(filePath, selectedFile);

        if (uploadError) {
          alert("上傳失敗: " + uploadError.message);
          setFileSaving(false);
          setFileUploading(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("supplier-files")
          .getPublicUrl(filePath);

        fileUrl = publicUrlData.publicUrl;
        setFileUploading(false);
      }

      // Get the type_name from fileTypes (reuse selectedType from validation)
      const matchedType = fileTypes.find((t) => t.id === fileForm.type_id);

      const record: Record<string, any> = {
        file_name: fileForm.file_name || null,
        type_name: matchedType?.type || null,
        type_id: fileForm.type_id || null,
        code_number: fileForm.code_number || null,
        expiry_date: fileForm.expiry_date || null,
        institution: fileForm.institution || null,
        remarks: fileForm.remarks || null,
        modified_date: new Date().toISOString(),
      };

      if (fileUrl) {
        record.file = fileUrl;
      }

      if (editingFile) {
        const { error } = await supabase
          .from("supplier_files")
          .update(record)
          .eq("id", editingFile.id);

        if (error) {
          alert("更新失敗: " + error.message);
          return;
        }
      } else {
        record.supplier_id = supplierId;
        record.created_date = new Date().toISOString();
        if (profile?.id) {
          record.created_by_id = profile.id;
        }

        const { error } = await supabase
          .from("supplier_files")
          .insert(record);

        if (error) {
          alert("新增失敗: " + error.message);
          return;
        }
      }

      setFileDialogOpen(false);
      await loadFiles();
      await loadCounts();
    } catch (err) {
      console.error("Save file error:", err);
    } finally {
      setFileSaving(false);
      setFileUploading(false);
    }
  }

  async function handleFileDelete() {
    if (!deletingFile) return;

    try {
      // If the file URL is from our storage bucket, try to remove it
      if (deletingFile.file && deletingFile.file.includes("supplier-files")) {
        const urlParts = deletingFile.file.split("supplier-files/");
        if (urlParts.length > 1) {
          const storagePath = decodeURIComponent(urlParts[1]);
          await supabase.storage.from("supplier-files").remove([storagePath]);
        }
      }

      const { error } = await supabase
        .from("supplier_files")
        .delete()
        .eq("id", deletingFile.id);

      if (error) {
        alert("刪除失敗: " + error.message);
        return;
      }

      setFileDeleteConfirmOpen(false);
      setDeletingFile(null);
      await loadFiles();
      await loadCounts();
    } catch (err) {
      console.error("Delete file error:", err);
    }
  }

  async function loadPricings() {
    const { data } = await supabase
      .from("supplier_pricings")
      .select("id, eng_name, chn_name, item_unit_price, unit, created_date, item_id, unit_id, editor_id, unit_ref:nos_units!fk_supplier_pricings_unit_id(eng_name, chi_name), item_ref:nos_items!fk_supplier_pricings_item_id(id, chinese_name, english_name, unit_price)")
      .eq("supplier_id", supplierId)
      .order("created_date", { ascending: false })
      .limit(50);

    setPricings(data || []);
  }

  // ─── Pricing Lookup Loaders ──────────────────────────────────

  async function loadPricingLookups() {
    const [sectionsRes, projectTypesRes, unitsRes] = await Promise.all([
      supabase.from("nos_sections").select("id, chinese_name, english_name").order("order", { ascending: true }),
      supabase.from("nos_quote_project_types").select("id, name").order("order", { ascending: true }),
      supabase.from("nos_units").select("id, chi_name, eng_name").order("order", { ascending: true }),
    ]);
    setNosSections(sectionsRes.data || []);
    setNosQuoteProjectTypes(projectTypesRes.data || []);
    setNosUnits(unitsRes.data || []);
  }

  async function searchNosItems(query: string, sectionId: string, projectTypeId: string) {
    setItemSearchLoading(true);
    try {
      let itemQuery = supabase
        .from("nos_items")
        .select("id, chinese_name, english_name, unit_price, cost, section_id, unit_id, status")
        .limit(30);

      // Text search filter
      if (query.trim()) {
        itemQuery = itemQuery.or(`chinese_name.ilike.%${query.trim()}%,english_name.ilike.%${query.trim()}%`);
      }

      // Section filter
      if (sectionId) {
        itemQuery = itemQuery.eq("section_id", sectionId);
      }

      // Project type filter (via junction table - need sub-query approach)
      if (projectTypeId) {
        // First get nos_item IDs for this project type from junction table
        const { data: junctionData } = await supabase
          .from("nos_item_quote_project_types")
          .select("nos_item_id")
          .eq("quote_project_type_id", projectTypeId);

        if (junctionData && junctionData.length > 0) {
          const itemIds = junctionData.map((j: any) => j.nos_item_id);
          itemQuery = itemQuery.in("id", itemIds);
        } else {
          // No items for this project type
          setNosItemResults([]);
          setItemSearchLoading(false);
          return;
        }
      }

      itemQuery = itemQuery.order("english_name", { ascending: true });

      const { data } = await itemQuery;
      setNosItemResults(data || []);
    } finally {
      setItemSearchLoading(false);
    }
  }

  // Debounced item search
  const itemSearchTimerRef = useRef<NodeJS.Timeout | null>(null);

  function handleItemSearchChange(value: string) {
    setItemSearchQuery(value);
    setItemDropdownOpen(true);

    if (itemSearchTimerRef.current) clearTimeout(itemSearchTimerRef.current);
    itemSearchTimerRef.current = setTimeout(() => {
      searchNosItems(value, itemSearchSectionFilter, itemSearchProjectTypeFilter);
    }, 300);
  }

  function handleItemFilterChange(type: "section" | "projectType", value: string) {
    if (type === "section") {
      setItemSearchSectionFilter(value);
      searchNosItems(itemSearchQuery, value, itemSearchProjectTypeFilter);
    } else {
      setItemSearchProjectTypeFilter(value);
      searchNosItems(itemSearchQuery, itemSearchSectionFilter, value);
    }
    setItemDropdownOpen(true);
  }

  function selectItem(item: NosItem) {
    setPricingForm((prev) => ({
      ...prev,
      item_id: item.id,
      unit_id: item.unit_id || prev.unit_id,
      // Only auto-fill unit price from nos_items during creation, not edit
      item_unit_price: !editingPricing && item.unit_price != null ? String(item.unit_price) : prev.item_unit_price,
    }));
    setSelectedItemDisplay(item.english_name || item.chinese_name || "");
    setItemDropdownOpen(false);
    setItemSearchQuery("");
  }

  // ─── Pricing CRUD Functions ─────────────────────────────────

  function openCreatePricingDialog() {
    setEditingPricing(null);
    setPricingForm({ item_id: "", item_unit_price: "", unit_id: "" });
    setSelectedItemDisplay("");
    setItemSearchQuery("");
    setItemSearchSectionFilter("");
    setItemSearchProjectTypeFilter("");
    setNosItemResults([]);
    setItemDropdownOpen(false);
    setPricingDialogOpen(true);
  }

  function openEditPricingDialog(pricing: PricingItem) {
    setEditingPricing(pricing);
    setPricingForm({
      item_id: pricing.item_id || "",
      item_unit_price: pricing.item_unit_price != null ? String(pricing.item_unit_price) : "",
      unit_id: pricing.unit_id || "",
    });
    setSelectedItemDisplay(
      fkSingle(pricing.item_ref)?.english_name || fkSingle(pricing.item_ref)?.chinese_name || pricing.eng_name || pricing.chn_name || ""
    );
    setItemSearchQuery("");
    setItemSearchSectionFilter("");
    setItemSearchProjectTypeFilter("");
    setNosItemResults([]);
    setItemDropdownOpen(false);
    setPricingDialogOpen(true);
  }

  function openDeletePricingConfirm(pricing: PricingItem) {
    setDeletingPricing(pricing);
    setPricingDeleteConfirmOpen(true);
  }

  async function handlePricingSave() {
    if (!pricingForm.item_id) {
      alert("請選擇項目 Item");
      return;
    }
    if (!pricingForm.item_unit_price) {
      alert("請填寫單價");
      return;
    }
    if (!pricingForm.unit_id) {
      alert("請選擇單位");
      return;
    }

    setPricingSaving(true);
    try {
      const record: Record<string, any> = {
        item_id: pricingForm.item_id,
        item_unit_price: parseFloat(pricingForm.item_unit_price) || 0,
        unit_id: pricingForm.unit_id,
        editor_id: staff?.id || null,
        modified_date: new Date().toISOString(),
      };

      if (editingPricing) {
        // UPDATE
        const { error } = await supabase
          .from("supplier_pricings")
          .update(record)
          .eq("id", editingPricing.id);

        if (error) {
          console.error("Update pricing error:", error);
          alert("更新失敗: " + error.message);
        }
      } else {
        // CREATE
        record.supplier_id = supplierId;
        record.created_date = new Date().toISOString();
        if (profile?.id) {
          record.created_by_id = profile.id;
        }

        const { error } = await supabase
          .from("supplier_pricings")
          .insert(record);

        if (error) {
          console.error("Insert pricing error:", error);
          alert("新增失敗: " + error.message);
        }
      }

      setPricingDialogOpen(false);
      await loadPricings();
      await loadCounts();
    } catch (err) {
      console.error("Save pricing error:", err);
    } finally {
      setPricingSaving(false);
    }
  }

  async function handlePricingDelete() {
    if (!deletingPricing) return;
    try {
      const { error } = await supabase
        .from("supplier_pricings")
        .delete()
        .eq("id", deletingPricing.id);

      if (error) {
        console.error("Delete pricing error:", error);
      }

      setPricingDeleteConfirmOpen(false);
      setDeletingPricing(null);
      await loadPricings();
      await loadCounts();
    } catch (err) {
      console.error("Delete pricing error:", err);
    }
  }

  // ─── Quick-Add NOS Item ────────────────────────────────────

  function openQuickAddItem() {
    setQuickAddItemForm({
      chinese_name: itemSearchQuery || "",
      english_name: "",
      unit_price: "",
      cost: "",
      section_id: itemSearchSectionFilter || "",
      unit_id: "",
      remark: "",
      quote_project_type_ids: itemSearchProjectTypeFilter ? [itemSearchProjectTypeFilter] : [],
    });
    setQuickAddItemOpen(true);
  }

  async function handleQuickAddItemSave() {
    if (!quickAddItemForm.chinese_name.trim() && !quickAddItemForm.english_name.trim()) {
      alert("請至少填寫中文名稱或英文名稱");
      return;
    }

    setQuickAddItemSaving(true);
    try {
      const record: Record<string, any> = {
        chinese_name: quickAddItemForm.chinese_name || null,
        english_name: quickAddItemForm.english_name || null,
        unit_price: quickAddItemForm.unit_price ? parseFloat(quickAddItemForm.unit_price) : null,
        cost: quickAddItemForm.cost ? parseFloat(quickAddItemForm.cost) : null,
        section_id: quickAddItemForm.section_id || null,
        unit_id: quickAddItemForm.unit_id || null,
        remark: quickAddItemForm.remark || null,
        status: "active",
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      };

      if (profile?.id) {
        record.created_by_id = profile.id;
      }

      const { data, error } = await supabase
        .from("nos_items")
        .insert(record)
        .select("id, chinese_name, english_name, unit_price, cost, section_id, unit_id, status")
        .single();

      if (error) {
        console.error("Quick add item error:", error);
        alert("新增項目失敗: " + error.message);
        return;
      }

      // Insert junction table records for quote_project_type_ids
      if (data && quickAddItemForm.quote_project_type_ids.length > 0) {
        const junctionRecords = quickAddItemForm.quote_project_type_ids.map((qptId) => ({
          nos_item_id: data.id,
          quote_project_type_id: qptId,
        }));
        const { error: junctionError } = await supabase
          .from("nos_item_quote_project_types")
          .insert(junctionRecords);
        if (junctionError) {
          console.error("Junction insert error:", junctionError);
        }
      }

      // Auto-select the newly created item
      if (data) {
        selectItem(data);
      }

      setQuickAddItemOpen(false);
    } catch (err) {
      console.error("Quick add item error:", err);
    } finally {
      setQuickAddItemSaving(false);
    }
  }

  async function loadStatuses() {
    const { data } = await supabase
      .from("supplier_recent_statuses")
      .select("id, text, created_date, created_by, creator_user:users!fk_supplier_recent_statuses_created_by_id(staff_ref:staff!fk_users_member_id(name))")
      .eq("supplier_id", supplierId)
      .order("created_date", { ascending: false })
      .limit(50);

    setStatuses(data || []);
  }

  // ─── Status CRUD Functions ──────────────────────────────────

  function openCreateStatusDialog() {
    setEditingStatus(null);
    setStatusForm({ text: "" });
    setStatusDialogOpen(true);
  }

  function openEditStatusDialog(status: RecentStatusItem) {
    setEditingStatus(status);
    setStatusForm({ text: status.text || "" });
    setStatusDialogOpen(true);
  }

  function openDeleteStatusConfirm(status: RecentStatusItem) {
    setDeletingStatus(status);
    setStatusDeleteConfirmOpen(true);
  }

  async function handleStatusSave() {
    if (!statusForm.text.trim()) {
      alert("請填寫狀態內容");
      return;
    }

    setStatusSaving(true);
    try {
      const record: Record<string, any> = {
        text: statusForm.text.trim(),
        modified_date: new Date().toISOString(),
      };

      if (editingStatus) {
        // UPDATE
        const { error } = await supabase
          .from("supplier_recent_statuses")
          .update(record)
          .eq("id", editingStatus.id);

        if (error) {
          console.error("Update status error:", error);
          alert("更新失敗: " + error.message);
        }
      } else {
        // CREATE
        record.supplier_id = supplierId;
        record.created_date = new Date().toISOString();
        if (profile?.id) {
          record.created_by_id = profile.id;
        }

        const { error } = await supabase
          .from("supplier_recent_statuses")
          .insert(record);

        if (error) {
          console.error("Insert status error:", error);
          alert("新增失敗: " + error.message);
        }
      }

      setStatusDialogOpen(false);
      await loadStatuses();
      await loadCounts();
    } catch (err) {
      console.error("Save status error:", err);
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleStatusDelete() {
    if (!deletingStatus) return;
    try {
      const { error } = await supabase
        .from("supplier_recent_statuses")
        .delete()
        .eq("id", deletingStatus.id);

      if (error) {
        console.error("Delete status error:", error);
      }

      setStatusDeleteConfirmOpen(false);
      setDeletingStatus(null);
      await loadStatuses();
      await loadCounts();
    } catch (err) {
      console.error("Delete status error:", err);
    }
  }

  // ─── RENDER ─────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-gray-100 px-5 pt-4">
          <TabsList className="bg-gray-50/80 h-9">
            <TabsTrigger value="bwa-projects" className="text-xs gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" />
              BWA 項目
              {counts.bwaProjects > 0 && (
                <Badge variant="secondary" className="text-[12px] px-1.5 py-0 h-4 ml-1">
                  {counts.bwaProjects}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bwf-projects" className="text-xs gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" />
              BWF 項目
              {counts.bwfProjects > 0 && (
                <Badge variant="secondary" className="text-[12px] px-1.5 py-0 h-4 ml-1">
                  {counts.bwfProjects}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-xs gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              項目評價
              {counts.comments > 0 && (
                <Badge variant="secondary" className="text-[12px] px-1.5 py-0 h-4 ml-1">
                  {counts.comments}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="files" className="text-xs gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              檔案
              {counts.files > 0 && (
                <Badge variant="secondary" className="text-[12px] px-1.5 py-0 h-4 ml-1">
                  {counts.files}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pricings" className="text-xs gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              價目表
              {counts.pricings > 0 && (
                <Badge variant="secondary" className="text-[12px] px-1.5 py-0 h-4 ml-1">
                  {counts.pricings}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="statuses" className="text-xs gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              最近狀態
              {counts.statuses > 0 && (
                <Badge variant="secondary" className="text-[12px] px-1.5 py-0 h-4 ml-1">
                  {counts.statuses}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="asana" className="text-xs gap-1.5">
              <AsanaIcon size={14} />
              Asana
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
              {/* ─── BWA Projects Tab ─── */}
              <TabsContent value="bwa-projects" className="mt-0">
                <SupplierProjectList
                  projects={bwaProjects}
                  emptyText="暫無相關 BWA 項目"
                  iconColor="text-bw-blue"
                  hrefForProject={(id) => `/projects/bwa/${id}`}
                  formatMoney={formatMoney}
                />
              </TabsContent>

              {/* ─── BWF Projects Tab ─── */}
              <TabsContent value="bwf-projects" className="mt-0">
                <SupplierProjectList
                  projects={bwfProjects}
                  emptyText="暫無相關 BWF 項目"
                  iconColor="text-bw-amber"
                  hrefForProject={(id) => `/bwf/projects/${id}`}
                  formatMoney={formatMoney}
                />
              </TabsContent>

              {/* ─── Asana Tab ─── */}
              <TabsContent value="asana" className="mt-0">
                <p className="text-sm text-slate-500">Asana sync is not available in this demo.</p>
              </TabsContent>

              {/* ─── Comments Tab ─── */}
              <TabsContent value="comments" className="mt-0">
                {comments.length === 0 ? (
                  <EmptyState icon={MessageCircle} text="暫無項目評價" />
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
                          <p className="text-[13px] text-gray-400">
                            項目: {c.project}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ─── Files Tab ─── */}
              <TabsContent value="files" className="mt-0">
                {/* Add file button */}
                <div className="flex justify-end mb-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5 border-violet-200 text-violet-600 hover:bg-violet-50"
                    onClick={openCreateFileDialog}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新增檔案
                  </Button>
                </div>

                {files.length === 0 ? (
                  <EmptyState icon={FileText} text="暫無檔案" />
                ) : (
                  <div className="space-y-2">
                    {files.map((f) => {
                      const expired = isDatePast(f.expiry_date);
                      const expiringSoon = isSupplierFileExpiringSoon(f.expiry_date);

                      return (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors group"
                      >
                        <FileThumbnail url={f.file} fileName={f.file_name} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {f.file_name || f.code_number || "未命名檔案"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {f.type_name && (
                              <Badge
                                variant="outline"
                                className="text-[12px] border-blue-200 text-blue-600 bg-blue-50/50"
                              >
                                {f.type_name}
                              </Badge>
                            )}
                            {expired && (
                              <Badge className="bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/10 text-[12px] px-1.5 py-0">
                                已過期
                              </Badge>
                            )}
                            {expiringSoon && (
                              <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/10 text-[12px] px-1.5 py-0">
                                即將到期
                              </Badge>
                            )}
                            {f.institution && (
                              <span className="text-[13px] text-gray-400">
                                {f.institution}
                              </span>
                            )}
                            {f.expiry_date && (
                              <span
                                className={
                                  expired
                                    ? "text-[13px] text-red-500 font-medium"
                                    : expiringSoon
                                      ? "text-[13px] text-amber-500"
                                      : "text-[13px] text-gray-400"
                                }
                              >
                                到期: {formatDate(f.expiry_date)}
                              </span>
                            )}
                            {f.code_number && (
                              <span className="text-[13px] text-gray-400">
                                編號: {f.code_number}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditFileDialog(f);
                            }}
                            className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                            title="編輯"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteFileConfirm(f);
                            }}
                            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {f.file && (
                            <a
                              href={f.file}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md hover:bg-violet-50 text-gray-400 hover:text-violet-600 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                              title="開啟檔案"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}

                {/* ─── File Create/Edit Dialog ─── */}
                <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
                  <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                      <DialogTitle className="text-base">
                        {editingFile ? "Edit File" : "Add File"}
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
                      {/* 1. File Type - drives dynamic behavior */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">
                          File Type 檔案類型<span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={fileForm.type_id}
                          onValueChange={(v) => {
                            const selectedType = fileTypes.find((t) => t.id === v);
                            const config = getFileTypeConfig(selectedType?.bubble_id);
                            setFileForm((prev) => {
                              const prevConfig = getFileTypeConfig(fileTypes.find((t) => t.id === prev.type_id)?.bubble_id);
                              return {
                                ...prev,
                                type_id: v,
                                // Auto-fill file_name if user hasn't manually changed it
                                file_name: prev.file_name === "" || prev.file_name === prevConfig.defaultFileName
                                  ? config.defaultFileName
                                  : prev.file_name,
                                // Auto-fill institution default
                                institution: prev.institution === "" || prev.institution === prevConfig.institutionDefault
                                  ? config.institutionDefault
                                  : prev.institution,
                              };
                            });
                          }}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="選擇類型" />
                          </SelectTrigger>
                          <SelectContent>
                            {fileTypes.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.type || "未命名類型"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 2. File Display Name - dynamic placeholder/default based on type */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">
                          File Display 檔案名稱<span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={fileForm.file_name}
                          onChange={(e) =>
                            setFileForm((prev) => ({
                              ...prev,
                              file_name: e.target.value,
                            }))
                          }
                          placeholder={
                            getFileTypeConfig(
                              fileTypes.find((t) => t.id === fileForm.type_id)?.bubble_id
                            ).fileNamePlaceholder
                          }
                          className="text-sm"
                          required
                        />
                      </div>

                      {/* 3. File Upload */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">
                          File 上傳檔案<span className="text-red-500">*</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setSelectedFile(file);
                              if (file && !fileForm.file_name) {
                                setFileForm((prev) => ({
                                  ...prev,
                                  file_name: file.name,
                                }));
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1.5"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            選擇檔案
                          </Button>
                          {selectedFile && (
                            <span className="text-xs text-gray-600 truncate max-w-[200px]">
                              {selectedFile.name}
                            </span>
                          )}
                          {!selectedFile && editingFile?.file && (
                            <span className="text-xs text-gray-400 truncate max-w-[200px]">
                              已有檔案
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 4-6. Dynamic fields based on selected file type */}
                      {(() => {
                        const currentType = fileTypes.find((t) => t.id === fileForm.type_id);
                        const config = getFileTypeConfig(currentType?.bubble_id);
                        return (
                          <>
                            {/* 4. Expiry Date - conditionally required */}
                            <div>
                              <Label className="text-xs text-gray-500 mb-1.5 block">
                                Expiry Date {config.expiryLabel}
                                {config.expiryRequired && <span className="text-red-500">*</span>}
                              </Label>
                              <Input
                                type="date"
                                value={fileForm.expiry_date}
                                onChange={(e) =>
                                  setFileForm((prev) => ({
                                    ...prev,
                                    expiry_date: e.target.value,
                                  }))
                                }
                                className="text-sm"
                                required={config.expiryRequired}
                              />
                              {config.expiryRequired && !fileForm.expiry_date && (
                                <p className="text-xs text-amber-600 mt-1">此類型必須填寫到期日</p>
                              )}
                            </div>

                            {/* 5. Institution - dynamic label/placeholder/default */}
                            <div>
                              <Label className="text-xs text-gray-500 mb-1.5 block">
                                {config.institutionLabel}
                              </Label>
                              <Input
                                value={fileForm.institution}
                                onChange={(e) =>
                                  setFileForm((prev) => ({
                                    ...prev,
                                    institution: e.target.value,
                                  }))
                                }
                                placeholder={config.institutionPlaceholder}
                                className="text-sm"
                              />
                            </div>

                            {/* 6. Code Number - dynamic label */}
                            <div>
                              <Label className="text-xs text-gray-500 mb-1.5 block">
                                {config.codeLabel}
                              </Label>
                              <Input
                                value={fileForm.code_number}
                                onChange={(e) =>
                                  setFileForm((prev) => ({
                                    ...prev,
                                    code_number: e.target.value,
                                  }))
                                }
                                placeholder={config.codePlaceholder}
                                className="text-sm"
                              />
                            </div>
                          </>
                        );
                      })()}

                      {/* 7. Remarks */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">
                          Remarks 備註
                        </Label>
                        <Textarea
                          value={fileForm.remarks}
                          onChange={(e) =>
                            setFileForm((prev) => ({
                              ...prev,
                              remarks: e.target.value,
                            }))
                          }
                          placeholder="備註..."
                          className="text-sm min-h-[60px]"
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFileDialogOpen(false)}
                        disabled={fileSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleFileSave}
                        disabled={fileSaving || (!selectedFile && !editingFile)}
                        className="gap-1.5"
                      >
                        {fileSaving && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        {fileUploading
                          ? "上傳中..."
                          : editingFile
                          ? "Update"
                          : "Upload"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* ─── File Delete Confirm Dialog ─── */}
                <AlertDialog
                  open={fileDeleteConfirmOpen}
                  onOpenChange={setFileDeleteConfirmOpen}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>確認刪除檔案?</AlertDialogTitle>
                      <AlertDialogDescription>
                        即將刪除「
                        {deletingFile?.file_name ||
                          deletingFile?.code_number ||
                          "未命名檔案"}
                        」，此操作無法復原。
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

              {/* ─── Pricings Tab ─── */}
              <TabsContent value="pricings" className="mt-0">
                {/* Add pricing button */}
                <div className="flex justify-end mb-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                    onClick={openCreatePricingDialog}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新增價目
                  </Button>
                </div>

                {pricings.length === 0 ? (
                  <EmptyState icon={DollarSign} text="暫無價目表資料" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                            項目名稱
                          </th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">
                            單價
                          </th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">
                            單位
                          </th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">
                            日期
                          </th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 w-20">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricings.map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-gray-50 hover:bg-gray-50/50 group"
                          >
                            <td className="py-2.5 px-3">
                              <p className="text-gray-800 font-medium">
                                {fkSingle(p.item_ref)?.chinese_name || fkSingle(p.item_ref)?.english_name || p.chn_name || p.eng_name || "-"}
                              </p>
                              {fkSingle(p.item_ref)?.english_name && (
                                <p className="text-[13px] text-gray-400">
                                  {fkSingle(p.item_ref)?.english_name}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-gray-800">
                              {p.item_unit_price != null
                                ? formatMoney(p.item_unit_price)
                                : "-"}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">
                              {fkSingle(p.unit_ref)?.chi_name || fkSingle(p.unit_ref)?.eng_name || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-right text-[13px] text-gray-400">
                              {formatDate(p.created_date)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEditPricingDialog(p)}
                                  className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                  title="編輯"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => openDeletePricingConfirm(p)}
                                  className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                  title="刪除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ─── Pricing Create/Edit Dialog ─── */}
                <Dialog open={pricingDialogOpen} onOpenChange={setPricingDialogOpen}>
                  <DialogContent className="sm:max-w-[750px] max-h-[90vh]">
                    <DialogHeader>
                      <DialogTitle className="text-base">
                        {editingPricing ? "編輯價目" : "新增價目"}
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-2 max-h-[80vh] overflow-y-auto pr-1">
                      {/* 1. Item Search with Section/ProjectType filters */}
                      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Search className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">
                            搜尋及篩選項目 Item
                          </span>
                          <span className="text-red-500 text-xs">*</span>
                        </div>

                        {/* Filters row */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <Label className="text-[13px] text-gray-400 mb-1 block">Section 分類</Label>
                            <Select
                              value={itemSearchSectionFilter}
                              onValueChange={(v) => handleItemFilterChange("section", v === "__all__" ? "" : v)}
                            >
                              <SelectTrigger className="text-xs h-9 bg-white">
                                <SelectValue placeholder="全部 Section" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">全部 Section</SelectItem>
                                {nosSections.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.english_name || s.chinese_name || "—"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[13px] text-gray-400 mb-1 block">Project Type 工程類型</Label>
                            <Select
                              value={itemSearchProjectTypeFilter}
                              onValueChange={(v) => handleItemFilterChange("projectType", v === "__all__" ? "" : v)}
                            >
                              <SelectTrigger className="text-xs h-9 bg-white">
                                <SelectValue placeholder="全部 Project Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">全部 Project Type</SelectItem>
                                {nosQuoteProjectTypes.map((pt) => (
                                  <SelectItem key={pt.id} value={pt.id}>
                                    {pt.name || "—"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Search input with dropdown */}
                        <div className={`relative ${itemDropdownOpen ? "min-h-[320px]" : ""}`} ref={itemSearchRef}>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <Input
                              value={itemSearchQuery || selectedItemDisplay}
                              onChange={(e) => {
                                setSelectedItemDisplay("");
                                handleItemSearchChange(e.target.value);
                              }}
                              onFocus={() => {
                                if (!itemSearchQuery && !selectedItemDisplay) {
                                  searchNosItems("", itemSearchSectionFilter, itemSearchProjectTypeFilter);
                                }
                                setItemDropdownOpen(true);
                              }}
                              placeholder="搜尋項目 (中文/英文名稱)..."
                              className="text-sm pl-8 pr-8 bg-white"
                            />
                            {(selectedItemDisplay || pricingForm.item_id) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPricingForm((prev) => ({ ...prev, item_id: "" }));
                                  setSelectedItemDisplay("");
                                  setItemSearchQuery("");
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Selected item indicator */}
                          {pricingForm.item_id && selectedItemDisplay && (
                            <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-md">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-xs text-emerald-700 font-medium truncate">
                                已選擇: {selectedItemDisplay}
                              </span>
                            </div>
                          )}

                          {/* Dropdown results */}
                          {itemDropdownOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[280px] overflow-y-auto">
                              {itemSearchLoading ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                  <span className="text-xs text-gray-400 ml-2">搜尋中...</span>
                                </div>
                              ) : nosItemResults.length === 0 ? (
                                <div className="py-3 px-3 text-center">
                                  <p className="text-xs text-gray-400 mb-2">找不到相關項目</p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                                    onClick={openQuickAddItem}
                                  >
                                    <Plus className="w-3 h-3" />
                                    快速新增項目
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  {/* Quick add at the top of results */}
                                  <button
                                    type="button"
                                    onClick={openQuickAddItem}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 flex items-center gap-1.5 text-blue-600"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">快速新增項目</span>
                                  </button>
                                  {nosItemResults.map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => selectItem(item)}
                                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors ${
                                        pricingForm.item_id === item.id ? "bg-emerald-50" : ""
                                      }`}
                                    >
                                      <p className="text-sm text-gray-800 font-medium truncate">
                                        {item.english_name || item.chinese_name || "—"}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {item.chinese_name && item.english_name && (
                                          <span className="text-[13px] text-gray-400">{item.chinese_name}</span>
                                        )}
                                        {item.unit_price != null && (
                                          <span className="text-[13px] text-emerald-600 font-mono">
                                            ${item.unit_price}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  ))}

                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. Unit Price & Unit side-by-side */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-gray-500 mb-1.5 block">
                            單價 Unit Price<span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={pricingForm.item_unit_price}
                            onChange={(e) =>
                              setPricingForm((prev) => ({
                                ...prev,
                                item_unit_price: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                            className="text-sm font-mono"
                          />
                        </div>

                        <div>
                          <Label className="text-xs text-gray-500 mb-1.5 block">
                            單位 Unit<span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={pricingForm.unit_id}
                            onValueChange={(v) =>
                              setPricingForm((prev) => ({ ...prev, unit_id: v }))
                            }
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="選擇單位" />
                            </SelectTrigger>
                            <SelectContent>
                              {nosUnits.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.eng_name || u.chi_name || "—"}
                                  {u.chi_name && u.eng_name && ` (${u.chi_name})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPricingDialogOpen(false)}
                        disabled={pricingSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handlePricingSave}
                        disabled={pricingSaving}
                        className="gap-1.5"
                      >
                        {pricingSaving && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        {editingPricing ? "更新" : "新增"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* ─── Quick Add Item Dialog ─── */}
                <Dialog open={quickAddItemOpen} onOpenChange={setQuickAddItemOpen}>
                  <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                      <DialogTitle className="text-base">
                        快速新增 NOS 項目
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
                      {/* Chinese Name */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">
                          中文名稱<span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={quickAddItemForm.chinese_name}
                          onChange={(e) =>
                            setQuickAddItemForm((prev) => ({
                              ...prev,
                              chinese_name: e.target.value,
                            }))
                          }
                          placeholder="輸入中文名稱"
                          className="text-sm"
                        />
                      </div>

                      {/* English Name */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">
                          英文名稱
                        </Label>
                        <Input
                          value={quickAddItemForm.english_name}
                          onChange={(e) =>
                            setQuickAddItemForm((prev) => ({
                              ...prev,
                              english_name: e.target.value,
                            }))
                          }
                          placeholder="Enter English name"
                          className="text-sm"
                        />
                      </div>

                      {/* Section */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">
                          Section 分區
                        </Label>
                        <Select
                          value={quickAddItemForm.section_id}
                          onValueChange={(v) =>
                            setQuickAddItemForm((prev) => ({ ...prev, section_id: v }))
                          }
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="選擇分區" />
                          </SelectTrigger>
                          <SelectContent>
                            {nosSections.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.english_name || s.chinese_name || "—"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quote Project Types (多選) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <Label className="text-xs text-gray-500">
                            報價工程類型 Quote Project Type
                          </Label>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              className="text-[13px] text-blue-600 hover:text-blue-800 hover:underline"
                              onClick={() =>
                                setQuickAddItemForm((prev) => ({
                                  ...prev,
                                  quote_project_type_ids: nosQuoteProjectTypes.map((pt) => pt.id),
                                }))
                              }
                            >
                              全選
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              className="text-[13px] text-gray-500 hover:text-gray-700 hover:underline"
                              onClick={() =>
                                setQuickAddItemForm((prev) => ({
                                  ...prev,
                                  quote_project_type_ids: [],
                                }))
                              }
                            >
                              清除
                            </button>
                          </div>
                        </div>
                        <div className="border rounded-md p-2 max-h-[140px] overflow-y-auto space-y-1.5">
                          {nosQuoteProjectTypes.length === 0 ? (
                            <p className="text-xs text-gray-400 py-1">載入中...</p>
                          ) : (
                            nosQuoteProjectTypes.map((pt) => (
                              <label
                                key={pt.id}
                                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1.5 py-1"
                              >
                                <Checkbox
                                  checked={quickAddItemForm.quote_project_type_ids.includes(pt.id)}
                                  onCheckedChange={(checked) => {
                                    setQuickAddItemForm((prev) => ({
                                      ...prev,
                                      quote_project_type_ids: checked
                                        ? [...prev.quote_project_type_ids, pt.id]
                                        : prev.quote_project_type_ids.filter((id) => id !== pt.id),
                                    }));
                                  }}
                                  className="h-3.5 w-3.5"
                                />
                                <span className="text-sm text-gray-700">{pt.name || "—"}</span>
                              </label>
                            ))
                          )}
                        </div>
                        {quickAddItemForm.quote_project_type_ids.length > 0 && (
                          <p className="text-[13px] text-gray-400 mt-1">
                            已選 {quickAddItemForm.quote_project_type_ids.length} 項
                          </p>
                        )}
                      </div>

                      {/* Unit */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">
                          單位 Unit
                        </Label>
                        <Select
                          value={quickAddItemForm.unit_id}
                          onValueChange={(v) =>
                            setQuickAddItemForm((prev) => ({ ...prev, unit_id: v }))
                          }
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="選擇單位" />
                          </SelectTrigger>
                          <SelectContent>
                            {nosUnits.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.eng_name || u.chi_name || "—"}
                                {u.chi_name && u.eng_name && ` (${u.chi_name})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Unit Price */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">
                          單價 Unit Price
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={quickAddItemForm.unit_price}
                          onChange={(e) =>
                            setQuickAddItemForm((prev) => ({
                              ...prev,
                              unit_price: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                          className="text-sm font-mono"
                        />
                      </div>

                      {/* Cost */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">
                          成本 Cost
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={quickAddItemForm.cost}
                          onChange={(e) =>
                            setQuickAddItemForm((prev) => ({
                              ...prev,
                              cost: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                          className="text-sm font-mono"
                        />
                      </div>

                      {/* Remark */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">
                          備註 Remark
                        </Label>
                        <Textarea
                          value={quickAddItemForm.remark}
                          onChange={(e) =>
                            setQuickAddItemForm((prev) => ({
                              ...prev,
                              remark: e.target.value,
                            }))
                          }
                          placeholder="備註..."
                          className="text-sm min-h-[60px]"
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuickAddItemOpen(false)}
                        disabled={quickAddItemSaving}
                      >
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleQuickAddItemSave}
                        disabled={quickAddItemSaving}
                        className="gap-1.5"
                      >
                        {quickAddItemSaving && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        新增並選擇
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* ─── Pricing Delete Confirm Dialog ─── */}
                <AlertDialog
                  open={pricingDeleteConfirmOpen}
                  onOpenChange={setPricingDeleteConfirmOpen}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>確認刪除價目?</AlertDialogTitle>
                      <AlertDialogDescription>
                        即將刪除「
                        {fkSingle(deletingPricing?.item_ref)?.english_name ||
                          fkSingle(deletingPricing?.item_ref)?.chinese_name ||
                          deletingPricing?.eng_name ||
                          "未命名項目"}
                        」的價目記錄，此操作無法復原。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handlePricingDelete}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        確認刪除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TabsContent>

              {/* ─── Recent Statuses Tab ─── */}
              <TabsContent value="statuses" className="mt-0">
                {/* Add status button */}
                <div className="flex justify-end mb-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50"
                    onClick={openCreateStatusDialog}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新增狀態
                  </Button>
                </div>

                {statuses.length === 0 ? (
                  <EmptyState icon={Clock} text="暫無最近狀態紀錄" />
                ) : (
                  <div className="space-y-3">
                    {statuses.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-lg border border-gray-100 space-y-1 group hover:border-gray-200 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] text-gray-400">
                            {fkSingle(fkSingle(s.creator_user)?.staff_ref)?.name || "系統"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] text-gray-400">
                              {formatDate(s.created_date)}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditStatusDialog(s)}
                                className="p-1 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                title="編輯"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => openDeleteStatusConfirm(s)}
                                className="p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                title="刪除"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {s.text || "（無內容）"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ─── Status Create/Edit Dialog ─── */}
                <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle className="text-base">
                        {editingStatus ? "編輯狀態" : "新增狀態"}
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">
                          狀態內容 <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          value={statusForm.text}
                          onChange={(e) =>
                            setStatusForm({ text: e.target.value })
                          }
                          placeholder="輸入最近狀態..."
                          rows={4}
                          className="text-sm resize-none"
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusDialogOpen(false)}
                        className="text-xs"
                      >
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleStatusSave}
                        disabled={statusSaving || !statusForm.text.trim()}
                        className="text-xs gap-1.5"
                      >
                        {statusSaving && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        {editingStatus ? "更新" : "新增"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* ─── Status Delete Confirm ─── */}
                <AlertDialog
                  open={statusDeleteConfirmOpen}
                  onOpenChange={setStatusDeleteConfirmOpen}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-base">
                        確認刪除
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-sm">
                        確定要刪除此狀態紀錄嗎？此操作無法復原。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="text-xs">
                        取消
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleStatusDelete}
                        className="text-xs bg-red-600 hover:bg-red-700"
                      >
                        刪除
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

// ─── WORK PROGRESS (start → handover vs today) ───────────────

/** Local midnight for day-level date comparison. */
function toLocalDay(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = parseDate(v);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Time elapsed from start_date to handover_date as of today (0–100), or null if dates missing. */
function computeWorkPercentage(
  startDate: string | null | undefined,
  handoverDate: string | null | undefined
): number | null {
  const start = toLocalDay(startDate);
  const handover = toLocalDay(handoverDate);
  if (!start || !handover) return null;

  const today = toLocalDay(new Date().toISOString())!;
  const span = handover.getTime() - start.getTime();
  if (span <= 0) {
    return today.getTime() >= handover.getTime() ? 100 : 0;
  }

  const pct = ((today.getTime() - start.getTime()) / span) * 100;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

function progressBarColor(pct: number): string {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 75) return "bg-blue-500";
  if (pct >= 50) return "bg-amber-500";
  if (pct > 0) return "bg-orange-400";
  return "bg-gray-200";
}

function progressTextColor(pct: number): string {
  if (pct >= 100) return "text-emerald-600";
  if (pct >= 75) return "text-blue-600";
  return "text-gray-600";
}

function MiniProgressBar({ percentage }: { percentage: number | null }) {
  if (percentage == null) {
    return <span className="text-xs text-gray-300">—</span>;
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progressBarColor(percentage)}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-medium min-w-[36px] text-right ${progressTextColor(percentage)}`}>
        {percentage}%
      </span>
    </div>
  );
}


function SupplierProjectList({
  projects,
  emptyText,
  iconColor,
  hrefForProject,
  formatMoney,
}: {
  projects: ProjectItem[];
  emptyText: string;
  iconColor: string;
  hrefForProject: (projectId: string) => string;
  formatMoney: (value: number | null | undefined) => string;
}) {
  if (projects.length === 0) {
    return <EmptyState icon={FolderOpen} text={emptyText} />;
  }

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[1fr_100px_100px_90px_90px_110px_110px] gap-2 px-3 py-2 text-[13px] font-medium text-gray-400 uppercase tracking-wide border-b border-gray-100">
        <span>項目名稱</span>
        <span>交場日期</span>
        <span>狀態</span>
        <span className="text-right">期數金額</span>
        <span className="text-right">已付金額</span>
        <span className="text-right">付款進度</span>
        <span className="text-right">工程進度</span>
      </div>
      {projects.map((p) => (
        <div
          key={p.project_id}
          className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px_90px_90px_110px_110px] gap-2 items-center p-3 rounded-lg border border-gray-100 hover:bg-gray-50 hover:shadow-sm transition-all cursor-pointer"
          onClick={() => window.open(hrefForProject(p.project_id), "_blank")}
        >
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className={`w-4 h-4 ${iconColor} shrink-0`} />
            <p className="text-sm font-medium text-gray-800 truncate">
              {p.project_name || "未命名項目"}
            </p>
          </div>
          <div className="text-xs text-gray-500">
            {p.handover_date ? formatDate(p.handover_date) : "—"}
          </div>
          <div>
            <ProjectStatusBadge status={p.status} className="text-[12px]" />
          </div>
          <div className="text-xs font-mono text-gray-700 text-right">
            {p.total_installment > 0 ? formatMoney(p.total_installment) : "—"}
          </div>
          <div className="text-xs font-mono text-gray-700 text-right">
            {p.total_paid > 0 ? formatMoney(p.total_paid) : "—"}
          </div>
          <MiniProgressBar percentage={p.paid_percentage} />
          <MiniProgressBar percentage={p.work_percentage} />
        </div>
      ))}
    </div>
  );
}

// ─── EMPTY STATE HELPER ─────────────────────────────────────

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
