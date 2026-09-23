"use client";

// ============================================================
// Man Hour Service — Direct Supabase queries
// Replaces bubble-man-hour-api.ts (Phase 4 of Man Hour Migration)
// ============================================================

import { createClient } from "@/lib/supabase/client";
import { parseTaskAttachments } from "@/lib/attachment-utils";

// ─── Lazy Supabase Client ────────────────────────────────────
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient();
  }
  return _supabase;
}

// ─── Types ───────────────────────────────────────────────────

export interface ManHourDate {
  id: string;
  bubble_id?: string;
  staff_id: string | null;
  staff_bubble_id?: string;
  report_date: string; // TIMESTAMPTZ format (ISO string), display using browser timezone
  total_work_hour: number;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export type JobType = 'bwa_project' | 'bwa_pitching' | 'bwf_project' | 'bwf_pitching';

/** man_hour_pinned.pin_type — task pins vs job-linked pins (matches job_type). */
export type ManHourPinType = "task" | JobType;

export const PROJECT_PIN_TYPES: readonly JobType[] = [
  "bwa_project",
  "bwa_pitching",
  "bwf_project",
  "bwf_pitching",
] as const;

export function isProjectPinType(pinType: string | null | undefined): pinType is JobType {
  return !!pinType && (PROJECT_PIN_TYPES as readonly string[]).includes(pinType);
}

/** AI tool selections keyed by type code (`text`, `image`, …) plus optional `{code}_other`. */
export type AiToolsData = {
  text?: string[];
  image?: string[];
  video?: string[];
  text_other?: string;
  image_other?: string;
  video_other?: string;
} & Record<string, string[] | string | undefined>;

export interface DeliverablesData {
  type: string;
  count: number;
  stage?: string;
}

export interface ManHourTask {
  id: string;
  bubble_id?: string;
  man_hour_date_id: string;
  man_hour_date_bubble_id?: string;
  task_name: string | null;
  task_type: string | null;
  task_bubble_id?: string;
  task_type_bubble_id?: string;
  task_description: string | null;
  work_hour: number;
  output_count: number | null;
  output_unit: string | null;
  work_location: string | null;
  project_id: string | null;
  project_bubble_id?: string;
  project_name: string | null;
  job_type: JobType | null;
  brand_bubble_id?: string;
  brand_name: string | null;
  meeting_topic?: string | null;
  meeting_participants?: string[] | null;
  meeting_method?: string | null;
  meeting_duration?: string | null;
  meeting_request_date?: string | null;
  meeting_invite_sent?: boolean;
  asana_link?: string | null;
  keywords?: string | null;
  images?: string[] | null;
  ai_tools?: AiToolsData | null;
  deliverables?: DeliverablesData | null;
  design_job_id?: string | null;
  design_stage?: string | null;
  progress_pct?: number | null;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface NOSTask {
  id: string;
  bubble_id?: string;
  display: string;
  eng_display?: string;
  is_active: boolean;
  sorting?: number;
  task_type_ids?: string[];
  /** When true, work-report 成果 (deliverables) is required for this task option. */
  require_deliverables?: boolean;
}

export interface NOSTaskType {
  id: string;
  bubble_id?: string;
  display: string;
  eng_display?: string;
  is_active: boolean;
  brand_ids?: string[];
  team_ids?: string[];
  require_project_link?: boolean;
}

export interface ManHourPinned {
  id: string;
  staff_id: string;
  pin_type: ManHourPinType;
  project_id: string | null;
  project_name: string | null;
  task_name: string | null;
  task_bubble_id?: string | null;
  sorting: number;
  created_at: string;
}

export interface ManHourDateInsert {
  staff_id: string;
  report_date: string; // TIMESTAMPTZ ISO string (e.g. "2024-01-15T00:00:00+08:00")
  total_work_hour?: number;
}

export interface ManHourTaskInsert {
  man_hour_date_id: string;
  task_name?: string;
  task_type?: string;
  task_bubble_id?: string;
  task_type_bubble_id?: string;
  task_description?: string;
  work_hour: number;
  output_count?: number;
  output_unit?: string;
  work_location?: string;
  project_id?: string;
  project_name?: string;
  job_type?: JobType;
  brand_name?: string;
  brand_bubble_id?: string;
  meeting_topic?: string;
  meeting_participants?: string[];
  meeting_method?: string;
  meeting_duration?: string;
  meeting_request_date?: string;
  meeting_invite_sent?: boolean;
  asana_link?: string;
  keywords?: string;
  images?: string[];
  ai_tools?: AiToolsData | null;
  deliverables?: DeliverablesData | null;
  design_job_id?: string | null;
  design_stage?: string | null;
  progress_pct?: number | null;
}

export interface ManHourTaskUpdate {
  task_name?: string;
  task_type?: string;
  task_bubble_id?: string;
  task_type_bubble_id?: string;
  task_description?: string;
  work_hour?: number;
  output_count?: number;
  output_unit?: string;
  work_location?: string;
  project_id?: string | null;
  project_name?: string | null;
  job_type?: JobType | null;
  brand_name?: string | null;
  brand_bubble_id?: string | null;
  meeting_topic?: string | null;
  meeting_participants?: string[] | null;
  meeting_method?: string | null;
  meeting_duration?: string | null;
  meeting_request_date?: string | null;
  meeting_invite_sent?: boolean;
  asana_link?: string | null;
  keywords?: string | null;
  images?: string[] | null;
  ai_tools?: AiToolsData | null;
  deliverables?: DeliverablesData | null;
  design_job_id?: string | null;
  design_stage?: string | null;
  progress_pct?: number | null;
}

// ─── Project/Pitching reference (for task dialog project picker) ───

export interface ProjectReference {
  id: string;
  name: string;
  type: "BWA Project" | "BWF Project" | "BWA Pitching" | "BWF Pitching";
  job_type: JobType;
}

/** Map display type to job_type discriminator */
export function displayTypeToJobType(type: ProjectReference["type"]): JobType {
  switch (type) {
    case "BWA Project": return "bwa_project";
    case "BWF Project": return "bwf_project";
    case "BWA Pitching": return "bwa_pitching";
    case "BWF Pitching": return "bwf_pitching";
  }
}

/** Map job_type discriminator to display type */
export function jobTypeToDisplayType(jobType: JobType): ProjectReference["type"] {
  switch (jobType) {
    case "bwa_project": return "BWA Project";
    case "bwf_project": return "BWF Project";
    case "bwa_pitching": return "BWA Pitching";
    case "bwf_pitching": return "BWF Pitching";
  }
}

/** Map job_type to route path */
export function jobTypeToRoute(jobType: JobType, projectId: string): string {
  switch (jobType) {
    case "bwa_project": return `/projects/bwa/${projectId}`;
    case "bwa_pitching": return `/proposals/${projectId}`;
    case "bwf_project": return `/projects/bwf/${projectId}`;
    case "bwf_pitching": return `/bwf/proposals/${projectId}`;
  }
}

// ============================================================
// MAN HOUR DATE FUNCTIONS
// ============================================================

/**
 * Get man hour dates for a specific staff and week (Mon–Fri)
 */
/**
 * Get man hour dates for a specific week (Mon–Sun or Mon–Fri)
 * Uses timestamptz range: start of first day to end of last day in browser timezone
 */
export async function getManHourDatesForWeek(
  staffId: string,
  weekDates: string[] // Array of YYYY-MM-DD strings (Mon–Fri)
): Promise<ManHourDate[]> {
  const supabase = getSupabase();
  const startDate = weekDates[0];
  const endDate = weekDates[weekDates.length - 1];

  // Convert YYYY-MM-DD to full day range in HK timezone (+08:00)
  // Data is stored as timestamptz with +08:00 offset
  const startTimestamp = `${startDate}T00:00:00+08:00`;
  const endTimestamp = `${endDate}T23:59:59+08:00`;

  const { data, error } = await supabase
    .from("man_hour_dates")
    .select("*")
    .eq("staff_id", staffId)
    .gte("report_date", startTimestamp)
    .lte("report_date", endTimestamp)
    .order("report_date", { ascending: true });

  if (error) {
    console.error("[ManHourService] getManHourDatesForWeek error:", error);
    throw new Error(error.message);
  }

  return (data || []) as ManHourDate[];
}

/** Same completion rule as ManHourDateDetail 任務填報進度 bar. */
export function calcManHourReportCompletion(
  totalHours: number,
  tasks: Pick<ManHourTask, "work_hour">[],
) {
  const sumTaskHours = tasks.reduce((sum, t) => sum + (t.work_hour || 0), 0);
  const taskCompletionPct =
    totalHours > 0 ? Math.min(100, Math.round((sumTaskHours / totalHours) * 100)) : 0;
  const isReportComplete = totalHours > 0 && sumTaskHours >= totalHours;
  return { sumTaskHours, taskCompletionPct, isReportComplete };
}

/**
 * All unfinished reports for a staff member (no date-range filter).
 * Unfinished = total_work_hour > 0 and SUM(task.work_hour) < total_work_hour.
 */
export async function getUnfinishedManHourReportsForStaff(
  staffId: string,
): Promise<{ dates: ManHourDate[]; tasks: ManHourTask[] }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("get_unfinished_man_hour_dates", {
    p_staff_id: staffId,
  });

  if (error) {
    console.error("[ManHourService] getUnfinishedManHourReportsForStaff error:", error);
    throw new Error(error.message);
  }

