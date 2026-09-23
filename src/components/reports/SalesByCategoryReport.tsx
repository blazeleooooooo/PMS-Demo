"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchSalesByCategory,
  type SalesByCategoryData,
  type CategoryProject,
} from "@/lib/data-service";
import { getEffectiveStatusRule } from "@/lib/project-status-rules";
import MetricHoverCard, { type BreakdownItem, projectHref } from "@/components/reports/MetricHoverCard";

// ─── DATE PRESETS — shared across all /business-reports ───────
import {
  resolveRange,
  rangeBounds,
  fmtRangeDate as fmtDate,
} from "@/lib/report-date-range";
import { useReportRange, filterBySources, sourceEnabled } from "@/components/reports/ReportDateRangeContext";
import ReportFilterStack from "@/components/reports/ReportFilterStack";
import ReportDateRangeNote from "@/components/reports/ReportDateRangeNote";
import {
  applyProjectFilters,
  type ProjectFilterFields,
} from "@/components/reports/ProjectFilterBar";
import { staffIdMatchesFilter } from "@/components/reports/StaffFilterBar";
import type { MoneyBasis } from "@/components/reports/MoneyBasisToggle";
import { useAlignedReportFilters } from "@/hooks/use-aligned-report-filters";
import {
  projectFilterNeedsExtras,
  useEnrichedProjectFilterRows,
} from "@/hooks/use-project-filter-extras";
import { useSingleSourceReport } from "@/components/reports/use-single-source-report";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import type { StaffDirectoryRow } from "@/lib/data-service";

// ─── PIE CHART CONSTANTS ──────────────────────────────────────
// Slices smaller than this share of the total fold into a single "Others"
// slice so the chart stays readable.
const OTHERS_THRESHOLD = 0.03; // 3%
const PIE_COLORS = [
  "#3b82f6", "#14b8a6", "#f59e0b", "#8b5cf6", "#ec4899",
  "#22c55e", "#ef4444", "#06b6d4", "#eab308", "#a855f7",
];
const OTHERS_COLOR = "#9ca3af";

// ─── HELPERS ──────────────────────────────────────────────────
function fmtPct(val: number): string {
  if (!val || isNaN(val)) return "0.00%";
  return `${val.toFixed(2)}%`;
}

// ─── CATEGORY AGGREGATED ROW ──────────────────────────────────
interface CategoryRow {
  id: string;
  name: string;
  count: number;
  revenue: number;
  cost: number;
  gross_profit: number;
  margin: number;
  // Contributing projects per metric, for hover breakdowns.
  items_count: BreakdownItem[];
  items_revenue: BreakdownItem[];
  items_cost: BreakdownItem[];
  items_gp: BreakdownItem[];
}

type SortField = "name" | "count" | "revenue" | "cost" | "gross_profit" | "margin";

