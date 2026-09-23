"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Filter,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Sliders} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger} from "@/components/ui/collapsible";
import {
  fetchCostAnalysisProjects,
  fetchExpensesByProjects,
  fetchSupplierTypesForCostAnalysis as fetchSupplierTypes,
  fetchProjectTypes,
  fetchServiceTypes,
  fetchFinancialYears,
  fetchCostCentresForCostAnalysis as fetchCostCentres,
  fetchPMStaff,
  type CostAnalysisProject,
  type CostAnalysisExpenseByType} from "@/lib/data-service";
import { useNavigate } from "@/hooks/use-navigate";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import {
  BWA_PROJECT_SIZE_FILTER_OPTIONS,
  matchesBwaProjectSize,
} from "@/lib/bwa-project-size";
import {
  PROJECT_STATUS_OPTIONS,
  projectStatusFilterLabel,
} from "@/lib/project-status-rules";
import { toHkYmd } from "@/lib/date-utils";

// ─── FORMAT HELPERS ─────────────────────────────────────────
function formatSize(actualSize: string | null): string {
  if (actualSize) {
    const num = parseFloat(actualSize);
    return isNaN(num) ? actualSize : `${num.toLocaleString()} ft`;
  }
  return "N/A";
}

function formatDuration(days: number | null): string {
  if (days == null) return "N/A";
  return `${days} Days`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const ymd = toHkYmd(dateStr);
  return ymd ? ymd.replace(/-/g, "/") : dateStr;
}

// ─── DATE RANGE PRESETS ─────────────────────────────────────
type DateRangeOption = "past_12mth" | "past_24mth" | "past_36mth" | "all";
const DATE_RANGE_OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: "past_12mth", label: "Past 12mth" },
  { value: "past_24mth", label: "Past 24mth" },
  { value: "past_36mth", label: "Past 36mth" },
  { value: "all", label: "所有時間" },
];

// ─── SORT ───────────────────────────────────────────────────
type SortField =
  | "signed_date"
  | "project_name"
  | "customer_name"
  | "service_type_name"
  | "project_type_name"
  | "pm_name"
  | "size"
  | "duration_days"
  | "actual_income"
  | "estimated_profit"
  | "expense_l2";
type SortDir = "asc" | "desc";

