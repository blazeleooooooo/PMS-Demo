"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import StaffFilterBar, {
  EMPTY_STAFF_FILTERS,
  type StaffFilterState,
} from "@/components/reports/StaffFilterBar";
import WorkReportMonthlyView from "@/components/admin/WorkReportMonthlyView";
import { useHolidays } from "@/hooks/use-holidays";
import { usePermission } from "@/hooks/use-permission";
import type { StaffDirectoryRow } from "@/lib/data-service";
import {
  fetchMonthlyStaffCards,
  type MonthlyStaffCard,
} from "@/lib/work-report-monthly";
import {
  calcManHourReportCompletion,
  getManHourDatesForStaffOnDay,
  getManHourTasksByDateIds,
  type ManHourDate,
} from "@/lib/man-hour-service";

const DEFAULT_STAFF_FILTER: StaffFilterState = {
  ...EMPTY_STAFF_FILTERS,
  status: "Active",
  position: "PM_or_Designer",
};

type ViewMode = "daily" | "monthly";
type SortKey = "name" | "position" | "status" | "progress";
type SortDir = "asc" | "desc";
type CompletionFilter = "all" | "incomplete" | "complete";

interface StaffReportRow {
  staffId: string;
  name: string;
  position: string | null;
  status: string;
  buName: string | null;
  teamName: string | null;
  manHourDateId: string | null;
  totalHours: number;
  sumTaskHours: number;
  taskCompletionPct: number;
  isReportComplete: boolean;
  hasReport: boolean;
}

