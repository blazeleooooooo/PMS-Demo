"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CalendarDays,
  CreditCard,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  MinusCircle,
  ChevronRight,
  FileText,
  Clipboard,
  Package,
  Wrench,
  Flag,
  BarChart3,
  Calendar,
  X,
  Ban,
  RotateCcw,
  Pencil,
  Plus,
  Trash2,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { usePermission } from "@/hooks/use-permission";
import {
  fetchWorkingSchedules,
  fetchPaymentSchedules,
  fetchProjectSchedules,
  fetchDefaultScheduleTasks,
  fetchCustomScheduleTasks,
  createCustomScheduleTask,
  deleteCustomScheduleTask,
  upsertScheduleDate,
  setScheduleNA,
  removeScheduleDate,
  bulkSetScheduleNA,
  bulkResetScheduleNA,
  type ProjectScheduleRow,
  type DefaultScheduleTaskRow,
} from "@/lib/data-service";

// ─── TYPES ──────────────────────────────────────────────
type ScheduleMode = "working" | "payment" | "combined";

interface SchedulePanelProps {
  projectId: string;
  entityType?: "bwa_project" | "bwf_project" | "pitching";
  mode?: ScheduleMode;
  projectCode?: string;
  projectOsScheduleGroup?: string | null;
  /** Override the permission module used for CRUD checks. Defaults to "dates". */
  permissionModule?: string;
  /** Fires when default-task completion % is known (after load) or changes. */
  onDefaultTaskProgressChange?: (progress: number) => void;
}

// ─── STAGE CONFIG ────────────────────────────────────────
interface StageConfig {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
  progressColor: string;
}

const STAGE_CONFIGS: Record<string, StageConfig> = {
  S1: {
    icon: Clipboard,
    title: "#1 Contract Stage",
    subtitle: "階段1",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    progressColor: "bg-blue-500",
  },
  S2: {
    icon: Calendar,
    title: "#2 Important Date Plan",
    subtitle: "階段2",
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    progressColor: "bg-violet-500",
  },
  S3: {
    icon: Wrench,
    title: "#3 First 7 Days",
    subtitle: "階段3",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    progressColor: "bg-amber-500",
  },
  S4: {
    icon: Package,
    title: "#4 First 14 Days",
    subtitle: "階段4",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    progressColor: "bg-emerald-500",
  },
  S5: {
    icon: FileText,
    title: "#5 Technical Design Stage",
    subtitle: "階段5",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    progressColor: "bg-cyan-500",
  },
  S6: {
    icon: BarChart3,
    title: "#6 Site Progress Report",
    subtitle: "階段6",
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    progressColor: "bg-rose-500",
  },
  S7: {
    icon: Flag,
    title: "#7 Final Stage",
    subtitle: "階段7",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    progressColor: "bg-indigo-500",
  },
};

function getStageConfig(stage: string): StageConfig {
  return (
    STAGE_CONFIGS[stage] || {
      icon: CalendarDays,
      title: `${stage}`,
      subtitle: stage,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
      progressColor: "bg-gray-500",
    }
  );
}

