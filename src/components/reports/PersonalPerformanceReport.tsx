"use client";

// ═══════════════════════════════════════════════════════════════════════════
// AI WARNING — SHARED PERSONAL PERFORMANCE REPORT (DO NOT DUPLICATE)
// This single component renders:
//   • /business-reports/personal-performance    → reportScope="business"
//   • /team-reports/personal-performance        → reportScope="team"
//   • /individual-reports/personal-performance  → reportScope="individual"
// Any UI / filter / BV math change here applies to ALL pages. Do NOT fork.
// reportScope="team" locks Team; "individual" locks 員工 to current staff
// (unless Super Admin).
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  fetchPersonalPerformanceBV,
  type PersonalPerformanceBVRow,
  type StaffDirectoryRow,
} from "@/lib/data-service";
import {
  resolveRange,
  rangeBounds,
  fmtRangeDate,
} from "@/lib/report-date-range";
import { useReportRange, filterBySources } from "@/components/reports/ReportDateRangeContext";
import ReportFilterStack from "@/components/reports/ReportFilterStack";
import ReportDateRangeNote from "@/components/reports/ReportDateRangeNote";
import {
  applyProjectFilters,
  type ProjectFilterFields,
} from "@/components/reports/ProjectFilterBar";
import { staffIdMatchesFilter, EMPTY_STAFF_FILTERS } from "@/components/reports/StaffFilterBar";
import { useAlignedReportFilters } from "@/hooks/use-aligned-report-filters";
import {
  projectFilterNeedsExtras,
  useEnrichedProjectFilterRows,
} from "@/hooks/use-project-filter-extras";
import type { ReportStaffScope } from "@/hooks/use-report-staff-lock";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { projectHref } from "@/components/reports/MetricHoverCard";
import { getEffectiveStatusRule } from "@/lib/project-status-rules";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
import Link from "next/link";

export interface PersonalPerformanceReportProps {
  /** Route scope for StaffFilterBar locks (team → Team lock unless Super Admin). */
  reportScope?: ReportStaffScope;
}

function bvRowProjectFields(r: PersonalPerformanceBVRow): ProjectFilterFields {
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
    project_size: r.project_size,
    est_income: r.project_est_income,
    project_name: r.project_name,
    project_code: r.project_code,
    filter_project_id: r.project_id || r.id,
  };
}

function fmtPct(val: number | null): string {
  if (val == null || isNaN(val)) return "—";
  return `${val.toFixed(1)}%`;
}

function fmtDate(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    timeZone: "Asia/Hong_Kong",
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}


/** Numeric cell: tight padding + vertical grid for scanning across rows */
const numCell =
  "px-1 py-1 text-[12px] text-right font-mono tabular-nums whitespace-nowrap border-l border-gray-200 overflow-hidden";
const numHead =
  "px-1 py-1 text-[10px] font-semibold text-gray-600 text-right whitespace-nowrap border-l border-gray-200 cursor-pointer hover:text-bw-blue";
/** First 3 meta cols (年度 / 簽約 / 主PM) */
const metaCellSm = "px-1.5 py-1 text-[10px] text-gray-700 overflow-hidden";
/** Remaining meta cols (項目 / 狀態) */
const metaCell = "px-1.5 py-1 text-[12px] text-gray-700 overflow-hidden";
const metaHead =
  "px-1.5 py-1 text-[10px] font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap";

interface DisplayRow {
  id: string;
  source: "BWA" | "BWF";
  financial_year_name: string | null;
  signed_date: string | null;
  main_pm_name: string | null;
  project_name: string | null;
  project_code: string | null;
  project_id: string | null;
  project_status: string | null;
  est_income: number;
  est_expense: number;
  est_gp: number;
  est_bv: number | null;
  act_income: number;
  act_expense: number;
  act_gp: number;
  act_bv: number | null;
  shared_est_gp: number;
  shared_act_gp: number;
  assigned_ratio: number | null;
}

type SortField =
  | "financial_year_name"
  | "signed_date"
  | "main_pm_name"
  | "project_name"
  | "project_status"
  | "est_income"
  | "est_expense"
  | "est_gp"
  | "est_bv"
  | "act_income"
  | "act_expense"
  | "act_gp"
  | "act_bv"
  | "shared_est_gp"
  | "shared_act_gp"
  | "assigned_ratio";

