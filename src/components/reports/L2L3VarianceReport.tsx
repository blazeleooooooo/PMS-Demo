"use client";

// ═══════════════════════════════════════════════════════════════════════════
// AI WARNING — SHARED RISKY PROJECT / L2–L3 VARIANCE REPORT (DO NOT DUPLICATE)
// This single component renders:
//   • /business-reports/risky-project           → reportScope="business"
//   • /individual-reports/risky-project         → reportScope="individual"
// Any UI / filter / flag logic change here applies to BOTH. Do NOT fork.
// reportScope="individual" locks Staff → 員工 to current staff (unless Super Admin).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  ShieldCheck,
  HelpCircle,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  fetchSalesByPMProjects,
  type SalesByPMProject,
} from "@/lib/data-service";
import { getEffectiveStatusRule } from "@/lib/project-status-rules";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
import MetricHoverCard, { type BreakdownItem, projectHref } from "@/components/reports/MetricHoverCard";

// ─── DATE-RANGE PRESETS — shared across all /business-reports ──
import {
  resolveRange,
  rangeBounds,
  fmtRangeDate as fmtDate,
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
import type { ReportStaffScope } from "@/hooks/use-report-staff-lock";
import type { StaffDirectoryRow } from "@/lib/data-service";
import { useFinancialFormat } from "@/hooks/use-financial-format";

export interface L2L3VarianceReportProps {
  /** Route scope for StaffFilterBar locks (individual → 員工 lock unless Super Admin). */
  reportScope?: ReportStaffScope;
}

// ─── MATERIALITY + VARIANCE THRESHOLDS ────────────────────────
// A raw L2-vs-L3 gap mostly measures how FAR ALONG a project is (L3 actuals
// accumulate over the project's life), not whether it's in trouble. So this
// report is STATUS-AWARE: each "needs attention" signal applies only to the
// lifecycle stage where it's meaningful. GP eroded / cost overrun must clear
// BOTH a percentage AND a dollar floor; under-billed flags whenever actual
// income is below signed income (and the project must be non-trivial).
const MIN_EST_INCOME = 30000; // skip "mini" projects (matches is_mini threshold)
const PCT = 0.1; // gap must exceed 10% …
const DOLLAR = 30000; // … AND $30k to count as material

// ─── HELPERS ──────────────────────────────────────────────────
function fmtPct(num: number, denom: number): string {
  if (!denom) return "—";
  return `${((num / denom) * 100).toFixed(1)}%`;
}


// ─── FLAGS ─────────────────────────────────────────────────────
type FlagKey = "gp_eroded" | "cost_overrun" | "underwater" | "under_billed";

interface FlagDef {
  key: FlagKey;
  labelZh: string;
  labelEn: string;
  // Tailwind classes for the reason chip.
  chip: string;
  // Hover explanation of when this signal triggers (incl. thresholds).
  tooltip: string;
}

const FLAG_DEFS: Record<FlagKey, FlagDef> = {
  gp_eroded: {
    key: "gp_eroded",
    labelZh: "毛利侵蝕",
    labelEn: "GP Eroded",
    chip: "bg-red-50 text-red-700 border-red-200",
    tooltip:
      "已完成項目（Project Done / Dispute Done）的實際毛利 (L3) 低於簽約毛利 (L2)。\n" +
      "觸發條件：毛利跌幅同時超過 L2 毛利的 10% 且 ≥ $30,000。\n" +
      "公式：跌幅 = L2 毛利 − L3 毛利（L3 = 實際收入 − 實際支出）。",
  },
  cost_overrun: {
    key: "cost_overrun",
    labelZh: "成本超支",
    labelEn: "Cost Overrun",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    tooltip:
      "進行中項目（Work In Progress）的實際支出 (L3) 已超出預算支出 (L2)。\n" +
      "觸發條件：超支同時超過 L2 預算支出的 10% 且 ≥ $30,000。\n" +
      "公式：超支 = L3 實際支出 − L2 預算支出。",
  },
  underwater: {
    key: "underwater",
    labelZh: "支出已超收入",
    labelEn: "Underwater",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    tooltip:
      "進行中項目（Work In Progress）目前的實際支出已超過實際收入 —— 即未收回成本前已先墊支。\n" +
      "觸發條件：缺口 ≥ $30,000。\n" +
      "公式：缺口 = L3 實際支出 − L3 實際收入。",
  },
  under_billed: {
    key: "under_billed",
    labelZh: "收款不足",
    labelEn: "Under-billed",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    tooltip:
      "已完成項目（Project Done / Dispute Done）的實際收入 (L3) 低於簽約收入 (L2)，可能有未開發票／未收款。\n" +
      "觸發條件：實際收入低於簽約收入。\n" +
      "公式：短收 = L2 簽約收入 − L3 實際收入。",
  },
};

// Note: all four signals only consider non-trivial, money-counting projects —
// L2 估算收入 ≥ $30,000 且狀態計入「計錢」（Case Closed / Internal Project 不計）。

interface Flag {
  key: FlagKey;
  risk: number; // $ at risk for this flag — drives severity
  detail: string; // human explanation with the specific numbers
}

interface FlaggedRow {
  id: string;
  source: "BWA" | "BWF";
  project_code: string | null;
  project_name: string | null;
  start_date: string | null;
  pm_name: string | null;
  designer_name: string | null;
  status: string | null;
  // L2 (signed / estimated)
  l2_inc: number;
  l2_exp: number;
  l2_gp: number;
  // L3 (actual)
  l3_inc: number;
  l3_exp: number;
  l3_gp: number;
  gp_variance: number; // l3_gp − l2_gp (negative = eroded)
  flags: Flag[];
  severity: number; // max risk across flags
}

type SortField =
  | "project_code"
  | "start_date"
  | "pm_name"
  | "designer_name"
  | "status"
  | "l2_gp"
  | "l3_gp"
  | "gp_variance"
  | "severity";

function fmtStartDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return fmtDate(d);
}

