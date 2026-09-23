"use client";

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
import { getEffectiveStatusRule } from "@/lib/project-status-rules";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
import MetricHoverCard, { type BreakdownItem, projectHref } from "@/components/reports/MetricHoverCard";
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
import type { StaffDirectoryRow } from "@/lib/data-service";
import { useFinancialFormat } from "@/hooks/use-financial-format";

// ─── HELPERS ──────────────────────────────────────────────────
function fmtPct(num: number, denom: number): string {
  if (!denom) return "0.00%";
  return `${((num / denom) * 100).toFixed(2)}%`;
}

// Project size is stored as free text; show the numeric part with a "ft"
// suffix when it parses, otherwise echo the raw value.
function fmtSize(size: string | null): string {
  if (!size) return "ft";
  const n = Number(size.replace(/[^0-9.]/g, ""));
  if (!isNaN(n) && n > 0) {
    return `${n.toLocaleString("en-HK")} ft`;
  }
  return `${size} ft`;
}


// ─── ROW MODEL ────────────────────────────────────────────────
interface ProjectRow {
  id: string;
  source: "BWA" | "BWF";
  project_code: string | null;
  project_name: string | null;
  size: string | null;
  pm_name: string | null;
  status: string | null;
  revenue: number;
  cost: number;
  gross_profit: number;
  margin: number;
}

type SortField =
  | "project_code"
  | "project_name"
  | "size"
  | "pm_name"
  | "revenue"
  | "cost"
  | "gross_profit"
  | "margin";

