"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Info,
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
  fetchPMHitRatePitches,
  fetchDiscountedProjects,
  type PMHitRatePitch,
  type DiscountedProject,
} from "@/lib/data-service";
import MetricHoverCard, { type BreakdownItem, projectHref } from "@/components/reports/MetricHoverCard";
import { getEffectiveStatusRule } from "@/lib/project-status-rules";

// ─── DATE-RANGE PRESETS — shared across all /business-reports ──
import {
  resolveRange,
  rangeBounds,
  fmtRangeDate as fmtDate,
} from "@/lib/report-date-range";
import { useReportRange, filterBySources } from "@/components/reports/ReportDateRangeContext";
import ReportDateRangeBar from "@/components/reports/ReportDateRangeBar";
import ReportDateRangeNote from "@/components/reports/ReportDateRangeNote";
import { useFinancialFormat } from "@/hooks/use-financial-format";

function fmtPct(val: number): string {
  if (!val || isNaN(val)) return "0.00%";
  return `${val.toFixed(2)}%`;
}

// Filter rows whose enquiry_date falls in [from, to]. Records without an
// enquiry date are excluded (matches the legacy report note).
function inWindow(date: string | null, fromMs: number, toMs: number): boolean {
  if (!date) return false;
  const t = new Date(date).getTime();
  return !isNaN(t) && t >= fromMs && t <= toMs;
}

// ─── AGGREGATED ROW (one per PM) ──────────────────────────────
interface PMRow {
  key: string;
  pm_name: string;
  total_pitches: number;
  converted: number;
  discounted_projects: number;
  total_discount: number; // negative
  avg_discount_pct: number; // mean of per-project (discount / gross) %
  // Hover breakdowns.
  items_pitches: BreakdownItem[];
  items_converted: BreakdownItem[];
  items_discounted: BreakdownItem[];
}

type SortCol =
  | "pm_name"
  | "total_pitches"
  | "converted"
  | "discounted_projects"
  | "total_discount"
  | "avg_discount_pct";

