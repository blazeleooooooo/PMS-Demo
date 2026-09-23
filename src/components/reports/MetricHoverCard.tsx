"use client";

import React from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  PitchingStageBadge,
  ProjectStatusBadge,
} from "@/components/ui/entity-status-badges";

// One contributing record behind an aggregated number.
export interface BreakdownItem {
  name: string;
  // Omit `value` for pure-count metrics — only the name is shown.
  value?: number;
  // Optional secondary line (e.g. project code, status).
  sub?: string;
  // Optional calculation line, shown muted+mono under the name/sub — used to
  // spell out how `value` was derived (e.g. "GP $122,700 × 30% = $36,810").
  detail?: string;
  // Optional link — when set, the item becomes clickable and opens this URL
  // in a new tab (e.g. the project detail page).
  href?: string;
  /** Column layout: code (pitching/project code). */
  code?: string;
  /** Column layout: stage / project status. */
  status?: string;
}

// Build the project-detail href used by report breakdowns. Returns undefined
// for a missing id so the item simply stays non-clickable. BWF projects have
// no detail page yet, so BWF rows also stay non-clickable.
export function projectHref(
  projectId: string | null | undefined,
  source?: "BWA" | "BWF",
): string | undefined {
  if (source === "BWF") return undefined;
  return projectId ? `/projects/bwa/${projectId}` : undefined;
}

// ─── DATA-SOURCE BADGE ────────────────────────────────────────
// Identifies which underlying columns a metric is computed from, so a hover
// card can show a top-right badge explaining the number's provenance.
//   l2          → bwa_projects.estimated_income / estimated_expense (signed)
//   l3          → incomes.income_amount / expenses.installment_amount (actual)
//   l3_received → incomes.payment_amount / expenses.paid_amount (received/paid)
//   shared_l2   → project_bv.shared_estimated_gp (shared estimated GP)
//   shared_l3   → project_bv.shared_actual_gp (shared actual GP)
//   bv_l2       → project_bv.estimated_bv (BV · L2 Signed)
//   bv_l3       → project_bv.actual_bv (BV · L3 Actual)
export type MetricSource =
  | "l2"
  | "l3"
  | "l3_received"
  | "shared_l2"
  | "shared_l3"
  | "bv_l2"
  | "bv_l3";

export const METRIC_SOURCE_META: Record<
  MetricSource,
  { label: string; className: string }