  const dates = (data || []) as ManHourDate[];
  const tasks = await getManHourTasksByDateIds(dates.map((d) => d.id));
  return { dates, tasks };
}

/**
 * Batch-fetch man hour date rows for many staff on a single calendar day (HK +08:00).
 */
export async function getManHourDatesForStaffOnDay(
  staffIds: string[],
  dateStr: string,
): Promise<ManHourDate[]> {
  if (staffIds.length === 0) return [];
  const supabase = getSupabase();
  const dateOnly = dateStr.split("T")[0];
  const startOfDay = `${dateOnly}T00:00:00+08:00`;
  const endOfDay = `${dateOnly}T23:59:59+08:00`;

  const { data, error } = await supabase
    .from("man_hour_dates")
    .select("*")
    .in("staff_id", staffIds)
    .gte("report_date", startOfDay)
    .lte("report_date", endOfDay)
    .order("report_date", { ascending: true });

  if (error) {
    console.error("[ManHourService] getManHourDatesForStaffOnDay error:", error);
    throw new Error(error.message);
  }

  return (data || []) as ManHourDate[];
}

/**
 * Get man hour dates by staff_id within a date range
 */
export async function getManHourDatesByStaffAndRange(
  staffId: string,
  startDate: string,
  endDate: string
): Promise<ManHourDate[]> {
  const supabase = getSupabase();

  // Convert YYYY-MM-DD to full day range in HK timezone (+08:00)
  const startTimestamp = startDate.includes("T") ? startDate : `${startDate}T00:00:00+08:00`;
  const endTimestamp = endDate.includes("T") ? endDate : `${endDate}T23:59:59+08:00`;

  const { data, error } = await supabase
    .from("man_hour_dates")
    .select("*")
    .eq("staff_id", staffId)
    .gte("report_date", startTimestamp)
    .lte("report_date", endTimestamp)
    .order("report_date", { ascending: true });

  if (error) {
    console.error("[ManHourService] getManHourDatesByStaffAndRange error:", error);
    throw new Error(error.message);
  }

  return (data || []) as ManHourDate[];
}

/**
 * Batch-fetch man hour date rows for many staff within a date range (HK +08:00).
 * Pages past the default 1000-row limit and chunks large staff id lists.
 */
export async function getManHourDatesForStaffInRange(
  staffIds: string[],
  startDate: string,
  endDate: string,
): Promise<ManHourDate[]> {
  if (staffIds.length === 0) return [];
  const supabase = getSupabase();
  const startTimestamp = startDate.includes("T") ? startDate : `${startDate}T00:00:00+08:00`;
  const endTimestamp = endDate.includes("T") ? endDate : `${endDate}T23:59:59+08:00`;

  const PAGE = 1000;
  const STAFF_CHUNK = 100;
  const all: ManHourDate[] = [];

  for (let i = 0; i < staffIds.length; i += STAFF_CHUNK) {
    const chunk = staffIds.slice(i, i + STAFF_CHUNK);
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("man_hour_dates")
        .select("*")
        .in("staff_id", chunk)
        .gte("report_date", startTimestamp)
        .lte("report_date", endTimestamp)
        .order("report_date", { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) {
        console.error("[ManHourService] getManHourDatesForStaffInRange error:", error);
        throw new Error(error.message);
      }

      const rows = (data || []) as ManHourDate[];
      all.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }

  return all;
}

/**
 * Get a single man hour date by ID
 */
export async function getManHourDateById(dateId: string): Promise<ManHourDate | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("man_hour_dates")
    .select("*")
    .eq("id", dateId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("[ManHourService] getManHourDateById error:", error);
    throw new Error(error.message);
  }

  return data as ManHourDate;
}

/**
 * Find existing man hour date for a staff on a specific day
 */
export async function findManHourDate(
  staffId: string,
  reportDate: string // YYYY-MM-DD or full timestamp
): Promise<ManHourDate | null> {
  const supabase = getSupabase();

  // If it's just a date string (YYYY-MM-DD), search within that day in HK timezone
  const dateOnly = reportDate.split("T")[0];
  const startOfDay = `${dateOnly}T00:00:00+08:00`;
  const endOfDay = `${dateOnly}T23:59:59+08:00`;

  const { data, error } = await supabase
    .from("man_hour_dates")
    .select("*")
    .eq("staff_id", staffId)
    .gte("report_date", startOfDay)
    .lte("report_date", endOfDay)
    .maybeSingle();

  if (error) {
    console.error("[ManHourService] findManHourDate error:", error);
    throw new Error(error.message);
  }

  return data as ManHourDate | null;
}

/**
 * Create a new man hour date record (or get existing one for same staff+day)
 */
export async function createManHourDate(data: ManHourDateInsert): Promise<ManHourDate> {
  const supabase = getSupabase();

  // Check for existing record first (upsert-like behavior)
  const existing = await findManHourDate(data.staff_id, data.report_date);
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("man_hour_dates")
    .insert({
      staff_id: data.staff_id,
      report_date: data.report_date,
      total_work_hour: data.total_work_hour ?? 0,
    })
    .select()
    .single();

  if (error) {
    console.error("[ManHourService] createManHourDate error:", error);
    throw new Error(error.message);
  }

  return created as ManHourDate;
}

/**
 * Update total work hour on a man hour date
 */
export async function updateManHourDateTotalHours(
  dateId: string,
  totalWorkHour: number
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("man_hour_dates")
    .update({ total_work_hour: totalWorkHour, updated_at: new Date().toISOString() })
    .eq("id", dateId);

  if (error) {
    console.error("[ManHourService] updateManHourDateTotalHours error:", error);
    throw new Error(error.message);
  }
}

/**
 * Update man hour date fields (report_date, total_work_hour)
 * Automatically sets updated_at (modified date)
 */
export async function updateManHourDate(
  dateId: string,
  fields: { report_date?: string; total_work_hour?: number }
): Promise<ManHourDate> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("man_hour_dates")
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dateId)
    .select()
    .single();

  if (error) {
    console.error("[ManHourService] updateManHourDate error:", error);
    throw new Error(error.message);
  }

  return data as ManHourDate;
}

/**
 * Delete a man hour date and all its tasks (CASCADE)
 */
export async function deleteManHourDateAndTasks(dateId: string): Promise<void> {
  const supabase = getSupabase();

  // CASCADE on FK will handle tasks, but let's be explicit
  const { error: taskError } = await supabase
    .from("man_hour_tasks")
    .delete()
    .eq("man_hour_date_id", dateId);

  if (taskError) {
    console.error("[ManHourService] deleteManHourDateAndTasks (tasks) error:", taskError);
    throw new Error(taskError.message);
  }

  const { error: dateError } = await supabase
    .from("man_hour_dates")
    .delete()
    .eq("id", dateId);

  if (dateError) {
    console.error("[ManHourService] deleteManHourDateAndTasks (date) error:", dateError);
    throw new Error(dateError.message);
  }
}

// ============================================================
// MAN HOUR TASK FUNCTIONS
// ============================================================

/**
 * Get all tasks for a specific man hour date ID
 */
export async function getManHourTasksByDateId(dateId: string): Promise<ManHourTask[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("man_hour_tasks")
    .select("*")
    .eq("man_hour_date_id", dateId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[ManHourService] getManHourTasksByDateId error:", error);
    throw new Error(error.message);
  }

  return (data || []) as ManHourTask[];
}

/**
 * Get tasks for multiple date IDs (batch fetch)
 */
export async function getManHourTasksByDateIds(dateIds: string[]): Promise<ManHourTask[]> {
  if (dateIds.length === 0) return [];
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("man_hour_tasks")
    .select("*")
    .in("man_hour_date_id", dateIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[ManHourService] getManHourTasksByDateIds error:", error);
    throw new Error(error.message);
  }

  return (data || []) as ManHourTask[];
}

/**
 * Get a single task by ID
 */
export async function getManHourTaskById(taskId: string): Promise<ManHourTask | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("man_hour_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("[ManHourService] getManHourTaskById error:", error);
    throw new Error(error.message);
  }

  return data as ManHourTask;
}

/**
 * Get tasks by project_id (for project-scoped ManHourPanel)
 */
export async function getManHourTasksByProjectId(projectId: string): Promise<ManHourTask[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("man_hour_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ManHourService] getManHourTasksByProjectId error:", error);
    throw new Error(error.message);
  }

  return (data || []) as ManHourTask[];
}

/**
 * Create a new man hour task
 */
