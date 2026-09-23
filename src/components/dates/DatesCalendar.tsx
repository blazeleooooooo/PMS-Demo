"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  CalendarRange,
  Calendar as CalendarIcon,
  Loader2,
  Clock,
  MapPin,
  User,
  ArrowRight,
  DollarSign} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchCalendarSchedules,
  fetchCalendarIncomes,
  type CalendarScheduleItem,
  type CalendarIncomeItem,
  type StaffDirectoryRow,
} from "@/lib/data-service";
import { incomeNetOutstanding, isIncomeSettledByStatus } from "@/lib/income-outstanding";
import {
  isDueDateExpired,
  isIncomeUsingExpectedCalendarDate,
} from "@/lib/date-utils";
import { useRouter } from "next/navigation";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { AsanaLinkButton } from "@/components/ui/asana-link-button";
import StaffFilterBar, {
  EMPTY_STAFF_FILTERS,
  staffIdMatchesFilter,
  type StaffFilterState,
} from "@/components/reports/StaffFilterBar";

// ─── TYPES ───────────────────────────────────────────────
type ViewMode = "month" | "week" | "list";
type CalendarFilter = "all" | "schedules" | "incomes";

// Unified calendar event type
type CalendarEvent =
  | { kind: "schedule"; data: CalendarScheduleItem }
  | { kind: "income"; data: CalendarIncomeItem };

// ─── HELPERS ─────────────────────────────────────────────
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const WEEKDAYS_FULL = [
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
  "星期日",
];

const MONTHS_ZH = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
];

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

// Get Monday-based start of week
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

function getMonthCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Get the Monday before or on the first day
  const startDay = getStartOfWeek(firstDay);
  // Get the Sunday after or on the last day
  const endDay = getEndOfWeek(lastDay);

  const days: Date[] = [];
  const current = new Date(startDay);
  while (current <= endDay) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

// Stage color mapping — matches actual project_schedule_tasks.stage values
function getStageColor(stage: string | null): {
  bg: string;
  text: string;
  dot: string;
  border: string;
} {
  switch (stage) {
    case "Contract Stage":
      return {
        bg: "bg-indigo-50",
        text: "text-indigo-700",
        dot: "bg-indigo-500",
        border: "border-l-indigo-500"};
    case "Important Date Plan":
      return {
        bg: "bg-rose-50",
        text: "text-rose-700",
        dot: "bg-rose-500",
        border: "border-l-rose-500"};
    case "First 7 Days":
      return {
        bg: "bg-sky-50",
        text: "text-sky-700",
        dot: "bg-sky-500",
        border: "border-l-sky-500"};
    case "First 14 Days":
      return {
        bg: "bg-cyan-50",
        text: "text-cyan-700",
        dot: "bg-cyan-500",
        border: "border-l-cyan-500"};
    case "Technical Design Stage":
      return {
        bg: "bg-purple-50",
        text: "text-purple-700",
        dot: "bg-purple-500",
        border: "border-l-purple-500"};
    case "Place Order to Factory Stage":
      return {
        bg: "bg-amber-50",
        text: "text-amber-700",
        dot: "bg-amber-500",
        border: "border-l-amber-500"};
    case "Site Progress Report":
      return {
        bg: "bg-blue-50",
        text: "text-blue-700",
        dot: "bg-blue-500",
        border: "border-l-blue-500"};
    case "Expected Payment Schedule":
      return {
        bg: "bg-red-50",
        text: "text-red-700",
        dot: "bg-red-500",
        border: "border-l-red-500"};
    case "BWF Furniture Schedule":
      return {
        bg: "bg-orange-50",
        text: "text-orange-700",
        dot: "bg-orange-500",
        border: "border-l-orange-500"};
    case "Final Stage":
      return {
        bg: "bg-green-50",
        text: "text-green-700",
        dot: "bg-green-500",
        border: "border-l-green-500"};
    default:
      return {
        bg: "bg-slate-50",
        text: "text-slate-700",
        dot: "bg-slate-400",
        border: "border-l-slate-400"};
  }
}

