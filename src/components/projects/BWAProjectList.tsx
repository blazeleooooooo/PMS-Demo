"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  DollarSign,
  FolderOpen,
  Users,
  Calendar,
  Building2,

  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  X,
  TrendingUp,
  BarChart3,
  ArrowUpDown,

  CheckCircle2,
  Clock,
  Briefcase,
  HardHat,
  Link2,
  AlertTriangle} from "lucide-react";
import {
  BWA_PROJECT_SIZE_FILTER_OPTIONS,
  resolveBwaProjectSize,
} from "@/lib/bwa-project-size";
import { AsanaIcon } from "@/components/ui/asana-icon";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
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

import {
  fetchBWAProjects,
  fetchProjectFinancials,
  fetchPMStaffOptions,
  updateBWAProject,
  type BWAProjectRow,
  type ProjectStaffContext,
  type ProjectFinancials,
  type LinkOption} from "@/lib/data-service";
import { useNavigate } from "@/hooks/use-navigate";
import { formatDate, getTodayLocal } from "@/lib/date-utils";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import {
  PROJECT_STATUS_OPTIONS,
  projectStatusFilterLabel,
} from "@/lib/project-status-rules";

export type BWAProjectListVariant = "default" | "defect-crisis";

type BWAProjectListProps = {
  /** default = all BWA projects; defect-crisis = WIP + past handover + 100% income received */
  variant?: BWAProjectListVariant;
};

function isFullyReceived(fin: ProjectFinancials | undefined): boolean {
  if (!fin || fin.total_sales <= 0) return false;
  return fin.paid_sales >= fin.total_sales;
}

function isHandoverPast(handoverDate: string | null, todayYmd: string): boolean {
  if (!handoverDate) return false;
  const ymd = handoverDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return ymd < todayYmd;
}

type SortField =
  | "project_code"
  | "project_name"
  | "customer_name"
  | "pm_name"
  | "district_name"
  | "size"
  | "signed_date"
  | "start_date"
  | "handover_date"
  | "estimated_income"
  | "estimated_expense"
  | "estimated_profit"
  | "status"
  | "payment_status"
  | "service_type_name"
  | "team_type_name"
  | "financial_year_name"
  | "designer_name"
  | "project_type_name"
  | "main_contractor_name";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [20, 50, 100];

// ─── Extended type for fields that may exist on the row ───
type ExtendedRow = BWAProjectRow & {
  real_cost_centre?: string;
  project_type_name?: string;
  main_contractor_name?: string;
  asana_link?: string;
  real_customer_name?: string;
  cost_centre_bu_code?: string;
};