export async function createManHourTask(data: ManHourTaskInsert): Promise<ManHourTask> {
  const supabase = getSupabase();

  // Safeguard: verify the parent man_hour_date exists before inserting
  // (it may have been auto-deleted by cleanup logic or React strict mode re-render)
  const { data: dateRecord, error: dateCheckErr } = await supabase
    .from("man_hour_dates")
    .select("id")
    .eq("id", data.man_hour_date_id)
    .maybeSingle();

  if (dateCheckErr) {
    console.error("[ManHourService] createManHourTask dateCheck error:", dateCheckErr);
  }

  if (!dateRecord) {
    throw new Error("匯報日期記錄不存在或已被刪除，請返回上一頁重新建立匯報。");
  }

  const { data: created, error } = await supabase
    .from("man_hour_tasks")
    .insert({
      man_hour_date_id: data.man_hour_date_id,
      task_name: data.task_name || null,
      task_type: data.task_type || null,
      task_bubble_id: data.task_bubble_id || null,
      task_type_bubble_id: data.task_type_bubble_id || null,
      task_description: data.task_description || null,
      work_hour: data.work_hour,
      output_count: data.output_count || null,
      output_unit: data.output_unit || null,
      work_location: data.work_location || null,
      project_id: data.project_id || null,
      project_name: data.project_name || null,
      job_type: data.job_type || null,
      brand_name: data.brand_name || null,
      brand_bubble_id: data.brand_bubble_id || null,
      meeting_topic: data.meeting_topic || null,
      meeting_participants: data.meeting_participants || null,
      meeting_method: data.meeting_method || null,
      meeting_duration: data.meeting_duration || null,
      meeting_request_date: data.meeting_request_date || null,
      meeting_invite_sent: data.meeting_invite_sent || false,
      asana_link: data.asana_link || null,
      keywords: data.keywords || null,
      images: data.images || null,
      ai_tools: data.ai_tools || null,
      deliverables: data.deliverables || null,
      design_job_id: data.design_job_id || null,
      design_stage: data.design_stage || null,
      progress_pct: data.progress_pct ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[ManHourService] createManHourTask error:", error);
    throw new Error(error.message);
  }

  return created as ManHourTask;
}

/**
 * Update an existing man hour task
 */
export async function updateManHourTask(
  taskId: string,
  updates: ManHourTaskUpdate
): Promise<ManHourTask> {
  const supabase = getSupabase();

  const { data: updated, error } = await supabase
    .from("man_hour_tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select()
    .single();

  if (error) {
    console.error("[ManHourService] updateManHourTask error:", error);
    throw new Error(error.message);
  }

  return updated as ManHourTask;
}

/**
 * Delete a man hour task
 */
export async function deleteManHourTask(taskId: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("man_hour_tasks")
    .delete()
    .eq("id", taskId);

  if (error) {
    console.error("[ManHourService] deleteManHourTask error:", error);
    throw new Error(error.message);
  }
}

/**
 * Recalculate and update total_work_hour on a man_hour_date based on its tasks
 */
async function recalculateDateTotalHours(dateId: string): Promise<void> {
  const supabase = getSupabase();

  const { data: tasks, error } = await supabase
    .from("man_hour_tasks")
    .select("work_hour")
    .eq("man_hour_date_id", dateId);

  if (error) {
    console.error("[ManHourService] recalculateDateTotalHours error:", error);
    return;
  }

  const totalHours = (tasks || []).reduce(
    (sum: number, t: { work_hour?: number | string | null }) => sum + (Number(t.work_hour) || 0),
    0
  );

  await updateManHourDateTotalHours(dateId, totalHours);
}

// ============================================================
// NOS TASKS & TASK TYPES
// ============================================================

/**
 * Get all active NOS Tasks
 */
export async function getNOSTasks(): Promise<NOSTask[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("nos_tasks")
    .select("*")
    .eq("is_active", true)
    .order("sorting", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[ManHourService] getNOSTasks error:", error);
    throw new Error(error.message);
  }

  return (data || []) as NOSTask[];
}

/**
 * Get all active NOS Task Types
 */
export async function getNOSTaskTypes(): Promise<NOSTaskType[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("nos_task_types")
    .select("*")
    .eq("is_active", true)
    .order("display", { ascending: true });

  if (error) {
    console.error("[ManHourService] getNOSTaskTypes error:", error);
    throw new Error(error.message);
  }

  return (data || []) as NOSTaskType[];
}

/**
 * Get NOS Tasks filtered by a specific task type
 */
export async function getNOSTasksByType(taskTypeBubbleId: string): Promise<NOSTask[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("nos_tasks")
    .select("*")
    .eq("is_active", true)
    .contains("task_type_ids", [taskTypeBubbleId])
    .order("sorting", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[ManHourService] getNOSTasksByType error:", error);
    throw new Error(error.message);
  }

  return (data || []) as NOSTask[];
}

// ============================================================
// PINNED ITEMS
// ============================================================

/**
 * Get all pinned items for a user
 */
export async function getPinnedItems(userId: string): Promise<ManHourPinned[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("man_hour_pinned")
    .select("*")
    .eq("staff_id", userId)
    .order("sorting", { ascending: true });

  if (error) {
    console.error("[ManHourService] getPinnedItems error:", error);
    throw new Error(error.message);
  }

  return (data || []) as ManHourPinned[];
}

/**
 * Get pinned items by exact pin_type
 */
export async function getPinnedByType(
  userId: string,
  pinType: ManHourPinType
): Promise<ManHourPinned[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("man_hour_pinned")
    .select("*")
    .eq("staff_id", userId)
    .eq("pin_type", pinType)
    .order("sorting", { ascending: true });

  if (error) {
    console.error("[ManHourService] getPinnedByType error:", error);
    throw new Error(error.message);
  }

  return (data || []) as ManHourPinned[];
}

/**
 * Get all job-linked pins (bwa/bwf project + pitching) for the heart tab.
 */
export async function getPinnedProjects(userId: string): Promise<ManHourPinned[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("man_hour_pinned")
    .select("*")
    .eq("staff_id", userId)
    .in("pin_type", [...PROJECT_PIN_TYPES])
    .order("sorting", { ascending: true });

  if (error) {
    console.error("[ManHourService] getPinnedProjects error:", error);
    throw new Error(error.message);
  }

  return (data || []) as ManHourPinned[];
}

/**
 * Toggle a pin (add if not exists, remove if exists).
 * For job-linked pins, pass the JobType as pinType (saved to pin_type and used as job_type on submit).
 */
export async function togglePin(
  userId: string,
  pinType: ManHourPinType,
  data: {
    project_id?: string;
    project_name?: string;
    task_name?: string;
    task_bubble_id?: string;
  }
): Promise<{ pinned: boolean }> {
  const supabase = getSupabase();

  // Check if already pinned
  let query = supabase
    .from("man_hour_pinned")
    .select("id")
    .eq("staff_id", userId);

  if (pinType === "task") {
    query = query.eq("pin_type", "task");
    if (data.task_bubble_id) {
      query = query.eq("task_bubble_id", data.task_bubble_id);
    } else if (data.task_name) {
      query = query.eq("task_name", data.task_name);
    }
  } else if (data.project_id) {
    // Match any job pin type for the same project_id (avoids duplicates after type remap)
    query = query.in("pin_type", [...PROJECT_PIN_TYPES]).eq("project_id", data.project_id);
  } else {
    query = query.eq("pin_type", pinType);
  }

  const { data: existing, error: findError } = await query;

  if (findError) {
    console.error("[ManHourService] togglePin find error:", findError);
    throw new Error(findError.message);
  }

  if (existing && existing.length > 0) {
    // Unpin
    const { error: deleteError } = await supabase
      .from("man_hour_pinned")
      .delete()
      .eq("id", existing[0].id);

    if (deleteError) {
      console.error("[ManHourService] togglePin delete error:", deleteError);
      throw new Error(deleteError.message);
    }
    return { pinned: false };
  } else {
    // Pin — store JobType in pin_type so heart-tab selection can set job_type correctly
    const { error: insertError } = await supabase
      .from("man_hour_pinned")
      .insert({
        staff_id: userId,
        pin_type: pinType,
        project_id: data.project_id || null,
        project_name: data.project_name || null,
        task_name: data.task_name || null,
        task_bubble_id: data.task_bubble_id || null,
        sorting: 0,
      });

    if (insertError) {
      console.error("[ManHourService] togglePin insert error:", insertError);
      throw new Error(insertError.message);
    }
    return { pinned: true };
  }
}

/**
 * Remove a pin by ID
 */
export async function removePin(pinId: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("man_hour_pinned")
    .delete()
    .eq("id", pinId);

  if (error) {
    console.error("[ManHourService] removePin error:", error);
    throw new Error(error.message);
  }
}

// ============================================================
// PROJECT REFERENCES (for task dialog project picker)
// ============================================================

/**
 * Get all projects for the man hour task dialog project picker
 * Includes BWA Projects, BWF Projects, BWA Pitchings, BWF Pitchings
 */
export async function getProjectReferences(): Promise<ProjectReference[]> {
  const supabase = getSupabase();
  const results: ProjectReference[] = [];

  // BWA Projects
  const { data: bwaProjects } = await supabase
    .from("bwa_projects")
    .select("id, project_name, project_code")
    .order("project_name", { ascending: true });

  if (bwaProjects) {
    results.push(
      ...bwaProjects.map((p: { id: string; project_name?: string | null; project_code?: string | null }) => ({
        id: p.id,
        name: p.project_name || p.project_code || "Unnamed BWA Project",
        type: "BWA Project" as const,
        job_type: "bwa_project" as const,
      }))
    );
  }

  // BWF Projects
  const { data: bwfProjects } = await supabase
    .from("bwf_projects")
    .select("id, project_name, project_code")
    .order("project_name", { ascending: true });

  if (bwfProjects) {
    results.push(
      ...bwfProjects.map((p: { id: string; project_name?: string | null; project_code?: string | null }) => ({
        id: p.id,
        name: p.project_name || p.project_code || "Unnamed BWF Project",
        type: "BWF Project" as const,
        job_type: "bwf_project" as const,
      }))
    );
  }

  // BWA Pitchings
  const { data: bwaPitchings } = await supabase
    .from("bwa_pitchings")
    .select("id, pitching_code, customer_name, building_name")
    .order("pitching_code", { ascending: true });

  if (bwaPitchings) {
    results.push(
      ...bwaPitchings.map((p: { id: string; pitching_code?: string | null; customer_name?: string | null; building_name?: string | null }) => ({
        id: p.id,
        name: p.pitching_code
          ? `${p.pitching_code} - ${p.customer_name || p.building_name || ""}`
          : p.customer_name || "Unnamed BWA Pitching",
        type: "BWA Pitching" as const,
        job_type: "bwa_pitching" as const,
      }))
    );
  }

  // BWF Pitchings
  const { data: bwfPitchings } = await supabase
    .from("bwf_pitchings")
    .select("id, pitching_code, pitching_name, customer_name")
    .order("pitching_code", { ascending: true });

  if (bwfPitchings) {
    results.push(
      ...bwfPitchings.map((p: { id: string; pitching_code?: string | null; pitching_name?: string | null; customer_name?: string | null }) => ({
        id: p.id,
        name: p.pitching_code
          ? `${p.pitching_code} - ${p.pitching_name || p.customer_name || ""}`
          : p.pitching_name || "Unnamed BWF Pitching",
        type: "BWF Pitching" as const,
        job_type: "bwf_pitching" as const,
      }))
    );
  }

  return results;
}

/**
 * Search projects by name (for typeahead/search in task dialog)
 */
export async function searchProjects(query: string): Promise<ProjectReference[]> {
  if (!query || query.length < 2) return [];
  const supabase = getSupabase();
  const results: ProjectReference[] = [];
  const searchTerm = `%${query}%`;

  // BWA Projects
  const { data: bwaProjects } = await supabase
    .from("bwa_projects")
    .select("id, project_name, project_code")
    .or(`project_name.ilike.${searchTerm},project_code.ilike.${searchTerm}`)
    .limit(20);

  if (bwaProjects) {
    results.push(
      ...bwaProjects.map((p: { id: string; project_name?: string | null; project_code?: string | null }) => ({
        id: p.id,
        name: p.project_name || p.project_code || "Unnamed BWA Project",
        type: "BWA Project" as const,
        job_type: "bwa_project" as const,
      }))
    );
  }

  // BWF Projects
  const { data: bwfProjects } = await supabase
    .from("bwf_projects")
    .select("id, project_name, project_code")
    .or(`project_name.ilike.${searchTerm},project_code.ilike.${searchTerm}`)
    .limit(20);

  if (bwfProjects) {
    results.push(
      ...bwfProjects.map((p: { id: string; project_name?: string | null; project_code?: string | null }) => ({
        id: p.id,
        name: p.project_name || p.project_code || "Unnamed BWF Project",
        type: "BWF Project" as const,
        job_type: "bwf_project" as const,
      }))
    );
  }

  // BWA Pitchings
  const { data: bwaPitchings } = await supabase
    .from("bwa_pitchings")
    .select("id, pitching_code, customer_name, building_name")
    .or(`pitching_code.ilike.${searchTerm},customer_name.ilike.${searchTerm},building_name.ilike.${searchTerm}`)
    .limit(20);

  if (bwaPitchings) {
    results.push(
      ...bwaPitchings.map((p: { id: string; pitching_code?: string | null; customer_name?: string | null; building_name?: string | null }) => ({
        id: p.id,
        name: p.pitching_code
          ? `${p.pitching_code} - ${p.customer_name || p.building_name || ""}`
          : p.customer_name || "Unnamed BWA Pitching",
        type: "BWA Pitching" as const,
        job_type: "bwa_pitching" as const,
      }))
    );
  }

  // BWF Pitchings
  const { data: bwfPitchings } = await supabase
    .from("bwf_pitchings")
    .select("id, pitching_code, pitching_name, customer_name")
    .or(`pitching_code.ilike.${searchTerm},pitching_name.ilike.${searchTerm},customer_name.ilike.${searchTerm}`)
    .limit(20);

  if (bwfPitchings) {
    results.push(
      ...bwfPitchings.map((p: { id: string; pitching_code?: string | null; pitching_name?: string | null; customer_name?: string | null }) => ({
        id: p.id,
        name: p.pitching_code
          ? `${p.pitching_code} - ${p.pitching_name || p.customer_name || ""}`
          : p.pitching_name || "Unnamed BWF Pitching",
        type: "BWF Pitching" as const,
        job_type: "bwf_pitching" as const,
      }))
    );
  }

  return results;
}

// ============================================================
// STAFF / USER LOOKUP (replaces getStaffBubbleId)
// ============================================================

/**
 * Get staff UUID from users table by display name
 */
export async function getStaffIdByDisplayName(displayName: string): Promise<string | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("display_name", displayName)
    .maybeSingle();

  if (error) {
    console.error("[ManHourService] getStaffIdByDisplayName error:", error);
    return null;
  }

  return data?.id || null;
}

/**
 * Get staff UUID by auth_user_id (from Supabase Auth)
 * Returns staff.id (via users.member_id) since man_hour_dates.staff_id references staff table
 */
export async function getStaffIdByAuthUserId(authUserId: string): Promise<string | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("users")
    .select("member_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    console.error("[ManHourService] getStaffIdByAuthUserId error:", error);
    return null;
  }

  return data?.member_id || null;
}