function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export default function WorkReportCheck() {
  const { loading: permLoading } = usePermission();
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [targetDate, setTargetDate] = useState<Date>(() => new Date());
  const [monthCursor, setMonthCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [staffFilter, setStaffFilter] = useState<StaffFilterState>(DEFAULT_STAFF_FILTER);
  const [staffIds, setStaffIds] = useState<Set<string>>(new Set());
  const [directory, setDirectory] = useState<StaffDirectoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StaffReportRow[]>([]);
  const [monthlyCards, setMonthlyCards] = useState<MonthlyStaffCard[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("all");

  const dateStr = toDateStr(targetDate);
  const monthYears = useMemo(() => {
    const y = monthCursor.getFullYear();
    // Include adjacent year when month grid might touch Dec/Jan holidays.
    return monthCursor.getMonth() === 0 || monthCursor.getMonth() === 11
      ? [y - 1, y, y + 1]
      : [y];
  }, [monthCursor]);
  const { holidayMap } = useHolidays(monthYears);
  const todayStr = toDateStr(new Date());

  const loadDaily = useCallback(async () => {
    if (staffIds.size === 0) {
      setRows([]);
      return;
    }

    setLoading(true);
    try {
      const staffIdList = Array.from(staffIds);
      const dates = await getManHourDatesForStaffOnDay(staffIdList, dateStr);
      const dateIds = dates.map((d) => d.id);
      const tasks = await getManHourTasksByDateIds(dateIds);

      const tasksByDateId = new Map<string, typeof tasks>();
      for (const t of tasks) {
        const list = tasksByDateId.get(t.man_hour_date_id) ?? [];
        list.push(t);
        tasksByDateId.set(t.man_hour_date_id, list);
      }

      const dateByStaffId = new Map<string, ManHourDate>();
      for (const d of dates) {
        if (d.staff_id) dateByStaffId.set(d.staff_id, d);
      }

      const nextRows: StaffReportRow[] = [];
      for (const staffId of staffIdList) {
        const staff = directory.find((s) => s.id === staffId);
        const dateRow = dateByStaffId.get(staffId);
        const staffTasks = dateRow ? tasksByDateId.get(dateRow.id) ?? [] : [];
        const totalHours = dateRow?.total_work_hour ?? 0;
        const { sumTaskHours, taskCompletionPct, isReportComplete } =
          calcManHourReportCompletion(totalHours, staffTasks);

        nextRows.push({
          staffId,
          name: staff?.name ?? staffId,
          position: staff?.position ?? null,
          status: staff?.status ?? "—",
          buName: staff?.bu_name ?? null,
          teamName: staff?.team_name ?? null,
          manHourDateId: dateRow?.id ?? null,
          totalHours,
          sumTaskHours,
          taskCompletionPct,
          isReportComplete,
          hasReport: !!dateRow,
        });
      }

      setRows(nextRows);
    } catch (err) {
      console.error("[WorkReportCheck] load daily error:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [staffIds, dateStr, directory]);

  const loadMonthly = useCallback(async () => {
    if (staffIds.size === 0) {
      setMonthlyCards([]);
      return;
    }

    setLoading(true);
    try {
      const cards = await fetchMonthlyStaffCards({
        staffIds: Array.from(staffIds),
        directory,
        monthCursor,
        holidayMap,
        todayStr,
      });
      setMonthlyCards(cards);
    } catch (err) {
      console.error("[WorkReportCheck] load monthly error:", err);
      setMonthlyCards([]);
    } finally {
      setLoading(false);
    }
  }, [staffIds, monthCursor, directory, holidayMap, todayStr]);

  const loadData = useCallback(() => {
    if (viewMode === "monthly") return loadMonthly();
    return loadDaily();
  }, [viewMode, loadDaily, loadMonthly]);

  useEffect(() => {
    if (directory.length === 0) return;
    loadData();
  }, [loadData, directory]);

  const summary = useMemo(() => {
    const total = rows.length;
    const complete = rows.filter((r) => r.isReportComplete).length;
    const incomplete = total - complete;
    return { total, complete, incomplete };
  }, [rows]);

  const visibleRows = useMemo(() => {
    let list = rows;
    if (completionFilter === "complete") {
      list = list.filter((r) => r.isReportComplete);
    } else if (completionFilter === "incomplete") {
      list = list.filter((r) => !r.isReportComplete);
    }

    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name, "zh-Hant") * dir;
        case "position":
          return (a.position ?? "").localeCompare(b.position ?? "") * dir;
        case "progress":
          return (a.taskCompletionPct - b.taskCompletionPct) * dir;
        case "status":
        default: {
          const rank = (r: StaffReportRow) => (r.isReportComplete ? 1 : 0);
          return (rank(a) - rank(b)) * dir;
        }
      }
    });
  }, [rows, completionFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "status" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown className="w-3.5 h-3.5 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5" />
    );
  };

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
            <ClipboardCheck className="w-5 h-5 text-bw-blue" />
            <h1 className="text-xl font-semibold text-[#1A2035]">工作匯報檢查</h1>
          </div>
          <p className="text-sm text-gray-500">
            {viewMode === "daily"
              ? "檢視指定日期員工的工作匯報完成情況。完成標準：任務填報進度達 100%（任務工時 ≥ 當日工時）。"
              : "按月檢視每位員工的匯報狀態。綠色＝已填、黃色假＝工時 0、橙色＝暫存、紫色休＝周六日／公眾假（內地 BU 用中國假期）；缺＝尚未完成的工作日數（今日及入職日前不計）。"}
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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("daily")}
              className={`px-3.5 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === "daily"
                  ? "bg-white text-[#1A2035] shadow-sm font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              日報
            </button>
            <button
              type="button"
              onClick={() => setViewMode("monthly")}
              className={`px-3.5 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === "monthly"
                  ? "bg-white text-[#1A2035] shadow-sm font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              月報
            </button>
          </div>

          {viewMode === "daily" ? (
            <div className="flex flex-col gap-1">
              <span className="text-[12px] text-gray-400 font-medium">目標日期</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2 font-mono text-[14px]">
                    <CalendarIcon className="w-4 h-4" />
                    {format(targetDate, "yyyy/MM/dd (EEE)")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={targetDate}
                    onSelect={(d) => d && setTargetDate(d)}
                    initialFocus
                  />
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setTargetDate(new Date())}
                    >
                      今天
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
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
          )}

          {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
          {viewMode === "monthly" && staffIds.size > 0 && (
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

      {viewMode === "monthly" ? (
        <WorkReportMonthlyView
          cards={monthlyCards}
          loading={loading}
          emptyMessage={
            staffIds.size === 0 ? "請調整員工篩選條件" : "沒有符合條件的員工"
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setCompletionFilter("all")}
              className={`rounded-xl border p-4 text-left transition-colors ${
                completionFilter === "all"
                  ? "border-bw-blue bg-blue-50/50"
                  : "border-gray-100 bg-white hover:bg-gray-50"
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">篩選員工</p>
              <p className="text-2xl font-semibold text-[#1A2035]">{summary.total}</p>
            </button>
            <button
              type="button"
              onClick={() => setCompletionFilter("incomplete")}
              className={`rounded-xl border p-4 text-left transition-colors ${
                completionFilter === "incomplete"
                  ? "border-amber-400 bg-amber-50/50"
                  : "border-gray-100 bg-white hover:bg-gray-50"
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">未完成</p>
              <p className="text-2xl font-semibold text-amber-700">{summary.incomplete}</p>
            </button>
            <button
              type="button"
              onClick={() => setCompletionFilter("complete")}
              className={`rounded-xl border p-4 text-left transition-colors ${
                completionFilter === "complete"
                  ? "border-green-400 bg-green-50/50"
                  : "border-gray-100 bg-white hover:bg-gray-50"
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">已完成 (100%)</p>
              <p className="text-2xl font-semibold text-green-700">{summary.complete}</p>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead>
                    <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("name")}>
                      員工 <SortIcon col="name" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("position")}>
                      職位 <SortIcon col="position" />
                    </button>
                  </TableHead>
                  <TableHead>BU</TableHead>
                  <TableHead>團隊</TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("status")}>
                      狀態 <SortIcon col="status" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">當日工時</TableHead>
                  <TableHead className="text-right">任務工時</TableHead>
                  <TableHead className="min-w-[160px]">
                    <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("progress")}>
                      任務填報進度 <SortIcon col="progress" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffIds.size === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-gray-400 text-sm">
                      請調整員工篩選條件
                    </TableCell>
                  </TableRow>
                ) : loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-gray-400 text-sm">
                      沒有符合條件的員工
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.staffId}
                      className={row.isReportComplete ? undefined : "bg-amber-50/30"}
                    >
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-gray-600">{row.position ?? "—"}</TableCell>
                      <TableCell className="text-gray-500 text-sm">{row.buName ?? "—"}</TableCell>
                      <TableCell className="text-gray-500 text-sm">{row.teamName ?? "—"}</TableCell>
                      <TableCell>
                        {row.isReportComplete ? (
                          <span className="inline-flex items-center gap-1 text-green-700 text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            已完成
                          </span>
                        ) : !row.hasReport ? (
                          <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                            <XCircle className="w-4 h-4" />
                            未建立匯報
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 text-sm">
                            <XCircle className="w-4 h-4" />
                            未完成
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.hasReport ? row.totalHours.toFixed(1) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.hasReport ? row.sumTaskHours.toFixed(1) : "—"}
                      </TableCell>
                      <TableCell>
                        {row.hasReport && row.totalHours > 0 ? (
                          <div className="flex items-center gap-2">
                            <Progress
                              value={row.taskCompletionPct}
                              className="h-2 flex-1"
                              indicatorClassName={
                                row.isReportComplete ? "bg-green-500" : "bg-amber-500"
                              }
                            />
                            <span
                              className={`text-xs font-mono w-10 text-right ${
                                row.isReportComplete ? "text-green-700" : "text-amber-700"
                              }`}
                            >
                              {row.taskCompletionPct}%
                            </span>
                          </div>
                        ) : row.hasReport && row.totalHours === 0 ? (
                          <span className="text-xs text-gray-400">0h 當日</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.manHourDateId ? (
                          <Link
                            href={`/reports/${row.manHourDateId}`}
                            className="inline-flex items-center gap-1 text-xs text-bw-blue hover:underline"
                          >
                            詳情
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
