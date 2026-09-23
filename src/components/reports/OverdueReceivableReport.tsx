"use client";

// ═══════════════════════════════════════════════════════════════════════════
// AI WARNING — SHARED OVERDUE RECEIVABLE REPORT (DO NOT DUPLICATE)
//   • /business-reports/overdue-receivable → <OverdueReceivableReport />
//   • /team-reports/overdue-receivable     → reportScope="team"
// Edits apply to BOTH pages. reportScope="team" locks Team in StaffFilterBar
// (unless Super Admin); staff rows filtered via staffIdMatchesFilter.
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
  fetchOverdueReceivablePitches,
  type OverdueReceivablePitch,
  type StaffDirectoryRow,
} from "@/lib/data-service";
import { getEffectiveStatusRule } from "@/lib/project-status-rules";
import MetricHoverCard, { type BreakdownItem, projectHref } from "@/components/reports/MetricHoverCard";

// ─── DATE-RANGE PRESETS — shared across all /business-reports ──
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
import { useFinancialFormat } from "@/hooks/use-financial-format";

export interface OverdueReceivableReportProps {
  reportScope?: ReportStaffScope;
}

function fmtPct(val: number): string {
  if (!val || isNaN(val)) return "0.00%";
  return `${val.toFixed(2)}%`;
}

// ─── AGGREGATED ROW (one per PM) ──────────────────────────────
interface PMRow {
  key: string;
  pm_name: string;
  total_pitches: number;        // all pitches in window
  converted: number;            // converted projects (status counts for 計隻數)
  overdue_projects: number;     // converted projects carrying overdue invoices
  total_overdue: number;        // sum of overdue outstanding across those projects
  // Per-project overdue% (overdue / estimated income); averaged for display.
  overdue_pcts: number[];
  // Contributing records per metric, for hover breakdowns.
  items_pitches: BreakdownItem[];
  items_converted: BreakdownItem[];
  items_overdue: BreakdownItem[];
}

type SortCol =
  | "pm_name"
  | "total_pitches"
  | "converted"
  | "overdue_projects"
  | "total_overdue"
  | "avg_overdue_pct";