/**
 * Get all active staff members (for admin/filter views)
 */
export async function getActiveStaff(): Promise<{ id: string; display_name: string }[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("users")
    .select("id, display_name")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) {
    console.error("[ManHourService] getActiveStaff error:", error);
    throw new Error(error.message);
  }

  return (data || []) as { id: string; display_name: string }[];
}

// ============================================================
// BRANDS & WORK LOCATIONS (from NOS reference tables)
// ============================================================

export interface NOSBrand {
  id: string;
  bubble_id?: string;
  display: string;
  brand_name?: string;
  is_active: boolean;
}

export interface NOSWorkLocation {
  id: string;
  bubble_id?: string;
  display: string;
  is_active: boolean;
  is_china?: boolean;
  is_gps?: boolean;
  is_hk?: boolean;
}

export interface NOSAiToolType {
  id: string;
  code: string;
  display: string;
  eng_display: string | null;
  sorting: number;
  is_active: boolean;
}

export interface NOSAiTool {
  id: string;
  display: string;
  category: string;
  sorting: number;
  is_active: boolean;
}

export interface AiToolGroup {
  code: string;
  display: string;
  eng_display: string | null;
  sorting: number;
  tools: string[];
}

/** Fallback groups matching the original hardcoded AI tool lists. */
export const DEFAULT_AI_TOOL_GROUPS: AiToolGroup[] = [
  {
    code: "text",
    display: "文案工具",
    eng_display: "Text Tools",
    sorting: 10,
    tools: ["Perplexity", "Grok", "Gemini", "Deepseek", "豆包", "Claude", "GPT", "Skywork"],
  },
  {
    code: "image",
    display: "圖片工具",
    eng_display: "Image Tools",
    sorting: 20,
    tools: ["Magnific(Freepik)", "Genspark (Image2)", "Gemini (Nano banana)", "Skywork"],
  },
  {
    code: "video",
    display: "影片工具",
    eng_display: "Video Tools",
    sorting: 30,
    tools: ["Capcut", "Seedance", "Kling", "Magnific AI"],
  },
];

/** @deprecated Prefer DEFAULT_AI_TOOL_GROUPS / getNOSAiToolGroups(). */
export type AiToolCategory = "text" | "image" | "video";

/** @deprecated Prefer DEFAULT_AI_TOOL_GROUPS. */
export const DEFAULT_AI_TOOLS: Record<AiToolCategory, string[]> = {
  text: DEFAULT_AI_TOOL_GROUPS[0].tools,
  image: DEFAULT_AI_TOOL_GROUPS[1].tools,
  video: DEFAULT_AI_TOOL_GROUPS[2].tools,
};

/**
 * Active AI tool types + tools for 工作匯報, ordered by type sorting.
 * Falls back to DEFAULT_AI_TOOL_GROUPS when tables are empty or the query fails.
 */
export async function getNOSAiToolGroups(): Promise<AiToolGroup[]> {
  const supabase = getSupabase();

  try {
    const [typesRes, toolsRes] = await Promise.all([
      supabase
        .from("nos_ai_tool_types")
        .select("id, code, display, eng_display, sorting, is_active")
        .eq("is_active", true)
        .order("sorting", { ascending: true })
        .order("display", { ascending: true }),
      supabase
        .from("nos_ai_tools")
        .select("id, display, category, sorting, is_active")
        .eq("is_active", true)
        .order("sorting", { ascending: true })
        .order("display", { ascending: true }),
    ]);

    if (typesRes.error) {
      console.error("[ManHourService] getNOSAiToolGroups types error:", typesRes.error);
      return DEFAULT_AI_TOOL_GROUPS.map((g) => ({ ...g, tools: [...g.tools] }));
    }
    if (toolsRes.error) {
      console.error("[ManHourService] getNOSAiToolGroups tools error:", toolsRes.error);
      return DEFAULT_AI_TOOL_GROUPS.map((g) => ({ ...g, tools: [...g.tools] }));
    }

    const types = (typesRes.data || []) as Array<{
      code: string;
      display: string;
      eng_display: string | null;
      sorting: number | null;
    }>;
    if (types.length === 0) {
      return DEFAULT_AI_TOOL_GROUPS.map((g) => ({ ...g, tools: [...g.tools] }));
    }

    const toolsByCode: Record<string, string[]> = {};
    for (const row of (toolsRes.data || []) as Array<{ category: string | null; display: string | null }>) {
      if (!row.category || !row.display) continue;
      if (!toolsByCode[row.category]) toolsByCode[row.category] = [];
      toolsByCode[row.category].push(row.display);
    }

    return types.map((t) => ({
      code: t.code,
      display: t.display,
      eng_display: t.eng_display ?? null,
      sorting: t.sorting ?? 0,
      tools: toolsByCode[t.code] || [],
    }));
  } catch (err) {
    console.error("[ManHourService] getNOSAiToolGroups unexpected error:", err);
    return DEFAULT_AI_TOOL_GROUPS.map((g) => ({ ...g, tools: [...g.tools] }));
  }
}

/** @deprecated Prefer getNOSAiToolGroups(). */
export async function getNOSAiToolsByCategory(): Promise<Record<AiToolCategory, string[]>> {
  const groups = await getNOSAiToolGroups();
  const result: Record<AiToolCategory, string[]> = {
    text: [],
    image: [],
    video: [],
  };
  for (const g of groups) {
    if (g.code === "text" || g.code === "image" || g.code === "video") {
      result[g.code] = g.tools;
    }
  }
  return result;
}

/**
 * Get all active NOS Brands from nos_brands table
 */
export async function getNOSBrands(): Promise<NOSBrand[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("nos_brands")
    .select("*")
    .eq("is_active", true)
    .order("display", { ascending: true });

  if (error) {
    console.error("[ManHourService] getNOSBrands error:", error);
    throw new Error(error.message);
  }

  return (data || []) as NOSBrand[];
}

