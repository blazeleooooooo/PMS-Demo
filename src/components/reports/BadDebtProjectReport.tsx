"use client";

// ═══════════════════════════════════════════════════════════════════════════
// AI WARNING — SHARED BAD DEBT PROJECT REPORT (DO NOT DUPLICATE)
//   • /business-reports/bad-debt-project → <BadDebtProjectReport />
//   • /team-reports/bad-debt-project     → reportScope="team"
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
  fetchBadDebtProjectPitches,
  type BadDebtProjectPitch,
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

export interface BadDebtProjectReportProps {
  reportScope?: ReportStaffScope;
}

function fmtPct(val: number): string {
  if (!isFinite(val) || isNaN(val)) return "0.00%";
  return `${val.toFixed(2)}%`;
}

// ─── AGGREGATED ROW (one per PM) ──────────────────────────────
interface PMRow {
  key: string;
  pm_name: string;
  total_pitches: number;       // pitches in window
  converted: number;           // converted pitches whose project counts (計隻數)
  bad_debt_projects: number;   // converted projects carrying a bad-debt write-off
  total_bad_debt: number;      // Σ bad_debts across those projects
  avg_bad_debt_pct: number;    // mean per-project (bad_debt ÷ Main) over them
  // Contributing records per metric, for hover breakdowns.
  items_pitches: BreakdownItem[];
  items_converted: BreakdownItem[];
  items_bad_debt: BreakdownItem[];
}

type SortCol =
  | "pm_name"
  | "total_pitches"
  | "converted"
  | "bad_debt_projects"
  | "total_bad_debt"
  | "avg_bad_debt_pct";