// Compute the status-aware flags for one project. Returns [] if it's healthy
// or not material enough to consider.
function computeFlags(
  p: SalesByPMProject,
  formatMoney: (val: number | null | undefined) => string,
  statusFilter: string,
): Flag[] {
  const l2_inc = p.est_income || 0;
  // Materiality floor — ignore mini / trivial projects.
  if (l2_inc < MIN_EST_INCOME) return [];
  // Respect 計錢 when status filter is "all"; bypass when drilling into a status.
  if (!getEffectiveStatusRule(p.status, statusFilter).countMoney) return [];

  const status = (p.status || "").trim().toLowerCase();
  const isFinished = status === "project done" || status === "dispute done";
  const isWip = status === "work in progress";

  const l2_exp = p.est_expense || 0;
  const l2_gp = l2_inc - l2_exp;
  const l3_inc = p.actual_income || 0;
  const l3_exp = p.actual_expense || 0;
  const l3_gp = l3_inc - l3_exp;

  const material = (gap: number, base: number) =>
    gap >= DOLLAR && gap >= PCT * Math.abs(base || 1);

  const flags: Flag[] = [];

  // (1) GP eroded — finished projects whose actual GP fell below signed GP.
  if (isFinished) {
    const drop = l2_gp - l3_gp;
    if (drop > 0 && material(drop, l2_gp)) {
      flags.push({
        key: "gp_eroded",
        risk: drop,
        detail: `實際毛利 ${formatMoney(l3_gp)} 低於簽約毛利 ${formatMoney(l2_gp)}，相差 ${formatMoney(drop)}`,
      });
    }
  }

  // (2) Cost overrun — WIP whose actual cost already exceeds the estimate.
  if (isWip) {
    const over = l3_exp - l2_exp;
    if (over > 0 && material(over, l2_exp)) {
      flags.push({
        key: "cost_overrun",
        risk: over,
        detail: `實際支出 ${formatMoney(l3_exp)} 已超出預算 ${formatMoney(l2_exp)}，超支 ${formatMoney(over)}`,
      });
    }
  }

  // (3) Underwater — WIP already spending more than it has billed.
  if (isWip) {
    const deficit = l3_exp - l3_inc;
    if (deficit > 0 && deficit >= DOLLAR) {
      flags.push({
        key: "underwater",
        risk: deficit,
        detail: `實際支出 ${formatMoney(l3_exp)} 已超過實際收入 ${formatMoney(l3_inc)}，缺口 ${formatMoney(deficit)}`,
      });
    }
  }

  // (4) Under-billed — finished but actual income is below signed income
  // (missing invoices / uncollected revenue).
  if (isFinished) {
    const shortfall = l2_inc - l3_inc;
    if (l3_inc < l2_inc) {
      flags.push({
        key: "under_billed",
        risk: shortfall,
        detail: `實際收入 ${formatMoney(l3_inc)} 低於簽約收入 ${formatMoney(l2_inc)}，短收 ${formatMoney(shortfall)}`,
      });
    }
  }

  return flags;
}