export default function SalesByCategoryReport() {
  const { formatMoney2 } = useFinancialFormat();
  const moneyOpts = { fallback: "N/A" } as const;
  const [data, setData] = useState<SalesByCategoryData>({
    projects: [],
    projectTypes: [],
    serviceTypes: [],
  });
  const [loading, setLoading] = useState(true);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const { range: selectedPreset, custom, sources } = useReportRange();
  useSingleSourceReport();
  const {
    projectFilter,
    setProjectFilter,
    moneyBasis,
    setMoneyBasis,
    staffFilter,
    setStaffFilter,
    staffLocks,
    isSuperAdmin,
    defaultStaffFilter,
  } = useAlignedReportFilters("business");

  useEffect(() => {
    fetchSalesByCategory().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const window = useMemo(
    () => resolveRange(selectedPreset, new Date(), custom),
    [selectedPreset, custom]
  );

  const toProjectFields = (p: CategoryProject): ProjectFilterFields => ({
    id: p.id,
    status: p.status,
    cost_centre_bu_code: p.cost_centre_bu_code,
    service_type_name: p.service_type_name,
    service_type_id: p.service_type_id,
    project_type_name: p.project_types[0]?.name ?? null,
    project_type_id: p.project_types[0]?.id ?? null,
    financial_year_name: p.financial_year_name,
    n_financial_year_id: p.n_financial_year_id,
    est_income: p.est_income,
    project_size: p.project_size,
    project_name: p.project_name,
    project_code: p.project_code,
    pm_name: p.pm_name,
    filter_project_id: p.id,
  });

  const projectFilterRows: ProjectFilterFields[] = useMemo(
    () => data.projects.map(toProjectFields),
    [data.projects],
  );
  const enrichedProjectFilterRows = useEnrichedProjectFilterRows(
    projectFilterRows,
    projectFilterNeedsExtras(projectFilter),
  );

  // ── Filter projects by BWA/BWF toggle + signed_date window + project/staff ──
  const filtered = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    const byDate = filterBySources(data.projects, sources).filter((p) => {
      if (!staffIdMatchesFilter(p.pm_id, staffFilter, staffDirectory)) return false;
      if (!p.signed_date) return false;
      const t = new Date(p.signed_date).getTime();
      return !isNaN(t) && t >= fromMs && t <= toMs;
    });
    const allowedIds = new Set(
      applyProjectFilters(enrichedProjectFilterRows, projectFilter).map(
        (p) => p.id,
      ),
    );
    return byDate.filter((p) => allowedIds.has(p.id));
  }, [data.projects, window, sources, projectFilter, enrichedProjectFilterRows, staffFilter, staffDirectory]);

  // Category lists limited to the enabled sources (hides e.g. the BWF bucket
  // and BWF service types entirely when BWF is toggled off).
  const visibleProjectTypes = useMemo(
    () => data.projectTypes.filter((t) => sourceEnabled(t.source, sources)),
    [data.projectTypes, sources],
  );
  const visibleServiceTypes = useMemo(
    () => data.serviceTypes.filter((t) => sourceEnabled(t.source, sources)),
    [data.serviceTypes, sources],
  );

  const isBwfMode = sources.bwf && !sources.bwa;
  const primaryCategoryLabel = isBwfMode ? "Client Type" : "Project Type";
  const primaryCategoryTitle = isBwfMode ? "By Client Type" : "By Project Type";
  const primaryPieTitle = isBwfMode ? "Revenue by Client Type" : "Revenue by Project Type";

  // ── Build a category table for a given dimension ──
  // Project type is MULTI-SELECT: a project is attributed to EACH of its types,
  // so a project with N types contributes to N rows (and the column totals can
  // exceed the project count — expected for a multi-select breakdown). Service
  // type remains single-select.
  function buildRows(
    dimension: "project" | "service",
    categories: { id: string; name: string }[]
  ): CategoryRow[] {
    // Seed every category (incl. empty) so the table mirrors the legacy screen.
    const groups = new Map<string, CategoryRow>();
    for (const c of categories) {
      groups.set(c.id, {
        id: c.id,
        name: c.name,
        count: 0,
        revenue: 0,
        cost: 0,
        gross_profit: 0,
        margin: 0,
        items_count: [],
        items_revenue: [],
        items_cost: [],
        items_gp: [],
      });
    }
    const UNCATEGORIZED = "__none__";

    const ensureRow = (id: string, name: string | null): CategoryRow => {
      let row = groups.get(id);
      if (!row) {
        row = {
          id,
          name: name || "未分類 Uncategorized",
          count: 0,
          revenue: 0,
          cost: 0,
          gross_profit: 0,
          margin: 0,
          items_count: [],
          items_revenue: [],
          items_cost: [],
          items_gp: [],
        };
        groups.set(id, row);
      }
      return row;
    };

    for (const p of filtered) {
      // Resolve the category buckets this project contributes to. For project
      // type that's every linked type (multi-select); for service type it's the
      // single value. Uncategorized projects fall into one "未分類" bucket.
      const buckets: { id: string; name: string | null }[] =
        dimension === "project"
          ? p.project_types.length > 0
            ? p.project_types.map((t) => ({ id: t.id, name: t.name }))
            : [{ id: UNCATEGORIZED, name: null }]
          : [{ id: p.service_type_id || UNCATEGORIZED, name: p.service_type_name }];

      // Status decides money (計錢) vs count (計隻數) when filter is "all".
      const rule = getEffectiveStatusRule(p.status, projectFilter.status);
      const revenue = moneyBasis === "l2" ? p.est_income || 0 : p.actual_income;
      const cost = moneyBasis === "l2" ? p.est_expense || 0 : p.actual_expense;
      const projName = p.project_name || p.project_code || "(未命名)";
      const sub = [p.project_code, p.status].filter(Boolean).join(" · ") || undefined;
      const href = projectHref(p.id, p.source);

      for (const bucket of buckets) {
        const row = ensureRow(bucket.id, bucket.name);
        if (rule.countNumber) {
          row.count += 1;
          row.items_count.push({ name: projName, sub, href });
        }
        if (rule.countMoney) {
          row.revenue += revenue;
          row.items_revenue.push({ name: projName, value: revenue, sub, href });
          row.cost += cost;
          row.items_cost.push({ name: projName, value: cost, sub, href });
          row.gross_profit += revenue - cost;
          row.items_gp.push({ name: projName, value: revenue - cost, sub, href });
        }
      }
    }

    for (const row of groups.values()) {
      row.margin = row.revenue > 0 ? (row.gross_profit / row.revenue) * 100 : 0;
    }
    return Array.from(groups.values());
  }

  const projectTypeRows = useMemo(
    () => buildRows("project", visibleProjectTypes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, visibleProjectTypes, moneyBasis, projectFilter.status]
  );
  const serviceTypeRows = useMemo(
    () => buildRows("service", visibleServiceTypes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, visibleServiceTypes, moneyBasis, projectFilter.status]
  );

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          按類別銷售分析 Sales Analysis by Category
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">
          From {fmtDate(window.from)} to {fmtDate(window.to)}
        </p>
      </div>

      <ReportFilterStack
        showDate
        sourceMode="single"
        showL2L3
        moneyBasis={moneyBasis}
        onMoneyBasisChange={setMoneyBasis}
        showProject
        projectRows={enrichedProjectFilterRows}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        showStaff
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        staffLocks={staffLocks}
        staffClearTo={defaultStaffFilter}
        isSuperAdmin={isSuperAdmin}
        onStaffDirectoryLoaded={setStaffDirectory}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-bw-blue" />
          <span className="ml-3 text-gray-500 text-sm">載入報表資料...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ─── PIE CHARTS (revenue share by category) ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CategoryPie
              title={primaryPieTitle}
              rows={projectTypeRows}
              formatMoney={(v) => formatMoney2(v, moneyOpts)}
            />
            <CategoryPie
              title="Revenue by Service Type"
              rows={serviceTypeRows}
              formatMoney={(v) => formatMoney2(v, moneyOpts)}
            />
          </div>

          <CategoryTable
            title={primaryCategoryTitle}
            firstColLabel={primaryCategoryLabel}
            rows={projectTypeRows}
            source={moneyBasis}
            formatMoney={(v) => formatMoney2(v, moneyOpts)}
            formatGrossProfit={(v) => formatMoney2(v, { fallback: "$0.00" })}
          />
          <CategoryTable
            title="By Service Type"
            firstColLabel="Service Type"
            rows={serviceTypeRows}
            source={moneyBasis}
            formatMoney={(v) => formatMoney2(v, moneyOpts)}
            formatGrossProfit={(v) => formatMoney2(v, { fallback: "$0.00" })}
          />
        </div>
      )}

      <ReportDateRangeNote>
        Note: This summary is based on orders with a project signed date in
        the selected period.
      </ReportDateRangeNote>
    </div>
  );
}

