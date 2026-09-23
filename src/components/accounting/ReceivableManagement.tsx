"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Filter,
  Receipt,
  ArrowUpDown,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  DollarSign,
  TrendingUp,
  X,
  ChevronRight as ChevronRightIcon,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Shield,
  CalendarIcon} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { useAuth } from "@/hooks/use-auth";
import { useIsSuperAdmin } from "@/hooks/use-report-staff-lock";
import {
  getEffectiveStatusRule,
  PROJECT_STATUS_OPTIONS,
  projectStatusFilterLabel,
} from "@/lib/project-status-rules";
import { AsanaLinkButton } from "@/components/ui/asana-link-button";
import { updateIncome } from "@/lib/data/finance";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";
import { ReportSourceToggle } from "@/components/reports/ReportDateRangeBar";
import { OutstandingRemarksPanel } from "@/components/accounting/OutstandingRemarksPanel";

export type ReceivableMode = "accounting" | "personal-overdue";

interface StaffOption {
  id: string;
  name: string;
  status: string | null;
}

const INACTIVE_STRIKE: React.CSSProperties = {
  textDecoration: "line-through",
  color: "#9ca3af",
};

export interface ReceivableManagementProps {
  /**
   * accounting — /receivable (full list + accounting panels)
   * personal-overdue — /individual-reports/overdue-receivable
   *   (outstanding > 0 incomes scoped to current staff as BV handler or Main PM;
   *    UI filter: all / expired / not expired)
   */
  mode?: ReceivableMode;
}

type ExpiryFilter = "all" | "expired" | "not_expired";

// ─── Types ───

interface IncomeRow {
  id: string;
  income_amount: number | null;
  payment_amount: number | null;
  outstanding: number | null;
  bad_debts: number | null;
  status: string | null;
  payment_status: string | null;
  invoice_number: string | null;
  type_display: string | null;
  contract_type_label: string | null;
  due_date: string | null;
  receive_date: string | null;
  created_date: string | null;
  remark: string | null;
  outstanding_remark: string | null;
  date_remark: string | null;
  real_creator_name: string | null;
  project_name: string | null;
  project_code: string | null;
  project_id: string | null;
  pm_name: string | null;
  bw_type: "BWA" | "BWF";
  n_contract_type_id: string | null;
  e_outstanding_date: string | null;
  expected_payment_date: string | null;
  project_status: string | null;
  financial_year: string | null;
  asana_link: string | null;
}

interface GroupedProject {
  key: string;
  project_name: string | null;
  project_code: string | null;
  project_id: string | null;
  pm_name: string | null;
  bw_type: "BWA" | "BWF";
  contract_type_label: string | null;
  n_contract_type_id: string | null;
  project_status: string | null;
  financial_year: string | null;
  e_outstanding_date: string | null;
  earliest_expected_payment_date: string | null;
  total_outstanding: number;
  total_income_amount: number;
  total_payment_amount: number;
  income_count: number;
  collection_ratio: number;
  earliest_due_date: string | null;
  remark_count: number;
  outstanding_remark_count: number;
  asana_link: string | null;
}

type SortField = "pm" | "project" | "outstanding" | "income" | "payment" | "ratio" | "count" | "due_date" | "days_until_due";
type SortDir = "asc" | "desc";

// ─── Helpers ───

function fmtDate(d: string | null): string {
  if (!d) return "-";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("zh-HK", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return d;
  }
}

function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtDateShort(d: string | null): string | null {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return toDateOnly(dt);
  } catch {
    return null;
  }
}

function fmtDateYmd(d: string | null): string {
  const short = fmtDateShort(d);
  return short ? short.replace(/-/g, "/") : "-";
}

function earlierDate(current: string | null, candidate: string | null): string | null {
  if (!candidate) return current;
  const candidateTime = new Date(candidate).getTime();
  if (isNaN(candidateTime)) return current;
  if (!current) return candidate;
  const currentTime = new Date(current).getTime();
  if (isNaN(currentTime) || candidateTime < currentTime) return candidate;
  return current;
}

function calcDaysUntilDue(dueDate: string | null): { days: number; label: string; isOverdue: boolean } {
  if (!dueDate) return { days: 0, label: "-", isOverdue: false };
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return { days: 0, label: "-", isOverdue: false };
  const now = new Date();
  const diff = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { days: Math.abs(diff), label: `逾期${Math.abs(diff)}天`, isOverdue: true };
  if (diff === 0) return { days: 0, label: "今天到期", isOverdue: false };
  return { days: diff, label: `${diff}天`, isOverdue: false };
}

// ─── Paginated fetch helper: fetches ALL rows from a table without limits ───
const PAGE_SIZE = 1000;

async function fetchAllRows(
  supabase: any,
  table: string,
  selectColumns: string,
  options?: {
    filters?: Array<{ column: string; operator: string; value: any }>;
    order?: { column: string; ascending: boolean };
  }
): Promise<{ data: any[]; error: any }> {
  const allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(selectColumns);

    // Apply filters
    if (options?.filters) {
      for (const f of options.filters) {
        if (f.operator === "gt") query = query.gt(f.column, f.value);
        else if (f.operator === "lt") query = query.lt(f.column, f.value);
        else if (f.operator === "eq") query = query.eq(f.column, f.value);
        else if (f.operator === "neq") query = query.neq(f.column, f.value);
        else if (f.operator === "in") query = query.in(f.column, f.value);
      }
    }

    // Apply ordering
    if (options?.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending });
    }

    // Apply pagination range
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, error } = await query;

    if (error) {
      return { data: allData, error };
    }

    if (data && data.length > 0) {
      allData.push(...data);
      from += data.length;
      // If we got fewer rows than PAGE_SIZE, we've reached the end
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return { data: allData, error: null };
}

/**
 * Fetch all incomes linked to the given project refs.
 * Queries UUID FKs (project_id / bwf_project_id) and optional legacy TEXT columns.
 */
async function fetchIncomesByProjectIds(
  supabase: any,
  projectIds: string[],
  legacyRefs: string[] = []
): Promise<{ data: any[]; error: any }> {
  if (projectIds.length === 0 && legacyRefs.length === 0) {
    return { data: [], error: null };
  }

  const byId = new Map<string, any>();
  const BATCH = 100;
  const order = { column: "created_date", ascending: false };

  const mergeBatch = async (column: string, ids: string[]) => {
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const res = await fetchAllRows(supabase, "incomes", "*", {
        filters: [{ column, operator: "in", value: batch }],
        order,
      });
      if (res.error) return res.error;
      for (const row of res.data) if (row?.id) byId.set(row.id, row);
    }
    return null;
  };

  for (const column of ["project_id", "bwf_project_id"] as const) {
    const err = await mergeBatch(column, projectIds);
    if (err) return { data: Array.from(byId.values()), error: err };
  }
  if (legacyRefs.length > 0) {
    for (const column of ["project", "bwf_project"] as const) {
      const err = await mergeBatch(column, legacyRefs);
      if (err) return { data: Array.from(byId.values()), error: err };
    }
  }

  return { data: Array.from(byId.values()), error: null };
}

function incomeGroupKey(projectId: string | null, contractTypeId: string | null): string {
  return `${projectId || "__no_project__"}::${contractTypeId || "__no_contract_type__"}`;
}

