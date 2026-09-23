"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  FolderOpen,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Sofa,
  Wallet,
  CalendarClock,
  MessageSquare,
} from "lucide-react";
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
  fetchBWFProjects,
  fetchBWFProjectFinancials,
  type BWAProjectRow,
  type ProjectFinancials} from "@/lib/data-service";
import {
  fetchBWFPaymentProgressReceivableMeta,
  PAYMENT_PROGRESS_AGING_DAYS,
  type BWFPaymentProgressReceivableMeta,
} from "@/lib/data/finance";
import {
  fetchBWFPaymentProgressOrderMeta,
  type BWFPaymentProgressOrderMeta,
} from "@/lib/data/bwf-orders";
import {
  fetchBWFOutstandingRemarkCards,
  type BWFOutstandingRemarkCard,
} from "@/lib/data/outstanding-remarks";
import { OutstandingRemarksPopover } from "@/components/accounting/OutstandingRemarksPanel";
import { PROJECT_DEFECT_DONE, PROJECT_DEFECT_FIXING } from "@/lib/bwf-defect-options";
import {
  PROJECT_STATUS_OPTIONS,
  projectStatusFilterLabel,
} from "@/lib/project-status-rules";
import { formatDate } from "@/lib/date-utils";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import BWFIncomeHistoryDialog from "@/components/projects/BWFIncomeHistoryDialog";

export type BWFProjectListVariant = "default" | "payment-progress";

type BWFProjectListProps = {
  /** default = full BWF project list; payment-progress = 收款進度 columns */
  variant?: BWFProjectListVariant;
};

// BWF has no project-type or B2B/B2C dimension, so those sort fields are omitted.
type SortField =
  | "project_code"
  | "p2_code"
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
  | "paid_percent"
  | "service_type_name"
  | "team_type_name"
  | "financial_year_name"
  | "designer_name"
  | "site_arrival_date"
  | "complete_installation_date"
  | "has_defect";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [20, 50, 100];

const UNPAID_DAYS_OPTIONS = [
  { label: "所有日數", value: "all" },
  { label: "> 30 Days", value: "30" },
  { label: "> 60 Days", value: "60" },
  { label: "> 90 Days", value: "90" },
  { label: "> 120 Days", value: "120" },
  { label: "> 180 Days", value: "180" },
];

const PAYMENT_STATUS_ZH: Record<string, string> = {
  "Pending Check": "待審核",
  "Payment Done": "收款完成",
  Received: "已收款",
  "Zoho Completed": "Zoho Completed",
  Paid: "已付",
  Outstanding: "待收款",
  "Payment in Schedule": "按計劃收款",
  "Chasing Final Payment": "追收尾款",
  "Payment in Risk": "收款風險",
};

function paymentStatusLabel(status: string | null): string | null {
  if (!status) return null;
  return PAYMENT_STATUS_ZH[status] || status;
}

function paidPercent(fin: ProjectFinancials | undefined): number {
  if (!fin || fin.total_sales <= 0) return 0;
  return Math.min(100, Math.round((fin.paid_sales / fin.total_sales) * 100));
}

function PaidPercentBar({ percent }: { percent: number }) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative w-[140px] h-5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
      <span
        className={`absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums ${
          pct >= 45 ? "text-white" : "text-gray-700"
        }`}
      >
        {pct}%
      </span>
    </div>
  );
}

function paymentStatusBadge(status: string | null) {
  const label = paymentStatusLabel(status);
  if (!label) return <span className="text-[14px] text-gray-400">-</span>;
  const s = (status || "").toLowerCase();
  if (s === "zoho completed")
    return <Badge className="bg-emerald-800 text-emerald-50 hover:bg-emerald-800 text-[13px] font-medium">{label}</Badge>;
  if (s.includes("done") || s.includes("received") || s === "paid")
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[13px] font-medium">{label}</Badge>;
  if (s.includes("risk") || s.includes("outstanding"))
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[13px] font-medium">{label}</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-[13px] font-medium">{label}</Badge>;
}

const PAYMENT_PROGRESS_COL_COUNT = 12;

function formatRemarkCardDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      timeZone: "Asia/Hong_Kong",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function PaymentRemarkCard({
  remark,
  isOwn,
}: {
  remark: BWFOutstandingRemarkCard;
  isOwn: boolean;
}) {
  return (
    <div
      className={`w-fit max-w-full rounded-lg px-2.5 py-1.5 ${
        isOwn ? "bg-emerald-50 border border-emerald-100" : "bg-blue-50 border border-blue-100"
      }`}
    >
      <p className="flex items-center justify-between gap-4">
        {isOwn ? (
          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
            我
          </span>
        ) : remark.creatorName ? (
          <span className="text-[11px] font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
            {remark.creatorName}
          </span>
        ) : null}
        {remark.createdDate && (
          <span className="text-[11px] text-gray-400 tabular-nums whitespace-nowrap ml-auto">
            {formatRemarkCardDate(remark.createdDate)}
          </span>
        )}
      </p>
      <p className="text-[13px] text-gray-700 leading-snug mt-1">{remark.remarks}</p>
    </div>
  );
}

// ─── Extended type for fields that may exist on the row ───
type ExtendedRow = BWAProjectRow & {
  asana_link?: string;
  real_customer_name?: string;
  cost_centre_bu_code?: string;
  p2_code?: string | null;
  os_project_defect?: string | null;
};

function uniqueSortedDateTimes(dates: string[]): number[] {
  return dates
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
}

function earliestDateTime(dates: string[] | undefined): number | null {
  const times = uniqueSortedDateTimes(dates ?? []);
  return times.length > 0 ? times[0] : null;
}

function hasPaymentProgressDefect(
  project: ExtendedRow,
  meta: BWFPaymentProgressOrderMeta | undefined,
): boolean {
  const defect = project.os_project_defect;
  if (defect === PROJECT_DEFECT_FIXING || defect === PROJECT_DEFECT_DONE) return true;
  return (meta?.defectOrderCount ?? 0) > 0;
}

function DateList({ dates }: { dates: string[] }) {
  if (dates.length === 0) return <span className="text-[14px] text-gray-400">-</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {dates.map((d) => (
        <span key={d} className="text-[14px] text-gray-700 font-mono whitespace-nowrap">
          {formatDate(d)}
        </span>
      ))}
    </div>
  );
}

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



