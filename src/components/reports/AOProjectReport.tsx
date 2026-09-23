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
  fetchAOProjectPitches,
  type AOProjectPitch,
} from "@/lib/data-service";
import { getEffectiveStatusRule } from "@/lib/project-status-rules";
import MetricHoverCard, { type BreakdownItem, projectHref } from "@/components/reports/MetricHoverCard";
import {
  resolveRange,
  rangeBounds,
  fmtRangeDate as fmtDate,
} from "@/lib/report-date-range";
import { useReportRange, filterBySources } from "@/components/reports/ReportDateRangeContext";
import ReportDateRangeBar from "@/components/reports/ReportDateRangeBar";
import { useFinancialFormat } from "@/hooks/use-financial-format";

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
  ao_projects: number;         // converted projects carrying ≥1 A.O. line
  total_ao_amount: number;     // Σ A.O. income across those projects
  avg_ao_pct: number;          // mean per-project (A.O. ÷ Main) over A.O. projects
  // Contributing records per metric, for hover breakdowns.
  items_pitches: BreakdownItem[];
  items_converted: BreakdownItem[];
  items_ao: BreakdownItem[];
}

type SortCol =
  | "pm_name"
  | "total_pitches"
  | "converted"
  | "ao_projects"
  | "total_ao_amount"
  | "avg_ao_pct";

export default function AOProjectReport() {
  const { formatMoney2 } = useFinancialFormat();
  const [pitches, setPitches] = useState<AOProjectPitch[]>([]);
  const [loading, setLoading] = useState(true);
  const { range, custom, sources } = useReportRange();
  const [sortCol, setSortCol] = useState<SortCol>("total_ao_amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const rows = await fetchAOProjectPitches();
      setPitches(rows);
      setLoading(false);
    }
    load();
  }, []);

  const window = useMemo(() => resolveRange(range, new Date(), custom), [range, custom]);

  // ─── AGGREGATE INTO PM ROWS ────────────────────────────────
  const pmRows = useMemo(() => {
    const groups = new Map<string, PMRow>();
    const { fromMs, toMs } = rangeBounds(window);

    for (const p of filterBySources(pitches, sources)) {
      // Window on the converted project's signed_date (when the A.O. project
      // became active) so A.O.s surface in the period the project was signed;
      // fall back to the pitch enquiry_date for not-yet-converted pitches.
      const anchorDate = p.signed_date || p.enquiry_date;
      if (!anchorDate) continue;
      const t = new Date(anchorDate).getTime();
      if (isNaN(t) || t < fromMs || t > toMs) continue;

      const key = p.pm_id || "unassigned";
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          pm_name: p.pm_name || "未分配 Unassigned",
          total_pitches: 0,
          converted: 0,
          ao_projects: 0,
          total_ao_amount: 0,
          avg_ao_pct: 0,
          items_pitches: [],
          items_converted: [],
          items_ao: [],
        };
        groups.set(key, g);
      }

      const label = p.pitch_label || "(未命名)";
      g.total_pitches += 1;
      g.items_pitches.push({ name: label });

      // No status filter UI — always apply the matrix (statusFilter = "all").
      // Converted count → 計隻數; A.O. $ / A.O. project count → 計錢.
      if (!p.converted) continue;
      const rule = getEffectiveStatusRule(p.converted_status, "all");
      if (rule.countNumber) {
        g.converted += 1;
        g.items_converted.push({ name: p.project_label || label, sub: p.converted_status || undefined, href: projectHref(p.project_id, p.source) });
      }
      if (rule.countMoney && p.ao_amount > 0) {
        g.ao_projects += 1;
        g.total_ao_amount += p.ao_amount;
        const pct = p.main_amount > 0 ? (p.ao_amount / p.main_amount) * 100 : 0;
        g.avg_ao_pct += pct;
        g.items_ao.push({
          name: p.project_label || label,
          value: p.ao_amount,
          sub: `A.O. ${formatMoney2(p.ao_amount)} ÷ Main ${formatMoney2(p.main_amount)} = ${fmtPct(pct)}`,
          href: projectHref(p.project_id, p.source),
        });
      }
    }

    // Convert the accumulated pct sum into a mean per A.O. project.
    for (const g of groups.values()) {
      g.avg_ao_pct = g.ao_projects > 0 ? g.avg_ao_pct / g.ao_projects : 0;
    }

    return Array.from(groups.values());
  }, [pitches, window, sources, formatMoney2]);

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
        case "ao_projects":
          return r.ao_projects;
        case "total_ao_amount":
          return r.total_ao_amount;
        case "avg_ao_pct":
          return r.avg_ao_pct;
      }
    };
    // This is the A.O. Project report — only show PMs who actually have at
    // least one A.O. project in the window (hide rows with 0 A.O. projects).
    return [...pmRows]
      .filter((r) => r.ao_projects > 0)
      .sort((a, b) => {
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
    const t = visibleRows.reduce(
      (acc, r) => {
        acc.total_pitches += r.total_pitches;
        acc.converted += r.converted;
        acc.ao_projects += r.ao_projects;
        acc.total_ao_amount += r.total_ao_amount;
        acc.pct_sum += r.avg_ao_pct * r.ao_projects;
        return acc;
      },
      { total_pitches: 0, converted: 0, ao_projects: 0, total_ao_amount: 0, pct_sum: 0 }
    );
    return t;
  }, [visibleRows]);

  // Company-wide Avg A.O.% = mean across every A.O. project (not mean of PM means).
  const totalsAvgPct = totals.ao_projects > 0 ? totals.pct_sum / totals.ao_projects : 0;

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
          A.O. Project 新增了 A.O. 項目的 Project
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          From {fmtDate(window.from)} to {fmtDate(window.to)}
        </p>
      </div>

      {/* ─── RANGE PILLS ────────────────────────────── */}
      <ReportDateRangeBar />

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
                  <Th col="ao_projects" right>A.O. Projects</Th>
                  <Th col="total_ao_amount" right>Total A.O. Amount</Th>
                  <Th col="avg_ao_pct" right>Avg. A.O.% (each project)</Th>
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
                          title={`${row.pm_name} · A.O. Projects`}
                          formula="帶有 A.O. 收入項目的 Project"
                          items={row.items_ao}
                          formatValue={formatMoney2}
                          totalLabel="A.O. 項目數"
                          isCount
                        >
                          {row.ao_projects}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className={`text-sm text-right font-mono whitespace-nowrap ${row.total_ao_amount ? "text-bw-blue font-semibold" : "text-gray-300"}`}>
                        <MetricHoverCard
                          title={`${row.pm_name} · Total A.O. Amount`}
                          formula="所有 A.O. 收入加總"
                          items={row.items_ao}
                          formatValue={formatMoney2}
                          total={row.total_ao_amount}
                        >
                          {formatMoney2(row.total_ao_amount)}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className={`text-sm text-right font-mono whitespace-nowrap ${row.avg_ao_pct ? "text-bw-blue" : "text-gray-300"}`}>
                        <MetricHoverCard
                          title={`${row.pm_name} · Avg. A.O.% (each project)`}
                          formula="每個項目 A.O. ÷ Main 的平均值"
                          items={row.items_ao}
                          formatValue={formatMoney2}
                          total={row.total_ao_amount}
                        >
                          {fmtPct(row.avg_ao_pct)}
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
                      {totals.ao_projects}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono font-bold text-bw-blue whitespace-nowrap">
                      {formatMoney2(totals.total_ao_amount)}
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
        Note: This summary is based on projects with a signed date in the
        selected period.
      </p>
    </div>
  );
}
