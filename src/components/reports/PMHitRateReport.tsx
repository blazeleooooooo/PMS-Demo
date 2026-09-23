"use client";

// ═══════════════════════════════════════════════════════════════════════════
// AI WARNING — SHARED HIT-RATE REPORT (DO NOT DUPLICATE)
// This single component renders:
//   • /business-reports/pm-hit-rate             → role="pm"
//   • /design-reports/designer-hit-rate         → role="designer"
//   • /team-reports/pm-hit-rate                 → role="pm" reportScope="team"
//   • /individual-reports/pitch-hit-rate        → role="pm" reportScope="individual"
// Any metric / PP-split / aggregation change here applies to ALL linked pages.
// Prefer editing this file + HitRateStaffRole; do NOT copy-paste forks.
// Data fetch: fetchPMHitRatePitches(role) in data-service.
// reportScope="team" locks Team; "individual" locks 員工 (unless Super Admin).
// Individual layout: metric cards + Project/Pitching listings (same items as
// each staff row's Projects / Pitching hover cards on the business table).
// BWA: no PP split (Pitching / Projects / Hit Rate only). BWF: PP / ❌ PP / Overall.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  HelpCircle,
} from "lucide-react";
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
import {
  fetchPMHitRatePitches,
  type HitRateStaffRole,
  type PMHitRatePitch,
  type StaffDirectoryRow,
} from "@/lib/data-service";
import { getEffectiveStatusRule } from "@/lib/project-status-rules";
import { excludePPLabel, ppLabel } from "@/lib/report-mini-pp";
import MetricHoverCard, {
  MetricBreakdownPanel,
  type BreakdownItem,
} from "@/components/reports/MetricHoverCard";

// ─── DATE-RANGE PRESETS — shared across business + design hit-rate reports ──
import {
  resolveRange,
  rangeBounds,
  fmtRangeDate as fmtDate,
} from "@/lib/report-date-range";
import { useReportRange, filterBySources } from "@/components/reports/ReportDateRangeContext";
import ReportFilterStack from "@/components/reports/ReportFilterStack";
import { applyProjectFilters } from "@/components/reports/ProjectFilterBar";
import { staffIdMatchesFilter } from "@/components/reports/StaffFilterBar";
import { useAlignedReportFilters } from "@/hooks/use-aligned-report-filters";
import {
  projectFilterNeedsExtras,
  useEnrichedProjectFilterRows,
} from "@/hooks/use-project-filter-extras";
import type { ReportStaffScope } from "@/hooks/use-report-staff-lock";

export interface PMHitRateReportProps {
  /**
   * AI WARNING (SHARED): "pm" and "designer" share this component.
   * Changing layout/metrics here updates ALL linked hit-rate pages.
   * designer → main_designer_id + staff.position = "Designer".
   */
  role?: HitRateStaffRole;
  /**
   * Route scope for StaffFilterBar locks.
   * team → Team lock; individual → 員工 lock (unless Super Admin).
   * individual also switches to metric-card + listing layout.
   */
  reportScope?: ReportStaffScope;
}

function MetricCard({
  label,
  value,
  accent,
  tooltip,
}: {
  label: string;
  value: string;
  accent: string;
  tooltip?: string;
}) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg shadow-sm px-5 py-4 border-l-4"
      style={{ borderLeftColor: accent }}
    >
      <p className="text-sm text-gray-500 inline-flex items-center gap-1">
        {label}
        {tooltip && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex text-gray-400 hover:text-gray-600"
                  aria-label={`${label}說明`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-[280px] bg-gray-900 text-white text-xs leading-relaxed font-normal"
              >
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </p>
      <span className="block text-2xl font-bold text-gray-900 mt-1 whitespace-nowrap font-mono-num">
        {value}
      </span>
    </div>
  );
}

function isEnquiryStage(stage: string | null | undefined): boolean {
  if (!stage) return false;
  const s = stage.toLowerCase();
  return s.includes("enquiry") || s.includes("查詢");
}

function fmtPct(num: number, denom: number): string {
  if (!denom) return "0.00%";
  return `${((num / denom) * 100).toFixed(2)}%`;
}

