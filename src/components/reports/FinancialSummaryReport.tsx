"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  fetchSalesByPMProjects,
  type SalesByPMProject,
} from "@/lib/data-service";
import { getEffectiveStatusRule } from "@/lib/project-status-rules";
import MetricHoverCard, { type BreakdownItem, type MetricSource, projectHref } from "@/components/reports/MetricHoverCard";

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
import type { StaffDirectoryRow } from "@/lib/data-service";
import { useFinancialFormat } from "@/hooks/use-financial-format";

function fmtPct(num: number, denom: number): string {
  if (!denom) return "0.00%";
  return `${((num / denom) * 100).toFixed(2)}%`;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Distinct line colours for the per-team project-count series, matching the
// legacy screen's teal / red / amber / purple palette.
const TEAM_COLORS = ["#14b8a6", "#ef4444", "#f59e0b", "#6366f1", "#ec4899"];
const OTHERS_COLOR = "#6b7280";
const PREV_YEAR_COLOR = "#9ca3af"; // greyed-out YoY comparison line
const TOP_TEAM_COUNT = 3; // top N teams get their own line; the rest fold into "Others"

/** Shift a Date by ±N calendar years (preserves local time-of-day). */
function shiftYears(d: Date, delta: number): Date {
  const out = new Date(d);
  out.setFullYear(out.getFullYear() + delta);
  return out;
}

// ─── METRIC CARD ──────────────────────────────────────────────
function MetricCard({
  label,
  value,
  accent,
  hover,
}: {
  label: string;
  value: string;
  accent: string;
  // Optional hover breakdown of the projects behind the figure.
  hover?: {
    title: string;
    formula?: string;
    items: BreakdownItem[];
    formatValue?: (v: number) => string;
    total?: number;
    isCount?: boolean;
    source?: MetricSource;
  };
}) {
  const valueEl = (
    <span className="block text-2xl font-bold text-gray-900 mt-1 whitespace-nowrap">{value}</span>
  );
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg shadow-sm px-5 py-4 border-l-4"
      style={{ borderLeftColor: accent }}
    >
      <p className="text-sm text-gray-500">{label}</p>
      {hover ? (
        <MetricHoverCard
          title={hover.title}
          formula={hover.formula}
          items={hover.items}
          formatValue={hover.formatValue}
          total={hover.total}
          isCount={hover.isCount}
          source={hover.source}
          align="start"
        >
          {valueEl}
        </MetricHoverCard>
      ) : (
        valueEl
      )}
    </div>
  );
}

interface LevelTotals {
  revenue: number;
  cost: number;
  profit: number;
}

