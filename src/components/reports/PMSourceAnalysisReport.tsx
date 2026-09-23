"use client";

// ═══════════════════════════════════════════════════════════════════════════
// AI WARNING — SHARED SOURCE / TYPE ANALYSIS REPORT (DO NOT DUPLICATE)
// This single component renders:
//   • /business-reports/pm-analysis-source     → role="pm" (default Position=PM)
//   • /design-reports/project-type-analysis    → role="designer" (default Position=Designer)
//   • /team-reports/project-type-analysis      → role="designer" reportScope="team"
// Any UI, metric, sort, aggregation, or StaffFilterBar change here applies to
// ALL linked pages. Prefer editing this file + HitRateStaffRole; do NOT
// copy-paste a ProjectTypeAnalysisReport / TeamProjectTypeAnalysisReport.
// Data: fetchPMSourceProjects(role) / fetchPMSourcePitches(role) in
// data-service (main_pm vs main_designer). reportScope="team" locks Team
// in StaffFilterBar (unless Super Admin).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Loader2,
  ChevronRight,
  ChevronDown,
  Trophy,
  ArrowUpDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchPMSourceProjects,
  fetchPMSourcePitches,
  type HitRateStaffRole,
  type PMSourceProject,
  type PMSourcePitch,
} from "@/lib/data-service";
import { getEffectiveStatusRule } from "@/lib/project-status-rules";
import MetricHoverCard from "@/components/reports/MetricHoverCard";

// ─── DATE-RANGE PRESETS — shared across business + design source reports ──
import {
  resolveRange,
  rangeBounds,
  fmtRangeDate as fmtDate,
} from "@/lib/report-date-range";
import { useReportRange, filterBySources } from "@/components/reports/ReportDateRangeContext";
import ReportFilterStack from "@/components/reports/ReportFilterStack";
import {
  applyProjectFilters,
  type ProjectFilterFields,
} from "@/components/reports/ProjectFilterBar";
import { staffIdMatchesFilter } from "@/components/reports/StaffFilterBar";
import { useSingleSourceReport } from "@/components/reports/use-single-source-report";
import { useAlignedReportFilters } from "@/hooks/use-aligned-report-filters";
import {
  projectFilterNeedsExtras,
  useEnrichedProjectFilterRows,
} from "@/hooks/use-project-filter-extras";
import type { ReportStaffScope } from "@/hooks/use-report-staff-lock";
import type { StaffDirectoryRow } from "@/lib/data-service";
import { useFinancialFormat } from "@/hooks/use-financial-format";

export interface PMSourceAnalysisReportProps {
  /**
   * AI WARNING (SHARED): "pm" and "designer" share this component.
   * Changing layout/metrics here updates ALL linked source-analysis pages.
   * designer → main_designer_id + StaffFilterBar position default "Designer".
   */
  role?: HitRateStaffRole;
  /** Route scope for StaffFilterBar locks (design / team). */
  reportScope?: ReportStaffScope;
}

function sourceProjectToFilterFields(p: PMSourceProject): ProjectFilterFields {
  return {
    id: p.id,
    status: p.status,
    cost_centre_bu_code: null,
    service_type_name: p.service_type_name,
    service_type_id: p.service_type_id,
    project_type_name: p.project_type_name,
    project_type_id: p.project_type_id,
    financial_year_name: null,
    n_financial_year_id: null,
    project_size: null,
    est_income: p.est_income,
    project_name: p.project_name,
    project_code: p.project_code,
    filter_project_id: p.id,
  };
}

function sourcePitchToFilterFields(p: PMSourcePitch): ProjectFilterFields {
  return {
    id: p.id,
    // Prefer converted project status so the ProjectFilterBar status
    // dropdown can drill into pitch metrics (null forced every status filter
    // to drop all pitches).
    status: p.converted_status,
    cost_centre_bu_code: null,
    service_type_name: p.service_type_name,
    service_type_id: p.service_type_id,
    project_type_name: p.project_type_name,
    project_type_id: p.project_type_id,
    financial_year_name: null,
    n_financial_year_id: null,
    project_size: null,
    est_income: null,
    project_name: null,
    project_code: p.pitch_code,
    filter_project_id: p.filter_project_id,
  };
}