export default function CostAnalysisManagement() {
  const { formatMoney2 } = useFinancialFormat();
  const { navigate } = useNavigate();
  const { loading: permLoading } = usePermission();

  // Data states
  const [projects, setProjects] = useState<CostAnalysisProject[]>([]);
  const [expenseData, setExpenseData] = useState<CostAnalysisExpenseByType[]>([]);
  const [supplierTypes, setSupplierTypes] = useState<{ id: string; display: string | null; chinese_display: string | null; is_bwf: boolean | null }[]>([]);
  const [projectTypes, setProjectTypes] = useState<{ id: string; display: string | null }[]>([]);
  const [serviceTypes, setServiceTypes] = useState<{ id: string; display: string | null }[]>([]);
  const [financialYears, setFinancialYears] = useState<{ id: string; display: string | null }[]>([]);
  const [costCentres, setCostCentres] = useState<{ id: string; display: string | null; bu_code: string | null }[]>([]);
  const [pmStaff, setPmStaff] = useState<{ id: string; name: string | null; position: string | null; status: string | null }[]>([]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeOption>("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPM, setFilterPM] = useState("all");
  const [filterBU, setFilterBU] = useState("all");
  const [filterProjectType, setFilterProjectType] = useState<string>("all");
  const [filterServiceType, setFilterServiceType] = useState("all");
  const [filterProjectScale, setFilterProjectScale] = useState("all");
  const [filterFinancialYear, setFilterFinancialYear] = useState("all");
  const [minSizeFilter, setMinSizeFilter] = useState(0);

  // The dynamic expense type selector (user picks which expense type column to show)
  const [selectedExpenseType, setSelectedExpenseType] = useState<string>("all");

  // Sort
  const [sortField, setSortField] = useState<SortField>("signed_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ─── LOAD DATA ────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [proj, supTypes, ptypes, stypes, fyears, ccs, staff] = await Promise.all([
        fetchCostAnalysisProjects(),
        fetchSupplierTypes(),
        fetchProjectTypes(),
        fetchServiceTypes(),
        fetchFinancialYears(),
        fetchCostCentres(),
        fetchPMStaff(),
      ]);
      setProjects(proj);
      setSupplierTypes(supTypes);
      setProjectTypes(ptypes);
      setServiceTypes(stypes);
      setFinancialYears(fyears);
      setCostCentres(ccs);
      setPmStaff(staff);
      setLoading(false);

      // Load expenses for all projects
      if (proj.length > 0) {
        setExpenseLoading(true);
        const projectIds = proj.map((p) => p.id);
        const expenses = await fetchExpensesByProjects(projectIds);
        setExpenseData(expenses);
        setExpenseLoading(false);
      }
    }
    load();
  }, []);

  // ─── FILTER LOGIC ─────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Date range filter. A specific 財政年度 selection is an explicit period, so
    // it overrides the rolling date-range cutoff — otherwise picking an older
    // financial year (e.g. 2023-2024) returns nothing because the default
    // "past 12 months" window excludes every project in it.
    if (dateRange !== "all" && filterFinancialYear === "all") {
      const months = dateRange === "past_12mth" ? 12 : dateRange === "past_24mth" ? 24 : 36;
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      result = result.filter((p) => {
        if (!p.signed_date) return false;
        return new Date(p.signed_date) >= cutoff;
      });
    }

    // Status filter — exact match on the six official project statuses
    if (filterStatus !== "all") {
      result = result.filter((p) => (p.status || "").trim() === filterStatus);
    }

    // PM filter
    if (filterPM !== "all") {
      result = result.filter((p) => p.pm_name === filterPM || p.other_pm_name === filterPM);
    }

    // BU filter
    if (filterBU !== "all") {
      result = result.filter((p) => p.cost_centre_bu_code === filterBU);
    }

    // Project type filter — match on the multi-select junction IDs (a project
    // can belong to several types). filterProjectType holds a project_type id.
    if (filterProjectType !== "all") {
      result = result.filter((p) => (p.project_type_ids ?? []).includes(filterProjectType));
    }

    // Service type filter
    if (filterServiceType !== "all") {
      result = result.filter((p) => {
        const st = p.service_type_name || "";
        return st.includes(filterServiceType);
      });
    }

    // Project scale filter (BWA 項目規模 bands — keyed off estimated_income)
    if (filterProjectScale !== "all") {
      result = result.filter((p) =>
        matchesBwaProjectSize(p.estimated_income, filterProjectScale),
      );
    }

    // Financial year filter
    if (filterFinancialYear !== "all") {
      result = result.filter((p) => p.n_financial_year_id === filterFinancialYear);
    }

    // Size filter (minimum sq ft) — 實用面積 actual_size
    if (minSizeFilter > 0) {
      result = result.filter((p) => {
        const sizeNum = parseFloat(p.actual_size || "0");
        return sizeNum >= minSizeFilter;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.project_name || "").toLowerCase().includes(q) ||
          (p.project_code || "").toLowerCase().includes(q) ||
          (p.customer_name || "").toLowerCase().includes(q) ||
          (p.pm_name || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [projects, dateRange, filterStatus, filterPM, filterBU, filterProjectType, filterServiceType, filterProjectScale, filterFinancialYear, minSizeFilter, searchQuery]);

  const hasActiveFilters =
    dateRange !== "all" ||
    filterStatus !== "all" ||
    filterPM !== "all" ||
    filterBU !== "all" ||
    filterProjectType !== "all" ||
    filterServiceType !== "all" ||
    filterProjectScale !== "all" ||
    filterFinancialYear !== "all" ||
    minSizeFilter > 0 ||
    searchQuery.trim() !== "";

  // ─── EXPENSE LOOKUP PER PROJECT ───────────────────────────
  // Build a map: project_id -> Map<supplier_type_id, total>
  const expenseMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const e of expenseData) {
      if (!map.has(e.project_id)) {
        map.set(e.project_id, new Map());
      }
      const typeMap = map.get(e.project_id)!;
      const key = e.supplier_type_id || "unknown";
      typeMap.set(key, (typeMap.get(key) || 0) + e.total_installment_amount);
    }
    return map;
  }, [expenseData]);

  // Get expense for selected type
  const getExpenseForType = useCallback(
    (projectId: string, typeId: string): number | null => {
      const typeMap = expenseMap.get(projectId);
      if (!typeMap) return null;
      if (typeId === "all") {
        // Sum all types
        let total = 0;
        typeMap.forEach((v) => (total += v));
        return total || null;
      }
      return typeMap.get(typeId) || null;
    },
    [expenseMap]
  );

  // ─── SORTED DATA ──────────────────────────────────────────
  const sortedProjects = useMemo(() => {
    const data = [...filteredProjects];
    data.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case "signed_date":
          aVal = a.signed_date || "";
          bVal = b.signed_date || "";
          break;
        case "project_name":
          aVal = (a.project_name || "").toLowerCase();
          bVal = (b.project_name || "").toLowerCase();
          break;
        case "customer_name":
          aVal = (a.customer_name || "").toLowerCase();
          bVal = (b.customer_name || "").toLowerCase();
          break;
        case "service_type_name":
          aVal = (a.service_type_name || "").toLowerCase();
          bVal = (b.service_type_name || "").toLowerCase();
          break;
        case "project_type_name":
          aVal = (a.project_type_name || "").toLowerCase();
          bVal = (b.project_type_name || "").toLowerCase();
          break;
        case "pm_name":
          aVal = (a.pm_name || "").toLowerCase();
          bVal = (b.pm_name || "").toLowerCase();
          break;
        case "size":
          aVal = parseFloat(a.actual_size || "0");
          bVal = parseFloat(b.actual_size || "0");
          break;
        case "duration_days":
          aVal = a.duration_days || 0;
          bVal = b.duration_days || 0;
          break;
        case "actual_income":
          aVal = a.actual_income || 0;
          bVal = b.actual_income || 0;
          break;
        case "estimated_profit":
          aVal = a.estimated_profit || 0;
          bVal = b.estimated_profit || 0;
          break;
        case "expense_l2":
          aVal = getExpenseForType(a.id, selectedExpenseType) || 0;
          bVal = getExpenseForType(b.id, selectedExpenseType) || 0;
          break;
        default:
          aVal = "";
          bVal = "";
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }, [filteredProjects, sortField, sortDir, selectedExpenseType, getExpenseForType]);

  // ─── SORT HANDLER ─────────────────────────────────────────
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1 text-bw-blue" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 text-bw-blue" />
    );
  }

  // ─── PM LIST ──────────────────────────────────────────────
  const pmList = useMemo(() => {
    const names = new Set<string>();
    projects.forEach((p) => {
      if (p.pm_name) names.add(p.pm_name);
    });
    return Array.from(names).sort();
  }, [projects]);

  // BU list from cost centres
  const buList = useMemo(() => {
    return costCentres
      .filter((c) => c.bu_code)
      .map((c) => c.bu_code!)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
  }, [costCentres]);

  function getRowBorderColor(project: CostAnalysisProject): string {
    const s = (project.status || "").trim().toLowerCase();
    if (s === "work in progress") return "border-l-4 border-l-amber-400 bg-amber-50/20";
    if (s === "project done") return "border-l-4 border-l-emerald-500 bg-emerald-50/10";
    if (s === "case closed" || s === "internal project") return "border-l-4 border-l-gray-400 bg-gray-50/50";
    if (s === "discontinued project" || s === "dispute done") return "border-l-4 border-l-red-500 bg-red-50/10";
    return "";
  }

  // ─── RENDER ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
        <span className="ml-3 text-gray-500">載入成本分析資料...</span>
      </div>
    );
  }

  // BWA-only supplier types
  const bwaSupplierTypes = supplierTypes.filter((st) => !st.is_bwf);

  return (
    <div className="space-y-6">
      {/* ─── PAGE HEADER ─────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">成本分析 Cost Study</h1>
        <p className="text-sm text-gray-500 mt-1">檢視所有項目的成本與銷售。</p>
      </div>

      {/* ─── LEGEND BOX ──────────────────────────────── */}
      <Collapsible open={showLegend} onOpenChange={setShowLegend}>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-gray-50 transition-colors">
              <Info className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-sm text-gray-800">項目狀態顏色說明</span>
              {showLegend ? <ChevronUp className="w-4 h-4 ml-auto text-gray-400" /> : <ChevronDown className="w-4 h-4 ml-auto text-gray-400" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-4 space-y-1.5 text-sm">
              <p>
                <span className="text-amber-500 font-medium">黃色 Yellow:</span>{" "}
                進行中 Work In Progress
              </p>
              <p>
                <span className="text-emerald-600 font-medium">綠色 Green:</span>{" "}
                項目完成 Project Done
              </p>
              <p>
                <span className="text-gray-500 font-medium">灰色 Grey:</span>{" "}
                已結案 Case Closed / 內部工程 Internal Project
              </p>
              <p>
                <span className="text-red-600 font-medium">紅色 Red:</span>{" "}
                爛尾工程 Discontinued Project / 爭議完結 Dispute Done
              </p>
              <p className="text-xs text-gray-400 pt-1">
                顏色只標示項目狀態，不影響列表金額。
              </p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* ─── TOOLBAR: FILTER TOGGLE + SEARCH ─────────── */}
      <div className="flex items-center gap-3">
        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          className="gap-2 text-sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4" />
          高級篩選
        </Button>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search all columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9 text-sm"
          />
        </div>
      </div>

      {/* ─── FILTERS PANEL ───────────────────────────── */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-4">
            {/* 時間段 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">時間段</label>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 項目狀態 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">項目狀態</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="所有狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有狀態</SelectItem>
                  {PROJECT_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {projectStatusFilterLabel(opt.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 項目經理 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">項目經理</label>
              <Select value={filterPM} onValueChange={setFilterPM}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="所有PM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有PM</SelectItem>
                  {pmList.map((pm) => (
                    <SelectItem key={pm} value={pm}>
                      {pm}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* BU */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">BU</label>
              <Select value={filterBU} onValueChange={setFilterBU}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="所有BU" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有BU</SelectItem>
                  {buList.map((bu) => (
                    <SelectItem key={bu} value={bu}>
                      {bu}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 項目類型 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">項目類型</label>
              <Select value={filterProjectType} onValueChange={setFilterProjectType}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="所有項目類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有項目類型</SelectItem>
                  {projectTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.display || "未命名"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 服務類型 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">服務類型</label>
              <Select value={filterServiceType} onValueChange={setFilterServiceType}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="所有服務類型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有服務類型</SelectItem>
                  {serviceTypes.map((st) => (
                    <SelectItem key={st.id} value={st.display || st.id}>
                      {st.display || "未命名"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 項目規模 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">項目規模</label>
              <Select value={filterProjectScale} onValueChange={setFilterProjectScale}>
                <SelectTrigger className="h-9 text-sm">
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

            {/* 財政年度 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">財政年度</label>
              <Select value={filterFinancialYear} onValueChange={setFilterFinancialYear}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="所有財政年度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有財政年度</SelectItem>
                  {financialYears.map((fy) => (
                    <SelectItem key={fy.id} value={fy.id}>
                      {fy.display || "未命名"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 實用面積 (min size filter) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">實用面積</label>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">
                  Size ≥ {minSizeFilter.toLocaleString()} Sq. ft.
                </span>
                <input
                  type="range"
                  min={0}
                  max={10000}
                  step={100}
                  value={minSizeFilter}
                  onChange={(e) => setMinSizeFilter(Number(e.target.value))}
                  className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-bw-blue"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white border border-gray-200 rounded-lg shadow-sm">
          <Filter className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium text-gray-500">請先選擇篩選條件以顯示資料</p>
          <p className="text-xs text-gray-400 mt-1">Please select one or more filters to show data.</p>
        </div>
      ) : (
      <>
      {/* ─── RESULTS COUNT ───────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          共 <span className="font-semibold text-gray-800">{sortedProjects.length}</span> 個項目
          {expenseLoading && (
            <span className="ml-2 text-xs text-gray-400">
              <Loader2 className="inline w-3 h-3 animate-spin mr-1" />
              載入支出數據...
            </span>
          )}
        </p>
      </div>

      {/* ─── DATA TABLE ──────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead
                  className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap min-w-[72px]"
                  onClick={() => handleSort("signed_date")}
                >
                  <div className="flex items-center">
                    簽約日期
                    <SortIcon field="signed_date" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap min-w-[140px]"
                  onClick={() => handleSort("project_name")}
                >
                  <div className="flex items-center">
                    項目名稱
                    <SortIcon field="project_name" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap min-w-[110px]"
                  onClick={() => handleSort("customer_name")}
                >
                  <div className="flex items-center">
                    客戶名稱
                    <SortIcon field="customer_name" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap min-w-[64px]"
                  onClick={() => handleSort("service_type_name")}
                >
                  <div className="flex items-center">
                    服務類型
                    <SortIcon field="service_type_name" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap min-w-[64px]"
                  onClick={() => handleSort("project_type_name")}
                >
                  <div className="flex items-center">
                    項目類型
                    <SortIcon field="project_type_name" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap min-w-[90px]"
                  onClick={() => handleSort("pm_name")}
                >
                  <div className="flex items-center">
                    PM/設計師
                    <SortIcon field="pm_name" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap text-right min-w-[50px]"
                  onClick={() => handleSort("size")}
                >
                  <div className="flex items-center justify-end">
                    實用面積
                    <SortIcon field="size" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap text-right min-w-[44px]"
                  onClick={() => handleSort("duration_days")}
                >
                  <div className="flex items-center justify-end">
                    時長
                    <SortIcon field="duration_days" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap text-right min-w-[88px]"
                  onClick={() => handleSort("actual_income")}
                >
                  <div className="flex items-center justify-end">
                    L3 收入
                    <SortIcon field="actual_income" />
                  </div>
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap text-right min-w-[76px]">
                  每呎收入
                </TableHead>
                {/* Dynamic expense type column */}
                <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap min-w-[140px]">
                  <div className="flex flex-col gap-1">
                    <Select value={selectedExpenseType} onValueChange={setSelectedExpenseType}>
                      <SelectTrigger className="h-7 text-xs border-blue-300 bg-blue-50 w-[130px]">
                        <SelectValue placeholder="支出類型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部支出類型</SelectItem>
                        {bwaSupplierTypes.map((st) => (
                          <SelectItem key={st.id} value={st.id}>
                            {st.chinese_display || st.display || "未命名"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TableHead>
                <TableHead
                  className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap text-right min-w-[72px]"
                  onClick={() => handleSort("expense_l2")}
                >
                  <div className="flex items-center justify-end">
                    每呎支出
                    <SortIcon field="expense_l2" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-16 text-gray-400">
                    沒有找到符合條件的項目
                  </TableCell>
                </TableRow>
              ) : (
                sortedProjects.map((project) => {
                  const sizeNum = parseFloat(project.actual_size || "0");
                  const l3Income = project.actual_income || 0;
                  const incomePerSqft = sizeNum > 0 && l3Income
                    ? l3Income / sizeNum
                    : null;
                  const expenseAmount = getExpenseForType(project.id, selectedExpenseType);
                  const expensePerSqft = sizeNum > 0 && expenseAmount
                    ? expenseAmount / sizeNum
                    : null;
                  const rowBorder = getRowBorderColor(project);

                  return (
                    <TableRow
                      key={project.id}
                      className={`hover:bg-gray-50/80 cursor-pointer transition-colors border-b border-gray-100 ${rowBorder}`}
                      onClick={() => window.open(`/projects/bwa/${project.id}`, "_blank", "noopener")}
                    >
                      <TableCell className="text-[14px] text-gray-600 font-mono whitespace-nowrap">
                        {formatDate(project.signed_date)}
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <div className="text-[14px] font-medium text-gray-900 truncate">
                          {project.project_name || "—"}
                        </div>
                        <div className="text-[13px] text-gray-400 truncate">
                          {project.project_code || ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-[14px] text-gray-700 max-w-[120px] truncate">
                        {project.customer_name || "—"}
                      </TableCell>
                      <TableCell className="text-[14px] text-gray-600 whitespace-nowrap">
                        {project.service_type_name || "—"}
                      </TableCell>
                      <TableCell className="text-[14px] text-gray-600 whitespace-nowrap">
                        {project.project_type_name || "—"}
                      </TableCell>
                      <TableCell className="text-[14px] text-gray-700 whitespace-nowrap">
                        <div>{project.pm_name || "—"}</div>
                        {project.other_pm_name && (
                          <div className="text-[13px] text-gray-400">{project.other_pm_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-[14px] text-gray-700 text-right font-mono whitespace-nowrap">
                        {formatSize(project.actual_size)}
                      </TableCell>
                      <TableCell className="text-[14px] text-gray-600 text-right whitespace-nowrap">
                        {formatDuration(project.duration_days)}
                      </TableCell>
                      <TableCell className="text-[14px] text-gray-900 text-right font-mono whitespace-nowrap">
                        {formatMoney2(l3Income || null, { fallback: "N/A" })}
                      </TableCell>
                      <TableCell className="text-[14px] text-gray-700 text-right font-mono whitespace-nowrap">
                        {incomePerSqft != null
                          ? formatMoney2(incomePerSqft, { fallback: "N/A" })
                          : "N/A"}
                      </TableCell>
                      {/* Dynamic expense total for selected type */}
                      <TableCell className="text-[14px] text-gray-900 text-right font-mono whitespace-nowrap">
                        {expenseAmount != null
                          ? formatMoney2(expenseAmount, { fallback: "N/A" })
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-[14px] text-gray-700 text-right font-mono whitespace-nowrap">
                        {expensePerSqft != null
                          ? formatMoney2(expensePerSqft, { fallback: "N/A" })
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
