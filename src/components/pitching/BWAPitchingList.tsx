"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Plus,
  DollarSign,
  FolderOpen,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  TrendingUp,
  BarChart3,
  ArrowUpDown,
  Volume2,
  Clock,
  Focus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PitchingStageBadge } from "@/components/ui/entity-status-badges";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchBWAPitchingsPaginated,
  fetchBWFPitchingsPaginated,
  fetchPitchingFilterOptions,
  fetchPitchingKPIStats,
  fetchBWFPitchingKPIStats,
  fetchPMStaffOptions,
  type BWAPitchingRow,
  type PaginatedResult,
  type PitchingFilters,
  type PitchingFilterOptions,
  type PitchingKPIStats,
  type PitchingStaffContext,
  type LinkOption,
} from "@/lib/data-service";
import { getPitchingManHourTotalsByIds } from "@/lib/man-hour-service";
import { BWA_PROJECT_SIZE_FILTER_OPTIONS } from "@/lib/bwa-project-size";
import BWAPitchingDialog from "./BWAPitchingDialog";
import BWFPitchingDialog from "./BWFPitchingDialog";
import ListLogicPanel from "@/components/furniture/ListLogicPanel";
import { useNavigate } from "@/hooks/use-navigate";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { useToast } from "@/components/ui/use-toast";
import { AsanaLinkButton } from "@/components/ui/asana-link-button";

type SortField =
  | "pitching_code"
  | "customer_name"
  | "pm_name"
  | "designer_name"
  | "district_name"
  | "size"
  | "enquiry_date"
  | "estimated_income"
  | "estimated_expense"
  | "estimated_profit"
  | "pitching_stages"
  | "service_type_name"
  | "team_type_name"
  | "financial_year_name"
  | "days_remaining"
  | "project_types_name"
  | "major_quote_display";
type SortDir = "asc" | "desc";

export type PitchingListVariant = "bwa" | "bwf" | "major-inquiry" | "key-pitching";

/** Fixed threshold for 重點 Pitching (sum of related pitching man hours). */
export const KEY_PITCHING_MIN_MAN_HOUR_SUM = 10;

const PAGE_SIZES = [20, 50, 100];