function getProjectTypeBadge(type: "BWA" | "BWF") {
  return type === "BWF" ? (
    <Badge
      variant="outline"
      className="text-[12px] px-1.5 py-0 border-amber-400 text-amber-700 bg-amber-50 font-medium"
    >
      BWF
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="text-[12px] px-1.5 py-0 border-bw-blue text-bw-blue bg-blue-50/50 font-medium"
    >
      BWA
    </Badge>
  );
}

function openCalendarProject(
  projectType: "BWA" | "BWF",
  projectId: string | null,
  bwfProjectId: string | null,
) {
  if (projectType === "BWF" && bwfProjectId) {
    window.open(`/bwf/projects/${bwfProjectId}`, "_blank", "noopener");
    return;
  }
  if (projectId) {
    window.open(`/projects/bwa/${projectId}`, "_blank", "noopener");
  }
}

function matchesSourceFilter(
  sources: { bwa: boolean; bwf: boolean },
  projectId: string | null,
  bwfProjectId: string | null,
): boolean {
  const isBwa = !!projectId;
  const isBwf = !!bwfProjectId && !projectId;
  return (isBwa && sources.bwa) || (isBwf && sources.bwf);
}

// ─── SCHEDULE EVENT CHIP ─────────────────────────────────
function ScheduleChip({
  item,
  compact = false,
  onClick}: {
  item: CalendarScheduleItem;
  compact?: boolean;
  onClick?: () => void;
}) {
  const stageColor = getStageColor(item.task_stage);

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left text-[12px] leading-tight px-1.5 py-0.5 rounded ${stageColor.bg} ${stageColor.text} truncate border-l-2 ${stageColor.border} hover:opacity-80 transition-opacity`}
      >
        {item.task_display || item.project_name || item.project_code || "—"}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1 rounded-md ${stageColor.bg} border-l-2 ${stageColor.border} hover:shadow-sm transition-all group`}
    >
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${stageColor.dot} shrink-0`} />
        <span className={`text-xs font-medium ${stageColor.text} truncate`}>
          {item.task_display || item.project_name || "—"}
        </span>
      </div>
      <div className="text-[12px] text-slate-500 truncate mt-0.5 ml-3">
        {item.project_code || item.project_name}
      </div>
    </button>
  );
}

// ─── INCOME STATUS COLORS ─────────────────────────────────
function getIncomeStatusColor(item: CalendarIncomeItem): {
  bg: string;
  text: string;
  dot: string;
  border: string;
  label: string;
} {
  const isPaid = isIncomeSettledByStatus(item.payment_status);

  if (isPaid) {
    return {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
      border: "border-l-emerald-500",
      label: "已收款"};
  }
  if (isIncomeUsingExpectedCalendarDate(item)) {
    return {
      bg: "bg-sky-50",
      text: "text-sky-700",
      dot: "bg-sky-500",
      border: "border-l-sky-500",
      label: "預計收款"};
  }
  if (isDueDateExpired(item.due_date)) {
    return {
      bg: "bg-red-50",
      text: "text-red-700",
      dot: "bg-red-500",
      border: "border-l-red-500",
      label: "逾期"};
  }
  return {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    border: "border-l-amber-500",
    label: "待收款"};
}

// ─── INCOME DUE CHIP ──────────────────────────────────────
function IncomeDueChip({
  item,
  compact = false,
  onClick}: {
  item: CalendarIncomeItem;
  compact?: boolean;
  onClick?: () => void;
}) {
  const { formatMoney } = useFinancialFormat();
  const incomeDisplay = formatMoney(item.income_amount, { fallback: "$0", showZero: true });
  const statusColor = getIncomeStatusColor(item);
  const contractLabel = item.contract_type_name || item.type_display || "收入";
  const installmentLabel = item.invoice_number ? `第${item.invoice_number}期` : "";
  const displayText = installmentLabel
    ? `${contractLabel} ${installmentLabel}`
    : contractLabel;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left text-[12px] leading-tight px-1.5 py-0.5 rounded ${statusColor.bg} ${statusColor.text} truncate border-l-2 ${statusColor.border} hover:opacity-80 transition-opacity`}
      >
        💰 {displayText}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1 rounded-md ${statusColor.bg} border-l-2 ${statusColor.border} hover:shadow-sm transition-all group`}
    >
      <div className="flex items-center gap-1.5">
        <DollarSign className={`w-3 h-3 ${statusColor.text} shrink-0`} />
        <span className={`text-xs font-medium ${statusColor.text} truncate`}>
          {displayText}
        </span>
        <Badge
          variant="outline"
          className={`text-[11px] px-1 py-0 ml-auto shrink-0 ${statusColor.text} border-current`}
        >
          {statusColor.label}
        </Badge>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-slate-500 truncate mt-0.5 ml-[18px]">
        <span>{item.project_code || item.project_name || "—"}</span>
        <span>·</span>
        <span className="font-mono font-medium">{incomeDisplay}</span>
      </div>
    </button>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────
export default function DatesCalendar() {
  const router = useRouter();
  const { loading: permLoading } = usePermission();
  const { formatMoney } = useFinancialFormat();
  const incomeDisplayOpts = { fallback: "$0", showZero: true } as const;
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<CalendarScheduleItem[]>([]);
  const [incomes, setIncomes] = useState<CalendarIncomeItem[]>([]);
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>("all");
  const [sources, setSources] = useState({ bwa: true, bwf: true });
  const [staffFilter, setStaffFilter] = useState<StaffFilterState>(EMPTY_STAFF_FILTERS);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const todayRowRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToTodayRef = useRef(false);

  // Compute the date range to fetch
  const dateRange = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === "month") {
      // Fetch a bit extra for calendar overflow
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month + 2, 0);
      return { start: formatDate(start), end: formatDate(end) };
    } else if (viewMode === "week") {
      const weekStart = getStartOfWeek(currentDate);
      const weekEnd = getEndOfWeek(currentDate);
      return { start: formatDate(weekStart), end: formatDate(weekEnd) };
    } else {
      // List: show current month
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { start: formatDate(start), end: formatDate(end) };
    }
  }, [currentDate, viewMode]);

  // Fetch schedules + incomes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchCalendarSchedules(dateRange.start, dateRange.end),
      fetchCalendarIncomes(dateRange.start, dateRange.end),
    ]).then(([scheduleData, incomeData]) => {
      if (!cancelled) {
        setSchedules(scheduleData);
        setIncomes(incomeData);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dateRange.start, dateRange.end]);

  const toggleSource = (key: "bwa" | "bwf") => {
    setSources((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Keep at least one source selected
      if (!next.bwa && !next.bwf) return prev;
      return next;
    });
  };

  // Filter out schedules with no task_display (show as "排程" = meaningless placeholder)
  const validSchedules = useMemo(() => {
    return schedules.filter(
      (item) =>
        item.task_display &&
        item.task_display.trim() !== "" &&
        matchesSourceFilter(sources, item.project_id, item.bwf_project_id) &&
        staffIdMatchesFilter(item.pm_id, staffFilter, staffDirectory)
    );
  }, [schedules, sources, staffFilter, staffDirectory]);

  const visibleIncomes = useMemo(() => {
    return incomes.filter(
      (item) =>
        matchesSourceFilter(sources, item.project_id, item.bwf_project_id) &&
        staffIdMatchesFilter(item.pm_id, staffFilter, staffDirectory)
    );
  }, [incomes, sources, staffFilter, staffDirectory]);

  // Group all events by date (unified CalendarEvent[])
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    // Add schedule events
    if (calendarFilter !== "incomes") {
      for (const item of validSchedules) {
        if (!item.date) continue;
        const key = item.date.substring(0, 10);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ kind: "schedule", data: item });
      }
    }

    // Add income events
    if (calendarFilter !== "schedules") {
      for (const item of visibleIncomes) {
        const key = item.calendar_date || item.due_date?.substring(0, 10);
        if (!key) continue;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ kind: "income", data: item });
      }
    }

    return map;
  }, [validSchedules, visibleIncomes, calendarFilter]);

  // Scroll to today's row in list view
  const scrollToToday = useCallback(() => {
    // Small delay to ensure DOM is rendered
    setTimeout(() => {
      if (todayRowRef.current) {
        todayRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }, []);

  // Auto-scroll to today on first list view load
  useEffect(() => {
    if (viewMode === "list" && !loading && !hasScrolledToTodayRef.current) {
      hasScrolledToTodayRef.current = true;
      scrollToToday();
    }
  }, [viewMode, loading, scrollToToday]);

  // Reset scroll flag when switching away from list view
  useEffect(() => {
    if (viewMode !== "list") {
      hasScrolledToTodayRef.current = false;
    }
  }, [viewMode]);

  // Navigate handlers
  const goToday = useCallback(() => {
    const now = new Date();
    setCurrentDate(now);
    // If in list view, scroll to today
    if (viewMode === "list") {
      // If already on today's month, just scroll directly
      if (now.getMonth() === currentDate.getMonth() && now.getFullYear() === currentDate.getFullYear()) {
        scrollToToday();
      } else {
        // Data will reload — use the flag to auto-scroll after load
        hasScrolledToTodayRef.current = false;
      }
    }
  }, [viewMode, currentDate, scrollToToday]);

  const goPrev = useCallback(() => {
    const d = new Date(currentDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  }, [currentDate, viewMode]);

  const goNext = useCallback(() => {
    const d = new Date(currentDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  }, [currentDate, viewMode]);

  const handleProjectClick = (item: CalendarScheduleItem) => {
    openCalendarProject(item.project_type, item.project_id, item.bwf_project_id);
  };

  const handleIncomeClick = (item: CalendarIncomeItem) => {
    openCalendarProject(item.project_type, item.project_id, item.bwf_project_id);
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.kind === "schedule") {
      handleProjectClick(event.data);
    } else {
      handleIncomeClick(event.data);
    }
  };

  // ─── TITLE ──────────────────────────────────────────────
  const title = useMemo(() => {
    if (viewMode === "week") {
      const start = getStartOfWeek(currentDate);
      const end = getEndOfWeek(currentDate);
      return `${start.getMonth() + 1}月${start.getDate()}日 — ${end.getMonth() + 1}月${end.getDate()}日, ${end.getFullYear()}`;
    }
    return `${MONTHS_ZH[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [currentDate, viewMode]);

  // ─── MONTH VIEW ─────────────────────────────────────────
  const renderMonthView = () => {
    const days = getMonthCalendarDays(
      currentDate.getFullYear(),
      currentDate.getMonth()
    );

    return (
      <div className="grid grid-cols-7 border-t border-l border-slate-200 rounded-lg overflow-hidden">
        {/* Header */}
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={`px-2 py-2.5 text-center text-xs font-semibold border-b border-r border-slate-200 ${
              i >= 5 ? "text-slate-400 bg-slate-50/50" : "text-slate-600 bg-white"
            }`}
          >
            {day}
          </div>
        ))}
        {/* Days */}
        {days.map((day) => {
          const dateStr = formatDate(day);
          const dayEvents = eventsByDate.get(dateStr) || [];
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isTodayCell = isToday(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div
              key={dateStr}
              className={`min-h-[100px] border-b border-r border-slate-200 p-1.5 cursor-pointer transition-colors ${
                !isCurrentMonth
                  ? "bg-slate-50/80"
                  : isWeekend
                    ? "bg-slate-50/30"
                    : "bg-white"
              } ${isSelected ? "ring-2 ring-inset ring-bw-blue/40" : ""} hover:bg-blue-50/30`}
              onClick={() => setSelectedDate(day)}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    isTodayCell
                      ? "bg-bw-blue text-white"
                      : !isCurrentMonth
                        ? "text-slate-300"
                        : "text-slate-700"
                  }`}
                >
                  {day.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[11px] text-slate-400 font-medium">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) =>
                  event.kind === "schedule" ? (
                    <ScheduleChip
                      key={`s-${event.data.id}`}
                      item={event.data}
                      compact
                      onClick={() => handleProjectClick(event.data)}
                    />
                  ) : (
                    <IncomeDueChip
                      key={`i-${event.data.id}`}
                      item={event.data}
                      compact
                      onClick={() => handleIncomeClick(event.data)}
                    />
                  )
                )}
                {dayEvents.length > 3 && (
                  <div className="text-[11px] text-slate-400 pl-1.5">
                    +{dayEvents.length - 3} 更多
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── WEEK VIEW ──────────────────────────────────────────
  const renderWeekView = () => {
    const weekStart = getStartOfWeek(currentDate);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }

    return (
      <div className="grid grid-cols-7 gap-3">
        {days.map((day, i) => {
          const dateStr = formatDate(day);
          const dayEvents = eventsByDate.get(dateStr) || [];
          const isTodayCell = isToday(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <div
              key={dateStr}
              className={`rounded-xl border transition-all cursor-pointer ${
                isTodayCell
                  ? "border-bw-blue/30 bg-blue-50/30 shadow-sm"
                  : isSelected
                    ? "border-bw-blue/20 bg-white shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
              onClick={() => setSelectedDate(day)}
            >
              {/* Day Header */}
              <div className={`text-center py-3 border-b ${isTodayCell ? "border-bw-blue/20" : "border-slate-100"}`}>
                <div className="text-[12px] text-slate-400 font-medium">
                  {WEEKDAYS_FULL[i]}
                </div>
                <div
                  className={`text-lg font-bold mt-0.5 ${
                    isTodayCell ? "text-bw-blue" : "text-slate-800"
                  }`}
                >
                  {day.getDate()}
                </div>
                <div className="text-[12px] text-slate-400">
                  {day.getMonth() + 1}月
                </div>
              </div>
              {/* Events */}
              <div className="p-2 space-y-1.5 min-h-[120px]">
                {dayEvents.length === 0 && (
                  <div className="text-[12px] text-slate-300 text-center mt-4">
                    無排程
                  </div>
                )}
                {dayEvents.map((event) =>
                  event.kind === "schedule" ? (
                    <ScheduleChip
                      key={`s-${event.data.id}`}
                      item={event.data}
                      onClick={() => handleProjectClick(event.data)}
                    />
                  ) : (
                    <IncomeDueChip
                      key={`i-${event.data.id}`}
                      item={event.data}
                      onClick={() => handleIncomeClick(event.data)}
                    />
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── LIST VIEW ──────────────────────────────────────────
  const renderListView = () => {
    // Group by date, sorted
    const sortedDates = Array.from(eventsByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([dateStr]) => {
        const d = new Date(dateStr);
        return d.getMonth() === currentDate.getMonth();
      });

    // Ensure today is included if we're viewing the current month
    const today = new Date();
    const todayStr = formatDate(today);
    if (today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()) {
      const hasTodayEntry = sortedDates.some(([d]) => d === todayStr);
      if (!hasTodayEntry) {
        // Insert today with empty items at the right sorted position
        const insertIdx = sortedDates.findIndex(([d]) => d > todayStr);
        if (insertIdx === -1) {
          sortedDates.push([todayStr, []]);
        } else {
          sortedDates.splice(insertIdx, 0, [todayStr, []]);
        }
      }
    }

    if (sortedDates.length === 0 && !loading) {
      return (
        <div className="text-center py-16">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">本月暫無排程</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {sortedDates.map(([dateStr, events]) => {
          const date = new Date(dateStr + "T00:00:00");
          const dayOfWeek = date.getDay();
          const weekdayIdx =
            dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const isTodayRow = isToday(date);
          const scheduleCount = events.filter(e => e.kind === "schedule").length;
          const incomeCount = events.filter(e => e.kind === "income").length;

          return (
            <div key={dateStr} className="animate-cascade-in" ref={isTodayRow ? todayRowRef : undefined}>
              {/* Date Header */}
              <div
                className={`flex items-center gap-3 mb-2 px-1 ${
                  isTodayRow ? "text-bw-blue" : "text-slate-700"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 ${
                    isTodayRow
                      ? "bg-bw-blue text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <span className="text-sm font-bold leading-none">
                    {date.getDate()}
                  </span>
                  <span className="text-[11px] leading-none mt-0.5">
                    {WEEKDAYS[weekdayIdx]}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {date.getMonth() + 1}月{date.getDate()}日{" "}
                    {WEEKDAYS_FULL[weekdayIdx]}
                  </div>
                  <div className="text-[12px] text-slate-400 flex items-center gap-2">
                    {scheduleCount > 0 && <span>{scheduleCount} 個排程</span>}
                    {incomeCount > 0 && <span className="text-amber-600">💰 {incomeCount} 筆到期</span>}
                    {events.length === 0 && <span>無事項</span>}
                  </div>
                </div>
                {isTodayRow && (
                  <Badge className="bg-bw-blue text-white text-[12px] px-2 ml-auto">
                    今日
                  </Badge>
                )}
              </div>
              {/* Items */}
              <div className="space-y-2 ml-[52px]">
                {events.length === 0 && (
                  <div className="text-xs text-slate-400 py-2">此日期暫無排程</div>
                )}
                {events.map((event) => {
                  if (event.kind === "schedule") {
                    const item = event.data;
                    const stageColor = getStageColor(item.task_stage);
                    return (
                      <div
                        key={`s-${item.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleProjectClick(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleProjectClick(item);
                          }
                        }}
                        className={`w-full text-left bg-white rounded-lg border border-slate-200 ${stageColor.border} border-l-[3px] p-3 hover:shadow-md hover:border-slate-300 transition-all group cursor-pointer`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className={`w-2 h-2 rounded-full ${stageColor.dot} shrink-0`}
                              />
                              <span className="text-sm font-semibold text-slate-800 truncate">
                                {item.task_display || item.project_name || "—"}
                              </span>
                              {getProjectTypeBadge(item.project_type)}
                            </div>
                            {item.project_name && (
                              <div className="text-sm text-slate-700 truncate ml-4 mb-1">
                                {item.project_name}
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-xs text-slate-500 ml-4">
                              {item.project_code && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {item.project_code}
                                </span>
                              )}
                              {item.pm_name && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {item.pm_name}
                                </span>
                              )}
                              {item.task_stage && (
                                <Badge
                                  variant="outline"
                                  className={`text-[12px] px-1.5 py-0 ${stageColor.text} border-current`}
                                >
                                  {item.task_stage}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 mt-0.5">
                            <AsanaLinkButton href={item.asana_link} />
                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-bw-blue group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // Income event
                    const item = event.data;
                    const statusColor = getIncomeStatusColor(item);
                    const contractLabel = item.contract_type_name || item.type_display || "收入";
                    const installmentLabel = item.invoice_number ? `第${item.invoice_number}期` : "";
                    const displayText = installmentLabel
                      ? `${contractLabel} ${installmentLabel}`
                      : contractLabel;

                    return (
                      <div
                        key={`i-${item.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleIncomeClick(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleIncomeClick(item);
                          }
                        }}
                        className={`w-full text-left bg-white rounded-lg border border-slate-200 ${statusColor.border} border-l-[3px] p-3 hover:shadow-md hover:border-slate-300 transition-all group cursor-pointer`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <DollarSign className={`w-3.5 h-3.5 ${statusColor.text} shrink-0`} />
                              <span className="text-sm font-semibold text-slate-800 truncate">
                                {displayText}
                              </span>
                              {getProjectTypeBadge(item.project_type)}
                              <Badge
                                variant="outline"
                                className={`text-[12px] px-1.5 py-0 ${statusColor.text} border-current shrink-0`}
                              >
                                {statusColor.label}
                              </Badge>
                            </div>
                            {item.project_name && (
                              <div className="text-sm text-slate-700 truncate ml-[22px] mb-1">
                                {item.project_name}
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-xs text-slate-500 ml-[22px]">
                              {item.project_code && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {item.project_code}
                                </span>
                              )}
                              <span className="font-mono font-semibold text-slate-700">
                                {formatMoney(item.income_amount, incomeDisplayOpts)}
                              </span>
                              {incomeNetOutstanding(item) > 0 && (
                                <span className="text-red-500 font-mono">
                                  待收 {formatMoney(incomeNetOutstanding(item), incomeDisplayOpts)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 mt-0.5">
                            <AsanaLinkButton href={item.asana_link} />
                            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── SELECTED DATE PANEL ────────────────────────────────
  const renderSelectedDatePanel = () => {
    if (!selectedDate || viewMode === "list") return null;
    const dateStr = formatDate(selectedDate);
    const events = eventsByDate.get(dateStr) || [];
    const dayOfWeek = selectedDate.getDay();
    const weekdayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    return (
      <Card className="mt-4 border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-bw-blue" />
            {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日{" "}
            {WEEKDAYS_FULL[weekdayIdx]}
            {isToday(selectedDate) && (
              <Badge className="bg-bw-blue text-white text-[12px] px-2 ml-2">
                今日
              </Badge>
            )}
            <span className="text-slate-400 font-normal ml-auto">
              {events.length} 個事項
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              此日期暫無排程
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                if (event.kind === "schedule") {
                  const item = event.data;
                  const stageColor = getStageColor(item.task_stage);
                  return (
                    <button
                      key={`s-${item.id}`}
                      onClick={() => handleProjectClick(item)}
                      className={`w-full text-left bg-white rounded-lg border border-slate-200 ${stageColor.border} border-l-[3px] p-3 hover:shadow-md hover:border-slate-300 transition-all group`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${stageColor.dot} shrink-0`}
                        />
                        <span className="text-sm font-semibold text-slate-800 truncate flex-1">
                          {item.task_display || item.project_name || "—"}
                        </span>
                        {getProjectTypeBadge(item.project_type)}
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-bw-blue transition-colors" />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 ml-4">
                        {(item.project_code || item.project_name) && (
                          <span>
                            {item.project_code || item.project_name}
                          </span>
                        )}
                        {item.pm_name && <span>PM: {item.pm_name}</span>}
                      </div>
                    </button>
                  );
                } else {
                  const item = event.data;
                  const statusColor = getIncomeStatusColor(item);
                  const contractLabel = item.contract_type_name || item.type_display || "收入";
                  const installmentLabel = item.invoice_number ? `第${item.invoice_number}期` : "";
                  const displayText = installmentLabel
                    ? `${contractLabel} ${installmentLabel}`
                    : contractLabel;

                  return (
                    <button
                      key={`i-${item.id}`}
                      onClick={() => handleIncomeClick(item)}
                      className={`w-full text-left bg-white rounded-lg border border-slate-200 ${statusColor.border} border-l-[3px] p-3 hover:shadow-md hover:border-slate-300 transition-all group`}
                    >
                      <div className="flex items-center gap-2">
                        <DollarSign className={`w-3.5 h-3.5 ${statusColor.text} shrink-0`} />
                        <span className="text-sm font-semibold text-slate-800 truncate flex-1">
                          {displayText}
                        </span>
                        {getProjectTypeBadge(item.project_type)}
                        <Badge
                          variant="outline"
                          className={`text-[12px] px-1.5 py-0 ${statusColor.text} border-current`}
                        >
                          {statusColor.label}
                        </Badge>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 ml-[22px]">
                        {(item.project_code || item.project_name) && (
                          <span>{item.project_code || item.project_name}</span>
                        )}
                        <span className="font-mono font-semibold text-slate-700">{formatMoney(item.income_amount, incomeDisplayOpts)}</span>
                      </div>
                    </button>
                  );
                }
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ─── STATS BAR ──────────────────────────────────────────
  const stats = useMemo(() => {
    const uniqueProjects = new Set(
      [
        ...validSchedules.map((s) => s.project_id || s.bwf_project_id),
        ...visibleIncomes.map((i) => i.project_id || i.bwf_project_id),
      ].filter(Boolean)
    ).size;
    const todayStr = formatDate(new Date());
    const todayEvents = eventsByDate.get(todayStr) || [];
    const todayCount = todayEvents.length;
    const incomeCount = visibleIncomes.length;
    const overdueIncomes = visibleIncomes.filter(i => {
      const isPaid = isIncomeSettledByStatus(i.payment_status);
      return !isPaid && i.due_date && new Date(i.due_date) < new Date();
    }).length;
    return { uniqueProjects, todayCount, total: validSchedules.length + visibleIncomes.length, incomeCount, overdueIncomes };
  }, [validSchedules, visibleIncomes, eventsByDate]);

  // ─── RENDER ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-bw-blue" />
            重要日子
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            BWA / BWF 工程項目排程及收款到期日曆總覽
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm">
            <span className="text-xs text-gray-400 px-1.5 whitespace-nowrap">數據來源</span>
            <button
              type="button"
              onClick={() => toggleSource("bwa")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                sources.bwa
                  ? "bg-bw-blue/10 text-bw-blue"
                  : "text-gray-400 hover:bg-gray-50 line-through decoration-gray-300"
              }`}
            >
              BWA
            </button>
            <button
              type="button"
              onClick={() => toggleSource("bwf")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                sources.bwf
                  ? "bg-bw-blue/10 text-bw-blue"
                  : "text-gray-400 hover:bg-gray-50 line-through decoration-gray-300"
              }`}
            >
              BWF
            </button>
          </div>

        {/* View Tabs */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
        >
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger
              value="month"
              className="data-[state=active]:bg-bw-blue data-[state=active]:text-white text-xs gap-1.5"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              月覽
            </TabsTrigger>
            <TabsTrigger
              value="week"
              className="data-[state=active]:bg-bw-blue data-[state=active]:text-white text-xs gap-1.5"
            >
              <CalendarRange className="w-3.5 h-3.5" />
              週覽
            </TabsTrigger>
            <TabsTrigger
              value="list"
              className="data-[state=active]:bg-bw-blue data-[state=active]:text-white text-xs gap-1.5"
            >
              <List className="w-3.5 h-3.5" />
              列表
            </TabsTrigger>
          </TabsList>
        </Tabs>
        </div>
      </div>

      <StaffFilterBar
        value={staffFilter}
        onChange={setStaffFilter}
        onDirectoryLoaded={setStaffDirectory}
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-bw-blue" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800 font-mono-num">
                {stats.total}
              </div>
              <div className="text-[12px] text-slate-500">事項總數</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-bw-amber" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800 font-mono-num">
                {stats.todayCount}
              </div>
              <div className="text-[12px] text-slate-500">今日事項</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-bw-violet" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800 font-mono-num">
                {stats.uniqueProjects}
              </div>
              <div className="text-[12px] text-slate-500">涉及項目</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800 font-mono-num">
                {stats.incomeCount}
              </div>
              <div className="text-[12px] text-slate-500">收款到期</div>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-slate-200 shadow-sm ${stats.overdueIncomes > 0 ? "border-red-200" : ""}`}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stats.overdueIncomes > 0 ? "bg-red-50" : "bg-slate-50"}`}>
              <DollarSign className={`w-4 h-4 ${stats.overdueIncomes > 0 ? "text-red-500" : "text-slate-400"}`} />
            </div>
            <div>
              <div className={`text-lg font-bold font-mono-num ${stats.overdueIncomes > 0 ? "text-red-600" : "text-slate-800"}`}>
                {stats.overdueIncomes}
              </div>
              <div className="text-[12px] text-slate-500">逾期收款</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goPrev}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToday}
                className="h-8 text-xs px-3"
              >
                今日
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goNext}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <h2 className="text-base font-bold text-slate-800">{title}</h2>
            <div className="flex items-center gap-1.5">
              {loading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-bw-blue mr-2" />
              )}
              <Button
                variant={calendarFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setCalendarFilter("all")}
                className={`h-7 text-[13px] px-2.5 ${calendarFilter === "all" ? "bg-slate-800 text-white" : ""}`}
              >
                全部
              </Button>
              <Button
                variant={calendarFilter === "schedules" ? "default" : "outline"}
                size="sm"
                onClick={() => setCalendarFilter("schedules")}
                className={`h-7 text-[13px] px-2.5 ${calendarFilter === "schedules" ? "bg-bw-blue text-white" : ""}`}
              >
                📅 工程排程
              </Button>
              <Button
                variant={calendarFilter === "incomes" ? "default" : "outline"}
                size="sm"
                onClick={() => setCalendarFilter("incomes")}
                className={`h-7 text-[13px] px-2.5 ${calendarFilter === "incomes" ? "bg-amber-500 text-white hover:bg-amber-600" : ""}`}
              >
                💰 收款到期
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Content */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-4">
          {loading && schedules.length === 0 && incomes.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-bw-blue mx-auto mb-3" />
                <p className="text-slate-500 text-sm">正在載入排程資料...</p>
              </div>
            </div>
          ) : viewMode === "month" ? (
            renderMonthView()
          ) : viewMode === "week" ? (
            renderWeekView()
          ) : (
            renderListView()
          )}
        </CardContent>
      </Card>

      {/* Selected Date Detail Panel */}
      {renderSelectedDatePanel()}
    </div>
  );
}
