"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
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
import ManHourTaskInlineForm from "@/components/reports/TestingManHourTaskInlineForm";
import DesignJobReportCard from "@/components/reports/DesignJobReportCard";
import {
  getDesignJobAccumHours,
  getDesignJobById,
  type DesignJob,
} from "@/lib/design-job-service";
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
  const [designJobMap, setDesignJobMap] = useState<Record<string, DesignJob>>({});
  const [designAccumMap, setDesignAccumMap] = useState<Record<string, number>>({});
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
  type WorkHourMode = "全日" | "半日" | "自訂工作時數" | "放假";
  const [workHourMode, setWorkHourMode] = useState<WorkHourMode>("全日");

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

      // Fetch related project/pitching display names
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

      const designJobIds = Array.from(
        new Set(tasksList.map((t) => t.design_job_id).filter(Boolean) as string[])
      );
      const nextJobMap: Record<string, DesignJob> = {};
      const nextAccum: Record<string, number> = {};
      await Promise.all(
        designJobIds.map(async (id) => {
          const job = await getDesignJobById(id);
          if (job) {
            nextJobMap[id] = job;
            nextAccum[id] = await getDesignJobAccumHours(id);
          }
        })
      );
      setDesignJobMap(nextJobMap);
      setDesignAccumMap(nextAccum);
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
  const openEditReport = () => {
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
      setEditTotalHours(hours);
      // Determine initial mode based on existing hours
      if (hours === 8) setWorkHourMode("全日");
      else if (hours === 4) setWorkHourMode("半日");
      else if (hours === 0) setWorkHourMode("放假");
      else setWorkHourMode("自訂工作時數");
    }
    setEditReportOpen(true);
  };

  const saveEditReport = async () => {
    if (!editReportDate) return;
    setEditReportSaving(true);
    try {
      // Convert date input (YYYY-MM-DD) to HKT midnight ISO string
      const hktDate = `${editReportDate}T00:00:00+08:00`;
      // Determine hours based on mode
      const hoursToSave = workHourMode === "全日" ? 8
        : workHourMode === "半日" ? 4
        : workHourMode === "放假" ? 0
        : editTotalHours;
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
            router.push("/testing/reports");
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

            {/* Right action buttons */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openEditReport}>
                <Pencil className="w-3.5 h-3.5" />
                Edit Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Design job cards ─────────────────────────────── */}
      {!loading && tasks.some((t) => t.design_job_id) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">設計工作匯報</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {tasks
              .filter((t) => t.design_job_id && designJobMap[t.design_job_id])
              .map((t) => {
                const job = designJobMap[t.design_job_id!];
                return (
                  <DesignJobReportCard
                    key={t.id}
                    workHour={Number(t.work_hour) || 0}
                    displayName={job.display_name}
                    description={t.task_description}
                    progressPct={
                      t.progress_pct != null ? Number(t.progress_pct) : Number(job.progress_pct) || 0
                    }
                    accumHours={designAccumMap[job.id] || 0}
                    budgetHours={Number(job.budget_hours) || 0}
                    dueDate={job.due_date}
                    designStage={t.design_stage || job.design_stage}
                    nosTaskDisplay={nosTaskMap[job.nos_task_id]?.display || null}
                    onClick={(e) =>
                      handleNavClick(
                        `/design-reports/design-jobs/${job.id}`,
                        e,
                        (href) => router.push(href)
                      )
                    }
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* ─── Tasks Table ──────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="min-w-[280px] w-[320px] text-xs font-semibold text-gray-600">相關項目</TableHead>
                <TableHead className="w-[140px] text-xs font-semibold text-gray-600">任務</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">任務描述</TableHead>
                <TableHead className="w-[90px] text-xs font-semibold text-gray-600">成果類型</TableHead>
                <TableHead className="w-[70px] text-xs font-semibold text-gray-600 text-center">數量</TableHead>
                <TableHead className="w-[110px] text-xs font-semibold text-gray-600">階段</TableHead>
                <TableHead className="w-[100px] text-xs font-semibold text-gray-600 text-center">工作時數</TableHead>
                <TableHead className="w-[100px] text-xs font-semibold text-gray-600 text-center">相關圖片</TableHead>
                <TableHead className="w-[120px] text-xs font-semibold text-gray-600 text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // Skeleton rows
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell><div className="h-4 bg-gray-200 rounded w-40 animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded w-48 animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded w-14 animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded w-8 mx-auto animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded w-10 mx-auto animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded w-8 mx-auto animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 bg-gray-200 rounded w-16 mx-auto animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-gray-400">
                    暫無任務記錄
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => {
                  const enrichedKey = task.project_id && task.job_type ? `${task.job_type}_${task.project_id}` : null;
                  const enrichedData = enrichedKey ? enrichedJobMap[enrichedKey] : null;

                  // Related project name from enriched data
                  const relatedProjectName = enrichedData?.relatedProjectName || "";

                  // Task name from NOS task lookup or direct field
                  const nosTask = task.task_bubble_id ? nosTaskMap[task.task_bubble_id] : null;
                  const taskName = nosTask?.display || task.task_name || "—";

                  // Task description
                  const taskDescription = task.task_description || "";

                  // Deliverables (成果)
                  const deliverables = task.deliverables;
                  const deliverableType = deliverables?.type || "";
                  const deliverableCount =
                    deliverables?.count != null && deliverables.count > 0
                      ? deliverables.count
                      : null;
                  const deliverableStage = deliverables?.stage || "";

                  // Work hours
                  const workHours = task.work_hour || 0;

                  // Attachments - parse with legacy Bubble URL support
                  const attachments = parseTaskAttachments(task.images);

                  return (
                    <React.Fragment key={task.id}>
                    <TableRow className={`hover:bg-gray-50/50 transition-colors ${editingTaskId === task.id ? "bg-amber-50 border-l-4 border-l-amber-400" : ""}`}>
                      <TableCell className="text-sm text-blue-600 font-medium min-w-[280px]">
                        {(() => {
                          const link = getJobLink(task);
                          const badge = getJobTypeBadge(task.job_type);
                          return (
                            <div className="flex flex-col gap-1">
                              {link ? (
                                <button
                                  onClick={() => window.open(link, "_blank", "noopener")}
                                  className="text-left text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 transition-colors"
                                >
                                  <span className="break-words whitespace-normal">{relatedProjectName || "—"}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                                </button>
                              ) : (
                                <span className="break-words whitespace-normal">{relatedProjectName || "—"}</span>
                              )}
                              {badge && (
                                <span className={`inline-flex w-fit px-1.5 py-0.5 rounded text-[12px] font-medium ${badge.color}`}>
                                  {badge.label}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {taskName}
                      </TableCell>
                      <TableCell className="text-sm text-blue-500 max-w-[300px]">
                        <div className="whitespace-pre-wrap break-words line-clamp-4">
                          {taskDescription || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {deliverableType || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 text-center font-semibold">
                        {deliverableCount ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {deliverableStage || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 text-center font-semibold">
                        {workHours}
                      </TableCell>
                      <TableCell className="text-center">
                        {attachments.length > 0 ? (
                          <div className="flex justify-center items-center gap-1">
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
                              <span className="text-xs text-gray-500 font-medium">
                                +{attachments.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <div className="w-8 h-8 bg-gray-50 rounded border border-dashed flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-gray-300" />
                            </div>
                          </div>
                        )}
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
                                name: taskName});
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* ─── Inline Edit Form (replaces popup) ──── */}
                    {editingTaskId === task.id && (
                      <TableRow>
                        <TableCell colSpan={9} className="p-0 border-0">
                          <div className="relative border-2 border-amber-400 bg-amber-50/60 rounded-lg mx-2 my-3 shadow-md">
                            {/* Editing mode banner */}
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 border-b border-amber-300 rounded-t-lg">
                              <Pencil className="w-4 h-4 text-amber-700" />
                              <span className="text-sm font-semibold text-amber-800">
                                ✏️ 正在編輯任務：{taskName}
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
              <div className="flex flex-wrap gap-2">
                {(["全日", "半日", "自訂工作時數", "放假"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setWorkHourMode(mode);
                      if (mode === "全日") setEditTotalHours(8);
                      else if (mode === "半日") setEditTotalHours(4);
                      else if (mode === "放假") setEditTotalHours(0);
                      else setEditTotalHours(8);
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      workHourMode === mode
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