// ─── FORMAT HELPERS ─────────────────────────────────────
import { formatDate } from "@/lib/date-utils";

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getRowStatus(row: ProjectScheduleRow): {
  label: string;
  color: string;
  icon: React.ElementType;
} {
  if (row.is_na) {
    return { label: "N/A", color: "text-gray-400", icon: MinusCircle };
  }
  if (row.date) {
    const d = new Date(row.date);
    const now = new Date();
    if (d < now) {
      return { label: "已完成", color: "text-emerald-600", icon: CheckCircle2 };
    }
    const diffDays = Math.ceil(
      (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays <= 7) {
      return { label: "即將到期", color: "text-amber-600", icon: AlertCircle };
    }
    return { label: "待進行", color: "text-blue-600", icon: Clock };
  }
  return { label: "未安排", color: "text-gray-400", icon: Clock };
}

// ─── GROUP BY STAGE ─────────────────────────────────────
interface StageGroup {
  stage: string;
  schedules: ProjectScheduleRow[];
}

function groupByStage(
  schedules: ProjectScheduleRow[],
  mode: ScheduleMode
): StageGroup[] {
  const map = new Map<string, ProjectScheduleRow[]>();
  const stageOrder: string[] = [];

  const sorted = [...schedules].sort((a, b) => {
    const sortA =
      mode === "payment" ? a.payment_task_sort : a.working_task_sort;
    const sortB =
      mode === "payment" ? b.payment_task_sort : b.working_task_sort;
    return (sortA ?? 9999) - (sortB ?? 9999);
  });

  for (const row of sorted) {
    const stage =
      mode === "payment"
        ? row.payment_task_stage
        : row.working_task_stage || row.payment_task_stage;
    const key = stage || "其他";

    if (!map.has(key)) {
      map.set(key, []);
      stageOrder.push(key);
    }
    map.get(key)!.push(row);
  }

  return stageOrder.map((stage) => ({
    stage,
    schedules: map.get(stage) || [],
  }));
}

function getStageStats(schedules: ProjectScheduleRow[]) {
  const total = schedules.length;
  const naCount = schedules.filter((s) => s.is_na).length;
  // A task is "handled" when it has a date OR is marked N/A — matching the
  // 排程完成率 donut. Progress = handled / total. (Previously this counted only
  // PAST-dated tasks over (total − N/A), so an all-N/A or future-dated stage
  // read 0/0 / 50% while the donut showed 100%.)
  const completed = schedules.filter((s) => s.is_na || !!s.date).length;
  const effective = total;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = total > 0 && completed === total;
  return { total, completed, naCount, effective, progress, allDone };
}

// ─── FILTER SCHEDULES ────────────────────────────────────
/**
 * Filters out schedule rows where:
 * 1. The linked task definition has is_custom = true
 * 2. The linked task definition's os_schedule_groups does NOT match the project's os_schedule_group
 *
 * NOTE: bwa_projects.os_schedule_group stores a bubble_id (TEXT), so we compare against
 * the task's os_schedule_groups (also TEXT/bubble_id) — NOT os_schedule_groups_id (UUID).
 * If projectOsScheduleGroup is null/undefined, we skip the group filter (show all non-custom).
 */
function filterSchedules(
  schedules: ProjectScheduleRow[],
  mode: ScheduleMode,
  projectOsScheduleGroup?: string | null
): ProjectScheduleRow[] {
  return schedules.filter((row) => {
    // Determine which task metadata to use based on mode
    const isCustom =
      mode === "payment"
        ? row.payment_task_is_custom
        : row.working_task_is_custom ?? row.payment_task_is_custom;

    // Use the TEXT bubble_id column for group comparison (matches bwa_projects.os_schedule_group)
    const taskGroupBubbleId =
      mode === "payment"
        ? row.payment_task_os_schedule_groups
        : row.working_task_os_schedule_groups ?? row.payment_task_os_schedule_groups;

    // Fallback: also check UUID in case the project field was already migrated to UUID
    const taskGroupUuid =
      mode === "payment"
        ? row.payment_task_os_schedule_groups_id
        : row.working_task_os_schedule_groups_id ?? row.payment_task_os_schedule_groups_id;

    // Rule 1: Exclude custom tasks
    if (isCustom === true) {
      return false;
    }

    // Rule 2: Exclude tasks whose schedule group doesn't match the project's group
    // os_schedule_groups is a comma-separated list of display names (e.g. "Design & Build,Build Only")
    // bwa_projects.os_schedule_group is a single display name (e.g. "Design & Build")
    if (projectOsScheduleGroup) {
      const taskGroup = taskGroupBubbleId || taskGroupUuid;
      if (taskGroup) {
        // Check if the comma-separated list contains the project's group name
        const groupNames = taskGroup.split(",").map((g: string) => g.trim());
        if (!groupNames.includes(projectOsScheduleGroup)) {
          return false;
        }
      }
    }

    return true;
  });
}

// ─── STAGE CARD ─────────────────────────────────────────
function StageCard({
  group,
  mode,
}: {
  group: StageGroup;
  mode: ScheduleMode;
}) {
  const config = getStageConfig(group.stage);
  const stats = getStageStats(group.schedules);
  const Icon = config.icon;

  return (
    <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      {/* Stage Header */}
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="text-[15px] font-bold text-gray-900 leading-tight">
                {config.title}
              </CardTitle>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {config.subtitle}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 mt-1" />
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="w-full bg-gray-100 rounded-full h-[6px] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${config.progressColor}`}
              style={{ width: `${stats.progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[14px] text-gray-500">
              {stats.progress}% 已完成
            </span>
            <Badge
              variant="outline"
              className={`text-[12px] font-medium ${
                stats.allDone
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                  : "bg-blue-50 text-blue-600 border-blue-200"
              }`}
            >
              {stats.allDone ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 已完成
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 進行中
                </span>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>

      {/* Tasks Grid */}
      <CardContent className="pt-0 px-5 pb-5">
        <div className="flex items-center gap-1.5 mb-3 pt-1 border-t border-gray-50">
          <CalendarDays className="w-3.5 h-3.5 text-gray-400 mt-2" />
          <span className="text-[13px] font-medium text-gray-500 mt-2">
            日期設定
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {group.schedules.map((row) => {
            const taskDisplay =
              mode === "payment"
                ? row.payment_task_display
                : row.working_task_display || row.payment_task_display;

            const dateVal = row.is_na
              ? "N/A"
              : formatDate(row.date) || "(empty)";
            const isEmpty = !row.date && !row.is_na;
            const status = getRowStatus(row);

            return (
              <div key={row.id} className="min-w-0">
                <p
                  className="text-[14px] font-medium text-gray-700 truncate leading-tight"
                  title={taskDisplay || ""}
                >
                  {taskDisplay || "未定義"}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {row.is_na ? (
                    <span className="text-[14px] text-gray-300 font-mono">
                      N/A
                    </span>
                  ) : isEmpty ? (
                    <span className="text-[14px] text-gray-300 italic">
                      (empty)
                    </span>
                  ) : (
                    <span
                      className={`text-[14px] font-mono ${
                        status.label === "即將到期"
                          ? "text-amber-600"
                          : "text-gray-600"
                      }`}
                    >
                      {dateVal}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── DEFAULT TASK CHECKLIST HELPERS ──────────────────────
interface DefaultStageGroup {
  stage: string;
  tasks: DefaultScheduleTaskRow[];
}

function groupDefaultTasksByStage(tasks: DefaultScheduleTaskRow[]): DefaultStageGroup[] {
  const map = new Map<string, DefaultScheduleTaskRow[]>();
  const stageOrder: string[] = [];

  const sorted = [...tasks].sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999));

  for (const task of sorted) {
    const key = task.stage || "其他";
    if (!map.has(key)) {
      map.set(key, []);
      stageOrder.push(key);
    }
    map.get(key)!.push(task);
  }

  return stageOrder
    .map((stage) => ({ stage, tasks: map.get(stage) || [] }))
    .filter((g) => g.tasks.length > 0);
}

function getDefaultTaskStatus(task: DefaultScheduleTaskRow): {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
} {
  if (!task.has_record) {
    return { label: "未設定", color: "text-gray-400", bgColor: "bg-gray-50", icon: Clock };
  }
  if (task.is_na) {
    return { label: "N/A", color: "text-gray-400", bgColor: "bg-gray-50", icon: MinusCircle };
  }
  if (task.date) {
    const d = new Date(task.date);
    const now = new Date();
    if (d < now) {
      return { label: "已完成", color: "text-emerald-600", bgColor: "bg-emerald-50", icon: CheckCircle2 };
    }
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) {
      return { label: "即將到期", color: "text-amber-600", bgColor: "bg-amber-50", icon: AlertCircle };
    }
    return { label: "待進行", color: "text-blue-600", bgColor: "bg-blue-50", icon: Clock };
  }
  return { label: "未設定日期", color: "text-gray-400", bgColor: "bg-gray-50", icon: Clock };
}

function getDefaultStageStats(tasks: DefaultScheduleTaskRow[]) {
  const total = tasks.length;
  const naCount = tasks.filter((t) => t.is_na).length;
  // A task is "handled" when it has a date OR is marked N/A — matching the
  // 排程完成率 donut. Progress = handled / total. (Previously this counted only
  // PAST-dated tasks over (total − N/A), so an all-N/A or future-dated stage
  // read 0/0 / 50% while the donut showed 100%.)
  const completed = tasks.filter((t) => t.is_na || !!t.date).length;
  const notSet = tasks.filter((t) => !t.has_record).length;
  const effective = total;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = total > 0 && completed === total;
  return { total, completed, naCount, notSet, effective, progress, allDone };
}

// ─── SCHEDULE COMPLETION DONUT ──────────────────────────────
/**
 * A donut chart showing the completion rate of default schedule tasks.
 * "Completed" = has a date (any date) OR is set as N/A.
 * "Incomplete" = no date AND not N/A (truly empty/unset).
 */
function ScheduleCompletionDonut({
  tasks,
}: {
  tasks: DefaultScheduleTaskRow[];
}) {
  const total = tasks.length;
  if (total === 0) return null;

  // Completed = has date OR is N/A
  const completed = tasks.filter((t) => t.date || t.is_na).length;
  const incomplete = total - completed;
  const naCount = tasks.filter((t) => t.is_na).length;
  const withDate = tasks.filter((t) => !!t.date).length;
  const rate = Math.round((completed / total) * 100);

  // SVG donut parameters
  const size = 88;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;

  // Color based on rate
  const getColor = () => {
    if (rate >= 100) return { stroke: "#10b981", text: "text-emerald-600", bg: "bg-emerald-50" };
    if (rate >= 75) return { stroke: "#3b82f6", text: "text-blue-600", bg: "bg-blue-50" };
    if (rate >= 50) return { stroke: "#f59e0b", text: "text-amber-600", bg: "bg-amber-50" };
    return { stroke: "#ef4444", text: "text-red-500", bg: "bg-red-50" };
  };
  const color = getColor();

  return (
    <div className="flex items-center gap-4">
      {/* Donut */}
      <div className="relative flex-shrink-0">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[16px] font-bold ${color.text}`}>
            {rate}%
          </span>
        </div>
      </div>

      {/* Legend / Details */}
      <div className="min-w-[120px]">
        <p className="text-[15px] font-semibold text-gray-700 mb-2">
          排程完成率
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-gray-500">已設日期</span>
            </div>
            <span className="font-medium text-gray-700 ml-4">{withDate}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" />
              <span className="text-gray-500">N/A</span>
            </div>
            <span className="font-medium text-gray-700 ml-4">{naCount}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
              <span className="text-gray-500">未完成</span>
            </div>
            <span className="font-medium text-gray-700 ml-4">{incomplete}</span>
          </div>
          <div className="flex items-center justify-between text-[13px] pt-1 border-t border-gray-100">
            <span className="text-gray-500">合計</span>
            <span className="font-semibold text-gray-700 ml-4">
              {completed}/{total}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EDITABLE TASK ROW ────────────────────────────────────
function EditableTaskRow({
  task,
  projectId,
  entityType,
  mode,
  onUpdated,
  canEditDates = true,
}: {
  task: DefaultScheduleTaskRow;
  projectId: string;
  entityType: "bwa_project" | "bwf_project";
  mode: "working" | "payment";
  onUpdated: () => void;
  canEditDates?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { toast } = useToast();

  const status = getDefaultTaskStatus(task);
  const StatusIcon = status.icon;

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return;
    setSaving(true);
    setCalendarOpen(false);
    const result = await upsertScheduleDate({
      scheduleId: task.schedule_id,
      taskId: task.task_id,
      projectId,
      entityType,
      mode,
      date: toISODate(date),
    });
    setSaving(false);
    if (result.success) {
      toast({ title: "已更新日期", description: `${task.display} → ${formatDate(toISODate(date))}` });
      onUpdated();
    } else {
      toast({ title: "更新失敗", description: result.error || "未知錯誤", variant: "destructive" });
    }
  };

  const handleSetNA = async () => {
    setSaving(true);
    const result = await setScheduleNA({
      scheduleId: task.schedule_id,
      taskId: task.task_id,
      projectId,
      entityType,
      mode,
    });
    setSaving(false);
    if (result.success) {
      toast({ title: "已設定為 N/A", description: task.display || "" });
      onUpdated();
    } else {
      toast({ title: "設定失敗", description: result.error || "未知錯誤", variant: "destructive" });
    }
  };

  const handleRemoveDate = async () => {
    if (!task.schedule_id) return;
    setSaving(true);
    const result = await removeScheduleDate(task.schedule_id);
    setSaving(false);
    if (result.success) {
      toast({ title: "已清除日期", description: task.display || "" });
      onUpdated();
    } else {
      toast({ title: "清除失敗", description: result.error || "未知錯誤", variant: "destructive" });
    }
  };

  const selectedDate = task.date ? new Date(task.date) : undefined;

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        status.label === "已完成"
          ? "bg-emerald-50/50"
          : status.label === "即將到期"
          ? "bg-amber-50/50"
          : !task.has_record
          ? "bg-gray-50/50"
          : "hover:bg-gray-50/50"
      }`}
    >
      {/* Status icon */}
      <StatusIcon className={`w-4 h-4 flex-shrink-0 ${status.color}`} />

      {/* Task name */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-[14px] font-medium truncate leading-tight ${
            status.label === "已完成"
              ? "text-gray-500 line-through"
              : "text-gray-700"
          }`}
          title={task.display || ""}
        >
          {task.display || "未定義"}
        </p>
      </div>

      {/* Date display + actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        ) : (
          <>
            {/* Date or N/A display */}
            {task.date ? (
              <span
                className={`text-[13px] font-mono ${
                  status.label === "即將到期"
                    ? "text-amber-600 font-medium"
                    : status.label === "已完成"
                    ? "text-emerald-600"
                    : "text-gray-500"
                }`}
              >
                {formatDate(task.date)}
              </span>
            ) : task.is_na ? (
              <span className="text-[13px] text-gray-300 font-mono">N/A</span>
            ) : (
              <span className="text-[13px] text-gray-300 italic">—</span>
            )}

            {/* Edit actions — visible on hover (permission-gated) */}
            {canEditDates && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Date picker */}
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                      title="選擇日期"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end" sideOffset={5}>
                    <CalendarUI
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {/* Set N/A (only show if not already N/A) */}
                {!task.is_na && (
                  <button
                    onClick={handleSetNA}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="設定為 N/A"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                )}

                {/* Remove date / reset from N/A (only show if has record) */}
                {task.has_record && (task.date || task.is_na) && (
                  <button
                    onClick={handleRemoveDate}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    title={task.is_na ? "取消 N/A" : "清除日期"}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Status badge */}
        <Badge
          variant="outline"
          className={`text-[11px] px-1.5 py-0 ${status.bgColor} ${status.color} border-transparent`}
        >
          {status.label}
        </Badge>
      </div>
    </div>
  );
}

// ─── DEFAULT STAGE CARD ──────────────────────────────────
function DefaultStageCard({ group, projectId, entityType, mode, onUpdated, canEditDates = true }: {
  group: DefaultStageGroup;
  projectId: string;
  entityType: "bwa_project" | "bwf_project";
  mode: "working" | "payment";
  onUpdated: () => void;
  canEditDates?: boolean;
}) {
  const config = getStageConfig(group.stage);
  const stats = getDefaultStageStats(group.tasks);
  const Icon = config.icon;

  return (
    <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      {/* Stage Header */}
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="text-[15px] font-bold text-gray-900 leading-tight">
                {config.title}
              </CardTitle>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {config.subtitle} · {stats.total} 項任務
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {stats.notSet > 0 && (
              <Badge variant="outline" className="text-[11px] bg-orange-50 text-orange-600 border-orange-200">
                {stats.notSet} 未設定
              </Badge>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="w-full bg-gray-100 rounded-full h-[6px] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${config.progressColor}`}
              style={{ width: `${stats.progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[14px] text-gray-500">
              {stats.completed}/{stats.effective} 已完成 ({stats.progress}%)
            </span>
            <Badge
              variant="outline"
              className={`text-[12px] font-medium ${
                stats.allDone
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                  : stats.progress > 0
                  ? "bg-blue-50 text-blue-600 border-blue-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}
            >
              {stats.allDone ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 全部完成
                </span>
              ) : stats.progress > 0 ? (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 進行中
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 未開始
                </span>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>

      {/* Tasks Checklist */}
      <CardContent className="pt-0 px-5 pb-5">
        <div className="flex items-center gap-1.5 mb-3 pt-1 border-t border-gray-50">
          <CalendarDays className="w-3.5 h-3.5 text-gray-400 mt-2" />
          <span className="text-[13px] font-medium text-gray-500 mt-2">
            預設任務清單
          </span>
        </div>

        <div className="space-y-1.5">
          {group.tasks.map((task) => (
            <EditableTaskRow
              key={task.task_id}
              task={task}
              projectId={projectId}
              entityType={entityType}
              mode={mode}
              onUpdated={onUpdated}
              canEditDates={canEditDates}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── BULK ACTIONS TOOLBAR ────────────────────────────────
function BulkActionsToolbar({
  tasks,
  projectId,
  entityType,
  mode,
  onUpdated,
  canEditDates = true,
}: {
  tasks: DefaultScheduleTaskRow[];
  projectId: string;
  entityType: "bwa_project" | "bwf_project";
  mode: "working" | "payment";
  onUpdated: () => void;
  canEditDates?: boolean;
}) {
  const [bulkSaving, setBulkSaving] = useState(false);
  const { toast } = useToast();

  const incompleteCount = tasks.filter((t) => !t.is_na && !t.date).length;
  const naCount = tasks.filter((t) => t.is_na).length;

  const handleBulkNA = async () => {
    if (incompleteCount === 0) {
      toast({ title: "沒有待處理任務", description: "所有任務已設定日期或 N/A" });
      return;
    }
    setBulkSaving(true);
    const result = await bulkSetScheduleNA({
      tasks,
      projectId,
      entityType,
      mode,
    });
    setBulkSaving(false);
    if (result.success) {
      toast({
        title: "批量設定 N/A 完成",
        description: `已將 ${result.count} 項未完成任務設定為 N/A`,
      });
      onUpdated();
    } else {
      toast({ title: "批量設定失敗", description: result.error || "未知錯誤", variant: "destructive" });
    }
  };

  const handleBulkResetNA = async () => {
    if (naCount === 0) {
      toast({ title: "沒有 N/A 任務", description: "沒有任何任務被設定為 N/A" });
      return;
    }
    setBulkSaving(true);
    const result = await bulkResetScheduleNA({ tasks });
    setBulkSaving(false);
    if (result.success) {
      toast({
        title: "批量重置 N/A 完成",
        description: `已將 ${result.count} 項 N/A 任務重置為空白`,
      });
      onUpdated();
    } else {
      toast({ title: "批量重置失敗", description: result.error || "未知錯誤", variant: "destructive" });
    }
  };

  if (!canEditDates) return null;
  if (incompleteCount === 0 && naCount === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {incompleteCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[13px] gap-1.5 text-gray-600 hover:text-gray-900 border-gray-200"
          onClick={handleBulkNA}
          disabled={bulkSaving}
        >
          {bulkSaving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Ban className="w-3 h-3" />
          )}
          批量設定 N/A ({incompleteCount} 項)
        </Button>
      )}
      {naCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[13px] gap-1.5 text-gray-600 hover:text-gray-900 border-gray-200"
          onClick={handleBulkResetNA}
          disabled={bulkSaving}
        >
          {bulkSaving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RotateCcw className="w-3 h-3" />
          )}
          批量重置 N/A ({naCount} 項)
        </Button>
      )}
    </div>
  );
}

// ─── CREATE CUSTOM SCHEDULE DIALOG ────────────────────────
function CreateCustomScheduleDialog({
  open,
  onOpenChange,
  projectId,
  entityType,
  mode,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  entityType: "bwa_project" | "bwf_project";
  mode: "working" | "payment";
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "請輸入排程名稱", variant: "destructive" });
      return;
    }
    setSaving(true);
    const result = await createCustomScheduleTask({
      display: name.trim(),
      projectId,
      entityType,
      mode,
      date: date ? toISODate(date) : null,
    });
    setSaving(false);
    if (result.success) {
      toast({ title: "自定義排程已建立", description: name.trim() });
      setName("");
      setDate(undefined);
      onOpenChange(false);
      onCreated();
    } else {
      toast({ title: "建立失敗", description: result.error || "未知錯誤", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[360px]"
      >
        <DialogHeader>
          <DialogTitle className="text-[15px] font-bold text-gray-900">
            新增自定義排程
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {/* Schedule Name */}
          <div className="space-y-1.5">
            <label className="text-[14px] font-medium text-gray-700">
              排程名稱 <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="輸入自定義排程名稱..."
              className="text-[15px] h-9"
              autoFocus
            />
          </div>

          {/* Optional Date */}
          <div className="space-y-1.5">
            <label className="text-[14px] font-medium text-gray-700">
              日期 <span className="text-gray-400">(選填)</span>
            </label>
            <Button
              variant="outline"
              type="button"
              className="w-full justify-start text-left text-[15px] font-normal h-9"
              onClick={() => setCalendarOpen(!calendarOpen)}
            >
              <Calendar className="w-4 h-4 mr-2 text-gray-400" />
              {date ? formatDate(toISODate(date)) : "選擇日期..."}
              {date && (
                <span
                  className="ml-auto text-gray-400 hover:text-gray-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDate(undefined);
                    setCalendarOpen(false);
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              )}
            </Button>
            {calendarOpen && (
              <div className="rounded-md border bg-popover shadow-md">
                <CalendarUI
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setCalendarOpen(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="pt-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-[14px] h-8"
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="text-[14px] h-8 bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Plus className="w-3 h-3 mr-1" />
            )}
            建立排程
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CUSTOM SCHEDULE CARD ────────────────────────────────
function CustomScheduleCard({
  customTasks,
  projectId,
  entityType,
  mode,
  onUpdated,
  onAddNew,
  canEditDates = true,
  canCreateDates = true,
  canDeleteDates = true,
}: {
  customTasks: DefaultScheduleTaskRow[];
  projectId: string;
  entityType: "bwa_project" | "bwf_project";
  mode: "working" | "payment";
  onUpdated: () => void;
  onAddNew: () => void;
  canEditDates?: boolean;
  canCreateDates?: boolean;
  canDeleteDates?: boolean;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDelete = async (task: DefaultScheduleTaskRow) => {
    if (!task.schedule_id || !task.task_id) return;
    setDeletingId(task.task_id);
    const result = await deleteCustomScheduleTask({
      scheduleId: task.schedule_id,
      taskId: task.task_id,
    });
    setDeletingId(null);
    if (result.success) {
      toast({ title: "已刪除自定義排程", description: task.display || "" });
      onUpdated();
    } else {
      toast({ title: "刪除失敗", description: result.error || "未知錯誤", variant: "destructive" });
    }
  };

  return (
    <Card className="border border-dashed border-teal-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden bg-teal-50/30">
      {/* Header */}
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100">
              <Star className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <CardTitle className="text-[15px] font-bold text-gray-900 leading-tight">
                自定義排程
              </CardTitle>
              <p className="text-[13px] text-gray-400 mt-0.5">
                Custom Schedule · {customTasks.length} 項任務
              </p>
            </div>
          </div>
          {canCreateDates && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[13px] gap-1 bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 hover:text-teal-800"
              onClick={onAddNew}
            >
              <Plus className="w-3 h-3" />
              新增
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Task List */}
      <CardContent className="pt-0 px-5 pb-5">
        {customTasks.length === 0 ? (
          <div className="text-center py-6">
            <CalendarDays className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-[14px] text-gray-400">暫無自定義排程</p>
            <p className="text-[13px] text-gray-300 mt-0.5">
              點擊「新增」按鈕來建立自定義排程項目
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {customTasks.map((task) => (
              <CustomTaskRow
                key={task.task_id}
                task={task}
                projectId={projectId}
                entityType={entityType}
                mode={mode}
                onUpdated={onUpdated}
                deleting={deletingId === task.task_id}
                onDelete={() => handleDelete(task)}
                canEditDates={canEditDates}
                canDeleteDates={canDeleteDates}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── CUSTOM TASK ROW ─────────────────────────────────────
function CustomTaskRow({
  task,
  projectId,
  entityType,
  mode,
  onUpdated,
  deleting,
  onDelete,
  canEditDates = true,
  canDeleteDates = true,
}: {
  task: DefaultScheduleTaskRow;
  projectId: string;
  entityType: "bwa_project" | "bwf_project";
  mode: "working" | "payment";
  onUpdated: () => void;
  deleting: boolean;
  onDelete: () => void;
  canEditDates?: boolean;
  canDeleteDates?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { toast } = useToast();

  const status = getDefaultTaskStatus(task);
  const StatusIcon = status.icon;

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return;
    setSaving(true);
    setCalendarOpen(false);
    const result = await upsertScheduleDate({
      scheduleId: task.schedule_id,
      taskId: task.task_id,
      projectId,
      entityType,
      mode,
      date: toISODate(date),
    });
    setSaving(false);
    if (result.success) {
      toast({ title: "已更新日期", description: `${task.display} → ${formatDate(toISODate(date))}` });
      onUpdated();
    } else {
      toast({ title: "更新失敗", description: result.error || "未知錯誤", variant: "destructive" });
    }
  };

  const handleSetNA = async () => {
    setSaving(true);
    const result = await setScheduleNA({
      scheduleId: task.schedule_id,
      taskId: task.task_id,
      projectId,
      entityType,
      mode,
    });
    setSaving(false);
    if (result.success) {
      toast({ title: "已設定為 N/A", description: task.display || "" });
      onUpdated();
    } else {
      toast({ title: "設定失敗", description: result.error || "未知錯誤", variant: "destructive" });
    }
  };

  const handleRemoveDate = async () => {
    if (!task.schedule_id) return;
    setSaving(true);
    const result = await removeScheduleDate(task.schedule_id);
    setSaving(false);
    if (result.success) {
      toast({ title: "已清除日期", description: task.display || "" });
      onUpdated();
    } else {
      toast({ title: "清除失敗", description: result.error || "未知錯誤", variant: "destructive" });
    }
  };

  const selectedDate = task.date ? new Date(task.date) : undefined;

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        status.label === "已完成"
          ? "bg-emerald-50/50"
          : status.label === "即將到期"
          ? "bg-amber-50/50"
          : "hover:bg-teal-50/50"
      }`}
    >
      {/* Status icon */}
      <StatusIcon className={`w-4 h-4 flex-shrink-0 ${status.color}`} />

      {/* Custom badge */}
      <Badge className="text-[10px] px-1 py-0 bg-teal-100 text-teal-700 border-teal-200 flex-shrink-0">
        自定義
      </Badge>

      {/* Task name */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-[14px] font-medium truncate leading-tight ${
            status.label === "已完成"
              ? "text-gray-500 line-through"
              : "text-gray-700"
          }`}
          title={task.display || ""}
        >
          {task.display || "自定義任務"}
        </p>
      </div>

      {/* Date display + actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {saving || deleting ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        ) : (
          <>
            {/* Date or N/A display */}
            {task.date ? (
              <span
                className={`text-[13px] font-mono ${
                  status.label === "即將到期"
                    ? "text-amber-600 font-medium"
                    : status.label === "已完成"
                    ? "text-emerald-600"
                    : "text-gray-500"
                }`}
              >
                {formatDate(task.date)}
              </span>
            ) : task.is_na ? (
              <span className="text-[13px] text-gray-300 font-mono">N/A</span>
            ) : (
              <span className="text-[13px] text-gray-300 italic">—</span>
            )}

            {/* Edit actions — visible on hover (permission-gated) */}
            {(canEditDates || canDeleteDates) && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Date picker */}
                {canEditDates && (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                        title="選擇日期"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end" sideOffset={5}>
                      <CalendarUI
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}

                {/* Set N/A */}
                {canEditDates && !task.is_na && (
                  <button
                    onClick={handleSetNA}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="設定為 N/A"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                )}

                {/* Remove date / reset from N/A */}
                {canEditDates && task.has_record && (task.date || task.is_na) && (
                  <button
                    onClick={handleRemoveDate}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    title={task.is_na ? "取消 N/A" : "清除日期"}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Delete custom task */}
                {canDeleteDates && (
                  <button
                    onClick={onDelete}
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    title="刪除自定義排程"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Status badge */}
        <Badge
          variant="outline"
          className={`text-[11px] px-1.5 py-0 ${status.bgColor} ${status.color} border-transparent`}
        >
          {status.label}
        </Badge>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function SchedulePanel({
  projectId,
  entityType = "bwa_project",
  mode = "combined",
  projectCode,
  projectOsScheduleGroup,
  permissionModule = "dates",
  onDefaultTaskProgressChange,
}: SchedulePanelProps) {
  const [schedules, setSchedules] = useState<ProjectScheduleRow[]>([]);
  const [defaultTasks, setDefaultTasks] = useState<DefaultScheduleTaskRow[]>([]);
  const [customTasks, setCustomTasks] = useState<DefaultScheduleTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);

  // ─── PERMISSION CHECKS ──────────────────
  const { canCreate, canEdit, canDelete } = usePermission();
  const canEditDates = canEdit(permissionModule);
  const canCreateDates = canCreate(permissionModule);
  const canDeleteDates = canDelete(permissionModule);

  // Derive the actual entity type for DB queries (pitching → bwa_project)
  const fetchEntityType: "bwa_project" | "bwf_project" =
    entityType === "pitching" || entityType === "bwa_project" ? "bwa_project" : "bwf_project";

  // Use default task list approach when we have a schedule group and mode is working/payment
  const useDefaultTaskList = !!projectOsScheduleGroup && (mode === "working" || mode === "payment");

  const loadSchedules = useCallback(async () => {
    setLoading(true);

    if (useDefaultTaskList && projectOsScheduleGroup) {
      // New approach: fetch default task definitions and cross-reference with project schedules
      const [data, customData] = await Promise.all([
        fetchDefaultScheduleTasks(
          projectOsScheduleGroup,
          projectId,
          mode as "working" | "payment",
          fetchEntityType
        ),
        fetchCustomScheduleTasks(
          projectId,
          mode as "working" | "payment",
          fetchEntityType
        ),
      ]);
      setDefaultTasks(data);
      setCustomTasks(customData);
    } else {
      // Legacy approach: fetch project_schedules directly
      let data: ProjectScheduleRow[];
      if (mode === "working") {
        data = await fetchWorkingSchedules(projectId, fetchEntityType);
      } else if (mode === "payment") {
        data = await fetchPaymentSchedules(projectId, fetchEntityType);
      } else {
        data = await fetchProjectSchedules(projectId, fetchEntityType);
      }
      setSchedules(data);
      // Also fetch custom tasks for legacy mode
      if (mode === "working" || mode === "payment") {
        const customData = await fetchCustomScheduleTasks(
          projectId,
          mode,
          fetchEntityType
        );
        setCustomTasks(customData);
      }
    }
    setLoading(false);
  }, [projectId, fetchEntityType, mode, projectOsScheduleGroup, useDefaultTaskList]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    if (!onDefaultTaskProgressChange || loading || !useDefaultTaskList) return;
    onDefaultTaskProgressChange(getDefaultStageStats(defaultTasks).progress);
  }, [
    defaultTasks,
    loading,
    useDefaultTaskList,
    onDefaultTaskProgressChange,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  const titleMap: Record<
    ScheduleMode,
    {
      title: string;
      subtitle: string;
      icon: React.ElementType;
      iconColor: string;
    }
  > = {
    working: {
      title: "工程時間表 Schedule - Design & Build",
      subtitle: "預設任務清單 — 檢視各階段任務完成狀態",
      icon: CalendarDays,
      iconColor: "text-amber-500",
    },
    payment: {
      title: "收款時間表 Payment Schedule",
      subtitle: "預設任務清單 — 檢視各階段收款任務完成狀態",
      icon: CreditCard,
      iconColor: "text-blue-500",
    },
    combined: {
      title: "排程管理 Schedule",
      subtitle: "管理項目所有排程記錄",
      icon: CalendarDays,
      iconColor: "text-violet-500",
    },
  };

  const { title, subtitle, icon: TitleIcon, iconColor } = titleMap[mode];

  // ─── DEFAULT TASK LIST RENDER PATH ─────────────────────
  if (useDefaultTaskList) {
    const defaultStageGroups = groupDefaultTasksByStage(defaultTasks);
    const overallDefaultStats = getDefaultStageStats(defaultTasks);

    if (defaultTasks.length === 0) {
      return (
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <CalendarDays className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400 mb-1">
                暫無預設任務
              </p>
              <p className="text-xs text-gray-300">
                此排程群組尚未設定預設任務定義
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-5">
        {/* Title & Subtitle */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className={`p-1.5 rounded-md bg-gray-50 ${iconColor}`}>
                <TitleIcon className="w-4 h-4" />
              </div>
              <h2 className="text-[16px] font-bold text-gray-900">{title}</h2>
              {projectCode && (
                <Badge
                  variant="outline"
                  className="text-[12px] font-mono text-gray-500"
                >
                  {projectCode}
                </Badge>
              )}
            </div>
            <p className="text-[14px] text-gray-400 ml-9">{subtitle}</p>
          </div>
          {canCreateDates && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[13px] gap-1.5 bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 hover:text-teal-800"
              onClick={() => setCustomDialogOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              新增自定義排程
            </Button>
          )}
        </div>

        {/* Overall Progress */}
        <Card className="border border-gray-100 shadow-sm bg-white">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-6">
              {/* Left: Progress Bar + Badges + Bulk Actions */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[15px] font-medium text-gray-700">
                        預設任務完成進度
                      </span>
                      <span className="text-[15px] font-bold text-gray-800">
                        {overallDefaultStats.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-700"
                        style={{ width: `${overallDefaultStats.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-[12px] bg-gray-50">
                      {defaultTasks.length} 項任務
                    </Badge>
                    {overallDefaultStats.notSet > 0 && (
                      <Badge variant="outline" className="text-[12px] bg-orange-50 text-orange-600 border-orange-200">
                        {overallDefaultStats.notSet} 未設定
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[12px] bg-emerald-50 text-emerald-600 border-emerald-200">
                      {overallDefaultStats.completed} 已完成
                    </Badge>
                  </div>
                </div>

                {/* Bulk Actions */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <BulkActionsToolbar
                    tasks={defaultTasks}
                    projectId={projectId}
                    entityType={fetchEntityType}
                    mode={mode as "working" | "payment"}
                    onUpdated={loadSchedules}
                    canEditDates={canEditDates}
                  />
                </div>
              </div>

              {/* Right: Schedule Completion Rate Donut */}
              <div className="flex-shrink-0 border-l border-gray-100 pl-6">
                <ScheduleCompletionDonut tasks={defaultTasks} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Default Stage Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {defaultStageGroups.map((group) => (
            <DefaultStageCard
              key={group.stage}
              group={group}
              projectId={projectId}
              entityType={fetchEntityType}
              mode={mode as "working" | "payment"}
              onUpdated={loadSchedules}
              canEditDates={canEditDates}
            />
          ))}
        </div>

        {/* Custom Schedules Section */}
        <CustomScheduleCard
          customTasks={customTasks}
          projectId={projectId}
          entityType={fetchEntityType}
          mode={mode as "working" | "payment"}
          onUpdated={loadSchedules}
          onAddNew={() => setCustomDialogOpen(true)}
          canEditDates={canEditDates}
          canCreateDates={canCreateDates}
          canDeleteDates={canDeleteDates}
        />

        {/* Create Custom Schedule Dialog */}
        <CreateCustomScheduleDialog
          open={customDialogOpen}
          onOpenChange={setCustomDialogOpen}
          projectId={projectId}
          entityType={fetchEntityType}
          mode={mode as "working" | "payment"}
          onCreated={loadSchedules}
        />
      </div>
    );
  }

  // ─── LEGACY RENDER PATH (combined mode or no schedule group) ─────
  // Apply filtering: exclude custom tasks and tasks not in the project's schedule group
  const filteredSchedules = filterSchedules(schedules, mode, projectOsScheduleGroup);

  // Overall stats
  const overallStats = getStageStats(filteredSchedules);
  const stageGroups = groupByStage(filteredSchedules, mode);

  if (filteredSchedules.length === 0) {
    return (
      <Card className="border border-gray-100 shadow-sm">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <CalendarDays className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400 mb-1">
              暫無排程記錄
            </p>
            <p className="text-xs text-gray-300">No schedule records found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Title & Subtitle */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <div className={`p-1.5 rounded-md bg-gray-50 ${iconColor}`}>
            <TitleIcon className="w-4 h-4" />
          </div>
          <h2 className="text-[16px] font-bold text-gray-900">{title}</h2>
          {projectCode && (
            <Badge
              variant="outline"
              className="text-[12px] font-mono text-gray-500"
            >
              {projectCode}
            </Badge>
          )}
        </div>
        <p className="text-[14px] text-gray-400 ml-9">{subtitle}</p>
      </div>

      {/* Overall Progress */}
      <Card className="border border-gray-100 shadow-sm bg-white">
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[15px] font-medium text-gray-700">
                  項目整體進度 (時間)
                </span>
                <span className="text-[15px] font-bold text-gray-800">
                  {overallStats.progress}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-700"
                  style={{ width: `${overallStats.progress}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="outline" className="text-[12px] bg-gray-50">
                {filteredSchedules.length} 條記錄
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stage Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stageGroups.map((group) => (
          <StageCard key={group.stage} group={group} mode={mode} />
        ))}
      </div>
    </div>
  );
}
