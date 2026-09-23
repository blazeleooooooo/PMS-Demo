"use client";

import React, { useState, useEffect, useMemo } from "react";
import { formatDate } from "@/lib/date-utils";
import {
  Clock,
  Loader2,
  User,
  BarChart3,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { AsanaIcon } from "@/components/ui/asana-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  getProjectManHourSummary,
  getPitchingManHourSummary,
  type ManHourTask,
} from "@/lib/man-hour-service";
import { createClient } from "@/lib/supabase/client";

interface ManHourPanelProps {
  projectBubbleId?: string | null;
  projectId: string;
  /** Override the permission module used for CRUD checks. Defaults to "projects". */
  permissionModule?: string;
  /** If set to "pitching", queries man_hour_tasks with job_type='bwa_pitching' instead of project lookup */
  mode?: "project" | "pitching";
}

/** Bubble legacy IDs (e.g. 1731576597786x341374473876419080) — never show in UI. */
function isBubbleId(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\d{10,}([×x]\d+)?$/.test(value.trim());
}

function safeStaffLabel(value: string | null | undefined, fallback = "未知用戶"): string {
  if (!value || isBubbleId(value)) return fallback;
  return value;
}

// ─── Extended task type with joined date info ───────────
interface EnrichedTask extends ManHourTask {
  report_date?: string;
  staff_id?: string;
  staff_display_name?: string;
}

// ─── Group man hours by staff ───────────────────────────
interface StaffSummary {
  staffName: string;
  totalHours: number;
  taskCount: number;
  tasks: EnrichedTask[];
}