// ─── MAIN COMPONENT ─────────────────────────────────────
export default function BWFProjectList({ variant = "default" }: BWFProjectListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: permLoading } = usePermission();
  const { profile, staff } = useAuth();
  const { formatMoney } = useFinancialFormat();
  const isPaymentProgress = variant === "payment-progress";
  const basePath = isPaymentProgress ? "/bwf/payment-progress" : "/bwf/projects";
  const [projects, setProjects] = useState<BWAProjectRow[]>([]);
  const [financials, setFinancials] = useState<Record<string, ProjectFinancials>>({});
  const [orderMeta, setOrderMeta] = useState<Record<string, BWFPaymentProgressOrderMeta>>({});
  const [receivableMeta, setReceivableMeta] = useState<Record<string, BWFPaymentProgressReceivableMeta>>({});
  const [remarkCards, setRemarkCards] = useState<Record<string, BWFOutstandingRemarkCard[]>>({});
  const [loading, setLoading] = useState(true);
  const [incomeDialogProject, setIncomeDialogProject] = useState<{
    id: string;
    project_code: string | null;
    project_name: string | null;
  } | null>(null);

  // ─── READ INITIAL STATE FROM URL PARAMS ────────────────
  const getParam = (key: string, fallback: string) => searchParams.get(key) || fallback;

  // Search
  const [search, setSearch] = useState(getParam("q", ""));

  // Filters — 項目狀態, 項目經理, BU, 服務類型, 項目規模, 財政年度
  const [statusFilter, setStatusFilter] = useState<string>(getParam("status", "all"));
  const [pmFilter, setPmFilter] = useState<string>(getParam("pm", "all"));
  const [buFilter, setBuFilter] = useState<string>(getParam("bu", "all"));
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>(getParam("service", "all"));
  const [projectSizeFilter, setProjectSizeFilter] = useState<string>(getParam("size", "all"));
  const [financialYearFilter, setFinancialYearFilter] = useState<string>(getParam("fy", "all"));
  const [unpaidDaysFilter, setUnpaidDaysFilter] = useState<string>(getParam("udays", "all"));
  const [collectionFilter, setCollectionFilter] = useState<string>(getParam("collect", "all"));
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(
    () => getParam("udays", "all") !== "all" || getParam("collect", "all") !== "all",
  );

  // Sort — payment-progress defaults to handover_date; default list to signed_date
  const defaultSort: SortField = isPaymentProgress ? "handover_date" : "signed_date";
  const [sortField, setSortField] = useState<SortField>((getParam("sort", defaultSort)) as SortField);
  const [sortDir, setSortDir] = useState<SortDir>((getParam("dir", "desc")) as SortDir);

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
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (pmFilter !== "all") params.set("pm", pmFilter);
    if (buFilter !== "all") params.set("bu", buFilter);
    if (serviceTypeFilter !== "all") params.set("service", serviceTypeFilter);
    if (projectSizeFilter !== "all") params.set("size", projectSizeFilter);
    if (financialYearFilter !== "all") params.set("fy", financialYearFilter);
    if (isPaymentProgress && unpaidDaysFilter !== "all") params.set("udays", unpaidDaysFilter);
    if (isPaymentProgress && collectionFilter !== "all") params.set("collect", collectionFilter);
    if (sortField !== defaultSort) params.set("sort", sortField);
    if (sortDir !== "desc") params.set("dir", sortDir);
    if (currentPage !== 1) params.set("page", String(currentPage));
    if (pageSize !== 20) params.set("ps", String(pageSize));

    const qs = params.toString();
    const newUrl = qs ? `${basePath}?${qs}` : basePath;
    router.replace(newUrl, { scroll: false });
  }, [search, statusFilter, pmFilter, buFilter, serviceTypeFilter, projectSizeFilter, financialYearFilter, unpaidDaysFilter, collectionFilter, isPaymentProgress, sortField, sortDir, currentPage, pageSize, basePath, defaultSort, router]);

  // ─── LOAD DATA ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setFinancials({});
    setOrderMeta({});
    setReceivableMeta({});
    setRemarkCards({});
    const data = await fetchBWFProjects();
    setProjects(data);
    // Default list uses estimated_income / estimated_profit from the project row.
    // Payment-progress still needs async financials for 總收入 / 已收%.
    if (isPaymentProgress) {
      const projectIds = data.map((p) => p.id).filter(Boolean);
      if (projectIds.length > 0) {
        const [fin, meta, recv, remarks] = await Promise.all([
          fetchBWFProjectFinancials(projectIds),
          fetchBWFPaymentProgressOrderMeta(projectIds),
          fetchBWFPaymentProgressReceivableMeta(projectIds),
          fetchBWFOutstandingRemarkCards(projectIds),
        ]);
        setFinancials(fin);
        setOrderMeta(meta);
        setReceivableMeta(recv);
        setRemarkCards(remarks);
      }
    }
    setLoading(false);
  }, [isPaymentProgress]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── UNIQUE VALUES FOR FILTERS ─────────────────────
  const filterOptions = useMemo(() => {
    const pms = Array.from(new Set(projects.map((p) => p.pm_name).filter((x): x is string => !!x)));
    const bus = Array.from(new Set(projects.map((p) => (p as ExtendedRow).cost_centre_bu_code).filter((x): x is string => !!x)));
    const serviceTypes = Array.from(
      new Set(
        projects.flatMap((p) =>
          p.service_type_name
            ? p.service_type_name.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
        ),
      ),
    );
    const fys = Array.from(new Set(projects.map((p) => p.financial_year_name).filter((x): x is string => !!x)));
    return { pms, bus, serviceTypes, fys };
  }, [projects]);

  // Project size ranges (by estimated income)
  const projectSizeRanges = [
    { label: "所有項目規模", value: "all" },
    { label: "< $500K", value: "lt500k" },
    { label: "$500K - $1M", value: "500k-1m" },
    { label: "$1M - $3M", value: "1m-3m" },
    { label: "$3M - $5M", value: "3m-5m" },
    { label: "> $5M", value: "gt5m" },
  ];

  // ─── FILTER + SEARCH ──────────────────────────────
  const baseFilteredProjects = useMemo(() => {
    let result = projects;
    if (statusFilter !== "all") result = result.filter((p) => p.status === statusFilter);
    if (pmFilter !== "all") result = result.filter((p) => p.pm_name === pmFilter);
    if (buFilter !== "all") result = result.filter((p) => (p as ExtendedRow).cost_centre_bu_code === buFilter);
    if (serviceTypeFilter !== "all") {
      result = result.filter((p) => {
        if (!p.service_type_name) return false;
        return p.service_type_name
          .split(",")
          .map((s) => s.trim())
          .includes(serviceTypeFilter);
      });
    }
    if (financialYearFilter !== "all") result = result.filter((p) => p.financial_year_name === financialYearFilter);
    if (projectSizeFilter !== "all") {
      result = result.filter((p) => {
        const income = p.estimated_income || 0;
        switch (projectSizeFilter) {
          case "lt500k": return income < 500000;
          case "500k-1m": return income >= 500000 && income < 1000000;
          case "1m-3m": return income >= 1000000 && income < 3000000;
          case "3m-5m": return income >= 3000000 && income < 5000000;
          case "gt5m": return income >= 5000000;
          default: return true;
        }
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.project_code && p.project_code.toLowerCase().includes(q)) ||
          ((p as ExtendedRow).p2_code?.toLowerCase().includes(q)) ||
          (p.project_name && p.project_name.toLowerCase().includes(q)) ||
          (p.customer_name && p.customer_name.toLowerCase().includes(q)) ||
          (p.customer_display_name && p.customer_display_name.toLowerCase().includes(q)) ||
          (p.pm_name && p.pm_name.toLowerCase().includes(q)) ||
          (p.district_name && p.district_name.toLowerCase().includes(q)) ||
          (p.building_name && p.building_name.toLowerCase().includes(q)) ||
          (p.site_address && p.site_address.toLowerCase().includes(q)) ||
          (p.service_type_name && p.service_type_name.toLowerCase().includes(q)) ||
          ((p as ExtendedRow).cost_centre_bu_code?.toLowerCase().includes(q)) ||
          ((p as ExtendedRow).real_customer_name?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [projects, statusFilter, pmFilter, buFilter, serviceTypeFilter, projectSizeFilter, financialYearFilter, search]);

  const filteredProjects = useMemo(() => {
    let result = baseFilteredProjects;
    if (isPaymentProgress && collectionFilter === "unpaid") {
      result = result.filter((p) => receivableMeta[p.id]?.hasUnpaid === true);
    }
    if (isPaymentProgress && unpaidDaysFilter !== "all") {
      const minDays = Number(unpaidDaysFilter);
      result = result.filter((p) => {
        const days = receivableMeta[p.id]?.maxUnpaidDays;
        return days != null && days > minDays;
      });
    }
    return result;
  }, [baseFilteredProjects, isPaymentProgress, collectionFilter, unpaidDaysFilter, receivableMeta]);

  // ─── SORT ─────────────────────────────────────────
  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects];
    sorted.sort((a, b) => {
      if (sortField === "estimated_income" && isPaymentProgress) {
        // Payment-progress 總收入 — sum of related incomes.income_amount
        const aVal = financials[a.id]?.total_sales || 0;
        const bVal = financials[b.id]?.total_sales || 0;
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (sortField === "paid_percent") {
        const aVal = paidPercent(financials[a.id]);
        const bVal = paidPercent(financials[b.id]);
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (sortField === "payment_status") {
        const aVal =
          a.payment_status || financials[a.id]?.income_payment_status || "";
        const bVal =
          b.payment_status || financials[b.id]?.income_payment_status || "";
        const cmp = String(aVal).localeCompare(String(bVal), "zh-HK");
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortField === "site_arrival_date" || sortField === "complete_installation_date") {
        const key = sortField === "site_arrival_date" ? "siteArrivalDates" : "installationDates";
        const aVal = earliestDateTime(orderMeta[a.id]?.[key]);
        const bVal = earliestDateTime(orderMeta[b.id]?.[key]);
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (sortField === "has_defect") {
        const aVal = hasPaymentProgressDefect(a as ExtendedRow, orderMeta[a.id]) ? 1 : 0;
        const bVal = hasPaymentProgressDefect(b as ExtendedRow, orderMeta[b.id]) ? 1 : 0;
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
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
  }, [filteredProjects, sortField, sortDir, financials, isPaymentProgress, orderMeta]);

  // ─── PAGINATION ───────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedProjects.length / pageSize));
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedProjects.slice(start, start + pageSize);
  }, [sortedProjects, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, pmFilter, buFilter, serviceTypeFilter, projectSizeFilter, financialYearFilter, unpaidDaysFilter, collectionFilter, pageSize]);

  const toggleSort = (field: SortField) => {
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
    setStatusFilter("all");
    setPmFilter("all");
    setBuFilter("all");
    setServiceTypeFilter("all");
    setProjectSizeFilter("all");
    setFinancialYearFilter("all");
    setUnpaidDaysFilter("all");
    setCollectionFilter("all");
  };

  const hasActiveFilters =
    search.trim() !== "" || statusFilter !== "all" || pmFilter !== "all" ||
    buFilter !== "all" || serviceTypeFilter !== "all" || projectSizeFilter !== "all" ||
    financialYearFilter !== "all" ||
    (isPaymentProgress && unpaidDaysFilter !== "all") ||
    (isPaymentProgress && collectionFilter !== "all");

  // ─── KPI STATS ────────────────────────────────────
  const kpiStats = useMemo(() => {
    const total = filteredProjects.length;
    const activeStatuses = ["active", "進行", "progress", "in progress", "work_in_progress"];
    const active = filteredProjects.filter((p) =>
      p.status && activeStatuses.some((s) => p.status!.toLowerCase().includes(s))
    ).length;
    const completed = filteredProjects.filter((p) =>
      p.status && (p.status.toLowerCase().includes("done") || p.status.toLowerCase().includes("completed") || p.status.toLowerCase().includes("closed") || p.status.toLowerCase().includes("完成"))
    ).length;
    return { total, active, completed };
  }, [filteredProjects]);

  const paymentKpi = useMemo(() => {
    const total = baseFilteredProjects.length;
    let unpaidCount = 0;
    let unpaidAmount = 0;
    const aging = PAYMENT_PROGRESS_AGING_DAYS.map((days) => ({
      days,
      count: 0,
      amount: 0,
    }));
    for (const p of baseFilteredProjects) {
      const meta = receivableMeta[p.id];
      if (!meta?.hasUnpaid) continue;
      unpaidCount += 1;
      unpaidAmount += meta.unpaidAmount;
      for (const bucket of aging) {
        if (meta.maxUnpaidDays != null && meta.maxUnpaidDays > bucket.days) {
          bucket.count += 1;
        }
        bucket.amount += meta.amountOverDays[bucket.days] || 0;
      }
    }
    return { total, unpaidCount, unpaidAmount, aging };
  }, [baseFilteredProjects, receivableMeta]);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Sofa className="w-6 h-6 text-yellow-500" />
            {isPaymentProgress ? "收款進度 Payment Progress" : "項目 Projects"}
            <Badge className="bg-yellow-500 text-white hover:bg-yellow-500 text-[12px] px-2 py-0 font-bold rounded-md ml-1">BWF</Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isPaymentProgress
              ? "追蹤傢俬項目收款進度。 Track furniture project income collection progress."
              : "管理所有傢俬項目。 Manage all furniture projects."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="h-9 gap-1.5 text-[15px]">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 重新整理
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {isPaymentProgress ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <button
            type="button"
            className={`text-left bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 transition-all hover:shadow-md ${
              collectionFilter === "unpaid" ? "border-l-red-500 ring-1 ring-red-100" : "border-l-red-500"
            }`}
            onClick={() => {
              setCollectionFilter(collectionFilter === "unpaid" ? "all" : "unpaid");
              setShowAdvancedFilters(true);
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-gray-500 truncate">未收款項目 / 總數</p>
                <p className="text-xl font-bold text-gray-900 font-mono-num">
                  {paymentKpi.unpaidCount} / {paymentKpi.total}
                </p>
                <p className="text-[13px] text-gray-400 mt-0.5 font-mono-num">
                  未收款 {formatMoney(paymentKpi.unpaidAmount)}
                </p>
              </div>
            </div>
          </button>
          <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-amber-500">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500">
                <CalendarClock className="w-5 h-5 text-white" />
              </div>
              <p className="text-[15px] text-gray-500">未收款日數及金額</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {paymentKpi.aging.map((bucket) => {
                const active = unpaidDaysFilter === String(bucket.days);
                return (
                  <button
                    key={bucket.days}
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-amber-400 bg-amber-50"
                        : "border-gray-100 hover:border-amber-200 hover:bg-amber-50/50"
                    }`}
                    onClick={() => {
                      setUnpaidDaysFilter(active ? "all" : String(bucket.days));
                      setShowAdvancedFilters(true);
                    }}
                  >
                    <p className="text-[13px] text-gray-500">{`> ${bucket.days} Days`}</p>
                    <p className="text-[15px] font-semibold text-gray-900 font-mono-num mt-0.5">
                      {bucket.count} 項
                    </p>
                    <p className="text-[13px] text-gray-600 font-mono-num">
                      {formatMoney(bucket.amount)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={FolderOpen} label="總項目數" value={kpiStats.total} subLabel={`篩選中 ${filteredProjects.length} / 全部 ${projects.length}`} color="bg-blue-500" borderColor="border-l-blue-500" />
          <StatCard icon={Clock} label="進行中項目" value={kpiStats.active} color="bg-amber-500" borderColor="border-l-amber-500" />
          <StatCard icon={CheckCircle2} label="已完成項目" value={kpiStats.completed} color="bg-teal-500" borderColor="border-l-teal-500" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search all columns..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-[15px]" />
          </div>

          {/* 項目狀態 */}
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

          {/* 項目經理 */}
          <Select value={pmFilter} onValueChange={setPmFilter}>
            <SelectTrigger className="w-[140px] h-9 text-[15px]"><SelectValue placeholder="項目經理" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有PM</SelectItem>
              {filterOptions.pms.sort().map((pm) => (<SelectItem key={pm} value={pm}>{pm}</SelectItem>))}
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

        {/* Advanced filters: BU, 服務類型, 項目規模, 財政年度 */}
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
              <span className="text-[13px] text-gray-400 font-medium">項目規模</span>
              <Select value={projectSizeFilter} onValueChange={setProjectSizeFilter}>
                <SelectTrigger className="w-[150px] h-9 text-[15px]"><SelectValue placeholder="項目規模" /></SelectTrigger>
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
            {isPaymentProgress && (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-gray-400 font-medium">未收款日數</span>
                  <Select value={unpaidDaysFilter} onValueChange={setUnpaidDaysFilter}>
                    <SelectTrigger className="w-[150px] h-9 text-[15px]"><SelectValue placeholder="未收款日數" /></SelectTrigger>
                    <SelectContent>
                      {UNPAID_DAYS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-gray-400 font-medium">收款情況</span>
                  <Select value={collectionFilter} onValueChange={setCollectionFilter}>
                    <SelectTrigger className="w-[150px] h-9 text-[15px]"><SelectValue placeholder="收款情況" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部訂單</SelectItem>
                      <SelectItem value="unpaid">未收款</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
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
              <Button variant="link" size="sm" onClick={clearFilters} className="text-[15px] text-rose-500">清除篩選條件</Button>
            )}
          </div>
        ) : (
          <>
            <div className={isPaymentProgress ? "overflow-x-hidden" : "overflow-x-auto"}>
              <Table className={isPaymentProgress ? "table-fixed" : undefined}>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    {isPaymentProgress ? (
                      <>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[10%]" onClick={() => toggleSort("project_code")}>
                          <span className="flex items-center">項目編號 <SortIcon field="project_code" /></span>
                        </TableHead>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[13%]" onClick={() => toggleSort("project_name")}>
                          <span className="flex items-center">項目名稱 <SortIcon field="project_name" /></span>
                        </TableHead>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[8%]" onClick={() => toggleSort("pm_name")}>
                          <span className="flex items-center">項目經理 <SortIcon field="pm_name" /></span>
                        </TableHead>
                        <TableHead className="text-right text-[14px] font-semibold cursor-pointer select-none w-[8%]" onClick={() => toggleSort("estimated_income")}>
                          <span className="flex items-center justify-end">總收入 <SortIcon field="estimated_income" /></span>
                        </TableHead>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[12%]" onClick={() => toggleSort("paid_percent")}>
                          <span className="flex items-center">已收% <SortIcon field="paid_percent" /></span>
                        </TableHead>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[8%]" onClick={() => toggleSort("payment_status")}>
                          <span className="flex items-center">收款狀態 <SortIcon field="payment_status" /></span>
                        </TableHead>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[7%]" onClick={() => toggleSort("status")}>
                          <span className="flex items-center">狀態 <SortIcon field="status" /></span>
                        </TableHead>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[5%]" onClick={() => toggleSort("has_defect")}>
                          <span className="flex items-center">Defect <SortIcon field="has_defect" /></span>
                        </TableHead>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[7%]" onClick={() => toggleSort("handover_date")}>
                          <span className="flex items-center">交付日期 <SortIcon field="handover_date" /></span>
                        </TableHead>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[7%]" onClick={() => toggleSort("site_arrival_date")}>
                          <span className="flex items-center">送貨日期 <SortIcon field="site_arrival_date" /></span>
                        </TableHead>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[7%]" onClick={() => toggleSort("complete_installation_date")}>
                          <span className="flex items-center">安裝日期 <SortIcon field="complete_installation_date" /></span>
                        </TableHead>
                        <TableHead className="w-[8%] text-[14px] font-semibold text-center">操作</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[100px]" onClick={() => toggleSort("signed_date")}>
                          <span className="flex items-center">簽約日期 <SortIcon field="signed_date" /></span>
                        </TableHead>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[100px]" onClick={() => toggleSort("service_type_name")}>
                          <span className="flex items-center">服務類型 <SortIcon field="service_type_name" /></span>
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
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[140px]" onClick={() => toggleSort("p2_code")}>
                          <span className="flex items-center">P2 Code <SortIcon field="p2_code" /></span>
                        </TableHead>
                        <TableHead className="text-right text-[14px] font-semibold cursor-pointer select-none" onClick={() => toggleSort("estimated_income")}>
                          <span className="flex items-center justify-end">預計收入 <SortIcon field="estimated_income" /></span>
                        </TableHead>
                        <TableHead className="text-right text-[14px] font-semibold cursor-pointer select-none" onClick={() => toggleSort("estimated_profit")}>
                          <span className="flex items-center justify-end">預計毛利 <SortIcon field="estimated_profit" /></span>
                        </TableHead>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none min-w-[140px]" onClick={() => toggleSort("pm_name")}>
                          <span className="flex items-center">主要PM及設計師 <SortIcon field="pm_name" /></span>
                        </TableHead>
                        <TableHead className="text-[14px] font-semibold cursor-pointer select-none w-[100px]" onClick={() => toggleSort("status")}>
                          <span className="flex items-center">Status <SortIcon field="status" /></span>
                        </TableHead>
                        <TableHead className="w-[100px] text-[14px] font-semibold text-center">Action</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProjects.map((project) => {
                    const proj = project as ExtendedRow;
                    const fin = financials[project.id];
                    const actualIncome = fin ? fin.total_sales : 0;
                    const estimatedIncome = project.estimated_income || 0;
                    const estimatedProfit = project.estimated_profit || 0;
                    const profitColor = estimatedProfit !== 0 ? (estimatedProfit >= 0 ? "text-emerald-600" : "text-red-600") : "text-gray-400";
                    const pct = paidPercent(fin);
                    const payStatus =
                      project.payment_status || fin?.income_payment_status || null;

                    const projectRemarks = remarkCards[project.id] ?? [];

                    return (
                      <React.Fragment key={project.id}>
                      <TableRow
                        className={`group cursor-pointer transition-all hover:bg-gray-50/50 ${isPaymentProgress ? "border-b-0" : ""}`}
                        onClick={() => window.open(`/bwf/projects/${project.id}`, "_blank", "noopener")}
                      >
                        {isPaymentProgress ? (
                          <>
                            <TableCell>
                              <span className="text-[14px] text-gray-800 font-mono whitespace-nowrap">
                                {project.project_code || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <p className="text-[15px] text-gray-700 truncate" title={project.project_name || undefined}>
                                {project.project_name || "-"}
                              </p>
                            </TableCell>
                            <TableCell>
                              <span className="text-[14px] text-gray-700 whitespace-nowrap">
                                {project.pm_name || "-"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-[15px] font-mono text-gray-700">
                              {formatMoney(actualIncome)}
                            </TableCell>
                            <TableCell>
                              <PaidPercentBar percent={pct} />
                            </TableCell>
                            <TableCell>{paymentStatusBadge(payStatus)}</TableCell>
                            <TableCell>
                              <ProjectStatusBadge status={project.status} className="text-[13px]" />
                            </TableCell>
                            <TableCell>
                              {hasPaymentProgressDefect(proj, orderMeta[project.id]) ? (
                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[13px] font-medium">有</Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-500 text-[13px] font-medium">沒有</Badge>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {project.handover_date ? (
                                <span className="text-[14px] text-gray-700 font-mono">
                                  {formatDate(project.handover_date)}
                                </span>
                              ) : (
                                <span className="text-[14px] text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <DateList dates={orderMeta[project.id]?.siteArrivalDates ?? []} />
                            </TableCell>
                            <TableCell>
                              <DateList dates={orderMeta[project.id]?.installationDates ?? []} />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                  title="查看收款紀錄"
                                  onClick={() =>
                                    setIncomeDialogProject({
                                      id: project.id,
                                      project_code: project.project_code,
                                      project_name: project.project_name,
                                    })
                                  }
                                >
                                  <Search className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                  title="開啟項目"
                                  onClick={() =>
                                    window.open(`/bwf/projects/${project.id}`, "_blank", "noopener")
                                  }
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
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
                            {/* 服務類型 */}
                            <TableCell>
                              {project.service_type_name ? (
                                <span className="text-[14px] text-gray-700">
                                  {project.service_type_name}
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
                            {/* P2 Code */}
                            <TableCell>
                              {proj.p2_code ? (
                                <span className="text-[14px] text-gray-700 font-mono whitespace-nowrap">{proj.p2_code}</span>
                              ) : (
                                <span className="text-[14px] text-gray-400">-</span>
                              )}
                            </TableCell>
                            {/* 預計收入 */}
                            <TableCell className="text-right text-[15px] font-mono text-gray-700">{formatMoney(estimatedIncome)}</TableCell>
                            {/* 預計毛利 */}
                            <TableCell className={`text-right text-[15px] font-mono font-medium ${profitColor}`}>{formatMoney(estimatedProfit)}</TableCell>
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
                            {/* Action — Asana link */}
                            <TableCell>
                              <div className="flex items-center gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                                {proj.asana_link && (
                                  <a href={proj.asana_link} target="_blank" rel="noopener noreferrer"
                                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors" title="Open Asana">
                                    <AsanaIcon size={16} />
                                  </a>
                                )}
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                      {isPaymentProgress && (
                        <TableRow className="bg-gray-50/70 hover:bg-gray-50/70">
                          <TableCell colSpan={PAYMENT_PROGRESS_COL_COUNT} className="py-2">
                            <div className="flex items-start gap-3" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[13px] text-gray-400 font-medium whitespace-nowrap pt-1.5">收款備註</span>
                              <div className="flex flex-row flex-wrap items-start gap-2 min-w-0 flex-1">
                                {projectRemarks.length === 0 ? (
                                  <span className="text-[13px] text-gray-400 pt-1.5">暫無收款備註</span>
                                ) : (
                                  projectRemarks.map((remark) => (
                                    <PaymentRemarkCard
                                      key={remark.id}
                                      remark={remark}
                                      isOwn={
                                        !!remark.createdById &&
                                        (remark.createdById === profile?.id ||
                                          remark.createdById === staff?.id)
                                      }
                                    />
                                  ))
                                )}
                              </div>
                              <OutstandingRemarksPopover
                                projectId={project.id}
                                projectName={project.project_name}
                                projectCode={project.project_code}
                                onChanged={async () => {
                                  const latest = await fetchBWFOutstandingRemarkCards([project.id]);
                                  setRemarkCards((prev) => ({ ...prev, ...latest }));
                                }}
                              >
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-gray-200 bg-white text-[13px] text-gray-600 hover:bg-gray-100 hover:text-gray-800 shrink-0"
                                  title="編輯收款備註"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  收款備註
                                </button>
                              </OutstandingRemarksPopover>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </React.Fragment>
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

      {isPaymentProgress && (
        <BWFIncomeHistoryDialog
          open={!!incomeDialogProject}
          onOpenChange={(open) => {
            if (!open) setIncomeDialogProject(null);
          }}
          projectId={incomeDialogProject?.id ?? null}
          projectCode={incomeDialogProject?.project_code}
          projectName={incomeDialogProject?.project_name}
          onDataChanged={loadData}
        />
      )}
    </div>
  );
}