type Dimension = "project_type" | "service_type";
type Metric = "count" | "revenue" | "gross_profit" | "pitches" | "hit_rate";
type SortCol = "name" | "total" | "best" | "hit_rate";

const PROJECT_METRICS: Metric[] = ["count", "revenue", "gross_profit"];
const PITCH_METRICS: Metric[] = ["pitches", "hit_rate"];

// ─── AGGREGATION MODELS ───────────────────────────────────────
// A single project's (or pitching's) contribution within a type cell.
interface CellItem {
  itemId: string;
  itemName: string;
  count: number; // 0 or 1 (whether it counts under 計隻數) — projects only
  revenue: number;
  gross_profit: number;
  pitch_count: number; // 0 or 1 — pitchings only
  converted_count: number; // 0 or 1 — pitchings that converted under 計隻數
}

// A single type bucket within a staff member.
interface TypeCell {
  typeId: string;
  typeName: string;
  count: number;
  revenue: number;
  gross_profit: number;
  pitch_count: number;
  converted_count: number;
  items: CellItem[];
}

interface StaffRow {
  staffId: string;
  staffName: string;
  cells: TypeCell[]; // per-type breakdown
  total_count: number;
  total_revenue: number;
  total_gross_profit: number;
  total_pitch_count: number;
  total_converted_count: number;
}

type MetricBag = {
  count: number;
  revenue: number;
  gross_profit: number;
  pitch_count: number;
  converted_count: number;
};

function metricVal(metric: Metric, x: MetricBag): number {
  if (metric === "count") return x.count;
  if (metric === "revenue") return x.revenue;
  if (metric === "gross_profit") return x.gross_profit;
  if (metric === "pitches") return x.pitch_count;
  return x.pitch_count ? x.converted_count / x.pitch_count : 0;
}


/**
 * Overall hit rate — same formula as /business-reports/pm-hit-rate Overall:
 * converted (計隻數) ÷ all pitches in window. No Mini/PP split.
 */
function hitRateOf(x: Pick<MetricBag, "pitch_count" | "converted_count">): number {
  return x.pitch_count ? x.converted_count / x.pitch_count : 0;
}

function fmtHitRate(x: Pick<MetricBag, "pitch_count" | "converted_count">): string {
  if (!x.pitch_count) return "—";
  return `${(hitRateOf(x) * 100).toFixed(2)}%`;
}

/** Weight used for share bars / "has activity" checks. */
function activityWeight(metric: Metric, x: MetricBag): number {
  if (metric === "pitches" || metric === "hit_rate") return x.pitch_count;
  return metricVal(metric, x);
}

function emptyStaffRow(staffId: string, staffName: string): StaffRow {
  return {
    staffId,
    staffName,
    cells: [],
    total_count: 0,
    total_revenue: 0,
    total_gross_profit: 0,
    total_pitch_count: 0,
    total_converted_count: 0,
  };
}

function ensureCell(row: StaffRow, tId: string, tName: string): TypeCell {
  let cell = row.cells.find((c) => c.typeId === tId);
  if (!cell) {
    cell = {
      typeId: tId,
      typeName: tName,
      count: 0,
      revenue: 0,
      gross_profit: 0,
      pitch_count: 0,
      converted_count: 0,
      items: [],
    };
    row.cells.push(cell);
  }
  return cell;
}