/**
 * Get all active NOS Work Locations from nos_work_locations table
 */
export async function getNOSWorkLocations(): Promise<NOSWorkLocation[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("nos_work_locations")
    .select("*")
    .eq("is_active", true)
    .order("display", { ascending: true });

  if (error) {
    console.error("[ManHourService] getNOSWorkLocations error:", error);
    throw new Error(error.message);
  }

  return (data || []) as NOSWorkLocation[];
}

/** @deprecated Use getNOSBrands() instead */
export async function getBrands(): Promise<{ id: string; display: string }[]> {
  const brands = await getNOSBrands();
  return brands.map((b) => ({ id: b.id, display: b.display }));
}

/** @deprecated Use getNOSWorkLocations() instead */
export async function getWorkLocations(): Promise<{ id: string; display: string; is_active: boolean }[]> {
  const locations = await getNOSWorkLocations();
  return locations.map((w) => ({ id: w.id, display: w.display, is_active: w.is_active }));
}

// ============================================================
// AGGREGATE / REPORTING FUNCTIONS
// ============================================================

/**
 * Get total hours summary for a staff within a date range
 */
export async function getStaffHoursSummary(
  staffId: string,
  startDate: string,
  endDate: string
): Promise<{ totalHours: number; daysWorked: number }> {
  const supabase = getSupabase();

  // Convert YYYY-MM-DD to full day range in HK timezone (+08:00)
  const startTimestamp = startDate.includes("T") ? startDate : `${startDate}T00:00:00+08:00`;
  const endTimestamp = endDate.includes("T") ? endDate : `${endDate}T23:59:59+08:00`;

  const { data, error } = await supabase
    .from("man_hour_dates")
    .select("total_work_hour")
    .eq("staff_id", staffId)
    .gte("report_date", startTimestamp)
    .lte("report_date", endTimestamp);

  if (error) {
    console.error("[ManHourService] getStaffHoursSummary error:", error);
    throw new Error(error.message);
  }

  const records = data || [];
  const totalHours = records.reduce(
    (sum: number, r: { total_work_hour?: number | string | null }) => sum + (Number(r.total_work_hour) || 0),
    0
  );
  const daysWorked = records.filter((r: { total_work_hour?: number | string | null }) => Number(r.total_work_hour) > 0).length;

  return { totalHours, daysWorked };
}

/**
 * Get tasks with their date info for a project (used in project ManHourPanel)
 */
export async function getProjectManHourSummary(
  projectId: string
): Promise<{ tasks: ManHourTask[]; totalHours: number; staffBreakdown: Record<string, number> }> {
  const supabase = getSupabase();

  const { data: tasks, error } = await supabase
    .from("man_hour_tasks")
    .select("*, man_hour_dates!inner(staff_id, staff_bubble_id, report_date)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ManHourService] getProjectManHourSummary error:", error);
    throw new Error(error.message);
  }

  const taskList = (tasks || []) as (ManHourTask & {
    man_hour_dates: {
      staff_id: string | null;
      staff_bubble_id?: string | null;
      report_date: string;
    };
  })[];
  const totalHours = taskList.reduce((sum, t) => sum + (Number(t.work_hour) || 0), 0);

  // Staff breakdown
  const staffBreakdown: Record<string, number> = {};
  taskList.forEach((t) => {
    const staffId = (t as any).man_hour_dates?.staff_id;
    if (staffId) {
      staffBreakdown[staffId] = (staffBreakdown[staffId] || 0) + (Number(t.work_hour) || 0);
    }
  });

  return { tasks: taskList, totalHours, staffBreakdown };
}

/**
 * Get tasks with their date info for a pitching (used in pitching ManHourPanel)
 * Queries man_hour_tasks where project_id = pitchingId AND job_type is a pitching type
 */
export async function getPitchingManHourSummary(
  pitchingId: string
): Promise<{ tasks: ManHourTask[]; totalHours: number; staffBreakdown: Record<string, number> }> {
  const supabase = getSupabase();

  const { data: tasks, error } = await supabase
    .from("man_hour_tasks")
    .select("*, man_hour_dates!inner(staff_id, staff_bubble_id, report_date)")
    .eq("project_id", pitchingId)
    .in("job_type", ["bwa_pitching", "bwf_pitching"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ManHourService] getPitchingManHourSummary error:", error);
    throw new Error(error.message);
  }

  const taskList = (tasks || []) as (ManHourTask & {
    man_hour_dates: {
      staff_id: string | null;
      staff_bubble_id?: string | null;
      report_date: string;
    };
  })[];
  const totalHours = taskList.reduce((sum, t) => sum + (Number(t.work_hour) || 0), 0);

  // Staff breakdown
  const staffBreakdown: Record<string, number> = {};
  taskList.forEach((t) => {
    const staffId = (t as any).man_hour_dates?.staff_id;
    if (staffId) {
      staffBreakdown[staffId] = (staffBreakdown[staffId] || 0) + (Number(t.work_hour) || 0);
    }
  });

  return { tasks: taskList, totalHours, staffBreakdown };
}

/**
 * Batch sum of work_hour for pitching IDs (list pages).
 * Same filter as getPitchingManHourSummary: job_type pitching variants.
 */
export async function getPitchingManHourTotalsByIds(
  pitchingIds: string[]
): Promise<Record<string, number>> {
  const ids = Array.from(new Set(pitchingIds.filter(Boolean)));
  if (ids.length === 0) return {};

  const supabase = getSupabase();
  const totals: Record<string, number> = {};
  for (const id of ids) totals[id] = 0;

  const ID_CHUNK = 200;
  const PAGE = 1000;
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("man_hour_tasks")
        .select("project_id, work_hour")
        .in("project_id", chunk)
        .in("job_type", ["bwa_pitching", "bwf_pitching"])
        .range(from, from + PAGE - 1);

      if (error) {
        console.error("[ManHourService] getPitchingManHourTotalsByIds error:", error);
        throw new Error(error.message);
      }

      const rows = data || [];
      for (const row of rows) {
        if (!row.project_id) continue;
        totals[row.project_id] =
          (totals[row.project_id] || 0) + (Number(row.work_hour) || 0);
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }

  for (const id of Object.keys(totals)) {
    totals[id] = Math.round(totals[id] * 10) / 10;
  }
  return totals;
}

// ============================================================
// PROJECT MANHOUR ANALYSIS (項目工時分析)
// Group man_hour_tasks by linked BWA/BWF pitching/project within
// a report_date range, then by staff who logged hours.
// ============================================================

export interface ProjectManhourTaskDetail {
  id: string;
  report_date: string;
  task_name: string | null;
  task_type: string | null;
  task_description: string | null;
  work_hour: number;
  work_location: string | null;
  brand_name: string | null;
  images: string[] | null;
  deliverables: DeliverablesData | null;
}

export interface ProjectManhourStaffRow {
  staff_id: string;
  staff_name: string;
  position: string | null;
  total_work_hour: number;
  tasks: ProjectManhourTaskDetail[];
}

export interface ProjectManhourProjectGroup {
  project_id: string;
  job_type: JobType;
  project_name: string | null;
  project_code: string | null;
  enquiry_date: string | null;
  /** pitching_stages for pitchings; status for projects */
  status_or_stage: string | null;
  total_work_hour: number;
  staff_count: number;
  staff: ProjectManhourStaffRow[];
}

const PROJECT_MANHOUR_JOB_TYPES: JobType[] = [
  "bwa_pitching",
  "bwa_project",
  "bwf_pitching",
  "bwf_project",
];

function isProjectManhourJobType(v: string | null | undefined): v is JobType {
  return !!v && (PROJECT_MANHOUR_JOB_TYPES as string[]).includes(v);
}

/**
 * Fetch project manhour analysis for a report_date range (YYYY-MM-DD, inclusive, HK).
 * Omit either bound (null/undefined/empty) for an open-ended / All Time window.
 * Only tasks linked to a BWA/BWF pitching or project are included.
 */