export default function DiscountedProjectReport() {
  const { formatMoney2 } = useFinancialFormat();
  const [pitches, setPitches] = useState<PMHitRatePitch[]>([]);
  const [discounts, setDiscounts] = useState<DiscountedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const { range, custom, sources } = useReportRange();
  const [sortCol, setSortCol] = useState<SortCol>("total_pitches");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [p, d] = await Promise.all([
        fetchPMHitRatePitches(),
        fetchDiscountedProjects(),
      ]);
      setPitches(p);
      setDiscounts(d);
      setLoading(false);
    }
    load();
  }, []);

  const window = useMemo(() => resolveRange(range, new Date(), custom), [range, custom]);

  // ─── AGGREGATE INTO PM ROWS ────────────────────────────────
  const pmRows = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    const groups = new Map<string, PMRow>();

    const ensure = (key: string, name: string): PMRow => {
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          pm_name: name || "未分配 Unassigned",
          total_pitches: 0,
          converted: 0,
          discounted_projects: 0,
          total_discount: 0,
          avg_discount_pct: 0,
          items_pitches: [],
          items_converted: [],
          items_discounted: [],
        };
        groups.set(key, g);
      }
      return g;
    };

    // Pitch / conversion counts — filtered on the pitch enquiry_date.
    for (const p of filterBySources(pitches, sources)) {
      if (!inWindow(p.enquiry_date, fromMs, toMs)) continue;
      const g = ensure(p.pm_id || "unassigned", p.pm_name || "");
      const pitchLabel = p.pitch_label || p.pitch_code || "(未命名報價)";
      g.total_pitches += 1;
      g.items_pitches.push({ name: pitchLabel, sub: p.pitch_code || undefined });
      // No status filter UI — always apply matrix. Converted → 計隻數.
      if (
        p.converted &&
        getEffectiveStatusRule(p.converted_status, "all").countNumber
      ) {
        g.converted += 1;
        g.items_converted.push({
          name: pitchLabel,
          sub: [p.pitch_code, p.converted_status].filter(Boolean).join(" · ") || undefined,
        });
      }
    }

    // Discounted projects — filtered on the project enquiry_date. We track
    // the per-project discount % so the average is across discounted
    // projects only (mirrors "Avg. Discount% (each project)").
    // Discount $ / discounted count → 計錢 (no status filter UI → "all").
    const pctSum = new Map<string, number>();
    for (const d of filterBySources(discounts, sources)) {
      if (!inWindow(d.enquiry_date, fromMs, toMs)) continue;
      if (!getEffectiveStatusRule(d.status, "all").countMoney) continue;
      const g = ensure(d.pm_id || "unassigned", d.pm_name || "");
      g.discounted_projects += 1;
      g.total_discount += d.discount_amount;
      const pct = d.gross_amount ? (d.discount_amount / d.gross_amount) * 100 : 0;
      pctSum.set(g.key, (pctSum.get(g.key) || 0) + pct);
      g.items_discounted.push({
        name: d.project_name || d.project_code || "(未命名)",
        sub: d.project_code || undefined,
        value: d.discount_amount,
        href: projectHref(d.project_id, d.source),
      });
    }

    // Finalise the average discount % per PM.
    for (const g of groups.values()) {
      g.avg_discount_pct = g.discounted_projects
        ? (pctSum.get(g.key) || 0) / g.discounted_projects
        : 0;
    }

    return Array.from(groups.values());
  }, [pitches, discounts, window, sources]);

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
        case "discounted_projects":
          return r.discounted_projects;
        case "total_discount":
          return r.total_discount;
        case "avg_discount_pct":
          return r.avg_discount_pct;
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
        acc.discounted_projects += r.discounted_projects;
        acc.total_discount += r.total_discount;
        return acc;
      },
      { total_pitches: 0, converted: 0, discounted_projects: 0, total_discount: 0 },
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
          折扣項目 Discounted Project
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          From {fmtDate(window.from)} to {fmtDate(window.to)}
        </p>
      </div>

      {/* ─── INFO ───────────────────────────────────── */}
      <div className="flex items-start gap-2 bg-blue-50/60 border border-blue-100 rounded-lg px-4 py-3 text-sm text-gray-600">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <span>
          每列按項目經理彙總。報價數與轉換數以報價的
          <span className="font-medium">查詢日期</span>
          篩選所選期間；轉換數只計已轉成項目且符合「計隻數」狀態的報價。
          折扣項目來自發票產生器已啟用的折扣（折扣金額大於 0），沿發票→收入→項目歸屬至主
          PM，並以項目的<span className="font-medium">查詢日期</span>
          篩選；折扣金額與項目數只計符合「計錢」狀態的項目。
          平均折扣% 為各折扣項目（折扣 ÷ 折扣前發票小計）的平均值。沒有查詢日期的記錄不納入。
        </span>
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
                  <Th col="discounted_projects" right>Discounted Projects</Th>
                  <Th col="total_discount" right>Total Discount Amount</Th>
                  <Th col="avg_discount_pct" right>
                    Avg. Discount%<br />
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
                          formula="此期間（按報價查詢日期）的所有報價"
                          items={row.items_pitches}
                          isCount
                        >
                          {row.total_pitches}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono text-gray-700 whitespace-nowrap">
                        <MetricHoverCard
                          title={`${row.pm_name} · Converted Projects`}
                          formula="已轉成項目的報價"
                          items={row.items_converted}
                          isCount
                        >
                          {row.converted}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell
                        className={`text-sm text-right font-mono whitespace-nowrap ${
                          row.discounted_projects ? "text-bw-blue font-semibold" : "text-gray-400"
                        }`}
                      >
                        <MetricHoverCard
                          title={`${row.pm_name} · 折扣項目`}
                          formula="發票產生器已啟用折扣的項目"
                          items={row.items_discounted}
                          formatValue={(v) => formatMoney2(v, { fallback: "$0.00" })}
                          total={row.total_discount}
                        >
                          {row.discounted_projects}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell
                        className={`text-sm text-right font-mono whitespace-nowrap ${
                          row.total_discount < 0 ? "text-blue-600 font-semibold" : "text-gray-400"
                        }`}
                      >
                        <MetricHoverCard
                          title={`${row.pm_name} · Total Discount Amount`}
                          formula="各折扣項目的發票折扣金額加總"
                          items={row.items_discounted}
                          formatValue={(v) => formatMoney2(v, { fallback: "$0.00" })}
                          total={row.total_discount}
                        >
                          {formatMoney2(row.total_discount, { fallback: "$0.00" })}
                        </MetricHoverCard>
                      </TableCell>
                      <TableCell
                        className={`text-sm text-right font-mono whitespace-nowrap ${
                          row.avg_discount_pct < 0 ? "text-blue-600 font-semibold" : "text-gray-400"
                        }`}
                      >
                        <MetricHoverCard
                          title={`${row.pm_name} · Avg. Discount% (each project)`}
                          formula="各折扣項目的 折扣 ÷ 折扣前發票小計 % 平均值"
                          items={row.items_discounted}
                          formatValue={(v) => formatMoney2(v, { fallback: "$0.00" })}
                          total={row.total_discount}
                        >
                          {fmtPct(row.avg_discount_pct)}
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
                      {totals.discounted_projects}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                      {formatMoney2(totals.total_discount, { fallback: "$0.00" })}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-gray-400 whitespace-nowrap">
                      —
                    </TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </div>
      )}

      <ReportDateRangeNote>
        Note: This summary is based on pitches and orders with a project
        enquiry date in the selected period.
      </ReportDateRangeNote>
    </div>
  );
}