function formatIncomeContractLabel(
  contractTypeLabel: string | null,
  invoiceNumber: string | null
): string | null {
  if (!contractTypeLabel) return null;
  if (!invoiceNumber) return contractTypeLabel;
  return `${contractTypeLabel} #${invoiceNumber}`;
}

function calcCollectionRatio(payment: number | null, income: number | null): string {
  if (!income || income === 0) return "-";
  const ratio = ((payment || 0) / income) * 100;
  return `${ratio.toFixed(1)}%`;
}

// ─── CRM Status Badge Component ───

function CRMStatusBadge({ group, supabase }: { group: GroupedProject; supabase: any }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch current CRM status from the first outstanding income in this group
  useEffect(() => {
    async function fetchStatus() {
      if (!group.project_id) return;
      let query = supabase.from("incomes").select("crm_status").gt("outstanding", 0);
      query = query.or(`project_id.eq.${group.project_id},project.eq.${group.project_id},bwf_project.eq.${group.project_id},bwf_project_id.eq.${group.project_id}`);
      if (group.n_contract_type_id) {
        query = query.eq("n_contract_type_id", group.n_contract_type_id);
      }
      const { data } = await query.not("crm_status", "is", null).limit(1);
      if (data && data.length > 0) {
        setStatus(data[0].crm_status);
      }
    }
    fetchStatus();
  }, [group.project_id, group.n_contract_type_id, supabase]);

  const handleChange = async (newStatus: string) => {
    setLoading(true);
    setStatus(newStatus === "none" ? null : newStatus);
    try {
      // Update all outstanding incomes in this group
      let query = supabase.from("incomes").update({ crm_status: newStatus === "none" ? null : newStatus }).gt("outstanding", 0);
      query = query.or(`project_id.eq.${group.project_id},project.eq.${group.project_id},bwf_project.eq.${group.project_id},bwf_project_id.eq.${group.project_id}`);
      if (group.n_contract_type_id) {
        query = query.eq("n_contract_type_id", group.n_contract_type_id);
      }
      await query;
    } catch (err) {
      console.error("Failed to update CRM status:", err);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    Normal: { label: "Normal", className: "border-emerald-300 text-emerald-700 bg-emerald-50", icon: <ShieldCheck className="w-3 h-3" /> },
    "In Risk": { label: "In Risk", className: "border-amber-300 text-amber-700 bg-amber-50", icon: <Shield className="w-3 h-3" /> },
    Danger: { label: "Danger", className: "border-red-300 text-red-700 bg-red-50", icon: <ShieldAlert className="w-3 h-3" /> }};

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={status || "none"} onValueChange={handleChange} disabled={loading}>
        <SelectTrigger className={`h-6 w-[100px] text-[12px] px-1.5 border ${status && statusConfig[status] ? statusConfig[status].className : "border-gray-200 text-gray-400"}`}>
          <SelectValue placeholder="-" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-xs text-gray-400">未設定</span>
          </SelectItem>
          <SelectItem value="Normal">
            <span className="flex items-center gap-1 text-xs text-emerald-700">
              <ShieldCheck className="w-3 h-3" /> Normal
            </span>
          </SelectItem>
          <SelectItem value="In Risk">
            <span className="flex items-center gap-1 text-xs text-amber-700">
              <Shield className="w-3 h-3" /> In Risk
            </span>
          </SelectItem>
          <SelectItem value="Danger">
            <span className="flex items-center gap-1 text-xs text-red-700">
              <ShieldAlert className="w-3 h-3" /> Danger
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Expected Date Picker Component ───

function ExpectedDatePicker({
  group,
  supabase,
  onUpdate}: {
  group: GroupedProject;
  supabase: any;
  onUpdate: (newDate: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const savedDate = group.e_outstanding_date ? new Date(group.e_outstanding_date) : undefined;
  const placeholderDate = !savedDate && group.earliest_expected_payment_date
    ? new Date(group.earliest_expected_payment_date)
    : undefined;
  const displayText = savedDate
    ? fmtDateShort(group.e_outstanding_date)
    : fmtDateShort(group.earliest_expected_payment_date) || "未設定";

  const handleDateSelect = async (date: Date | undefined) => {
    if (!group.project_id) return;
    setSaving(true);
    const newDateStr = date ? toDateOnly(date) : null;

    try {
      const { error } = await supabase
        .from("bwa_projects")
        .update({ e_outstanding_date: newDateStr })
        .eq("id", group.project_id);
      if (error) throw error;
      onUpdate(newDateStr);
    } catch (err) {
      console.error("Failed to update e_outstanding_date:", err);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await handleDateSelect(undefined);
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`flex items-center gap-1 h-6 px-1.5 text-[12px] rounded border transition-colors ${
              savedDate
                ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                : "border-gray-200 text-gray-400 hover:bg-gray-50"
            } ${saving ? "opacity-50" : ""}`}
            disabled={saving}
          >
            <CalendarIcon className="w-3 h-3" />
            {displayText}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-2">
            <Calendar
              mode="single"
              selected={savedDate}
              defaultMonth={savedDate || placeholderDate}
              onSelect={handleDateSelect}
              initialFocus
            />
            {savedDate && (
              <div className="flex justify-end px-2 pb-2">
                <button
                  className="text-[12px] text-red-500 hover:text-red-700 underline"
                  onClick={handleClear}
                >
                  清除日期
                </button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function IncomeExpectedDatePicker({
  row,
  onUpdate,
}: {
  row: IncomeRow;
  onUpdate: (newDate: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentDate = row.expected_payment_date ? new Date(row.expected_payment_date) : undefined;

  const { staff } = useAuth();

  const handleDateSelect = async (date: Date | undefined) => {
    setSaving(true);
    const newDateStr = date ? toDateOnly(date) : null;

    try {
      const result = await updateIncome(row.id, { expected_payment_date: newDateStr }, staff?.id);
      if (!result.success) throw new Error(result.error || "updateIncome failed");
      onUpdate(newDateStr);
    } catch (err) {
      console.error("Failed to update expected_payment_date:", err);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await handleDateSelect(undefined);
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`flex items-center gap-1 h-6 px-1.5 text-[12px] rounded border transition-colors ${
              currentDate
                ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                : "border-gray-200 text-gray-400 hover:bg-gray-50"
            } ${saving ? "opacity-50" : ""}`}
            disabled={saving}
          >
            <CalendarIcon className="w-3 h-3" />
            {currentDate ? fmtDateShort(row.expected_payment_date) : "未設定"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-2">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={handleDateSelect}
              initialFocus
            />
            {currentDate && (
              <div className="flex justify-end px-2 pb-2">
                <button
                  className="text-[12px] text-red-500 hover:text-red-700 underline"
                  onClick={handleClear}
                >
                  清除日期
                </button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Helpers (personal-overdue) ───

/** Start of today in Asia/Hong_Kong as ISO string for due_date comparisons. */
function startOfTodayHkIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}T00:00:00+08:00`;
}

function isDueDatePassed(dueDate: string | null, todayStartMs: number): boolean {
  if (!dueDate) return false;
  const t = new Date(dueDate).getTime();
  return !isNaN(t) && t < todayStartMs;
}

function projectDetailUrl(bwType: "BWA" | "BWF", projectId: string | null): string | null {
  if (!projectId) return null;
  return bwType === "BWF" ? `/bwf/projects/${projectId}` : `/projects/bwa/${projectId}`;
}

function openProjectDetail(bwType: "BWA" | "BWF", projectId: string | null) {
  const url = projectDetailUrl(bwType, projectId);
  if (!url) return;
  window.open(url, "_blank", "noopener");
}

// ─── Component ───

export default function ReceivableManagement({
  mode = "accounting",
}: ReceivableManagementProps) {
  const isPersonalOverdue = mode === "personal-overdue";
  const { formatMoney } = useFinancialFormat();
  const { canCreate, canEdit, canDelete, loading: permLoading } = usePermission();
  const { staff } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const supabase = useMemo(() => createClient(), []);
  const { sources } = useReportRange();
  const sourceType: "BWA" | "BWF" = sources.bwf && !sources.bwa ? "BWF" : "BWA";

  // Data
  const [outstandingRows, setOutstandingRows] = useState<IncomeRow[]>([]);
  const [allRows, setAllRows] = useState<IncomeRow[]>([]); // ALL incomes (no outstanding filter)
  const [outstandingRemarksData, setOutstandingRemarksData] = useState<any[]>([]); // From outstanding_remarks table
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail view
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<IncomeRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [bwFilter, setBwFilter] = useState<"all" | "BWA" | "BWF">("all");
  const [pmFilter, setPmFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fyFilter, setFyFilter] = useState<string>("all");
  /** personal-overdue: all outstanding / due_date passed / not yet due */
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  /** personal-overdue: false = project_bv.handler_id; true = main_pm_id */
  const [mainPmOnly, setMainPmOnly] = useState(false);
  /** Super Admin: view another staff member's overdue set (defaults to self) */
  const [viewStaffId, setViewStaffId] = useState<string | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);

  const effectiveStaffId =
    isPersonalOverdue && isSuperAdmin && viewStaffId
      ? viewStaffId
      : staff?.id ?? null;

  // Keep viewStaffId synced to self until Super Admin picks someone else
  useEffect(() => {
    if (!isPersonalOverdue || !staff?.id) return;
    if (!viewStaffId) setViewStaffId(staff.id);
  }, [isPersonalOverdue, staff?.id, viewStaffId]);

  // Sort — personal-overdue defaults to 收款到期日 ascending
  const [sortField, setSortField] = useState<SortField>(
    isPersonalOverdue ? "due_date" : "outstanding"
  );
  const [sortDir, setSortDir] = useState<SortDir>(isPersonalOverdue ? "asc" : "desc");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Staff/PM list for filter
  const [pmList, setPmList] = useState<string[]>([]);
  const [fyList, setFyList] = useState<string[]>([]);

  // ─── Fetch Data ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isPersonalOverdue && !effectiveStaffId) {
        setOutstandingRows([]);
        setAllRows([]);
        setOutstandingRemarksData([]);
        setLoading(false);
        return;
      }

      // Lookup tables
      const [projectsRes, bwfProjectsRes, staffRes, contractTypesRes, fyRes] = await Promise.all([
        supabase.from("bwa_projects").select("id, bubble_id, project_code, project_name, status, n_financial_year, e_outstanding_date, asana_link, main_pm_id, pm:staff!fk_bwa_projects_main_pm_id(name)"),
        supabase.from("bwf_projects").select("id, bubble_id, project_code, project_name, status, n_financial_year, asana_link, main_pm, main_pm_id"),
        supabase.from("staff").select("id, bubble_id, name, status"),
        supabase.from("nos_contracts").select("id, bubble_id, chinese_display, display"),
        supabase.from("financial_years").select("id, bubble_id, display"),
      ]);

      // Super Admin staff switcher options (Active first, then inactive)
      if (isPersonalOverdue && isSuperAdmin) {
        const byName = (a: StaffOption, b: StaffOption) =>
          (a.name || "").localeCompare(b.name || "", "zh-HK");
        const options: StaffOption[] = (staffRes.data || [])
          .filter((s: any) => s.id && s.name)
          .map((s: any) => ({
            id: s.id as string,
            name: s.name as string,
            status: (s.status as string | null) ?? null,
          }));
        const active = options.filter((s) => s.status === "Active").sort(byName);
        const inactive = options.filter((s) => s.status !== "Active").sort(byName);
        setStaffOptions([...active, ...inactive]);
      }

      // personal-overdue: resolve allowed project UUIDs for effective staff
      let allowedProjectIds: Set<string> | null = null;
      if (isPersonalOverdue && effectiveStaffId) {
        allowedProjectIds = new Set<string>();
        if (mainPmOnly) {
          // Toggle rule: bwa_projects.main_pm_id = effective staff.id
          (projectsRes.data || []).forEach((p: any) => {
            if (p.main_pm_id === effectiveStaffId) allowedProjectIds!.add(p.id);
          });
        } else {
          const { data: bvRows, error: bvErr } = await supabase
            .from("project_bv")
            .select("project_id, bwf_project_id")
            .eq("handler_id", effectiveStaffId);
          if (bvErr) {
            console.error("[Receivable] project_bv fetch error:", bvErr.message);
            setError("載入資料失敗");
            setLoading(false);
            return;
          }
          (bvRows || []).forEach((row: any) => {
            if (row.project_id) allowedProjectIds!.add(row.project_id);
            if (row.bwf_project_id) allowedProjectIds!.add(row.bwf_project_id);
          });
        }
      }

      // Build financial year lookup: resolve bubble_id or UUID → display name
      const fyLookup = new Map<string, string>();
      (fyRes.data || []).forEach((fy: any) => {
        if (fy.display) {
          fyLookup.set(fy.id, fy.display);
          if (fy.bubble_id) fyLookup.set(fy.bubble_id, fy.display);
        }
      });
      const resolveFY = (ref: string | null): string | null => {
        if (!ref) return null;
        return fyLookup.get(ref) || null;
      };

      // Build lookup maps
      type ProjInfo = { project_name: string | null; project_code: string | null; pm_name: string | null; status: string | null; financial_year: string | null; e_outstanding_date: string | null; asana_link: string | null };
      const bwaMap = new Map<string, ProjInfo>();
      // Canonical UUID map: maps any project reference (bubble_id or uuid) → canonical UUID
      const projectCanonicalId = new Map<string, string>();
      (projectsRes.data || []).forEach((p: any) => {
        const pmName = p.pm?.name || null;
        const info: ProjInfo = { project_name: p.project_name, project_code: p.project_code, pm_name: pmName, status: p.status, financial_year: resolveFY(p.n_financial_year), e_outstanding_date: p.e_outstanding_date || null, asana_link: p.asana_link || null };
        bwaMap.set(p.id, info);
        projectCanonicalId.set(p.id, p.id);
        if (p.bubble_id) {
          bwaMap.set(p.bubble_id, info);
          projectCanonicalId.set(p.bubble_id, p.id);
        }
      });

      const sMap = new Map<string, string>();
      (staffRes.data || []).forEach((s: any) => {
        sMap.set(s.id, s.name);
        if (s.bubble_id) sMap.set(s.bubble_id, s.name);
      });

      const bwfMap = new Map<string, ProjInfo>();
      (bwfProjectsRes.data || []).forEach((p: any) => {
        const pmName = p.main_pm_id
          ? (sMap.get(p.main_pm_id) || null)
          : (p.main_pm ? (sMap.get(p.main_pm) || null) : null);
        const info: ProjInfo = { project_name: p.project_name, project_code: p.project_code, pm_name: pmName, status: p.status, financial_year: resolveFY(p.n_financial_year), e_outstanding_date: null, asana_link: p.asana_link || null };
        bwfMap.set(p.id, info);
        projectCanonicalId.set(p.id, p.id);
        if (p.bubble_id) {
          bwfMap.set(p.bubble_id, info);
          projectCanonicalId.set(p.bubble_id, p.id);
        }
      });

      const ctMap = new Map<string, string>();
      const ctCanonicalId = new Map<string, string>();
      (contractTypesRes.data || []).forEach((ct: any) => {
        const label = ct.chinese_display || ct.display || null;
        if (label) {
          ctMap.set(ct.id, label);
          ctCanonicalId.set(ct.id, ct.id);
          if (ct.bubble_id) {
            ctMap.set(ct.bubble_id, label);
            ctCanonicalId.set(ct.bubble_id, ct.id);
          }
        }
      });

      // ── Income fetches (two different logics) ──
      // 1) outstanding > 0 → which (project_id, n_contract_type_id) groups appear
      // 2) all related incomes for those groups → counts + expand list
      const outstandingFilters: Array<{ column: string; operator: string; value: any }> = [
        { column: "outstanding", operator: "gt", value: 0 },
      ];

      const outstandingRes = await fetchAllRows(supabase, "incomes", "*", {
        filters: outstandingFilters,
        order: { column: "created_date", ascending: false },
      });

      if (outstandingRes.error) {
        console.error("[Receivable] Outstanding income fetch error:", outstandingRes.error.message);
        setError("載入資料失敗");
      }

      const incomeBelongsToAllowed = (i: any): boolean => {
        if (!allowedProjectIds) return true;
        const refs = [i.project_id, i.bwf_project_id, i.project, i.bwf_project].filter(Boolean);
        return refs.some((ref: string) => {
          const canonical = projectCanonicalId.get(ref) || ref;
          return allowedProjectIds!.has(canonical);
        });
      };

      const incomeData = (outstandingRes.data || []).filter((i: any) => incomeBelongsToAllowed(i));

      // Resolve project UUID early so fetch-2 can target the right projects
      const resolveRawProjectId = (i: any): string | null => {
        const refs = [i.project_id, i.project, i.bwf_project, i.bwf_project_id].filter(Boolean);
        for (const ref of refs) {
          const canonical = projectCanonicalId.get(ref);
          if (canonical) return canonical;
        }
        return refs[0] || null;
      };

      const outstandingGroupKeys = new Set<string>();
      const outstandingProjectIds = new Set<string>();
      for (const i of incomeData) {
        const pid = resolveRawProjectId(i);
        if (!pid) continue;
        const rawCt = i.n_contract_type_id || null;
        const ctId = rawCt ? ctCanonicalId.get(rawCt) || rawCt : null;
        // Only seed groups that still have net receivable after bad debts
        const net = (Number(i.outstanding) || 0) - (Number(i.bad_debts) || 0);
        if (net <= 0) continue;
        outstandingProjectIds.add(pid);
        outstandingGroupKeys.add(incomeGroupKey(pid, ctId));
      }

      // Fetch 2: related incomes for seeded groups (+ remarks in accounting mode)
      let allIncomesRes: { data: any[]; error: any };
      let outstandingRemarksRes: { data: any[]; error: any };

      if (isPersonalOverdue) {
        const legacyRefs: string[] = [];
        for (const [ref, canonical] of projectCanonicalId.entries()) {
          if (outstandingProjectIds.has(canonical) && ref !== canonical) {
            legacyRefs.push(ref);
          }
        }
        allIncomesRes = await fetchIncomesByProjectIds(
          supabase,
          Array.from(outstandingProjectIds),
          legacyRefs
        );
        outstandingRemarksRes = { data: [], error: null };
      } else {
        [allIncomesRes, outstandingRemarksRes] = await Promise.all([
          fetchAllRows(supabase, "incomes", "*", {
            order: { column: "created_date", ascending: false },
          }),
          fetchAllRows(
            supabase,
            "outstanding_remarks",
            "id, project_id, project, bwf_project, bwf_project_id, n_contract_type_id, n_contract_type, remarks, created_date, created_by",
            { order: { column: "created_date", ascending: false } }
          ),
        ]);
      }

      if (allIncomesRes.error) {
        console.error("[Receivable] Related income fetch error:", allIncomesRes.error.message);
      }
      if (outstandingRemarksRes.error) {
        console.error("[Receivable] Outstanding remarks fetch error:", outstandingRemarksRes.error.message);
      }

      // Related incomes: keep only rows in the outstanding-seeded (project, contract type) groups
      const allIncomeData = (allIncomesRes.data || []).filter((i: any) => {
        if (!incomeBelongsToAllowed(i)) return false;
        if (!isPersonalOverdue) return true;
        const pid = resolveRawProjectId(i);
        const rawCt = i.n_contract_type_id || null;
        const ctId = rawCt ? ctCanonicalId.get(rawCt) || rawCt : null;
        return outstandingGroupKeys.has(incomeGroupKey(pid, ctId));
      });

      // Store outstanding_remarks data for grouping count
      setOutstandingRemarksData(outstandingRemarksRes.data || []);

      const pmSet = new Set<string>();
      const fySet = new Set<string>();

      const mapped: IncomeRow[] = incomeData.map((i: any) => {
        let bwType: "BWA" | "BWF" = "BWA";
        let proj: ProjInfo | null = null;

        if (i.project_id) {
          proj = bwaMap.get(i.project_id) || null;
        }
        if (!proj && i.project) {
          proj = bwaMap.get(i.project) || null;
        }
        if (!proj && i.bwf_project) {
          proj = bwfMap.get(i.bwf_project) || null;
          if (proj) bwType = "BWF";
        }
        if (!proj && i.bwf_project_id) {
          proj = bwfMap.get(i.bwf_project_id) || null;
          if (proj) bwType = "BWF";
        }

        // Get contract type chinese name from nos_contracts
        const rawCtId = i.n_contract_type_id || null;
        const ctLabel = rawCtId ? (ctMap.get(rawCtId) || i.type_display || null) : (i.type_display || null);

        if (proj?.pm_name) pmSet.add(proj.pm_name);
        if (proj?.financial_year) fySet.add(proj.financial_year);

        return {
          id: i.id,
          income_amount: i.income_amount,
          payment_amount: i.payment_amount,
          outstanding: i.outstanding,
          bad_debts: i.bad_debts,
          status: i.status,
          payment_status: i.payment_status,
          invoice_number: i.invoice_number,
          type_display: i.type_display,
          contract_type_label: ctLabel,
          due_date: i.due_date,
          receive_date: i.receive_date,
          created_date: i.created_date,
          remark: i.remark,
          outstanding_remark: i.outstanding_remark,
          date_remark: i.date_remark,
          real_creator_name: i.real_creator_name,
          project_name: proj?.project_name || null,
          project_code: proj?.project_code || null,
          project_id: (() => {
            // Try ALL possible reference fields to find canonical UUID
            const refs = [i.project_id, i.project, i.bwf_project, i.bwf_project_id].filter(Boolean);
            for (const ref of refs) {
              const canonical = projectCanonicalId.get(ref);
              if (canonical) return canonical;
            }
            return refs[0] || null;
          })(),
          pm_name: proj?.pm_name || null,
          bw_type: bwType,
          n_contract_type_id: rawCtId ? (ctCanonicalId.get(rawCtId) || rawCtId) : null,
          e_outstanding_date: proj?.e_outstanding_date || null,
          expected_payment_date: i.expected_payment_date || null,
          project_status: proj?.status || null,
          financial_year: proj?.financial_year || null,
          asana_link: proj?.asana_link || null};
      })
      // Filter: only include rows where (outstanding - bad_debts) > 0
      .filter((row) => ((row.outstanding || 0) - (row.bad_debts || 0)) > 0);

      // Map ALL incomes (for totals calculation)
      const allMapped: IncomeRow[] = allIncomeData.map((i: any) => {
        let bwType: "BWA" | "BWF" = "BWA";
        let proj: ProjInfo | null = null;

        if (i.project_id) proj = bwaMap.get(i.project_id) || null;
        if (!proj && i.project) proj = bwaMap.get(i.project) || null;
        if (!proj && i.bwf_project) {
          proj = bwfMap.get(i.bwf_project) || null;
          if (proj) bwType = "BWF";
        }
        if (!proj && i.bwf_project_id) {
          proj = bwfMap.get(i.bwf_project_id) || null;
          if (proj) bwType = "BWF";
        }

        const rawCtId2 = i.n_contract_type_id || null;
        const ctLabel = rawCtId2 ? (ctMap.get(rawCtId2) || i.type_display || null) : (i.type_display || null);

        return {
          id: i.id,
          income_amount: i.income_amount,
          payment_amount: i.payment_amount,
          outstanding: i.outstanding,
          bad_debts: i.bad_debts,
          status: i.status,
          payment_status: i.payment_status,
          invoice_number: i.invoice_number,
          type_display: i.type_display,
          contract_type_label: ctLabel,
          due_date: i.due_date,
          receive_date: i.receive_date,
          created_date: i.created_date,
          remark: i.remark,
          outstanding_remark: i.outstanding_remark,
          date_remark: i.date_remark,
          real_creator_name: i.real_creator_name,
          project_name: proj?.project_name || null,
          project_code: proj?.project_code || null,
          project_id: resolveRawProjectId(i),
          pm_name: proj?.pm_name || null,
          bw_type: bwType,
          n_contract_type_id: rawCtId2 ? (ctCanonicalId.get(rawCtId2) || rawCtId2) : null,
          e_outstanding_date: proj?.e_outstanding_date || null,
          expected_payment_date: i.expected_payment_date || null,
          project_status: proj?.status || null,
          financial_year: proj?.financial_year || null,
          asana_link: proj?.asana_link || null};
      });

      setPmList(Array.from(pmSet).sort());
      setFyList(Array.from(fySet).sort());
      setOutstandingRows(mapped);
      setAllRows(allMapped);
    } catch (err) {
      console.error("[Receivable] Fetch error:", err);
      setError("載入資料失敗");
    } finally {
      setLoading(false);
    }
  }, [supabase, isPersonalOverdue, effectiveStaffId, mainPmOnly, isSuperAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Build grouped data ───
  // 1) Seed groups from outstanding > 0 rows (filters apply here)
  // 2) Recalculate counts/totals from ALL related incomes (allRows) for those groups
  const groupedData = useMemo(() => {
    const applyListFilters = (rows: IncomeRow[], opts?: { applyExpiry?: boolean }) => {
      let filtered = [...rows];
      if (isPersonalOverdue) {
        if (bwFilter !== "all") {
          filtered = filtered.filter((r) => r.bw_type === bwFilter);
        }
      } else {
        filtered = filtered.filter((r) => r.bw_type === sourceType);
      }
      if (pmFilter !== "all") {
        filtered = filtered.filter((r) => r.pm_name === pmFilter);
      }
      if (statusFilter !== "all") {
        filtered = filtered.filter((r) => r.project_status === statusFilter);
      } else if (isPersonalOverdue) {
        // Default view: receivable is money — apply 計錢 (exclude Case Closed / Internal).
        filtered = filtered.filter((r) =>
          getEffectiveStatusRule(r.project_status, "all").countMoney,
        );
      }
      if (fyFilter !== "all") {
        filtered = filtered.filter((r) => r.financial_year === fyFilter);
      }
      if (opts?.applyExpiry && isPersonalOverdue && expiryFilter !== "all") {
        const todayStartMs = new Date(startOfTodayHkIso()).getTime();
        filtered = filtered.filter((r) => {
          const expired = isDueDatePassed(r.due_date, todayStartMs);
          return expiryFilter === "expired" ? expired : !expired;
        });
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            (r.project_name || "").toLowerCase().includes(q) ||
            (r.project_code || "").toLowerCase().includes(q) ||
            (r.pm_name || "").toLowerCase().includes(q) ||
            (r.contract_type_label || "").toLowerCase().includes(q)
        );
      }
      filtered = filtered.filter((row) => !!row.project_id);
      return filtered;
    };

    // Seed: which groups appear (outstanding > 0 only; expiry filter applies here)
    const seedRows = applyListFilters(outstandingRows, { applyExpiry: true });
    const groupMap = new Map<string, GroupedProject>();

    seedRows.forEach((row) => {
      const groupKey = incomeGroupKey(row.project_id, row.n_contract_type_id);
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          key: groupKey,
          project_name: row.project_name,
          project_code: row.project_code,
          project_id: row.project_id,
          pm_name: row.pm_name,
          bw_type: row.bw_type,
          contract_type_label: row.contract_type_label,
          n_contract_type_id: row.n_contract_type_id,
          project_status: row.project_status,
          financial_year: row.financial_year,
          e_outstanding_date: row.e_outstanding_date,
          earliest_expected_payment_date: null,
          total_outstanding: 0,
          total_income_amount: 0,
          total_payment_amount: 0,
          income_count: 0,
          collection_ratio: 0,
          earliest_due_date: null,
          remark_count: 0,
          outstanding_remark_count: 0,
          asana_link: row.asana_link,
        });
      }

      const group = groupMap.get(groupKey)!;
      // Earliest due among outstanding seed rows
      if (row.due_date) {
        const rowDueTime = new Date(row.due_date).getTime();
        if (!isNaN(rowDueTime)) {
          if (!group.earliest_due_date) {
            group.earliest_due_date = row.due_date;
          } else {
            const existingTime = new Date(group.earliest_due_date).getTime();
            if (rowDueTime < existingTime) {
              group.earliest_due_date = row.due_date;
            }
          }
        }
      }
    });

    // Recalculate numbers from ALL related incomes for seeded groups (no outstanding/expiry filter)
    const relatedRows = applyListFilters(allRows, { applyExpiry: false });
    relatedRows.forEach((row) => {
      const groupKey = incomeGroupKey(row.project_id, row.n_contract_type_id);
      const group = groupMap.get(groupKey);
      if (!group) return;

      group.total_income_amount += row.income_amount || 0;
      group.total_payment_amount += row.payment_amount || 0;
      group.total_outstanding += (row.outstanding || 0) - (row.bad_debts || 0);
      group.income_count += 1;

      if (row.remark && row.remark.trim()) {
        group.remark_count += 1;
      }

      group.earliest_expected_payment_date = earlierDate(
        group.earliest_expected_payment_date,
        row.expected_payment_date
      );
    });

    // Count outstanding remarks + collection ratio
    groupMap.forEach((group) => {
      const projectId = group.project_id;
      const groupContractTypeId = group.n_contract_type_id;
      let outstandingRemarkCount = 0;
      outstandingRemarksData.forEach((remark: any) => {
        const remarkProjectId = remark.project_id || remark.project || null;
        const remarkBwfProjectId = remark.bwf_project_id || remark.bwf_project || null;
        const remarkContractTypeId = remark.n_contract_type_id || remark.n_contract_type || null;

        const matchesProject =
          (remarkProjectId && remarkProjectId === projectId) ||
          (remarkBwfProjectId && remarkBwfProjectId === projectId);

        const matchesContractType = groupContractTypeId
          ? remarkContractTypeId === groupContractTypeId
          : !remarkContractTypeId;

        if (matchesProject && matchesContractType && remark.remarks && remark.remarks.trim()) {
          outstandingRemarkCount += 1;
        }
      });
      group.outstanding_remark_count = outstandingRemarkCount;

      if (group.total_income_amount > 0) {
        group.collection_ratio = (group.total_payment_amount / group.total_income_amount) * 100;
      }
    });

    let groups = Array.from(groupMap.values()).filter((g) => g.total_outstanding > 0);

    groups.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "pm":
          cmp = (a.pm_name || "").localeCompare(b.pm_name || "");
          break;
        case "project":
          cmp = (a.project_name || "").localeCompare(b.project_name || "");
          break;
        case "outstanding":
          cmp = a.total_outstanding - b.total_outstanding;
          break;
        case "income":
          cmp = a.total_income_amount - b.total_income_amount;
          break;
        case "payment":
          cmp = a.total_payment_amount - b.total_payment_amount;
          break;
        case "ratio":
          cmp = a.collection_ratio - b.collection_ratio;
          break;
        case "count":
          cmp = a.income_count - b.income_count;
          break;
        case "due_date": {
          const aTime = a.earliest_due_date ? new Date(a.earliest_due_date).getTime() : Infinity;
          const bTime = b.earliest_due_date ? new Date(b.earliest_due_date).getTime() : Infinity;
          cmp = aTime - bTime;
          break;
        }
        case "days_until_due": {
          const now = Date.now();
          const aDays = a.earliest_due_date
            ? Math.floor((new Date(a.earliest_due_date).getTime() - now) / (1000 * 60 * 60 * 24))
            : Infinity;
          const bDays = b.earliest_due_date
            ? Math.floor((new Date(b.earliest_due_date).getTime() - now) / (1000 * 60 * 60 * 24))
            : Infinity;
          cmp = aDays - bDays;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return groups;
  }, [
    outstandingRows,
    allRows,
    outstandingRemarksData,
    bwFilter,
    sourceType,
    pmFilter,
    statusFilter,
    fyFilter,
    expiryFilter,
    search,
    sortField,
    sortDir,
    isPersonalOverdue,
  ]);

  useEffect(() => {
    if (isPersonalOverdue) return;
    setPage(1);
    setExpandedGroup(null);
  }, [sourceType, isPersonalOverdue]);

  // Pagination
  const totalPages = Math.ceil(groupedData.length / pageSize);
  const pagedGroups = groupedData.slice((page - 1) * pageSize, page * pageSize);

  // Totals
  const totalOutstanding = groupedData.reduce((sum, g) => sum + g.total_outstanding, 0);
  const totalIncome = groupedData.reduce((sum, g) => sum + g.total_income_amount, 0);
  const totalPayment = groupedData.reduce((sum, g) => sum + g.total_payment_amount, 0);
  const overallRatio = totalIncome > 0 ? (totalPayment / totalIncome) * 100 : 0;

  // Expand list = same related-income set used for group counts (includes paid / outstanding = 0)
  const visibleDetailRows = detailRows;

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1 text-blue-500" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 text-blue-500" />
    );
  };

  // Expand list from fetch-2 (allRows), not a third outstanding-only query
  const loadDetailRowsFromRelated = useCallback(
    (group: GroupedProject) => {
      setDetailLoading(true);
      const key = incomeGroupKey(group.project_id, group.n_contract_type_id);
      const rows = allRows
        .filter((r) => incomeGroupKey(r.project_id, r.n_contract_type_id) === key)
        .map((r) => ({
          ...r,
          contract_type_label: formatIncomeContractLabel(
            r.contract_type_label || r.type_display,
            r.invoice_number
          ),
        }))
        // Oldest → newest by 收款到期日; null due dates last
        .sort((a, b) => {
          const aTime = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const bTime = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          const aValid = !isNaN(aTime) ? aTime : Infinity;
          const bValid = !isNaN(bTime) ? bTime : Infinity;
          if (aValid !== bValid) return aValid - bValid;
          return (a.invoice_number || "").localeCompare(b.invoice_number || "", undefined, {
            numeric: true,
          });
        });
      setDetailRows(rows);
      setDetailLoading(false);
    },
    [allRows]
  );

  // Handle group click
  const handleGroupClick = (group: GroupedProject) => {
    if (expandedGroup === group.key) {
      setExpandedGroup(null);
      setDetailRows([]);
    } else {
      setExpandedGroup(group.key);
      loadDetailRowsFromRelated(group);
    }
  };

  // ─── Permission gate ───

  // ─── Render ───
  const tableColSpan = isPersonalOverdue ? 13 : 16;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            {isPersonalOverdue ? "個人逾期應收" : "應收未收"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isPersonalOverdue
              ? "Personal Receivable — 未收項目（BV Handler / 主責 PM），可篩選已逾期／未逾期"
              : "Income Outstanding — 按項目及合約類別分組顯示未收款總額"}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {isPersonalOverdue && isSuperAdmin && (
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-600 whitespace-nowrap">員工</Label>
              <Select
                value={effectiveStaffId || undefined}
                onValueChange={(v) => {
                  setViewStaffId(v);
                  setPage(1);
                  setExpandedGroup(null);
                }}
              >
                <SelectTrigger className="w-[180px] h-9 text-sm bg-white">
                  <SelectValue placeholder="選擇員工" />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span
                        style={
                          s.status !== "Active" ? INACTIVE_STRIKE : undefined
                        }
                      >
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isPersonalOverdue && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <Switch
                id="main-pm-only"
                checked={mainPmOnly}
                onCheckedChange={(checked) => {
                  setMainPmOnly(checked);
                  setPage(1);
                  setExpandedGroup(null);
                }}
              />
              <Label htmlFor="main-pm-only" className="text-sm text-gray-700 cursor-pointer">
                僅主責 PM
              </Label>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            重新載入
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">分組數</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {groupedData.length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-xs text-gray-500">總未收款項</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {formatMoney(totalOutstanding)}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs text-gray-500">總應收款項</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {formatMoney(totalIncome)}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs text-gray-500">平均收款比率</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {overallRatio > 0 ? `${overallRatio.toFixed(1)}%` : "-"}
          </div>
          <div className="text-xs text-gray-400 mt-1 font-mono-num">
            payment / income × 100%
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜尋項目、經理..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {isPersonalOverdue ? (
            <Select value={bwFilter} onValueChange={(v) => { setBwFilter(v as any); setPage(1); }}>
              <SelectTrigger className="w-[120px] h-9 text-sm">
                <SelectValue placeholder="BWA/BWF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="BWA">BWA 工程</SelectItem>
                <SelectItem value="BWF">BWF 家具</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <ReportSourceToggle />
          )}

          {/* personal-overdue: expired / not expired */}
          {isPersonalOverdue && (
            <Select
              value={expiryFilter}
              onValueChange={(v) => {
                setExpiryFilter(v as ExpiryFilter);
                setPage(1);
                setExpandedGroup(null);
              }}
            >
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="到期狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="expired">已逾期</SelectItem>
                <SelectItem value="not_expired">未逾期</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Advanced filter toggle */}
          <Button
            variant={filterOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterOpen(!filterOpen)}
            className="h-9"
          >
            <Filter className="w-4 h-4 mr-1" />
            高級篩選
            {filterOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </Button>

          {/* Active filter indicators */}
          {(pmFilter !== "all" || statusFilter !== "all" || fyFilter !== "all" || (isPersonalOverdue && expiryFilter !== "all")) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-red-500 hover:text-red-700"
              onClick={() => {
                setPmFilter("all");
                setStatusFilter("all");
                setFyFilter("all");
                if (isPersonalOverdue) setExpiryFilter("all");
                setPage(1);
              }}
            >
              <X className="w-3 h-3 mr-1" />
              清除篩選
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {filterOpen && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
            {/* PM filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">項目經理</span>
              <Select value={pmFilter} onValueChange={(v) => { setPmFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {pmList.map((pm) => (
                    <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">項目狀態</span>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[220px] h-8 text-xs">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {PROJECT_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {projectStatusFilterLabel(opt.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Financial Year filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">財政年度</span>
              <Select value={fyFilter} onValueChange={(v) => { setFyFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {fyList.map((fy) => (
                    <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Grouped Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-500">載入中...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48 text-red-500">
            <AlertTriangle className="w-5 h-5 mr-2" />
            {error}
          </div>
        ) : groupedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Receipt className="w-10 h-10 mb-2" />
            <span>沒有符合條件的記錄</span>
          </div>
        ) : (
          <ScrollArea className="w-full">
            <div className={isPersonalOverdue ? "min-w-[1100px]" : "min-w-[1420px]"}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="w-[40px] text-center text-xs">#</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="w-[110px]">
                      <button className="flex items-center text-xs font-medium" onClick={() => handleSort("due_date")}>
                        到期日 <SortIcon field="due_date" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[100px]">
                      <button className="flex items-center text-xs font-medium" onClick={() => handleSort("days_until_due")}>
                        距離到期日 <SortIcon field="days_until_due" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[150px]">
                      <button className="flex items-center text-xs font-medium" onClick={() => handleSort("count")}>
                        合約類別 <SortIcon field="count" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[100px]">
                      <button className="flex items-center text-xs font-medium" onClick={() => handleSort("pm")}>
                        項目經理 <SortIcon field="pm" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[200px]">
                      <button className="flex items-center text-xs font-medium" onClick={() => handleSort("project")}>
                        項目 <SortIcon field="project" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[120px]">
                      <button className="flex items-center text-xs font-medium" onClick={() => handleSort("income")}>
                        應收款項 <SortIcon field="income" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[120px]">
                      <button className="flex items-center text-xs font-medium" onClick={() => handleSort("payment")}>
                        已收款項 <SortIcon field="payment" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[120px]">
                      <button className="flex items-center text-xs font-medium" onClick={() => handleSort("outstanding")}>
                        未收款項 <SortIcon field="outstanding" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[90px]">
                      <button className="flex items-center text-xs font-medium" onClick={() => handleSort("ratio")}>
                        收款比率 <SortIcon field="ratio" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[80px] text-xs">收入備註</TableHead>
                    {!isPersonalOverdue && (
                      <>
                        <TableHead className="w-[80px] text-xs">會計備註</TableHead>
                        <TableHead className="w-[80px] text-xs">CRM 狀態</TableHead>
                        <TableHead className="w-[120px] text-xs">預計收款日期</TableHead>
                      </>
                    )}
                    <TableHead className="w-[44px] text-center text-xs">Asana</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedGroups.map((group, idx) => {
                    const rowNum = (page - 1) * pageSize + idx + 1;
                    const isExpanded = expandedGroup === group.key;
                    const ratioStr = group.total_income_amount > 0
                      ? `${group.collection_ratio.toFixed(1)}%`
                      : "-";
                    const dueInfo = calcDaysUntilDue(group.earliest_due_date);

                    return (
                      <React.Fragment key={group.key}>
                        {/* Group Row */}
                        <TableRow
                          className={`cursor-pointer transition-all hover:bg-gray-50 border-l-[3px] ${
                            group.bw_type === "BWA" ? "border-l-blue-500" : "border-l-amber-500"
                          } ${isExpanded ? "bg-blue-50/30" : ""}`}
                          onClick={() => handleGroupClick(group)}
                        >
                          <TableCell className="text-center text-xs text-gray-400">{rowNum}</TableCell>
                          <TableCell className="text-center">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-blue-500" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                            )}
                          </TableCell>
                          {/* 到期日 */}
                          <TableCell>
                            <span className="text-xs text-gray-700">{fmtDateYmd(group.earliest_due_date)}</span>
                          </TableCell>
                          {/* 距離到期日 */}
                          <TableCell>
                            {dueInfo.label === "-" ? (
                              <span className="text-xs text-gray-400">-</span>
                            ) : (
                              <Badge
                                variant="outline"
                                className={`text-[11px] px-1.5 py-0 ${
                                  dueInfo.isOverdue
                                    ? "border-red-300 text-red-600 bg-red-50"
                                    : "border-emerald-300 text-emerald-600 bg-emerald-50"
                                }`}
                              >
                                {dueInfo.isOverdue && <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />}
                                {dueInfo.label}
                              </Badge>
                            )}
                          </TableCell>
                          {/* 合約類別 + 筆數 */}
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-600">{group.contract_type_label || "-"}</span>
                              <Badge variant="secondary" className="text-[11px] px-1 py-0">
                                {group.income_count}筆
                              </Badge>
                            </div>
                          </TableCell>
                          {/* 項目經理 */}
                          <TableCell>
                            <span className="text-xs font-medium text-gray-700">{group.pm_name || "-"}</span>
                          </TableCell>
                          {/* 項目 */}
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={`text-[12px] px-1 py-0 ${
                                  group.bw_type === "BWA"
                                    ? "border-blue-300 text-blue-600 bg-blue-50"
                                    : "border-amber-300 text-amber-600 bg-amber-50"
                                }`}
                              >
                                {group.bw_type}
                              </Badge>
                              <div className="min-w-0">
                                {group.project_id ? (
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[140px] text-left"
                                    title="開啟項目詳情"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openProjectDetail(group.bw_type, group.project_id);
                                    }}
                                  >
                                    {group.project_name || group.project_code || "-"}
                                  </button>
                                ) : (
                                  <div className="text-xs font-medium text-gray-900 truncate max-w-[140px]">
                                    {group.project_name || group.project_code || "-"}
                                  </div>
                                )}
                                {group.project_code && group.project_name && (
                                  <div className="text-[12px] text-gray-400 truncate">{group.project_code}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          {/* 應收款項 */}
                          <TableCell>
                            <span className="text-xs font-medium text-gray-700 font-mono">
                              {formatMoney(group.total_income_amount)}
                            </span>
                          </TableCell>
                          {/* 已收款項 */}
                          <TableCell>
                            <span className="text-xs font-medium text-emerald-600 font-mono">
                              {formatMoney(group.total_payment_amount)}
                            </span>
                          </TableCell>
                          {/* 未收款項 */}
                          <TableCell>
                            <span className="text-xs font-semibold text-red-600 font-mono">
                              {formatMoney(group.total_outstanding)}
                            </span>
                          </TableCell>
                          {/* 收款比率 */}
                          <TableCell>
                            <span
                              className={`text-xs font-mono font-medium ${
                                ratioStr === "-"
                                  ? "text-gray-400"
                                  : group.collection_ratio >= 80
                                  ? "text-emerald-600"
                                  : group.collection_ratio >= 50
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                            >
                              {ratioStr}
                            </span>
                          </TableCell>
                          {/* 收入備註 */}
                          <TableCell>
                            {group.remark_count > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                📝 {group.remark_count}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </TableCell>
                          {!isPersonalOverdue && (
                            <>
                              {/* 會計備註 */}
                              <TableCell>
                                {group.outstanding_remark_count > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                                    <MessageSquare className="w-3 h-3" /> {group.outstanding_remark_count}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </TableCell>
                              {/* CRM 狀態 */}
                              <TableCell>
                                <CRMStatusBadge
                                  group={group}
                                  supabase={supabase}
                                />
                              </TableCell>
                              {/* 預計收款日期 */}
                              <TableCell>
                                <ExpectedDatePicker
                                  group={group}
                                  supabase={supabase}
                                  onUpdate={(newDate) => {
                                    const patch = (rows: IncomeRow[]) =>
                                      rows.map((r) =>
                                        r.project_id === group.project_id
                                          ? { ...r, e_outstanding_date: newDate }
                                          : r
                                      );
                                    setOutstandingRows(patch);
                                    setAllRows(patch);
                                  }}
                                />
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <AsanaLinkButton href={group.asana_link} />
                          </TableCell>

                        </TableRow>

                        {/* Expanded Detail Rows */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={tableColSpan} className="p-0 bg-gray-50/50">
                              {detailLoading ? (
                                <div className="flex items-center justify-center h-20">
                                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                  <span className="ml-2 text-xs text-gray-500">載入明細...</span>
                                </div>
                              ) : visibleDetailRows.length === 0 ? (
                                <div className="flex items-center justify-center h-16 text-xs text-gray-400">
                                  沒有收入記錄
                                </div>
                              ) : (
                                <div className="px-4 py-3">
                                  <div className="flex gap-4">
                                    {/* Left: Detail Table */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Layers className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="text-xs font-medium text-gray-700">
                                          {isPersonalOverdue ? "相關收入記錄" : "所有收入記錄"}（共 {visibleDetailRows.length} 筆）
                                        </span>
                                      </div>
                                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-gray-100/80">
                                              <TableHead className="text-[12px] w-[30px]">#</TableHead>
                                              <TableHead className="text-[12px]">到期日</TableHead>
                                              <TableHead className="text-[12px]">距離到期日</TableHead>
                                              <TableHead className="text-[12px]">合約類別</TableHead>
                                              <TableHead className="text-[12px]">應收款項</TableHead>
                                              <TableHead className="text-[12px]">已收款項</TableHead>
                                              <TableHead className="text-[12px]">未收款項</TableHead>
                                              <TableHead className="text-[12px]">收款比率</TableHead>
                                              <TableHead className="text-[12px]">收入備註</TableHead>
                                              <TableHead className="text-[12px]">預計收款日期</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {visibleDetailRows.map((row, dIdx) => {
                                              const dueInfo = calcDaysUntilDue(row.due_date);
                                              const ratio = calcCollectionRatio(row.payment_amount, row.income_amount);
                                              const isFullyCollected = ratio !== "-" && parseFloat(ratio) >= 100;
                                              const netOutstanding = (row.outstanding || 0) - (row.bad_debts || 0);
                                              const hasOutstanding = netOutstanding > 0;

                                              return (
                                                <TableRow
                                                  key={row.id}
                                                  className={`text-xs ${
                                                    hasOutstanding ? "bg-white" : "bg-emerald-50/30"
                                                  }`}
                                                >
                                                  <TableCell className="text-[12px] text-gray-400">{dIdx + 1}</TableCell>
                                                  <TableCell>
                                                    <span className="text-[13px] text-gray-600">{fmtDateYmd(row.due_date)}</span>
                                                  </TableCell>
                                                  <TableCell>
                                                    {isFullyCollected ? (
                                                      <Badge
                                                        variant="outline"
                                                        className="text-[11px] px-1 py-0 border-emerald-300 text-emerald-600 bg-emerald-50"
                                                      >
                                                        已收齊款項
                                                      </Badge>
                                                    ) : dueInfo.label === "-" ? (
                                                      <span className="text-[13px] text-gray-400">-</span>
                                                    ) : (
                                                      <Badge
                                                        variant="outline"
                                                        className={`text-[11px] px-1 py-0 ${
                                                          dueInfo.isOverdue
                                                            ? "border-red-300 text-red-600 bg-red-50"
                                                            : "border-emerald-300 text-emerald-600 bg-emerald-50"
                                                        }`}
                                                      >
                                                        {dueInfo.isOverdue && <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />}
                                                        {dueInfo.label}
                                                      </Badge>
                                                    )}
                                                  </TableCell>
                                                  <TableCell>
                                                    <span className="text-[13px] text-gray-700 line-clamp-1">{row.contract_type_label || "-"}</span>
                                                  </TableCell>
                                                  <TableCell>
                                                    <span className="text-[13px] font-mono text-gray-700">{formatMoney(row.income_amount)}</span>
                                                  </TableCell>
                                                  <TableCell>
                                                    <span className="text-[13px] font-mono text-emerald-600">{formatMoney(row.payment_amount)}</span>
                                                  </TableCell>
                                                  <TableCell>
                                                    <span className={`text-[13px] font-mono font-semibold ${hasOutstanding ? "text-red-600" : "text-gray-400"}`}>
                                                      {formatMoney(netOutstanding)}
                                                    </span>
                                                  </TableCell>
                                                  <TableCell>
                                                    <span
                                                      className={`text-[13px] font-mono ${
                                                        ratio === "-"
                                                          ? "text-gray-400"
                                                          : parseFloat(ratio) >= 100
                                                          ? "text-emerald-600 font-medium"
                                                          : parseFloat(ratio) >= 50
                                                          ? "text-amber-600"
                                                          : "text-red-600"
                                                      }`}
                                                    >
                                                      {ratio}
                                                    </span>
                                                  </TableCell>
                                                  <TableCell>
                                                    <span className="text-[13px] text-gray-700 line-clamp-1">{row.remark || "-"}</span>
                                                  </TableCell>
                                                  <TableCell>
                                                    <IncomeExpectedDatePicker
                                                      row={row}
                                                      onUpdate={(newDate) => {
                                                        const patch = (rows: IncomeRow[]) =>
                                                          rows.map((r) =>
                                                            r.id === row.id
                                                              ? { ...r, expected_payment_date: newDate }
                                                              : r
                                                          );
                                                        setOutstandingRows(patch);
                                                        setAllRows(patch);
                                                        setDetailRows(patch);
                                                      }}
                                                    />
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            })}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>

                                    {/* Right: Accounting Remarks Chat Panel (accounting mode only) */}
                                    {!isPersonalOverdue && (
                                      <OutstandingRemarksPanel
                                        group={group}
                                        supabase={supabase}
                                      />
                                    )}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        )}

        {/* Pagination */}
        {!loading && groupedData.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500">
              顯示 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, groupedData.length)} / 共 {groupedData.length} 組
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => setPage(1)}>
                <ChevronsLeft className="w-3.5 h-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-gray-600 px-2">
                {page} / {totalPages || 1}
              </span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                <ChevronsRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
