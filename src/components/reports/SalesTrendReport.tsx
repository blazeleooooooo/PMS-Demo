"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchSalesTrendBV,
  type SalesTrendBVRow,
  type StaffDirectoryRow,
} from "@/lib/data-service";
import { getEffectiveStatusRule } from "@/lib/project-status-rules";
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
import MetricHoverCard, { type BreakdownItem, type MetricSource, projectHref } from "@/components/reports/MetricHoverCard";
import { useFinancialFormat } from "@/hooks/use-financial-format";

// ─── DATE-AGE BUCKETS (based on project signed date → today) ──
interface Bucket {
  key: string;
  label: string;
  min: number; // inclusive lower bound in days
  max: number | null; // exclusive upper bound; null = no upper bound
}

const BUCKETS: Bucket[] = [
  { key: "lt30", label: "<30 Days", min: 0, max: 31 },
  { key: "31_60", label: "31-60 Days", min: 31, max: 61 },
  { key: "61_90", label: "61-90 Days", min: 61, max: 91 },
  { key: "90_120", label: "90-120 Days", min: 91, max: 121 },
  { key: "121_150", label: "121-150 Days", min: 121, max: 151 },
  { key: "151_180", label: "151-180 Days", min: 151, max: 181 },
];

// ─── DIMENSIONS (what each row represents) ────────────────────
type Dimension = "staff" | "team" | "cost_centre";
const DIMENSION_OPTIONS: { value: Dimension; label: string }[] = [
  { value: "staff", label: "員工 Staff" },
  { value: "team", label: "團隊 Team" },
  { value: "cost_centre", label: "成本中心 Cost Centre" },
];

// ─── HELPERS ──────────────────────────────────────────────────
function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const signed = new Date(dateStr);
  if (isNaN(signed.getTime())) return null;
  const ms = Date.now() - signed.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function bucketForDays(days: number | null): Bucket | null {
  if (days == null) return null;
  for (const b of BUCKETS) {
    if (days >= b.min && (b.max == null || days < b.max)) return b;
  }
  return null; // older than 180 days — outside the report window
}

