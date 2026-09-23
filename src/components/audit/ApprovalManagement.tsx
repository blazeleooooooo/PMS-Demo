"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  DollarSign,
  Receipt,
  CreditCard,
  ArrowUpDown,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  FileText,
  X,
  MessageSquare,
  FileIcon,
  Check,
  Download,
  ExternalLink,
  Send,
  Upload,
  Trash2,
  ArrowRight} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusDot } from "@/components/ui/entity-status-badges";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AsanaLinkButton } from "@/components/ui/asana-link-button";
import { createClient } from "@/lib/supabase/client";
import { buildStorageObjectKeyWithSanitizedName } from "@/lib/storage-utils";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle} from "@/components/ui/alert-dialog";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { useAuth } from "@/hooks/use-auth";
import { isAdminOrAboveRole } from "@/lib/staff-data-scope";
import { setIncomePaymentStatus, setExpensePaymentStatus } from "@/lib/data/finance";
import { fetchAllRows } from "@/lib/data/_core";
import {
  resolveRange,
  rangeBounds,
  fmtRangeDate,
} from "@/lib/report-date-range";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";
import ReportFilterStack from "@/components/reports/ReportFilterStack";
import {
  applyProjectFilters,
  type ProjectFilterFields,
  type ProjectFilterState,
} from "@/components/reports/ProjectFilterBar";
import {
  staffIdMatchesFilter,
  type StaffFilterState,
} from "@/components/reports/StaffFilterBar";
import { useAlignedReportFilters } from "@/hooks/use-aligned-report-filters";
import type { StaffDirectoryRow } from "@/lib/data/staff";
import {
  resolveJunctionProjectTypesForProjects,
  resolveBwfJunctionServiceTypesForProjects,
} from "@/lib/data/junctions";
import { toHkYmd } from "@/lib/date-utils";
import {
  INCOME_BOUNCED,
  INCOME_NOT_RECEIVED,
  INCOME_PENDING_CHECK,
  INCOME_RECEIVED,
  INCOME_ZOHO_COMPLETED,
  incomePaymentStatusBadgeClass,
  isIncomeDecisionStatus,
} from "@/lib/income-payment-status";
import {
  EXPENSE_APPROVED,
  EXPENSE_PENDING_CHECK,
  EXPENSE_REJECTED,
  EXPENSE_ZOHO_COMPLETED,
  expensePaymentStatusBadgeClass,
} from "@/lib/expense-payment-status";

// ─── Types ───

interface IncomeRow {
  id: string;
  income_amount: number | null;
  payment_amount: number | null;
  outstanding: number | null;
  status: string | null;
  payment_status: string | null;
  invoice_number: string | null;
  type_display: string | null;
  contract_type_label: string | null;
  due_date: string | null;
  expected_payment_date: string | null;
  receive_date: string | null;
  created_date: string | null;
  enquiry_date: string | null;
  signed_date: string | null;
  approved: boolean | null;
  approved_date: string | null;
  approve_creator_name: string | null;
  remark: string | null;
  real_creator_name: string | null;
  required_check: boolean | null;
  pdf_file: string | null;
  project_name: string | null;
  project_code: string | null;
  project_status: string | null;
  project_id: string | null;
  bwf_project_id: string | null;
  pm_name: string | null;
  n_contract_type_id: string | null;
  asana_link: string | null;
}

interface ExpenseRow {
  id: string;
  installment_amount: number | null;
  paid_amount: number | null;
  outstanding: number | null;
  status: string | null;
  payment_status: string | null;
  invoice_number: string | null;
  type_display: string | null;
  contract_type_label: string | null;
  due_date: string | null;
  expected_payment_date: string | null;
  payment_date: string | null;
  created_date: string | null;
  enquiry_date: string | null;
  signed_date: string | null;
  approved: boolean | null;
  approved_date: string | null;
  approve_creator_name: string | null;
  remark_t: string | null;
  real_creator_name: string | null;
  required_check: boolean | null;
  required_po: boolean | null;
  cheque_no: string | null;
  supplier_name: string | null;
  supplier_id: string | null;
  n_contract_type_id: string | null;
  pdf_file: string | null;
  project_name: string | null;
  project_code: string | null;
  project_status: string | null;
  project_id: string | null;
  bwf_project_id: string | null;
  pm_name: string | null;
  asana_link: string | null;
}

type SortField = "amount" | "date" | "created_date" | "due_date" | "expected_payment_date" | "project" | "status" | "creator";
type DateTarget =
  | "due_date"
  | "expected_payment_date"
  | "created_date"
  | "enquiry_date"
  | "signed_date";

const DATE_TARGET_OPTIONS: { value: DateTarget; label: string }[] = [
  { value: "due_date", label: "到期日 Due Date" },
  { value: "expected_payment_date", label: "預計付款日期 Expected Payment" },
  { value: "created_date", label: "款項建立日期 Creation Date" },
  { value: "enquiry_date", label: "查詢日期 Enquiry Date" },
  { value: "signed_date", label: "簽約日期 Signed Date" },
];
type SortDir = "asc" | "desc";
type IncomePaymentFilter =
  | "all"
  | "unapplied"
  | "pending"
  | "received"
  | "zoho_completed"
  | "not_received"
  | "bounced";
type ExpensePaymentFilter =
  | "all"
  | "unapplied"
  | "pending"
  | "approved"
  | "zoho_completed"
  | "rejected";
type BwMode = "BWA" | "BWF";

type AuditProject = ProjectFilterFields & {
  pm_id: string | null;
  enquiry_date: string | null;
  signed_date: string | null;
  asana_link: string | null;
};

const BWA_AUDIT_PROJECT_SELECT = `
  id, bubble_id, project_name, project_code, status, project_size, estimated_income,
  enquiry_date, signed_date, asana_link,
  main_pm_id, n_financial_year_id, n_service_type_id,
  pm:staff!fk_bwa_projects_main_pm_id(id, name),
  fy:financial_years!fk_bwa_projects_n_financial_year_id(id, display),
  cc:cost_centres!fk_bwa_projects_cost_centre_id(id, bu_code),
  st:service_types!fk_bwa_projects_n_service_type_id(id, display)
`;

const BWF_AUDIT_PROJECT_SELECT = `
  id, project_name, project_code, status, estimated_income,
  enquiry_date, signed_date, asana_link,
  main_pm_id, n_financial_year_id, n_customer_type_id,
  pm:staff!fk_bwf_projects_main_pm_id(id, name),
  fy:financial_years!fk_bwf_projects_n_financial_year_id(id, display),
  cc:cost_centres!fk_bwf_projects_cost_center_id(id, bu_code),
  ctype:client_types!fk_bwf_projects_n_customer_type_id(id, display)
`;

// ─── Helpers ───


function fmtDateYmd(d: string | null): string {
  const ymd = toHkYmd(d);
  return ymd ? ymd.replace(/-/g, "/") : "-";
}

function isPastDue(d: string | null): boolean {
  if (!d) return false;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return false;
    return date.getTime() < Date.now();
  } catch {
    return false;
  }
}

function dateInRange(value: string | null, fromMs: number, toMs: number): boolean {
  if (fromMs === -Infinity && toMs === Infinity) return true;
  if (!value) return false;
  const t = new Date(value).getTime();
  return !isNaN(t) && t >= fromMs && t <= toMs;
}

type DateFilterRow = {
  due_date: string | null;
  expected_payment_date: string | null;
  created_date: string | null;
  enquiry_date: string | null;
  signed_date: string | null;
};

function rowDateForTarget(target: DateTarget, row: DateFilterRow): string | null {
  switch (target) {
    case "due_date":
      return row.due_date;
    case "expected_payment_date":
      return row.expected_payment_date;
    case "created_date":
      return row.created_date;
    case "enquiry_date":
      return row.enquiry_date;
    case "signed_date":
      return row.signed_date;
  }
}

function relOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function isProjectFilterIdle(f: ProjectFilterState): boolean {
  return (
    !f.search.trim() &&
    f.status === "all" &&
    f.bu === "all" &&
    f.serviceType === "all" &&
    f.projectType === "all" &&
    f.size === "all" &&
    f.financialYear === "all"
  );
}

function isStaffFilterIdle(f: StaffFilterState): boolean {
  return f.bu === "all" && f.team === "all" && f.position === "all" && f.staffId === "all";
}

function rowProjectId(
  row: { project_id?: string | null; bwf_project_id?: string | null },
  mode: BwMode,
): string | null {
  return mode === "BWF" ? row.bwf_project_id ?? null : row.project_id ?? null;
}

function DueExpectedHeads({
  sortable,
  onSort,
  SortIcon,
}: {
  sortable?: boolean;
  onSort?: (field: SortField) => void;
  SortIcon?: React.ComponentType<{ field: SortField }>;
}) {
  if (sortable && onSort && SortIcon) {
    return (
      <>
        <TableHead className="text-xs whitespace-nowrap">
          <button type="button" className="flex items-center gap-1" onClick={() => onSort("created_date")}>
            建立日期 <SortIcon field="created_date" />
          </button>
        </TableHead>
        <TableHead className="text-xs whitespace-nowrap">
          <button type="button" className="flex items-center gap-1" onClick={() => onSort("due_date")}>
            到期日 <SortIcon field="due_date" />
          </button>
        </TableHead>
        <TableHead className="text-xs whitespace-nowrap">
          <button type="button" className="flex items-center gap-1" onClick={() => onSort("expected_payment_date")}>
            預計付款日期 <SortIcon field="expected_payment_date" />
          </button>
        </TableHead>
      </>
    );
  }
  return (
    <>
      <TableHead className="text-xs whitespace-nowrap">建立日期</TableHead>
      <TableHead className="text-xs whitespace-nowrap">到期日</TableHead>
      <TableHead className="text-xs whitespace-nowrap">預計付款日期</TableHead>
    </>
  );
}

function DueExpectedCells({
  createdDate,
  dueDate,
  expectedPaymentDate,
}: {
  createdDate: string | null;
  dueDate: string | null;
  expectedPaymentDate: string | null;
}) {
  return (
    <>
      <TableCell>
        <span className="text-xs text-gray-700">{fmtDateYmd(createdDate)}</span>
      </TableCell>
      <TableCell>
        <span className={`text-xs ${isPastDue(dueDate) ? "text-red-500 font-medium" : "text-gray-700"}`}>
          {fmtDateYmd(dueDate)}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-xs text-gray-700">{fmtDateYmd(expectedPaymentDate)}</span>
      </TableCell>
    </>
  );
}

function calcOverdueDays(dueDate: string | null, receiveDate: string | null): { days: number; label: string; isOverdue: boolean } {
  if (!dueDate) return { days: 0, label: "-", isOverdue: false };
  const due = new Date(dueDate);
  const now = receiveDate ? new Date(receiveDate) : new Date();
  if (isNaN(due.getTime())) return { days: 0, label: "-", isOverdue: false };
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return { days: 0, label: "準時", isOverdue: false };
  return { days: diff, label: `逾期${diff}天`, isOverdue: true };
}

function calcCollectionRatio(income: number | null, payment: number | null): string {
  if (!income || income === 0) return "-";
  const ratio = ((payment || 0) / income) * 100;
  return `${ratio.toFixed(1)}%`;
}


function getApprovalBadge(approved: boolean | null, approveCreatorName?: string | null, approvedDate?: string | null) {
  if (approved === true) {
    const dateStr = approvedDate ? new Date(approvedDate).toLocaleDateString("zh-HK", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }) : null;
    return (
      <div className="flex flex-col gap-0.5 max-w-[120px]">
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-xs gap-1 w-fit">
          <CheckCircle2 className="w-3 h-3" />
          已批核
        </Badge>
        {(approveCreatorName || dateStr) && (
          <span className="text-[12px] text-gray-500 leading-tight truncate">
            {approveCreatorName && <span className="font-medium text-emerald-600">{approveCreatorName}</span>}
            {approveCreatorName && dateStr && " · "}
            {dateStr && <span>{dateStr}</span>}
          </span>
        )}
      </div>
    );
  }
  if (approved === false) {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-xs gap-1">
        <XCircle className="w-3 h-3" />
        已拒絕
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-xs gap-1">
      <Clock className="w-3 h-3" />
      待審批
    </Badge>
  );
}

// ─── Payment Status Helpers ───

const INCOME_STATUS_NONE = "__none__";

const INCOME_STATUS_OPTIONS = [
  { value: INCOME_STATUS_NONE, label: "未申請", className: "bg-gray-50 text-gray-600 border-gray-200" },
  { value: INCOME_PENDING_CHECK, label: "Pending Check", className: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: INCOME_RECEIVED, label: "Received", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: INCOME_ZOHO_COMPLETED, label: "Zoho Completed", className: "bg-emerald-800 text-emerald-50 border-emerald-900" },
  { value: INCOME_NOT_RECEIVED, label: "Not Received", className: "bg-red-50 text-red-700 border-red-200" },
  { value: INCOME_BOUNCED, label: "Bounced Payment", className: "bg-rose-50 text-rose-800 border-rose-300" },
] as const;

