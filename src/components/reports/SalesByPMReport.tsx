"use client";

// ═══════════════════════════════════════════════════════════════════════════
// AI WARNING — SHARED SALES BY PM REPORT (DO NOT DUPLICATE)
//   • /business-reports/sales-by-pm → <SalesByPMReport />
//   • /team-reports/sales-by-pm     → reportScope="team"
// Edits apply to BOTH pages. reportScope="team" locks Team in StaffFilterBar
// (unless Super Admin); PM rows filtered via staffIdMatchesFilter.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
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
  fetchSalesByPMProjects,
  type SalesByPMProject,
} from "@/lib/data-service";
import {
  fetchSalesByPmBvShares,
  lookupSalesByPmBvShare,
  salesByPmShareAmounts,
  type SalesByPmBvShare,
} from "@/lib/data/sales-by-pm";
import { getEffectiveStatusRule } from "@/lib/project-status-rules";
import MetricHoverCard, { type BreakdownItem, projectHref } from "@/components/reports/MetricHoverCard";

// ─── DATE PRESETS — shared across all /business-reports ───────
import {
  resolveRange,
  rangeBounds,
  fmtRangeDate,
} from "@/lib/report-date-range";
import { useReportRange, filterBySources } from "@/components/reports/ReportDateRangeContext";
import ReportFilterStack from "@/components/reports/ReportFilterStack";
import ReportDateRangeNote from "@/components/reports/ReportDateRangeNote";
import { applyProjectFilters } from "@/components/reports/ProjectFilterBar";
import { staffIdMatchesFilter } from "@/components/reports/StaffFilterBar";
import { useAlignedReportFilters } from "@/hooks/use-aligned-report-filters";
import {
  projectFilterNeedsExtras,
  useEnrichedProjectFilterRows,
} from "@/hooks/use-project-filter-extras";
import type { ReportStaffScope } from "@/hooks/use-report-staff-lock";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import type { StaffDirectoryRow } from "@/lib/data-service";
import { countsExcludeMiniPP, excludePPLabel } from "@/lib/report-mini-pp";

export interface SalesByPMReportProps {
  /** Route scope for StaffFilterBar locks (team → Team lock unless Super Admin). */
  reportScope?: ReportStaffScope;
}

// ─── HELPERS ──────────────────────────────────────────────────

function fmtPct(val: number | null): string {
  if (val == null || isNaN(val)) return "0.00%";
  return `${val.toFixed(2)}%`;
}

// ─── PM AGGREGATED ROW ────────────────────────────────────────
interface PMRow {
  pm_id: string;
  pm_name: string;
  // ❌ PP (BWF only): n_source_id ≠ BWA-PP
  count_no_mini: number;
  // all projects count
  count_all: number;
  total_revenue_no_mini: number;
  total_revenue_all: number;
  total_cost: number;
  gross_profit: number;
  shared_gp: number;
  bv: number;
  margin: number;
  // Contributing projects behind each column, for hover breakdowns.
  proj_count_no_mini: BreakdownItem[];
  proj_count_all: BreakdownItem[];
  proj_revenue_no_mini: BreakdownItem[];
  proj_revenue_all: BreakdownItem[];
  proj_cost: BreakdownItem[];
  proj_gp: BreakdownItem[];
  proj_shared_gp: BreakdownItem[];
  proj_bv: BreakdownItem[];
}

type SortField = "pm_name" | "count_no_mini" | "count_all" | "total_revenue_no_mini" | "total_revenue_all" | "total_cost" | "gross_profit" | "shared_gp" | "bv" | "margin";