export default function ProfitabilityByProjectReport() {
  const { formatMoney2 } = useFinancialFormat();
  const moneyOpts = { fallback: "N/A" } as const;
  const [projects, setProjects] = useState<SalesByPMProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { range, custom, sources } = useReportRange();
  const {
    projectFilter,
    setProjectFilter,
    staffFilter,
    setStaffFilter,
    moneyBasis,
    setMoneyBasis,
    staffLocks,
    isSuperAdmin,
    defaultStaffFilter,
  } = useAlignedReportFilters("business");

  useEffect(() => {
    fetchSalesByPMProjects().then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, []);

  // Active date window (signed_date), shared across all reports.
  const window = useMemo(() => resolveRange(range, new Date(), custom), [range, custom]);

  // BWA / BWF toggle applied first.
  const sourceProjects = useMemo(() => filterBySources(projects, sources), [projects, sources]);
  const enrichedProjects = useEnrichedProjectFilterRows(
    sourceProjects,
    projectFilterNeedsExtras(projectFilter),
  );

  // ─── BUILD ONE ROW PER PROJECT ─────────────────────────────
  const projectRows = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    // Apply the ultimate project filter set first.
    const filtered = applyProjectFilters(enrichedProjects, projectFilter).filter((p) =>
      staffIdMatchesFilter(p.pm_id, staffFilter, staffDirectory),
    );
    const rows: ProjectRow[] = [];
    for (const p of filtered) {
      // Money figures respect 計錢 when status filter is "all"; when a
      // specific status is selected the matrix is bypassed for inspection.
      if (!getEffectiveStatusRule(p.status, projectFilter.status).countMoney) continue;

      // Date range on signed_date (unbounded "All Time" passes everything).
      if (window.from || window.to) {
        if (!p.signed_date) continue;
        const t = new Date(p.signed_date).getTime();
        if (isNaN(t) || t < fromMs || t > toMs) continue;
      }

      const revenue = moneyBasis === "l2" ? (p.est_income || 0) : p.actual_income;
      const cost = moneyBasis === "l2" ? (p.est_expense || 0) : p.actual_expense;
      const gross_profit = revenue - cost;
      const margin = revenue ? (gross_profit / revenue) * 100 : 0;

      rows.push({
        id: p.id,
        source: p.source,
        project_code: p.project_code,
        project_name: p.project_name,
        size: p.size,
        pm_name: p.pm_name,
        status: p.status,
        revenue,
        cost,
        gross_profit,
        margin,
      });
    }
    return rows;
  }, [enrichedProjects, moneyBasis, window, projectFilter, staffFilter, staffDirectory]);

  // ─── SORT ──────────────────────────────────────────────────
  // (search + all dimension filters are applied upstream via the filter bar)
  const visibleRows = useMemo(() => {
    const result = projectRows;
    const valueFor = (r: ProjectRow): number | string => {
      switch (sortField) {
        case "project_code":
          return (r.project_code || "").toLowerCase();
        case "project_name":
          return (r.project_name || "").toLowerCase();
        case "size":
          return Number((r.size || "").replace(/[^0-9.]/g, "")) || 0;
        case "pm_name":
          return (r.pm_name || "").toLowerCase();
        case "revenue":
          return r.revenue;
        case "cost":
          return r.cost;
        case "gross_profit":
          return r.gross_profit;
        case "margin":
          return r.margin;
      }
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
  }, [projectRows, sortField, sortDir]);

  // ─── TOTALS ────────────────────────────────────────────────
  const totals = useMemo(() => {
    const t = { revenue: 0, cost: 0, gross_profit: 0 };
    for (const r of visibleRows) {
      t.revenue += r.revenue;
      t.cost += r.cost;
      t.gross_profit += r.gross_profit;
    }
    return t;
  }, [visibleRows]);

  // Footer breakdown items — one entry per visible project, keyed by metric.
  const footerItems = useMemo(() => {
    const label = (r: ProjectRow) => r.project_name || r.project_code || "(未命名)";
    const sub = (r: ProjectRow) => r.project_code || undefined;
    return {
      revenue: visibleRows.map((r) => ({ name: label(r), sub: sub(r), value: r.revenue, href: projectHref(r.id, r.source) })),
      cost: visibleRows.map((r) => ({ name: label(r), sub: sub(r), value: r.cost, href: projectHref(r.id, r.source) })),
      gp: visibleRows.map((r) => ({ name: label(r), sub: sub(r), value: r.gross_profit, href: projectHref(r.id, r.source) })),
    };
  }, [visibleRows]);

  // Per-project GP component breakdown (Revenue − Cost).
  function gpComponents(r: ProjectRow): BreakdownItem[] {
    return [
      { name: "收入 Revenue", value: r.revenue },
      { name: "成本 Cost", value: -r.cost },
    ];
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "project_code" || field === "project_name" || field === "pm_name" ? "asc" : "desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1 text-bw-blue inline" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 text-bw-blue inline" />
    );
  }

  function Th({
    field,
    children,
    right,
  }: {
    field: SortField;
    children: React.ReactNode;
    right?: boolean;
  }) {
    return (
      <TableHead
        className={`text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap ${right ? "text-right" : ""}`}
        onClick={() => handleSort(field)}
      >
        <span className={`flex items-center gap-0.5 ${right ? "justify-end" : ""}`}>
          {children}
          <SortIcon field={field} />
        </span>
      </TableHead>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          項目毛利分析 Profitability by Project
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          每張訂單的成本及毛利明細 Detailed cost and profit breakdown for every order.
          <span className="block text-xs text-gray-400 mt-0.5">
            按簽約日期篩選 From {fmtRangeDate(window.from)} to {fmtRangeDate(window.to)}
          </span>
        </p>
      </div>

      <ReportFilterStack
        showDate
        sourceMode="single"
        showL2L3
        moneyBasis={moneyBasis}
        onMoneyBasisChange={setMoneyBasis}
        projectRows={enrichedProjects}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        staffLocks={staffLocks}
        staffClearTo={defaultStaffFilter}
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
                  <Th field="project_code">Project Code</Th>
                  <Th field="project_name">Project Name</Th>
                  <Th field="size" right>實用面積 SA</Th>
                  <Th field="pm_name">Main PM</Th>
                  <Th field="revenue" right>Revenue</Th>
                  <Th field="cost" right>Total Cost</Th>
                  <Th field="gross_profit" right>Gross Profit</Th>
                  <Th field="margin" right>Margin</Th>
                  <TableHead className="text-xs font-semibold text-gray-600 text-right whitespace-nowrap">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-16 text-gray-400">
                      沒有找到符合條件的資料
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-gray-50/80 border-b border-gray-100"
                    >
                      <TableCell className="text-sm font-medium text-gray-900 whitespace-nowrap">
                        {row.project_code || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 max-w-[280px]">
                        {row.project_name || "(未命名)"}
                      </TableCell>
                      <TableCell className="text-sm text-right text-gray-500 whitespace-nowrap">
                        {fmtSize(row.size)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 whitespace-nowrap">
                        {row.pm_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono text-green-600 whitespace-nowrap">
                        {formatMoney2(row.revenue, moneyOpts)}
                      </TableCell>
                      <TableCell
                        className={`text-sm text-right font-mono whitespace-nowrap ${
                          row.cost ? "text-red-600" : "text-gray-300"
                        }`}
                      >
                        {formatMoney2(row.cost, moneyOpts)}
                      </TableCell>
                      <TableCell
                        className={`text-sm text-right font-mono font-semibold whitespace-nowrap ${
                          row.gross_profit > 0
                            ? "text-blue-600"
                            : row.gross_profit < 0
                              ? "text-red-600"
                              : "text-gray-300"
                        }`}
                      >
                        <MetricHoverCard
                          title={`${row.project_name || row.project_code || "項目"} · 毛利 Gross Profit`}
                          formula="收入 Revenue − 成本 Cost"
                          source={moneyBasis}
                          items={gpComponents(row)}
                          formatValue={(v) => formatMoney2(v, moneyOpts)}
                          total={row.gross_profit}
                        >
                          {formatMoney2(row.gross_profit, moneyOpts)}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono text-gray-700 whitespace-nowrap">
                        <MetricHoverCard
                          title={`${row.project_name || row.project_code || "項目"} · 毛利率 Margin`}
                          formula={`毛利 ${formatMoney2(row.gross_profit, moneyOpts)} ÷ 收入 ${formatMoney2(row.revenue, moneyOpts)}`}
                          source={moneyBasis}
                          items={gpComponents(row)}
                          formatValue={(v) => formatMoney2(v, moneyOpts)}
                          total={row.gross_profit}
                        >
                          {fmtPct(row.gross_profit, row.revenue)}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <ProjectStatusBadge status={row.status} className="text-[11px]" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {visibleRows.length > 0 && (
                <tfoot>
                  <TableRow className="bg-gray-100/70 border-t-2 border-gray-200 font-semibold">
                    <TableCell className="text-sm text-gray-800 whitespace-nowrap" colSpan={4}>
                      總計 Total ({visibleRows.length})
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-green-700 whitespace-nowrap">
                      <MetricHoverCard
                        title={`總收入 Total Revenue (${visibleRows.length})`}
                        formula="所有項目收入加總"
                        source={moneyBasis}
                        items={footerItems.revenue}
                        formatValue={(v) => formatMoney2(v, moneyOpts)}
                        total={totals.revenue}
                      >
                        {formatMoney2(totals.revenue, moneyOpts)}
                      </MetricHoverCard>
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-red-600 whitespace-nowrap">
                      <MetricHoverCard
                        title={`總成本 Total Cost (${visibleRows.length})`}
                        formula="所有項目成本加總"
                        source={moneyBasis}
                        items={footerItems.cost}
                        formatValue={(v) => formatMoney2(v, moneyOpts)}
                        total={totals.cost}
                      >
                        {formatMoney2(totals.cost, moneyOpts)}
                      </MetricHoverCard>
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                      <MetricHoverCard
                        title={`總毛利 Total Gross Profit (${visibleRows.length})`}
                        formula="所有項目毛利加總"
                        source={moneyBasis}
                        items={footerItems.gp}
                        formatValue={(v) => formatMoney2(v, moneyOpts)}
                        total={totals.gross_profit}
                      >
                        {formatMoney2(totals.gross_profit, moneyOpts)}
                      </MetricHoverCard>
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-700 whitespace-nowrap">
                      <MetricHoverCard
                        title={`整體毛利率 Overall Margin`}
                        formula={`總毛利 ${formatMoney2(totals.gross_profit, moneyOpts)} ÷ 總收入 ${formatMoney2(totals.revenue, moneyOpts)}`}
                        source={moneyBasis}
                        items={footerItems.gp}
                        formatValue={(v) => formatMoney2(v, moneyOpts)}
                        total={totals.gross_profit}
                      >
                        {fmtPct(totals.gross_profit, totals.revenue)}
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

      <ReportDateRangeNote>
        Note: This summary is based on orders with a project signed date in
        the selected period.
      </ReportDateRangeNote>
    </div>
  );
}
