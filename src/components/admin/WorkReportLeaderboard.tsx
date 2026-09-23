"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import StaffFilterBar, {
  EMPTY_STAFF_FILTERS,
  type StaffFilterState,
} from "@/components/reports/StaffFilterBar";
import { useHolidays } from "@/hooks/use-holidays";
import { usePermission } from "@/hooks/use-permission";
import type { StaffDirectoryRow } from "@/lib/data-service";
import {
  fetchMonthlyStaffCards,
  type MonthlyStaffCard,
} from "@/lib/work-report-monthly";

const DEFAULT_STAFF_FILTER: StaffFilterState = {
  ...EMPTY_STAFF_FILTERS,
  status: "Active",
  position: "PM_or_Designer",
};

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

function StaffRow({
  card,
  rank,
  showMissing,
}: {
  card: MonthlyStaffCard;
  rank: number;
  showMissing: boolean;
}) {
  const subtitle =
    [card.position, card.buName, card.teamName].filter(Boolean).join(" · ") || "—";

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
      <span className="w-6 shrink-0 text-center text-xs font-mono text-gray-400 tabular-nums">
        {rank}
      </span>
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(card.name)}`}
      >
        {initialOf(card.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[#1A2035] truncate">{card.name}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
      {showMissing ? (
        <div
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold tabular-nums bg-red-50 text-red-600"
          title="本月未完成工作日數（未填寫或暫存；今日及入職日前不計）"
        >
          缺 {card.missingCount}
        </div>
      ) : (
        <div
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold tabular-nums bg-emerald-50 text-emerald-700"
          title="本月未完成工作日數（未填寫或暫存；今日及入職日前不計）"
        >
          缺 0
        </div>
      )}
    </div>
  );
}

function LeaderboardList({
  title,
  icon,
  cards,
  emptyLabel,
  accent,
  showMissing,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  cards: MonthlyStaffCard[];
  emptyLabel: string;
  accent: "green" | "red";
  showMissing: boolean;
  loading: boolean;
}) {
  const headerBg =
    accent === "green" ? "bg-emerald-50/80 border-emerald-100" : "bg-red-50/80 border-red-100";
  const countClass = accent === "green" ? "text-emerald-700" : "text-red-600";

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col min-h-[280px]">
      <div className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${headerBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h2 className="text-sm font-semibold text-[#1A2035] truncate">{title}</h2>
        </div>
        <span className={`text-sm font-semibold tabular-nums ${countClass}`}>
          {cards.length}
        </span>
      </div>
      <div className="flex-1">
        {loading && cards.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          </div>
        ) : cards.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">{emptyLabel}</div>
        ) : (
          cards.map((card, i) => (
            <StaffRow
              key={card.staffId}
              card={card}
              rank={i + 1}
              showMissing={showMissing}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function WorkReportLeaderboard() {
  const { loading: permLoading } = usePermission();
  const [monthCursor, setMonthCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [staffFilter, setStaffFilter] = useState<StaffFilterState>(DEFAULT_STAFF_FILTER);
  const [staffIds, setStaffIds] = useState<Set<string>>(new Set());
  const [directory, setDirectory] = useState<StaffDirectoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<MonthlyStaffCard[]>([]);

  const monthYears = useMemo(() => {
    const y = monthCursor.getFullYear();
    return monthCursor.getMonth() === 0 || monthCursor.getMonth() === 11
      ? [y - 1, y, y + 1]
      : [y];
  }, [monthCursor]);
  const { holidayMap } = useHolidays(monthYears);

  const loadData = useCallback(async () => {
    if (staffIds.size === 0) {
      setCards([]);
      return;
    }

    setLoading(true);
    try {
      const next = await fetchMonthlyStaffCards({
        staffIds: Array.from(staffIds),
        directory,
        monthCursor,
        holidayMap,
      });
      setCards(next);
    } catch (err) {
      console.error("[WorkReportLeaderboard] load error:", err);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [staffIds, directory, monthCursor, holidayMap]);

  useEffect(() => {
    if (directory.length === 0) return;
    loadData();
  }, [loadData, directory]);

  const { complete, incomplete } = useMemo(() => {
    const done: MonthlyStaffCard[] = [];
    const missing: MonthlyStaffCard[] = [];
    for (const card of cards) {
      if (card.missingCount === 0) done.push(card);
      else missing.push(card);
    }
    // Incomplete: highest missing first, then name
    missing.sort((a, b) => {
      if (b.missingCount !== a.missingCount) return b.missingCount - a.missingCount;
      return a.name.localeCompare(b.name, "zh-Hant");
    });
    return { complete: done, incomplete: missing };
  }, [cards]);

  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 text-bw-blue" />
            <h1 className="text-xl font-semibold text-[#1A2035]">工作匯報排行榜</h1>
          </div>
          <p className="text-sm text-gray-500">
            依月報「缺 n」分組：缺 0＝做齊匯報；缺 ≥ 1＝不齊工作匯報（與工作匯報檢查月報相同邏輯；今日及入職日前不計）。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading || staffIds.size === 0}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1"
              onClick={() => setMonthCursor((d) => startOfMonth(subMonths(d, 1)))}
            >
              <ChevronLeft className="w-4 h-4" />
              上一月
            </Button>
            <div className="min-w-[96px] h-9 px-3 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white font-mono text-sm tabular-nums">
              {format(monthCursor, "yyyy/M")}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1"
              onClick={() => setMonthCursor((d) => startOfMonth(addMonths(d, 1)))}
            >
              下一月
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-gray-500"
              onClick={() => setMonthCursor(startOfMonth(new Date()))}
            >
              本月
            </Button>
          </div>

          {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
          {staffIds.size > 0 && (
            <span className="text-xs text-gray-400 ml-auto">{staffIds.size} 人</span>
          )}
        </div>
      </div>

      <StaffFilterBar
        value={staffFilter}
        onChange={setStaffFilter}
        onResolvedIdsChange={setStaffIds}
        onDirectoryLoaded={setDirectory}
        clearTo={DEFAULT_STAFF_FILTER}
        activeOnly
      />

      {staffIds.size === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-400">
          請調整員工篩選條件
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LeaderboardList
            title="做齊匯報的同事"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            cards={complete}
            emptyLabel="本月尚無做齊匯報的同事"
            accent="green"
            showMissing={false}
            loading={loading}
          />
          <LeaderboardList
            title="不齊工作匯報"
            icon={<XCircle className="w-4 h-4 text-red-500 shrink-0" />}
            cards={incomplete}
            emptyLabel="本月全員已做齊匯報"
            accent="red"
            showMissing
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