function trendRowProjectFields(r: SalesTrendBVRow): ProjectFilterFields {
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

interface DimensionRow {
  key: string;
  label: string;
  subLabel: string | null;
  // bucketKey -> summed shared GP
  buckets: Record<string, number>;
  // bucketKey -> contributing projects, for hover breakdown
  bucketItems: Record<string, BreakdownItem[]>;
  // all contributing projects (for the row total)
  totalItems: BreakdownItem[];
  total: number;
}

export default function SalesTrendReport() {
  const { formatMoney } = useFinancialFormat();
  const [rows, setRows] = useState<SalesTrendBVRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const { sources } = useReportRange();
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

  // Controls
  const [dimension, setDimension] = useState<Dimension>("staff");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBucket, setSortBucket] = useState<string>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const bvRows = await fetchSalesTrendBV();
      setRows(bvRows);
      setLoading(false);
    }
    load();
  }, []);

  const projectFilterRows = useMemo(
    () => rows.map(trendRowProjectFields),
    [rows],
  );
  const enrichedProjectFilterRows = useEnrichedProjectFilterRows(
    projectFilterRows,
    projectFilterNeedsExtras(projectFilter),
  );

  // ─── AGGREGATE INTO DIMENSION × BUCKET MATRIX ──────────────
  const dimensionRows = useMemo(() => {
    const groups = new Map<string, DimensionRow>();
    const gpType = moneyBasis === "l2" ? "estimated" : "actual";

    const sourceRows = filterBySources(rows, sources);
    const allowedProjectIds = new Set(
      applyProjectFilters(enrichedProjectFilterRows, projectFilter).map((p) => p.id),
    );

    for (const r of sourceRows) {
      const projectKey = r.project_id || r.id;
      if (!allowedProjectIds.has(projectKey)) continue;
      if (!staffIdMatchesFilter(r.staff_id, staffFilter, staffDirectory)) continue;

      // Only rows whose signed date falls within the 0–180 day window count.
      const bucket = bucketForDays(daysSince(r.signed_date));
      if (!bucket) continue;

      // Shared GP is a money figure — 計錢 when status filter is "all".
      if (!getEffectiveStatusRule(r.project_status, projectFilter.status).countMoney) continue;

      // Resolve the grouping key + labels for the chosen dimension.
      let key: string;
      let label: string;
      let subLabel: string | null = null;
      if (dimension === "staff") {
        key = r.staff_id || "unassigned";
        label = r.staff_name || "未分配 Unassigned";
      } else if (dimension === "team") {
        key = r.team_id || "unassigned";
        label = r.team_name || "未分配 Unassigned";
      } else {
        key = r.cost_centre_id || "unassigned";
        label = r.cost_centre_name || "未分配 Unassigned";
        subLabel = r.cost_centre_bu_code || null;
      }

      const value =
        (gpType === "estimated" ? r.shared_estimated_gp : r.shared_actual_gp) ||
        0;

      let group = groups.get(key);
      if (!group) {
        group = { key, label, subLabel, buckets: {}, bucketItems: {}, totalItems: [], total: 0 };
        groups.set(key, group);
      }
      group.buckets[bucket.key] = (group.buckets[bucket.key] || 0) + value;
      group.total += value;

      // Spell out the share calculation for the hover breakdown:
      //   shared GP = project GP × ratio%
      const projectGp =
        (gpType === "estimated" ? r.estimated_gp : r.actual_gp) ?? 0;
      const ratio = r.ratio ?? 0;
      const gpLabel = gpType === "estimated" ? "預估毛利" : "實際毛利";
      const money = (v: number) => formatMoney(v, { showZero: true });
      const expected = (projectGp * ratio) / 100;
      let detail = `${gpLabel} ${money(projectGp)} × ${ratio}% = ${money(expected)}`;
      if (Math.round(expected) !== Math.round(value)) {
        detail += `（已存 ${money(value)}）`;
      }

      const item: BreakdownItem = {
        name: r.project_name || r.project_code || "(未命名)",
        value,
        sub: r.project_code || undefined,
        detail,
        href: projectHref(r.project_id, r.source),
      };
      (group.bucketItems[bucket.key] ||= []).push(item);
      group.totalItems.push(item);
    }

    return Array.from(groups.values());
  }, [
    rows,
    sources,
    dimension,
    moneyBasis,
    projectFilter,
    enrichedProjectFilterRows,
    staffFilter,
    staffDirectory,
    formatMoney,
  ]);

  // ─── SEARCH + SORT ─────────────────────────────────────────
  const visibleRows = useMemo(() => {
    let result = dimensionRows;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          (r.subLabel || "").toLowerCase().includes(q)
      );
    }

    const sorted = [...result].sort((a, b) => {
      const aVal = sortBucket === "total" ? a.total : a.buckets[sortBucket] || 0;
      const bVal = sortBucket === "total" ? b.total : b.buckets[sortBucket] || 0;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [dimensionRows, searchQuery, sortBucket, sortDir]);

  // ─── COLUMN TOTALS (footer) ────────────────────────────────
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = { total: 0 };
    for (const b of BUCKETS) totals[b.key] = 0;
    for (const r of visibleRows) {
      totals.total += r.total;
      for (const b of BUCKETS) totals[b.key] += r.buckets[b.key] || 0;
    }
    return totals;
  }, [visibleRows]);

  function handleSort(bucketKey: string) {
    if (sortBucket === bucketKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBucket(bucketKey);
      setSortDir("desc");
    }
  }

  function SortIcon({ bucketKey }: { bucketKey: string }) {
    if (sortBucket !== bucketKey)
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1 text-bw-blue inline" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 text-bw-blue inline" />
    );
  }

  const dimensionLabel =
    DIMENSION_OPTIONS.find((d) => d.value === dimension)?.label || "";

  // estimated → Shared L2; actual → L3 analogue
  const sharedSource: MetricSource = moneyBasis === "l2" ? "shared_l2" : "l3";
  const gpTypeLabel = moneyBasis === "l2" ? "預估" : "實際";
  const gpTypeEn = moneyBasis === "l2" ? "estimated" : "actual";

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          銷售趨勢報表 Sales Trend Report
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          按項目簽約日距今的天數分段，檢視分配至各
          {dimensionLabel.split(" ")[0]}的共享毛利。
        </p>
      </div>

      {/* ─── INFO ───────────────────────────────────── */}
      <div className="flex items-start gap-2 bg-blue-50/60 border border-blue-100 rounded-lg px-4 py-3 text-sm text-gray-600">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <span>
          每個分段代表項目<span className="font-medium">簽約日期</span>距今的天數。
          數值為該分段內所有項目分配給該{dimensionLabel.split(" ")[0]}的
          {gpTypeLabel}共享毛利 (shared {gpTypeEn} GP) 總和。簽約超過 180 天的項目不在此報表範圍內。
        </span>
      </div>

      {/* Age buckets replace the shared date-window bar; still show BWA/BWF + L2/L3 + Project/Staff. */}
      <ReportFilterStack
        showDate={false}
        showSourceToggle
        sourceMode="single"
        showL2L3
        moneyBasis={moneyBasis}
        onMoneyBasisChange={setMoneyBasis}
        projectRows={enrichedProjectFilterRows}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        staffLocks={staffLocks}
        staffClearTo={defaultStaffFilter}
        isSuperAdmin={isSuperAdmin}
        onStaffDirectoryLoaded={setStaffDirectory}
      />

      {/* ─── CONTROLS ───────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">分組依據</label>
          <Select
            value={dimension}
            onValueChange={(v) => setDimension(v as Dimension)}
          >
            <SelectTrigger className="h-9 text-sm w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIMENSION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-500">搜尋</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder={`搜尋${dimensionLabel.split(" ")[0]}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-white"
            />
          </div>
        </div>
      </div>

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
                  <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap min-w-[180px] sticky left-0 bg-gray-50/80 z-10">
                    {dimensionLabel}
                  </TableHead>
                  {BUCKETS.map((b) => (
                    <TableHead
                      key={b.key}
                      className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap text-right min-w-[110px]"
                      onClick={() => handleSort(b.key)}
                    >
                      <span className="flex items-center justify-end">
                        {b.label}
                        <SortIcon bucketKey={b.key} />
                      </span>
                    </TableHead>
                  ))}
                  <TableHead
                    className="text-xs font-semibold text-gray-700 cursor-pointer hover:text-bw-blue whitespace-nowrap text-right min-w-[120px] bg-gray-100/60"
                    onClick={() => handleSort("total")}
                  >
                    <span className="flex items-center justify-end">
                      總計 Total
                      <SortIcon bucketKey="total" />
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={BUCKETS.length + 2}
                      className="text-center text-gray-400 py-12 text-sm"
                    >
                      沒有符合條件的資料
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((r) => (
                    <TableRow key={r.key} className="hover:bg-gray-50/60">
                      <TableCell className="sticky left-0 bg-white z-10">
                        <div className="font-medium text-sm text-gray-900">
                          {r.label}
                        </div>
                        {r.subLabel && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {r.subLabel}
                          </div>
                        )}
                      </TableCell>
                      {BUCKETS.map((b) => {
                        const v = r.buckets[b.key] || 0;
                        return (
                          <TableCell
                            key={b.key}
                            className="text-right text-sm tabular-nums text-gray-700"
                          >
                            <MetricHoverCard
                              title={`${r.label} · ${b.label}`}
                              formula={`${gpTypeLabel}共享毛利加總（簽約日距今 ${b.label}）`}
                              source={sharedSource}
                              items={r.bucketItems[b.key] || []}
                              formatValue={(n) => formatMoney(n, { showZero: true })}
                              total={v}
                            >
                              {formatMoney(v, { showZero: true })}
                            </MetricHoverCard>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right text-sm tabular-nums font-semibold text-gray-900 bg-gray-50/40">
                        <MetricHoverCard
                          title={`${r.label} · 總計`}
                          formula={`${gpTypeLabel}共享毛利加總（所有分段）`}
                          source={sharedSource}
                          items={r.totalItems}
                          formatValue={(n) => formatMoney(n, { showZero: true })}
                          total={r.total}
                        >
                          {formatMoney(r.total, { showZero: true })}
                        </MetricHoverCard>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {visibleRows.length > 0 && (
                <tfoot>
                  <TableRow className="bg-gray-50/80 border-t">
                    <TableCell className="text-xs font-semibold text-gray-600 sticky left-0 bg-gray-50/80 z-10">
                      合計
                    </TableCell>
                    {BUCKETS.map((b) => (
                      <TableCell
                        key={b.key}
                        className="text-right text-xs font-semibold tabular-nums text-gray-700"
                      >
                        {formatMoney(columnTotals[b.key] || 0, { showZero: true })}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-xs font-bold tabular-nums text-gray-900 bg-gray-100/60">
                      {formatMoney(columnTotals.total || 0, { showZero: true })}
                    </TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