export async function fetchProjectManhourAnalysis(
  dateFrom?: string | null,
  dateTo?: string | null
): Promise<ProjectManhourProjectGroup[]> {
  const supabase = getSupabase();
  const startTimestamp = dateFrom ? `${dateFrom}T00:00:00+08:00` : null;
  const endTimestamp = dateTo ? `${dateTo}T23:59:59.999+08:00` : null;
  const PAGE_SIZE = 1000;

  type DateRow = { id: string; staff_id: string; report_date: string };
  const dateRows: DateRow[] = [];
  {
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      let q = supabase
        .from("man_hour_dates")
        .select("id, staff_id, report_date")
        .not("staff_id", "is", null)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (startTimestamp) q = q.gte("report_date", startTimestamp);
      if (endTimestamp) q = q.lte("report_date", endTimestamp);
      const { data, error } = await q;
      if (error) {
        console.error("[ManHourService] fetchProjectManhourAnalysis dates error:", error);
        throw new Error(error.message);
      }
      const page = (data || []) as DateRow[];
      dateRows.push(...page);
      hasMore = page.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
  }

  if (dateRows.length === 0) return [];

  const dateMeta = new Map<string, { staff_id: string; report_date: string }>();
  for (const d of dateRows) {
    dateMeta.set(d.id, { staff_id: d.staff_id, report_date: d.report_date });
  }
  const dateIds = dateRows.map((d) => d.id);

  type RawTask = {
    id: string;
    man_hour_date_id: string;
    project_id: string | null;
    project_name: string | null;
    job_type: string | null;
    task_name: string | null;
    task_type: string | null;
    task_bubble_id: string | null;
    task_description: string | null;
    work_hour: number;
    work_location: string | null;
    brand_name: string | null;
    images: string[] | null;
    deliverables: DeliverablesData | null;
  };

  const allTasks: RawTask[] = [];
  for (let i = 0; i < dateIds.length; i += 200) {
    const chunk = dateIds.slice(i, i + 200);
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("man_hour_tasks")
        .select(
          `id, man_hour_date_id, project_id, project_name, job_type, task_name, task_type,
           task_bubble_id, task_description, work_hour, work_location, brand_name, images, deliverables`
        )
        .in("man_hour_date_id", chunk)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error("[ManHourService] fetchProjectManhourAnalysis tasks error:", error);
        throw new Error(error.message);
      }
      const page = (data || []) as RawTask[];
      allTasks.push(...page);
      hasMore = page.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
  }

  {
    const typeLabels = await resolveMissingTaskTypeLabels(allTasks);
    applyResolvedTaskTypes(allTasks, typeLabels);
  }

  const staffIds = new Set<string>();
  const idsByType: Record<JobType, Set<string>> = {
    bwa_pitching: new Set(),
    bwa_project: new Set(),
    bwf_pitching: new Set(),
    bwf_project: new Set(),
  };

  for (const t of allTasks) {
    const meta = dateMeta.get(t.man_hour_date_id);
    if (meta?.staff_id) staffIds.add(meta.staff_id);
    if (t.project_id && isProjectManhourJobType(t.job_type)) {
      idsByType[t.job_type].add(t.project_id);
    }
  }

  const staffNameMap = new Map<string, string>();
  const staffPositionMap = new Map<string, string | null>();
  const staffIdList = Array.from(staffIds);
  for (let i = 0; i < staffIdList.length; i += 200) {
    const chunk = staffIdList.slice(i, i + 200);
    const { data, error } = await supabase
      .from("staff")
      .select("id, name, full_name, position")
      .in("id", chunk);
    if (error) {
      console.error("[ManHourService] fetchProjectManhourAnalysis staff error:", error);
    } else {
      for (const s of data || []) {
        staffNameMap.set(s.id, s.name || s.full_name || "未命名");
        staffPositionMap.set(s.id, s.position ?? null);
      }
    }
  }

  type Meta = {
    name: string | null;
    code: string | null;
    enquiry_date: string | null;
    status_or_stage: string | null;
  };
  const metaMap = new Map<string, Meta>();

  async function fetchIdsInChunks(
    table: string,
    select: string,
    ids: string[]
  ): Promise<any[]> {
    const out: any[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .in("id", chunk);
      if (error) {
        console.error(`[ManHourService] fetchProjectManhourAnalysis ${table} error:`, error);
        continue;
      }
      out.push(...(data || []));
    }
    return out;
  }

  const [bwaPitchRows, bwaProjRows, bwfPitchRows, bwfProjRows] =
    await Promise.all([
      fetchIdsInChunks(
        "bwa_pitchings",
        "id, pitching_code, description, enquiry_date, pitching_stages, real_customer_display_name, real_building_name",
        Array.from(idsByType.bwa_pitching)
      ),
      fetchIdsInChunks(
        "bwa_projects",
        "id, project_code, project_name, enquiry_date, status",
        Array.from(idsByType.bwa_project)
      ),
      fetchIdsInChunks(
        "bwf_pitchings",
        "id, pitching_code, pitching_name, enquiry_date, pitching_stages, real_customer_display_name, real_customer_name",
        Array.from(idsByType.bwf_pitching)
      ),
      fetchIdsInChunks(
        "bwf_projects",
        "id, project_code, project_name, enquiry_date, status",
        Array.from(idsByType.bwf_project)
      ),
    ]);

  for (const row of bwaPitchRows) {
    metaMap.set(`bwa_pitching:${row.id}`, {
      name:
        row.description ||
        row.real_customer_display_name ||
        row.real_building_name ||
        null,
      code: row.pitching_code ?? null,
      enquiry_date: row.enquiry_date ?? null,
      status_or_stage: row.pitching_stages ?? null,
    });
  }
  for (const row of bwaProjRows) {
    metaMap.set(`bwa_project:${row.id}`, {
      name: row.project_name ?? null,
      code: row.project_code ?? null,
      enquiry_date: row.enquiry_date ?? null,
      status_or_stage: row.status ?? null,
    });
  }
  for (const row of bwfPitchRows) {
    metaMap.set(`bwf_pitching:${row.id}`, {
      name:
        row.pitching_name ||
        row.real_customer_display_name ||
        row.real_customer_name ||
        null,
      code: row.pitching_code ?? null,
      enquiry_date: row.enquiry_date ?? null,
      status_or_stage: row.pitching_stages ?? null,
    });
  }
  for (const row of bwfProjRows) {
    metaMap.set(`bwf_project:${row.id}`, {
      name: row.project_name ?? null,
      code: row.project_code ?? null,
      enquiry_date: row.enquiry_date ?? null,
      status_or_stage: row.status ?? null,
    });
  }

  type AccStaff = {
    staff_id: string;
    total_work_hour: number;
    tasks: ProjectManhourTaskDetail[];
  };
  type AccProject = {
    project_id: string;
    job_type: JobType;
    task_project_name: string | null;
    total_work_hour: number;
    staff: Map<string, AccStaff>;
  };

  const projectMap = new Map<string, AccProject>();

  for (const t of allTasks) {
    const dateInfo = dateMeta.get(t.man_hour_date_id);
    const staffId = dateInfo?.staff_id;
    if (!staffId) continue;
    if (!t.project_id || !isProjectManhourJobType(t.job_type)) continue;

    const hours = Number(t.work_hour) || 0;
    const pKey = `${t.job_type}:${t.project_id}`;
    let proj = projectMap.get(pKey);
    if (!proj) {
      proj = {
        project_id: t.project_id,
        job_type: t.job_type,
        task_project_name: t.project_name,
        total_work_hour: 0,
        staff: new Map(),
      };
      projectMap.set(pKey, proj);
    } else if (!proj.task_project_name && t.project_name) {
      proj.task_project_name = t.project_name;
    }
    proj.total_work_hour += hours;

    let staff = proj.staff.get(staffId);
    if (!staff) {
      staff = { staff_id: staffId, total_work_hour: 0, tasks: [] };
      proj.staff.set(staffId, staff);
    }
    staff.total_work_hour += hours;
    staff.tasks.push({
      id: t.id,
      report_date: dateInfo?.report_date || "",
      task_name: t.task_name,
      task_type: t.task_type,
      task_description: t.task_description,
      work_hour: hours,
      work_location: t.work_location,
      brand_name: t.brand_name,
      images: t.images ?? null,
      deliverables: t.deliverables ?? null,
    });
  }

  const enquiryTime = (v: string | null) => {
    if (!v) return 0;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  const groups: ProjectManhourProjectGroup[] = [];

  for (const proj of projectMap.values()) {
    const meta = metaMap.get(`${proj.job_type}:${proj.project_id}`);
    const staffRows: ProjectManhourStaffRow[] = [];

    for (const s of proj.staff.values()) {
      s.tasks.sort((a, b) => {
        const ta = new Date(a.report_date).getTime() || 0;
        const tb = new Date(b.report_date).getTime() || 0;
        return tb - ta;
      });
      staffRows.push({
        staff_id: s.staff_id,
        staff_name: staffNameMap.get(s.staff_id) || "未命名員工",
        position: staffPositionMap.get(s.staff_id) ?? null,
        total_work_hour: Math.round(s.total_work_hour * 100) / 100,
        tasks: s.tasks,
      });
    }
    staffRows.sort((a, b) => b.total_work_hour - a.total_work_hour);

    groups.push({
      project_id: proj.project_id,
      job_type: proj.job_type,
      project_name: meta?.name || proj.task_project_name || null,
      project_code: meta?.code ?? null,
      enquiry_date: meta?.enquiry_date ?? null,
      status_or_stage: meta?.status_or_stage ?? null,
      total_work_hour: Math.round(proj.total_work_hour * 100) / 100,
      staff_count: staffRows.length,
      staff: staffRows,
    });
  }

  groups.sort((a, b) => {
    const byHours = b.total_work_hour - a.total_work_hour;
    if (byHours !== 0) return byHours;
    return enquiryTime(b.enquiry_date) - enquiryTime(a.enquiry_date);
  });
  return groups;
}

// ============================================================
// DESIGNER LOAD — staff tasks for one pitching/project
// ============================================================

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * PMS saves after ~2026-06 often leave man_hour_tasks.task_type null.
 * Resolve display labels via task_bubble_id → nos_tasks.task_type_ids → nos_task_types.
 * Returns map keyed by nos_tasks.id and bubble_id (when present).
 */