export default function L2L3VarianceReport({
  reportScope = "business",
}: L2L3VarianceReportProps) {
  const { formatMoney } = useFinancialFormat();
  const [projects, setProjects] = useState<SalesByPMProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const [sortField, setSortField] = useState<SortField>("severity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // Which signal categories are shown (all on by default).
  const [activeFlags, setActiveFlags] = useState<Set<FlagKey>>(
    new Set<FlagKey>(["gp_eroded", "cost_overrun", "underwater", "under_billed"]),
  );

  const { range, custom, sources } = useReportRange();
  const {
    projectFilter,
    setProjectFilter,
    staffFilter,
    setStaffFilter,
    staffLocks,
    isSuperAdmin,
    defaultStaffFilter,
  } = useAlignedReportFilters(reportScope);
  const window = useMemo(() => resolveRange(range, new Date(), custom), [range, custom]);
  // BWA / BWF toggle applied first.
  const sourceProjects = useMemo(() => filterBySources(projects, sources), [projects, sources]);
  const enrichedProjects = useEnrichedProjectFilterRows(
    sourceProjects,
    projectFilterNeedsExtras(projectFilter),
  );

  useEffect(() => {
    fetchSalesByPMProjects().then((data) => {
      setProjects(data);
      setLoading(false);
    });
  }, []);

  // ─── BUILD FLAGGED WORKLIST ────────────────────────────────
  const allFlagged = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    const rows: FlaggedRow[] = [];
    for (const p of applyProjectFilters(enrichedProjects, projectFilter)) {
      if (!staffIdMatchesFilter(p.pm_id, staffFilter, staffDirectory)) continue;
      // Window filter on signed date (matches the other reports' convention).
      if (p.signed_date) {
        const t = new Date(p.signed_date).getTime();
        if (isNaN(t) || t < fromMs || t > toMs) continue;
      } else if (fromMs !== -Infinity) {
        continue; // no signed date → only show under "All Time"
      }

      const flags = computeFlags(p, formatMoney, projectFilter.status);
      if (flags.length === 0) continue;

      const l2_inc = p.est_income || 0;
      const l2_exp = p.est_expense || 0;
      const l3_inc = p.actual_income || 0;
      const l3_exp = p.actual_expense || 0;
      const l2_gp = l2_inc - l2_exp;
      const l3_gp = l3_inc - l3_exp;
      rows.push({
        id: p.id,
        source: p.source,
        project_code: p.project_code,
        project_name: p.project_name,
        start_date: p.start_date,
        pm_name: p.pm_name,
        designer_name: p.designer_name,
        status: p.status,
        l2_inc,
        l2_exp,
        l2_gp,
        l3_inc,
        l3_exp,
        l3_gp,
        gp_variance: l3_gp - l2_gp,
        flags,
        severity: Math.max(...flags.map((f) => f.risk)),
      });
    }
    return rows;
  }, [enrichedProjects, window, projectFilter, staffFilter, staffDirectory, formatMoney]);

  // ─── FILTER (flag toggles) + SORT ──────────────────────────
  // (status / PM / search etc. are applied upstream by the project filter bar)
  const visibleRows = useMemo(() => {
    const result = allFlagged.filter((r) => r.flags.some((f) => activeFlags.has(f.key)));
    const valueFor = (r: FlaggedRow): number | string => {
      switch (sortField) {
        case "project_code":
          return (r.project_code || "").toLowerCase();
        case "start_date":
          return r.start_date || "";
        case "pm_name":
          return (r.pm_name || "").toLowerCase();
        case "designer_name":
          return (r.designer_name || "").toLowerCase();
        case "status":
          return (r.status || "").toLowerCase();
        case "l2_gp":
          return r.l2_gp;
        case "l3_gp":
          return r.l3_gp;
        case "gp_variance":
          return r.gp_variance;
        case "severity":
          return r.severity;
      }
    };
    return [...result].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [allFlagged, activeFlags, sortField, sortDir]);

  // ─── SUMMARY (counts per signal + total $ at risk) ─────────
  const summary = useMemo(() => {
    const counts: Record<FlagKey, number> = {
      gp_eroded: 0,
      cost_overrun: 0,
      underwater: 0,
      under_billed: 0,
    };
    let atRisk = 0;
    for (const r of allFlagged) {
      atRisk += r.severity;
      for (const f of r.flags) counts[f.key] += 1;
    }
    return { counts, atRisk, total: allFlagged.length };
  }, [allFlagged]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "project_code" || field === "status" || field === "start_date" || field === "pm_name" || field === "designer_name" ? "asc" : "desc");
    }
  }

  function toggleFlag(key: FlagKey) {
    setActiveFlags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          L2 L3 比較表 L2 L3 Comparison Table
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          找出簽約 (L2) 與實際 (L3) 出現重大差異、需要關注的項目。
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
        staffClearTo={defaultStaffFilter}
        isSuperAdmin={isSuperAdmin}
        onStaffDirectoryLoaded={setStaffDirectory}
      />

      {/* ─── SIGNAL FILTER CHIPS (counts) ───────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(FLAG_DEFS) as FlagKey[]).map((key) => {
          const def = FLAG_DEFS[key];
          const on = activeFlags.has(key);
          return (
            <TooltipProvider key={key} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => toggleFlag(key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      on ? def.chip : "bg-white text-gray-400 border-gray-200"
                    }`}
                  >
                    {def.labelZh} {def.labelEn}
                    <span className={`font-mono ${on ? "" : "opacity-60"}`}>
                      {summary.counts[key]}
                    </span>
                    <HelpCircle className="w-3 h-3 opacity-50" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[280px] bg-gray-900 text-white text-xs leading-relaxed font-normal whitespace-pre-line"
                >
                  {def.tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
        <div className="ml-auto text-sm text-gray-500">
          共 <span className="font-semibold text-gray-800">{summary.total}</span> 個需關注項目 ·
          約 <span className="font-semibold text-red-600">{formatMoney(summary.atRisk)}</span> 受影響
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
                  <Th field="project_code">Project</Th>
                  <Th field="start_date">Start Date</Th>
                  <Th field="pm_name">Main PM</Th>
                  <Th field="designer_name">Main Designer</Th>
                  <Th field="status">Status</Th>
                  <Th field="l2_gp" right>Signed GP (L2)</Th>
                  <Th field="l3_gp" right>Actual GP (L3)</Th>
                  <Th field="gp_variance" right>Δ GP</Th>
                  <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                    需關注原因 Reasons
                  </TableHead>
                  <Th field="severity" right>受影響金額 At Risk</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-16 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <ShieldCheck className="w-8 h-8 text-emerald-300" />
                        沒有需要關注的項目 — L2 與 L3 一致
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => {
                    const gpDown = row.gp_variance < 0;
                    return (
                      <TableRow key={row.id} className="hover:bg-gray-50/80 border-b border-gray-100">
                        <TableCell className="whitespace-nowrap">
                          {projectHref(row.id, row.source) ? (
                            <a
                              href={projectHref(row.id, row.source)}
                              className="text-sm font-medium text-bw-blue hover:underline"
                            >
                              {row.project_code || "—"}
                            </a>
                          ) : (
                            <span className="text-sm font-medium text-gray-800">
                              {row.project_code || "—"}
                            </span>
                          )}
                          <div className="text-xs text-gray-400 max-w-[240px] truncate">
                            {row.project_name || "(未命名)"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 whitespace-nowrap">
                          {fmtStartDate(row.start_date)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 whitespace-nowrap">
                          {row.pm_name || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 whitespace-nowrap">
                          {row.designer_name || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <ProjectStatusBadge status={row.status} className="text-[11px]" />
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono text-gray-700 whitespace-nowrap">
                          <MetricHoverCard
                            title={`${row.project_code || "項目"} · 簽約 L2`}
                            formula="簽約收入 − 簽約成本"
                            source="l2"
                            items={[
                              { name: "收入 Revenue", value: row.l2_inc },
                              { name: "成本 Cost", value: -row.l2_exp },
                            ]}
                            formatValue={formatMoney}
                            total={row.l2_gp}
                          >
                            {formatMoney(row.l2_gp)}
                          </MetricHoverCard>
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono text-gray-700 whitespace-nowrap">
                          <MetricHoverCard
                            title={`${row.project_code || "項目"} · 實際 L3`}
                            formula="實際收入 − 實際成本"
                            source="l3"
                            items={[
                              { name: "收入 Revenue", value: row.l3_inc },
                              { name: "成本 Cost", value: -row.l3_exp },
                            ]}
                            formatValue={formatMoney}
                            total={row.l3_gp}
                          >
                            {formatMoney(row.l3_gp)}
                          </MetricHoverCard>
                        </TableCell>
                        <TableCell
                          className={`text-sm text-right font-mono font-semibold whitespace-nowrap ${
                            gpDown ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {formatMoney(row.gp_variance)}
                          <span className="block text-[11px] font-normal text-gray-400">
                            {fmtPct(row.gp_variance, Math.abs(row.l2_gp))}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.flags.map((f) => {
                              const def = FLAG_DEFS[f.key];
                              return (
                                <TooltipProvider key={f.key} delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-medium cursor-help ${def.chip}`}
                                      >
                                        <AlertTriangle className="w-3 h-3" />
                                        {def.labelZh}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="top"
                                      className="max-w-[280px] bg-gray-900 text-white text-xs leading-relaxed font-normal whitespace-pre-line"
                                    >
                                      {f.detail}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono font-bold text-red-600 whitespace-nowrap">
                          {formatMoney(row.severity)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ─── NOTE ───────────────────────────────────── */}
      <p className="text-sm text-gray-400">
        說明：毛利侵蝕／成本超支須同時超過 {Math.round(PCT * 100)}% 及 {formatMoney(DOLLAR)} 才視為重大；
        支出已超收入缺口須 ≥ {formatMoney(DOLLAR)}；收款不足則於實際收入低於簽約收入時觸發。
        項目簽約收入須 ≥ {formatMoney(MIN_EST_INCOME)}。各信號只適用於相關狀態
        （已完成項目看毛利侵蝕／收款不足；進行中項目看成本超支／支出超收入）。
        按項目簽約日期 (signed date) 篩選。
      </p>
      <ReportDateRangeNote>
        Note: This summary is based on orders with a project signed date in
        the selected period.
      </ReportDateRangeNote>
    </div>
  );
}