// ─── Summary card ───────────────────────────────────────
function SummaryCard({
  label,
  value,
  subtext,
  icon: Icon,
  iconColor,
  bgColor,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-gray-400 uppercase tracking-wider font-medium">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1 font-mono-num">
            {value}
          </p>
          {subtext && (
            <p className="text-[13px] text-gray-500 mt-0.5">{subtext}</p>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgColor}`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

export default function ManHourPanel({
  projectBubbleId: _projectBubbleId,
  projectId,
  permissionModule: _permissionModule = "projects",
  mode = "project",
}: ManHourPanelProps) {
  const [tasks, setTasks] = useState<EnrichedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);

  // ─── Fetch man hours from Supabase (same source as /reports) ──
  useEffect(() => {
    async function load() {
      console.log(`[ManHourPanel] Starting load — ${mode === "pitching" ? "pitchingId" : "projectId"}:`, projectId);
      if (!projectId) {
        console.warn("[ManHourPanel] No ID provided, skipping fetch");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // Use appropriate function based on mode
        const { tasks: rawTasks } = mode === "pitching"
          ? await getPitchingManHourSummary(projectId)
          : await getProjectManHourSummary(projectId);
        console.log(`[ManHourPanel] Fetch result (${mode}):`, rawTasks.length, "tasks");

        // Display chain:
        // 1) staff_id → staff.name
        // 2) staff_bubble_id → OTC Staff Display Name / Name
        // 3) 未知用戶  (never show Bubble ID / created_by)
        const staffIds = new Set<string>();
        for (const t of rawTasks) {
          const sid = (t as any).man_hour_dates?.staff_id;
          if (sid) staffIds.add(sid);
        }

        const staffNameById: Record<string, string> = {};
        if (staffIds.size > 0) {
          const supabase = createClient();
          const { data: staffRows } = await supabase
            .from("staff")
            .select("id, name, full_name")
            .in("id", Array.from(staffIds));
          for (const row of staffRows || []) {
            if (row.id) {
              staffNameById[row.id] = row.name || row.full_name || "未知用戶";
            }
          }
        }

        // OTC fallback only for rows that still lack a PMS staff name
        const needOtc = new Set<string>();
        for (const t of rawTasks) {
          const dateInfo = (t as any).man_hour_dates as
            | { staff_id?: string | null; staff_bubble_id?: string | null }
            | undefined;
          const fromId = dateInfo?.staff_id
            ? staffNameById[dateInfo.staff_id]
            : undefined;
          if (!fromId && dateInfo?.staff_bubble_id) {
            needOtc.add(dateInfo.staff_bubble_id);
          }
        }

        const otcNameByBubble: Record<string, string> = {};
        if (needOtc.size > 0) {
          try {
            const res = await fetch("/api/otc-staff-display-names", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: Array.from(needOtc) }),
            });
            const json = await res.json();
            if (res.ok && json?.names) {
              for (const [bid, label] of Object.entries(json.names as Record<string, string>)) {
                const safe = safeStaffLabel(label, "");
                if (safe) otcNameByBubble[bid] = safe;
              }
            } else {
              console.warn("[ManHourPanel] OTC name resolve failed:", json?.error);
            }
          } catch (otcErr) {
            console.warn("[ManHourPanel] OTC name resolve error:", otcErr);
          }
        }

        const enriched: EnrichedTask[] = rawTasks.map((t) => {
          const dateInfo = (t as any).man_hour_dates as
            | {
                staff_id?: string | null;
                staff_bubble_id?: string | null;
                report_date?: string;
              }
            | undefined;
          const fromId = dateInfo?.staff_id
            ? staffNameById[dateInfo.staff_id]
            : undefined;
          const fromOtc = dateInfo?.staff_bubble_id
            ? otcNameByBubble[dateInfo.staff_bubble_id]
            : undefined;
          return {
            ...t,
            report_date: dateInfo?.report_date || t.created_at,
            staff_id: dateInfo?.staff_id || undefined,
            staff_display_name: fromId || fromOtc || "未知用戶",
          };
        });

        setTasks(enriched);
      } catch (err: any) {
        console.error("[ManHourPanel] fetch error:", err);
        setError(err?.message || "無法載入工時記錄");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, mode]);

  // ─── Computed summaries ────────────────────────────────
  const totalHours = useMemo(
    () => tasks.reduce((sum, t) => sum + (t.work_hour || 0), 0),
    [tasks]
  );

  const staffSummaries = useMemo(() => {
    const map: Record<string, StaffSummary> = {};
    for (const task of tasks) {
      const key = safeStaffLabel(task.staff_display_name);
      if (!map[key]) {
        map[key] = {
          staffName: key,
          totalHours: 0,
          taskCount: 0,
          tasks: [],
        };
      }
      map[key].totalHours += task.work_hour || 0;
      map[key].taskCount += 1;
      map[key].tasks.push(task);
    }
    // Sort by total hours descending
    return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
  }, [tasks]);

  const uniqueStaffCount = staffSummaries.length;
  const avgHoursPerTask =
    tasks.length > 0 ? (totalHours / tasks.length).toFixed(1) : "0";

  // ─── Format helpers ─────────────────────────────────────

  function formatHours(h: number | null | undefined): string {
    if (h == null) return "-";
    return `${h.toFixed(1)}h`;
  }

  function truncateText(text: string | null | undefined, maxLen: number = 60): string {
    if (!text) return "-";
    return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
  }

  // ─── No project ID state ────────────────────────────────
  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <AlertTriangle className="w-10 h-10 mb-3 text-amber-400" />
        <p className="text-sm font-medium text-gray-500">
          {mode === "pitching" ? "此投標缺少 ID，無法載入工時資料" : "此項目缺少 ID，無法載入工時資料"}
        </p>
      </div>
    );
  }

  // ─── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <p className="text-sm text-gray-500">載入工時記錄中...</p>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <AlertTriangle className="w-10 h-10 mb-3 text-red-400" />
        <p className="text-sm font-medium text-red-500">{error}</p>
      </div>
    );
  }

  // ─── Empty state ────────────────────────────────────────
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Clock className="w-10 h-10 mb-3 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">
          {mode === "pitching" ? "此投標尚無工時記錄" : "此項目尚無工時記錄"}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {mode === "pitching" ? "未找到匹配此投標的工時資料" : "未找到匹配此項目的工時資料"}
        </p>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="總工時"
          value={`${totalHours.toFixed(1)}h`}
          subtext={`共 ${tasks.length} 筆記錄`}
          icon={Clock}
          iconColor="text-amber-600"
          bgColor="bg-amber-50"
        />
        <SummaryCard
          label="參與人數"
          value={String(uniqueStaffCount)}
          subtext="不同工作人員"
          icon={User}
          iconColor="text-blue-600"
          bgColor="bg-blue-50"
        />
        <SummaryCard
          label="平均每筆工時"
          value={`${avgHoursPerTask}h`}
          subtext="每筆記錄平均"
          icon={TrendingUp}
          iconColor="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <SummaryCard
          label="工時記錄數"
          value={String(tasks.length)}
          subtext="已記錄工作任務"
          icon={FileText}
          iconColor="text-violet-600"
          bgColor="bg-violet-50"
        />
      </div>

      {/* Staff Breakdown */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-[16px] font-semibold text-gray-700 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            按人員分類
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="space-y-2">
            {staffSummaries.map((staff) => {
              const isExpanded = expandedStaff === staff.staffName;
              const percentage =
                totalHours > 0
                  ? ((staff.totalHours / totalHours) * 100).toFixed(0)
                  : "0";
              return (
                <div key={staff.staffName}>
                  {/* Staff row */}
                  <button
                    onClick={() =>
                      setExpandedStaff(isExpanded ? null : staff.staffName)
                    }
                    className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors group text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium text-gray-800 truncate">
                          {staff.staffName}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[12px] px-1.5 py-0 h-4"
                        >
                          {staff.taskCount} 筆
                        </Badge>
                      </div>
                      {/* Progress bar */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-[12px] text-gray-400 font-mono w-8 text-right">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                    <span className="text-[16px] font-bold text-gray-800 font-mono flex-shrink-0">
                      {staff.totalHours.toFixed(1)}h
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>

                  {/* Expanded tasks table */}
                  {isExpanded && (
                    <div className="ml-11 mr-2 mt-1 mb-3 border border-gray-100 rounded-lg overflow-hidden animate-in slide-in-from-top-1 duration-200">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50/80">
                            <TableHead className="text-[12px] py-2 px-3 font-semibold text-gray-500">
                              匯報日期
                            </TableHead>
                            <TableHead className="text-[12px] py-2 px-3 font-semibold text-gray-500">
                              任務類型
                            </TableHead>
                            <TableHead className="text-[12px] py-2 px-3 font-semibold text-gray-500">
                              任務名稱
                            </TableHead>
                            <TableHead className="text-[12px] py-2 px-3 font-semibold text-gray-500">
                              工作描述
                            </TableHead>
                            <TableHead className="text-[12px] py-2 px-3 font-semibold text-gray-500 text-right">
                              工時
                            </TableHead>
                            <TableHead className="text-[12px] py-2 px-3 font-semibold text-gray-500 text-center w-[60px]">
                              連結
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {staff.tasks
                            .sort(
                              (a, b) =>
                                new Date(b.report_date || b.created_at || "").getTime() -
                                new Date(a.report_date || a.created_at || "").getTime()
                            )
                            .map((task, idx) => (
                              <TableRow
                                key={task.id || idx}
                                className="hover:bg-amber-50/40 transition-colors"
                              >
                                <TableCell className="text-[13px] text-gray-600 py-2 px-3 whitespace-nowrap font-mono">
                                  {formatDate(task.report_date || task.created_at)}
                                </TableCell>
                                <TableCell className="text-[13px] text-gray-600 py-2 px-3 whitespace-nowrap">
                                  {task.task_type && !isBubbleId(task.task_type)
                                    ? task.task_type
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-[13px] text-gray-700 py-2 px-3 max-w-[160px]">
                                  <span className="truncate block">
                                    {task.task_name && !isBubbleId(task.task_name)
                                      ? task.task_name
                                      : "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-[13px] text-gray-700 py-2 px-3 max-w-[300px]">
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-default">
                                          {truncateText(task.task_description, 80)}
                                        </span>
                                      </TooltipTrigger>
                                      {(task.task_description || "").length >
                                        80 && (
                                        <TooltipContent
                                          side="top"
                                          className="max-w-sm text-xs"
                                        >
                                          {task.task_description}
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                  {task.keywords && (
                                    <div className="mt-0.5">
                                      <Badge
                                        variant="outline"
                                        className="text-[11px] px-1 py-0 h-3.5 text-gray-400"
                                      >
                                        {task.keywords}
                                      </Badge>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-[14px] font-bold text-gray-800 py-2 px-3 text-right font-mono">
                                  {formatHours(task.work_hour)}
                                </TableCell>
                                <TableCell className="py-2 px-3 text-center">
                                  {task.asana_link && (
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <a
                                            href={task.asana_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 transition-colors"
                                          >
                                            <AsanaIcon className="w-3.5 h-3.5" />
                                          </a>
                                        </TooltipTrigger>
                                        <TooltipContent
                                          side="top"
                                          className="text-xs"
                                        >
                                          在 Asana 中查看
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Full Task Log Table */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-[16px] font-semibold text-gray-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            完整工時記錄
            <Badge
              variant="secondary"
              className="text-[12px] px-1.5 py-0 h-4 ml-auto"
            >
              {tasks.length} 筆
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="text-[12px] py-2 px-4 font-semibold text-gray-500">
                    匯報日期
                  </TableHead>
                  <TableHead className="text-[12px] py-2 px-4 font-semibold text-gray-500">
                    工作人員
                  </TableHead>
                  <TableHead className="text-[12px] py-2 px-4 font-semibold text-gray-500">
                    任務類型
                  </TableHead>
                  <TableHead className="text-[12px] py-2 px-4 font-semibold text-gray-500">
                    任務名稱
                  </TableHead>
                  <TableHead className="text-[12px] py-2 px-4 font-semibold text-gray-500">
                    工作描述
                  </TableHead>
                  <TableHead className="text-[12px] py-2 px-4 font-semibold text-gray-500 text-right">
                    工時
                  </TableHead>
                  <TableHead className="text-[12px] py-2 px-4 font-semibold text-gray-500 text-center w-[60px]">
                    連結
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks
                  .sort(
                    (a, b) =>
                      new Date(b.report_date || b.created_at || "").getTime() -
                      new Date(a.report_date || a.created_at || "").getTime()
                  )
                  .map((task, idx) => (
                    <TableRow
                      key={task.id || idx}
                      className="hover:bg-amber-50/30 transition-colors"
                    >
                      <TableCell className="text-[13px] text-gray-600 py-2.5 px-4 whitespace-nowrap font-mono">
                        {formatDate(task.report_date || task.created_at)}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 py-2.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <User className="w-2.5 h-2.5 text-amber-600" />
                          </div>
                          <span className="truncate max-w-[120px]">
                            {safeStaffLabel(task.staff_display_name, "未知")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-600 py-2.5 px-4 whitespace-nowrap">
                        {task.task_type && !isBubbleId(task.task_type)
                          ? task.task_type
                          : "—"}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 py-2.5 px-4 max-w-[160px]">
                        <span className="truncate block">
                          {task.task_name && !isBubbleId(task.task_name)
                            ? task.task_name
                            : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 py-2.5 px-4 max-w-[320px]">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default line-clamp-2">
                                {task.task_description || "—"}
                              </span>
                            </TooltipTrigger>
                            {(task.task_description || "").length > 60 && (
                              <TooltipContent
                                side="top"
                                className="max-w-md text-xs whitespace-pre-wrap"
                              >
                                {task.task_description}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-[14px] font-bold text-gray-800 py-2.5 px-4 text-right font-mono">
                        {formatHours(task.work_hour)}
                      </TableCell>
                      <TableCell className="py-2.5 px-4 text-center">
                        {task.asana_link && (
                          <a
                            href={task.asana_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 transition-colors"
                          >
                            <AsanaIcon className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
