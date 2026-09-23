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
  fetchBVPerformanceProjects,
  fetchStaffBVDeductions,
  type BVPerformanceProjectRow,
  type BVPerformanceDeductionRow,
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
import { countsExcludeMiniPP, excludePPLabel } from "@/lib/report-mini-pp";

/** Apply personal deduction percentage: result × (1 − pct/100). */
function afterDeduction(raw: number, deductionPct: number): number {
  if (!deductionPct) return raw;
  return raw * (1 - deductionPct / 100);
}

function deductionDetail(
  raw: number,
  deductionPct: number,
  formatValue: (v: number) => string,
): string | undefined {
  if (!deductionPct || !raw) return undefined;
  const adjusted = afterDeduction(raw, deductionPct);
  return `${formatValue(raw)} × (1 − ${deductionPct.toFixed(2)}% 個人扣減) = ${formatValue(adjusted)}`;
}

type DeductionMap = Map<string, Map<string, number>>;

function buildDeductionMap(rows: BVPerformanceDeductionRow[]): DeductionMap {
  const map: DeductionMap = new Map();
  for (const d of rows) {
    if (!map.has(d.staff_id)) map.set(d.staff_id, new Map());
    map.get(d.staff_id)!.set(d.n_financial_year_id, d.deduction_pct);
  }
  return map;
}

function lookupDeduction(map: DeductionMap, staffId: string | null, fyId: string | null): number {
  if (!staffId || !fyId) return 0;
  return map.get(staffId)?.get(fyId) ?? 0;
}

function bvAmount(row: BVPerformanceProjectRow, mode: "l2" | "l3"): number {
  return Number(mode === "l2" ? row.estimated_bv : row.actual_bv) || 0;
}

interface StaffRow {
  staff_id: string;
  staff_name: string;
  count_no_mini: number;
  count_all: number;
  total_bv_no_mini: number;
  total_bv_all: number;
  proj_count_no_mini: BreakdownItem[];
  proj_count_all: BreakdownItem[];
  proj_bv_no_mini: BreakdownItem[];
  proj_bv_all: BreakdownItem[];
  has_deduction: boolean;
}

type SortField =
  | "staff_name"
  | "count_no_mini"
  | "count_all"
  | "total_bv_no_mini"
  | "total_bv_all";

