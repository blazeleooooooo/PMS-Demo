"use client";

import React from "react";
import { Clock, CalendarClock, Target, Layers, ListChecks } from "lucide-react";
import { formatDueDateZh } from "@/lib/design-job-service";
import { cn } from "@/lib/utils";

export interface DesignJobReportCardProps {
  workHour: number;
  displayName: string;
  description?: string | null;
  progressPct: number;
  accumHours: number;
  budgetHours: number;
  dueDate: string;
  designStage?: string | null;
  /** nos_tasks.display for this design job (任務選項). */
  nosTaskDisplay?: string | null;
  staffName?: string | null;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/** Accum / budget load color: ≤60 green, 61–80 yellow, 81–90 orange, >90 red. */
function budgetLoadBarClass(ratioPct: number): string {
  if (ratioPct <= 60) return "bg-emerald-500";
  if (ratioPct <= 80) return "bg-amber-400";
  if (ratioPct <= 90) return "bg-orange-500";
  return "bg-red-500";
}

export default function DesignJobReportCard({
  workHour,
  displayName,
  description,
  progressPct,
  accumHours,
  budgetHours,
  dueDate,
  designStage,
  nosTaskDisplay,
  staffName,
  className,
  onClick,
}: DesignJobReportCardProps) {
  const hoursLabel = Number.isInteger(workHour)
    ? `${workHour}h`
    : `${workHour}h`;

  const budget = Number(budgetHours) || 0;
  const accum = Number(accumHours) || 0;
  const loadRatioPct = budget > 0 ? (accum / budget) * 100 : 0;
  const barWidthPct = budget > 0 ? Math.min(100, Math.max(0, loadRatioPct)) : 0;
  const barColor = budgetLoadBarClass(loadRatioPct);

  // Hide description when it only repeats the nos_tasks label (common on daily feed).
  const nosLabel = (nosTaskDisplay || "").trim();
  const descText = (description || "").trim();
  const showDescription =
    !!descText && (!nosLabel || descText.toLowerCase() !== nosLabel.toLowerCase());

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80",
        "px-4 py-3 shadow-sm transition hover:border-slate-300 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40",
        onClick ? "cursor-pointer" : "cursor-default",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex shrink-0 items-center rounded-lg bg-slate-900 px-2.5 py-1 text-sm font-semibold tabular-nums text-white">
          {hoursLabel}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[15px] font-semibold text-slate-900">
              {displayName || "—"}
            </p>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
              {Math.round(progressPct)}%
            </span>
            {designStage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                <Layers className="h-3 w-3" />
                {designStage}
              </span>
            )}
          </div>
          {nosTaskDisplay ? (
            <p
              className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-slate-700"
              title={nosTaskDisplay}
            >
              <ListChecks className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{nosTaskDisplay}</span>
            </p>
          ) : null}
          {showDescription ? (
            <p className="mt-1 truncate text-sm text-slate-600" title={descText}>
              {descText}
            </p>
          ) : null}
          {staffName ? (
            <p className="mt-0.5 text-xs text-slate-400">{staffName}</p>
          ) : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              累積工時 <strong className="font-semibold text-slate-700">{accumHours}</strong> 小時
            </span>
            <span className="inline-flex items-center gap-1">
              <Target className="h-3.5 w-3.5 text-slate-400" />
              預算總工時 <strong className="font-semibold text-slate-700">{budgetHours}</strong> 小時
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
              {formatDueDateZh(dueDate)}
            </span>
          </div>

          {/* Accum vs budget load bar */}
          <div className="mt-2.5 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>工時使用</span>
              <span className="tabular-nums font-medium text-slate-600">
                {budget > 0 ? `${Math.round(loadRatioPct)}%` : "—"}
                {budget > 0 ? ` · ${accum}/${budget}h` : ""}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  budget > 0 ? barColor : "bg-slate-200"
                )}
                style={{ width: budget > 0 ? `${barWidthPct}%` : "0%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
