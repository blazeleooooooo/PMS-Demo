"use client";

// ═══════════════════════════════════════════════════════════════════════════
// AI WARNING — INDIVIDUAL Shared GP Trend
// Rendered at /individual-reports/shared-gp-trend via individual-report-registry
// with reportScope="individual" (StaffFilterBar locks 員工 unless Super Admin).
// Layout mirrors FinancialSummaryReport; metrics/chart use project_bv
// shared_estimated_gp / shared_actual_gp (line chart: Est / Act / YoY Est).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  fetchSalesTrendBV,
  type SalesTrendBVRow,
  type StaffDirectoryRow,
} from "@/lib/data-service";
import { getEffectiveStatusRule } from "@/lib/project-status-rules";
import MetricHoverCard, {
  type BreakdownItem,
  type MetricSource,
  projectHref,
} from "@/components/reports/MetricHoverCard";
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
import { useAlignedReportFilters } from "@/hooks/use-aligned-report-filters";
import {
  projectFilterNeedsExtras,
  useEnrichedProjectFilterRows,
} from "@/hooks/use-project-filter-extras";
import type { ReportStaffScope } from "@/hooks/use-report-staff-lock";
import { useFinancialFormat } from "@/hooks/use-financial-format";

function fmtPct(num: number, denom: number): string {
  if (!denom) return "0.00%";
  return `${((num / denom) * 100).toFixed(2)}%`;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const PREV_YEAR_COLOR = "#9ca3af";
const EST_LINE_COLOR = "#f59e0b";
const ACTUAL_LINE_COLOR = "#f97316";
const COUNT_LINE_COLOR = "#64748b";

function shiftYears(d: Date, delta: number): Date {
  const out = new Date(d);
  out.setFullYear(out.getFullYear() + delta);
  return out;
}

/** Adaptive month/week/day buckets spanning [fromBound, toBound]. */
function buildTimeBuckets(
  fromBound: Date,
  toBound: Date,
): {
  buckets: { key: string; label: string }[];
  keyOf: (d: Date) => string;
} {
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

  return { buckets, keyOf };
}

function resolveChartBounds(
  window: { from: Date | null; to: Date | null },
  rows: SalesTrendBVRow[],
): { fromBound: Date; toBound: Date; showPrevYear: boolean } {
  let fromBound = window.from;
  let toBound = window.to;
  if (!fromBound || !toBound) {
    let minT = Infinity;
    let maxT = -Infinity;
    for (const r of rows) {
      if (!r.signed_date) continue;
      const t = new Date(r.signed_date).getTime();
      if (isNaN(t)) continue;
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    }
    const now = new Date();
    fromBound = fromBound ?? (isFinite(minT) ? new Date(minT) : now);
    toBound = toBound ?? (isFinite(maxT) ? new Date(maxT) : now);
  }
  return {
    fromBound,
    toBound,
    showPrevYear: !!(window.from && window.to),
  };
}

function bvRowProjectFields(r: SalesTrendBVRow): ProjectFilterFields {
  return {
    id: r.project_id || r.id,
    status: r.project_status,
    cost_centre_bu_code: r.cost_centre_bu_code,
    service_type_name: r.service_type_name,
    service_type_id: r.service_type_id,
    project_type_name: r.project_type_name,
    project_type_id: r.project_type_id,
    financial_year_name: r.financial_year_name,
    n_financial_year_id: r.n_financial_year_id,
    est_income: r.est_income,
    project_size: r.project_size,
    project_name: r.project_name,
    project_code: r.project_code,
    filter_project_id: r.project_id || r.id,
  };
}

function MetricCard({
  label,
  value,
  accent,
  hover,
}: {
  label: string;
  value: string;
  accent: string;
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
    <span className="block text-2xl font-bold text-gray-900 mt-1 whitespace-nowrap">
      {value}
    </span>
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

export interface SharedGpTrendReportProps {
  reportScope?: ReportStaffScope;
}

export default function SharedGpTrendReport({
  reportScope = "individual",
}: SharedGpTrendReportProps) {
  const { formatMoney2 } = useFinancialFormat();
  const [rows, setRows] = useState<SalesTrendBVRow[]>([]);
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

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchSalesTrendBV();
      setRows(data);
      setLoading(false);
    }
    load();
  }, []);

  const window = useMemo(() => resolveRange(range, new Date(), custom), [range, custom]);

  const sourceRows = useMemo(() => filterBySources(rows, sources), [rows, sources]);

  const projectFilterRows = useMemo(
    () => sourceRows.map(bvRowProjectFields),
    [sourceRows],
  );
  const enrichedProjectFilterRows = useEnrichedProjectFilterRows(
    projectFilterRows,
    projectFilterNeedsExtras(projectFilter),
  );

  const staffAndProjectFiltered = useMemo(() => {
    const allowedIds = new Set(
      applyProjectFilters(enrichedProjectFilterRows, projectFilter).map((p) => p.id),
    );
    return sourceRows.filter((r) => {
      const projectKey = r.project_id || r.id;
      if (!allowedIds.has(projectKey)) return false;
      return staffIdMatchesFilter(r.staff_id, staffFilter, staffDirectory);
    });
  }, [sourceRows, enrichedProjectFilterRows, projectFilter, staffFilter, staffDirectory]);

  const windowRows = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    return staffAndProjectFiltered.filter((r) => {
      if (!r.signed_date) return false;
      const t = new Date(r.signed_date).getTime();
      return !isNaN(t) && t >= fromMs && t <= toMs;
    });
  }, [staffAndProjectFiltered, window]);

  const prevYearRows = useMemo(() => {
    if (!window.from || !window.to) return [] as SalesTrendBVRow[];
    const fromMs = shiftYears(window.from, -1).getTime();
    const toMs = shiftYears(window.to, -1).getTime();
    return staffAndProjectFiltered.filter((r) => {
      if (!r.signed_date) return false;
      const t = new Date(r.signed_date).getTime();
      return !isNaN(t) && t >= fromMs && t <= toMs;
    });
  }, [staffAndProjectFiltered, window]);

  // ─── HEADLINE TOTALS (Shared L2 / Shared L3) ─────────────
  const { l2, l3, projectCount, items } = useMemo(() => {
    const statusFilter = projectFilter.status;
    let estTotal = 0;
    let actTotal = 0;
    const countedProjects = new Set<string>();
    const itemsEst: BreakdownItem[] = [];
    const itemsAct: BreakdownItem[] = [];
    const itemsCount: BreakdownItem[] = [];

    for (const r of windowRows) {
      const rule = getEffectiveStatusRule(r.project_status, statusFilter);
      const name = r.project_name || r.project_code || "(未命名)";
      const sub = r.project_code || undefined;
      const href = projectHref(r.project_id, r.source);
      const projectKey = r.project_id || r.id;

      if (rule.countMoney) {
        const est = Number(r.shared_estimated_gp) || 0;
        const act = Number(r.shared_actual_gp) || 0;
        estTotal += est;
        actTotal += act;
        itemsEst.push({ name, sub, value: est, href });
        itemsAct.push({ name, sub, value: act, href });
      }
      if (rule.countNumber && !countedProjects.has(projectKey)) {
        countedProjects.add(projectKey);
        itemsCount.push({ name, sub, href });
      }
    }

    return {
      l2: { sharedGp: estTotal },
      l3: { sharedGp: actTotal },
      projectCount: countedProjects.size,
      items: { est: itemsEst, act: itemsAct, count: itemsCount },
    };
  }, [windowRows, projectFilter.status]);

  const avgSharedEst =
    items.est.length > 0 ? l2.sharedGp / items.est.length : 0;
  const variance = l3.sharedGp - l2.sharedGp;

  // ─── SHARED GP + PROJECT COUNT BY MONTH (+ YoY) ───────────
  // Both charts share the same signed-date buckets. Money uses 計錢;
  // project count uses 計隻數 and distinct project_id from project_bv
  // (handler share — not main PM).
  const { chartData, countChartData, showPrevYear } = useMemo(() => {
    const statusFilter = projectFilter.status;
    const { fromBound, toBound, showPrevYear } = resolveChartBounds(window, windowRows);
    const { buckets, keyOf } = buildTimeBuckets(fromBound, toBound);

    const gpByKey = new Map<string, Record<string, number | string>>();
    const countByKey = new Map<string, Record<string, number | string>>();
    const chartData = buckets.map((b) => {
      const gp: Record<string, number | string> = {
        month: b.label,
        sharedEst: 0,
        sharedAct: 0,
        prevYear: 0,
      };
      const count: Record<string, number | string> = {
        month: b.label,
        projectCount: 0,
        prevYear: 0,
      };
      gpByKey.set(b.key, gp);
      countByKey.set(b.key, count);
      return gp;
    });
    const countChartData = buckets.map((b) => countByKey.get(b.key)!);

    // Distinct project keys per bucket (current / prev-year) so multi-handler
    // duplicates on the same project don't inflate the count for one staff.
    const seenCount = new Map<string, Set<string>>();
    const seenPrevCount = new Map<string, Set<string>>();

    for (const r of windowRows) {
      if (!r.signed_date) continue;
      const d = new Date(r.signed_date);
      if (isNaN(d.getTime())) continue;
      const bKey = keyOf(d);
      const rule = getEffectiveStatusRule(r.project_status, statusFilter);

      if (rule.countMoney) {
        const gpRow = gpByKey.get(bKey);
        if (gpRow) {
          gpRow.sharedEst =
            (gpRow.sharedEst as number) + (Number(r.shared_estimated_gp) || 0);
          gpRow.sharedAct =
            (gpRow.sharedAct as number) + (Number(r.shared_actual_gp) || 0);
        }
      }

      if (rule.countNumber) {
        const countRow = countByKey.get(bKey);
        if (countRow) {
          const projectKey = r.project_id || r.id;
          let set = seenCount.get(bKey);
          if (!set) {
            set = new Set();
            seenCount.set(bKey, set);
          }
          if (!set.has(projectKey)) {
            set.add(projectKey);
            countRow.projectCount = (countRow.projectCount as number) + 1;
          }
        }
      }
    }

    if (showPrevYear) {
      for (const r of prevYearRows) {
        if (!r.signed_date) continue;
        const d = new Date(r.signed_date);
        if (isNaN(d.getTime())) continue;
        const aligned = shiftYears(d, 1);
        const bKey = keyOf(aligned);
        const rule = getEffectiveStatusRule(r.project_status, statusFilter);

        if (rule.countMoney) {
          const gpRow = gpByKey.get(bKey);
          if (gpRow) {
            gpRow.prevYear =
              (gpRow.prevYear as number) + (Number(r.shared_estimated_gp) || 0);
          }
        }

        if (rule.countNumber) {
          const countRow = countByKey.get(bKey);
          if (countRow) {
            const projectKey = r.project_id || r.id;
            let set = seenPrevCount.get(bKey);
            if (!set) {
              set = new Set();
              seenPrevCount.set(bKey, set);
            }
            if (!set.has(projectKey)) {
              set.add(projectKey);
              countRow.prevYear = (countRow.prevYear as number) + 1;
            }
          }
        }
      }
    }

    return { chartData, countChartData, showPrevYear };
  }, [windowRows, prevYearRows, window, projectFilter.status]);

  const moneyTick = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return String(v);
  };

  // Recharts' default "nice" ticks pad below 0 when min is 0 and max is large
  // (e.g. 0…1.1M → ticks at −350K / 0 / 350K / …). Only open the floor when
  // the series actually contain negatives.
  const yDomain = useMemo((): [number, "auto"] => {
    let min = 0;
    for (const row of chartData) {
      for (const [k, v] of Object.entries(row)) {
        if (k === "month" || typeof v !== "number") continue;
        if (v < min) min = v;
      }
    }
    return [min < 0 ? min : 0, "auto"];
  }, [chartData]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Shared GP趨勢{" "}
          <span className="text-base font-medium text-gray-500">Shared GP Trend</span>
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          From {fmtDate(window.from)} to {fmtDate(window.to)}
        </p>
      </div>

      <ReportFilterStack
        projectRows={enrichedProjectFilterRows}
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
          <div>
            <h3 className="text-sm font-semibold text-gray-700 underline underline-offset-4 decoration-gray-300 mb-3">
              Signed Shared GP (L2)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                label="Total Shared Estimated GP"
                value={formatMoney2(l2.sharedGp)}
                accent="#f59e0b"
                hover={{
                  title: "L2 · Shared Estimated GP",
                  formula: "project_bv.shared_estimated_gp 加總（計錢）",
                  items: items.est,
                  formatValue: formatMoney2,
                  total: l2.sharedGp,
                  source: "shared_l2",
                }}
              />
              <MetricCard
                label="Projects"
                value={String(projectCount)}
                accent="#64748b"
                hover={{
                  title: "Projects",
                  formula: "計隻數 — 狀態規則下的項目數",
                  items: items.count,
                  total: projectCount,
                  isCount: true,
                }}
              />
              <MetricCard
                label="Avg Shared Estimated GP"
                value={formatMoney2(avgSharedEst)}
                accent="#a855f7"
                hover={{
                  title: "Avg Shared Estimated GP",
                  formula: `總 Shared Est GP ${formatMoney2(l2.sharedGp)} ÷ ${items.est.length} 筆 BV`,
                  items: items.est,
                  formatValue: formatMoney2,
                  total: l2.sharedGp,
                  source: "shared_l2",
                }}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 underline underline-offset-4 decoration-gray-300 mb-3">
              Dynamic Shared GP (L3)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                label="Total Shared Actual GP"
                value={formatMoney2(l3.sharedGp)}
                accent="#f97316"
                hover={{
                  title: "L3 · Shared Actual GP",
                  formula: "project_bv.shared_actual_gp 加總（計錢）",
                  items: items.act,
                  formatValue: formatMoney2,
                  total: l3.sharedGp,
                  source: "shared_l3",
                }}
              />
              <MetricCard
                label="Variance (L3 − L2)"
                value={formatMoney2(variance)}
                accent={variance >= 0 ? "#22c55e" : "#ef4444"}
                hover={{
                  title: "Shared GP Variance",
                  formula: `實際 ${formatMoney2(l3.sharedGp)} − 估算 ${formatMoney2(l2.sharedGp)}`,
                  items: items.act,
                  formatValue: formatMoney2,
                  total: variance,
                  source: "shared_l3",
                }}
              />
              <MetricCard
                label="Realization %"
                value={fmtPct(l3.sharedGp, l2.sharedGp)}
                accent="#6366f1"
                hover={{
                  title: "Shared GP Realization",
                  formula: `實際 ${formatMoney2(l3.sharedGp)} ÷ 估算 ${formatMoney2(l2.sharedGp)}`,
                  items: items.act,
                  formatValue: formatMoney2,
                  total: l3.sharedGp,
                  source: "shared_l3",
                }}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 underline underline-offset-4 decoration-gray-300 mb-3">
              Shared GP Trend
            </h3>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <ResponsiveContainer width="100%" height={380}>
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 16, bottom: 4, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={yDomain}
                    tickFormatter={moneyTick}
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => formatMoney2(value)}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="sharedEst"
                    name="Shared Estimated GP"
                    stroke={EST_LINE_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3, fill: EST_LINE_COLOR, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sharedAct"
                    name="Shared Actual GP"
                    stroke={ACTUAL_LINE_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3, fill: ACTUAL_LINE_COLOR, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                  {showPrevYear && (
                    <Line
                      type="monotone"
                      dataKey="prevYear"
                      name="Previous Year (Est)"
                      stroke={PREV_YEAR_COLOR}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      strokeOpacity={0.85}
                      dot={{ r: 2.5, fill: PREV_YEAR_COLOR, strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 underline underline-offset-4 decoration-gray-300 mb-3">
              Project Count Trend
            </h3>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <ResponsiveContainer width="100%" height={340}>
                <LineChart
                  data={countChartData}
                  margin={{ top: 10, right: 16, bottom: 4, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, "auto"]}
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
                  <Line
                    type="monotone"
                    dataKey="projectCount"
                    name="Project Count"
                    stroke={COUNT_LINE_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3, fill: COUNT_LINE_COLOR, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <p className="text-sm text-gray-400 text-center">
            Note: Shared GP and project counts are based on project_bv rows
            (handler share) whose project signed date falls in the selected
            period — not the project&apos;s main PM. Status rules (計錢 / 計隻數)
            apply when the status filter is All.
          </p>
        </>
      )}
    </div>
  );
}