export default function BadDebtProjectReport({
  reportScope = "business",
}: BadDebtProjectReportProps) {
  const { formatMoney2 } = useFinancialFormat();
  const [pitches, setPitches] = useState<BadDebtProjectPitch[]>([]);
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
  const [sortCol, setSortCol] = useState<SortCol>("total_bad_debt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const rows = await fetchBadDebtProjectPitches();
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

  // ─── AGGREGATE INTO PM ROWS ────────────────────────────────
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
          bad_debt_projects: 0,
          total_bad_debt: 0,
          avg_bad_debt_pct: 0,
          items_pitches: [],
          items_converted: [],
          items_bad_debt: [],
        };
        groups.set(key, g);
      }

      const label = p.pitch_label || "(未命名)";
      g.total_pitches += 1;
      g.items_pitches.push({ name: label });

      // Converted count → 計隻數; bad-debt $ / project count → 計錢.
      if (!p.converted) continue;
      const rule = getEffectiveStatusRule(p.converted_status, projectFilter.status);
      if (rule.countNumber) {
        g.converted += 1;
        g.items_converted.push({ name: p.project_label || label, sub: p.converted_status || undefined, href: projectHref(p.project_id, p.source) });
      }
      if (rule.countMoney && p.bad_debt_amount > 0) {
        g.bad_debt_projects += 1;
        g.total_bad_debt += p.bad_debt_amount;
        const pct = p.main_amount > 0 ? (p.bad_debt_amount / p.main_amount) * 100 : 0;
        g.avg_bad_debt_pct += pct;
        g.items_bad_debt.push({
          name: p.project_label || label,
          value: p.bad_debt_amount,
          sub: `壞帳 ${formatMoney2(p.bad_debt_amount)} ÷ Main ${formatMoney2(p.main_amount)} = ${fmtPct(pct)}`,
          href: projectHref(p.project_id, p.source),
        });
      }
    }

    // Convert the accumulated pct sum into a mean per bad-debt project.
    for (const g of groups.values()) {
      g.avg_bad_debt_pct = g.bad_debt_projects > 0 ? g.avg_bad_debt_pct / g.bad_debt_projects : 0;
    }

    return Array.from(groups.values());
  }, [filteredPitches, window, formatMoney2, staffFilter, staffDirectory, projectFilter.status]);

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
        case "bad_debt_projects":
          return r.bad_debt_projects;
        case "total_bad_debt":
          return r.total_bad_debt;
        case "avg_bad_debt_pct":
          return r.avg_bad_debt_pct;
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
        acc.bad_debt_projects += r.bad_debt_projects;
        acc.total_bad_debt += r.total_bad_debt;
        acc.pct_sum += r.avg_bad_debt_pct * r.bad_debt_projects;
        return acc;
      },
      { total_pitches: 0, converted: 0, bad_debt_projects: 0, total_bad_debt: 0, pct_sum: 0 }
    );
  }, [visibleRows]);

  // Company-wide Avg Bad Debt% = mean across every bad-debt project.
  const totalsAvgPct =
    totals.bad_debt_projects > 0 ? totals.pct_sum / totals.bad_debt_projects : 0;

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

  function Th({
    col,
    children,
    right,
  }: {
    col: SortCol;
    children: React.ReactNode;
    right?: boolean;
  }) {
    return (
      <TableHead
        className={`text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap ${right ? "text-right" : ""}`}
        onClick={() => handleSort(col)}
      >
        <span className={`flex items-center ${right ? "justify-end" : ""}`}>
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
          Bad Debt Project 已記錄為壞帳的項目
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          From {fmtDate(window.from)} to {fmtDate(window.to)}
        </p>
      </div>

      {/* ─── RANGE PILLS ────────────────────────────── */}
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
                  <Th col="bad_debt_projects" right>Bad Debt Projects</Th>
                  <Th col="total_bad_debt" right>Total Bad Debt Amount</Th>
                  <Th col="avg_bad_debt_pct" right>Avg. Bad Debt% (each project)</Th>
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
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.key}
                      className="hover:bg-gray-50/80 border-b border-gray-100"
                    >
                      <TableCell className="text-sm font-medium text-gray-900 whitespace-nowrap">
                        {row.pm_name}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono text-gray-700 whitespace-nowrap">
                        <MetricHoverCard
                          title={`${row.pm_name} · Total Pitches`}
                          formula="此期間 enquiry date 的報價數"
                          items={row.items_pitches}
                          isCount
                        >
                          {row.total_pitches}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono text-gray-700 whitespace-nowrap">
                        <MetricHoverCard
                          title={`${row.pm_name} · Converted Projects`}
                          formula="已轉成項目且計隻數的報價"
                          items={row.items_converted}
                          isCount
                        >
                          {row.converted}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono text-gray-700 whitespace-nowrap">
                        <MetricHoverCard
                          title={`${row.pm_name} · Bad Debt Projects`}
                          formula="帶有壞帳記錄的 Project"
                          items={row.items_bad_debt}
                          formatValue={formatMoney2}
                          totalLabel="壞帳項目數"
                          isCount
                        >
                          {row.bad_debt_projects}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className={`text-sm text-right font-mono whitespace-nowrap ${row.total_bad_debt ? "text-red-600 font-semibold" : "text-gray-300"}`}>
                        <MetricHoverCard
                          title={`${row.pm_name} · Total Bad Debt Amount`}
                          formula="所有壞帳金額加總"
                          items={row.items_bad_debt}
                          formatValue={formatMoney2}
                          total={row.total_bad_debt}
                        >
                          {formatMoney2(row.total_bad_debt)}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className={`text-sm text-right font-mono whitespace-nowrap ${row.avg_bad_debt_pct ? "text-red-600" : "text-gray-300"}`}>
                        <MetricHoverCard
                          title={`${row.pm_name} · Avg. Bad Debt% (each project)`}
                          formula="每個項目 壞帳 ÷ Main 的平均值"
                          items={row.items_bad_debt}
                          formatValue={formatMoney2}
                          total={row.total_bad_debt}
                        >
                          {fmtPct(row.avg_bad_debt_pct)}
                        </MetricHoverCard>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {visibleRows.length > 0 && (
                <tfoot>
                  <TableRow className="bg-gray-100/70 border-t-2 border-gray-200 font-semibold">
                    <TableCell className="text-sm text-gray-800 whitespace-nowrap">
                      總計 Total ({visibleRows.length})
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-800 whitespace-nowrap">
                      {totals.total_pitches}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-800 whitespace-nowrap">
                      {totals.converted}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-800 whitespace-nowrap">
                      {totals.bad_debt_projects}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono font-bold text-red-600 whitespace-nowrap">
                      {formatMoney2(totals.total_bad_debt)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-900 whitespace-nowrap">
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
        selected period.
      </p>
    </div>
  );
}