export default function BVPerformanceReport() {
  const { formatBV } = useFinancialFormat();
  const bvOpts = { fallback: "—" } as const;
  const formatCell = (v: number) => formatBV(v, bvOpts);

  const [projects, setProjects] = useState<BVPerformanceProjectRow[]>([]);
  const [deductionRows, setDeductionRows] = useState<BVPerformanceDeductionRow[]>([]);
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
  } = useAlignedReportFilters("business");
  /** PP / ❌ PP columns only when BWF is the active source. */
  const showPPColumns = sources.bwf && !sources.bwa;
  const EXCLUDE_PP_LABEL = excludePPLabel();
  const [sortField, setSortField] = useState<SortField>("total_bv_all");

  useEffect(() => {
    if (!showPPColumns && (sortField === "count_no_mini" || sortField === "total_bv_no_mini")) {
      setSortField("total_bv_all");
    }
  }, [showPPColumns, sortField]);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    Promise.all([fetchBVPerformanceProjects(), fetchStaffBVDeductions()]).then(
      ([projectData, deductions]) => {
        setProjects(projectData);
        setDeductionRows(deductions);
        setLoading(false);
      },
    );
  }, []);

  const deductionMap = useMemo(() => buildDeductionMap(deductionRows), [deductionRows]);

  const window = useMemo(
    () => resolveRange(selectedPreset, new Date(), custom),
    [selectedPreset, custom],
  );

  const sourceProjects = useMemo(() => filterBySources(projects, sources), [projects, sources]);
  const enrichedProjects = useEnrichedProjectFilterRows(
    sourceProjects,
    projectFilterNeedsExtras(projectFilter),
  );

  const filteredProjects = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    return applyProjectFilters(enrichedProjects, projectFilter).filter((p) => {
      if (!staffIdMatchesFilter(p.staff_id, staffFilter, staffDirectory)) return false;
      if (!p.signed_date) return false;
      const t = new Date(p.signed_date).getTime();
      return !isNaN(t) && t >= fromMs && t <= toMs;
    });
  }, [enrichedProjects, window, projectFilter, staffFilter, staffDirectory]);

  const dateRangeLabel = useMemo(
    () => `From ${fmtRangeDate(window.from)} to ${fmtRangeDate(window.to)}`,
    [window],
  );

  const metricSource: MetricSource = moneyBasis === "l2" ? "bv_l2" : "bv_l3";
  const modeLabel = moneyBasis === "l2" ? "L2 已簽 Estimated BV" : "L3 實際 Actual BV";

  const staffRows = useMemo(() => {
    const groups = new Map<string, StaffRow>();
    // Track counted project ids per staff so multi-handler duplicates don't inflate counts.
    const countedNoMini = new Map<string, Set<string>>();
    const countedAll = new Map<string, Set<string>>();

    for (const p of filteredProjects) {
      const key = p.staff_id || "__unassigned__";
      const name = p.staff_name || "未分配 Unassigned";
      const deductionPct = lookupDeduction(deductionMap, p.staff_id, p.n_financial_year_id);

      if (!groups.has(key)) {
        groups.set(key, {
          staff_id: key,
          staff_name: name,
          count_no_mini: 0,
          count_all: 0,
          total_bv_no_mini: 0,
          total_bv_all: 0,
          proj_count_no_mini: [],
          proj_count_all: [],
          proj_bv_no_mini: [],
          proj_bv_all: [],
          has_deduction: false,
        });
        countedNoMini.set(key, new Set());
        countedAll.set(key, new Set());
      }

      const row = groups.get(key)!;
      if (deductionPct > 0) row.has_deduction = true;

      const rule = getEffectiveStatusRule(p.status, projectFilter.status);
      const rawBv = bvAmount(p, moneyBasis);
      const bv = afterDeduction(rawBv, deductionPct);

      const excludeMiniPP = countsExcludeMiniPP({
        source: p.source,
        project_size: p.project_size,
        estimated_income: p.est_income,
        n_source_id: p.n_source_id,
      });
      const projName = p.project_name || p.project_code || "(未命名)";
      const sub = [p.project_code, p.status].filter(Boolean).join(" · ") || undefined;
      const href = projectHref(p.project_id, p.source);
      const bvDetail = deductionDetail(rawBv, deductionPct, formatCell);
      const projectKey = p.project_id || p.id;

      if (rule.countNumber) {
        const allSet = countedAll.get(key)!;
        if (!allSet.has(projectKey)) {
          allSet.add(projectKey);
          row.count_all++;
          row.proj_count_all.push({ name: projName, sub, href });
        }
        if (excludeMiniPP) {
          const noMiniSet = countedNoMini.get(key)!;
          if (!noMiniSet.has(projectKey)) {
            noMiniSet.add(projectKey);
            row.count_no_mini++;
            row.proj_count_no_mini.push({ name: projName, sub, href });
          }
        }
      }

      if (rule.countMoney) {
        row.total_bv_all += bv;
        row.proj_bv_all.push({
          name: projName,
          value: bv,
          sub,
          href,
          detail: bvDetail,
        });
        if (excludeMiniPP) {
          row.total_bv_no_mini += bv;
          row.proj_bv_no_mini.push({
            name: projName,
            value: bv,
            sub,
            href,
            detail: bvDetail,
          });
        }
      }
    }

    return Array.from(groups.values());
  }, [filteredProjects, moneyBasis, deductionMap, formatBV, projectFilter.status]);

  const visibleRows = useMemo(() => {
    return [...staffRows].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av as number;
      const bn = bv as number;
      return sortDir === "asc" ? an - bn : bn - an;
    });
  }, [staffRows, sortField, sortDir]);

  const totals = useMemo(() => {
    const t = {
      count_no_mini: 0,
      count_all: 0,
      total_bv_no_mini: 0,
      total_bv_all: 0,
    };
    for (const r of visibleRows) {
      t.count_no_mini += r.count_no_mini;
      t.count_all += r.count_all;
      t.total_bv_no_mini += r.total_bv_no_mini;
      t.total_bv_all += r.total_bv_all;
    }
    return t;
  }, [visibleRows]);

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

  const bvFormula = (base: string) =>
    `${base}（已扣除個人扣減比例，按 Handler 及財年對應 staff_bv_deductions）`;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">BV 業績 BV Performance</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          按 BV Handler 匯總 project_bv，並依個人扣減比例調整 · {dateRangeLabel}
        </p>
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
                  <Th field="staff_name">Staff (BV Handler)</Th>
                  {showPPColumns && (
                    <Th field="count_no_mini" right>
                      Number of Total
                      <br />
                      <span className="font-normal text-gray-400">Projects ({EXCLUDE_PP_LABEL})</span>
                    </Th>
                  )}
                  <Th field="count_all" right>
                    Number of
                    <br />
                    <span className="font-normal text-gray-400">All Projects</span>
                  </Th>
                  {showPPColumns && (
                    <Th field="total_bv_no_mini" right>
                      Total BV
                      <br />
                      <span className="font-normal text-gray-400">({EXCLUDE_PP_LABEL})</span>
                    </Th>
                  )}
                  <Th field="total_bv_all" right>
                    All Project
                    <br />
                    <span className="font-normal text-gray-400">BV</span>
                  </Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showPPColumns ? 5 : 3} className="text-center py-16 text-gray-400">
                      沒有找到符合條件的資料
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.staff_id}
                      className="hover:bg-gray-50/80 border-b border-gray-100"
                    >
                      <TableCell className="text-sm font-medium text-bw-blue whitespace-nowrap">
                        {row.staff_name}
                        {row.has_deduction && (
                          <span className="ml-1.5 text-[10px] font-normal text-red-500 bg-red-50 border border-red-100 rounded px-1 py-0.5">
                            個人扣減
                          </span>
                        )}
                      </TableCell>
                      {showPPColumns && (
                        <TableCell className="text-sm text-right text-gray-700">
                          <MetricHoverCard
                            title={`${row.staff_name} · 項目數 (${EXCLUDE_PP_LABEL})`}
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
                          title={`${row.staff_name} · 全部項目數`}
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
                            title={`${row.staff_name} · BV (${EXCLUDE_PP_LABEL})`}
                            formula={
                              row.has_deduction
                                ? bvFormula(
                                    `${modeLabel} 加總（來源非 BWA-PP）· project_bv.${moneyBasis === "l2" ? "estimated_bv" : "actual_bv"}`,
                                  )
                                : `${modeLabel} 加總（來源非 BWA-PP）· project_bv.${moneyBasis === "l2" ? "estimated_bv" : "actual_bv"}`
                            }
                            source={metricSource}
                            items={row.proj_bv_no_mini}
                            formatValue={formatCell}
                            total={row.total_bv_no_mini}
                          >
                            {formatCell(row.total_bv_no_mini)}
                          </MetricHoverCard>
                        </TableCell>
                      )}
                      <TableCell className="text-sm text-right font-mono text-gray-800 whitespace-nowrap">
                        <MetricHoverCard
                          title={`${row.staff_name} · 全部項目 BV`}
                          formula={
                            row.has_deduction
                              ? bvFormula(
                                  `${modeLabel} 加總（全部項目）· project_bv.${moneyBasis === "l2" ? "estimated_bv" : "actual_bv"}`,
                                )
                              : `${modeLabel} 加總（全部項目）· project_bv.${moneyBasis === "l2" ? "estimated_bv" : "actual_bv"}`
                          }
                          source={metricSource}
                          items={row.proj_bv_all}
                          formatValue={formatCell}
                          total={row.total_bv_all}
                        >
                          {formatCell(row.total_bv_all)}
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
                      總計 Total ({visibleRows.length} staff)
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
                        {formatCell(totals.total_bv_no_mini)}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-right font-mono text-gray-900 whitespace-nowrap">
                      {formatCell(totals.total_bv_all)}
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