const EXPENSE_STATUS_NONE = "__none__";

const EXPENSE_STATUS_OPTIONS = [
  { value: EXPENSE_STATUS_NONE, label: "未申請", className: "bg-gray-50 text-gray-600 border-gray-200" },
  { value: EXPENSE_PENDING_CHECK, label: "Pending Check", className: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: EXPENSE_APPROVED, label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: EXPENSE_ZOHO_COMPLETED, label: "Zoho Completed", className: "bg-emerald-800 text-emerald-50 border-emerald-900" },
  { value: EXPENSE_REJECTED, label: "Rejected", className: "bg-red-50 text-red-700 border-red-200" },
] as const;

function ProjectNameCell({
  name,
  code,
  status,
  onClick,
  maxWidthClass = "max-w-[200px]",
}: {
  name: string | null;
  code: string | null;
  status: string | null;
  onClick: () => void;
  maxWidthClass?: string;
}) {
  return (
    <button className="text-left hover:underline" onClick={onClick}>
      <div className="flex items-center gap-1.5">
        <ProjectStatusDot status={status} />
        <span className={`text-sm font-medium text-bw-navy truncate ${maxWidthClass}`}>
          {name || "-"}
        </span>
      </div>
      <div className="text-[12px] text-gray-400 ml-3.5">{code || ""}</div>
    </button>
  );
}

function getPaymentStatusStyle(status: string | null) {
  if (!status) return "bg-gray-50 text-gray-600 border-gray-200";
  if (status === INCOME_ZOHO_COMPLETED || status === EXPENSE_ZOHO_COMPLETED) {
    return incomePaymentStatusBadgeClass(INCOME_ZOHO_COMPLETED);
  }
  if (status === INCOME_RECEIVED || status === INCOME_NOT_RECEIVED || status === INCOME_BOUNCED || status === INCOME_PENDING_CHECK) {
    return incomePaymentStatusBadgeClass(status);
  }
  if (status === EXPENSE_APPROVED || status === EXPENSE_REJECTED || status === EXPENSE_PENDING_CHECK) {
    return expensePaymentStatusBadgeClass(status);
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}

// ─── Component ───

/**
 * Parse pdf_file field which can be:
 * - A single URL (Bubble-style with or without protocol)
 * - Comma-separated list of URLs
 * Returns array of {url, filename} objects
 */
function parsePdfFiles(raw: string | null): { url: string; filename: string }[] {
  if (!raw || !raw.trim()) return [];
  // Split by comma, handling Bubble-style URLs that may start with //
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.map((part) => {
    // Ensure URL has protocol
    let url = part;
    if (url.startsWith("//")) {
      url = "https:" + url;
    } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    // Extract filename from URL - decode URI components
    let filename: string;
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      const lastPart = pathParts[pathParts.length - 1];
      filename = decodeURIComponent(lastPart) || "文件";
    } catch {
      // Fallback: just get last part after /
      const lastSlash = url.lastIndexOf("/");
      filename = lastSlash >= 0 ? decodeURIComponent(url.substring(lastSlash + 1)) : "文件";
    }
    // Truncate very long filenames
    if (filename.length > 50) {
      const ext = filename.lastIndexOf(".") >= 0 ? filename.substring(filename.lastIndexOf(".")) : "";
      filename = filename.substring(0, 45) + "..." + ext;
    }
    return { url, filename };
  });
}

function getFileIcon(filename: string): "pdf" | "image" | "other" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".webp")) return "image";
  return "other";
}