export default function OverdueReceivableReport({
  reportScope = "business",
}: OverdueReceivableReportProps) {
  const { formatMoney2 } = useFinancialFormat();
  const [pitches, setPitches] = useState<OverdueReceivablePitch[]>([]);
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
  const [sortCol, setSortCol] = useState<SortCol>("total_overdue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const rows = await fetchOverdueReceivablePitches();
      setPitches(rows);
      setLoading(false);
    }
    load();
  }, []);

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

  // ─── AGGREGATE INTO PM ROWS ───────────────────────────────
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
          converted: 0,
          overdue_projects: 0,
          total_overdue: 0,
          overdue_pcts: [],
          items_pitches: [],
          items_converted: [],
          items_overdue: [],
        };
        groups.set(key, g);
      }

      g.total_pitches += 1;
      g.items_pitches.push({ name: p.pitch_label || "(未命名報價)" });

      // Converted count → 計隻數; overdue $ / overdue project count → 計錢.
      // Matrix applies only when status filter is "all".
      if (!p.converted) continue;
      const rule = getEffectiveStatusRule(p.converted_status, projectFilter.status);
      if (rule.countNumber) {
        g.converted += 1;
        g.items_converted.push({
          name: p.project_label || p.pitch_label || "(未命名項目)",
          sub: p.converted_status || undefined,
          href: projectHref(p.project_id, p.source),
        });
      }
      if (rule.countMoney && p.overdue_amount > 0) {
        g.overdue_projects += 1;
        g.total_overdue += p.overdue_amount;
        g.items_overdue.push({
          name: p.project_label || p.pitch_label || "(未命名項目)",
          value: p.overdue_amount,
          sub: p.estimated_income
            ? `估算 ${formatMoney2(p.estimated_income)}`
            : undefined,
          href: projectHref(p.project_id, p.source),
        });
        if (p.estimated_income && p.estimated_income > 0) {
          g.overdue_pcts.push((p.overdue_amount / p.estimated_income) * 100);
        }
      }
    }

    return Array.from(groups.values());
  }, [filteredPitches, window, formatMoney2, staffFilter, staffDirectory, projectFilter.status]);

  // Average overdue% per PM (mean across that PM's overdue projects).
  function avgOverduePct(r: PMRow): number {
    if (!r.overdue_pcts.length) return 0;
    return r.overdue_pcts.reduce((a, b) => a + b, 0) / r.overdue_pcts.length;
  }

  // ─── SORT ──────────────────────────────────────────────────
  const visibleRows = useMemo(() => {
    const valueFor = (r: PMRow): number | string => {
      switch (sortCol) {
        case "pm_name":
          return r.pm_name.toLowerCase();
        case "total_pitches":
          return r.total_pitches;
        case "converted":
          return r.converted;
        case "overdue_projects":
          return r.overdue_projects;
        case "total_overdue":
          return r.total_overdue;
        case "avg_overdue_pct":
          return avgOverduePct(r);
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
        acc.converted += r.converted;
        acc.overdue_projects += r.overdue_projects;
        acc.total_overdue += r.total_overdue;
        acc.pcts.push(...r.overdue_pcts);
        return acc;
      },
      { total_pitches: 0, converted: 0, overdue_projects: 0, total_overdue: 0, pcts: [] as number[] }
    );
  }, [visibleRows]);

  const totalsAvgPct =
    totals.pcts.length > 0
      ? totals.pcts.reduce((a, b) => a + b, 0) / totals.pcts.length
      : 0;

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

  function Th({ col, children, right }: { col: SortCol; children: React.ReactNode; right?: boolean }) {
    return (
      <TableHead
        className={`text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap ${right ? "text-right" : ""}`}
        onClick={() => handleSort(col)}
      >
        <span className={`flex items-center gap-0.5 ${right ? "justify-end" : ""}`}>
          {children}
          <SortIcon col={col} />
        </span>
      </TableHead>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          逾期應收 Overdue Receivable
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          From {fmtDate(window.from)} to {fmtDate(window.to)}
        </p>
      </div>

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
                  <Th col="pm_name">Project Manager</Th>
                  <Th col="total_pitches" right>Total Pitches</Th>
                  <Th col="converted" right>Converted Projects</Th>
                  <Th col="overdue_projects" right>Overdue Projects</Th>
                  <Th col="total_overdue" right>Total Overdue Amount</Th>
                  <Th col="avg_overdue_pct" right>
                    Avg. Overdue%<br />
                    <span className="font-normal text-gray-400">(each project)</span>
                  </Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16 text-gray-400">
                      此期間沒有報價記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => {
                    const pct = avgOverduePct(row);
                    return (
                      <TableRow
                        key={row.key}
                        className="hover:bg-gray-50/80 border-b border-gray-100"
                      >
                        <TableCell className="text-sm font-medium text-gray-900 whitespace-nowrap">
                          {row.pm_name}
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono text-gray-700">
                          <MetricHoverCard
                            title={`${row.pm_name} · 報價 Pitches`}
                            formula="此期間（按報價查詢日期）的所有報價"
                            items={row.items_pitches}
                            isCount
                          >
                            {row.total_pitches}
                          </MetricHoverCard>
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono font-semibold text-gray-800">
                          <MetricHoverCard
                            title={`${row.pm_name} · 已轉化項目`}
                            formula="報價已轉為計隻數的 BWA 項目"
                            items={row.items_converted}
                            isCount
                          >
                            {row.converted}
                          </MetricHoverCard>
                        </TableCell>
                        <TableCell className={`text-sm text-right font-mono ${row.overdue_projects ? "text-bw-blue font-semibold" : "text-gray-400"}`}>
                          <MetricHoverCard
                            title={`${row.pm_name} · 逾期項目`}
                            formula="有逾期未收發票（到期日已過且 outstanding − bad_debts > 0）的項目"
                            items={row.items_overdue}
                            formatValue={formatMoney2}
                            total={row.total_overdue}
                          >
                            {row.overdue_projects}
                          </MetricHoverCard>
                        </TableCell>
                        <TableCell className={`text-sm text-right font-mono whitespace-nowrap ${row.total_overdue ? "text-red-600 font-semibold" : "text-gray-300"}`}>
                          <MetricHoverCard
                            title={`${row.pm_name} · 逾期總額`}
                            formula="逾期發票淨結欠加總（outstanding − bad_debts）"
                            items={row.items_overdue}
                            formatValue={formatMoney2}
                            total={row.total_overdue}
                          >
                            {formatMoney2(row.total_overdue)}
                          </MetricHoverCard>
                        </TableCell>
                        <TableCell className={`text-sm text-right font-mono ${pct ? "text-gray-700" : "text-gray-300"}`}>
                          <MetricHoverCard
                            title={`${row.pm_name} · 逾期比率`}
                            formula="逾期總額 ÷ 已轉化項目應收（各逾期項目）"
                            items={row.items_overdue}
                            formatValue={formatMoney2}
                            total={row.total_overdue}
                          >
                            {fmtPct(pct)}
                          </MetricHoverCard>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {visibleRows.length > 0 && (
                <tfoot>
                  <TableRow className="bg-gray-100/70 border-t-2 border-gray-200 font-semibold">
                    <TableCell className="text-sm text-gray-800 whitespace-nowrap">
                      總計 Total ({visibleRows.length} PMs)
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-800">
                      {totals.total_pitches}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-800">
                      {totals.converted}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-800">
                      {totals.overdue_projects}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-red-600 whitespace-nowrap">
                      {formatMoney2(totals.total_overdue)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-600">
                      {fmtPct(totalsAvgPct)}
                    </TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </div>
      )}

      {/* ─── NOTE ───────────────────────────────────── */}
      <p className="text-sm text-gray-400 text-center">
        Note: This summary is based on orders with a project enquiry date in the
        selected period. An invoice is overdue when its due date has passed and a
        balance remains outstanding.
      </p>
    </div>
  );
}
