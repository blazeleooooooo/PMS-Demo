"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Pencil,
  Trash2,
  Image as ImageIcon,
  ExternalLink} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getManHourDateById,
  getManHourTasksByDateId,
  getNOSTasks,
  deleteManHourTask as deleteManHourTaskService,
  deleteManHourDateAndTasks,
  updateManHourDate,
  type ManHourDate,
  type ManHourTask,
  type NOSTask} from "@/lib/man-hour-service";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import ManHourTaskInlineForm from "@/components/reports/ManHourTaskInlineForm";
import { parseTaskAttachments } from "@/lib/attachment-utils";
import { AttachmentThumbnail } from "@/components/ui/attachment-thumbnail";

// ─── Types for enriched task data ─────────────────────────────
interface EnrichedJobData {
  relatedProjectName: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}`;
}

const WORK_HOUR_MODES = ["全日", "半日", "自訂工作時數", "放假"] as const;
type WorkHourMode = (typeof WORK_HOUR_MODES)[number];

function modeFromHours(hours: number): WorkHourMode {
  if (hours === 8) return "全日";
  if (hours === 4) return "半日";
  if (hours === 0) return "放假";
  return "自訂工作時數";
}

function hoursFromMode(mode: WorkHourMode, customHours: number): number {
  if (mode === "全日") return 8;
  if (mode === "半日") return 4;
  if (mode === "放假") return 0;
  return customHours;
}

function WorkHourModePills({
  value,
  onChange,
  disabled,
}: {
  value: WorkHourMode;
  onChange: (mode: WorkHourMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {WORK_HOUR_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          disabled={disabled}
          onClick={() => onChange(mode)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border disabled:opacity-50 ${
            value === mode
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
          }`}
        >
          {mode}
          {mode !== "自訂工作時數" && (
            <span className="ml-1 opacity-70">
              ({mode === "全日" ? 8 : mode === "半日" ? 4 : 0}h)
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Get link path for a man-hour task's connected job */
function getJobLink(task: ManHourTask): string | null {
  if (!task.project_id || !task.job_type) return null;
  switch (task.job_type) {
    case "bwa_project":
      return `/projects/bwa/${task.project_id}`;
    case "bwa_pitching":
      return `/proposals/${task.project_id}`;
    case "bwf_project":
      return `/projects/bwa/${task.project_id}`; // BWF uses same detail page for now
    case "bwf_pitching":
      return `/proposals/${task.project_id}`;
    default:
      return null;
  }
}

/** Get job type badge color */
function getJobTypeBadge(jobType: string | null): { label: string; color: string } | null {
  switch (jobType) {
    case "bwa_project":
      return { label: "BWA 項目", color: "bg-blue-100 text-blue-700" };
    case "bwa_pitching":
      return { label: "BWA 投標", color: "bg-indigo-100 text-indigo-700" };
    case "bwf_project":
      return { label: "BWF 項目", color: "bg-amber-100 text-amber-700" };
    case "bwf_pitching":
      return { label: "BWF 投標", color: "bg-orange-100 text-orange-700" };
    default:
      return null;
  }
}

type TaskViewModel = {
  relatedProjectName: string;
  workCategory: string;
  taskName: string;
  taskDescription: string;
  workHours: number;
  attachments: string[];
  link: string | null;
  badge: { label: string; color: string } | null;
};

function getTaskViewModel(
  task: ManHourTask,
  enrichedJobMap: Record<string, EnrichedJobData>,
  nosTaskMap: Record<string, NOSTask>,
): TaskViewModel {
  const enrichedKey =
    task.project_id && task.job_type ? `${task.job_type}_${task.project_id}` : null;
  const enrichedData = enrichedKey ? enrichedJobMap[enrichedKey] : null;
  const nosTask = task.task_bubble_id ? nosTaskMap[task.task_bubble_id] : null;
  return {
    relatedProjectName: enrichedData?.relatedProjectName || "",
    workCategory: task.task_type || "—",
    taskName: nosTask?.display || task.task_name || "—",
    taskDescription: task.task_description || "",
    workHours: task.work_hour || 0,
    attachments: parseTaskAttachments(task.images),
    link: getJobLink(task),
    badge: getJobTypeBadge(task.job_type),
  };
}

function TaskAttachmentThumbs({ attachments }: { attachments: string[] }) {
  if (attachments.length === 0) {
    return (
      <div className="w-8 h-8 bg-gray-50 rounded border border-dashed flex items-center justify-center">
        <ImageIcon className="w-4 h-4 text-gray-300" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {attachments.slice(0, 2).map((fileUrl, idx) => (
        <a
          key={idx}
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-8 h-8 rounded border overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all"
        >
          <AttachmentThumbnail url={fileUrl} alt={`Task attachment ${idx + 1}`} showLabel />
        </a>
      ))}
      {attachments.length > 2 && (
        <span className="text-xs text-gray-500 font-medium">+{attachments.length - 2}</span>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

interface ManHourDateDetailProps {
  dateId: string;
}

export default function ManHourDateDetail({ dateId }: ManHourDateDetailProps) {
  const router = useRouter();
  const { displayName } = useAuth();
  const { loading: permLoading } = usePermission();

  // ─── State ─────────────────────────────────────────────────
  const [manHourDate, setManHourDate] = useState<ManHourDate | null>(null);
  const [reportStaffName, setReportStaffName] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ManHourTask[]>([]);
  const [nosTaskMap, setNosTaskMap] = useState<Record<string, NOSTask>>({});
  const [enrichedJobMap, setEnrichedJobMap] = useState<Record<string, EnrichedJobData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline edit state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit Report dialog state
  const [editReportOpen, setEditReportOpen] = useState(false);
  const [editReportDate, setEditReportDate] = useState("");
  const [editTotalHours, setEditTotalHours] = useState<number>(0);
  const [editReportSaving, setEditReportSaving] = useState(false);
  const [workHourMode, setWorkHourMode] = useState<WorkHourMode>("全日");
  const [hourModeSaving, setHourModeSaving] = useState(false);

  // ─── Auto-delete empty date on exit ──────────────────────────
  // Track whether tasks have ever been loaded (to distinguish "loading" vs "truly empty")
  const tasksLoadedRef = useRef(false);
  const tasksRef = useRef<ManHourTask[]>([]);
  const isNavigatingRef = useRef(false);
  const editingTaskRef = useRef<string | null>(null);
  const inlineFormOpenRef = useRef(true); // Always visible now

  // Keep ref in sync with state
  useEffect(() => {
    tasksRef.current = tasks;
    if (!loading && manHourDate) {
      tasksLoadedRef.current = true;
    }
  }, [tasks, loading, manHourDate]);

  // Keep editingTaskRef in sync
  useEffect(() => {
    editingTaskRef.current = editingTaskId;
  }, [editingTaskId]);

  // Cleanup: delete man_hour_date if no tasks when leaving
  const cleanupEmptyDate = useCallback(async () => {
    if (isNavigatingRef.current) return; // already handled
    if (editingTaskRef.current) return; // don't delete while user is editing a task
    if (inlineFormOpenRef.current) return; // don't delete while user is filling the inline form
    isNavigatingRef.current = true;

    // Only delete if data was loaded and no tasks exist
    if (tasksLoadedRef.current && tasksRef.current.length === 0) {
      try {
        console.log("[ManHourDateDetail] Auto-deleting empty man_hour_date:", dateId);
        await deleteManHourDateAndTasks(dateId);
      } catch (err) {
        console.error("[ManHourDateDetail] Auto-delete failed:", err);
      }
    }
  }, [dateId]);

  // On component unmount, fire cleanup (disabled — this caused FK violations 
  // when React strict mode double-mounts or when dialog was being filled)
  // The cleanup only runs on explicit back-navigation via cleanupEmptyDate.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unmountCleanupDisabled = null;

  // ─── Load Data ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch the Man Hour Date record
      const dateRecord = await getManHourDateById(dateId);
      setManHourDate(dateRecord);

      // Resolve staff name from the man_hour_date's staff_id (references public.staff table)
      if (dateRecord?.staff_id) {
        const supabaseForStaff = createClient();
        const { data: staffRecord } = await supabaseForStaff
          .from("staff")
          .select("name")
          .eq("id", dateRecord.staff_id)
          .single();
        if (staffRecord?.name) {
          setReportStaffName(staffRecord.name);
        }
      }

      // Fetch tasks for this date (direct Supabase query)
      const tasksList = await getManHourTasksByDateId(dateId);
      setTasks(tasksList);

      // Fetch NOS Tasks for task name resolution
      const nosTasksList = await getNOSTasks();
      const nosMapping: Record<string, NOSTask> = {};
      nosTasksList.forEach((t) => {
        nosMapping[t.id] = t;
        if (t.bubble_id) nosMapping[t.bubble_id] = t;
      });
      setNosTaskMap(nosMapping);

      // Fetch enriched job data (related project/pitching name)
      const enrichedMap: Record<string, EnrichedJobData> = {};
      const supabase = createClient();

      // Group tasks by job_type
      const bwaProjectIds = tasksList.filter(t => t.project_id && t.job_type === "bwa_project").map(t => t.project_id!);
      const bwfProjectIds = tasksList.filter(t => t.project_id && t.job_type === "bwf_project").map(t => t.project_id!);
      const bwaPitchingIds = tasksList.filter(t => t.project_id && t.job_type === "bwa_pitching").map(t => t.project_id!);
      const bwfPitchingIds = tasksList.filter(t => t.project_id && t.job_type === "bwf_pitching").map(t => t.project_id!);

      // Fetch BWA projects
      if (bwaProjectIds.length > 0) {
        const { data: bwaProjects } = await supabase
          .from("bwa_projects")
          .select("id, project_name")
          .in("id", [...new Set(bwaProjectIds)]);
        if (bwaProjects) {
          bwaProjects.forEach((p: { id: string; project_name?: string | null }) => {
            enrichedMap[`bwa_project_${p.id}`] = { relatedProjectName: p.project_name ?? null };
          });
        }
      }

      // Fetch BWF projects
      if (bwfProjectIds.length > 0) {
        const { data: bwfProjects } = await supabase
          .from("bwf_projects")
          .select("id, project_name")
          .in("id", [...new Set(bwfProjectIds)]);
        if (bwfProjects) {
          bwfProjects.forEach((p: { id: string; project_name?: string | null }) => {
            enrichedMap[`bwf_project_${p.id}`] = { relatedProjectName: p.project_name ?? null };
          });
        }
      }

      // Fetch BWA pitchings
      if (bwaPitchingIds.length > 0) {
        const { data: bwaPitchings } = await supabase
          .from("bwa_pitchings")
          .select("id, real_customer_display_name")
          .in("id", [...new Set(bwaPitchingIds)]);
        if (bwaPitchings) {
          bwaPitchings.forEach((p: { id: string; real_customer_display_name?: string | null }) => {
            enrichedMap[`bwa_pitching_${p.id}`] = { relatedProjectName: p.real_customer_display_name ?? null };
          });
        }
      }

      // Fetch BWF pitchings
      if (bwfPitchingIds.length > 0) {
        const { data: bwfPitchings } = await supabase
          .from("bwf_pitchings")
          .select("id, real_customer_display_name")
          .in("id", [...new Set(bwfPitchingIds)]);
        if (bwfPitchings) {
          bwfPitchings.forEach((p: { id: string; real_customer_display_name?: string | null }) => {
            enrichedMap[`bwf_pitching_${p.id}`] = { relatedProjectName: p.real_customer_display_name ?? null };
          });
        }
      }

      setEnrichedJobMap(enrichedMap);
    } catch (err: any) {
      console.error("[ManHourDateDetail] Load error:", err);
      setError(err?.message || "Failed to load man hour detail");
    } finally {
      setLoading(false);
    }
  }, [dateId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Delete Task ──────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteManHourTaskService(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      console.error("[ManHourDateDetail] Delete error:", err);
      alert(`刪除失敗: ${err?.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Edit Report ───────────────────────────────────────────
  const openEditReport = (preferMode?: WorkHourMode) => {
    if (manHourDate) {
      // Convert report_date to YYYY-MM-DD in HKT (UTC+8)
      const rd = manHourDate.report_date
        ? (() => {
            const d = new Date(manHourDate.report_date);
            // Shift to HKT by adding 8 hours offset
            const hkt = new Date(d.getTime() + 8 * 60 * 60 * 1000);
            return hkt.toISOString().split("T")[0];
          })()
        : "";
      setEditReportDate(rd);
      const hours = manHourDate.total_work_hour || 0;
      const mode = preferMode ?? modeFromHours(hours);
      setWorkHourMode(mode);
      setEditTotalHours(
        mode === "自訂工作時數" ? (hours > 0 && hours !== 8 && hours !== 4 ? hours : 8) : hoursFromMode(mode, hours),
      );
    }
    setEditReportOpen(true);
  };

  /** Quick-change hour type from detail page pills (全日 / 半日 / 放假). */
  const applyWorkHourMode = async (mode: WorkHourMode) => {
    if (!manHourDate || hourModeSaving || editReportSaving) return;
    if (mode === "自訂工作時數") {
      openEditReport("自訂工作時數");
      return;
    }
    const hoursToSave = hoursFromMode(mode, 0);
    if (hoursToSave === (manHourDate.total_work_hour ?? 0)) return;
    setHourModeSaving(true);
    try {
      await updateManHourDate(dateId, { total_work_hour: hoursToSave });
      await loadData();
    } catch (err: any) {
      console.error("[ManHourDateDetail] Quick hour mode error:", err);
      alert(`儲存失敗: ${err?.message}`);
    } finally {
      setHourModeSaving(false);
    }
  };

  const saveEditReport = async () => {
    if (!editReportDate) return;
    setEditReportSaving(true);
    try {
      // Convert date input (YYYY-MM-DD) to HKT midnight ISO string
      const hktDate = `${editReportDate}T00:00:00+08:00`;
      const hoursToSave = hoursFromMode(workHourMode, editTotalHours);
      await updateManHourDate(dateId, {
        report_date: hktDate,
        total_work_hour: hoursToSave});
      setEditReportOpen(false);
      await loadData();
    } catch (err: any) {
      console.error("[ManHourDateDetail] Edit report error:", err);
      alert(`儲存失敗: ${err?.message}`);
    } finally {
      setEditReportSaving(false);
    }
  };

  // ─── Computed values ──────────────────────────────────────
  const totalHours = manHourDate?.total_work_hour || 0;
  const reportDate = manHourDate?.report_date || "";
  const createdDate = manHourDate?.created_at || "";

  // Calculate "time spent" — approximate from Created Date vs Updated Date
  const modifiedDate = manHourDate?.updated_at || "";
  const timeSpent = (() => {
    if (createdDate && modifiedDate) {
      const diff = new Date(modifiedDate).getTime() - new Date(createdDate).getTime();
      const mins = Math.round(diff / 60000);
      if (mins < 60) return `${mins}分鐘`;
      return `${Math.floor(mins / 60)}小時${mins % 60}分鐘`;
    }
    return "N/A";
  })();

  // Task completion: sum of task hours vs total_work_hour stated
  const sumTaskHours = tasks.reduce((sum, t) => sum + (t.work_hour || 0), 0);
  const taskCompletionPct = totalHours > 0 ? Math.min(100, Math.round((sumTaskHours / totalHours) * 100)) : 0;
  const isReportComplete = totalHours > 0 && sumTaskHours >= totalHours;

  // ─── Render: Loading ───────────────────────────────────────
  if (loading && !manHourDate) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">載入工時詳情...</span>
      </div>
    );
  }

  if (error && !manHourDate) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-500" />
        <p className="text-gray-600 text-sm">{error}</p>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          重試
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Back + Title Bar ─────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            await cleanupEmptyDate();
            router.push("/reports");
          }}
          className="shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">
            {(reportStaffName || displayName || "Staff")} {reportDate ? formatShortDate(reportDate) : ""} 工作匯報 – {totalHours}小時
          </h1>
        </div>
      </div>

      {/* ─── Info Bar ─────────────────────────────────────── */}
      <Card>
        <CardContent className="py-4 px-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Left info items */}
            <div className="flex items-center gap-8 flex-wrap">
              <div>
                <p className="text-xs text-gray-400">匯報日期</p>
                <p className="text-sm font-semibold text-gray-800">
                  {reportDate ? formatDateDisplay(reportDate) : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">匯報花費時長</p>
                <p className="text-sm font-semibold text-gray-800">{timeSpent}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">任務總時數</p>
                <p className="text-sm font-semibold text-gray-800">{totalHours}小時</p>
              </div>
              <div className="min-w-[220px]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-400">任務填報進度</p>
                  <p className={`text-xs font-semibold ${isReportComplete ? "text-green-600" : "text-amber-600"}`}>
                    {sumTaskHours}h / {totalHours}h ({taskCompletionPct}%)
                  </p>
                </div>
                <Progress
                  value={taskCompletionPct}
                  className={`h-2 ${isReportComplete ? "[&>div]:bg-green-500" : "[&>div]:bg-amber-500"}`}
                />
                {!isReportComplete && tasks.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    未完成 — 尚差 {(totalHours - sumTaskHours).toFixed(1)}h
                  </p>
                )}
                {isReportComplete && (
                  <p className="text-xs text-green-600 mt-1 font-medium">✓ 匯報已完成</p>
                )}
              </div>
            </div>

            {/* Hour-type pills (same as edit dialog) + Edit Report */}
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <div className="flex items-center gap-2">
                {hourModeSaving && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                )}
                <WorkHourModePills
                  value={modeFromHours(totalHours)}
                  onChange={applyWorkHourMode}
                  disabled={hourModeSaving || editReportSaving}
                />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditReport()}>
                <Pencil className="w-3.5 h-3.5" />
                Edit Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Tasks: cards on phone, table on tablet/desktop ── */}
      <Card>
        <CardContent className="p-0">
          <div className="md:hidden">
            {loading ? (
              <div className="divide-y divide-gray-100">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={`skeleton-card-${i}`} className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-full animate-pulse" />
                  </div>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-center py-12 text-gray-400">暫無任務記錄</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {tasks.map((task) => {
                  const view = getTaskViewModel(task, enrichedJobMap, nosTaskMap);
                  return (
                    <div
                      key={task.id}
                      className={`p-4 space-y-3 ${editingTaskId === task.id ? "bg-amber-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          {view.link ? (
                            <button
                              type="button"
                              onClick={() => window.open(view.link!, "_blank", "noopener")}
                              className="text-left text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                            >
                              <span className="truncate">{view.relatedProjectName || "—"}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                            </button>
                          ) : (
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {view.relatedProjectName || "—"}
                            </p>
                          )}
                          {view.badge && (
                            <span className={`inline-flex w-fit px-1.5 py-0.5 rounded text-[12px] font-medium ${view.badge.color}`}>
                              {view.badge.label}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-gray-800 tabular-nums">
                          {view.workHours}h
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span>{view.workCategory}</span>
                        <span className="text-gray-300 mx-1.5">·</span>
                        <span>{view.taskName}</span>
                      </div>
                      {view.taskDescription ? (
                        <p className="text-sm text-blue-500 whitespace-pre-wrap break-words">
                          {view.taskDescription}
                        </p>
                      ) : null}
                      <div className="flex items-center justify-between gap-3">
                        <TaskAttachmentThumbs attachments={view.attachments} />
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className={`text-sm font-medium ${
                              editingTaskId === task.id
                                ? "text-amber-600"
                                : "text-blue-600"
                            }`}
                            onClick={() => {
                              setEditingTaskId(editingTaskId === task.id ? null : task.id);
                            }}
                          >
                            {editingTaskId === task.id ? "取消編輯" : "Edit"}
                          </button>
                          <button
                            type="button"
                            className="text-sm text-red-500"
                            onClick={() => {
                              setDeleteTarget({ id: task.id, name: view.taskName });
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {editingTaskId === task.id && (
                        <div className="border-2 border-amber-400 bg-amber-50/60 rounded-lg shadow-md overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 border-b border-amber-300">
                            <Pencil className="w-4 h-4 text-amber-700 shrink-0" />
                            <span className="text-sm font-semibold text-amber-800 truncate">
                              正在編輯：{view.taskName}
                            </span>
                          </div>
                          <div className="p-2">
                            <ManHourTaskInlineForm
                              taskNumber={tasks.indexOf(task) + 1}
                              manHourDateId={dateId}
                              editTaskId={task.id}
                              onSaved={() => {
                                setEditingTaskId(null);
                                loadData();
                              }}
                              onCancel={() => setEditingTaskId(null)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[200px] text-xs font-semibold text-gray-600">相關項目</TableHead>
                  <TableHead className="w-[140px] text-xs font-semibold text-gray-600">工作類別</TableHead>
                  <TableHead className="w-[140px] text-xs font-semibold text-gray-600">任務</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600">任務描述</TableHead>
                  <TableHead className="w-[100px] text-xs font-semibold text-gray-600 text-center">工作時數</TableHead>
                  <TableHead className="w-[100px] text-xs font-semibold text-gray-600 text-center">相關圖片</TableHead>
                  <TableHead className="w-[120px] text-xs font-semibold text-gray-600 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell><div className="h-4 bg-gray-200 rounded w-32 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded w-48 animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded w-10 mx-auto animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded w-8 mx-auto animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-gray-200 rounded w-16 mx-auto animate-pulse" /></TableCell>
                    </TableRow>
                  ))
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                      暫無任務記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => {
                    const view = getTaskViewModel(task, enrichedJobMap, nosTaskMap);
                    return (
                      <React.Fragment key={task.id}>
                      <TableRow className={`hover:bg-gray-50/50 transition-colors ${editingTaskId === task.id ? "bg-amber-50 border-l-4 border-l-amber-400" : ""}`}>
                        <TableCell className="text-sm text-blue-600 font-medium">
                          <div className="flex flex-col gap-1">
                            {view.link ? (
                              <button
                                onClick={() => window.open(view.link!, "_blank", "noopener")}
                                className="text-left text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 transition-colors"
                              >
                                <span className="truncate max-w-[180px]">{view.relatedProjectName || "—"}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                              </button>
                            ) : (
                              <span>{view.relatedProjectName || "—"}</span>
                            )}
                            {view.badge && (
                              <span className={`inline-flex w-fit px-1.5 py-0.5 rounded text-[12px] font-medium ${view.badge.color}`}>
                                {view.badge.label}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {view.workCategory}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {view.taskName}
                        </TableCell>
                        <TableCell className="text-sm text-blue-500 max-w-[300px]">
                          <div className="whitespace-pre-wrap break-words line-clamp-4">
                            {view.taskDescription || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 text-center font-semibold">
                          {view.workHours}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <TaskAttachmentThumbs attachments={view.attachments} />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className={`text-sm font-medium transition-colors ${
                                editingTaskId === task.id
                                  ? "text-amber-600 hover:text-amber-800"
                                  : "text-blue-600 hover:text-blue-800 hover:underline"
                              }`}
                              onClick={() => {
                                setEditingTaskId(editingTaskId === task.id ? null : task.id);
                              }}
                            >
                              {editingTaskId === task.id ? "取消編輯" : "Edit"}
                            </button>
                            <button
                              className="text-sm text-red-500 hover:text-red-700 hover:underline"
                              onClick={() => {
                                setDeleteTarget({
                                  id: task.id,
                                  name: view.taskName});
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {editingTaskId === task.id && (
                        <TableRow>
                          <TableCell colSpan={7} className="p-0 border-0">
                            <div className="relative border-2 border-amber-400 bg-amber-50/60 rounded-lg mx-2 my-3 shadow-md">
                              <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 border-b border-amber-300 rounded-t-lg">
                                <Pencil className="w-4 h-4 text-amber-700" />
                                <span className="text-sm font-semibold text-amber-800">
                                  ✏️ 正在編輯任務：{view.taskName}
                                </span>
                                <button
                                  className="ml-auto text-xs text-amber-700 hover:text-amber-900 font-medium px-2 py-1 rounded hover:bg-amber-200 transition-colors"
                                  onClick={() => setEditingTaskId(null)}
                                >
                                  取消
                                </button>
                              </div>
                              <div className="p-2">
                                <ManHourTaskInlineForm
                                  taskNumber={tasks.indexOf(task) + 1}
                                  manHourDateId={dateId}
                                  editTaskId={task.id}
                                  onSaved={() => {
                                    setEditingTaskId(null);
                                    loadData();
                                  }}
                                  onCancel={() => setEditingTaskId(null)}
                                />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Delete Task Dialog ────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除任務</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除工時任務 &quot;{deleteTarget?.name}&quot; 嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Inline New Task Form (always visible) ───────────── */}
      <ManHourTaskInlineForm
        taskNumber={tasks.length + 1}
        manHourDateId={dateId}
        onSaved={() => { loadData(); }}
      />

      {/* ─── Edit Report Dialog ───────────────────────────────── */}
      <Dialog open={editReportOpen} onOpenChange={setEditReportOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>編輯工作匯報</DialogTitle>
            <DialogDescription>
              修改匯報日期及總工作時數。儲存後會自動更新修改日期。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-report-date">匯報日期</Label>
              <Input
                id="edit-report-date"
                type="date"
                value={editReportDate}
                onChange={(e) => setEditReportDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>工作時數類型</Label>
              <WorkHourModePills
                value={workHourMode}
                disabled={editReportSaving}
                onChange={(mode) => {
                  setWorkHourMode(mode);
                  if (mode === "全日") setEditTotalHours(8);
                  else if (mode === "半日") setEditTotalHours(4);
                  else if (mode === "放假") setEditTotalHours(0);
                  else setEditTotalHours(editTotalHours > 0 ? editTotalHours : 8);
                }}
              />
            </div>
            {workHourMode === "自訂工作時數" && (
              <div className="grid gap-2">
                <Label htmlFor="edit-total-hours">總工作時數 (小時)</Label>
                <Input
                  id="edit-total-hours"
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={editTotalHours}
                  onChange={(e) => setEditTotalHours(Number(e.target.value))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditReportOpen(false)}
              disabled={editReportSaving}
            >
              取消
            </Button>
            <Button
              onClick={saveEditReport}
              disabled={editReportSaving || !editReportDate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editReportSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