> = {
  l2: { label: "L2 Signed", className: "bg-blue-50 text-blue-600 border-blue-200" },
  l3: { label: "L3 Actual", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  l3_received: { label: "L3 Received", className: "bg-violet-50 text-violet-700 border-violet-200" },
  shared_l2: { label: "Shared L2", className: "bg-amber-50 text-amber-700 border-amber-200" },
  shared_l3: { label: "Shared L3", className: "bg-orange-50 text-orange-700 border-orange-200" },
  bv_l2: { label: "BV · L2 Signed", className: "bg-sky-50 text-sky-700 border-sky-200" },
  bv_l3: { label: "BV · L3 Actual", className: "bg-teal-50 text-teal-700 border-teal-200" },
};

export interface MetricBreakdownBodyProps {
  title: string;
  formula?: string;
  items: BreakdownItem[];
  formatValue?: (v: number) => string;
  totalLabel?: string;
  total?: number;
  isCount?: boolean;
  source?: MetricSource;
  /** Max height for the scrollable item list (hover default 280px). */
  maxHeightClass?: string;
  /** Empty-state copy when items is empty (panel mode). */
  emptyLabel?: string;
  /**
   * Column layout: 編號 | 名稱 | 狀態 (uses item.code / name / status).
   * Title+sub stack remains the default for hover cards.
   */
  columns?: boolean;
  /** Column headers when columns=true. */
  columnLabels?: { code?: string; name?: string; status?: string };
  /** Render status column as a colored badge (Chinese label). */
  statusBadge?: "project" | "pitching";
}

/** Shared heading + item rows + footer used by hover cards and full listings. */
export function MetricBreakdownBody({
  title,
  formula,
  items,
  formatValue,
  totalLabel,
  total,
  isCount,
  source,
  maxHeightClass = "max-h-[280px]",
  emptyLabel,
  columns = false,
  columnLabels,
  statusBadge,
}: MetricBreakdownBodyProps) {
  const sourceMeta = source ? METRIC_SOURCE_META[source] : null;
  const codeLabel = columnLabels?.code ?? "編號";
  const nameLabel = columnLabels?.name ?? "名稱";
  const statusLabel = columnLabels?.status ?? "狀態";
  const statusColClass = statusBadge
    ? "w-[132px] shrink-0 flex justify-end"
    : "w-[120px] shrink-0 text-right text-[11px] text-gray-500 truncate";

  return (
    <>
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/80 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs font-semibold text-gray-800 leading-snug">
            {title}
          </div>
          {sourceMeta && (
            <span
              className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border leading-none whitespace-nowrap ${sourceMeta.className}`}
            >
              {sourceMeta.label}
            </span>
          )}
        </div>
        {formula && (
          <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">
            {formula}
          </div>
        )}
      </div>

      {columns && items.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-gray-50/50 text-[10px] font-medium text-gray-400 uppercase tracking-wide">
          <div className="w-[112px] shrink-0">{codeLabel}</div>
          <div className="min-w-0 flex-1">{nameLabel}</div>
          <div className={statusBadge ? "w-[132px] shrink-0 text-right" : "w-[120px] shrink-0 text-right"}>
            {statusLabel}
          </div>
        </div>
      )}

      <div className={`${maxHeightClass} overflow-y-auto divide-y divide-gray-50`}>
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-gray-400">
            {emptyLabel || "沒有記錄"}
          </div>
        ) : (
          items.map((item, i) => {
            const statusNode =
              statusBadge === "project" ? (
                <ProjectStatusBadge status={item.status} />
              ) : statusBadge === "pitching" ? (
                <PitchingStageBadge stage={item.status} />
              ) : (
                item.status || "—"
              );

            const inner = columns ? (
              <>
                <div
                  className="w-[112px] shrink-0 text-xs font-mono tabular-nums text-gray-600 truncate"
                  title={item.code || undefined}
                >
                  {item.code || "—"}
                </div>
                <div
                  className={`min-w-0 flex-1 text-xs truncate ${
                    item.href ? "text-bw-blue group-hover:underline" : "text-gray-800"
                  }`}
                  title={item.name}
                >
                  {item.name}
                </div>
                <div className={statusColClass} title={item.status || undefined}>
                  {statusNode}
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <div
                    className={`text-xs truncate ${
                      item.href ? "text-bw-blue group-hover:underline" : "text-gray-700"
                    }`}
                    title={item.name}
                  >
                    {item.name}
                  </div>
                  {item.sub && (
                    <div className="text-[11px] text-gray-400 truncate">
                      {item.sub}
                    </div>
                  )}
                  {item.detail && (
                    <div className="text-[11px] text-gray-400 font-mono tabular-nums mt-0.5">
                      {item.detail}
                    </div>
                  )}
                </div>
                {!isCount && formatValue && (
                  <div className="w-[104px] shrink-0 text-right text-xs font-mono tabular-nums text-gray-800 pt-px">
                    {item.value != null ? formatValue(item.value) : "—"}
                  </div>
                )}
              </>
            );

            return item.href ? (
              <a
                key={i}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                {inner}
              </a>
            ) : (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                {inner}
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50/80">
        <span className="text-[11px] font-medium text-gray-500 shrink-0">
          {totalLabel || (isCount ? "項目數 Count" : "總計 Total")}
        </span>
        <span
          className={`font-mono font-semibold text-gray-900 text-right ${
            isCount ? "text-xs" : "text-xs tabular-nums w-[104px]"
          }`}
        >
          {isCount
            ? items.length
            : total != null && formatValue
              ? formatValue(total)
              : ""}
        </span>
      </div>
    </>
  );
}

/** Full-page listing panel — same rows as MetricHoverCard, without the hover shell. */
export function MetricBreakdownPanel({
  className,
  ...body
}: MetricBreakdownBodyProps & { className?: string }) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden ${className || ""}`}
    >
      <MetricBreakdownBody {...body} maxHeightClass={body.maxHeightClass || "max-h-[420px]"} />
    </div>
  );
}

interface MetricHoverCardProps {
  /** The rendered cell content (the number itself). */
  children: React.ReactNode;
  /** Column / metric label, shown as the breakdown heading. */
  title: string;
  /** Optional one-line explanation of how the number is derived. */
  formula?: string;
  /** The contributing records. */
  items: BreakdownItem[];
  /** Formats a numeric value for display. Required when items carry values. */
  formatValue?: (v: number) => string;
  /** Footer total label, e.g. "Total" or "Count". */
  totalLabel?: string;
  /** Pre-computed total to show in the footer (count or sum). */
  total?: number;
  /** Whether this is a count metric (footer shows count of items). */
  isCount?: boolean;
  align?: "start" | "center" | "end";
  /** Data-source badge (top-right) explaining which columns the number uses. */
  source?: MetricSource;
}

export default function MetricHoverCard({
  children,
  title,
  formula,
  items,
  formatValue,
  totalLabel,
  total,
  isCount,
  align = "end",
  source,
}: MetricHoverCardProps) {
  const hasItems = items.length > 0;

  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>
        <span
          className={
            hasItems
              ? "cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2"
              : ""
          }
        >
          {children}
        </span>
      </HoverCardTrigger>
      {hasItems && (
        <HoverCardContent
          align={align}
          // Count-only breakdowns are narrower (no value column); value
          // breakdowns are wider to fit a fixed-width, right-aligned amount.
          className={`p-0 overflow-hidden ${isCount ? "w-[300px]" : "w-[400px]"}`}
        >
          <MetricBreakdownBody
            title={title}
            formula={formula}
            items={items}
            formatValue={formatValue}
            totalLabel={totalLabel}
            total={total}
            isCount={isCount}
            source={source}
          />
        </HoverCardContent>
      )}
    </HoverCard>
  );
}