// ─── REVENUE PIE CHART ────────────────────────────────────────
// Charts each category's share of total revenue. Categories below
// OTHERS_THRESHOLD of the total (and zero-revenue ones) collapse into a single
// "Others" slice so the chart stays clean.
interface PieDatum {
  name: string;
  value: number;
  color: string;
}

function CategoryPie({
  title,
  rows,
  formatMoney,
}: {
  title: string;
  rows: CategoryRow[];
  formatMoney: (v: number) => string;
}) {
  const slices = useMemo<PieDatum[]>(() => {
    const positive = rows.filter((r) => r.revenue > 0);
    const total = positive.reduce((sum, r) => sum + r.revenue, 0);
    if (total <= 0) return [];

    const big: CategoryRow[] = [];
    let othersTotal = 0;
    for (const r of positive) {
      if (r.revenue / total >= OTHERS_THRESHOLD) big.push(r);
      else othersTotal += r.revenue;
    }
    // Largest first so colours read consistently with the legend.
    big.sort((a, b) => b.revenue - a.revenue);

    const data: PieDatum[] = big.map((r, i) => ({
      name: r.name,
      value: r.revenue,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
    if (othersTotal > 0) {
      data.push({ name: "其他 Others", value: othersTotal, color: OTHERS_COLOR });
    }
    return data;
  }, [rows]);

  const total = slices.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      <h3 className="text-base font-semibold text-gray-800 mb-2">{title}</h3>
      {slices.length === 0 ? (
        <div className="flex items-center justify-center h-[280px] text-sm text-gray-400">
          此期間沒有收入資料
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={1}
            >
              {slices.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [
                `${formatMoney(value)} (${fmtPct((value / total) * 100)})`,
                "收入 Revenue",
              ]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value: string) => (
                <span className="text-gray-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── REUSABLE CATEGORY TABLE ──────────────────────────────────
function CategoryTable({
  title,
  firstColLabel,
  rows,
  source,
  formatMoney,
  formatGrossProfit,
}: {
  title: string;
  firstColLabel: string;
  rows: CategoryRow[];
  source: MoneyBasis;
  formatMoney: (v: number) => string;
  formatGrossProfit: (v: number) => string;
}) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [rows, sortField, sortDir]);

  const totals = useMemo(() => {
    const t = { count: 0, revenue: 0, cost: 0, gross_profit: 0 };
    for (const r of rows) {
      t.count += r.count;
      t.revenue += r.revenue;
      t.cost += r.cost;
      t.gross_profit += r.gross_profit;
    }
    return t;
  }, [rows]);
  const totalsMargin = totals.revenue > 0 ? (totals.gross_profit / totals.revenue) * 100 : 0;

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
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
        className={`text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap ${
          right ? "text-right" : ""
        }`}
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
    <div>
      <h3 className="text-base font-semibold text-gray-800 mb-2">{title}</h3>
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <Th field="name">{firstColLabel}</Th>
                <Th field="count" right>
                  Number of Projects
                </Th>
                <Th field="revenue" right>
                  Total Revenue
                </Th>
                <Th field="cost" right>
                  Total Cost
                </Th>
                <Th field="gross_profit" right>
                  Gross Profit
                </Th>
                <Th field="margin" right>
                  Margin
                </Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-gray-50/80 border-b border-gray-100"
                >
                  <TableCell className="text-sm font-medium text-gray-800 whitespace-nowrap">
                    {row.name}
                  </TableCell>
                  <TableCell className="text-sm text-right text-gray-700">
                    <MetricHoverCard
                      title={`${row.name} · 項目數`}
                      formula="狀態計入「計隻數」的項目"
                      items={row.items_count}
                      isCount
                    >
                      {row.count}
                    </MetricHoverCard>
                  </TableCell>
                  <TableCell className="text-sm text-right font-mono text-gray-800 whitespace-nowrap">
                    <MetricHoverCard
                      title={`${row.name} · 總收入`}
                      formula="收入加總"
                      source={source}
                      items={row.items_revenue}
                      formatValue={formatMoney}
                      total={row.revenue}
                    >
                      {formatMoney(row.revenue)}
                    </MetricHoverCard>
                  </TableCell>
                  <TableCell
                    className={`text-sm text-right font-mono whitespace-nowrap ${
                      row.cost ? "text-red-600" : "text-gray-300"
                    }`}
                  >
                    <MetricHoverCard
                      title={`${row.name} · 總成本`}
                      formula="支出加總"
                      source={source}
                      items={row.items_cost}
                      formatValue={formatMoney}
                      total={row.cost}
                    >
                      {formatMoney(row.cost)}
                    </MetricHoverCard>
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
                      title={`${row.name} · 毛利`}
                      formula="每個項目 = 收入 − 成本"
                      source={source}
                      items={row.items_gp}
                      formatValue={formatMoney}
                      total={row.gross_profit}
                    >
                      {formatGrossProfit(row.gross_profit)}
                    </MetricHoverCard>
                  </TableCell>
                  <TableCell className="text-sm text-right font-mono text-emerald-600 whitespace-nowrap">
                    <MetricHoverCard
                      title={`${row.name} · 毛利率`}
                      formula={`毛利 ${formatGrossProfit(row.gross_profit)} ÷ 收入 ${formatMoney(row.revenue)}`}
                      source={source}
                      items={row.items_gp}
                      formatValue={formatMoney}
                      total={row.gross_profit}
                    >
                      {fmtPct(row.margin)}
                    </MetricHoverCard>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <TableRow className="bg-gray-100/70 border-t-2 border-gray-200 font-semibold">
                <TableCell className="text-sm text-gray-800 whitespace-nowrap">
                  總計 Total ({rows.length})
                </TableCell>
                <TableCell className="text-sm text-right text-gray-800">
                  {totals.count}
                </TableCell>
                <TableCell className="text-sm text-right font-mono text-gray-900 whitespace-nowrap">
                  {formatMoney(totals.revenue)}
                </TableCell>
                <TableCell className="text-sm text-right font-mono text-red-600 whitespace-nowrap">
                  {formatMoney(totals.cost)}
                </TableCell>
                <TableCell className="text-sm text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                  {formatMoney(totals.gross_profit)}
                </TableCell>
                <TableCell className="text-sm text-right font-mono text-gray-600 whitespace-nowrap">
                  {fmtPct(totalsMargin)}
                </TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </div>
      </div>
    </div>
  );
}