// ─── AGGREGATED ROW (one per PM) ──────────────────────────────
interface PMRow {
  key: string;
  pm_name: string;
  total_pitches: number; // w/o Mini
  mini_pitching: number;
  converted: number; // w/o Mini
  mini_projects: number; // converted minis
  // Contributing pitches/projects per metric, for hover breakdowns.
  items_total_pitches: BreakdownItem[];
  items_mini_pitching: BreakdownItem[];
  items_converted: BreakdownItem[];
  items_mini_projects: BreakdownItem[];
}

// Sortable numeric columns.
type SortCol =
  | "pm_name"
  | "total_pitches"
  | "mini_pitching"
  | "converted"
  | "mini_projects"
  | "hit_rate"
  | "pp_hit_rate"
  | "overall_hit_rate"
  | "overall_pitching"
  | "overall_projects";

function overallDenom(r: Pick<PMRow, "total_pitches" | "mini_pitching">): number {
  return r.total_pitches + r.mini_pitching;
}

function overallNumer(r: Pick<PMRow, "converted" | "mini_projects">): number {
  return r.converted + r.mini_projects;
}

export default function PMHitRateReport({
  role = "pm",
  reportScope = "business",
}: PMHitRateReportProps) {
  // AI WARNING: role switches attribution (main_pm vs main_designer) for both
  // hit-rate routes — keep titles/labels derived from role, not hard-coded copies.
  const isDesigner = role === "designer";
  const isIndividual = reportScope === "individual";
  const staffColumnLabel = isDesigner ? "Designer" : "Project Manager";
  const titleZhEn = isIndividual
    ? "投標Hit Rate Pitch Hit Rate"
    : isDesigner
      ? "設計師命中率 Designer Hit Rate"
      : "項目經理命中率 Project Manager Hit Rate";

  const [pitches, setPitches] = useState<PMHitRatePitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const { range, custom, sources } = useReportRange();
  const {
    projectFilter,
    setProjectFilter,
    staffFilter,
    setStaffFilter,
    staffLocks,
    isSuperAdmin,
  } = useAlignedReportFilters(reportScope);
  /** PP / ❌ PP sections only when BWF is the active source. */
  const showPPColumns = sources.bwf && !sources.bwa;
  const PP_LABEL = ppLabel();
  const EXCLUDE_PP_LABEL = excludePPLabel();
  const [sortCol, setSortCol] = useState<SortCol>("overall_hit_rate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (
      !showPPColumns &&
      (sortCol === "mini_pitching" ||
        sortCol === "mini_projects" ||
        sortCol === "pp_hit_rate" ||
        sortCol === "total_pitches" ||
        sortCol === "converted" ||
        sortCol === "hit_rate")
    ) {
      setSortCol("overall_pitching");
    }
  }, [showPPColumns, sortCol]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const rows = await fetchPMHitRatePitches(role);
      setPitches(rows);
      setLoading(false);
    }
    load();
  }, [role]);

  // Resolve the active window once per range change.
  const window = useMemo(() => resolveRange(range, new Date(), custom), [range, custom]);

  const sourcePitches = useMemo(
    () => filterBySources(pitches, sources),
    [pitches, sources],
  );
  const enrichedPitches = useEnrichedProjectFilterRows(
    sourcePitches,
    projectFilterNeedsExtras(projectFilter),
  );

  const filteredPitches = useMemo(
    () => applyProjectFilters(enrichedPitches, projectFilter),
    [enrichedPitches, projectFilter],
  );

  // ─── AGGREGATE INTO PM × METRIC MATRIX ─────────────────────
  const pmRows = useMemo(() => {
    const groups = new Map<string, PMRow>();
    const { fromMs, toMs } = rangeBounds(window);

    for (const p of filteredPitches) {
      if (!p.enquiry_date) continue;
      const t = new Date(p.enquiry_date).getTime();
      if (isNaN(t) || t < fromMs || t > toMs) continue;
      if (!staffIdMatchesFilter(p.pm_id, staffFilter, staffDirectory)) continue;

      const key = p.pm_id || "unassigned";
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          pm_name: p.pm_name || "未分配 Unassigned",
          total_pitches: 0,
          mini_pitching: 0,
          converted: 0,
          mini_projects: 0,
          items_total_pitches: [],
          items_mini_pitching: [],
          items_converted: [],
          items_mini_projects: [],
        };
        groups.set(key, g);
      }
      // Converted headcount respects 計隻數 when status filter is "all".
      const projectCounts =
        p.converted &&
        getEffectiveStatusRule(p.converted_status, projectFilter.status).countNumber;
      const label = p.pitch_label || p.pitch_code || "(未命名報價)";
      const item: BreakdownItem = {
        name: label,
        sub: [p.pitch_code, p.converted ? `→ ${p.converted_status || "已轉項目"}` : "未轉項目"]
          .filter(Boolean)
          .join(" · ") || undefined,
      };
      if (p.is_mini) {
        g.mini_pitching += 1;
        g.items_mini_pitching.push(item);
        if (projectCounts) {
          g.mini_projects += 1;
          g.items_mini_projects.push(item);
        }
      } else {
        g.total_pitches += 1;
        g.items_total_pitches.push(item);
        if (projectCounts) {
          g.converted += 1;
          g.items_converted.push(item);
        }
      }
    }

    return Array.from(groups.values());
  }, [filteredPitches, window, staffFilter, staffDirectory, projectFilter.status]);

  // ─── SORT ──────────────────────────────────────────────────
  const visibleRows = useMemo(() => {
    const valueFor = (r: PMRow): number | string => {
      switch (sortCol) {
        case "pm_name":
          return r.pm_name.toLowerCase();
        case "total_pitches":
          return r.total_pitches;
        case "mini_pitching":
          return r.mini_pitching;
        case "converted":
          return r.converted;
        case "mini_projects":
          return r.mini_projects;
        case "hit_rate":
          return r.total_pitches ? r.converted / r.total_pitches : 0;
        case "pp_hit_rate":
          return r.mini_pitching ? r.mini_projects / r.mini_pitching : 0;
        case "overall_hit_rate": {
          const denom = overallDenom(r);
          return denom ? overallNumer(r) / denom : 0;
        }
        case "overall_pitching":
          return overallDenom(r);
        case "overall_projects":
          return overallNumer(r);
      }
    };
    return [...pmRows].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [pmRows, sortCol, sortDir]);

  // ─── COLUMN TOTALS (footer) ────────────────────────────────
  const totals = useMemo(() => {
    return visibleRows.reduce(
      (acc, r) => {
        acc.total_pitches += r.total_pitches;
        acc.mini_pitching += r.mini_pitching;
        acc.converted += r.converted;
        acc.mini_projects += r.mini_projects;
        return acc;
      },
      { total_pitches: 0, mini_pitching: 0, converted: 0, mini_projects: 0 }
    );
  }, [visibleRows]);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(col === "pm_name" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col)
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1 text-bw-blue inline" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 text-bw-blue inline" />
    );
  }

  // Vertical divider between metric sections (Mini | Non-mini | Overall).
  const sectionStart = "border-l-2 border-gray-300 pl-3";
  // Main section (❌ Mini/PP) — soft primary-blue wash so it reads as the focus block.
  const mainSectionBg = "bg-bw-blue/10";
  const mainSectionHeadBg = "bg-bw-blue/15";
  const miniSectionBg = "bg-amber-50/40";
  const sortHead =
    "text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap text-right min-w-[100px]";

  // Individual page: same Overall Pitching / Projects / Hit Rate as one PM row
  // (or the sum of filtered staff when Super Admin widens the staff filter).
  // Listing rows use columns: code | display name | stage/status.
  const individualWindowPitches = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    return filteredPitches.filter((p) => {
      if (!p.enquiry_date) return false;
      const t = new Date(p.enquiry_date).getTime();
      if (isNaN(t) || t < fromMs || t > toMs) return false;
      if (!staffIdMatchesFilter(p.pm_id, staffFilter, staffDirectory)) return false;
      return true;
    });
  }, [filteredPitches, window, staffFilter, staffDirectory]);

  const individualPitchingItems = useMemo<BreakdownItem[]>(
    () =>
      individualWindowPitches.map((p) => ({
        code: p.pitch_code || "—",
        name: p.pitch_label || "(未命名報價)",
        status: p.pitching_stages || "—",
      })),
    [individualWindowPitches],
  );

  const individualProjectItems = useMemo<BreakdownItem[]>(
    () =>
      individualWindowPitches
        .filter(
          (p) =>
            p.converted &&
            getEffectiveStatusRule(p.converted_status, projectFilter.status)
              .countNumber,
        )
        .map((p) => ({
          code: p.project_code || "—",
          name: p.project_name || p.pitch_label || "(未命名項目)",
          status: p.converted_status || "—",
        })),
    [individualWindowPitches, projectFilter.status],
  );

  const individualPitchingCount = overallDenom(totals);
  const individualProjectCount = overallNumer(totals);
  // 提案命中率：分母排除 Enquiry（查詢）階段提案。
  const pitchingHitDenom = useMemo(
    () => individualWindowPitches.filter((p) => !isEnquiryStage(p.pitching_stages)).length,
    [individualWindowPitches],
  );

  const filterStack = (
    <ReportFilterStack
      projectRows={enrichedPitches}
      projectFilter={projectFilter}
      onProjectFilterChange={setProjectFilter}
      staffFilter={staffFilter}
      onStaffFilterChange={setStaffFilter}
      staffLocks={staffLocks}
      isSuperAdmin={isSuperAdmin}
      onStaffDirectoryLoaded={setStaffDirectory}
    />
  );

  const enquiryNote = (
    <p className="text-sm text-gray-400 text-center">
      Note: This summary is based on pitches with a project enquiry date in the
      selected period.
    </p>
  );

  // ─── INDIVIDUAL LAYOUT (/individual-reports/pitch-hit-rate) ──
  if (isIndividual) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{titleZhEn}</h2>
          <p className="text-sm text-gray-500 mt-1">
            From {fmtDate(window.from)} to {fmtDate(window.to)}
          </p>
        </div>

        {filterStack}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-bw-blue" />
            <span className="ml-3 text-gray-500 text-sm">載入報表資料...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="提案數量"
                value={String(individualPitchingCount)}
                accent="#64748b"
              />
              <MetricCard
                label="項目數量"
                value={String(individualProjectCount)}
                accent="#0ea5e9"
              />
              <MetricCard
                label="整體命中率"
                value={fmtPct(individualProjectCount, individualPitchingCount)}
                accent="#2563eb"
              />
              <MetricCard
                label="提案命中率"
                value={fmtPct(individualProjectCount, pitchingHitDenom)}
                accent="#7c3aed"
                tooltip={`項目數量 ÷（提案數量 − 查詢階段提案）＝${individualProjectCount} ÷ ${pitchingHitDenom}。分母排除 pitching stage 為 Enquiry（查詢）的提案，只計算已進入提案階段及以上的報價。`}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 underline underline-offset-4 decoration-gray-300 mb-3">
                  項目列表
                </h3>
                <MetricBreakdownPanel
                  title="轉化項目（計入命中率）"
                  formula="已轉成項目且狀態計隻數的報價（同 pm-hit-rate Projects 欄）"
                  items={individualProjectItems}
                  isCount
                  columns
                  statusBadge="project"
                  columnLabels={{
                    code: "項目編號",
                    name: "項目名稱",
                    status: "項目狀態",
                  }}
                  emptyLabel="此期間沒有轉化項目"
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 underline underline-offset-4 decoration-gray-300 mb-3">
                  報價列表
                </h3>
                <MetricBreakdownPanel
                  title="全部報價（命中率分母）"
                  formula="期間內全部報價（按詢問日期；同 pm-hit-rate Pitching 欄）"
                  items={individualPitchingItems}
                  isCount
                  columns
                  statusBadge="pitching"
                  columnLabels={{
                    code: "報價編號",
                    name: "客戶／名稱",
                    status: "報價階段",
                  }}
                  emptyLabel="此期間沒有報價記錄"
                />
              </div>
            </div>
          </>
        )}

        {enquiryNote}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">{titleZhEn}</h2>
        <p className="text-sm text-gray-500 mt-1">
          From {fmtDate(window.from)} to {fmtDate(window.to)}
        </p>
      </div>

      {filterStack}

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
                {showPPColumns ? (
                  <>
                    <TableRow className="bg-gray-100/90 border-b border-gray-200">
                      <TableHead
                        rowSpan={2}
                        className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap min-w-[160px] sticky left-0 bg-gray-100/90 z-10 align-bottom pb-2"
                        onClick={() => handleSort("pm_name")}
                      >
                        <span className="flex items-center">
                          {staffColumnLabel}
                          <SortIcon col="pm_name" />
                        </span>
                      </TableHead>
                      <TableHead
                        colSpan={3}
                        className={`${sectionStart} text-center text-xs font-bold text-gray-800 tracking-wide bg-amber-50/60`}
                      >
                        {PP_LABEL}
                      </TableHead>
                      <TableHead
                        colSpan={3}
                        className={`${sectionStart} ${mainSectionHeadBg} text-center text-xs font-bold text-bw-blue tracking-wide`}
                      >
                        {EXCLUDE_PP_LABEL}
                        <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-bw-blue/70">
                          Main
                        </span>
                      </TableHead>
                      <TableHead
                        colSpan={1}
                        className={`${sectionStart} text-center text-xs font-bold text-gray-800 tracking-wide bg-sky-50/70`}
                      >
                        Overall
                      </TableHead>
                    </TableRow>
                    <TableRow className="bg-gray-50/80">
                      <TableHead
                        className={`${sortHead} ${sectionStart} ${miniSectionBg}`}
                        onClick={() => handleSort("mini_pitching")}
                      >
                        <span className="flex items-center justify-end">
                          Pitching
                          <SortIcon col="mini_pitching" />
                        </span>
                      </TableHead>
                      <TableHead
                        className={`${sortHead} ${miniSectionBg}`}
                        onClick={() => handleSort("mini_projects")}
                      >
                        <span className="flex items-center justify-end">
                          Projects
                          <SortIcon col="mini_projects" />
                        </span>
                      </TableHead>
                      <TableHead
                        className={`${sortHead} ${miniSectionBg}`}
                        onClick={() => handleSort("pp_hit_rate")}
                      >
                        <span className="flex items-center justify-end">
                          Hit Rate
                          <SortIcon col="pp_hit_rate" />
                        </span>
                      </TableHead>
                      <TableHead
                        className={`${sortHead} ${sectionStart} ${mainSectionBg}`}
                        onClick={() => handleSort("total_pitches")}
                      >
                        <span className="flex items-center justify-end">
                          Pitching
                          <SortIcon col="total_pitches" />
                        </span>
                      </TableHead>
                      <TableHead
                        className={`${sortHead} ${mainSectionBg}`}
                        onClick={() => handleSort("converted")}
                      >
                        <span className="flex items-center justify-end">
                          Projects
                          <SortIcon col="converted" />
                        </span>
                      </TableHead>
                      <TableHead
                        className={`${sortHead} ${mainSectionBg}`}
                        onClick={() => handleSort("hit_rate")}
                      >
                        <span className="flex items-center justify-end">
                          Hit Rate
                          <SortIcon col="hit_rate" />
                        </span>
                      </TableHead>
                      <TableHead
                        className={`${sortHead} ${sectionStart} min-w-[120px] bg-sky-50/50`}
                        onClick={() => handleSort("overall_hit_rate")}
                      >
                        <span className="flex items-center justify-end">
                          Hit Rate
                          <SortIcon col="overall_hit_rate" />
                        </span>
                      </TableHead>
                    </TableRow>
                  </>
                ) : (
                  <TableRow className="bg-gray-50/80">
                    <TableHead
                      className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap min-w-[160px] sticky left-0 bg-gray-50/80 z-10"
                      onClick={() => handleSort("pm_name")}
                    >
                      <span className="flex items-center">
                        {staffColumnLabel}
                        <SortIcon col="pm_name" />
                      </span>
                    </TableHead>
                    <TableHead
                      className={sortHead}
                      onClick={() => handleSort("overall_pitching")}
                    >
                      <span className="flex items-center justify-end">
                        Pitching
                        <SortIcon col="overall_pitching" />
                      </span>
                    </TableHead>
                    <TableHead
                      className={sortHead}
                      onClick={() => handleSort("overall_projects")}
                    >
                      <span className="flex items-center justify-end">
                        Projects
                        <SortIcon col="overall_projects" />
                      </span>
                    </TableHead>
                    <TableHead
                      className={sortHead}
                      onClick={() => handleSort("overall_hit_rate")}
                    >
                      <span className="flex items-center justify-end">
                        Hit Rate
                        <SortIcon col="overall_hit_rate" />
                      </span>
                    </TableHead>
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={showPPColumns ? 8 : 4}
                      className="text-center py-16 text-gray-400"
                    >
                      此期間沒有報價記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.key}
                      className="hover:bg-gray-50/80 border-b border-gray-100"
                    >
                      <TableCell className="text-sm font-medium text-gray-900 whitespace-nowrap sticky left-0 bg-white z-10">
                        {row.pm_name}
                      </TableCell>
                      {showPPColumns ? (
                        <>
                          <TableCell className={`text-sm text-right font-mono text-gray-600 whitespace-nowrap ${sectionStart} ${miniSectionBg}`}>
                            <MetricHoverCard
                              title={`${row.pm_name} · ${PP_LABEL} 報價數`}
                              formula="來源為 BWA-PP 的報價"
                              items={row.items_mini_pitching}
                              isCount
                            >
                              {row.mini_pitching}
                            </MetricHoverCard>
                          </TableCell>
                          <TableCell className={`text-sm text-right font-mono text-gray-600 whitespace-nowrap ${miniSectionBg}`}>
                            <MetricHoverCard
                              title={`${row.pm_name} · ${PP_LABEL} 轉化項目`}
                              formula={`已轉成項目的 ${PP_LABEL} 報價（BWA-PP）`}
                              items={row.items_mini_projects}
                              isCount
                            >
                              {row.mini_projects}
                            </MetricHoverCard>
                          </TableCell>
                          <TableCell className={`text-sm text-right font-mono text-bw-blue whitespace-nowrap ${miniSectionBg}`}>
                            <MetricHoverCard
                              title={`${row.pm_name} · ${PP_LABEL} 命中率`}
                              formula={`${PP_LABEL} 轉化 ${row.mini_projects} ÷ ${PP_LABEL} 報價 ${row.mini_pitching}`}
                              items={row.items_mini_projects}
                              isCount
                            >
                              {fmtPct(row.mini_projects, row.mini_pitching)}
                            </MetricHoverCard>
                          </TableCell>
                          <TableCell className={`text-sm text-right font-mono font-semibold text-gray-800 whitespace-nowrap ${sectionStart} ${mainSectionBg}`}>
                            <MetricHoverCard
                              title={`${row.pm_name} · 總報價數 (${EXCLUDE_PP_LABEL})`}
                              formula="來源非 BWA-PP 的報價（按報價詢問日期）"
                              items={row.items_total_pitches}
                              isCount
                            >
                              {row.total_pitches}
                            </MetricHoverCard>
                          </TableCell>
                          <TableCell className={`text-sm text-right font-mono font-semibold text-gray-800 whitespace-nowrap ${mainSectionBg}`}>
                            <MetricHoverCard
                              title={`${row.pm_name} · 成功轉化項目 (${EXCLUDE_PP_LABEL})`}
                              formula="已轉成項目且狀態計隻數的報價（來源非 BWA-PP）"
                              items={row.items_converted}
                              isCount
                            >
                              {row.converted}
                            </MetricHoverCard>
                          </TableCell>
                          <TableCell className={`text-sm text-right font-mono font-semibold text-bw-blue whitespace-nowrap ${mainSectionBg}`}>
                            <MetricHoverCard
                              title={`${row.pm_name} · 命中率 (${EXCLUDE_PP_LABEL})`}
                              formula={`成功轉化 ${row.converted} ÷ 總報價 ${row.total_pitches}`}
                              items={row.items_converted}
                              isCount
                            >
                              {fmtPct(row.converted, row.total_pitches)}
                            </MetricHoverCard>
                          </TableCell>
                          <TableCell className={`text-sm text-right font-mono font-semibold text-bw-blue whitespace-nowrap ${sectionStart}`}>
                            <MetricHoverCard
                              title={`${row.pm_name} · 整體命中率`}
                              formula={`全部轉化 ${overallNumer(row)} ÷ 全部報價 ${overallDenom(row)}（含 PP）`}
                              items={[...row.items_converted, ...row.items_mini_projects]}
                              isCount
                            >
                              {fmtPct(overallNumer(row), overallDenom(row))}
                            </MetricHoverCard>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-sm text-right font-mono font-semibold text-gray-800 whitespace-nowrap">
                            <MetricHoverCard
                              title={`${row.pm_name} · 報價數`}
                              formula="期間內全部報價（按詢問日期）"
                              items={[...row.items_total_pitches, ...row.items_mini_pitching]}
                              isCount
                            >
                              {overallDenom(row)}
                            </MetricHoverCard>
                          </TableCell>
                          <TableCell className="text-sm text-right font-mono font-semibold text-gray-800 whitespace-nowrap">
                            <MetricHoverCard
                              title={`${row.pm_name} · 轉化項目`}
                              formula="已轉成項目且狀態計隻數的報價"
                              items={[...row.items_converted, ...row.items_mini_projects]}
                              isCount
                            >
                              {overallNumer(row)}
                            </MetricHoverCard>
                          </TableCell>
                          <TableCell className="text-sm text-right font-mono font-semibold text-bw-blue whitespace-nowrap">
                            <MetricHoverCard
                              title={`${row.pm_name} · 命中率`}
                              formula={`轉化 ${overallNumer(row)} ÷ 報價 ${overallDenom(row)}`}
                              items={[...row.items_converted, ...row.items_mini_projects]}
                              isCount
                            >
                              {fmtPct(overallNumer(row), overallDenom(row))}
                            </MetricHoverCard>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
              {visibleRows.length > 0 && (
                <tfoot>
                  <TableRow className="bg-gray-100/70 border-t-2 border-gray-200 font-semibold">
                    <TableCell className="text-sm text-gray-800 whitespace-nowrap sticky left-0 bg-gray-100/70 z-10">
                      總計 Total ({visibleRows.length})
                    </TableCell>
                    {showPPColumns ? (
                      <>
                        <TableCell className={`text-sm text-right font-mono text-gray-800 whitespace-nowrap ${sectionStart} ${miniSectionBg}`}>
                          {totals.mini_pitching}
                        </TableCell>
                        <TableCell className={`text-sm text-right font-mono text-gray-800 whitespace-nowrap ${miniSectionBg}`}>
                          {totals.mini_projects}
                        </TableCell>
                        <TableCell className={`text-sm text-right font-mono text-gray-900 whitespace-nowrap ${miniSectionBg}`}>
                          {fmtPct(totals.mini_projects, totals.mini_pitching)}
                        </TableCell>
                        <TableCell className={`text-sm text-right font-mono text-gray-800 whitespace-nowrap ${sectionStart} ${mainSectionBg}`}>
                          {totals.total_pitches}
                        </TableCell>
                        <TableCell className={`text-sm text-right font-mono text-gray-800 whitespace-nowrap ${mainSectionBg}`}>
                          {totals.converted}
                        </TableCell>
                        <TableCell className={`text-sm text-right font-mono text-gray-900 whitespace-nowrap ${mainSectionBg}`}>
                          {fmtPct(totals.converted, totals.total_pitches)}
                        </TableCell>
                        <TableCell className={`text-sm text-right font-mono text-gray-900 whitespace-nowrap ${sectionStart}`}>
                          {fmtPct(overallNumer(totals), overallDenom(totals))}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-sm text-right font-mono text-gray-800 whitespace-nowrap">
                          {overallDenom(totals)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono text-gray-800 whitespace-nowrap">
                          {overallNumer(totals)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono text-gray-900 whitespace-nowrap">
                          {fmtPct(overallNumer(totals), overallDenom(totals))}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </div>
      )}

      {enquiryNote}
    </div>
  );
}