async function resolveMissingTaskTypeLabels(
  rows: { task_type: string | null; task_bubble_id?: string | null }[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const refs = Array.from(
    new Set(
      rows
        .filter((r) => !(r.task_type && r.task_type.trim()) && r.task_bubble_id)
        .map((r) => r.task_bubble_id as string)
    )
  );
  if (refs.length === 0) return out;

  const supabase = getSupabase();
  type NosTaskRow = {
    id: string;
    bubble_id: string | null;
    task_type_ids: string[] | null;
  };
  const nosTasks: NosTaskRow[] = [];

  const uuids = refs.filter(isUuid);
  const bubbles = refs.filter((r) => !isUuid(r));

  for (let i = 0; i < uuids.length; i += 200) {
    const chunk = uuids.slice(i, i + 200);
    const { data, error } = await supabase
      .from("nos_tasks")
      .select("id, bubble_id, task_type_ids")
      .in("id", chunk);
    if (error) {
      console.error(
        "[ManHourService] resolveMissingTaskTypeLabels nos_tasks id:",
        error
      );
      continue;
    }
    nosTasks.push(...((data || []) as NosTaskRow[]));
  }
  for (let i = 0; i < bubbles.length; i += 200) {
    const chunk = bubbles.slice(i, i + 200);
    const { data, error } = await supabase
      .from("nos_tasks")
      .select("id, bubble_id, task_type_ids")
      .in("bubble_id", chunk);
    if (error) {
      console.error(
        "[ManHourService] resolveMissingTaskTypeLabels nos_tasks bubble:",
        error
      );
      continue;
    }
    nosTasks.push(...((data || []) as NosTaskRow[]));
  }

  const typeIds = new Set<string>();
  for (const nt of nosTasks) {
    for (const tid of nt.task_type_ids || []) {
      if (tid) typeIds.add(tid);
    }
  }
  if (typeIds.size === 0) return out;

  const typeIdList = Array.from(typeIds);
  const typeLabelById = new Map<string, string>();
  type NosTypeRow = {
    id: string;
    bubble_id: string | null;
    display: string | null;
    eng_display: string | null;
  };

  const loadTypes = async (column: "id" | "bubble_id", ids: string[]) => {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await supabase
        .from("nos_task_types")
        .select("id, bubble_id, display, eng_display")
        .in(column, chunk);
      if (error) {
        console.error(
          `[ManHourService] resolveMissingTaskTypeLabels types ${column}:`,
          error
        );
        continue;
      }
      for (const tt of (data || []) as NosTypeRow[]) {
        const label = tt.display || tt.eng_display || null;
        if (!label) continue;
        typeLabelById.set(tt.id, label);
        if (tt.bubble_id) typeLabelById.set(tt.bubble_id, label);
      }
    }
  };

  await loadTypes(
    "id",
    typeIdList.filter(isUuid)
  );
  await loadTypes(
    "bubble_id",
    typeIdList.filter((r) => !isUuid(r))
  );

  for (const nt of nosTasks) {
    let label: string | null = null;
    for (const tid of nt.task_type_ids || []) {
      label = typeLabelById.get(tid) || null;
      if (label) break;
    }
    if (!label) continue;
    out.set(nt.id, label);
    if (nt.bubble_id) out.set(nt.bubble_id, label);
  }
  return out;
}

function applyResolvedTaskTypes<
  T extends { task_type: string | null; task_bubble_id?: string | null },
>(rows: T[], labels: Map<string, string>): void {
  for (const r of rows) {
    if (r.task_type && r.task_type.trim()) continue;
    if (!r.task_bubble_id) continue;
    const label = labels.get(r.task_bubble_id);
    if (label) r.task_type = label;
  }
}

export interface DesignerLoadJobTaskRow {
  id: string;
  report_date: string;
  task_name: string | null;
  task_type: string | null;
  work_hour: number;
  deliverables: DeliverablesData | null;
  images: string[] | null;
}

/**
 * Man-hour tasks logged by one staff on one linked pitching/project.
 * Used by /designer-load expandable job rows.
 */
export async function fetchDesignerLoadJobTasks(
  staffId: string,
  projectId: string,
  jobType: JobType
): Promise<DesignerLoadJobTaskRow[]> {
  const supabase = getSupabase();
  const PAGE_SIZE = 1000;

  type DateRow = { id: string; report_date: string };
  const dateRows: DateRow[] = [];
  {
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("man_hour_dates")
        .select("id, report_date")
        .eq("staff_id", staffId)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error(
          "[ManHourService] fetchDesignerLoadJobTasks dates error:",
          error
        );
        throw new Error(error.message);
      }
      const page = (data || []) as DateRow[];
      dateRows.push(...page);
      hasMore = page.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
  }

  if (dateRows.length === 0) return [];

  const dateMeta = new Map(dateRows.map((d) => [d.id, d.report_date]));
  const dateIds = dateRows.map((d) => d.id);
  type RawJobTask = DesignerLoadJobTaskRow & {
    task_bubble_id?: string | null;
  };
  const tasks: RawJobTask[] = [];

  for (let i = 0; i < dateIds.length; i += 200) {
    const chunk = dateIds.slice(i, i + 200);
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("man_hour_tasks")
        .select(
          "id, man_hour_date_id, task_name, task_type, task_bubble_id, work_hour, deliverables, images"
        )
        .in("man_hour_date_id", chunk)
        .eq("project_id", projectId)
        .eq("job_type", jobType)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error(
          "[ManHourService] fetchDesignerLoadJobTasks tasks error:",
          error
        );
        throw new Error(error.message);
      }
      const page = data || [];
      for (const t of page) {
        tasks.push({
          id: t.id,
          report_date: dateMeta.get(t.man_hour_date_id) || "",
          task_name: t.task_name ?? null,
          task_type: t.task_type ?? null,
          task_bubble_id: t.task_bubble_id ?? null,
          work_hour: Number(t.work_hour) || 0,
          deliverables: (t.deliverables as DeliverablesData | null) ?? null,
          images: (t.images as string[] | null) ?? null,
        });
      }
      hasMore = page.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
  }

  const typeLabels = await resolveMissingTaskTypeLabels(tasks);
  applyResolvedTaskTypes(tasks, typeLabels);

  tasks.sort((a, b) => {
    const ta = new Date(a.report_date).getTime() || 0;
    const tb = new Date(b.report_date).getTime() || 0;
    return tb - ta;
  });
  return tasks.map(({ task_bubble_id: _ref, ...row }) => row);
}

/**
 * Batch-load man-hour tasks for one staff across many pitching/projects.
 * Keys: `${job_type}:${projectId}`.
 */
export async function fetchDesignerLoadStaffJobTasks(
  staffId: string,
  jobs: { id: string; job_type: JobType }[]
): Promise<Record<string, DesignerLoadJobTaskRow[]>> {
  const out: Record<string, DesignerLoadJobTaskRow[]> = {};
  for (const j of jobs) {
    out[`${j.job_type}:${j.id}`] = [];
  }
  if (jobs.length === 0) return out;

  const supabase = getSupabase();
  const PAGE_SIZE = 1000;
  const jobKeySet = new Set(jobs.map((j) => `${j.job_type}:${j.id}`));
  const projectIds = Array.from(new Set(jobs.map((j) => j.id)));

  type DateRow = { id: string; report_date: string };
  const dateRows: DateRow[] = [];
  {
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("man_hour_dates")
        .select("id, report_date")
        .eq("staff_id", staffId)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error(
          "[ManHourService] fetchDesignerLoadStaffJobTasks dates error:",
          error
        );
        throw new Error(error.message);
      }
      const page = (data || []) as DateRow[];
      dateRows.push(...page);
      hasMore = page.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
  }

  if (dateRows.length === 0) return out;

  const dateMeta = new Map(dateRows.map((d) => [d.id, d.report_date]));
  const dateIds = dateRows.map((d) => d.id);
  type RawJobTask = DesignerLoadJobTaskRow & {
    task_bubble_id?: string | null;
  };
  const rawByKey: Record<string, RawJobTask[]> = {};
  for (const j of jobs) {
    rawByKey[`${j.job_type}:${j.id}`] = [];
  }

  for (let i = 0; i < dateIds.length; i += 200) {
    const dateChunk = dateIds.slice(i, i + 200);
    for (let j = 0; j < projectIds.length; j += 200) {
      const projectChunk = projectIds.slice(j, j + 200);
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("man_hour_tasks")
          .select(
            "id, man_hour_date_id, project_id, job_type, task_name, task_type, task_bubble_id, work_hour, deliverables, images"
          )
          .in("man_hour_date_id", dateChunk)
          .in("project_id", projectChunk)
          .order("id", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          console.error(
            "[ManHourService] fetchDesignerLoadStaffJobTasks tasks error:",
            error
          );
          throw new Error(error.message);
        }
        const page = data || [];
        for (const t of page) {
          if (!t.project_id || !t.job_type) continue;
          const key = `${t.job_type}:${t.project_id}`;
          if (!jobKeySet.has(key)) continue;
          if (!rawByKey[key]) rawByKey[key] = [];
          rawByKey[key].push({
            id: t.id,
            report_date: dateMeta.get(t.man_hour_date_id) || "",
            task_name: t.task_name ?? null,
            task_type: t.task_type ?? null,
            task_bubble_id: t.task_bubble_id ?? null,
            work_hour: Number(t.work_hour) || 0,
            deliverables: (t.deliverables as DeliverablesData | null) ?? null,
            images: (t.images as string[] | null) ?? null,
          });
        }
        hasMore = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
    }
  }

  const allRaw = Object.values(rawByKey).flat();
  const typeLabels = await resolveMissingTaskTypeLabels(allRaw);
  applyResolvedTaskTypes(allRaw, typeLabels);

  for (const key of Object.keys(rawByKey)) {
    const rows = rawByKey[key];
    rows.sort((a, b) => {
      const ta = new Date(a.report_date).getTime() || 0;
      const tb = new Date(b.report_date).getTime() || 0;
      return tb - ta;
    });
    out[key] = rows.map(({ task_bubble_id: _ref, ...row }) => row);
  }
  return out;
}

// ============================================================
// 3D圖輸出表 (/design-reports/3d-output)
// Aggregates man_hour_tasks whose NOS task requires deliverables
// (nos_tasks.require_deliverables = true), by month + project + nos_task.
// ============================================================

/** team_types.id for「3D Render」— filter by ID so display renames don't break. */
export const TEAM_TYPE_ID_3D_RENDER =
  "de9950cd-bef4-4c94-8945-eb5af9351945";

export interface ThreeDOutputReportRow {
  key: string;
  /** YYYY-MM (Asia/Hong_Kong) */
  month_key: string;
  /** MM/YYYY */
  month_label: string;
  project_id: string | null;
  project_name: string;
  job_type: JobType | null;
  source: "BWA" | "BWF";
  staff_ids: string[];
  /** 是否成交 — linked job is a signed project (not pitching) */
  is_converted: boolean;
  /** 完成總工時 */
  total_work_hour: number;
  /** 完成張 — Σ deliverables.count */
  completed_sheets: number;
  /** 修改次 — count of tasks with deliverables.stage = 未完成初稿 */
  revision_count: number;
  /** 是否使用AI */
  used_ai: boolean;
  /** Distinct AI tool names used (for display when used_ai) */
  ai_tools_used: string[];
  /** 主要使用的3D工具 */
  main_3d_tool: string;
  /** 任務 — nos_tasks.display */
  task: string;
  /** nos_tasks.id used for grouping */
  nos_task_id: string;
  /** man_hour_tasks.images from tasks in this group (unique URLs) */
  images: string[];
}