export default function ApprovalManagement() {
  const router = useRouter();
  const { staff } = useAuth();
  const isAdminOrAbove = isAdminOrAboveRole(staff?.role);
  const { canEdit, canDelete, loading: permLoading } = usePermission();
  const { formatMoney: fmtMoney, formatMoney2: fmtMoneyDecimal } = useFinancialFormat();
  const supabase = useMemo(() => createClient(), []);
  const { range: selectedPreset, custom, sources } = useReportRange();
  const {
    projectFilter,
    setProjectFilter,
    staffFilter,
    setStaffFilter,
    staffLocks,
    isSuperAdmin,
  } = useAlignedReportFilters("business");
  const bwMode: BwMode = sources.bwf && !sources.bwa ? "BWF" : "BWA";
  const showZohoCompleted = bwMode === "BWF";
  const incomeStatusOptions = useMemo(
    () =>
      showZohoCompleted
        ? INCOME_STATUS_OPTIONS
        : INCOME_STATUS_OPTIONS.filter((opt) => opt.value !== INCOME_ZOHO_COMPLETED),
    [showZohoCompleted]
  );
  const expenseStatusOptions = useMemo(
    () =>
      showZohoCompleted
        ? EXPENSE_STATUS_OPTIONS
        : EXPENSE_STATUS_OPTIONS.filter((opt) => opt.value !== EXPENSE_ZOHO_COMPLETED),
    [showZohoCompleted]
  );
  const [dateTarget, setDateTarget] = useState<DateTarget>("created_date");

  // Data
  const [incomes, setIncomes] = useState<IncomeRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [projects, setProjects] = useState<AuditProject[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [incomePaymentFilter, setIncomePaymentFilter] = useState<IncomePaymentFilter>("pending");
  const [expensePaymentFilter, setExpensePaymentFilter] = useState<ExpensePaymentFilter>("pending");
  const [activeTab, setActiveTab] = useState<"income" | "expense">("income");

  // Sort
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Remark editing
  const [remarkEdits, setRemarkEdits] = useState<Record<string, string>>({});
  const [remarkSaving, setRemarkSaving] = useState<Record<string, boolean>>({});
  const [remarkSaved, setRemarkSaved] = useState<Record<string, boolean>>({});

  // Related expenses dialog
  const [relatedExpenseTarget, setRelatedExpenseTarget] = useState<ExpenseRow | null>(null);
  const [relatedDialogOpen, setRelatedDialogOpen] = useState(false);

  // Related incomes dialog
  const [relatedIncomeTarget, setRelatedIncomeTarget] = useState<IncomeRow | null>(null);
  const [relatedIncomeDialogOpen, setRelatedIncomeDialogOpen] = useState(false);
  const [relatedIncomesFull, setRelatedIncomesFull] = useState<IncomeRow[]>([]);
  const [relatedIncomesLoading, setRelatedIncomesLoading] = useState(false);

  // Related expenses full list (fetched on-demand without approval filter)
  const [relatedExpensesFull, setRelatedExpensesFull] = useState<ExpenseRow[]>([]);
  const [relatedExpensesLoading, setRelatedExpensesLoading] = useState(false);

  // Payment status updating
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});

  // File upload
  const [fileUploading, setFileUploading] = useState<Record<string, boolean>>({});
  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  // File delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    table: "incomes" | "expenses";
    rowId: string;
    existingPdfFile: string | null;
    urlToRemove: string;
    filename: string;
  }>({ open: false, table: "incomes", rowId: "", existingPdfFile: null, urlToRemove: "", filename: "" });

  const handleFileUpload = useCallback(async (
    table: "incomes" | "expenses",
    rowId: string,
    existingPdfFile: string | null,
    files: FileList
  ) => {
    if (files.length === 0) return;
    setFileUploading((prev) => ({ ...prev, [rowId]: true }));
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = buildStorageObjectKeyWithSanitizedName(`audit/${table}_${rowId}_${i}`, file.name);
        const { error: uploadError } = await supabase.storage
          .from("income-files")
          .upload(filePath, file, { upsert: true });
        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }
        const { data: publicUrlData } = supabase.storage
          .from("income-files")
          .getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) {
          uploadedUrls.push(publicUrlData.publicUrl);
        }
      }
      if (uploadedUrls.length === 0) {
        setFileUploading((prev) => ({ ...prev, [rowId]: false }));
        return;
      }
      // Merge with existing URLs
      const existingUrls = existingPdfFile
        ? existingPdfFile.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const allUrls = [...existingUrls, ...uploadedUrls];
      const newPdfFile = allUrls.join(",");

      const { error: updateErr } = await supabase
        .from(table)
        .update({ pdf_file: newPdfFile })
        .eq("id", rowId);
      if (updateErr) {
        console.error("Failed to update pdf_file:", updateErr);
      } else {
        // Optimistically update local state
        if (table === "incomes") {
          setIncomes((prev) =>
            prev.map((r) => (r.id === rowId ? { ...r, pdf_file: newPdfFile } : r))
          );
        } else {
          setExpenses((prev) =>
            prev.map((r) => (r.id === rowId ? { ...r, pdf_file: newPdfFile } : r))
          );
        }
      }
    } catch (err) {
      console.error("File upload error:", err);
    } finally {
      setFileUploading((prev) => ({ ...prev, [rowId]: false }));
      // Reset file input
      const inputEl = fileInputRefs.current[rowId];
      if (inputEl) inputEl.value = "";
    }
  }, []);

  const handleFileDelete = useCallback(async (
    table: "incomes" | "expenses",
    rowId: string,
    existingPdfFile: string | null,
    urlToRemove: string
  ) => {
    const existingUrls = existingPdfFile
      ? existingPdfFile.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const filtered = existingUrls.filter((u) => u !== urlToRemove);
    const newPdfFile = filtered.length > 0 ? filtered.join(",") : null;

    const { error: updateErr } = await supabase
      .from(table)
      .update({ pdf_file: newPdfFile })
      .eq("id", rowId);
    if (updateErr) {
      console.error("Failed to update pdf_file after delete:", updateErr);
      return;
    }
    if (table === "incomes") {
      setIncomes((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, pdf_file: newPdfFile } : r))
      );
    } else {
      setExpenses((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, pdf_file: newPdfFile } : r))
      );
    }
  }, []);

  const updatePaymentStatus = useCallback(async (
    table: "incomes" | "expenses",
    rowId: string,
    newStatus: string | null
  ) => {
    setStatusUpdating((prev) => ({ ...prev, [rowId]: true }));
    try {
      if (table === "incomes") {
        const result = await setIncomePaymentStatus(rowId, newStatus, staff?.id);
        if (!result.success) {
          console.error("Status update error:", result.error);
          return;
        }
        setIncomes((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, payment_status: newStatus } : r))
        );
        setRelatedIncomesFull((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, payment_status: newStatus } : r))
        );
      } else {
        const result = await setExpensePaymentStatus(rowId, newStatus, staff?.id);
        if (!result.success) {
          console.error("Status update error:", result.error);
          return;
        }
        setExpenses((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, payment_status: newStatus } : r))
        );
        setRelatedExpensesFull((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, payment_status: newStatus } : r))
        );
      }
    } catch (err) {
      console.error("Status update failed:", err);
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [rowId]: false }));
    }
  }, [staff?.id, supabase]);

  // Fetch related expenses on-demand (full list, no approval/required_check filter)
  useEffect(() => {
    if (!relatedExpenseTarget || !relatedDialogOpen) {
      setRelatedExpensesFull([]);
      return;
    }
    const fetchRelatedExpenses = async () => {
      setRelatedExpensesLoading(true);
      try {
        const isBwf = bwMode === "BWF";
        const { data, error } = await fetchAllRows("expenses", "*", (q) => {
          let next = q.order("created_date", { ascending: false });
          if (isBwf) {
            if (relatedExpenseTarget.bwf_project_id) next = next.eq("bwf_project_id", relatedExpenseTarget.bwf_project_id);
          } else if (relatedExpenseTarget.project_id) {
            next = next.eq("project_id", relatedExpenseTarget.project_id);
          }
          if (relatedExpenseTarget.supplier_id) next = next.eq("supplier_id", relatedExpenseTarget.supplier_id);
          if (relatedExpenseTarget.n_contract_type_id) next = next.eq("n_contract_type_id", relatedExpenseTarget.n_contract_type_id);
          return next;
        });
        if (error) { console.error("Related expenses fetch error:", error); setRelatedExpensesFull([]); return; }
        // Fetch supplier + project names + staff for display
        const [projectsRes, suppliersRes, contractTypesRes, staffRes] = await Promise.all([
          isBwf
            ? supabase.from("bwf_projects").select("id, project_code, project_name, status, asana_link, enquiry_date, signed_date, pm:staff!fk_bwf_projects_main_pm_id(name)")
            : supabase.from("bwa_projects").select("id, bubble_id, project_code, project_name, status, asana_link, enquiry_date, signed_date, pm:staff!fk_bwa_projects_main_pm_id(name)"),
          supabase.from("suppliers").select("id, bubble_id, company_name"),
          supabase.from("nos_contracts").select("id, chinese_display"),
          supabase.from("staff").select("id, bubble_id, name"),
        ]);
        type ProjInfo = { project_name: string | null; project_code: string | null; status: string | null; pm_name: string | null; asana_link: string | null; enquiry_date: string | null; signed_date: string | null };
        const projectMap = new Map<string, ProjInfo>();
        (projectsRes.data || []).forEach((p: any) => {
          const pmName = p.pm?.name || null;
          const info: ProjInfo = { project_name: p.project_name, project_code: p.project_code, status: p.status || null, pm_name: pmName, asana_link: p.asana_link || null, enquiry_date: p.enquiry_date || null, signed_date: p.signed_date || null };
          projectMap.set(p.id, info);
          if (p.bubble_id) projectMap.set(p.bubble_id, info);
        });
        const supplierMap = new Map<string, string>();
        (suppliersRes.data || []).forEach((s: any) => { supplierMap.set(s.id, s.company_name); if (s.bubble_id) supplierMap.set(s.bubble_id, s.company_name); });
        const staffMap = new Map<string, string>();
        (staffRes.data || []).forEach((s: any) => { staffMap.set(s.id, s.name); if (s.bubble_id) staffMap.set(s.bubble_id, s.name); });
        const contractTypeMap = new Map<string, string>();
        (contractTypesRes.data || []).forEach((ct: any) => { contractTypeMap.set(ct.id, ct.chinese_display); });
        const mapped: ExpenseRow[] = (data || []).map((e: any) => {
          const proj = isBwf
            ? (e.bwf_project_id ? projectMap.get(e.bwf_project_id) || null : null)
            : (projectMap.get(e.project_id) || null);
          const ctName = e.n_contract_type_id ? contractTypeMap.get(e.n_contract_type_id) : null;
          const ctLabel = ctName ? (e.invoice_number ? `${ctName} #${e.invoice_number}` : ctName) : (e.type_display || null);
          const approverName =
            (e.approve_creator_id && staffMap.get(e.approve_creator_id))
            || (e.approve_creator && staffMap.get(e.approve_creator))
            || null;
          return {
            id: e.id, installment_amount: e.installment_amount, paid_amount: e.paid_amount, outstanding: e.outstanding,
            status: e.status, payment_status: e.payment_status, invoice_number: e.invoice_number, type_display: e.type_display,
            contract_type_label: ctLabel, due_date: e.due_date || null, expected_payment_date: e.expected_payment_date || null, payment_date: e.payment_date, created_date: e.created_date, enquiry_date: proj?.enquiry_date || null, signed_date: proj?.signed_date || null, approved: null,
            approved_date: e.approved_date, approve_creator_name: approverName, remark_t: e.remark_t, real_creator_name: e.real_creator_name,
            required_check: null, required_po: e.required_po, cheque_no: e.cheque_no,
            supplier_name: (e.supplier_id && supplierMap.get(e.supplier_id)) || (e.supplier && supplierMap.get(e.supplier)) || null,
            supplier_id: e.supplier_id, n_contract_type_id: e.n_contract_type_id || null, pdf_file: e.pdf_file || null,
            project_name: proj?.project_name || null, project_code: proj?.project_code || null, project_status: proj?.status || null,
            project_id: e.project_id, bwf_project_id: e.bwf_project_id || null, pm_name: proj?.pm_name || null, asana_link: proj?.asana_link || null};
        });
        setRelatedExpensesFull(mapped);
      } catch (err) {
        console.error("Related expenses fetch error:", err);
        setRelatedExpensesFull([]);
      } finally {
        setRelatedExpensesLoading(false);
      }
    };
    fetchRelatedExpenses();
  }, [relatedExpenseTarget, relatedDialogOpen, bwMode, supabase]);

  // Fetch related incomes on-demand (full list, no approval/required_check filter)
  useEffect(() => {
    if (!relatedIncomeTarget || !relatedIncomeDialogOpen) {
      setRelatedIncomesFull([]);
      return;
    }
    const fetchRelatedIncomes = async () => {
      setRelatedIncomesLoading(true);
      try {
        const isBwf = bwMode === "BWF";
        const { data, error } = await fetchAllRows("incomes", "*", (q) => {
          let next = q.order("created_date", { ascending: false });
          if (isBwf) {
            if (relatedIncomeTarget.bwf_project_id) next = next.eq("bwf_project_id", relatedIncomeTarget.bwf_project_id);
          } else if (relatedIncomeTarget.project_id) {
            next = next.eq("project_id", relatedIncomeTarget.project_id);
          }
          if (relatedIncomeTarget.n_contract_type_id) next = next.eq("n_contract_type_id", relatedIncomeTarget.n_contract_type_id);
          return next;
        });
        if (error) { console.error("Related incomes fetch error:", error); setRelatedIncomesFull([]); return; }
        // Fetch project names + staff for display
        const [projectsRes, contractTypesRes, staffRes] = await Promise.all([
          isBwf
            ? supabase.from("bwf_projects").select("id, project_code, project_name, status, asana_link, enquiry_date, signed_date, pm:staff!fk_bwf_projects_main_pm_id(name)")
            : supabase.from("bwa_projects").select("id, bubble_id, project_code, project_name, status, asana_link, enquiry_date, signed_date, pm:staff!fk_bwa_projects_main_pm_id(name)"),
          supabase.from("nos_contracts").select("id, chinese_display"),
          supabase.from("staff").select("id, bubble_id, name"),
        ]);
        type ProjInfo = { project_name: string | null; project_code: string | null; status: string | null; pm_name: string | null; asana_link: string | null; enquiry_date: string | null; signed_date: string | null };
        const projectMap = new Map<string, ProjInfo>();
        (projectsRes.data || []).forEach((p: any) => {
          const pmName = p.pm?.name || null;
          const info: ProjInfo = { project_name: p.project_name, project_code: p.project_code, status: p.status || null, pm_name: pmName, asana_link: p.asana_link || null, enquiry_date: p.enquiry_date || null, signed_date: p.signed_date || null };
          projectMap.set(p.id, info);
          if (p.bubble_id) projectMap.set(p.bubble_id, info);
        });
        const staffMap = new Map<string, string>();
        (staffRes.data || []).forEach((s: any) => { staffMap.set(s.id, s.name); if (s.bubble_id) staffMap.set(s.bubble_id, s.name); });
        const contractTypeMap = new Map<string, string>();
        (contractTypesRes.data || []).forEach((ct: any) => { contractTypeMap.set(ct.id, ct.chinese_display); });
        const mapped: IncomeRow[] = (data || [])
          .filter((i: any) =>
            isBwf
              ? !!i.bwf_project_id
              : (i.project_id && i.project_id !== "") || (i.project && i.project !== "")
          )
          .map((i: any) => {
            const proj = isBwf
              ? (i.bwf_project_id ? projectMap.get(i.bwf_project_id) || null : null)
              : ((i.project_id && projectMap.get(i.project_id)) || (i.project && projectMap.get(i.project)) || null);
            const ctName = i.n_contract_type_id ? contractTypeMap.get(i.n_contract_type_id) : null;
            const ctLabel = ctName ? (i.invoice_number ? `${ctName} #${i.invoice_number}` : ctName) : (i.type_display || null);
            const approverName =
              (i.approve_creator_id && staffMap.get(i.approve_creator_id))
              || (i.approve_creator && staffMap.get(i.approve_creator))
              || null;
            return {
              id: i.id, income_amount: i.income_amount, payment_amount: i.payment_amount, outstanding: i.outstanding,
              status: i.status, payment_status: i.payment_status, invoice_number: i.invoice_number, type_display: i.type_display,
              contract_type_label: ctLabel, due_date: i.due_date, expected_payment_date: i.expected_payment_date || null, receive_date: i.receive_date, created_date: i.created_date, enquiry_date: proj?.enquiry_date || null, signed_date: proj?.signed_date || null,
              approved: null, approved_date: i.approved_date, approve_creator_name: approverName, remark: i.remark, real_creator_name: i.real_creator_name,
              required_check: null, pdf_file: i.pdf_file || null,
              project_name: proj?.project_name || null, project_code: proj?.project_code || null, project_status: proj?.status || null,
              project_id: i.project_id || i.project || null, bwf_project_id: i.bwf_project_id || null,
              pm_name: proj?.pm_name || null, n_contract_type_id: i.n_contract_type_id || null, asana_link: proj?.asana_link || null};
          });
        setRelatedIncomesFull(mapped);
      } catch (err) {
        console.error("Related incomes fetch error:", err);
        setRelatedIncomesFull([]);
      } finally {
        setRelatedIncomesLoading(false);
      }
    };
    fetchRelatedIncomes();
  }, [relatedIncomeTarget, relatedIncomeDialogOpen, bwMode, supabase]);

  // Aliases for template usage
  const relatedExpenses = relatedExpensesFull;
  const relatedIncomes = relatedIncomesFull;

  // ─── Fetch Data ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isBwf = bwMode === "BWF";

      // Step 1: Fetch lookup tables (projects + suppliers + contract types + staff) for name resolution
      const [projectsRes, suppliersRes, contractTypesRes, staffRes] = await Promise.all([
        isBwf
          ? fetchAllRows("bwf_projects", BWF_AUDIT_PROJECT_SELECT)
          : fetchAllRows("bwa_projects", BWA_AUDIT_PROJECT_SELECT),
        supabase.from("suppliers").select("id, bubble_id, company_name"),
        supabase.from("nos_contracts").select("id, chinese_display"),
        supabase.from("staff").select("id, bubble_id, name"),
      ]);

      const rawProjects = projectsRes.data || [];
      const projectIds = rawProjects.map((p: any) => p.id).filter(Boolean);
      const [bwaPtNames, bwfStNames] = await Promise.all([
        isBwf ? Promise.resolve(new Map<string, string>()) : resolveJunctionProjectTypesForProjects(projectIds),
        isBwf ? resolveBwfJunctionServiceTypesForProjects(projectIds) : Promise.resolve(new Map<string, string>()),
      ]);

      const mappedProjects: AuditProject[] = rawProjects.map((p: any) => {
        const pm = relOne<{ id: string; name: string }>(p.pm);
        const fy = relOne<{ id: string; display: string }>(p.fy);
        const cc = relOne<{ bu_code: string }>(p.cc);
        const st = relOne<{ id: string; display: string }>(p.st);
        const ctype = relOne<{ id: string; display: string }>(p.ctype);
        return {
          id: p.id,
          status: p.status ?? null,
          cost_centre_bu_code: cc?.bu_code ?? null,
          service_type_name: isBwf ? (bwfStNames.get(p.id) ?? null) : (st?.display ?? null),
          service_type_id: isBwf ? null : (st?.id ?? p.n_service_type_id ?? null),
          project_type_name: isBwf ? (ctype?.display ?? null) : (bwaPtNames.get(p.id) ?? null),
          project_type_id: isBwf ? (ctype?.id ?? p.n_customer_type_id ?? null) : null,
          financial_year_name: fy?.display ?? null,
          n_financial_year_id: fy?.id ?? p.n_financial_year_id ?? null,
          est_income: p.estimated_income ?? null,
          project_size: p.project_size ?? null,
          project_name: p.project_name ?? null,
          project_code: p.project_code ?? null,
          pm_name: pm?.name ?? null,
          pm_id: pm?.id ?? p.main_pm_id ?? null,
          enquiry_date: p.enquiry_date ?? null,
          signed_date: p.signed_date ?? null,
          asana_link: p.asana_link ?? null,
        };
      });
      setProjects(mappedProjects);
      
      // Build lookup maps (index by both UUID id and bubble_id for fallback)
      type ProjInfo = { project_name: string | null; project_code: string | null; status: string | null; pm_name: string | null; asana_link: string | null; enquiry_date: string | null; signed_date: string | null };
      const projectMap = new Map<string, ProjInfo>();
      mappedProjects.forEach((p, idx) => {
        const info: ProjInfo = {
          project_name: p.project_name ?? null,
          project_code: p.project_code ?? null,
          status: p.status,
          pm_name: p.pm_name ?? null,
          asana_link: p.asana_link,
          enquiry_date: p.enquiry_date,
          signed_date: p.signed_date,
        };
        projectMap.set(p.id, info);
        const bubbleId = rawProjects[idx]?.bubble_id;
        if (bubbleId) projectMap.set(bubbleId, info);
      });
      const supplierMap = new Map<string, string>();
      (suppliersRes.data || []).forEach((s: any) => {
        supplierMap.set(s.id, s.company_name);
        if (s.bubble_id) supplierMap.set(s.bubble_id, s.company_name);
      });
      // Contract type lookup: UUID → chinese_display
      const contractTypeMap = new Map<string, string>();
      (contractTypesRes.data || []).forEach((ct: any) => {
        contractTypeMap.set(ct.id, ct.chinese_display);
      });
      // Staff lookup: id/bubble_id → name (for approve_creator resolution)
      const staffMap = new Map<string, string>();
      (staffRes.data || []).forEach((s: any) => {
        staffMap.set(s.id, s.name);
        if (s.bubble_id) staffMap.set(s.bubble_id, s.name);
      });

      // Step 2: Fetch incomes (page past PostgREST/500 cap)
      let mappedIncomes: IncomeRow[] = [];
      const { data: incomeData, error: incErr } = await fetchAllRows("incomes", "*", (q) => {
        let query = q.order("created_date", { ascending: false });
        if (incomePaymentFilter === "unapplied") query = query.is("payment_status", null);
        else if (incomePaymentFilter === "pending") query = query.eq("payment_status", INCOME_PENDING_CHECK);
        else if (incomePaymentFilter === "received") query = query.eq("payment_status", INCOME_RECEIVED);
        else if (incomePaymentFilter === "zoho_completed") query = query.eq("payment_status", INCOME_ZOHO_COMPLETED);
        else if (incomePaymentFilter === "not_received") query = query.eq("payment_status", INCOME_NOT_RECEIVED);
        else if (incomePaymentFilter === "bounced") query = query.eq("payment_status", INCOME_BOUNCED);
        if (isBwf) {
          query = query.not("bwf_project_id", "is", null);
        } else {
          query = query.or("project_id.not.is.null,project.not.is.null");
        }
        return query;
      });

      if (incErr) {
        console.error("[ApprovalManagement] Income fetch error:", incErr.message);
      }
      mappedIncomes = (incomeData || [])
        .filter((i: any) =>
          isBwf
            ? !!i.bwf_project_id
            : (i.project_id && i.project_id !== "") || (i.project && i.project !== "")
        )
        .map((i: any) => {
        // BWF: resolve via bwf_project_id; BWA: project_id then legacy project text
        const proj = isBwf
          ? (i.bwf_project_id ? projectMap.get(i.bwf_project_id) || null : null)
          : ((i.project_id && projectMap.get(i.project_id)) || (i.project && projectMap.get(i.project)) || null);
        // Build contract type label: chinese_display + #invoice_number (e.g. "主體工程 #2")
        const ctName = i.n_contract_type_id ? contractTypeMap.get(i.n_contract_type_id) : null;
        const ctLabel = ctName ? (i.invoice_number ? `${ctName} #${i.invoice_number}` : ctName) : (i.type_display || null);
        return {
          id: i.id,
          income_amount: i.income_amount,
          payment_amount: i.payment_amount,
          outstanding: i.outstanding,
          status: i.status,
          payment_status: i.payment_status,
          invoice_number: i.invoice_number,
          type_display: i.type_display,
          contract_type_label: ctLabel,
          due_date: i.due_date,
          expected_payment_date: i.expected_payment_date || null,
          receive_date: i.receive_date,
          created_date: i.created_date,
          enquiry_date: proj?.enquiry_date || null,
          signed_date: proj?.signed_date || null,
          approved: null,
          approved_date: i.approved_date,
          approve_creator_name:
            (i.approve_creator_id && staffMap.get(i.approve_creator_id))
            || (i.approve_creator && staffMap.get(i.approve_creator))
            || null,
          remark: i.remark,
          real_creator_name: i.real_creator_name,
          required_check: null,
          pdf_file: i.pdf_file || null,
          project_name: proj?.project_name || null,
          project_code: proj?.project_code || null,
          project_status: proj?.status || null,
          project_id: i.project_id || i.project || null,
          bwf_project_id: i.bwf_project_id || null,
          pm_name: proj?.pm_name || null,
          n_contract_type_id: i.n_contract_type_id || null,
          asana_link: proj?.asana_link || null};
      });

      // Step 3: Fetch expenses (page past PostgREST/500 cap)
      let mappedExpenses: ExpenseRow[] = [];
      const { data: expenseData, error: expErr } = await fetchAllRows("expenses", "*", (q) => {
        let query = q.order("created_date", { ascending: false });
        if (expensePaymentFilter === "unapplied") query = query.is("payment_status", null);
        else if (expensePaymentFilter === "pending") query = query.eq("payment_status", EXPENSE_PENDING_CHECK);
        else if (expensePaymentFilter === "approved") query = query.eq("payment_status", EXPENSE_APPROVED);
        else if (expensePaymentFilter === "zoho_completed") query = query.eq("payment_status", EXPENSE_ZOHO_COMPLETED);
        else if (expensePaymentFilter === "rejected") query = query.eq("payment_status", EXPENSE_REJECTED);
        if (isBwf) {
          query = query.not("bwf_project_id", "is", null);
        } else {
          query = query.not("project_id", "is", null);
        }
        return query;
      });

      if (expErr) {
        console.error("[ApprovalManagement] Expense fetch error:", expErr.message);
      }
      mappedExpenses = (expenseData || [])
        .map((e: any) => {
        const proj = isBwf
          ? (e.bwf_project_id ? projectMap.get(e.bwf_project_id) || null : null)
          : (projectMap.get(e.project_id) || null);
        // Build contract type label: chinese_display + #invoice_number (e.g. "主體工程 #2")
        const ctName = e.n_contract_type_id ? contractTypeMap.get(e.n_contract_type_id) : null;
        const ctLabel = ctName ? (e.invoice_number ? `${ctName} #${e.invoice_number}` : ctName) : (e.type_display || null);
        return {
          id: e.id,
          installment_amount: e.installment_amount,
          paid_amount: e.paid_amount,
          outstanding: e.outstanding,
          status: e.status,
          payment_status: e.payment_status,
          invoice_number: e.invoice_number,
          type_display: e.type_display,
          contract_type_label: ctLabel,
          due_date: e.due_date || null,
          expected_payment_date: e.expected_payment_date || null,
          payment_date: e.payment_date,
          created_date: e.created_date,
          enquiry_date: proj?.enquiry_date || null,
          signed_date: proj?.signed_date || null,
          approved: null,
          approved_date: e.approved_date,
          approve_creator_name:
            (e.approve_creator_id && staffMap.get(e.approve_creator_id))
            || (e.approve_creator && staffMap.get(e.approve_creator))
            || null,
          remark_t: e.remark_t,
          real_creator_name: e.real_creator_name,
          required_check: null,
          required_po: e.required_po,
          cheque_no: e.cheque_no,
          supplier_name: (e.supplier_id && supplierMap.get(e.supplier_id)) || (e.supplier && supplierMap.get(e.supplier)) || null,
          supplier_id: e.supplier_id,
          n_contract_type_id: e.n_contract_type_id || null,
          pdf_file: e.pdf_file || null,
          project_name: proj?.project_name || null,
          project_code: proj?.project_code || null,
          project_status: proj?.status || null,
          project_id: e.project_id,
          bwf_project_id: e.bwf_project_id || null,
          pm_name: proj?.pm_name || null,
          asana_link: proj?.asana_link || null};
      });

      setIncomes(mappedIncomes);
      setExpenses(mappedExpenses);
    } catch (err: any) {
      console.error("[ApprovalManagement] Unexpected error:", err);
      setError(err.message || "載入數據失敗");
    } finally {
      setLoading(false);
    }
  }, [bwMode, expensePaymentFilter, incomePaymentFilter, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (showZohoCompleted) return;
    if (incomePaymentFilter === "zoho_completed") setIncomePaymentFilter("pending");
    if (expensePaymentFilter === "zoho_completed") setExpensePaymentFilter("pending");
  }, [showZohoCompleted, incomePaymentFilter, expensePaymentFilter]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, expensePaymentFilter, incomePaymentFilter, activeTab, bwMode, selectedPreset, custom, dateTarget, projectFilter, staffFilter]);

  const dateWindow = useMemo(
    () => resolveRange(selectedPreset, new Date(), custom),
    [selectedPreset, custom]
  );
  const dateTargetLabel =
    DATE_TARGET_OPTIONS.find((o) => o.value === dateTarget)?.label ?? "到期日 Due Date";
  const dateRangeLabel = useMemo(
    () => `From ${fmtRangeDate(dateWindow.from)} to ${fmtRangeDate(dateWindow.to)} · ${dateTargetLabel}`,
    [dateWindow, dateTargetLabel]
  );

  const allowedProjectIds = useMemo(() => {
    const filtered = applyProjectFilters(projects, projectFilter).filter((p) =>
      staffIdMatchesFilter(p.pm_id, staffFilter, staffDirectory)
    );
    return new Set(filtered.map((p) => p.id));
  }, [projects, projectFilter, staffFilter, staffDirectory]);

  const filtersIdle =
    isProjectFilterIdle(projectFilter) && isStaffFilterIdle(staffFilter);

  const dateScopedIncomes = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(dateWindow);
    return incomes.filter((i) => {
      if (!dateInRange(rowDateForTarget(dateTarget, i), fromMs, toMs)) return false;
      const pid = rowProjectId(i, bwMode);
      if (pid && allowedProjectIds.has(pid)) return true;
      return filtersIdle;
    });
  }, [incomes, dateWindow, dateTarget, bwMode, allowedProjectIds, filtersIdle]);

  const dateScopedExpenses = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(dateWindow);
    return expenses.filter((e) => {
      if (!dateInRange(rowDateForTarget(dateTarget, e), fromMs, toMs)) return false;
      const pid = rowProjectId(e, bwMode);
      if (pid && allowedProjectIds.has(pid)) return true;
      return filtersIdle;
    });
  }, [expenses, dateWindow, dateTarget, bwMode, allowedProjectIds, filtersIdle]);

  // ─── KPI Stats ───
  const kpiStats = useMemo(() => {
    const relevantIncomes = dateScopedIncomes;
    const relevantExpenses = dateScopedExpenses;

    const pendingIncomes = relevantIncomes.filter((i) => i.payment_status === INCOME_PENDING_CHECK);
    const pendingExpenses = relevantExpenses.filter((e) => e.payment_status === EXPENSE_PENDING_CHECK);
    const approvedIncomes = relevantIncomes.filter((i) =>
      i.payment_status === INCOME_RECEIVED
      || i.payment_status === INCOME_ZOHO_COMPLETED
      || i.payment_status === INCOME_NOT_RECEIVED
      || i.payment_status === INCOME_BOUNCED
    );
    const approvedExpenses = relevantExpenses.filter((e) =>
      e.payment_status === EXPENSE_APPROVED
      || e.payment_status === EXPENSE_ZOHO_COMPLETED
      || e.payment_status === EXPENSE_REJECTED
    );

    const pendingIncomeTotal = pendingIncomes.reduce((s, i) => s + (i.income_amount || 0), 0);
    const pendingExpenseTotal = pendingExpenses.reduce((s, e) => s + (e.installment_amount || 0), 0);
    const approvedIncomeTotal = approvedIncomes.reduce((s, i) => s + (i.income_amount || 0), 0);
    const approvedExpenseTotal = approvedExpenses.reduce((s, e) => s + (e.installment_amount || 0), 0);

    return {
      pendingIncomeCount: pendingIncomes.length,
      pendingExpenseCount: pendingExpenses.length,
      pendingIncomeTotal,
      pendingExpenseTotal,
      approvedIncomeCount: approvedIncomes.length,
      approvedExpenseCount: approvedExpenses.length,
      approvedIncomeTotal,
      approvedExpenseTotal,
      totalIncomes: relevantIncomes.length,
      totalExpenses: relevantExpenses.length};
  }, [dateScopedIncomes, dateScopedExpenses]);

  // ─── Filter & Sort: Incomes ───
  const filteredIncomes = useMemo(() => {
    let list = [...dateScopedIncomes];

    if (incomePaymentFilter === "unapplied") list = list.filter((i) => !i.payment_status);
    else if (incomePaymentFilter === "pending") list = list.filter((i) => i.payment_status === INCOME_PENDING_CHECK);
    else if (incomePaymentFilter === "received") list = list.filter((i) => i.payment_status === INCOME_RECEIVED);
    else if (incomePaymentFilter === "zoho_completed") list = list.filter((i) => i.payment_status === INCOME_ZOHO_COMPLETED);
    else if (incomePaymentFilter === "not_received") list = list.filter((i) => i.payment_status === INCOME_NOT_RECEIVED);
    else if (incomePaymentFilter === "bounced") list = list.filter((i) => i.payment_status === INCOME_BOUNCED);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          (i.project_name || "").toLowerCase().includes(q) ||
          (i.project_code || "").toLowerCase().includes(q) ||
          (i.invoice_number || "").toLowerCase().includes(q) ||
          (i.real_creator_name || "").toLowerCase().includes(q) ||
          (i.contract_type_label || i.type_display || "").toLowerCase().includes(q) ||
          (i.remark || "").toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "amount":
          cmp = (a.income_amount || 0) - (b.income_amount || 0);
          break;
        case "date":
          cmp = (a.receive_date || "").localeCompare(b.receive_date || "");
          break;
        case "created_date":
          cmp = (a.created_date || "").localeCompare(b.created_date || "");
          break;
        case "due_date":
          cmp = (a.due_date || "").localeCompare(b.due_date || "");
          break;
        case "expected_payment_date":
          cmp = (a.expected_payment_date || "").localeCompare(b.expected_payment_date || "");
          break;
        case "project":
          cmp = (a.project_name || "").localeCompare(b.project_name || "");
          break;
        case "status":
          cmp = (a.payment_status || "").localeCompare(b.payment_status || "");
          break;
        case "creator":
          cmp = (a.real_creator_name || "").localeCompare(b.real_creator_name || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [dateScopedIncomes, search, incomePaymentFilter, sortField, sortDir]);

  // ─── Filter & Sort: Expenses ───
  const filteredExpenses = useMemo(() => {
    let list = [...dateScopedExpenses];

    if (expensePaymentFilter === "unapplied") list = list.filter((e) => !e.payment_status);
    else if (expensePaymentFilter === "pending") list = list.filter((e) => e.payment_status === EXPENSE_PENDING_CHECK);
    else if (expensePaymentFilter === "approved") list = list.filter((e) => e.payment_status === EXPENSE_APPROVED);
    else if (expensePaymentFilter === "zoho_completed") list = list.filter((e) => e.payment_status === EXPENSE_ZOHO_COMPLETED);
    else if (expensePaymentFilter === "rejected") list = list.filter((e) => e.payment_status === EXPENSE_REJECTED);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          (e.project_name || "").toLowerCase().includes(q) ||
          (e.project_code || "").toLowerCase().includes(q) ||
          (e.invoice_number || "").toLowerCase().includes(q) ||
          (e.real_creator_name || "").toLowerCase().includes(q) ||
          (e.supplier_name || "").toLowerCase().includes(q) ||
          (e.contract_type_label || e.type_display || "").toLowerCase().includes(q) ||
          (e.remark_t || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "amount":
          cmp = (a.installment_amount || 0) - (b.installment_amount || 0);
          break;
        case "date":
          cmp = (a.payment_date || "").localeCompare(b.payment_date || "");
          break;
        case "created_date":
          cmp = (a.created_date || "").localeCompare(b.created_date || "");
          break;
        case "due_date":
          cmp = (a.due_date || "").localeCompare(b.due_date || "");
          break;
        case "expected_payment_date":
          cmp = (a.expected_payment_date || "").localeCompare(b.expected_payment_date || "");
          break;
        case "project":
          cmp = (a.project_name || "").localeCompare(b.project_name || "");
          break;
        case "status":
          cmp = (a.payment_status || "").localeCompare(b.payment_status || "");
          break;
        case "creator":
          cmp = (a.real_creator_name || "").localeCompare(b.real_creator_name || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [dateScopedExpenses, search, expensePaymentFilter, sortField, sortDir]);

  // ─── Pagination ───
  const currentData = activeTab === "income" ? filteredIncomes : filteredExpenses;
  const totalItems = currentData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pagedData = currentData.slice((page - 1) * pageSize, page * pageSize);

  // ─── Sort Toggle ───
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-bw-blue" />
    ) : (
      <ChevronDown className="w-3 h-3 text-bw-blue" />
    );
  };

  // ─── Navigate to project detail ───
  const goToProject = (row: { project_id?: string | null; bwf_project_id?: string | null }) => {
    if (bwMode === "BWF") {
      if (row.bwf_project_id) {
        window.open(`/bwf/projects/${row.bwf_project_id}`, "_blank", "noopener");
      }
      return;
    }
    if (row.project_id) {
      window.open(`/projects/bwa/${row.project_id}`, "_blank", "noopener");
    }
  };

  // ─── Remark save handler ───
  const handleRemarkSave = async (type: "income" | "expense", id: string) => {
    const newRemark = remarkEdits[id];
    if (newRemark === undefined) return;
    
    setRemarkSaving((prev) => ({ ...prev, [id]: true }));
    setRemarkSaved((prev) => ({ ...prev, [id]: false }));
    
    const table = type === "income" ? "incomes" : "expenses";
    const remarkField = type === "income" ? "remark" : "remark_t";
    
    const { error: updateErr } = await supabase
      .from(table)
      .update({ [remarkField]: newRemark || null })
      .eq("id", id);
    
    setRemarkSaving((prev) => ({ ...prev, [id]: false }));
    
    if (updateErr) {
      console.error(`[ApprovalManagement] Failed to update remark on ${table}:`, updateErr.message);
      return;
    }
    
    // Update local state
    if (type === "income") {
      setIncomes((prev) => prev.map((r) => r.id === id ? { ...r, remark: newRemark || null } : r));
    } else {
      setExpenses((prev) => prev.map((r) => r.id === id ? { ...r, remark_t: newRemark || null } : r));
    }
    
    // Show saved indicator
    setRemarkSaved((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => setRemarkSaved((prev) => ({ ...prev, [id]: false })), 2000);
  };

  // ─── Render ───

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            會計審核
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Approval Management — 審批收入及支出記錄
          </p>
          <p className="text-sm text-gray-400 mt-0.5">{dateRangeLabel}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>

      <ReportFilterStack
        showL2L3={false}
        projectRows={projects}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        staffLocks={staffLocks}
        isSuperAdmin={isSuperAdmin}
        onStaffDirectoryLoaded={setStaffDirectory}
        afterDate={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-gray-400 font-medium">日期基準</span>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white flex-wrap">
              {DATE_TARGET_OPTIONS.map((opt, idx) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDateTarget(opt.value)}
                  className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    idx > 0 ? "border-l border-gray-200" : ""
                  } ${
                    dateTarget === opt.value
                      ? "bg-bw-blue text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Incomes */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs text-gray-500">待審核收入</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {kpiStats.pendingIncomeCount}
          </div>
          <div className="text-xs text-gray-400 mt-1 font-mono-num">
            {fmtMoney(kpiStats.pendingIncomeTotal)}
          </div>
        </div>

        {/* Pending Expenses */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-xs text-gray-500">待審核支出</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {kpiStats.pendingExpenseCount}
          </div>
          <div className="text-xs text-gray-400 mt-1 font-mono-num">
            {fmtMoney(kpiStats.pendingExpenseTotal)}
          </div>
        </div>

        {/* Approved Incomes */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs text-gray-500">已決定收入</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {kpiStats.approvedIncomeCount}
          </div>
          <div className="text-xs text-gray-400 mt-1 font-mono-num">
            {fmtMoney(kpiStats.approvedIncomeTotal)}
          </div>
        </div>

        {/* Approved Expenses */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">已決定支出</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {kpiStats.approvedExpenseCount}
          </div>
          <div className="text-xs text-gray-400 mt-1 font-mono-num">
            {fmtMoney(kpiStats.approvedExpenseTotal)}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜尋項目、發票號碼、建立者..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {activeTab === "income" ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 whitespace-nowrap">收款狀態</span>
              <Select
                value={incomePaymentFilter}
                onValueChange={(v) => setIncomePaymentFilter(v as IncomePaymentFilter)}
              >
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="收款狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="unapplied">未申請</SelectItem>
                  <SelectItem value="pending">待審核</SelectItem>
                  <SelectItem value="received">已收款</SelectItem>
                  {showZohoCompleted && (
                    <SelectItem value="zoho_completed">Zoho Completed</SelectItem>
                  )}
                  <SelectItem value="not_received">未收款</SelectItem>
                  <SelectItem value="bounced">退票</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 whitespace-nowrap">審批狀態</span>
              <Select
                value={expensePaymentFilter}
                onValueChange={(v) => setExpensePaymentFilter(v as ExpensePaymentFilter)}
              >
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="審批狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="unapplied">未申請</SelectItem>
                  <SelectItem value="pending">待審核</SelectItem>
                  <SelectItem value="approved">已批核</SelectItem>
                  {showZohoCompleted && (
                    <SelectItem value="zoho_completed">Zoho Completed</SelectItem>
                  )}
                  <SelectItem value="rejected">已拒絕</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Count */}
          <span className="text-xs text-gray-400 ml-auto">
            共 {totalItems} 條記錄
          </span>
        </div>
      </div>

      {/* Tabs: Income / Expense */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "income" | "expense")}>
        <TabsList className="bg-gray-100/80">
          <TabsTrigger value="income" className="gap-1.5 text-sm">
            <Receipt className="w-4 h-4" />
            收入 ({filteredIncomes.length})
          </TabsTrigger>
          <TabsTrigger value="expense" className="gap-1.5 text-sm">
            <CreditCard className="w-4 h-4" />
            支出 ({filteredExpenses.length})
          </TabsTrigger>
        </TabsList>

        {/* Income Tab */}
        <TabsContent value="income" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-bw-blue" />
              <span className="ml-2 text-sm text-gray-500">載入中...</span>
            </div>
          ) : error ? (
            <div className="text-center py-20 text-red-500 text-sm">{error}</div>
          ) : filteredIncomes.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">暫無數據</div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <DueExpectedHeads sortable onSort={toggleSort} SortIcon={SortIcon} />
                    <TableHead className="text-xs">
                      <button className="flex items-center gap-1" onClick={() => toggleSort("date")}>
                        收款日期 <SortIcon field="date" />
                      </button>
                    </TableHead>
                    <TableHead className="text-xs">逾期天數</TableHead>
                    <TableHead className="text-xs">類別</TableHead>
                    <TableHead className="text-xs">項目經理</TableHead>
                    <TableHead className="text-xs">
                      <button className="flex items-center gap-1" onClick={() => toggleSort("project")}>
                        項目 <SortIcon field="project" />
                      </button>
                    </TableHead>
                    <TableHead className="text-xs text-right">
                      <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("amount")}>
                        應收款項 <SortIcon field="amount" />
                      </button>
                    </TableHead>
                    <TableHead className="text-xs text-right">已收款項</TableHead>
                    <TableHead className="text-xs text-right">收款比率</TableHead>
                    <TableHead className="text-xs">
                      <button className="flex items-center gap-1" onClick={() => toggleSort("status")}>
                        收款狀態 <SortIcon field="status" />
                      </button>
                    </TableHead>
                    <TableHead className="text-xs text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pagedData as IncomeRow[]).map((row) => {
                    const overdue = calcOverdueDays(row.due_date, null);
                    const ratio = calcCollectionRatio(row.income_amount, row.payment_amount);
                    const ratioNum = row.income_amount ? ((row.payment_amount || 0) / row.income_amount) * 100 : 0;
                    return (
                      <TableRow
                        key={row.id}
                        className="hover:bg-gray-50/60 transition-colors cursor-pointer group"
                      >
                        <DueExpectedCells createdDate={row.created_date} dueDate={row.due_date} expectedPaymentDate={row.expected_payment_date} />
                        <TableCell>
                          <span className="text-xs text-gray-700">{fmtDateYmd(row.receive_date)}</span>
                        </TableCell>
                        <TableCell>
                          {overdue.isOverdue ? (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-[12px] px-1.5 py-0.5">
                              逾期{overdue.days}天
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[12px] px-1.5 py-0.5">
                              準時
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-600">{row.contract_type_label || row.type_display || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-700">{row.pm_name || row.real_creator_name || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <ProjectNameCell
                            name={row.project_name}
                            code={row.project_code}
                            status={row.project_status}
                            onClick={() => goToProject(row)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-medium text-gray-800 font-mono-num">
                            {fmtMoneyDecimal(row.income_amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-gray-800 font-mono-num">
                            {fmtMoneyDecimal(row.payment_amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-medium ${ratioNum >= 100 ? "text-emerald-600" : ratioNum > 0 ? "text-amber-600" : "text-gray-400"}`}>
                            {ratio}
                          </span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {isAdminOrAbove ? (
                            <Select
                              value={row.payment_status || INCOME_STATUS_NONE}
                              onValueChange={(val) =>
                                updatePaymentStatus("incomes", row.id, val === INCOME_STATUS_NONE ? null : val)
                              }
                            >
                              <SelectTrigger className={`h-7 w-auto min-w-[140px] whitespace-nowrap [&>span]:truncate border text-[12px] px-2 py-0.5 font-medium ${getPaymentStatusStyle(row.payment_status)} ${statusUpdating[row.id] ? "opacity-50" : ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {incomeStatusOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[12px] font-medium ${opt.className}`}>
                                      {opt.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className={`inline-block h-7 leading-7 px-2 rounded border text-[12px] font-medium ${getPaymentStatusStyle(row.payment_status)}`}>
                              {row.payment_status || "未申請"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5 justify-center">
                            <AsanaLinkButton href={row.asana_link} />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRelatedIncomeTarget(row);
                                setRelatedIncomeDialogOpen(true);
                              }}
                              title="查看相關收入"
                            >
                              <Search className="w-3.5 h-3.5" />
                            </Button>
                            {(() => {
                              const remarkVal = activeTab === "income" ? (row as IncomeRow).remark : (row as unknown as ExpenseRow).remark_t;
                              const hasRemark = !!(remarkVal && remarkVal.trim());
                              const editKey = row.id;
                              return (
                                <Popover onOpenChange={(open) => {
                                  if (open) {
                                    setRemarkEdits((prev) => ({ ...prev, [editKey]: remarkVal || "" }));
                                    setRemarkSaved((prev) => ({ ...prev, [editKey]: false }));
                                  }
                                }}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className={`h-7 w-7 p-0 relative ${hasRemark ? "text-amber-500 hover:text-amber-700 hover:bg-amber-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                                      title={hasRemark ? "編輯備註" : "新增備註"}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      {hasRemark && (
                                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
                                      )}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent 
                                    className="w-72 p-3" 
                                    side="bottom" 
                                    align="center"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-semibold text-gray-700">📝 備註 Remark</h4>
                                        {remarkSaved[editKey] && (
                                          <span className="text-xs text-green-600 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> 已儲存
                                          </span>
                                        )}
                                      </div>
                                      <Textarea
                                        value={remarkEdits[editKey] ?? remarkVal ?? ""}
                                        onChange={(e) => setRemarkEdits((prev) => ({ ...prev, [editKey]: e.target.value }))}
                                        placeholder="輸入備註..."
                                        className="min-h-[80px] text-sm resize-none"
                                        rows={3}
                                      />
                                      <div className="flex justify-end">
                                        <Button
                                          size="sm"
                                          className="h-7 px-3 gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemarkSave(activeTab, row.id);
                                          }}
                                          disabled={remarkSaving[editKey]}
                                        >
                                          {remarkSaving[editKey] ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <Send className="w-3 h-3" />
                                          )}
                                          儲存
                                        </Button>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })()}

                            {(() => {
                              const files = parsePdfFiles(row.pdf_file);
                              const hasFiles = files.length > 0;
                              const isUploading = fileUploading[row.id] || false;
                              return (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className={`h-7 w-7 p-0 relative ${hasFiles ? "text-blue-500 hover:text-blue-700 hover:bg-blue-50" : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"}`}
                                      title={hasFiles ? `${files.length} 個文件` : "上傳文件"}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileIcon className="w-3.5 h-3.5" />}
                                      {hasFiles && (
                                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[11px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                                          {files.length}
                                        </span>
                                      )}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-0" align="end" onClick={(e) => e.stopPropagation()}>
                                    <div className="px-3 py-2 border-b bg-gray-50 rounded-t-md flex items-center justify-between">
                                      <p className="text-xs font-semibold text-gray-700">📎 附件文件 {hasFiles ? `(${files.length})` : ""}</p>
                                      <label className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded cursor-pointer transition-colors">
                                        <Upload className="w-3 h-3" />
                                        上傳
                                        <input
                                          type="file"
                                          multiple
                                          className="hidden"
                                          ref={(el) => { fileInputRefs.current[row.id] = el; }}
                                          onChange={(e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                              handleFileUpload("incomes", row.id, row.pdf_file, e.target.files);
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                    {hasFiles ? (
                                      <div className="max-h-60 overflow-y-auto divide-y">
                                        {files.map((f, idx) => {
                                          const fType = getFileIcon(f.filename);
                                          return (
                                            <div key={idx} className="px-3 py-2 hover:bg-gray-50 flex items-center gap-2 group">
                                              <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center ${fType === "pdf" ? "bg-red-50 text-red-500" : fType === "image" ? "bg-blue-50 text-blue-500" : "bg-gray-100 text-gray-500"}`}>
                                                {fType === "pdf" ? <FileText className="w-3.5 h-3.5" /> : <FileIcon className="w-3.5 h-3.5" />}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs text-gray-700 truncate" title={f.filename}>{f.filename}</p>
                                                <p className="text-[12px] text-gray-400">{fType === "pdf" ? "PDF" : fType === "image" ? "圖片" : "文件"}</p>
                                              </div>
                                              <div className="flex-shrink-0 flex gap-1">
                                                <a
                                                  href={f.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                                                  title="在新分頁開啟"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                                <a
                                                  href={f.url}
                                                  download={f.filename}
                                                  className="p-1 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors"
                                                  title="下載"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <Download className="w-3.5 h-3.5" />
                                                </a>
                                                <button
                                                  className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                  title="刪除"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteConfirm({ open: true, table: "incomes", rowId: row.id, existingPdfFile: row.pdf_file, urlToRemove: f.url, filename: f.filename });
                                                  }}
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="px-3 py-6 text-center">
                                        <FileIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                        <p className="text-xs text-gray-400">尚無文件，點擊上方「上傳」按鈕</p>
                                      </div>
                                    )}
                                    {isUploading && (
                                      <div className="px-3 py-2 border-t bg-blue-50 flex items-center gap-2">
                                        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                        <p className="text-[12px] text-blue-600">上傳中...</p>
                                      </div>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              );
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Expense Tab */}
        <TabsContent value="expense" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-bw-blue" />
              <span className="ml-2 text-sm text-gray-500">載入中...</span>
            </div>
          ) : error ? (
            <div className="text-center py-20 text-red-500 text-sm">{error}</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">暫無數據</div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <DueExpectedHeads sortable onSort={toggleSort} SortIcon={SortIcon} />
                    <TableHead className="text-xs">
                      <button className="flex items-center gap-1" onClick={() => toggleSort("date")}>
                        付款日期 <SortIcon field="date" />
                      </button>
                    </TableHead>
                    <TableHead className="text-xs">逾期天數</TableHead>
                    <TableHead className="text-xs">類別</TableHead>
                    <TableHead className="text-xs">項目經理</TableHead>
                    <TableHead className="text-xs">
                      <button className="flex items-center gap-1" onClick={() => toggleSort("project")}>
                        項目 <SortIcon field="project" />
                      </button>
                    </TableHead>
                    <TableHead className="text-xs text-right">
                      <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort("amount")}>
                        應付款項 <SortIcon field="amount" />
                      </button>
                    </TableHead>
                    <TableHead className="text-xs text-right">已付款項</TableHead>
                    <TableHead className="text-xs text-right">付款比率</TableHead>
                    <TableHead className="text-xs">
                      <button className="flex items-center gap-1" onClick={() => toggleSort("status")}>
                        付款狀態 <SortIcon field="status" />
                      </button>
                    </TableHead>
                    <TableHead className="text-xs text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pagedData as ExpenseRow[]).map((row) => {
                    const overdue = calcOverdueDays(row.due_date, null);
                    const ratio = calcCollectionRatio(row.installment_amount, row.paid_amount);
                    const ratioNum = row.installment_amount ? ((row.paid_amount || 0) / row.installment_amount) * 100 : 0;
                    return (
                      <TableRow
                        key={row.id}
                        className="hover:bg-gray-50/60 transition-colors cursor-pointer group"
                      >
                        <DueExpectedCells createdDate={row.created_date} dueDate={row.due_date} expectedPaymentDate={row.expected_payment_date} />
                        <TableCell>
                          <span className="text-xs text-gray-700">{fmtDateYmd(row.payment_date)}</span>
                        </TableCell>
                        <TableCell>
                          {overdue.isOverdue ? (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-[12px] px-1.5 py-0.5">
                              逾期{overdue.days}天
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[12px] px-1.5 py-0.5">
                              準時
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-600">{row.contract_type_label || row.type_display || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-700">{row.pm_name || row.real_creator_name || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <ProjectNameCell
                            name={row.project_name}
                            code={row.project_code}
                            status={row.project_status}
                            onClick={() => goToProject(row)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-medium text-gray-800 font-mono-num">
                            {fmtMoneyDecimal(row.installment_amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-gray-800 font-mono-num">
                            {fmtMoneyDecimal(row.paid_amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-medium ${ratioNum >= 100 ? "text-emerald-600" : ratioNum > 0 ? "text-amber-600" : "text-gray-400"}`}>
                            {ratio}
                          </span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {isAdminOrAbove ? (
                            <Select
                              value={row.payment_status || EXPENSE_STATUS_NONE}
                              onValueChange={(val) =>
                                updatePaymentStatus("expenses", row.id, val === EXPENSE_STATUS_NONE ? null : val)
                              }
                            >
                              <SelectTrigger className={`h-7 w-auto min-w-[140px] whitespace-nowrap [&>span]:truncate border text-[12px] px-2 py-0.5 font-medium ${getPaymentStatusStyle(row.payment_status)} ${statusUpdating[row.id] ? "opacity-50" : ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {expenseStatusOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[12px] font-medium ${opt.className}`}>
                                      {opt.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className={`inline-block h-7 leading-7 px-2 rounded border text-[12px] font-medium ${getPaymentStatusStyle(row.payment_status)}`}>
                              {row.payment_status || "未申請"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5 justify-center">
                            <AsanaLinkButton href={row.asana_link} />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRelatedExpenseTarget(row);
                                setRelatedDialogOpen(true);
                              }}
                              title="查看相關支出"
                            >
                              <Search className="w-3.5 h-3.5" />
                            </Button>
                            {(() => {
                              const remarkVal = (row as ExpenseRow).remark_t;
                              const hasRemark = !!(remarkVal && remarkVal.trim());
                              const editKey = row.id;
                              return (
                                <Popover onOpenChange={(open) => {
                                  if (open) {
                                    setRemarkEdits((prev) => ({ ...prev, [editKey]: remarkVal || "" }));
                                    setRemarkSaved((prev) => ({ ...prev, [editKey]: false }));
                                  }
                                }}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className={`h-7 w-7 p-0 relative ${hasRemark ? "text-amber-500 hover:text-amber-700 hover:bg-amber-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                                      title={hasRemark ? "編輯備註" : "新增備註"}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      {hasRemark && (
                                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
                                      )}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent 
                                    className="w-72 p-3" 
                                    side="bottom" 
                                    align="center"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-semibold text-gray-700">📝 備註 Remark</h4>
                                        {remarkSaved[editKey] && (
                                          <span className="text-xs text-green-600 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> 已儲存
                                          </span>
                                        )}
                                      </div>
                                      <Textarea
                                        value={remarkEdits[editKey] ?? remarkVal ?? ""}
                                        onChange={(e) => setRemarkEdits((prev) => ({ ...prev, [editKey]: e.target.value }))}
                                        placeholder="輸入備註..."
                                        className="min-h-[80px] text-sm resize-none"
                                        rows={3}
                                      />
                                      <div className="flex justify-end">
                                        <Button
                                          size="sm"
                                          className="h-7 px-3 gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemarkSave("expense", row.id);
                                          }}
                                          disabled={remarkSaving[editKey]}
                                        >
                                          {remarkSaving[editKey] ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <Send className="w-3 h-3" />
                                          )}
                                          儲存
                                        </Button>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })()}

                            {(() => {
                              const files = parsePdfFiles(row.pdf_file);
                              const hasFiles = files.length > 0;
                              const isUploading = fileUploading[row.id] || false;
                              return (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className={`h-7 w-7 p-0 relative ${hasFiles ? "text-blue-500 hover:text-blue-700 hover:bg-blue-50" : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"}`}
                                      title={hasFiles ? `${files.length} 個文件` : "上傳文件"}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileIcon className="w-3.5 h-3.5" />}
                                      {hasFiles && (
                                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[11px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                                          {files.length}
                                        </span>
                                      )}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-0" align="end" onClick={(e) => e.stopPropagation()}>
                                    <div className="px-3 py-2 border-b bg-gray-50 rounded-t-md flex items-center justify-between">
                                      <p className="text-xs font-semibold text-gray-700">📎 附件文件 {hasFiles ? `(${files.length})` : ""}</p>
                                      <label className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded cursor-pointer transition-colors">
                                        <Upload className="w-3 h-3" />
                                        上傳
                                        <input
                                          type="file"
                                          multiple
                                          className="hidden"
                                          ref={(el) => { fileInputRefs.current[row.id] = el; }}
                                          onChange={(e) => {
                                            if (e.target.files && e.target.files.length > 0) {
                                              handleFileUpload("expenses", row.id, row.pdf_file, e.target.files);
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                    {hasFiles ? (
                                      <div className="max-h-60 overflow-y-auto divide-y">
                                        {files.map((f, idx) => {
                                          const fType = getFileIcon(f.filename);
                                          return (
                                            <div key={idx} className="px-3 py-2 hover:bg-gray-50 flex items-center gap-2 group">
                                              <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center ${fType === "pdf" ? "bg-red-50 text-red-500" : fType === "image" ? "bg-blue-50 text-blue-500" : "bg-gray-100 text-gray-500"}`}>
                                                {fType === "pdf" ? <FileText className="w-3.5 h-3.5" /> : <FileIcon className="w-3.5 h-3.5" />}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs text-gray-700 truncate" title={f.filename}>{f.filename}</p>
                                                <p className="text-[12px] text-gray-400">{fType === "pdf" ? "PDF" : fType === "image" ? "圖片" : "文件"}</p>
                                              </div>
                                              <div className="flex-shrink-0 flex gap-1">
                                                <a
                                                  href={f.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                                                  title="在新分頁開啟"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                                <a
                                                  href={f.url}
                                                  download={f.filename}
                                                  className="p-1 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors"
                                                  title="下載"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <Download className="w-3.5 h-3.5" />
                                                </a>
                                                <button
                                                  className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                  title="刪除"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteConfirm({ open: true, table: "expenses", rowId: row.id, existingPdfFile: row.pdf_file, urlToRemove: f.url, filename: f.filename });
                                                  }}
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="px-3 py-6 text-center">
                                        <FileIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                        <p className="text-xs text-gray-400">尚無文件，點擊上方「上傳」按鈕</p>
                                      </div>
                                    )}
                                    {isUploading && (
                                      <div className="px-3 py-2 border-t bg-blue-50 flex items-center gap-2">
                                        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                        <p className="text-[12px] text-blue-600">上傳中...</p>
                                      </div>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              );
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-400">
            第 {page} / {totalPages} 頁（共 {totalItems} 條）
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page <= 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 w-7 p-0 text-xs ${page === pageNum ? "bg-bw-navy text-white" : ""}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Related Incomes Dialog ─── */}
      <Dialog open={relatedIncomeDialogOpen} onOpenChange={setRelatedIncomeDialogOpen}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b bg-gray-50/80">
            <DialogTitle className="flex items-center gap-3 text-base">
              <Search className="w-4 h-4 text-blue-500" />
              <span>相關收入列表</span>
              {relatedIncomeTarget && (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-normal">
                  共 {relatedIncomes.length} 筆
                </Badge>
              )}
            </DialogTitle>
            {relatedIncomeTarget && (
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="font-medium text-gray-700">項目:</span>
                  {relatedIncomeTarget.project_name || "-"}
                  {relatedIncomeTarget.project_code && (
                    <span className="text-gray-400">({relatedIncomeTarget.project_code})</span>
                  )}
                </span>
                <span className="w-px h-3 bg-gray-300 self-center" />
                <span className="flex items-center gap-1">
                  <span className="font-medium text-gray-700">合同類別:</span>
                  {relatedIncomeTarget.contract_type_label || relatedIncomeTarget.type_display || "-"}
                </span>
              </div>
            )}
          </DialogHeader>
          <ScrollArea className="max-h-[calc(85vh-120px)]">
            {relatedIncomesLoading ? (
              <div className="text-center py-16 text-gray-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
              </div>
            ) : relatedIncomes.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                沒有找到相關收入記錄
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <DueExpectedHeads />
                      <TableHead className="text-xs">收款日期</TableHead>
                      <TableHead className="text-xs">逾期天數</TableHead>
                      <TableHead className="text-xs">類別</TableHead>
                      <TableHead className="text-xs">項目經理</TableHead>
                      <TableHead className="text-xs">項目</TableHead>
                      <TableHead className="text-xs text-right">應收款項</TableHead>
                      <TableHead className="text-xs text-right">已收款項</TableHead>
                      <TableHead className="text-xs text-right">收款比率</TableHead>
                      <TableHead className="text-xs">收款狀態</TableHead>
                      <TableHead className="text-xs">審批狀態</TableHead>
                      <TableHead className="text-xs text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatedIncomes.map((row) => {
                      const overdue = calcOverdueDays(row.due_date, null);
                      const ratio = calcCollectionRatio(row.income_amount, row.payment_amount);
                      const ratioNum = row.income_amount ? ((row.payment_amount || 0) / row.income_amount) * 100 : 0;
                      const isTarget = row.id === relatedIncomeTarget?.id;
                      return (
                        <TableRow
                          key={row.id}
                          className={`hover:bg-gray-50/60 transition-colors group ${isTarget ? "bg-blue-50/60 ring-1 ring-inset ring-blue-200" : ""}`}
                        >
                          <DueExpectedCells createdDate={row.created_date} dueDate={row.due_date} expectedPaymentDate={row.expected_payment_date} />
                          <TableCell>
                            <span className="text-xs text-gray-700">{fmtDateYmd(row.receive_date)}</span>
                          </TableCell>
                          <TableCell>
                            {overdue.isOverdue ? (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-[12px] px-1.5 py-0.5">
                                逾期{overdue.days}天
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[12px] px-1.5 py-0.5">
                                準時
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-gray-600">{row.contract_type_label || row.type_display || "-"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-gray-700">{row.pm_name || row.real_creator_name || "-"}</span>
                          </TableCell>
                          <TableCell>
                            <ProjectNameCell
                              name={row.project_name}
                              code={row.project_code}
                              status={row.project_status}
                              maxWidthClass="max-w-[160px]"
                              onClick={() => { setRelatedIncomeDialogOpen(false); goToProject(row); }}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm font-medium text-gray-800 font-mono-num">
                              {fmtMoneyDecimal(row.income_amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm text-gray-800 font-mono-num">
                              {fmtMoneyDecimal(row.payment_amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`text-sm font-medium ${ratioNum >= 100 ? "text-emerald-600" : ratioNum > 0 ? "text-amber-600" : "text-gray-400"}`}>
                              {ratio}
                            </span>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {isAdminOrAbove ? (
                              <Select
                                value={row.payment_status || INCOME_STATUS_NONE}
                                onValueChange={(val) =>
                                  updatePaymentStatus("incomes", row.id, val === INCOME_STATUS_NONE ? null : val)
                                }
                              >
                                <SelectTrigger className={`h-7 w-auto min-w-[140px] whitespace-nowrap [&>span]:truncate border text-[12px] px-2 py-0.5 font-medium ${getPaymentStatusStyle(row.payment_status)} ${statusUpdating[row.id] ? "opacity-50" : ""}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {incomeStatusOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[12px] font-medium ${opt.className}`}>
                                        {opt.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className={`inline-block h-7 leading-7 px-2 rounded border text-[12px] font-medium ${getPaymentStatusStyle(row.payment_status)}`}>
                                {row.payment_status || "未申請"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getApprovalBadge(
                              isIncomeDecisionStatus(row.payment_status) ? true : null,
                              row.approve_creator_name,
                              row.approved_date
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-0.5 justify-center">
                              {/* Remark popover */}
                              {(() => {
                                const remarkVal = row.remark;
                                const hasRemark = !!(remarkVal && remarkVal.trim());
                                const editKey = row.id;
                                return (
                                  <Popover onOpenChange={(open) => {
                                    if (open) {
                                      setRemarkEdits((prev) => ({ ...prev, [editKey]: remarkVal || "" }));
                                      setRemarkSaved((prev) => ({ ...prev, [editKey]: false }));
                                    }
                                  }}>
                                    <PopoverTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className={`h-7 w-7 p-0 relative ${hasRemark ? "text-amber-500 hover:text-amber-700 hover:bg-amber-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                                        title={hasRemark ? "編輯備註" : "新增備註"}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        {hasRemark && (
                                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      className="w-72 p-3"
                                      side="bottom"
                                      align="center"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <h4 className="text-xs font-semibold text-gray-700">📝 備註 Remark</h4>
                                          {remarkSaved[editKey] && (
                                            <span className="text-xs text-green-600 flex items-center gap-1">
                                              <Check className="w-3 h-3" /> 已儲存
                                            </span>
                                          )}
                                        </div>
                                        <Textarea
                                          value={remarkEdits[editKey] ?? remarkVal ?? ""}
                                          onChange={(e) => setRemarkEdits((prev) => ({ ...prev, [editKey]: e.target.value }))}
                                          placeholder="輸入備註..."
                                          className="min-h-[80px] text-sm resize-none"
                                          rows={3}
                                        />
                                        <div className="flex justify-end">
                                          <Button
                                            size="sm"
                                            className="h-7 px-3 gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemarkSave("income", row.id);
                                            }}
                                            disabled={remarkSaving[editKey]}
                                          >
                                            {remarkSaving[editKey] ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <Send className="w-3 h-3" />
                                            )}
                                            儲存
                                          </Button>
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                );
                              })()}
                              {/* File popover */}
                              {(() => {
                                const files = parsePdfFiles(row.pdf_file);
                                const hasFiles = files.length > 0;
                                const isUploading = fileUploading[row.id] || false;
                                return (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className={`h-7 w-7 p-0 relative ${hasFiles ? "text-blue-500 hover:text-blue-700 hover:bg-blue-50" : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"}`}
                                        title={hasFiles ? `${files.length} 個文件` : "上傳文件"}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileIcon className="w-3.5 h-3.5" />}
                                        {hasFiles && (
                                          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[11px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                                            {files.length}
                                          </span>
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-0" align="end" onClick={(e) => e.stopPropagation()}>
                                      <div className="px-3 py-2 border-b bg-gray-50 rounded-t-md flex items-center justify-between">
                                        <p className="text-xs font-semibold text-gray-700">📎 附件文件 {hasFiles ? `(${files.length})` : ""}</p>
                                        <label className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded cursor-pointer transition-colors">
                                          <Upload className="w-3 h-3" />
                                          上傳
                                          <input
                                            type="file"
                                            multiple
                                            className="hidden"
                                            ref={(el) => { fileInputRefs.current[`dialog_income_${row.id}`] = el; }}
                                            onChange={(e) => {
                                              if (e.target.files && e.target.files.length > 0) {
                                                handleFileUpload("incomes", row.id, row.pdf_file, e.target.files);
                                              }
                                            }}
                                          />
                                        </label>
                                      </div>
                                      {hasFiles ? (
                                        <div className="max-h-60 overflow-y-auto divide-y">
                                          {files.map((f, idx) => {
                                            const fType = getFileIcon(f.filename);
                                            return (
                                              <div key={idx} className="px-3 py-2 hover:bg-gray-50 flex items-center gap-2 group">
                                                <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center ${fType === "pdf" ? "bg-red-50 text-red-500" : fType === "image" ? "bg-blue-50 text-blue-500" : "bg-gray-100 text-gray-500"}`}>
                                                  {fType === "pdf" ? <FileText className="w-3.5 h-3.5" /> : <FileIcon className="w-3.5 h-3.5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-xs text-gray-700 truncate" title={f.filename}>{f.filename}</p>
                                                  <p className="text-[12px] text-gray-400">{fType === "pdf" ? "PDF" : fType === "image" ? "圖片" : "文件"}</p>
                                                </div>
                                                <div className="flex-shrink-0 flex gap-1">
                                                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors" title="在新分頁開啟">
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                  </a>
                                                  <a href={f.url} download={f.filename} className="p-1 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors" title="下載">
                                                    <Download className="w-3.5 h-3.5" />
                                                  </a>
                                                  <button
                                                    className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="刪除"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setDeleteConfirm({ open: true, table: "incomes", rowId: row.id, existingPdfFile: row.pdf_file, urlToRemove: f.url, filename: f.filename });
                                                    }}
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="px-3 py-6 text-center">
                                          <FileIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                          <p className="text-xs text-gray-400">尚無文件，點擊上方「上傳」按鈕</p>
                                        </div>
                                      )}
                                      {isUploading && (
                                        <div className="px-3 py-2 border-t bg-blue-50 flex items-center gap-2">
                                          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                          <p className="text-[12px] text-blue-600">上傳中...</p>
                                        </div>
                                      )}
                                    </PopoverContent>
                                  </Popover>
                                );
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Related incomes summary */}
            {relatedIncomes.length > 0 && (() => {
              const totalReceivable = relatedIncomes.reduce((sum, i) => sum + (i.income_amount || 0), 0);
              const totalReceived = relatedIncomes.reduce((sum, i) => sum + (i.payment_amount || 0), 0);
              const totalOutstanding = relatedIncomes.reduce((sum, i) => sum + (i.outstanding || 0), 0);
              const receivePercent = totalReceivable > 0 ? Math.min((totalReceived / totalReceivable) * 100, 100) : 0;
              return (
                <div className="px-6 py-3 border-t bg-gray-50/80 space-y-3">
                  <div className="flex flex-wrap gap-6 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">合計應收:</span>
                      <span className="font-semibold text-gray-800 font-mono-num">
                        {fmtMoneyDecimal(totalReceivable)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">合計已收:</span>
                      <span className="font-semibold text-gray-800 font-mono-num">
                        {fmtMoneyDecimal(totalReceived)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">合計欠款:</span>
                      <span className="font-semibold text-red-600 font-mono-num">
                        {fmtMoneyDecimal(totalOutstanding)}
                      </span>
                    </div>
                  </div>
                  {/* Total collection progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">整體收款進度</span>
                      <span className="font-semibold font-mono-num" style={{ color: receivePercent >= 100 ? "#10B981" : receivePercent >= 50 ? "#3B82F6" : "#F59E0B" }}>
                        {receivePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${receivePercent}%`,
                          background: receivePercent >= 100
                            ? "linear-gradient(90deg, #10B981, #059669)"
                            : receivePercent >= 50
                            ? "linear-gradient(90deg, #3B82F6, #2563EB)"
                            : "linear-gradient(90deg, #F59E0B, #D97706)"}}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ─── Related Expenses Dialog ─── */}
      <Dialog open={relatedDialogOpen} onOpenChange={setRelatedDialogOpen}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b bg-gray-50/80">
            <DialogTitle className="flex items-center gap-3 text-base">
              <Search className="w-4 h-4 text-blue-500" />
              <span>相關支出列表</span>
              {relatedExpenseTarget && (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-normal">
                  共 {relatedExpenses.length} 筆
                </Badge>
              )}
            </DialogTitle>
            {relatedExpenseTarget && (
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="font-medium text-gray-700">項目:</span>
                  {relatedExpenseTarget.project_name || "-"}
                  {relatedExpenseTarget.project_code && (
                    <span className="text-gray-400">({relatedExpenseTarget.project_code})</span>
                  )}
                </span>
                <span className="w-px h-3 bg-gray-300 self-center" />
                <span className="flex items-center gap-1">
                  <span className="font-medium text-gray-700">供應商:</span>
                  {relatedExpenseTarget.supplier_name || "-"}
                </span>
                <span className="w-px h-3 bg-gray-300 self-center" />
                <span className="flex items-center gap-1">
                  <span className="font-medium text-gray-700">合同類別:</span>
                  {relatedExpenseTarget.contract_type_label || relatedExpenseTarget.type_display || "-"}
                </span>
              </div>
            )}
          </DialogHeader>
          <ScrollArea className="max-h-[calc(85vh-120px)]">
            {relatedExpensesLoading ? (
              <div className="text-center py-16 text-gray-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
              </div>
            ) : relatedExpenses.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                沒有找到相關支出記錄
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <DueExpectedHeads />
                      <TableHead className="text-xs">付款日期</TableHead>
                      <TableHead className="text-xs">逾期天數</TableHead>
                      <TableHead className="text-xs">類別</TableHead>
                      <TableHead className="text-xs">項目經理</TableHead>
                      <TableHead className="text-xs">項目</TableHead>
                      <TableHead className="text-xs">供應商</TableHead>
                      <TableHead className="text-xs text-right">應付款項</TableHead>
                      <TableHead className="text-xs text-right">已付款項</TableHead>
                      <TableHead className="text-xs text-right">付款比率</TableHead>
                      <TableHead className="text-xs">付款狀態</TableHead>
                      <TableHead className="text-xs text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatedExpenses.map((row) => {
                      const overdue = calcOverdueDays(row.due_date, null);
                      const ratio = calcCollectionRatio(row.installment_amount, row.paid_amount);
                      const ratioNum = row.installment_amount ? ((row.paid_amount || 0) / row.installment_amount) * 100 : 0;
                      const isTarget = row.id === relatedExpenseTarget?.id;
                      return (
                        <TableRow
                          key={row.id}
                          className={`hover:bg-gray-50/60 transition-colors group ${isTarget ? "bg-blue-50/60 ring-1 ring-inset ring-blue-200" : ""}`}
                        >
                          <DueExpectedCells createdDate={row.created_date} dueDate={row.due_date} expectedPaymentDate={row.expected_payment_date} />
                          <TableCell>
                            <span className="text-xs text-gray-700">{fmtDateYmd(row.payment_date)}</span>
                          </TableCell>
                          <TableCell>
                            {overdue.isOverdue ? (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-[12px] px-1.5 py-0.5">
                                逾期{overdue.days}天
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[12px] px-1.5 py-0.5">
                                準時
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-gray-600">{row.contract_type_label || row.type_display || "-"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-gray-700">{row.pm_name || row.real_creator_name || "-"}</span>
                          </TableCell>
                          <TableCell>
                            <ProjectNameCell
                              name={row.project_name}
                              code={row.project_code}
                              status={row.project_status}
                              maxWidthClass="max-w-[160px]"
                              onClick={() => { setRelatedDialogOpen(false); goToProject(row); }}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-gray-700 truncate max-w-[120px] block">{row.supplier_name || "-"}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm font-medium text-gray-800 font-mono-num">
                              {fmtMoneyDecimal(row.installment_amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm text-gray-800 font-mono-num">
                              {fmtMoneyDecimal(row.paid_amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`text-sm font-medium ${ratioNum >= 100 ? "text-emerald-600" : ratioNum > 0 ? "text-amber-600" : "text-gray-400"}`}>
                              {ratio}
                            </span>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {isAdminOrAbove ? (
                              <Select
                                value={row.payment_status || EXPENSE_STATUS_NONE}
                                onValueChange={(val) =>
                                  updatePaymentStatus("expenses", row.id, val === EXPENSE_STATUS_NONE ? null : val)
                                }
                              >
                                <SelectTrigger className={`h-7 w-auto min-w-[140px] whitespace-nowrap [&>span]:truncate border text-[12px] px-2 py-0.5 font-medium ${getPaymentStatusStyle(row.payment_status)} ${statusUpdating[row.id] ? "opacity-50" : ""}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseStatusOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[12px] font-medium ${opt.className}`}>
                                        {opt.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className={`inline-block h-7 leading-7 px-2 rounded border text-[12px] font-medium ${getPaymentStatusStyle(row.payment_status)}`}>
                                {row.payment_status || "未申請"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-0.5 justify-center">
                              {/* Remark popover */}
                              {(() => {
                                const remarkVal = row.remark_t;
                                const hasRemark = !!(remarkVal && remarkVal.trim());
                                const editKey = `dialog_${row.id}`;
                                return (
                                  <Popover onOpenChange={(open) => {
                                    if (open) {
                                      setRemarkEdits((prev) => ({ ...prev, [editKey]: remarkVal || "" }));
                                      setRemarkSaved((prev) => ({ ...prev, [editKey]: false }));
                                    }
                                  }}>
                                    <PopoverTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className={`h-7 w-7 p-0 relative ${hasRemark ? "text-amber-500 hover:text-amber-700 hover:bg-amber-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                                        title={hasRemark ? "編輯備註" : "新增備註"}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        {hasRemark && (
                                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      className="w-72 p-3"
                                      side="bottom"
                                      align="center"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <h4 className="text-xs font-semibold text-gray-700">📝 備註 Remark</h4>
                                          {remarkSaved[editKey] && (
                                            <span className="text-xs text-green-600 flex items-center gap-1">
                                              <Check className="w-3 h-3" /> 已儲存
                                            </span>
                                          )}
                                        </div>
                                        <Textarea
                                          value={remarkEdits[editKey] ?? remarkVal ?? ""}
                                          onChange={(e) => setRemarkEdits((prev) => ({ ...prev, [editKey]: e.target.value }))}
                                          placeholder="輸入備註..."
                                          className="min-h-[80px] text-sm resize-none"
                                          rows={3}
                                        />
                                        <div className="flex justify-end">
                                          <Button
                                            size="sm"
                                            className="h-7 px-3 gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemarkSave("expense", row.id);
                                            }}
                                            disabled={remarkSaving[editKey]}
                                          >
                                            {remarkSaving[editKey] ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <Send className="w-3 h-3" />
                                            )}
                                            儲存
                                          </Button>
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                );
                              })()}
                              {/* File popover */}
                              {(() => {
                                const files = parsePdfFiles(row.pdf_file);
                                const hasFiles = files.length > 0;
                                const isUploading = fileUploading[row.id] || false;
                                return (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className={`h-7 w-7 p-0 relative ${hasFiles ? "text-blue-500 hover:text-blue-700 hover:bg-blue-50" : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"}`}
                                        title={hasFiles ? `${files.length} 個文件` : "上傳文件"}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileIcon className="w-3.5 h-3.5" />}
                                        {hasFiles && (
                                          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[11px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                                            {files.length}
                                          </span>
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-0" align="end" onClick={(e) => e.stopPropagation()}>
                                      <div className="px-3 py-2 border-b bg-gray-50 rounded-t-md flex items-center justify-between">
                                        <p className="text-xs font-semibold text-gray-700">📎 附件文件 {hasFiles ? `(${files.length})` : ""}</p>
                                        <label className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded cursor-pointer transition-colors">
                                          <Upload className="w-3 h-3" />
                                          上傳
                                          <input
                                            type="file"
                                            multiple
                                            className="hidden"
                                            ref={(el) => { fileInputRefs.current[`dialog_expense_${row.id}`] = el; }}
                                            onChange={(e) => {
                                              if (e.target.files && e.target.files.length > 0) {
                                                handleFileUpload("expenses", row.id, row.pdf_file, e.target.files);
                                              }
                                            }}
                                          />
                                        </label>
                                      </div>
                                      {hasFiles ? (
                                        <div className="max-h-60 overflow-y-auto divide-y">
                                          {files.map((f, idx) => {
                                            const fType = getFileIcon(f.filename);
                                            return (
                                              <div key={idx} className="px-3 py-2 hover:bg-gray-50 flex items-center gap-2 group">
                                                <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center ${fType === "pdf" ? "bg-red-50 text-red-500" : fType === "image" ? "bg-blue-50 text-blue-500" : "bg-gray-100 text-gray-500"}`}>
                                                  {fType === "pdf" ? <FileText className="w-3.5 h-3.5" /> : <FileIcon className="w-3.5 h-3.5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-xs text-gray-700 truncate" title={f.filename}>{f.filename}</p>
                                                  <p className="text-[12px] text-gray-400">{fType === "pdf" ? "PDF" : fType === "image" ? "圖片" : "文件"}</p>
                                                </div>
                                                <div className="flex-shrink-0 flex gap-1">
                                                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors" title="在新分頁開啟">
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                  </a>
                                                  <a href={f.url} download={f.filename} className="p-1 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors" title="下載">
                                                    <Download className="w-3.5 h-3.5" />
                                                  </a>
                                                  <button
                                                    className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    title="刪除"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setDeleteConfirm({ open: true, table: "expenses", rowId: row.id, existingPdfFile: row.pdf_file, urlToRemove: f.url, filename: f.filename });
                                                    }}
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="px-3 py-6 text-center">
                                          <FileIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                          <p className="text-xs text-gray-400">尚無文件，點擊上方「上傳」按鈕</p>
                                        </div>
                                      )}
                                      {isUploading && (
                                        <div className="px-3 py-2 border-t bg-blue-50 flex items-center gap-2">
                                          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                          <p className="text-[12px] text-blue-600">上傳中...</p>
                                        </div>
                                      )}
                                    </PopoverContent>
                                  </Popover>
                                );
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Related expenses summary */}
            {relatedExpenses.length > 0 && (() => {
              const totalPayable = relatedExpenses.reduce((sum, e) => sum + (e.installment_amount || 0), 0);
              const totalPaid = relatedExpenses.reduce((sum, e) => sum + (e.paid_amount || 0), 0);
              const totalOutstanding = relatedExpenses.reduce((sum, e) => sum + (e.outstanding || 0), 0);
              const payPercent = totalPayable > 0 ? Math.min((totalPaid / totalPayable) * 100, 100) : 0;
              return (
                <div className="px-6 py-3 border-t bg-gray-50/80 space-y-3">
                  <div className="flex flex-wrap gap-6 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">合計應付:</span>
                      <span className="font-semibold text-gray-800 font-mono-num">
                        {fmtMoneyDecimal(totalPayable)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">合計已付:</span>
                      <span className="font-semibold text-gray-800 font-mono-num">
                        {fmtMoneyDecimal(totalPaid)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">合計欠款:</span>
                      <span className="font-semibold text-red-600 font-mono-num">
                        {fmtMoneyDecimal(totalOutstanding)}
                      </span>
                    </div>
                  </div>
                  {/* Total payment progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">整體付款進度</span>
                      <span className="font-semibold font-mono-num" style={{ color: payPercent >= 100 ? "#10B981" : payPercent >= 50 ? "#3B82F6" : "#F59E0B" }}>
                        {payPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${payPercent}%`,
                          background: payPercent >= 100
                            ? "linear-gradient(90deg, #10B981, #059669)"
                            : payPercent >= 50
                            ? "linear-gradient(90deg, #3B82F6, #2563EB)"
                            : "linear-gradient(90deg, #F59E0B, #D97706)"}}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* File Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除文件</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除文件「<span className="font-medium text-gray-700">{deleteConfirm.filename}</span>」嗎？此操作無法撤銷。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                handleFileDelete(
                  deleteConfirm.table,
                  deleteConfirm.rowId,
                  deleteConfirm.existingPdfFile,
                  deleteConfirm.urlToRemove
                );
              }}
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