export default function SalesByPMReport({
  reportScope = "business",
}: SalesByPMReportProps) {
  const { formatMoney2, formatBV } = useFinancialFormat();
  const moneyOpts = { fallback: "N/A" } as const;
  const bvOpts = { fallback: "N/A" } as const;

  const [projects, setProjects] = useState<SalesByPMProject[]>([]);
  const [bvShares, setBvShares] = useState<Map<string, SalesByPmBvShare>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);

  const { range: selectedPreset, custom, sources } = useReportRange();
  const {
    projectFilter,
    setProjectFilter,
    staffFilter,
    setStaffFilter,
    moneyBasis,
    setMoneyBasis,
    staffLocks,
    isSuperAdmin,
  } = useAlignedReportFilters(reportScope);
  const [sortField, setSortField] = useState<SortField>("total_revenue_all");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  /** PP / ❌ PP columns only when BWF is the active source. */
  const showPPColumns = sources.bwf && !sources.bwa;
  const EXCLUDE_PP_LABEL = excludePPLabel();

  useEffect(() => {
    // Avoid sorting by a hidden PP column when on BWA.
    if (!showPPColumns && (sortField === "count_no_mini" || sortField === "total_revenue_no_mini")) {
      setSortField("total_revenue_all");
    }
  }, [showPPColumns, sortField]);

  useEffect(() => {
    Promise.all([fetchSalesByPMProjects(), fetchSalesByPmBvShares()]).then(
      ([projectData, shareMap]) => {
        setProjects(projectData);
        setBvShares(shareMap);
        setLoading(false);
      },
    );
  }, []);

  const window = useMemo(() => resolveRange(selectedPreset, new Date(), custom), [selectedPreset, custom]);

  // ─── FILTER: BWA/BWF toggle + ultimate project filter + date preset ──
  const sourceProjects = useMemo(() => filterBySources(projects, sources), [projects, sources]);
  const enrichedProjects = useEnrichedProjectFilterRows(
    sourceProjects,
    projectFilterNeedsExtras(projectFilter),
  );

  const filteredProjects = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    return applyProjectFilters(enrichedProjects, projectFilter).filter((p) => {
      if (!staffIdMatchesFilter(p.pm_id, staffFilter, staffDirectory)) return false;
      if (!p.signed_date) return false;
      const t = new Date(p.signed_date).getTime();
      return !isNaN(t) && t >= fromMs && t <= toMs;
    });
  }, [enrichedProjects, window, projectFilter, staffFilter, staffDirectory]);

  // ─── DATE RANGE LABEL ─────────────────────────────────────
  const dateRangeLabel = useMemo(
    () => `From ${fmtRangeDate(window.from)} to ${fmtRangeDate(window.to)}`,
    [window]
  );

  // ─── AGGREGATE INTO PM ROWS ───────────────────────────────
  const pmRows = useMemo(() => {
    const groups = new Map<string, PMRow>();

    for (const p of filteredProjects) {
      const key = p.pm_id || "__unassigned__";
      const name = p.pm_name || "未分配 Unassigned";

      if (!groups.has(key)) {
        groups.set(key, {
          pm_id: key,
          pm_name: name,
          count_no_mini: 0,
          count_all: 0,
          total_revenue_no_mini: 0,
          total_revenue_all: 0,
          total_cost: 0,
          gross_profit: 0,
          shared_gp: 0,
          bv: 0,
          margin: 0,
          proj_count_no_mini: [],
          proj_count_all: [],
          proj_revenue_no_mini: [],
          proj_revenue_all: [],
          proj_cost: [],
          proj_gp: [],
          proj_shared_gp: [],
          proj_bv: [],
        });
      }

      const row = groups.get(key)!;

      // Project status decides money (計錢) / counts (計隻數) when filter is "all".
      const rule = getEffectiveStatusRule(p.status, projectFilter.status);

      const revenue = moneyBasis === "l2" ? (p.est_income || 0) : p.actual_income;
      const cost    = moneyBasis === "l2" ? (p.est_expense || 0) : p.actual_expense;
      const { sharedGp, bv } = salesByPmShareAmounts(
        lookupSalesByPmBvShare(bvShares, p.id, p.pm_id),
        moneyBasis,
      );

      const excludeMiniPP = countsExcludeMiniPP({
        source: p.source,
        project_size: p.project_size,
        estimated_income: p.est_income,
        n_source_id: p.n_source_id,
      });
      const projName = p.project_name || p.project_code || "(未命名)";
      const sub = [p.project_code, p.status].filter(Boolean).join(" · ") || undefined;
      const href = projectHref(p.id, p.source);

      // Counts (計隻數)
      if (rule.countNumber) {
        row.count_all++;
        row.proj_count_all.push({ name: projName, sub, href });
        if (excludeMiniPP) {
          row.count_no_mini++;
          row.proj_count_no_mini.push({ name: projName, sub, href });
        }
      }

      // Money (計錢) — revenue, cost and gross profit
      if (rule.countMoney) {
        row.total_revenue_all += revenue;
        row.proj_revenue_all.push({ name: projName, value: revenue, sub, href });
        if (excludeMiniPP) {
          row.total_revenue_no_mini += revenue;
          row.proj_revenue_no_mini.push({ name: projName, value: revenue, sub, href });
        }
        row.total_cost += cost;
        row.proj_cost.push({ name: projName, value: cost, sub, href });
        row.gross_profit += revenue - cost;
        row.proj_gp.push({ name: projName, value: revenue - cost, sub, href });
        row.shared_gp += sharedGp;
        row.proj_shared_gp.push({ name: projName, value: sharedGp, sub, href });
        row.bv += bv;
        row.proj_bv.push({ name: projName, value: bv, sub, href });
      }
    }

    // Compute margin per PM after all projects aggregated
    for (const row of groups.values()) {
      row.margin = row.total_revenue_all > 0
        ? (row.gross_profit / row.total_revenue_all) * 100
        : 0;
    }

    return Array.from(groups.values());
  }, [filteredProjects, moneyBasis, projectFilter.status, bvShares]);

  // ─── SORT ──────────────────────────────────────────────────
  // (search + dimension filters applied upstream via the project filter bar)
  const visibleRows = useMemo(() => {
    const result = pmRows;
    return [...result].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av as number;
      const bn = bv as number;
      return sortDir === "asc" ? an - bn : bn - an;
    });
  }, [pmRows, sortField, sortDir]);

  // ─── TOTALS ROW ───────────────────────────────────────────
  const totals = useMemo(() => {
    const t = {
      count_no_mini: 0,
      count_all: 0,
      total_revenue_no_mini: 0,
      total_revenue_all: 0,
      total_cost: 0,
      gross_profit: 0,
      shared_gp: 0,
      bv: 0,
    };
    for (const r of visibleRows) {
      t.count_no_mini        += r.count_no_mini;
      t.count_all            += r.count_all;
      t.total_revenue_no_mini += r.total_revenue_no_mini;
      t.total_revenue_all    += r.total_revenue_all;
      t.total_cost           += r.total_cost;
      t.gross_profit         += r.gross_profit;
      t.shared_gp            += r.shared_gp;
      t.bv                   += r.bv;
    }
    return t;
  }, [visibleRows]);

  const totalsMargin = totals.total_revenue_all > 0
    ? (totals.gross_profit / totals.total_revenue_all) * 100
    : 0;

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1 text-bw-blue inline" />
      : <ChevronDown className="w-3 h-3 ml-1 text-bw-blue inline" />;
  }

  function Th({ field, children, right }: { field: SortField; children: React.ReactNode; right?: boolean }) {
    return (
      <TableHead
        className={`text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap ${right ? "text-right" : ""}`}
        onClick={() => handleSort(field)}
      >
        <span className={`flex items-center gap-0.5 ${right ? "justify-end" : ""}`}>
          {children}<SortIcon field={field} />
        </span>
      </TableHead>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          按項目經理分類銷售 Sales by Project Manager
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">{dateRangeLabel}</p>
      </div>

      <ReportFilterStack
        showL2L3
        moneyBasis={moneyBasis}
        onMoneyBasisChange={setMoneyBasis}
        projectRows={enrichedProjects}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        staffLocks={staffLocks}
        isSuperAdmin={isSuperAdmin}
        onStaffDirectoryLoaded={setStaffDirectory}
      />

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
                  <Th field="pm_name">Project Manager</Th>
                  {showPPColumns && (
                    <Th field="count_no_mini" right>
                      Number of Total<br />
                      <span className="font-normal text-gray-400">Projects ({EXCLUDE_PP_LABEL})</span>
                    </Th>
                  )}
                  <Th field="count_all" right>
                    Number of<br />
                    <span className="font-normal text-gray-400">All Projects</span>
                  </Th>
                  {showPPColumns && (
                    <Th field="total_revenue_no_mini" right>
                      Total Revenue<br />
                      <span className="font-normal text-gray-400">({EXCLUDE_PP_LABEL})</span>
                    </Th>
                  )}
                  <Th field="total_revenue_all" right>
                    All Project<br />
                    <span className="font-normal text-gray-400">Revenue</span>
                  </Th>
                  <Th field="total_cost" right>Total Cost</Th>
                  <Th field="gross_profit" right>Gross Profit</Th>
                  <Th field="shared_gp" right>Shared GP</Th>
                  <Th field="bv" right>BV</Th>
                  <Th field="margin" right>Margin</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showPPColumns ? 10 : 8} className="text-center py-16 text-gray-400">
                      沒有找到符合條件的資料
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.pm_id}
                      className="hover:bg-gray-50/80 border-b border-gray-100"
                    >
                      <TableCell className="text-sm font-medium text-bw-blue whitespace-nowrap">
                        {row.pm_name}
                      </TableCell>
                      {showPPColumns && (
                        <TableCell className="text-sm text-right text-gray-700">
                          <MetricHoverCard
                            title={`${row.pm_name} · 項目數 (${EXCLUDE_PP_LABEL})`}
                            formula="來源非 BWA-PP 的項目"
                            items={row.proj_count_no_mini}
                            isCount
                          >
                            {row.count_no_mini}
                          </MetricHoverCard>
                        </TableCell>
                      )}
                      <TableCell className="text-sm text-right text-gray-700">
                        <MetricHoverCard
                          title={`${row.pm_name} · 全部項目數`}
                          formula="計算狀態為「計隻數」的所有項目"
                          items={row.proj_count_all}
                          isCount
                        >
                          {row.count_all}
                        </MetricHoverCard>
                      </TableCell>
                      {showPPColumns && (
                        <TableCell className="text-sm text-right font-mono text-gray-800 whitespace-nowrap">
                          <MetricHoverCard
                            title={`${row.pm_name} · 收入 (${EXCLUDE_PP_LABEL})`}
                            formula={`${moneyBasis === "l2" ? "L2 已簽" : "L3 實際"} 收入加總（來源非 BWA-PP）`}
                            source={moneyBasis}
                            items={row.proj_revenue_no_mini}
                            formatValue={(v) => formatMoney2(v, moneyOpts)}
                            total={row.total_revenue_no_mini}
                          >
                            {formatMoney2(row.total_revenue_no_mini, moneyOpts)}
                          </MetricHoverCard>
                        </TableCell>
                      )}
                      <TableCell className="text-sm text-right font-mono text-gray-800 whitespace-nowrap">
                        <MetricHoverCard
                          title={`${row.pm_name} · 全部項目收入`}
                          formula={`${moneyBasis === "l2" ? "L2 已簽" : "L3 實際"} 收入加總（全部項目）`}
                          source={moneyBasis}
                          items={row.proj_revenue_all}
                          formatValue={(v) => formatMoney2(v, moneyOpts)}
                          total={row.total_revenue_all}
                        >
                          {formatMoney2(row.total_revenue_all, moneyOpts)}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className={`text-sm text-right font-mono whitespace-nowrap ${row.total_cost ? "text-red-600" : "text-gray-300"}`}>
                        <MetricHoverCard
                          title={`${row.pm_name} · 總成本`}
                          formula={`${moneyBasis === "l2" ? "L2 已簽" : "L3 實際"} 支出加總`}
                          source={moneyBasis}
                          items={row.proj_cost}
                          formatValue={(v) => formatMoney2(v, moneyOpts)}
                          total={row.total_cost}
                        >
                          {formatMoney2(row.total_cost, moneyOpts)}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className={`text-sm text-right font-mono font-semibold whitespace-nowrap ${row.gross_profit > 0 ? "text-blue-600" : row.gross_profit < 0 ? "text-red-600" : "text-gray-300"}`}>
                        <MetricHoverCard
                          title={`${row.pm_name} · 毛利`}
                          formula="每個項目 = 收入 − 成本"
                          source={moneyBasis}
                          items={row.proj_gp}
                          formatValue={(v) => formatMoney2(v, moneyOpts)}
                          total={row.gross_profit}
                        >
                          {formatMoney2(row.gross_profit, moneyOpts)}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className={`text-sm text-right font-mono whitespace-nowrap ${row.shared_gp > 0 ? "text-amber-700" : row.shared_gp < 0 ? "text-red-600" : "text-gray-300"}`}>
                        <MetricHoverCard
                          title={`${row.pm_name} · Shared GP`}
                          formula={`主PM 的 project_bv.${moneyBasis === "l2" ? "shared_estimated_gp" : "shared_actual_gp"} 加總`}
                          source={moneyBasis === "l2" ? "shared_l2" : "shared_l3"}
                          items={row.proj_shared_gp}
                          formatValue={(v) => formatMoney2(v, moneyOpts)}
                          total={row.shared_gp}
                        >
                          {formatMoney2(row.shared_gp, moneyOpts)}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className={`text-sm text-right font-mono whitespace-nowrap ${row.bv ? "text-sky-700" : "text-gray-300"}`}>
                        <MetricHoverCard
                          title={`${row.pm_name} · BV`}
                          formula={`主PM 的 project_bv.${moneyBasis === "l2" ? "estimated_bv" : "actual_bv"} 加總`}
                          source={moneyBasis === "l2" ? "bv_l2" : "bv_l3"}
                          items={row.proj_bv}
                          formatValue={(v) => formatBV(v, bvOpts)}
                          total={row.bv}
                        >
                          {formatBV(row.bv, bvOpts)}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono text-gray-500 whitespace-nowrap">
                        <MetricHoverCard
                          title={`${row.pm_name} · 毛利率`}
                          formula={`毛利 ${formatMoney2(row.gross_profit, moneyOpts)} ÷ 全部收入 ${formatMoney2(row.total_revenue_all, moneyOpts)}`}
                          source={moneyBasis}
                          items={row.proj_gp}
                          formatValue={(v) => formatMoney2(v, moneyOpts)}
                          total={row.gross_profit}
                        >
                          {fmtPct(row.margin)}
                        </MetricHoverCard>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {visibleRows.length > 0 && (
                <tfoot>
                  <TableRow className="bg-gray-100/70 border-t-2 border-gray-200 font-semibold">
                    <TableCell className="text-sm text-gray-800">
                      總計 Total ({visibleRows.length} PMs)
                    </TableCell>
                    {showPPColumns && (
                      <TableCell className="text-sm text-right text-gray-800">
                        {totals.count_no_mini}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-right text-gray-800">
                      {totals.count_all}
                    </TableCell>
                    {showPPColumns && (
                      <TableCell className="text-sm text-right font-mono text-gray-900 whitespace-nowrap">
                        {formatMoney2(totals.total_revenue_no_mini, moneyOpts)}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-right font-mono text-gray-900 whitespace-nowrap">
                      {formatMoney2(totals.total_revenue_all, moneyOpts)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-red-600 whitespace-nowrap">
                      {formatMoney2(totals.total_cost, moneyOpts)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                      {formatMoney2(totals.gross_profit, moneyOpts)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono font-semibold text-amber-800 whitespace-nowrap">
                      {formatMoney2(totals.shared_gp, moneyOpts)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono font-semibold text-sky-800 whitespace-nowrap">
                      {formatBV(totals.bv, bvOpts)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-600 whitespace-nowrap">
                      {fmtPct(totalsMargin)}
                    </TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </div>
      )}

      <ReportDateRangeNote>
        Note: This summary is based on orders with a project signed date in
        the selected period.
      </ReportDateRangeNote>
    </div>
  );
}