export default function PMSourceAnalysisReport({
  role = "pm",
  reportScope = "business",
}: PMSourceAnalysisReportProps) {
  // AI WARNING: role switches attribution (main_pm vs main_designer) and the
  // default StaffFilterBar position — keep titles/labels derived from role.
  const isDesigner = role === "designer";
  const titleZhEn = isDesigner
    ? "項目類型分析 Project Type Analysis"
    : "PM來源分析 PM Analysis by Source";
  const subtitleLead = isDesigner
    ? "按項目類型分析設計師表現"
    : "按客戶來源分析PM表現";

  const { formatMoney } = useFinancialFormat();
  const [projects, setProjects] = useState<PMSourceProject[]>([]);
  const [pitches, setPitches] = useState<PMSourcePitch[]>([]);
  const [loading, setLoading] = useState(true);

  const { range, custom, sources } = useReportRange();
  useSingleSourceReport();
  const filterScope =
    reportScope === "business" && role === "designer" ? "design" : reportScope;
  const {
    projectFilter,
    setProjectFilter,
    staffFilter,
    setStaffFilter,
    moneyBasis,
    setMoneyBasis,
    staffLocks,
    isSuperAdmin,
  } = useAlignedReportFilters(filterScope);
  const [dimension, setDimension] = useState<Dimension>("project_type");
  const [metric, setMetric] = useState<Metric>("count");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Second-level expansion: which staff×type cells are expanded to show items.
  // Keyed by `${staffId}::${typeId}`.
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  const [staffIds, setStaffIds] = useState<Set<string>>(new Set());
  const [directory, setDirectory] = useState<StaffDirectoryRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchPMSourceProjects(role), fetchPMSourcePitches(role)]).then(
      ([projectData, pitchData]) => {
        if (cancelled) return;
        setProjects(projectData);
        setPitches(pitchData);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [role]);

  const window = useMemo(() => resolveRange(range, new Date(), custom), [range, custom]);
  const isPitchMetric = PITCH_METRICS.includes(metric);

  const sourceProjects = useMemo(
    () => filterBySources(projects, sources),
    [projects, sources],
  );

  const projectFilterRows = useMemo(
    () => sourceProjects.map(sourceProjectToFilterFields),
    [sourceProjects],
  );
  const enrichedProjectFilterRows = useEnrichedProjectFilterRows(
    projectFilterRows,
    projectFilterNeedsExtras(projectFilter),
  );

  const pitchFilterRows = useMemo(
    () => filterBySources(pitches, sources).map(sourcePitchToFilterFields),
    [pitches, sources],
  );
  const enrichedPitchFilterRows = useEnrichedProjectFilterRows(
    pitchFilterRows,
    projectFilterNeedsExtras(projectFilter),
  );

  const projectFilteredIds = useMemo(
    () =>
      new Set(
        applyProjectFilters(enrichedProjectFilterRows, projectFilter).map((p) => p.id),
      ),
    [enrichedProjectFilterRows, projectFilter],
  );

  const pitchFilteredIds = useMemo(
    () =>
      new Set(
        applyProjectFilters(enrichedPitchFilterRows, projectFilter).map((p) => p.id),
      ),
    [enrichedPitchFilterRows, projectFilter],
  );

  // ─── FILTER BY BWA/BWF TOGGLE + DATE WINDOW ─────────────
  // Projects: signed_date. Pitchings: enquiry_date (same as pm-hit-rate).
  const windowProjects = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    return sourceProjects.filter((p) => {
      if (!projectFilteredIds.has(p.id)) return false;
      if (!p.signed_date) return false;
      const t = new Date(p.signed_date).getTime();
      if (isNaN(t) || t < fromMs || t > toMs) return false;
      return staffIdMatchesFilter(p.pm_id, staffFilter, directory);
    });
  }, [sourceProjects, window, projectFilteredIds, staffFilter, directory]);

  const windowPitches = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    return filterBySources(pitches, sources).filter((p) => {
      if (!pitchFilteredIds.has(p.id)) return false;
      if (!p.enquiry_date) return false;
      const t = new Date(p.enquiry_date).getTime();
      if (isNaN(t) || t < fromMs || t > toMs) return false;
      return staffIdMatchesFilter(p.pm_id, staffFilter, directory);
    });
  }, [pitches, window, sources, pitchFilteredIds, staffFilter, directory]);

  // ─── BUILD STAFF × TYPE MATRIX ─────────────────────────────
  // Seed one row per staff passing the staff filter (so staff with 0 activity
  // in the window still appear). Always fold BOTH projects and pitches so the
  // dedicated Hit Rate column (Overall = converted÷all pitches, same as
  // pm-hit-rate) is available regardless of the active metric toggle.
  // Drill-down `items` follow the active metric (projects vs pitches).
  const staffRows = useMemo(() => {
    const staff = new Map<string, StaffRow>();

    for (const s of directory) {
      if (!staffIds.has(s.id)) continue;
      staff.set(s.id, emptyStaffRow(s.id, s.name));
    }

    // Pitches → pitch_count / converted_count (+ items when pitch metric)
    for (const p of windowPitches) {
      if (!p.pm_id || !staff.has(p.pm_id)) continue;

      const tId =
        (dimension === "project_type" ? p.project_type_id : p.service_type_id) ||
        "__none__";
      const tName =
        (dimension === "project_type" ? p.project_type_name : p.service_type_name) ||
        "未分類 Uncategorised";

      const row = staff.get(p.pm_id)!;
      const cell = ensureCell(row, tId, tName);
      // Same 計隻數 gate as /business-reports/pm-hit-rate Overall (bypass when status filtered).
      const converted =
        p.converted &&
        getEffectiveStatusRule(p.converted_status, projectFilter.status).countNumber;

      if (isPitchMetric) {
        cell.items.push({
          itemId: p.id,
          itemName: p.pitch_label || p.pitch_code || "未命名提案",
          count: 0,
          revenue: 0,
          gross_profit: 0,
          pitch_count: 1,
          converted_count: converted ? 1 : 0,
        });
      }

      cell.pitch_count += 1;
      row.total_pitch_count += 1;
      if (converted) {
        cell.converted_count += 1;
        row.total_converted_count += 1;
      }
    }

    // Projects → count / revenue / GP (+ items when project metric)
    for (const p of windowProjects) {
      if (!p.pm_id || !staff.has(p.pm_id)) continue;
      const rule = getEffectiveStatusRule(p.status, projectFilter.status);
      // A project contributes to counts only if 計隻數, and to money only if 計錢.
      const contributesCount = rule.countNumber;
      const contributesMoney = rule.countMoney;
      if (!contributesCount && !contributesMoney) continue;

      const tId =
        (dimension === "project_type" ? p.project_type_id : p.service_type_id) ||
        "__none__";
      const tName =
        (dimension === "project_type" ? p.project_type_name : p.service_type_name) ||
        "未分類 Uncategorised";

      const row = staff.get(p.pm_id)!;
      const cell = ensureCell(row, tId, tName);

      const revenue = moneyBasis === "l2" ? (p.est_income || 0) : p.actual_income;
      const cost = moneyBasis === "l2" ? (p.est_expense || 0) : p.actual_expense;
      const gp = revenue - cost;

      if (!isPitchMetric) {
        cell.items.push({
          itemId: p.id,
          itemName: p.project_name || p.project_code || "未命名項目",
          count: contributesCount ? 1 : 0,
          revenue: contributesMoney ? revenue : 0,
          gross_profit: contributesMoney ? gp : 0,
          pitch_count: 0,
          converted_count: 0,
        });
      }

      if (contributesCount) {
        cell.count += 1;
        row.total_count += 1;
      }
      if (contributesMoney) {
        cell.revenue += revenue;
        cell.gross_profit += gp;
        row.total_revenue += revenue;
        row.total_gross_profit += gp;
      }
    }

    return Array.from(staff.values());
  }, [
    isPitchMetric,
    windowProjects,
    windowPitches,
    dimension,
    moneyBasis,
    directory,
    staffIds,
    projectFilter.status,
  ]);

  const rowMetricShape = (r: StaffRow): MetricBag => ({
    count: r.total_count,
    revenue: r.total_revenue,
    gross_profit: r.total_gross_profit,
    pitch_count: r.total_pitch_count,
    converted_count: r.total_converted_count,
  });

  // Data-source badge for the hover cards: counts have no money source;
  // revenue / gross-profit reflect the L2 (signed) vs L3 (actual) toggle.
  const hoverSource = PROJECT_METRICS.includes(metric) && metric !== "count" ? moneyBasis : undefined;

  // The best-performing type per staff (by the active metric).
  const bestCellFor = (row: StaffRow): TypeCell | null => {
    let best: TypeCell | null = null;
    for (const c of row.cells) {
      if (activityWeight(metric, c) === 0) continue;
      if (!best || metricVal(metric, c) > metricVal(metric, best)) best = c;
    }
    return best;
  };

  // ─── SEARCH + SORT ─────────────────────────────────────────
  const visibleRows = useMemo(() => {
    let result = staffRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.staffName.toLowerCase().includes(q));
    }
    const valueFor = (r: StaffRow): number | string => {
      if (sortCol === "name") return r.staffName.toLowerCase();
      if (sortCol === "best") {
        const b = bestCellFor(r);
        return b ? metricVal(metric, b) : 0;
      }
      if (sortCol === "hit_rate") return hitRateOf(rowMetricShape(r));
      return metricVal(metric, rowMetricShape(r));
    };
    return [...result].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [staffRows, search, sortCol, sortDir, metric]);

  // ─── COLUMN TOTALS (footer) ────────────────────────────────
  const totals = useMemo(() => {
    return visibleRows.reduce(
      (acc, r) => {
        acc.count += r.total_count;
        acc.revenue += r.total_revenue;
        acc.gross_profit += r.total_gross_profit;
        acc.pitch_count += r.total_pitch_count;
        acc.converted_count += r.total_converted_count;
        return acc;
      },
      { count: 0, revenue: 0, gross_profit: 0, pitch_count: 0, converted_count: 0 },
    );
  }, [visibleRows]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCell(key: string) {
    setExpandedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortCol(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1 text-bw-blue inline" />
      : <ChevronDown className="w-3 h-3 ml-1 text-bw-blue inline" />;
  }

  // Format a metric value for display.
  const fmtMetric = (v: number) => {
    if (metric === "hit_rate") return `${(v * 100).toFixed(2)}%`;
    if (metric === "count" || metric === "pitches") return `${v}`;
    return formatMoney(v, { fallback: "$0", showZero: true });
  };
  const metricLabel =
    metric === "count"
      ? "項目數 Projects"
      : metric === "revenue"
        ? "收入 Revenue"
        : metric === "gross_profit"
          ? "毛利 Gross Profit"
          : metric === "pitches"
            ? "提案數 Pitches"
            : "命中率 Hit Rate";
  const metricShort =
    metric === "count"
      ? "項目數"
      : metric === "revenue"
        ? "收入"
        : metric === "gross_profit"
          ? "毛利"
          : metric === "pitches"
            ? "提案數"
            : "命中率";
  const isBwfMode = sources.bwf && !sources.bwa;
  const projectDimShort = isBwfMode ? "客戶類型" : "項目類型";
  const dimShort = dimension === "project_type" ? projectDimShort : "服務類型";
  const isMoney = metric === "revenue" || metric === "gross_profit";
  const itemNoun = isPitchMetric ? "提案" : "項目";

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {titleZhEn}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {subtitleLead} — 檢視每位員工在不同{dimShort}的表現，找出最擅長的範疇。
          <span className="block text-xs text-gray-400 mt-0.5">
            From {fmtDate(window.from)} to {fmtDate(window.to)}
          </span>
        </p>
      </div>

      <ReportFilterStack
        sourceMode="single"
        showL2L3={isMoney}
        moneyBasis={moneyBasis}
        onMoneyBasisChange={setMoneyBasis}
        projectRows={enrichedProjectFilterRows}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        staffLocks={staffLocks}
        isSuperAdmin={isSuperAdmin}
        onStaffDirectoryLoaded={setDirectory}
        onStaffResolvedIdsChange={setStaffIds}
      />

      {/* ─── CONTROLS ───────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Dimension toggle */}
        <div className="flex rounded-md border border-gray-200 overflow-hidden h-9">
          <button
            onClick={() => setDimension("project_type")}
            className={`px-4 text-sm font-medium transition-colors ${
              dimension === "project_type" ? "bg-bw-blue text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {isBwfMode ? "客戶類型" : "項目類型"}
          </button>
          <button
            onClick={() => setDimension("service_type")}
            className={`px-4 text-sm font-medium transition-colors border-l border-gray-200 ${
              dimension === "service_type" ? "bg-bw-blue text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            服務類型
          </button>
        </div>

        {/* Metric toggle */}
        <div className="flex rounded-md border border-gray-200 overflow-hidden h-9">
          {([
            ["count", "項目數"],
            ["revenue", "收入"],
            ["gross_profit", "毛利"],
            ["pitches", "提案數"],
            ["hit_rate", "命中率"],
          ] as [Metric, string][]).map(([m, label], i) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-4 text-sm font-medium transition-colors ${i > 0 ? "border-l border-gray-200" : ""} ${
                metric === m ? "bg-bw-blue text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white"
          />
        </div>
      </div>

      {/* ─── TABLE ──────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-bw-blue" />
          <span className="ml-3 text-gray-500 text-sm">載入報表資料...</span>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead
                    className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap min-w-[180px]"
                    onClick={() => handleSort("name")}
                  >
                    <span className="flex items-center">Staff<SortIcon col="name" /></span>
                  </TableHead>
                  <TableHead
                    className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap text-right"
                    onClick={() => handleSort("total")}
                  >
                    <span className="flex items-center justify-end">總計 Total {metricLabel}<SortIcon col="total" /></span>
                  </TableHead>
                  <TableHead
                    className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap"
                    onClick={() => handleSort("best")}
                  >
                    <span className="flex items-center">
                      最佳{dimShort} Best {dimension === "project_type" ? (isBwfMode ? "Client Type" : "Project Type") : "Service Type"}
                      <SortIcon col="best" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap text-right"
                    onClick={() => handleSort("hit_rate")}
                  >
                    <span className="flex items-center justify-end">命中率 Hit Rate<SortIcon col="hit_rate" /></span>
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap text-right">
                    {dimShort}數 # Types
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-gray-400">
                      沒有找到符合條件的資料
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => {
                    const best = bestCellFor(row);
                    const isOpen = expanded.has(row.staffId);
                    const rowShape = rowMetricShape(row);
                    const rowTotal = metricVal(metric, rowShape);
                    const rowWeight = activityWeight(metric, rowShape);
                    const activeCells = row.cells.filter((c) => activityWeight(metric, c) !== 0);
                    // Cells sorted by the active metric, best first.
                    const sortedCells = [...activeCells].sort(
                      (a, b) => metricVal(metric, b) - metricVal(metric, a),
                    );
                    const hoverFormula =
                      metric === "hit_rate"
                        ? `轉化 ${row.total_converted_count} ÷ 提案 ${row.total_pitch_count}（整體命中率，同 pm-hit-rate Overall）`
                        : `各${dimShort}${metricShort}加總`;
                    return (
                      <React.Fragment key={row.staffId}>
                        <TableRow
                          className="hover:bg-gray-50/80 border-b border-gray-100 cursor-pointer"
                          onClick={() => toggle(row.staffId)}
                        >
                          <TableCell className="text-sm font-medium text-gray-900 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              {isOpen ? (
                                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                              )}
                              {row.staffName}
                            </span>
                          </TableCell>
                          <TableCell
                            className="text-sm text-right font-mono font-semibold text-gray-800 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MetricHoverCard
                              title={`${row.staffName} · ${metricLabel}`}
                              formula={hoverFormula}
                              source={hoverSource}
                              items={sortedCells.map((c) => ({
                                name: c.typeName,
                                value: metricVal(metric, c),
                                sub:
                                  metric === "hit_rate"
                                    ? `${c.converted_count} 轉化 / ${c.pitch_count} 提案`
                                    : undefined,
                              }))}
                              formatValue={fmtMetric}
                              total={rowTotal}
                            >
                              {fmtMetric(rowTotal)}
                            </MetricHoverCard>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {best ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="font-medium text-gray-800">{best.typeName}</span>
                                <span className="text-xs text-gray-400">
                                  ({fmtMetric(metricVal(metric, best))})
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </TableCell>
                          <TableCell
                            className="text-sm text-right font-mono text-gray-800 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MetricHoverCard
                              title={`${row.staffName} · 命中率 Hit Rate`}
                              formula={`轉化 ${row.total_converted_count} ÷ 提案 ${row.total_pitch_count}（整體命中率，同 pm-hit-rate Overall）`}
                              items={row.cells
                                .filter((c) => c.pitch_count > 0)
                                .sort((a, b) => hitRateOf(b) - hitRateOf(a))
                                .map((c) => ({
                                  name: c.typeName,
                                  value: hitRateOf(c),
                                  sub: `${c.converted_count} 轉化 / ${c.pitch_count} 提案`,
                                }))}
                              formatValue={(v) =>
                                Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : "—"
                              }
                              total={hitRateOf(rowShape)}
                            >
                              {fmtHitRate(rowShape)}
                            </MetricHoverCard>
                          </TableCell>
                          <TableCell className="text-sm text-right font-mono text-gray-500 whitespace-nowrap">
                            {activeCells.length}
                          </TableCell>
                        </TableRow>

                        {/* Expanded per-type breakdown */}
                        {isOpen && (
                          <TableRow className="bg-gray-50/40">
                            <TableCell colSpan={5} className="py-0">
                              <div className="py-2 pl-9 pr-3">
                                {sortedCells.length === 0 ? (
                                  <p className="text-xs text-gray-400 py-2">此期間沒有資料</p>
                                ) : (
                                  <div className="divide-y divide-gray-100">
                                    {sortedCells.map((c, i) => {
                                      const v = metricVal(metric, c);
                                      const w = activityWeight(metric, c);
                                      const pct = rowWeight ? (w / rowWeight) * 100 : 0;
                                      const cellKey = `${row.staffId}::${c.typeId}`;
                                      const cellOpen = expandedCells.has(cellKey);
                                      // Items under this type, by the active metric, best first.
                                      const cellItems = [...c.items]
                                        .filter((pr) => activityWeight(metric, pr) !== 0)
                                        .sort(
                                          (a, b) =>
                                            metricVal(metric, b) - metricVal(metric, a),
                                        );
                                      return (
                                        <div key={c.typeId}>
                                          <div
                                            className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-gray-100/60 rounded-md -mx-1.5 px-1.5"
                                            onClick={() => toggleCell(cellKey)}
                                          >
                                            <span className="w-4 shrink-0 flex items-center justify-center">
                                              {cellItems.length > 0 ? (
                                                cellOpen ? (
                                                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                                ) : (
                                                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                                )
                                              ) : null}
                                            </span>
                                            <span className="text-xs text-gray-400 w-5 shrink-0">{i + 1}.</span>
                                            <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">
                                              {c.typeName}
                                              {i === 0 && (
                                                <Trophy className="w-3 h-3 text-amber-500 inline ml-1.5 -mt-0.5" />
                                              )}
                                              <span className="text-xs text-gray-400 ml-1.5">
                                                命中率 {fmtHitRate(c)}
                                                {c.pitch_count > 0
                                                  ? ` (${c.converted_count}/${c.pitch_count})`
                                                  : ""}
                                              </span>
                                            </span>
                                            {/* Mini share bar — pitch/project weight share */}
                                            <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                                              <div
                                                className="h-full bg-bw-blue/70 rounded-full"
                                                style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                                              />
                                            </div>
                                            <span className="text-sm font-mono text-gray-800 w-24 text-right shrink-0">
                                              {fmtMetric(v)}
                                            </span>
                                            <span className="text-xs text-gray-400 w-14 text-right shrink-0">
                                              {pct.toFixed(1)}%
                                            </span>
                                          </div>

                                          {/* Third level: individual projects/pitches under this staff + type */}
                                          {cellOpen && (
                                            <div className="pl-9 pb-1.5 divide-y divide-gray-100/70">
                                              {cellItems.length === 0 ? (
                                                <p className="text-xs text-gray-400 py-1.5">此類型沒有資料</p>
                                              ) : (
                                                cellItems.map((pr, j) => {
                                                  const pv = metricVal(metric, pr);
                                                  const pw = activityWeight(metric, pr);
                                                  const ppct = w ? (pw / w) * 100 : 0;
                                                  return (
                                                    <div
                                                      key={pr.itemId}
                                                      className="flex items-center gap-3 py-1.5"
                                                    >
                                                      <span className="text-xs text-gray-300 w-5 shrink-0">{j + 1}.</span>
                                                      <span className="text-[13px] text-gray-600 flex-1 min-w-0 truncate">
                                                        {pr.itemName}
                                                        {metric === "hit_rate" && (
                                                          <span className="text-xs text-gray-400 ml-1.5">
                                                            {pr.converted_count ? "已轉化" : "未轉化"}
                                                          </span>
                                                        )}
                                                      </span>
                                                      <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                                                        <div
                                                          className="h-full bg-bw-blue/40 rounded-full"
                                                          style={{ width: `${Math.max(2, Math.min(100, ppct))}%` }}
                                                        />
                                                      </div>
                                                      <span className="text-[13px] font-mono text-gray-700 w-24 text-right shrink-0">
                                                        {metric === "hit_rate"
                                                          ? pr.converted_count
                                                            ? "100.00%"
                                                            : "0.00%"
                                                          : fmtMetric(pv)}
                                                      </span>
                                                      <span className="text-xs text-gray-400 w-14 text-right shrink-0">
                                                        {ppct.toFixed(1)}%
                                                      </span>
                                                    </div>
                                                  );
                                                })
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
              {visibleRows.length > 0 && (
                <tfoot>
                  <TableRow className="bg-gray-100/70 border-t-2 border-gray-200 font-semibold">
                    <TableCell className="text-sm text-gray-800 whitespace-nowrap">
                      總計 Total ({visibleRows.length})
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-900 whitespace-nowrap">
                      <MetricHoverCard
                        title={`總計 Total ${metricLabel}`}
                        formula={
                          metric === "hit_rate"
                            ? `全部轉化 ${totals.converted_count} ÷ 全部提案 ${totals.pitch_count}`
                            : `各員工${metricShort}加總`
                        }
                        source={hoverSource}
                        items={visibleRows.map((r) => ({
                          name: r.staffName,
                          value: metricVal(metric, rowMetricShape(r)),
                          sub:
                            metric === "hit_rate"
                              ? `${r.total_converted_count} 轉化 / ${r.total_pitch_count} 提案`
                              : undefined,
                        }))}
                        formatValue={fmtMetric}
                        total={metricVal(metric, totals)}
                      >
                        {fmtMetric(metricVal(metric, totals))}
                      </MetricHoverCard>
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-900 whitespace-nowrap">
                      <MetricHoverCard
                        title="總計 Total 命中率 Hit Rate"
                        formula={`全部轉化 ${totals.converted_count} ÷ 全部提案 ${totals.pitch_count}（同 pm-hit-rate Overall）`}
                        items={visibleRows.map((r) => ({
                          name: r.staffName,
                          value: hitRateOf(rowMetricShape(r)),
                          sub: `${r.total_converted_count} 轉化 / ${r.total_pitch_count} 提案`,
                        }))}
                        formatValue={(v) =>
                          Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : "—"
                        }
                        total={hitRateOf(totals)}
                      >
                        {fmtHitRate(totals)}
                      </MetricHoverCard>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </div>
      )}

      {/* ─── NOTE ───────────────────────────────────── */}
      <p className="text-sm text-gray-400 text-center">
        {isPitchMetric ? (
          <>
            Note: 按提案詢問日期 (enquiry date) 篩選。提案數為期間內全部報價；
            命中率欄 = 已轉化且計隻數的提案 ÷ 全部提案（同 /business-reports/pm-hit-rate Overall Hit Rate），
            展開後亦顯示各{dimShort}命中率。
            點擊員工列可展開其各{dimShort}的{itemNoun}明細。
          </>
        ) : (
          <>
            Note: 項目指標按簽約日期 (signed date) 篩選（項目數受「計隻數」、收入／毛利受「計錢」限制）。
            命中率欄另按提案詢問日期計算：已轉化且計隻數 ÷ 全部提案（同 /business-reports/pm-hit-rate Overall），
            展開後顯示各{dimShort}命中率。
            點擊員工列可展開其各{dimShort}的明細。
          </>
        )}
      </p>
    </div>
  );
}