// ─── STAT CARD ─────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  subLabel,
  color,
  borderColor}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subLabel?: string;
  color: string;
  borderColor: string;
}) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 ${borderColor} transition-all hover:shadow-md`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900 font-mono-num">{value}</p>
          {subLabel && <p className="text-[13px] text-gray-400 mt-0.5">{subLabel}</p>}
        </div>
      </div>
    </div>
  );
}

function formatSize(size: string | null, projectSize: string | null): string {
  if (size) return `${size} sqft`;
  if (projectSize) return `${projectSize} sqft`;
  return "N/A";
}

function isWipStatus(status: string | null | undefined): boolean {
  return (status || "").trim() === "Work In Progress";
}

/** Expense Control lock icon — matches detail-page WIP gating. */
function expenseControlCell(
  projectId: string,
  status: string | null,
  /** id → restricted; missing WIP ids are still loading */
  known: Map<string, boolean>,
  pending: Set<string>
) {
  if (!isWipStatus(status)) {
    return (
      <span
        className="inline-flex justify-center w-full"
        title="出票不受限"
        aria-label="出票不受限"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      </span>
    );
  }
  if (known.has(projectId)) {
    const restricted = known.get(projectId) === true;
    if (restricted) {
      return (
        <span
          className="inline-flex justify-center w-full"
          title="出票受限：Expense Control 清單未完成"
          aria-label="出票受限"
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        </span>
      );
    }
    return (
      <span
        className="inline-flex justify-center w-full"
        title="出票不受限"
        aria-label="出票不受限"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      </span>
    );
  }
  if (pending.has(projectId)) {
    return <Loader2 className="w-4 h-4 animate-spin text-gray-300 mx-auto" />;
  }
  return <Loader2 className="w-4 h-4 animate-spin text-gray-300 mx-auto" />;
}


// ─── MAIN COMPONENT ─────────────────────────────────────
export default function BWAProjectList({ variant = "default" }: BWAProjectListProps) {
  const isDefectCrisis = variant === "defect-crisis";
  const basePath = isDefectCrisis ? "/defect-crisis" : "/projects/bwa";
  const { formatMoney } = useFinancialFormat();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { navigate } = useNavigate();
  const { canEdit, canDelete, loading: permLoading } = usePermission();
  const { staff } = useAuth();
  const [projects, setProjects] = useState<BWAProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingDoneId, setMarkingDoneId] = useState<string | null>(null);
  /** Cached Expense Control result per project id (true = 出票受限). */
  const expenseStatusCacheRef = useRef<Map<string, boolean>>(new Map());
  const [expenseStatusKnown, setExpenseStatusKnown] = useState<Map<string, boolean>>(
    () => new Map()
  );
  const [expenseStatusPending, setExpenseStatusPending] = useState<Set<string>>(
    () => new Set()
  );
  // Full PM staff list (same source as the create-pitching Main PM dropdown),
  // so the filter shows every PM — not only those present in loaded projects.
  const [pmOptions, setPmOptions] = useState<LinkOption[]>([]);

  // ─── READ INITIAL STATE FROM URL PARAMS ────────────────
  const getParam = (key: string, fallback: string) => searchParams.get(key) || fallback;

  // Search
  const [search, setSearch] = useState(getParam("q", ""));

  // Filters: 項目狀態, 項目經理, BU, 服務類型, 項目規模, 財政年度
  // Defect-crisis page locks status to Work In Progress (list is pre-filtered).
  const [statusFilter, setStatusFilter] = useState<string>(
    isDefectCrisis ? "Work In Progress" : getParam("status", "all")
  );
  const [pmFilter, setPmFilter] = useState<string>(getParam("pm", "all"));
  const [buFilter, setBuFilter] = useState<string>(getParam("bu", "all"));
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>(getParam("service", "all"));
  const [projectTypeFilter, setProjectTypeFilter] = useState<string>(getParam("type", "all"));
  const [projectSizeFilter, setProjectSizeFilter] = useState<string>(getParam("size", "all"));
  const [financialYearFilter, setFinancialYearFilter] = useState<string>(getParam("fy", "all"));
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sort — crisis list defaults to earliest handover first (most overdue)
  const [sortField, setSortField] = useState<SortField>(
    (getParam("sort", isDefectCrisis ? "handover_date" : "signed_date")) as SortField
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    (getParam("dir", isDefectCrisis ? "asc" : "desc")) as SortDir
  );
  // Default /projects/bwa load: current user's main_pm rows first, then signed_date desc.
  // Any header click turns this off for the rest of the session.
  const [pinOwnPmFirst, setPinOwnPmFirst] = useState(
    !isDefectCrisis && !searchParams.get("sort") && !searchParams.get("dir")
  );

  // Pagination
  const [currentPage, setCurrentPage] = useState(Number(getParam("page", "1")) || 1);
  const [pageSize, setPageSize] = useState(Number(getParam("ps", "20")) || 20);

  // ─── SYNC FILTERS TO URL (shallow, no navigation) ─────
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (!isDefectCrisis && statusFilter !== "all") params.set("status", statusFilter);
    if (pmFilter !== "all") params.set("pm", pmFilter);
    if (buFilter !== "all") params.set("bu", buFilter);
    if (serviceTypeFilter !== "all") params.set("service", serviceTypeFilter);
    if (projectTypeFilter !== "all") params.set("type", projectTypeFilter);
    if (projectSizeFilter !== "all") params.set("size", projectSizeFilter);
    if (financialYearFilter !== "all") params.set("fy", financialYearFilter);
    const defaultSort = isDefectCrisis ? "handover_date" : "signed_date";
    const defaultDir = isDefectCrisis ? "asc" : "desc";
    if (sortField !== defaultSort) params.set("sort", sortField);
    if (sortDir !== defaultDir) params.set("dir", sortDir);
    if (currentPage !== 1) params.set("page", String(currentPage));
    if (pageSize !== 20) params.set("ps", String(pageSize));

    const qs = params.toString();
    const newUrl = qs ? `${basePath}?${qs}` : basePath;
    router.replace(newUrl, { scroll: false });
  }, [search, statusFilter, pmFilter, buFilter, serviceTypeFilter, projectTypeFilter, projectSizeFilter, financialYearFilter, sortField, sortDir, currentPage, pageSize, isDefectCrisis, basePath, router]);

  // ─── LOAD DATA ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    // Build staff context for role-based row filtering
    const staffContext: ProjectStaffContext | undefined = staff?.id
      ? {
          staffId: staff.id,
          role: (staff as any)?.role || null,
          teamTypeId: (staff as any)?.n_team_type_id || null}
      : undefined;
    let data = await fetchBWAProjects(staffContext);

    // 執漏危機表 needs financials before it can filter — wait for both.
    // Default list uses estimated_income / estimated_profit from the project row.
    if (isDefectCrisis) {
      const projectIds = data.map((p) => p.id).filter(Boolean);
      let fin: Record<string, ProjectFinancials> = {};
      if (projectIds.length > 0) {
        fin = await fetchProjectFinancials(projectIds);
      }
      const todayYmd = getTodayLocal();
      data = data.filter(
        (p) =>
          (p.status || "").trim() === "Work In Progress" &&
          isHandoverPast(p.handover_date, todayYmd) &&
          isFullyReceived(fin[p.id])
      );
    }

    // Clear Expense Control cache when the project list reloads.
    expenseStatusCacheRef.current = new Map();
    setExpenseStatusKnown(new Map());
    setExpenseStatusPending(new Set());
    setProjects(data);
    setLoading(false);
  }, [staff, isDefectCrisis]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load the full PM staff list once (matches the create-pitching Main PM dropdown).
  useEffect(() => {
    fetchPMStaffOptions().then(setPmOptions).catch(() => {});
  }, []);

  // ─── UNIQUE VALUES FOR FILTERS ─────────────────────
  const filterOptions = useMemo(() => {
    const bus = Array.from(new Set(projects.map((p) => (p as ExtendedRow).cost_centre_bu_code).filter((x): x is string => !!x)));
    const serviceTypes = Array.from(new Set(projects.map((p) => p.service_type_name).filter((x): x is string => !!x)));
    const projectTypes = Array.from(new Set(projects.map((p) => (p as ExtendedRow).project_type_name).filter((x): x is string => !!x)));
    const fys = Array.from(new Set(projects.map((p) => p.financial_year_name).filter((x): x is string => !!x)));
    return { bus, serviceTypes, projectTypes, fys };
  }, [projects]);

  // Project size ranges (BWA 項目規模)
  const projectSizeRanges = BWA_PROJECT_SIZE_FILTER_OPTIONS;

  // ─── FILTER + SEARCH ──────────────────────────────
  const filteredProjects = useMemo(() => {
    let result = projects;
    if (statusFilter !== "all") result = result.filter((p) => p.status === statusFilter);
    if (pmFilter !== "all") result = result.filter((p) => p.main_pm_id === pmFilter);
    if (buFilter !== "all") result = result.filter((p) => (p as ExtendedRow).cost_centre_bu_code === buFilter);
    if (serviceTypeFilter !== "all") result = result.filter((p) => p.service_type_name === serviceTypeFilter);
    if (projectTypeFilter !== "all") result = result.filter((p) => (p as ExtendedRow).project_type_name === projectTypeFilter);
    if (financialYearFilter !== "all") result = result.filter((p) => p.financial_year_name === financialYearFilter);
    if (projectSizeFilter !== "all") {
      result = result.filter(
        (p) => resolveBwaProjectSize(p.project_size, p.estimated_income) === projectSizeFilter,
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.project_code && p.project_code.toLowerCase().includes(q)) ||
          (p.project_name && p.project_name.toLowerCase().includes(q)) ||
          (p.customer_name && p.customer_name.toLowerCase().includes(q)) ||
          (p.customer_display_name && p.customer_display_name.toLowerCase().includes(q)) ||
          (p.pm_name && p.pm_name.toLowerCase().includes(q)) ||
          (p.district_name && p.district_name.toLowerCase().includes(q)) ||
          (p.building_name && p.building_name.toLowerCase().includes(q)) ||
          (p.site_address && p.site_address.toLowerCase().includes(q)) ||
          (p.service_type_name && p.service_type_name.toLowerCase().includes(q)) ||
          (p.project_type_name && p.project_type_name.toLowerCase().includes(q)) ||
          ((p as ExtendedRow).cost_centre_bu_code?.toLowerCase().includes(q)) ||
          ((p as ExtendedRow).real_customer_name?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [projects, statusFilter, pmFilter, buFilter, serviceTypeFilter, projectTypeFilter, projectSizeFilter, financialYearFilter, search]);

  // ─── SORT ─────────────────────────────────────────
  const currentStaffId = staff?.id ?? null;
  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects];
    const useOwnPmFirst = pinOwnPmFirst && !!currentStaffId;

    const compareSignedDateDesc = (a: BWAProjectRow, b: BWAProjectRow) => {
      const aVal = a.signed_date;
      const bVal = b.signed_date;
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return String(bVal).localeCompare(String(aVal));
    };

    sorted.sort((a, b) => {
      if (useOwnPmFirst) {
        const aOwn = a.main_pm_id === currentStaffId ? 0 : 1;
        const bOwn = b.main_pm_id === currentStaffId ? 0 : 1;
        if (aOwn !== bOwn) return aOwn - bOwn;
        return compareSignedDateDesc(a, b);
      }
      const aVal = (a as unknown as Record<string, unknown>)[sortField];
      const bVal = (b as unknown as Record<string, unknown>)[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), "zh-HK");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredProjects, sortField, sortDir, pinOwnPmFirst, currentStaffId]);

  // ─── PAGINATION ───────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / pageSize));
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedProjects.slice(start, start + pageSize);
  }, [sortedProjects, currentPage, pageSize]);

  // 出票受限: evaluate current page WIP only; cache across pages; prefetch next page.
  useEffect(() => {
    if (loading) return;

    const pageStart = (currentPage - 1) * pageSize;
    const currentPageRows = sortedProjects.slice(pageStart, pageStart + pageSize);
    const nextPageRows = sortedProjects.slice(pageStart + pageSize, pageStart + pageSize * 2);

    const missingFor = (rows: BWAProjectRow[]) =>
      rows
        .filter((p) => isWipStatus(p.status))
        .map((p) => p.id)
        .filter((id) => !expenseStatusCacheRef.current.has(id));

    const visibleMissing = missingFor(currentPageRows);
    const prefetchMissing = missingFor(nextPageRows);

    if (visibleMissing.length === 0 && prefetchMissing.length === 0) {
      setExpenseStatusPending(new Set());
      return;
    }

    setExpenseStatusPending(new Set(visibleMissing));
    let cancelled = false;

    const fetchStatus = async (ids: string[], markPendingDone: boolean) => {
      if (ids.length === 0) return;
      try {
        const res = await fetch("/api/expense-locked/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectIds: ids }),
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled) return;
        const locked = new Set(
          json.success && Array.isArray(json.lockedIds) ? (json.lockedIds as string[]) : []
        );
        const evaluated: string[] =
          json.success && Array.isArray(json.evaluatedIds)
            ? (json.evaluatedIds as string[])
            : ids;
        for (const id of evaluated) {
          expenseStatusCacheRef.current.set(id, locked.has(id));
        }
        setExpenseStatusKnown(new Map(expenseStatusCacheRef.current));
      } catch {
        if (cancelled) return;
        // On failure, mark as not restricted so the column stops spinning.
        for (const id of ids) {
          if (!expenseStatusCacheRef.current.has(id)) {
            expenseStatusCacheRef.current.set(id, false);
          }
        }
        setExpenseStatusKnown(new Map(expenseStatusCacheRef.current));
      } finally {
        if (!cancelled && markPendingDone) {
          setExpenseStatusPending((prev) => {
            const next = new Set(prev);
            for (const id of ids) next.delete(id);
            return next;
          });
        }
      }
    };

    (async () => {
      await fetchStatus(visibleMissing, true);
      if (cancelled || prefetchMissing.length === 0) return;
      // Background prefetch — don't block UI with pending spinners.
      void fetchStatus(prefetchMissing, false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, sortedProjects, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, pmFilter, buFilter, serviceTypeFilter, projectTypeFilter, projectSizeFilter, financialYearFilter, pageSize]);

  const toggleSort = (field: SortField) => {
    setPinOwnPmFirst(false);
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  const clearFilters = () => {
    setSearch("");
    if (!isDefectCrisis) setStatusFilter("all");
    setPmFilter("all");
    setBuFilter("all");
    setServiceTypeFilter("all");
    setProjectTypeFilter("all");
    setProjectSizeFilter("all");
    setFinancialYearFilter("all");
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    (!isDefectCrisis && statusFilter !== "all") ||
    pmFilter !== "all" ||
    buFilter !== "all" || serviceTypeFilter !== "all" || projectTypeFilter !== "all" || projectSizeFilter !== "all" ||
    financialYearFilter !== "all";

  const canMarkProjectDone =
    !permLoading &&
    (canEdit("projects") || canEdit("defect-crisis"));

  const handleMarkProjectDone = async (projectId: string) => {
    if (!canMarkProjectDone || markingDoneId) return;
    setMarkingDoneId(projectId);
    const result = await updateBWAProject(projectId, { status: "Project Done" });
    if (result.success) {
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } else {
      window.alert(result.error || "更新項目狀態失敗");
    }
    setMarkingDoneId(null);
  };

  // ─── KPI STATS ────────────────────────────────────
  const kpiStats = useMemo(() => {
    const total = filteredProjects.length;
    const activeStatuses = ["active", "進行", "progress", "in progress", "work_in_progress"];
    const active = filteredProjects.filter((p) =>
      p.status && activeStatuses.some((s) => p.status!.toLowerCase().includes(s))
    ).length;
    const totalIncome = filteredProjects.reduce((sum, p) => sum + (p.estimated_income || 0), 0);
    const totalProfit = filteredProjects.reduce((sum, p) => sum + (p.estimated_profit || 0), 0);
    const marginPercent = totalIncome > 0 ? ((totalProfit / totalIncome) * 100).toFixed(1) : "0";
    const completed = filteredProjects.filter((p) =>
      p.status && (p.status.toLowerCase().includes("completed") || p.status.toLowerCase().includes("closed") || p.status.toLowerCase().includes("完成"))
    ).length;
    return { total, active, totalIncome, totalProfit, marginPercent, completed };
  }, [filteredProjects]);

  return (
    <div className="space-y-6 w-full">
      {/* Header — Bubble "Group Title Bar" */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            {isDefectCrisis ? (
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            ) : (
              <HardHat className="w-6 h-6 text-blue-500" />
            )}
            {isDefectCrisis ? "執漏危機表" : "項目 Projects"}
            <Badge className={`${isDefectCrisis ? "bg-amber-500 hover:bg-amber-500" : "bg-blue-500 hover:bg-blue-500"} text-white text-[12px] px-2 py-0 font-bold rounded-md ml-1`}>
              BWA
            </Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isDefectCrisis
              ? "進行中、交付日期已過、且相關收入收款比率已達 100% 的項目。"
              : "管理所有客戶項目。 Manage all customer projects."}
          </p>
        </div>
        <div className="flex items-center gap-2">

          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="h-9 gap-1.5 text-[15px]">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 重新整理
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={FolderOpen}
          label={isDefectCrisis ? "危機項目數" : "總項目數"}
          value={kpiStats.total}
          subLabel={`篩選中 ${filteredProjects.length} / 全部 ${projects.length}`}
          color={isDefectCrisis ? "bg-amber-500" : "bg-blue-500"}
          borderColor={isDefectCrisis ? "border-l-amber-500" : "border-l-blue-500"}
        />
        <StatCard icon={Clock} label="進行中項目" value={kpiStats.active} color="bg-amber-500" borderColor="border-l-amber-500" />
        <StatCard
          icon={isDefectCrisis ? AlertTriangle : CheckCircle2}
          label={isDefectCrisis ? "交付已過期" : "已完成項目"}
          value={isDefectCrisis ? projects.length : kpiStats.completed}
          color={isDefectCrisis ? "bg-red-500" : "bg-teal-500"}
          borderColor={isDefectCrisis ? "border-l-red-500" : "border-l-teal-500"}
        />
      </div>

      {/* Filters — Bubble "Group Search Bar" + "Group Advance Filter" */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search — Bubble "Input Search" placeholder: "Search all columns..." */}
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search all columns..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-[15px]" />
          </div>

          {/* 項目狀態 — locked on defect-crisis (always Work In Progress) */}
          {!isDefectCrisis && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[220px] h-9 text-[15px]"><SelectValue placeholder="項目狀態" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有狀態</SelectItem>
                {PROJECT_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {projectStatusFilterLabel(opt.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isDefectCrisis && (
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[13px] font-medium h-9 px-3 flex items-center">
              進行中 · 收款 100% · 交付已過
            </Badge>
          )}

          {/* 項目經理 */}
          <Select value={pmFilter} onValueChange={setPmFilter}>
            <SelectTrigger className="w-[140px] h-9 text-[15px]"><SelectValue placeholder="項目經理" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有PM</SelectItem>
              {pmOptions.map((pm) => (
                <SelectItem key={pm.id} value={pm.id}>
                  <span className={pm.status === "Inactive" ? "line-through text-muted-foreground" : ""}>
                    {pm.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 高級篩選 toggle */}
          <Button variant={showAdvancedFilters ? "default" : "outline"} size="sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="h-9 gap-1.5 text-[15px]">
            <SlidersHorizontal className="w-3.5 h-3.5" /> 高級篩選
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-[15px] text-red-500 hover:text-red-600 hover:bg-red-50">
              <X className="w-3.5 h-3.5" /> 清除篩選
            </Button>
          )}
        </div>

        {/* Advanced filters — Bubble "Group Advance Filter": BU, 服務類型, 項目規模, 財政年度, B2B/B2C */}
        {showAdvancedFilters && (
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-gray-100">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-gray-400 font-medium">BU</span>
              <Select value={buFilter} onValueChange={setBuFilter}>
                <SelectTrigger className="w-[140px] h-9 text-[15px]"><SelectValue placeholder="BU" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有BU</SelectItem>
                  {filterOptions.bus.sort().map((bu) => (<SelectItem key={bu} value={bu}>{bu}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-gray-400 font-medium">服務類型</span>
              <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                <SelectTrigger className="w-[150px] h-9 text-[15px]"><SelectValue placeholder="服務類型" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有服務類型</SelectItem>
                  {filterOptions.serviceTypes.sort().map((st) => (<SelectItem key={st} value={st}>{st}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-gray-400 font-medium">項目類型</span>
              <Select value={projectTypeFilter} onValueChange={setProjectTypeFilter}>
                <SelectTrigger className="w-[150px] h-9 text-[15px]"><SelectValue placeholder="項目類型" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有項目類型</SelectItem>
                  {filterOptions.projectTypes.sort().map((pt) => (<SelectItem key={pt} value={pt}>{pt}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-gray-400 font-medium">項目規模</span>
              <Select value={projectSizeFilter} onValueChange={setProjectSizeFilter}>
                <SelectTrigger className="w-[180px] h-9 text-[15px]"><SelectValue placeholder="項目規模" /></SelectTrigger>
                <SelectContent>
                  {projectSizeRanges.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-gray-400 font-medium">財政年度</span>
              <Select value={financialYearFilter} onValueChange={setFinancialYearFilter}>
                <SelectTrigger className="w-[150px] h-9 text-[15px]"><SelectValue placeholder="財政年度" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有財政年度</SelectItem>
                  {filterOptions.fys.sort().reverse().map((fy) => (<SelectItem key={fy} value={fy}>{fy}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Table — Bubble columns: 客戶名稱, 項目名稱, 主要PM及設計師, BU, 項目類型, 主要承包商, 預計收入, 預計毛利, Status, Action */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
              <span className="text-sm text-gray-400">載入項目資料...</span>
            </div>
          </div>
        ) : sortedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
              <FolderOpen className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">{hasActiveFilters ? "沒有符合篩選條件的項目" : "沒有項目資料"}</p>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={clearFilters} className="text-[15px] text-blue-500">清除篩選條件</Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[100px]" onClick={() => toggleSort("signed_date")}>
                      <span className="flex items-center">簽約日期 <SortIcon field="signed_date" /></span>
                    </TableHead>
                    {isDefectCrisis && (
                      <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[100px]" onClick={() => toggleSort("handover_date")}>
                        <span className="flex items-center">交付日期 <SortIcon field="handover_date" /></span>
                      </TableHead>
                    )}
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[100px]" onClick={() => toggleSort("service_type_name")}>
                      <span className="flex items-center">服務類型 <SortIcon field="service_type_name" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[100px]" onClick={() => toggleSort("project_type_name")}>
                      <span className="flex items-center">項目類型 <SortIcon field="project_type_name" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[80px]" onClick={() => toggleSort("team_type_name")}>
                      <span className="flex items-center">BU <SortIcon field="team_type_name" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[180px]" onClick={() => toggleSort("customer_name")}>
                      <span className="flex items-center">客戶名稱 <SortIcon field="customer_name" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[200px]" onClick={() => toggleSort("project_name")}>
                      <span className="flex items-center">項目名稱 <SortIcon field="project_name" /></span>
                    </TableHead>
                    <TableHead className="text-right text-[14px] font-semibold cursor-pointer select-none" onClick={() => toggleSort("estimated_income")}>
                      <span className="flex items-center justify-end">預計收入 <SortIcon field="estimated_income" /></span>
                    </TableHead>
                    <TableHead className="text-right text-[14px] font-semibold cursor-pointer select-none" onClick={() => toggleSort("estimated_profit")}>
                      <span className="flex items-center justify-end">預計毛利 <SortIcon field="estimated_profit" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[120px]" onClick={() => toggleSort("main_contractor_name")}>
                      <span className="flex items-center">主要承包商 <SortIcon field="main_contractor_name" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[140px]" onClick={() => toggleSort("pm_name")}>
                      <span className="flex items-center">主要PM及設計師 <SortIcon field="pm_name" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[100px]" onClick={() => toggleSort("status")}>
                      <span className="flex items-center">Status <SortIcon field="status" /></span>
                    </TableHead>
                    <TableHead className="text-[14px] font-semibold text-center w-[88px]" title="Expense Control — 出票是否受限">
                      出票受限
                    </TableHead>
                    <TableHead className={`text-[14px] font-semibold text-center ${isDefectCrisis ? "w-[120px]" : "w-[100px]"}`}>
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProjects.map((project) => {
                    const proj = project as ExtendedRow;
                    const estimatedIncome = project.estimated_income || 0;
                    const estimatedProfit = project.estimated_profit || 0;
                    const profitColor = estimatedProfit !== 0 ? (estimatedProfit >= 0 ? "text-emerald-600" : "text-red-600") : "text-gray-400";
                    const isMarkingDone = markingDoneId === project.id;

                    return (
                      <TableRow
                        key={project.id}
                        className={`group cursor-pointer transition-all hover:bg-gray-50/50`}
                        onClick={() => window.open(`/projects/bwa/${project.id}`, "_blank", "noopener")}
                      >
                        {/* 簽約日期 */}
                        <TableCell className="whitespace-nowrap">
                          {project.signed_date ? (
                            <span className="text-[14px] text-gray-700 font-mono">
                              {formatDate(project.signed_date)}
                            </span>
                          ) : (
                            <span className="text-[14px] text-gray-400">-</span>
                          )}
                        </TableCell>
                        {/* 交付日期 — defect-crisis only */}
                        {isDefectCrisis && (
                          <TableCell className="whitespace-nowrap">
                            {project.handover_date ? (
                              <span className="text-[14px] text-red-600 font-mono font-medium">
                                {formatDate(project.handover_date)}
                              </span>
                            ) : (
                              <span className="text-[14px] text-gray-400">-</span>
                            )}
                          </TableCell>
                        )}
                        {/* 服務類型 */}
                        <TableCell>
                          {project.service_type_name ? (
                            <span className="text-[14px] text-gray-700">
                              {project.service_type_name}
                            </span>
                          ) : <span className="text-[14px] text-gray-400">-</span>}
                        </TableCell>
                        {/* 項目類型 */}
                        <TableCell>
                          {proj.project_type_name ? (
                            <span className="text-[14px] text-gray-700">
                              {proj.project_type_name}
                            </span>
                          ) : <span className="text-[14px] text-gray-400">-</span>}
                        </TableCell>
                        {/* BU — display cost_centres.bu_code */}
                        <TableCell>
                          {proj.cost_centre_bu_code ? (
                            <Badge variant="outline" className="text-[13px] font-normal">{proj.cost_centre_bu_code}</Badge>
                          ) : <span className="text-[15px] text-gray-400">-</span>}
                        </TableCell>
                        {/* 客戶名稱 */}
                        <TableCell>
                          <div className="min-w-0">
                            <p className="text-[15px] font-medium text-gray-800 truncate max-w-[200px]">
                              {project.customer_display_name || project.customer_name || "N/A"}
                            </p>
                          </div>
                        </TableCell>
                        {/* 項目名稱 + project_code sub-text */}
                        <TableCell>
                          <div className="min-w-0">
                            <p className="text-[15px] text-gray-700 truncate max-w-[220px]">{project.project_name || "-"}</p>
                            {project.project_code && (
                              <p className="text-[13px] text-gray-400 truncate max-w-[220px]">{project.project_code}</p>
                            )}
                          </div>
                        </TableCell>
                        {/* 預計收入 */}
                        <TableCell className="text-right text-[15px] font-mono text-gray-700">{formatMoney(estimatedIncome)}</TableCell>
                        {/* 預計毛利 */}
                        <TableCell className={`text-right text-[15px] font-mono font-medium ${profitColor}`}>{formatMoney(estimatedProfit)}</TableCell>
                        {/* 主要承包商 */}
                        <TableCell>
                          <p className="text-[15px] text-gray-700 truncate max-w-[130px]">{proj.main_contractor_name || "-"}</p>
                        </TableCell>
                        {/* 主要PM及設計師 */}
                        <TableCell>
                          <div className="min-w-0">
                            <p className="text-[15px] text-gray-700">{project.pm_name || "-"}</p>
                            {project.designer_name && <p className="text-[13px] text-gray-400">{project.designer_name}</p>}
                          </div>
                        </TableCell>
                        {/* Status */}
                        <TableCell>
                          <ProjectStatusBadge status={project.status} className="text-[13px]" />
                        </TableCell>
                        {/* 出票受限 — yellow warning when WIP + Expense Control checklist fails */}
                        <TableCell className="text-center">
                          {expenseControlCell(
                            project.id,
                            project.status,
                            expenseStatusKnown,
                            expenseStatusPending
                          )}
                        </TableCell>
                        {/* Action */}
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                            {isDefectCrisis ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-[13px] gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                disabled={!canMarkProjectDone || !!markingDoneId}
                                title="設為項目完成 Project Done"
                                onClick={() => handleMarkProjectDone(project.id)}
                              >
                                {isMarkingDone ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                項目完成
                              </Button>
                            ) : (
                              proj.asana_link && (
                                <a href={proj.asana_link} target="_blank" rel="noopener noreferrer"
                                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors" title="Open Asana">
                                  <AsanaIcon size={16} />
                                </a>
                              )
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <span className="text-[14px] text-gray-500">每頁</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[70px] h-7 text-[14px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAGE_SIZES.map((s) => (<SelectItem key={s} value={String(s)}>{s}</SelectItem>))}</SelectContent>
                </Select>
                <span className="text-[14px] text-gray-400">
                  顯示 {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, sortedProjects.length)} / 共 {sortedProjects.length} 筆
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}><ChevronsLeft className="w-3.5 h-3.5" /></Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
                <span className="text-[14px] text-gray-500 px-2">{currentPage} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}><ChevronsRight className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
