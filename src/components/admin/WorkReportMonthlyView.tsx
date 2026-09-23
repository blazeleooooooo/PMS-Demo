"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Check, FilePenLine, Loader2 } from "lucide-react";
import type {
  DayReportStatus,
  MonthlyDayCell,
  MonthlyStaffCard,
} from "@/lib/work-report-monthly";

export type { DayReportStatus, MonthlyDayCell, MonthlyStaffCard };
export {
  buildMonthWeeks,
  isRestDay,
  MAINLAND_CHINA_BU_ID,
} from "@/lib/work-report-monthly";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const AVATAR_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

function StatusIcon({ status }: { status: DayReportStatus }) {
  if (status === "complete") {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"
        title="已填"
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-400 text-white"
        title="暫存"
      >
        <FilePenLine className="h-3 w-3" />
      </span>
    );
  }
  if (status === "leave") {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-amber-400 text-[10px] font-semibold text-white"
        title="假 — 當日工時為 0"
      >
        假
      </span>
    );
  }
  if (status === "rest") {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-semibold text-white"
        title="休 — 周六日 / 公眾假"
      >
        休
      </span>
    );
  }
  return null;
}

function StaffMonthCard({
  card,
  todayStr,
}: {
  card: MonthlyStaffCard;
  todayStr: string;
}) {
  const subtitle = [card.position, card.buName, card.teamName].filter(Boolean).join(" · ") || "—";

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(card.name)}`}
          >
            {initialOf(card.name)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#1A2035] truncate">{card.name}</p>
            <p className="text-xs text-gray-500 truncate">{subtitle}</p>
          </div>
        </div>
        <div
          className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${
            card.missingCount > 0
              ? "bg-red-50 text-red-600"
              : "bg-emerald-50 text-emerald-700"
          }`}
          title="本月未完成工作日數（未填寫或暫存；今日及入職日前不計）"
        >
          缺 {card.missingCount}
        </div>
      </div>

      <div className="px-3 pb-3 overflow-x-auto">
        <table className="w-full min-w-[280px] table-fixed border-collapse text-center">
          <colgroup>
            <col className="w-12" />
            {WEEKDAY_LABELS.map((label) => (
              <col key={label} />
            ))}
          </colgroup>
          <thead>
            <tr className="text-[11px] text-gray-400">
              <th className="py-1.5 font-medium">週</th>
              {WEEKDAY_LABELS.map((label) => (
                <th key={label} className="border-l border-gray-100 py-1.5 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {card.weeks.map((week, wi) => (
              <tr key={wi} className="border-t border-gray-100">
                <td className="py-1 text-[11px] text-gray-400 whitespace-nowrap">
                  第{wi + 1}週
                </td>
                {week.map((cell, di) => {
                  if (!cell) {
                    return (
                      <td key={di} className="border-l border-gray-100 p-0.5 h-12" />
                    );
                  }
                  const isToday = cell.dateStr === todayStr;
                  const content = (
                    <div
                      className={`relative flex h-11 w-full flex-col items-center justify-center rounded-md ${
                        isToday
                          ? "bg-blue-50 ring-2 ring-bw-blue ring-inset"
                          : "hover:bg-gray-50"
                      }`}
                      title={isToday ? "今天" : undefined}
                    >
                      <span
                        className={`absolute right-0.5 top-0.5 text-[10px] leading-none tabular-nums ${
                          isToday
                            ? "font-semibold text-bw-blue"
                            : "text-gray-400"
                        }`}
                      >
                        {isToday ? "今" : cell.dayOfMonth}
                      </span>
                      <div className="mt-1">
                        <StatusIcon status={cell.status} />
                      </div>
                    </div>
                  );
                  return (
                    <td key={di} className="border-l border-gray-100 p-0.5 align-middle overflow-hidden">
                      {cell.manHourDateId ? (
                        <Link
                          href={`/reports/${cell.manHourDateId}`}
                          className="block"
                          title="查看匯報詳情"
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface WorkReportMonthlyViewProps {
  cards: MonthlyStaffCard[];
  loading: boolean;
  emptyMessage?: string;
}

export default function WorkReportMonthlyView({
  cards,
  loading,
  emptyMessage = "沒有符合條件的員工",
}: WorkReportMonthlyViewProps) {
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const legend = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 ring-2 ring-bw-blue ring-inset text-[9px] font-semibold text-bw-blue">
            今
          </span>
          今天
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StatusIcon status="complete" /> 已填
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StatusIcon status="leave" /> 假 — 工時 0
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StatusIcon status="draft" /> 暫存
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StatusIcon status="rest" /> 休 — 周六日 / 公眾假（內地 BU 用中國假期）
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-5 w-5 rounded-md border border-dashed border-gray-300" />{" "}
          未填寫
        </span>
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-4">
      {legend}

      {loading && cards.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {cards.map((card) => (
            <StaffMonthCard key={card.staffId} card={card} todayStr={todayStr} />
          ))}
        </div>
      )}
    </div>
  );
}