/** @deprecated Use ThreeDOutputReportRow */
export type FocusProjectsReportRow = ThreeDOutputReportRow;

function hkMonthKey(iso: string): { key: string; label: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { key: "", label: "—" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  if (!y || !m) return { key: "", label: "—" };
  return { key: `${y}-${m}`, label: `${m}/${y}` };
}

function jobTypeToSource(jobType: JobType | null): "BWA" | "BWF" {
  if (jobType === "bwf_project" || jobType === "bwf_pitching") return "BWF";
  return "BWA";
}

function isConvertedJob(jobType: JobType | null): boolean {
  return jobType === "bwa_project" || jobType === "bwf_project";
}

function inferMain3dTool(taskName: string | null): string {
  if (!taskName) return "—";
  const lower = taskName.toLowerCase();
  if (lower.includes("3d max") || lower.includes("3dmax")) return "3D Max";
  if (lower.includes("sketchup") || /(^|[^a-z])su([^a-z]|$)/i.test(taskName)) {
    return "SU";
  }
  return "—";
}

function collectAiToolNames(ai: AiToolsData | null | undefined): string[] {
  if (!ai || typeof ai !== "object") return [];
  const names: string[] = [];
  for (const [k, v] of Object.entries(ai)) {
    if (k.endsWith("_other") && typeof v === "string") {
      const t = v.trim();
      if (t) names.push(t);
      continue;
    }
    if (Array.isArray(v)) {
      for (const tool of v) {
        if (typeof tool === "string" && tool.trim()) names.push(tool.trim());
      }
    }
  }
  return names;
}

function taskUsesAi(ai: AiToolsData | null | undefined, taskName: string | null): boolean {
  if (collectAiToolNames(ai).length > 0) return true;
  if (taskName && /\bAI\b/i.test(taskName)) return true;
  return false;
}

/**
 * 3D圖輸出表 rows for a report_date range (YYYY-MM-DD, inclusive, HK).
 * Only includes man_hour_tasks linked to nos_tasks with require_deliverables = true.
 * Grouped by month + project + nos_tasks.id.
 */
export async function fetchThreeDOutputReport(
  dateFrom?: string | null,
  dateTo?: string | null
): Promise<ThreeDOutputReportRow[]> {
  const supabase = getSupabase();
  const startTimestamp = dateFrom ? `${dateFrom}T00:00:00+08:00` : null;
  const endTimestamp = dateTo ? `${dateTo}T23:59:59.999+08:00` : null;
  const PAGE_SIZE = 1000;

  type NosReq = { id: string; bubble_id: string | null; display: string };
  const nosRequired: NosReq[] = [];
  {
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("nos_tasks")
        .select("id, bubble_id, display")
        .eq("require_deliverables", true)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error("[ManHourService] fetchThreeDOutputReport nos_tasks:", error);
        throw new Error(error.message);
      }
      const page = (data || []) as NosReq[];
      nosRequired.push(...page);
      hasMore = page.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
  }

  if (nosRequired.length === 0) return [];

  const nosByKey = new Map<string, NosReq>();
  const nosByDisplay = new Map<string, NosReq>();
  for (const n of nosRequired) {
    nosByKey.set(n.id, n);
    if (n.bubble_id) nosByKey.set(n.bubble_id, n);
    if (n.display) nosByDisplay.set(n.display, n);
  }

  type DateRow = { id: string; staff_id: string | null; report_date: string };
  const dateRows: DateRow[] = [];
  {
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      let q = supabase
        .from("man_hour_dates")
        .select("id, staff_id, report_date")
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (startTimestamp) q = q.gte("report_date", startTimestamp);
      if (endTimestamp) q = q.lte("report_date", endTimestamp);
      const { data, error } = await q;
      if (error) {
        console.error("[ManHourService] fetchThreeDOutputReport dates:", error);
        throw new Error(error.message);
      }
      const page = (data || []) as DateRow[];
      dateRows.push(...page);
      hasMore = page.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
  }

  if (dateRows.length === 0) return [];

  const dateMeta = new Map(
    dateRows.map((d) => [d.id, { staff_id: d.staff_id, report_date: d.report_date }])
  );
  const dateIds = dateRows.map((d) => d.id);

  type RawTask = {
    id: string;
    man_hour_date_id: string;
    project_id: string | null;
    project_name: string | null;
    job_type: string | null;
    task_name: string | null;
    task_bubble_id: string | null;
    work_hour: number;
    ai_tools: AiToolsData | null;
    deliverables: DeliverablesData | null;
    images: string[] | string | null;
  };

  const allTasks: RawTask[] = [];
  for (let i = 0; i < dateIds.length; i += 200) {
    const chunk = dateIds.slice(i, i + 200);
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("man_hour_tasks")
        .select(
          `id, man_hour_date_id, project_id, project_name, job_type, task_name,
           task_bubble_id, work_hour, ai_tools, deliverables, images`
        )
        .in("man_hour_date_id", chunk)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error("[ManHourService] fetchThreeDOutputReport tasks:", error);
        throw new Error(error.message);
      }
      const page = (data || []) as RawTask[];
      allTasks.push(...page);
      hasMore = page.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
  }

  type Resolved = RawTask & { nos_task_id: string; nos_display: string };
  const filtered: Resolved[] = [];
  for (const t of allTasks) {
    const nos =
      (t.task_bubble_id ? nosByKey.get(t.task_bubble_id) : undefined) ||
      (t.task_name ? nosByDisplay.get(t.task_name) : undefined);
    if (!nos) continue;
    filtered.push({
      ...t,
      nos_task_id: nos.id,
      nos_display: nos.display || t.task_name || "—",
    });
  }

  if (filtered.length === 0) return [];

  type Agg = {
    month_key: string;
    month_label: string;
    project_id: string | null;
    project_name: string;
    job_type: JobType | null;
    nos_task_id: string;
    task: string;
    staff_ids: Set<string>;
    total_work_hour: number;
    completed_sheets: number;
    revision_count: number;
    used_ai: boolean;
    ai_tools: Set<string>;
    images: string[];
    imageSeen: Set<string>;
  };

  const groups = new Map<string, Agg>();

  for (const t of filtered) {
    const meta = dateMeta.get(t.man_hour_date_id);
    if (!meta) continue;
    const { key: month_key, label: month_label } = hkMonthKey(meta.report_date);
    if (!month_key) continue;

    const jobType = isProjectManhourJobType(t.job_type) ? t.job_type : null;
    const projectId = t.project_id || "";
    const groupKey = `${month_key}|${jobType || ""}|${projectId}|${t.nos_task_id}`;

    let g = groups.get(groupKey);
    if (!g) {
      g = {
        month_key,
        month_label,
        project_id: t.project_id,
        project_name: (t.project_name || "").trim() || "未命名項目",
        job_type: jobType,
        nos_task_id: t.nos_task_id,
        task: t.nos_display,
        staff_ids: new Set(),
        total_work_hour: 0,
        completed_sheets: 0,
        revision_count: 0,
        used_ai: false,
        ai_tools: new Set(),
        images: [],
        imageSeen: new Set(),
      };
      groups.set(groupKey, g);
    } else if (
      (!g.project_name || g.project_name === "未命名項目") &&
      t.project_name
    ) {
      g.project_name = t.project_name.trim();
    }

    if (meta.staff_id) g.staff_ids.add(meta.staff_id);
    g.total_work_hour += Number(t.work_hour) || 0;

    const del = t.deliverables;
    if (del) {
      const count = Number(del.count) || 0;
      g.completed_sheets += count;
      if (del.stage === "未完成初稿") g.revision_count += 1;
    }

    for (const name of collectAiToolNames(t.ai_tools)) g.ai_tools.add(name);
    if (taskUsesAi(t.ai_tools, t.nos_display)) g.used_ai = true;

    for (const url of parseTaskAttachments(t.images)) {
      if (g.imageSeen.has(url)) continue;
      g.imageSeen.add(url);
      g.images.push(url);
    }
  }

  const rows: ThreeDOutputReportRow[] = [];
  for (const [key, g] of groups) {
    const ai_tools_used = Array.from(g.ai_tools).sort((a, b) =>
      a.localeCompare(b, "zh-HK")
    );
    rows.push({
      key,
      month_key: g.month_key,
      month_label: g.month_label,
      project_id: g.project_id,
      project_name: g.project_name,
      job_type: g.job_type,
      source: jobTypeToSource(g.job_type),
      staff_ids: Array.from(g.staff_ids),
      is_converted: isConvertedJob(g.job_type),
      total_work_hour: Math.round(g.total_work_hour * 10) / 10,
      completed_sheets: g.completed_sheets,
      revision_count: g.revision_count,
      used_ai: g.used_ai,
      ai_tools_used,
      main_3d_tool: inferMain3dTool(g.task),
      task: g.task,
      nos_task_id: g.nos_task_id,
      images: g.images,
    });
  }

  rows.sort((a, b) => {
    if (a.month_key !== b.month_key) return b.month_key.localeCompare(a.month_key);
    if (a.project_name !== b.project_name) {
      return a.project_name.localeCompare(b.project_name, "zh-HK");
    }
    return a.task.localeCompare(b.task, "zh-HK");
  });

  return rows;
}

/** @deprecated Use fetchThreeDOutputReport */
export const fetchFocusProjectsReport = fetchThreeDOutputReport;