function toDisplayRow(r: PersonalPerformanceBVRow): DisplayRow {
  const estIncome = Number(r.project_est_income) || 0;
  const estExpense = Number(r.project_est_expense) || 0;
  const actIncome = Number(r.project_act_income) || 0;
  const actExpense = Number(r.project_act_expense) || 0;
  return {
    id: r.id,
    source: r.source,
    financial_year_name: r.financial_year_name,
    signed_date: r.signed_date,
    main_pm_name: r.main_pm_name,
    project_name: r.project_name,
    project_code: r.project_code,
    project_id: r.project_id,
    project_status: r.project_status,
    est_income: estIncome,
    est_expense: estExpense,
    est_gp: estIncome - estExpense,
    est_bv: r.estimated_bv,
    act_income: actIncome,
    act_expense: actExpense,
    act_gp: actIncome - actExpense,
    act_bv: r.actual_bv,
    shared_est_gp: Number(r.shared_estimated_gp) || 0,
    shared_act_gp: Number(r.shared_actual_gp) || 0,
    assigned_ratio: r.ratio,
  };
}

export default function PersonalPerformanceReport({
  reportScope = "business",
}: PersonalPerformanceReportProps) {
  const { formatMoney, formatBV } = useFinancialFormat();
  const moneyOpts = { fallback: "—", decimals: 0 } as const;
  const formatCell = (v: number) => formatMoney(v, moneyOpts);

  const [rows, setRows] = useState<PersonalPerformanceBVRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const [mainPmDesignerOnly, setMainPmDesignerOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>("signed_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
    fetchPersonalPerformanceBV().then((data) => {
      setRows(data);
      setLoading(false);
    });
  }, []);

  const window = useMemo(
    () => resolveRange(range, new Date(), custom),
    [range, custom],
  );

  const dateRangeLabel = useMemo(
    () => `From ${fmtRangeDate(window.from)} to ${fmtRangeDate(window.to)}`,
    [window],
  );

  const projectFilterRows = useMemo(
    () => rows.map(bvRowProjectFields),
    [rows],
  );
  const enrichedProjectFilterRows = useEnrichedProjectFilterRows(
    projectFilterRows,
    projectFilterNeedsExtras(projectFilter),
  );

  const displayRows = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    const projectFilteredIds = new Set(
      applyProjectFilters(enrichedProjectFilterRows, projectFilter).map((p) => p.id),
    );

    const filtered = filterBySources(rows, sources).filter((r) => {
      if (!staffIdMatchesFilter(r.handler_id, staffFilter, staffDirectory)) {
        return false;
      }

      const projectKey = r.project_id || r.id;
      if (!projectFilteredIds.has(projectKey)) return false;

      // BV / income / expense / GP are money — apply 計錢 when status is "all".
      if (!getEffectiveStatusRule(r.project_status, projectFilter.status).countMoney) {
        return false;
      }

      if (mainPmDesignerOnly && staffFilter.staffId !== "all") {
        const isLead =
          r.main_pm_id === staffFilter.staffId ||
          r.main_designer_id === staffFilter.staffId;
        if (!isLead) return false;
      }

      if (!r.signed_date) return false;
      const t = new Date(r.signed_date).getTime();
      return !isNaN(t) && t >= fromMs && t <= toMs;
    });

    return filtered.map((r) => toDisplayRow(r));
  }, [
    rows,
    sources,
    staffFilter,
    staffDirectory,
    mainPmDesignerOnly,
    window,
    projectFilter,
    enrichedProjectFilterRows,
  ]);

  const sortedRows = useMemo(() => {
    return [...displayRows].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = (av as number | null) ?? 0;
      const bn = (bv as number | null) ?? 0;
      return sortDir === "asc" ? an - bn : bn - an;
    });
  }, [displayRows, sortField, sortDir]);

  const totals = useMemo(() => {
    const t = {
      est_income: 0,
      est_expense: 0,
      est_gp: 0,
      est_bv: 0,
      act_income: 0,
      act_expense: 0,
      act_gp: 0,
      act_bv: 0,
      shared_est_gp: 0,
      shared_act_gp: 0,
    };
    for (const r of sortedRows) {
      t.est_income += r.est_income;
      t.est_expense += r.est_expense;
      t.est_gp += r.est_gp;
      t.est_bv += Number(r.est_bv) || 0;
      t.act_income += r.act_income;
      t.act_expense += r.act_expense;
      t.act_gp += r.act_gp;
      t.act_bv += Number(r.act_bv) || 0;
      t.shared_est_gp += r.shared_est_gp;
      t.shared_act_gp += r.shared_act_gp;
    }
    return t;
  }, [sortedRows]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-2.5 h-2.5 opacity-25 shrink-0" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-2.5 h-2.5 text-bw-blue shrink-0" />
    ) : (
      <ChevronDown className="w-2.5 h-2.5 text-bw-blue shrink-0" />
    );
  }

  function Th({
    field,
    children,
    numeric,
  }: {
    field: SortField;
    children: React.ReactNode;
    numeric?: boolean;
  }) {
    return (
      <TableHead
        className={numeric ? numHead : metaHead}
        onClick={() => handleSort(field)}
      >
        <span className={`inline-flex items-center gap-0.5 ${numeric ? "justify-end w-full" : ""}`}>
          {children}
          <SortIcon field={field} />
        </span>
      </TableHead>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">個人BV表現 Personal BV Performance</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          選擇員工查看其項目 BV 分配明細 · {dateRangeLabel}
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
        staffClearTo={{ ...EMPTY_STAFF_FILTERS, position: "PM_or_Designer" }}
        onStaffDirectoryLoaded={setStaffDirectory}
      />

      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <Checkbox
          id="main-pm-designer-filter"
          checked={mainPmDesignerOnly}
          onCheckedChange={(v) => setMainPmDesignerOnly(v === true)}
          disabled={staffFilter.staffId === "all"}
        />
        <Label htmlFor="main-pm-designer-filter" className="text-sm text-gray-700 cursor-pointer">
          Main PM / Designer 篩選 — 只顯示所選員工作為主 PM 或主設計師的項目
          {staffFilter.staffId === "all" && (
            <span className="text-gray-400">（請先選擇單一員工）</span>
          )}
        </Label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-bw-blue" />
          <span className="ml-3 text-gray-500 text-sm">載入報表資料...</span>
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 py-16 text-center text-gray-400 text-sm">
          沒有符合篩選條件的項目 BV 記錄
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <Table className="table-fixed w-full border-collapse">
            <colgroup>
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[14%]" />
              <col className="w-[5%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[4%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[4%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[4%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200 hover:bg-gray-50">
                <TableHead colSpan={5} className="px-1.5 py-1 text-[10px] font-semibold text-gray-500" />
                <TableHead
                  colSpan={4}
                  className="px-1 py-1 text-[10px] font-semibold text-center text-sky-800 bg-sky-50/80 border-l border-gray-200"
                >
                  預計 Estimate
                </TableHead>
                <TableHead
                  colSpan={4}
                  className="px-1 py-1 text-[10px] font-semibold text-center text-violet-800 bg-violet-50/80 border-l border-gray-300"
                >
                  實際 Actual
                </TableHead>
                <TableHead
                  colSpan={3}
                  className="px-1 py-1 text-[10px] font-semibold text-center text-amber-800 bg-amber-50/60 border-l border-gray-300"
                >
                  分攤
                </TableHead>
              </TableRow>
              <TableRow className="bg-gray-50/90 border-b border-gray-200 hover:bg-gray-50/90">
                <Th field="financial_year_name">年度</Th>
                <Th field="signed_date">簽約</Th>
                <Th field="main_pm_name">主PM</Th>
                <Th field="project_name">項目</Th>
                <Th field="project_status">狀態</Th>
                <Th field="est_income" numeric>收入</Th>
                <Th field="est_expense" numeric>支出</Th>
                <Th field="est_gp" numeric>GP</Th>
                <Th field="est_bv" numeric>BV</Th>
                <Th field="act_income" numeric>收入</Th>
                <Th field="act_expense" numeric>支出</Th>
                <Th field="act_gp" numeric>GP</Th>
                <Th field="act_bv" numeric>BV</Th>
                <Th field="shared_est_gp" numeric>Est. GP</Th>
                <Th field="shared_act_gp" numeric>Actual GP</Th>
                <Th field="assigned_ratio" numeric>比例</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} className="text-center py-16 text-gray-400 text-sm">
                    沒有找到符合條件的資料
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row) => {
                  const href = projectHref(row.project_id, row.source);
                  const label = row.project_name || row.project_code || "(未命名)";
                  return (
                    <TableRow key={row.id} className="hover:bg-gray-50/80 border-b border-gray-200">
                      <TableCell className={`${metaCellSm} whitespace-nowrap truncate`} title={row.financial_year_name || undefined}>
                        {row.financial_year_name || "—"}
                      </TableCell>
                      <TableCell className={`${metaCellSm} text-gray-600 whitespace-nowrap`}>
                        {fmtDate(row.signed_date)}
                      </TableCell>
                      <TableCell className={`${metaCellSm} whitespace-nowrap truncate`} title={row.main_pm_name || undefined}>
                        {row.main_pm_name || "—"}
                      </TableCell>
                      <TableCell className={`${metaCell} font-medium min-w-0`}>
                        {href ? (
                          <Link
                            href={href}
                            className="text-bw-blue hover:underline block truncate"
                            title={label}
                          >
                            {label}
                          </Link>
                        ) : (
                          <span className="text-gray-900 block truncate" title={label}>{label}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-1 py-1 whitespace-nowrap">
                        <ProjectStatusBadge status={row.project_status} className="text-[12px]" />
                      </TableCell>
                      <TableCell className={`${numCell} text-gray-800 bg-sky-50/30`}>
                        {formatCell(row.est_income)}
                      </TableCell>
                      <TableCell className={`${numCell} text-red-600 bg-sky-50/30`}>
                        {formatCell(row.est_expense)}
                      </TableCell>
                      <TableCell className={`${numCell} font-medium text-blue-600 bg-sky-50/30`}>
                        {formatCell(row.est_gp)}
                      </TableCell>
                      <TableCell className={`${numCell} text-gray-700 bg-sky-50/30`}>
                        {formatBV(row.est_bv ?? 0)}
                      </TableCell>
                      <TableCell className={`${numCell} text-gray-800 bg-violet-50/30 border-l-gray-300`}>
                        {formatCell(row.act_income)}
                      </TableCell>
                      <TableCell className={`${numCell} text-red-600 bg-violet-50/30`}>
                        {formatCell(row.act_expense)}
                      </TableCell>
                      <TableCell className={`${numCell} font-medium text-blue-600 bg-violet-50/30`}>
                        {formatCell(row.act_gp)}
                      </TableCell>
                      <TableCell className={`${numCell} text-gray-700 bg-violet-50/30`}>
                        {formatBV(row.act_bv ?? 0)}
                      </TableCell>
                      <TableCell className={`${numCell} font-semibold text-amber-700 bg-amber-50/40 border-l-gray-300`}>
                        {formatCell(row.shared_est_gp)}
                      </TableCell>
                      <TableCell className={`${numCell} font-semibold text-amber-700 bg-amber-50/40`}>
                        {formatCell(row.shared_act_gp)}
                      </TableCell>
                      <TableCell className={`${numCell} text-gray-600 bg-amber-50/40`}>
                        {fmtPct(row.assigned_ratio)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {sortedRows.length > 0 && (
              <tfoot>
                <TableRow className="bg-gray-100/80 border-t-2 border-gray-300 font-semibold hover:bg-gray-100/80">
                  <TableCell colSpan={5} className="px-1.5 py-1.5 text-[11px] text-gray-800">
                    總計 ({sortedRows.length})
                  </TableCell>
                  <TableCell className={`${numCell} text-gray-900 bg-sky-50/40`}>
                    {formatCell(totals.est_income)}
                  </TableCell>
                  <TableCell className={`${numCell} text-red-600 bg-sky-50/40`}>
                    {formatCell(totals.est_expense)}
                  </TableCell>
                  <TableCell className={`${numCell} text-blue-700 bg-sky-50/40`}>
                    {formatCell(totals.est_gp)}
                  </TableCell>
                  <TableCell className={`${numCell} text-gray-800 bg-sky-50/40`}>
                    {formatBV(totals.est_bv)}
                  </TableCell>
                  <TableCell className={`${numCell} text-gray-900 bg-violet-50/40 border-l-gray-300`}>
                    {formatCell(totals.act_income)}
                  </TableCell>
                  <TableCell className={`${numCell} text-red-600 bg-violet-50/40`}>
                    {formatCell(totals.act_expense)}
                  </TableCell>
                  <TableCell className={`${numCell} text-blue-700 bg-violet-50/40`}>
                    {formatCell(totals.act_gp)}
                  </TableCell>
                  <TableCell className={`${numCell} text-gray-800 bg-violet-50/40`}>
                    {formatBV(totals.act_bv)}
                  </TableCell>
                  <TableCell className={`${numCell} text-amber-800 bg-amber-50/50 border-l-gray-300`}>
                    {formatCell(totals.shared_est_gp)}
                  </TableCell>
                  <TableCell className={`${numCell} text-amber-800 bg-amber-50/50`}>
                    {formatCell(totals.shared_act_gp)}
                  </TableCell>
                  <TableCell className={`${numCell} bg-amber-50/50`} />
                </TableRow>
              </tfoot>
            )}
          </Table>
        </div>
      )}

      <ReportDateRangeNote>
        Note: This summary is based on orders with a project signed date in
        the selected period.
      </ReportDateRangeNote>
    </div>
  );
}