export default function FinancialSummaryReport() {
  const { formatMoney2 } = useFinancialFormat();
  const [projects, setProjects] = useState<SalesByPMProject[]>([]);
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
  } = useAlignedReportFilters("business");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchSalesByPMProjects();
      setProjects(data);
      setLoading(false);
    }
    load();
  }, []);

  const window = useMemo(() => resolveRange(range, new Date(), custom), [range, custom]);

  // BWA / BWF toggle applied first — everything downstream (filter bar
  // options included) only sees the enabled sources.
  const sourceProjects = useMemo(() => filterBySources(projects, sources), [projects, sources]);
  const enrichedProjects = useEnrichedProjectFilterRows(
    sourceProjects,
    projectFilterNeedsExtras(projectFilter),
  );

  const staffAndProjectFiltered = useMemo(() => {
    return applyProjectFilters(enrichedProjects, projectFilter).filter((p) =>
      staffIdMatchesFilter(p.pm_id, staffFilter, staffDirectory),
    );
  }, [enrichedProjects, projectFilter, staffFilter, staffDirectory]);

  // Projects matching the ultimate filter AND signed within the window
  // (the report note keys off signed date).
  const windowProjects = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    return staffAndProjectFiltered.filter((p) => {
      if (!p.signed_date) return false;
      const t = new Date(p.signed_date).getTime();
      return !isNaN(t) && t >= fromMs && t <= toMs;
    });
  }, [staffAndProjectFiltered, window]);

  // Same filters, signed in the date window shifted back 1 year — used for
  // the grey YoY comparison line on the Project Count chart.
  const prevYearProjects = useMemo(() => {
    if (!window.from || !window.to) return [] as SalesByPMProject[];
    const fromMs = shiftYears(window.from, -1).getTime();
    const toMs = shiftYears(window.to, -1).getTime();
    return staffAndProjectFiltered.filter((p) => {
      if (!p.signed_date) return false;
      const t = new Date(p.signed_date).getTime();
      return !isNaN(t) && t >= fromMs && t <= toMs;
    });
  }, [staffAndProjectFiltered, window]);

  // ─── HEADLINE TOTALS (L2 signed / L3 dynamic) ─────────────
  // Money figures respect the project-status counting rules (計錢): a
  // Case Closed / Internal project does not contribute to the sums.
  const { l2, l3, items } = useMemo(() => {
    const l2: LevelTotals = { revenue: 0, cost: 0, profit: 0 };
    const l3: LevelTotals = { revenue: 0, cost: 0, profit: 0 };
    // Per-project contribution lists, keyed by level + measure, for hover.
    const items = {
      l2: { revenue: [] as BreakdownItem[], cost: [] as BreakdownItem[], profit: [] as BreakdownItem[] },
      l3: { revenue: [] as BreakdownItem[], cost: [] as BreakdownItem[], profit: [] as BreakdownItem[] },
    };
    const statusFilter = projectFilter.status;
    for (const p of windowProjects) {
      if (!getEffectiveStatusRule(p.status, statusFilter).countMoney) continue;
      const name = p.project_name || p.project_code || "(未命名)";
      const sub = p.project_code || undefined;
      const href = projectHref(p.id, p.source);
      const estRev = p.est_income || 0;
      const estCost = p.est_expense || 0;
      const actRev = p.actual_income || 0;
      const actCost = p.actual_expense || 0;
      l2.revenue += estRev;
      l2.cost += estCost;
      l2.profit += estRev - estCost;
      l3.revenue += actRev;
      l3.cost += actCost;
      l3.profit += actRev - actCost;
      items.l2.revenue.push({ name, sub, value: estRev, href });
      items.l2.cost.push({ name, sub, value: estCost, href });
      items.l2.profit.push({ name, sub, value: estRev - estCost, href });
      items.l3.revenue.push({ name, sub, value: actRev, href });
      items.l3.cost.push({ name, sub, value: actCost, href });
      items.l3.profit.push({ name, sub, value: actRev - actCost, href });
    }
    return { l2, l3, items };
  }, [windowProjects, projectFilter.status]);

  // ─── PROJECT COUNT BY MONTH (bars) + TOP TEAMS (lines) ────
  // Counts respect the 計隻數 rule. The chart spans the window's months;
  // the top teams by count each get a line, the remainder fold into "Others".
  // A grey dashed line overlays prior-year totals (same window − 1 year),
  // aligned onto the current x-axis buckets for YoY comparison.
  const { chartData, pmSeries, showPrevYear } = useMemo(() => {
    const statusFilter = projectFilter.status;
    // Count per team (across the whole window) to choose the top series.
    const countByTeam = new Map<string, { name: string; count: number }>();
    for (const p of windowProjects) {
      if (!getEffectiveStatusRule(p.status, statusFilter).countNumber) continue;
      const key = p.team_id || "unassigned";
      const name = p.team_name || "未分配 Unassigned";
      const e = countByTeam.get(key) || { name, count: 0 };
      e.count += 1;
      countByTeam.set(key, e);
    }
    const ranked = Array.from(countByTeam.entries()).sort(
      (a, b) => b[1].count - a[1].count,
    );
    const topKeys = ranked.slice(0, TOP_TEAM_COUNT).map(([k]) => k);
    const topKeySet = new Set(topKeys);
    const hasOthers = ranked.length > TOP_TEAM_COUNT;

    const pmSeries = topKeys.map((k, i) => ({
      key: k,
      name: countByTeam.get(k)!.name,
      color: TEAM_COLORS[i % TEAM_COLORS.length],
    }));
    if (hasOthers) {
      pmSeries.push({ key: "__others__", name: "Others", color: OTHERS_COLOR });
    }

    // Month buckets spanning the window (inclusive of partial first/last).
    // For an unbounded ("All Time") window, fall back to the actual span of
    // the data so the chart still has a finite range.
    let fromBound = window.from;
    let toBound = window.to;
    if (!fromBound || !toBound) {
      let minT = Infinity;
      let maxT = -Infinity;
      for (const p of windowProjects) {
        if (!p.signed_date) continue;
        const t = new Date(p.signed_date).getTime();
        if (isNaN(t)) continue;
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      }
      const now = new Date();
      fromBound = fromBound ?? (isFinite(minT) ? new Date(minT) : now);
      toBound = toBound ?? (isFinite(maxT) ? new Date(maxT) : now);
    }

    // YoY line only when the date filter has both bounds (not All Time).
    const showPrevYear = !!(window.from && window.to);

    // ─── Adaptive granularity so the chart always shows ≥4 bars ──
    const DAY_MS = 86400000;
    const startDay = new Date(fromBound.getFullYear(), fromBound.getMonth(), fromBound.getDate());
    const endDay = new Date(toBound.getFullYear(), toBound.getMonth(), toBound.getDate());

    const monthCount =
      (endDay.getFullYear() - startDay.getFullYear()) * 12 +
      (endDay.getMonth() - startDay.getMonth()) +
      1;
    const dayCount = Math.round((endDay.getTime() - startDay.getTime()) / DAY_MS) + 1;
    const weekCount = Math.ceil(dayCount / 7);

    const granularity: "month" | "week" | "day" =
      monthCount >= 4 ? "month" : weekCount >= 4 ? "week" : "day";

    const buckets: { key: string; label: string }[] = [];
    let keyOf: (d: Date) => string;
    const daysFromStart = (d: Date) =>
      Math.round(
        (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
          startDay.getTime()) /
          DAY_MS,
      );

    if (granularity === "month") {
      const cursor = new Date(startDay.getFullYear(), startDay.getMonth(), 1);
      const lastM = new Date(endDay.getFullYear(), endDay.getMonth(), 1);
      while (cursor <= lastM) {
        buckets.push({
          key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
          label: MONTH_LABELS[cursor.getMonth()],
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}`;
    } else if (granularity === "week") {
      const cursor = new Date(startDay);
      while (cursor <= endDay) {
        buckets.push({
          key: `w${Math.floor(daysFromStart(cursor) / 7)}`,
          label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
        });
        cursor.setDate(cursor.getDate() + 7);
      }
      keyOf = (d) => `w${Math.floor(daysFromStart(d) / 7)}`;
    } else {
      const cursor = new Date(startDay);
      while (cursor <= endDay) {
        buckets.push({
          key: `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
          label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }

    const rowByKey = new Map<string, any>();
    const chartData = buckets.map((b) => {
      const row: any = { month: b.label, all: 0, prevYear: 0 };
      for (const s of pmSeries) row[s.key] = 0;
      rowByKey.set(b.key, row);
      return row;
    });

    for (const p of windowProjects) {
      if (!getEffectiveStatusRule(p.status, statusFilter).countNumber) continue;
      if (!p.signed_date) continue;
      const d = new Date(p.signed_date);
      if (isNaN(d.getTime())) continue;
      const row = rowByKey.get(keyOf(d));
      if (!row) continue;
      row.all += 1;
      const key = p.team_id || "unassigned";
      if (topKeySet.has(key)) row[key] += 1;
      else if (hasOthers) row.__others__ += 1;
    }

    // Prior-year totals: shift each signed date +1 year onto current buckets.
    if (showPrevYear) {
      for (const p of prevYearProjects) {
        if (!getEffectiveStatusRule(p.status, statusFilter).countNumber) continue;
        if (!p.signed_date) continue;
        const d = new Date(p.signed_date);
        if (isNaN(d.getTime())) continue;
        const aligned = shiftYears(d, 1);
        const row = rowByKey.get(keyOf(aligned));
        if (!row) continue;
        row.prevYear += 1;
      }
    }

    return { chartData, pmSeries, showPrevYear };
  }, [windowProjects, prevYearProjects, window, projectFilter.status]);

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">財務摘要 Financial Summary</h2>
        <p className="text-sm text-gray-500 mt-1">
          From {fmtDate(window.from)} to {fmtDate(window.to)}
        </p>
      </div>

      <ReportFilterStack
        projectRows={enrichedProjects}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        staffLocks={staffLocks}
        isSuperAdmin={isSuperAdmin}
        onStaffDirectoryLoaded={setStaffDirectory}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-bw-blue" />
          <span className="ml-3 text-gray-500 text-sm">載入報表資料...</span>
        </div>
      ) : (
        <>
          {/* ─── SIGNED ACTUAL (L2) ─────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 underline underline-offset-4 decoration-gray-300 mb-3">
              Signed Actual (L2)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Total Revenue" value={formatMoney2(l2.revenue)} accent="#22c55e"
                hover={{ title: "L2 Signed · Total Revenue", formula: "各項目 L2 已簽收入加總", items: items.l2.revenue, formatValue: formatMoney2, total: l2.revenue, source: "l2" }} />
              <MetricCard label="Total Cost" value={formatMoney2(l2.cost)} accent="#ef4444"
                hover={{ title: "L2 Signed · Total Cost", formula: "各項目 L2 已簽成本加總", items: items.l2.cost, formatValue: formatMoney2, total: l2.cost, source: "l2" }} />
              <MetricCard label="Gross Profit" value={formatMoney2(l2.profit)} accent="#3b82f6"
                hover={{ title: "L2 Signed · Gross Profit", formula: "各項目 收入 − 成本 加總", items: items.l2.profit, formatValue: formatMoney2, total: l2.profit, source: "l2" }} />
              <MetricCard label="Profit Margin" value={fmtPct(l2.profit, l2.revenue)} accent="#a855f7"
                hover={{ title: "L2 Signed · Profit Margin", formula: `總毛利 ${formatMoney2(l2.profit)} ÷ 總收入 ${formatMoney2(l2.revenue)}`, items: items.l2.profit, formatValue: formatMoney2, total: l2.profit, source: "l2" }} />
            </div>
          </div>

          {/* ─── DYNAMIC ACTUAL (L3) ────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 underline underline-offset-4 decoration-gray-300 mb-3">
              Dynamic Actual (L3)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Total Revenue" value={formatMoney2(l3.revenue)} accent="#22c55e"
                hover={{ title: "L3 Actual · Total Revenue", formula: "各項目 L3 實際收入加總", items: items.l3.revenue, formatValue: formatMoney2, total: l3.revenue, source: "l3" }} />
              <MetricCard label="Total Cost" value={formatMoney2(l3.cost)} accent="#ef4444"
                hover={{ title: "L3 Actual · Total Cost", formula: "各項目 L3 實際成本加總", items: items.l3.cost, formatValue: formatMoney2, total: l3.cost, source: "l3" }} />
              <MetricCard label="Gross Profit" value={formatMoney2(l3.profit)} accent="#3b82f6"
                hover={{ title: "L3 Actual · Gross Profit", formula: "各項目 收入 − 成本 加總", items: items.l3.profit, formatValue: formatMoney2, total: l3.profit, source: "l3" }} />
              <MetricCard label="Profit Margin" value={fmtPct(l3.profit, l3.revenue)} accent="#a855f7"
                hover={{ title: "L3 Actual · Profit Margin", formula: `總毛利 ${formatMoney2(l3.profit)} ÷ 總收入 ${formatMoney2(l3.revenue)}`, items: items.l3.profit, formatValue: formatMoney2, total: l3.profit, source: "l3" }} />
            </div>
          </div>

          {/* ─── PROJECT COUNT CHART ────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 underline underline-offset-4 decoration-gray-300 mb-3">
              Project Count
            </h3>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <ResponsiveContainer width="100%" height={380}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="all"
                    name="All Project Count"
                    fill="#cbd5e1"
                    radius={[3, 3, 0, 0]}
                    barSize={22}
                  />
                  {showPrevYear && (
                    <Line
                      type="monotone"
                      dataKey="prevYear"
                      name="Previous Year"
                      stroke={PREV_YEAR_COLOR}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      strokeOpacity={0.85}
                      dot={{ r: 2.5, fill: PREV_YEAR_COLOR, strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {pmSeries.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ─── NOTE ─────────────────────────────────── */}
          <p className="text-sm text-gray-400 text-center">
            Note: This summary is based on orders with a project signed date in
            the selected period.
          </p>
        </>
      )}
    </div>
  );
}