// ─── STAT CARD ─────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  subLabel,
  color,
  borderColor,
}: {
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

import { formatDateShort as formatDate } from "@/lib/date-utils";

function formatSize(actualSize: string | null): string {
  if (actualSize) return `${actualSize} ft`;
  return "N/A";
}

// ─── DAYS REMAINING HELPER ──────────────────────────────
const PITCHING_DEADLINE_DAYS = 90;

/**
 * Calculate days remaining until the 90-day deadline.
 * Returns:
 *   "N/A" — if enquiry_date is in the future (not yet started)
 *   number — days remaining (negative = overdue)
 *   null   — if no usable date at all
 */
function calcDaysRemaining(enquiryDate: string | null, createdDate: string | null): number | "N/A" | null {
  // Use enquiry_date if available, otherwise fall back to created_date
  const baseDate = enquiryDate || createdDate;
  if (!baseDate) return null;
  try {
    const base = new Date(baseDate);
    base.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If enquiry_date exists and is in the future → N/A
    if (enquiryDate && base.getTime() > today.getTime()) return "N/A";

    const deadline = new Date(base);
    deadline.setDate(deadline.getDate() + PITCHING_DEADLINE_DAYS);
    return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function DaysRemainingBadge({ days }: { days: number | "N/A" | null }) {
  if (days === null) return <span className="text-gray-400 text-[15px]">-</span>;
  if (days === "N/A") return <span className="text-gray-400 text-[15px] font-medium">N/A</span>;

  let bgColor: string;
  let textColor: string;
  let label: string;

  if (days < 0) {
    bgColor = "bg-red-100";
    textColor = "text-red-700";
    label = `逾期 ${Math.abs(days)} 天`;
  } else if (days === 0) {
    bgColor = "bg-red-100";
    textColor = "text-red-700";
    label = "今日到期";
  } else if (days <= 7) {
    bgColor = "bg-red-50";
    textColor = "text-red-600";
    label = `${days} 天`;
  } else if (days <= 30) {
    bgColor = "bg-amber-50";
    textColor = "text-amber-700";
    label = `${days} 天`;
  } else {
    bgColor = "bg-green-50";
    textColor = "text-green-700";
    label = `${days} 天`;
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[14px] font-medium rounded-full px-2.5 py-1 ${bgColor} ${textColor}`}>
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function BWAPitchingList({
  variant = "bwa",
}: {
  variant?: PitchingListVariant;
}) {
  const isMajorInquiry = variant === "major-inquiry";
  const isKeyPitching = variant === "key-pitching";
  // major-inquiry reuses the BWF pitching list UI + fetchers, with an extra filter/column.
  const isBwf = variant === "bwf" || isMajorInquiry;
  // Detail/convert links + which paginated fetcher to use per system.
  // key-pitching reuses BWA proposals list + /proposals/{id} detail.
  const detailBase = isBwf ? "/bwf/proposals" : "/proposals";
  const permissionModule = isMajorInquiry
    ? "major-inquiry"
    : isKeyPitching
      ? "key-pitching"
      : isBwf
        ? "bwf/proposals"
        : "proposals";
  const fetchPaginated = isBwf ? fetchBWFPitchingsPaginated : fetchBWAPitchingsPaginated;
  const fetchKpi = isBwf ? fetchBWFPitchingKPIStats : fetchPitchingKPIStats;
  const { navigate } = useNavigate();
  const { canView, canCreate, canEdit, canDelete, checkRule, loading: permLoading } = usePermission();
  const { staff } = useAuth();
  const { formatMoney } = useFinancialFormat();
  const { toast } = useToast();
  const moneyOpts = { fallback: "N/A", decimals: 2 } as const;
  const [paginatedResult, setPaginatedResult] = useState<PaginatedResult<BWAPitchingRow>>({
    data: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  // Search (debounced)
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filters (now using IDs for server-side filtering)
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [pmFilter, setPmFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [financialYearFilter, setFinancialYearFilter] = useState<string>("all");
  const [osMoneySizeFilter, setOsMoneySizeFilter] = useState<string>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<SortField>("enquiry_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPitching, setEditingPitching] = useState<BWAPitchingRow | null>(null);

  // Filter options (loaded once, cached)
  const [filterOptions, setFilterOptions] = useState<PitchingFilterOptions>({
    stages: [], pms: [], teams: [], serviceTypes: [], districts: [], financialYears: [],
  });
  const [filterOptionsLoaded, setFilterOptionsLoaded] = useState(false);

  // Full PM staff list (same source as the create-pitching Main PM dropdown),
  // so the PM filter shows every PM — not only those present in pitching rows.
  const [pmOptions, setPmOptions] = useState<LinkOption[]>([]);

  // KPI stats (loaded once, refreshed on demand)
  const [kpiStats, setKpiStats] = useState<PitchingKPIStats>({
    totalPitchings: 0, activePitchings: 0, totalEstimatedIncome: 0, totalEstimatedExpense: 0, wonPitchings: 0, endedPitchings: 0,
  });

  // Page-scoped man-hour totals (pitching job_type only)
  const [manHourTotals, setManHourTotals] = useState<Record<string, number>>({});
  const [manHourTotalsLoading, setManHourTotalsLoading] = useState(false);

  // ─── Debounce search ────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Load filter options once ───────────────────────
  useEffect(() => {
    if (!filterOptionsLoaded) {
      fetchPitchingFilterOptions().then((opts) => {
        setFilterOptions(opts);
        setFilterOptionsLoaded(true);
      }).catch((err) => {
        console.error("[BWAPitchingList] fetchPitchingFilterOptions error:", err);
        setFilterOptionsLoaded(true);
      });
      fetchPMStaffOptions().then(setPmOptions).catch(() => {});
    }
  }, [filterOptionsLoaded]);

  // ─── Fetch data (server-side paginated) ─────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: PitchingFilters = {
        search: debouncedSearch || undefined,
        stage: stageFilter !== "all" ? stageFilter : undefined,
        pm: pmFilter !== "all" ? pmFilter : undefined,
        team: teamFilter !== "all" ? teamFilter : undefined,
        serviceType: serviceTypeFilter !== "all" ? serviceTypeFilter : undefined,
        district: districtFilter !== "all" ? districtFilter : undefined,
        financialYear: financialYearFilter !== "all" ? financialYearFilter : undefined,
        osMoneySize: !isBwf && osMoneySizeFilter !== "all" ? osMoneySizeFilter : undefined,
        requireMajorQuote: isMajorInquiry || undefined,
        minManHourSum: isKeyPitching ? KEY_PITCHING_MIN_MAN_HOUR_SUM : undefined,
        sortField,
        sortDir,
      };

      // BWA list: role-based row filtering for User / Senior User.
      // BWF / major-inquiry: show all matching pitchings (page access still gated by permission matrix).
      const staffContext: PitchingStaffContext | undefined =
        !isBwf && staff?.id
          ? {
              staffId: staff.id,
              role: (staff as any)?.role || null,
              teamTypeId: (staff as any)?.n_team_type_id || null,
            }
          : undefined;

      const result = await fetchPaginated(currentPage, pageSize, filters, staffContext);
      setPaginatedResult(result);

      // Keep the headline KPI numbers in sync with the filtered list (the
      // KPI query ignores pagination/sort and aggregates ALL matching rows).
      fetchKpi(filters, staffContext)
        .then(setKpiStats)
        .catch((err) => console.error("[BWAPitchingList] fetchKpi error:", err));
    } catch (err) {
      console.error("[BWAPitchingList] loadData error:", err);
      setPaginatedResult({ data: [], totalCount: 0, page: currentPage, pageSize, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, stageFilter, pmFilter, teamFilter, serviceTypeFilter, districtFilter, financialYearFilter, osMoneySizeFilter, sortField, sortDir, staff, isBwf, isMajorInquiry, isKeyPitching, fetchPaginated, fetchKpi]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Load man-hour totals for current page rows ─────
  useEffect(() => {
    const ids = paginatedResult.data.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) {
      setManHourTotals({});
      setManHourTotalsLoading(false);
      return;
    }

    let cancelled = false;
    setManHourTotalsLoading(true);
    getPitchingManHourTotalsByIds(ids)
      .then((totals) => {
        if (!cancelled) setManHourTotals(totals);
      })
      .catch((err) => {
        console.error("[BWAPitchingList] getPitchingManHourTotalsByIds error:", err);
        if (!cancelled) setManHourTotals({});
      })
      .finally(() => {
        if (!cancelled) setManHourTotalsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [paginatedResult.data]);

  // ─── Reset page when filters change ────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [stageFilter, pmFilter, teamFilter, serviceTypeFilter, districtFilter, financialYearFilter, osMoneySizeFilter, pageSize]);

  // Count active filters
  const activeFilterCount = [
    stageFilter,
    pmFilter,
    teamFilter,
    serviceTypeFilter,
    districtFilter,
    financialYearFilter,
    ...(isBwf ? [] : [osMoneySizeFilter]),
  ].filter((f) => f !== "all").length;

  // Clear all filters
  const clearAllFilters = () => {
    setStageFilter("all");
    setPmFilter("all");
    setTeamFilter("all");
    setServiceTypeFilter("all");
    setDistrictFilter("all");
    setFinancialYearFilter("all");
    setOsMoneySizeFilter("all");
    setSearch("");
    setDebouncedSearch("");
    setCurrentPage(1);
  };

  // Refresh handler (reloads data + KPI)
  const handleRefresh = useCallback(async () => {
    setFilterOptionsLoaded(false);
    loadData();
  }, [loadData]);

  // ─── Derived data ───────────────────────────────────
  const { data: paginatedData, totalCount, totalPages } = paginatedResult;
  const { totalPitchings, activePitchings, totalEstimatedIncome, totalEstimatedExpense, wonPitchings, endedPitchings } = kpiStats;
  const totalEstimatedProfit = totalEstimatedIncome - totalEstimatedExpense;
  // Hit rate over "ended" pitchings only (Confirmed Project + Case Closed).
  const winRate = endedPitchings > 0 ? Math.round((wonPitchings / endedPitchings) * 100) : 0;

  // ─── Sort toggle ────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 inline ml-1 text-gray-300" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 inline ml-1 text-blue-500" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1 text-blue-500" />
    );
  };

  // Permission guard
  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ────── Page Header ────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            {isKeyPitching ? (
              <Focus className="w-6 h-6 text-amber-500" />
            ) : (
              <Volume2 className={`w-6 h-6 ${isBwf ? "text-fuchsia-500" : "text-cyan-500"}`} />
            )}
            {isKeyPitching
              ? "重點 Pitching"
              : isMajorInquiry
                ? "主要查詢列表"
                : "提案 Pitching"}
            <Badge className={`text-white text-[12px] px-2 py-0 font-bold rounded-md ml-1 ${
              isKeyPitching
                ? "bg-amber-500 hover:bg-amber-500"
                : isBwf
                  ? "bg-fuchsia-500 hover:bg-fuchsia-500"
                  : "bg-cyan-500 hover:bg-cyan-500"
            }`}>
              {isBwf ? "BWF" : "BWA"}
            </Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isKeyPitching
              ? `顯示相關工時合計超過 ${KEY_PITCHING_MIN_MAN_HOUR_SUM} 小時的提案。Pitchings with related man hours totaling more than ${KEY_PITCHING_MIN_MAN_HOUR_SUM}.`
              : isMajorInquiry
                ? "顯示已設定主報價的傢俬提案。 Furniture pitchings with a major quote assigned."
                : isBwf
                  ? "管理所有傢俬提案。Manage all furniture pitching."
                  : "管理所有有潛質的提案。Manage all potential pitching."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> 重新整理
          </Button>
          {canCreate(permissionModule) && (
            <Button size="sm" className={isBwf ? "bg-fuchsia-600 hover:bg-fuchsia-700" : "bg-blue-600 hover:bg-blue-700"} onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Pitch
            </Button>
          )}
        </div>
      </div>

      {isMajorInquiry && <ListLogicPanel pageId="major-inquiry" />}

      {/* ────── KPI Cards ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={FolderOpen}
          label="總提案數"
          value={totalPitchings}
          subLabel={`已篩選: ${totalCount}`}
          color="bg-blue-500"
          borderColor="border-l-blue-500"
        />
        <StatCard
          icon={Volume2}
          label="進行中提案"
          value={activePitchings}
          color="bg-amber-500"
          borderColor="border-l-amber-500"
        />
        <StatCard
          icon={DollarSign}
          label="預計總營收"
          value={formatMoney(totalEstimatedIncome, moneyOpts)}
          color="bg-violet-500"
          borderColor="border-l-violet-500"
        />
        <StatCard
          icon={TrendingUp}
          label="預計總毛利"
          value={formatMoney(totalEstimatedProfit, moneyOpts)}
          subLabel={totalEstimatedIncome > 0 ? `毛利率 ${Math.round((totalEstimatedProfit / totalEstimatedIncome) * 100)}%` : undefined}
          color="bg-emerald-500"
          borderColor="border-l-emerald-500"
        />
        <StatCard
          icon={BarChart3}
          label="成功提案"
          value={wonPitchings}
          subLabel={`中標率 ${winRate}%`}
          color="bg-green-600"
          borderColor="border-l-green-600"
        />
      </div>

      {/* ────── Search + Primary Filters Row ────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {/* Advanced Filter Toggle */}
          <Button
            variant={showAdvancedFilters ? "default" : "outline"}
            size="sm"
            className={`h-9 shrink-0 ${showAdvancedFilters ? "bg-blue-600 hover:bg-blue-700" : ""}`}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            高級篩選
            {activeFilterCount > 0 && (
              <span className="ml-1.5 bg-white/20 text-[13px] rounded-full px-1.5 py-0.5">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search all columns..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Clear All */}
          {(activeFilterCount > 0 || search) && (
            <Button variant="ghost" size="sm" className="h-9 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0" onClick={clearAllFilters}>
              <X className="w-4 h-4 mr-1" /> 清除篩選
            </Button>
          )}
        </div>

        {/* Advanced Filters (collapsible) */}
        {showAdvancedFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex flex-wrap gap-3">
              {/* Stage Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">狀態</label>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="所有狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有狀態</SelectItem>
                    {filterOptions.stages.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PM Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">PM</label>
                <Select value={pmFilter} onValueChange={setPmFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="所有PM" />
                  </SelectTrigger>
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
              </div>

              {/* Team */}
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">團隊</label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="所有團隊" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有團隊</SelectItem>
                    {filterOptions.teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.display}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service Type */}
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">服務類型</label>
                <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="所有服務類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有服務類型</SelectItem>
                    {filterOptions.serviceTypes.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.display}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* District */}
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">地區</label>
                <Select value={districtFilter} onValueChange={setDistrictFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="所有地區" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有地區</SelectItem>
                    {filterOptions.districts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Financial Year */}
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">財政年度</label>
                <Select value={financialYearFilter} onValueChange={setFinancialYearFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="所有財政年度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有財政年度</SelectItem>
                    {filterOptions.financialYears.map((fy) => (
                      <SelectItem key={fy.id} value={fy.id}>
                        {fy.display}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 項目規模 (os_money_size) — BWA only */}
              {!isBwf && (
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-medium text-gray-500 uppercase tracking-wider">項目規模</label>
                  <Select value={osMoneySizeFilter} onValueChange={setOsMoneySizeFilter}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="所有項目規模" />
                    </SelectTrigger>
                    <SelectContent>
                      {BWA_PROJECT_SIZE_FILTER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ────── Loading State ────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-500">載入提案資料中...</span>
        </div>
      )}

      {/* ────── Data Table ────── */}
      {!loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="cursor-pointer w-[110px] whitespace-nowrap" onClick={() => toggleSort("enquiry_date")}>
                    查詢日期 <SortIcon field="enquiry_date" />
                  </TableHead>
                  <TableHead className="cursor-pointer w-[100px] whitespace-nowrap" onClick={() => toggleSort("days_remaining")}>
                    剩餘天數 <SortIcon field="days_remaining" />
                  </TableHead>
                  {!isBwf && (
                    <TableHead className="cursor-pointer w-[120px]" onClick={() => toggleSort("service_type_name")}>
                      服務類型 <SortIcon field="service_type_name" />
                    </TableHead>
                  )}
                  {isBwf ? (
                    <TableHead className="w-[120px]">
                      客戶類型
                    </TableHead>
                  ) : (
                    <TableHead className="cursor-pointer w-[120px]" onClick={() => toggleSort("project_types_name")}>
                      項目類型 <SortIcon field="project_types_name" />
                    </TableHead>
                  )}
                  {!isBwf && (
                    <TableHead className="cursor-pointer w-[80px]" onClick={() => toggleSort("district_name")}>
                      地區 <SortIcon field="district_name" />
                    </TableHead>
                  )}
                  <TableHead className="cursor-pointer min-w-[220px]" onClick={() => toggleSort("customer_name")}>
                    提案顯示名稱 <SortIcon field="customer_name" />
                  </TableHead>
                  <TableHead className="w-[90px] text-right whitespace-nowrap">
                    總工時
                  </TableHead>
                  {isBwf ? (
                    <TableHead className="w-[160px]">
                      服務類型
                    </TableHead>
                  ) : (
                    <TableHead className="cursor-pointer w-[90px] text-right" onClick={() => toggleSort("size")}>
                      實用面積 <SortIcon field="size" />
                    </TableHead>
                  )}
                  {isMajorInquiry && (
                    <TableHead className="w-[140px]">
                      主報價
                    </TableHead>
                  )}
                  <TableHead className="cursor-pointer w-[130px] text-right" onClick={() => toggleSort("estimated_income")}>
                    預計收入 <SortIcon field="estimated_income" />
                  </TableHead>
                  <TableHead className="cursor-pointer w-[130px] text-right" onClick={() => toggleSort("estimated_profit")}>
                    預計毛利 <SortIcon field="estimated_profit" />
                  </TableHead>
                  <TableHead className="cursor-pointer w-[140px]" onClick={() => toggleSort("pm_name")}>
                    主要PM及設計師 <SortIcon field="pm_name" />
                  </TableHead>
                  <TableHead className="cursor-pointer w-[120px] text-center" onClick={() => toggleSort("pitching_stages")}>
                    Status <SortIcon field="pitching_stages" />
                  </TableHead>
                  <TableHead className="w-[110px] text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isMajorInquiry ? 13 : isBwf ? 11 : 13} className="text-center py-16 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <FolderOpen className="w-10 h-10 text-gray-300" />
                        <p className="text-base">
                          {search || activeFilterCount > 0
                            ? "沒有符合篩選條件的提案"
                            : "暫無提案資料"}
                        </p>
                        {(search || activeFilterCount > 0) && (
                          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                            清除所有篩選
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((p) => {
                    const estimatedProfit = (p.estimated_income || 0) - (p.estimated_expense || 0);
                    const profitColor = estimatedProfit > 0 ? "text-green-600" : estimatedProfit < 0 ? "text-red-600" : "text-gray-500";

                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-blue-50/50 transition-all group border-l-2 border-l-transparent hover:border-l-blue-500 hover:shadow-sm"
                        onClick={() => window.open(`${detailBase}/${p.id}`, "_blank", "noopener")}
                      >
                        {/* 查詢日期 */}
                        <TableCell className="text-[15px] text-gray-700 whitespace-nowrap">
                          {formatDate(p.enquiry_date)}
                        </TableCell>

                        {/* 剩餘天數 (enquiry_date + 90 days deadline) */}
                        <TableCell className="text-center whitespace-nowrap">
                          <DaysRemainingBadge days={calcDaysRemaining(p.enquiry_date, p.created_date)} />
                        </TableCell>

                        {/* 服務類型 (BWA) — before 項目類型 */}
                        {!isBwf && (
                          <TableCell>
                            {p.service_type_name ? (
                              <div className="flex flex-wrap gap-1">
                                {p.service_type_name.split(", ").map((type: string, i: number) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-[13px] font-medium rounded-full px-2.5 py-0.5 bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
                                  >
                                    {type}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[15px]">N/A</span>
                            )}
                          </TableCell>
                        )}

                        {/* 客戶類型 (BWF) / 項目類型 (BWA) */}
                        {isBwf ? (
                          <TableCell>
                            {(p as any).customer_type_name ? (
                              <span className="text-[15px] text-gray-700">{(p as any).customer_type_name}</span>
                            ) : (
                              <span className="text-gray-400 text-[15px]">N/A</span>
                            )}
                          </TableCell>
                        ) : (
                          <TableCell>
                            {p.project_types_name ? (
                              <div className="flex flex-wrap gap-1">
                                {p.project_types_name.split(", ").map((type: string, i: number) => (
                                  <span key={i} className="text-[15px] text-gray-700">{type}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[15px]">N/A</span>
                            )}
                          </TableCell>
                        )}

                        {/* 地區 (BWA only) */}
                        {!isBwf && (
                          <TableCell>
                            <span className="text-[15px] text-gray-700">
                              {p.district_name || p.real_district_name || "N/A"}
                            </span>
                          </TableCell>
                        )}

                        {/* 提案顯示名稱 + 編號 */}
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-medium text-blue-600 truncate max-w-[280px] text-[15px] hover:underline">
                              {p.real_customer_display_name || "N/A"}
                            </p>
                            {p.pitching_code && (
                              <p className="text-[13px] text-gray-400 font-mono">
                                {p.pitching_code}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* 總工時 (related pitching man_hour_tasks) */}
                        <TableCell className="text-right font-mono text-[15px] text-gray-700 whitespace-nowrap">
                          {manHourTotalsLoading
                            ? <span className="text-gray-300">…</span>
                            : `${(manHourTotals[p.id] ?? 0).toFixed(1)}h`}
                        </TableCell>

                        {/* 服務類型 (BWF) / 面積 (BWA) */}
                        {isBwf ? (
                          <TableCell>
                            {p.service_type_name ? (
                              <div className="flex flex-wrap gap-1">
                                {p.service_type_name.split(", ").map((type: string, i: number) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-[13px] font-medium rounded-full px-2.5 py-0.5 bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
                                  >
                                    {type}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[15px]">N/A</span>
                            )}
                          </TableCell>
                        ) : (
                          <TableCell className="text-right text-[15px] text-gray-700">
                            {formatSize(p.actual_size)}
                          </TableCell>
                        )}

                        {/* 主報價 (主要查詢列表) */}
                        {isMajorInquiry && (
                          <TableCell>
                            {(p as any).major_quote_display ? (
                              <Badge
                                variant="secondary"
                                className="text-[12px] font-normal max-w-[160px] truncate"
                                title={(p as any).major_quote_display}
                              >
                                {(p as any).major_quote_display}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-[15px]">-</span>
                            )}
                          </TableCell>
                        )}

                        {/* 預計收入 */}
                        <TableCell className="text-right font-mono text-[15px] text-gray-700">
                          {p.estimated_income ? formatMoney(p.estimated_income, moneyOpts) : "N/A"}
                        </TableCell>

                        {/* 預計毛利 */}
                        <TableCell className={`text-right font-mono text-[15px] ${estimatedProfit !== 0 ? profitColor : "text-gray-400"}`}>
                          {estimatedProfit !== 0 ? formatMoney(estimatedProfit, moneyOpts) : "N/A"}
                        </TableCell>

                        {/* 主要PM及設計師 */}
                        <TableCell>
                          <div>
                            <p className="text-[15px] text-gray-800">{p.pm_name || "N/A"}</p>
                            {p.designer_name && (
                              <p className="text-[13px] text-gray-400">{p.designer_name}</p>
                            )}
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          <PitchingStageBadge stage={p.pitching_stages} />
                        </TableCell>

                        {/* Action */}
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-3">
                            <AsanaLinkButton href={p.asana_link} />
                            <button
                              className="text-[15px] text-gray-500 hover:text-blue-600 hover:underline transition-colors"
                              onClick={async () => {
                                const ruleResult = await checkRule("pitching", "block_edit_when_confirmed", {
                                  pitching_stage: p.pitching_stages || ""
                                });
                                if (ruleResult === "deny") {
                                  toast({
                                    title: "無法編輯",
                                    description: "已確認的提案不可編輯",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                setEditingPitching(p);
                              }}
                            >
                              Edit
                            </button>
                            {!isBwf && (
                            <button
                              className={`text-[15px] text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors ${
                                !(p.pitching_stages === "Enquiry" || p.pitching_stages === "Pitching") ? "invisible" : ""
                              }`}
                              onClick={(e) => navigate(`${detailBase}/${p.id}?action=convert`, e)}
                              disabled={!(p.pitching_stages === "Enquiry" || p.pitching_stages === "Pitching")}
                            >
                              Convert
                            </button>
                            )}
                            {isBwf && (
                            <button
                              className="text-[15px] text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors"
                              onClick={() => window.open(`${detailBase}/${p.id}`, "_blank", "noopener")}
                            >
                              View
                            </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* ────── Pagination Footer ────── */}
          {totalCount > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Left: Count & Page Size */}
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>
                  顯示 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} / {totalCount} 筆
                  {totalCount !== totalPitchings && (
                    <span className="text-gray-400"> (共 {totalPitchings} 筆)</span>
                  )}
                </span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(Number(v))}
                >
                  <SelectTrigger className="w-[80px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s} 筆
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Right: Page Navigation */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-3 text-sm text-gray-600">
                  第 {currentPage} / {totalPages} 頁
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────── Create/Edit Dialog ────── */}
      {isBwf ? (
        <BWFPitchingDialog
          open={showCreateDialog || !!editingPitching}
          onClose={() => {
            setShowCreateDialog(false);
            setEditingPitching(null);
          }}
          onSaved={handleRefresh}
          editData={editingPitching}
        />
      ) : (
        <BWAPitchingDialog
          open={showCreateDialog || !!editingPitching}
          onClose={() => {
            setShowCreateDialog(false);
            setEditingPitching(null);
          }}
          onSaved={handleRefresh}
          editData={editingPitching}
        />
      )}
    </div>
  );
}
