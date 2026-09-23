"use client";

import { createClient } from "@/lib/supabase/client";
import type { JobType } from "@/lib/man-hour-service";
import { toHkYmd } from "@/lib/date-utils";

// ─── Constants ───────────────────────────────────────────────

export const DESIGN_STAGES = [
  "剛剛開始",
  "投標進行中",
  "客人確定",
  "客人新要求,大改",
  "少量修改",
  "差不多完成",
  "已經完成",
] as const;

export type DesignStage = (typeof DESIGN_STAGES)[number];

export type DesignJobSource = "bwa" | "bwf";

export type ManHourReportMode = "standard" | "design" | "3d_design";

export const MAN_HOUR_REPORT_MODE_KEY = "manHourReportMode";

/** team_types.id → default work-kind on testing / man-hour report form. */
export const TEAM_TYPE_ID_PM = "c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a01";
export const TEAM_TYPE_ID_DESIGN = "c3a8f1e2-4b5d-4e6f-9a0b-1c2d3e4f5a02";
export const TEAM_TYPE_ID_3D_RENDER = "de9950cd-bef4-4c94-8945-eb5af9351945";

export function defaultReportModeFromPosition(position: string | null | undefined): ManHourReportMode {
  if (position === "3D Designer") return "3d_design";
  if (position === "Designer") return "design";
  return "standard";
}

/** Prefer staff.n_team_type_id; fall back to position for other teams. */
export function defaultReportModeFromTeam(
  teamTypeId: string | null | undefined,
  position?: string | null
): ManHourReportMode {
  if (teamTypeId === TEAM_TYPE_ID_3D_RENDER) return "3d_design";
  if (teamTypeId === TEAM_TYPE_ID_DESIGN) return "design";
  if (teamTypeId === TEAM_TYPE_ID_PM) return "standard";
  return defaultReportModeFromPosition(position);
}

export function readStoredReportMode(): ManHourReportMode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(MAN_HOUR_REPORT_MODE_KEY);
  if (v === "standard" || v === "design" || v === "3d_design") return v;
  return null;
}

export function writeStoredReportMode(mode: ManHourReportMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MAN_HOUR_REPORT_MODE_KEY, mode);
}

export function formatDueDateZh(dueDate: string | Date): string {
  const raw =
    typeof dueDate === "string"
      ? dueDate
      : dueDate.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
  const ymd = toHkYmd(raw);
  if (!ymd) return String(dueDate);
  const [, month, day] = ymd.split("-");
  return `${Number(month)}月${Number(day)}前完成`;
}

// ─── Types ───────────────────────────────────────────────────

export interface DesignJob {
  id: string;
  staff_id: string;
  nos_task_id: string;
  source: DesignJobSource;
  pitching_id: string;
  project_id: string | null;
  job_type: JobType;
  budget_hours: number;
  due_date: string;
  progress_pct: number;
  design_stage: DesignStage | string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface ResolvedPitchingProject {
  source: DesignJobSource;
  pitching_id: string;
  project_id: string | null;
  job_type: JobType;
  display_name: string;
  /** ID to store on man_hour_tasks.project_id (prefer project when present). */
  link_id: string;
}

export interface DesignJobCreateInput {
  staff_id: string;
  nos_task_id: string;
  source: DesignJobSource;
  pitching_id: string;
  project_id?: string | null;
  job_type: JobType;
  budget_hours: number;
  due_date: string;
  progress_pct?: number;
  design_stage?: DesignStage | string;
  display_name: string;
}

export interface DesignJobStageHours {
  design_stage: string;
  hours: number;
}

export interface DesignerDailyFeedItem {
  task_id: string;
  man_hour_date_id: string;
  report_date: string;
  staff_id: string | null;
  staff_name: string;
  work_hour: number;
  task_description: string | null;
  progress_pct: number | null;
  design_stage: string | null;
  design_job_id: string;
  display_name: string;
  /** Resolved nos_tasks.display for the job's nos_task_id. */
  nos_task_display: string | null;
  budget_hours: number;
  due_date: string;
  accum_hours: number;
}

export interface ThreeDCollectionOption {
  id: string;
  display_name: string | null;
}

// ─── Client ──────────────────────────────────────────────────

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createClient();
  return _supabase;
}

function sourceFromJobType(jobType: JobType): DesignJobSource {
  return jobType.startsWith("bwf") ? "bwf" : "bwa";
}

// ─── Resolve pitching / project ──────────────────────────────

export async function resolvePitchingProject(
  selectedId: string,
  selectedJobType: JobType,
  fallbackDisplayName?: string
): Promise<ResolvedPitchingProject> {
  const supabase = getSupabase();
  const source = sourceFromJobType(selectedJobType);

  if (selectedJobType === "bwa_pitching") {
    const { data: pitching } = await supabase
      .from("bwa_pitchings")
      .select("id, pitching_code, real_customer_display_name, real_building_name, site_address")
      .eq("id", selectedId)
      .maybeSingle();

    const { data: project } = await supabase
      .from("bwa_projects")
      .select("id, project_code, project_name, real_customer_display_name")
      .eq("pitching_id", selectedId)
      .order("created_date", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const pitchingName = pitching
      ? pitching.pitching_code
        ? `${pitching.pitching_code} ${pitching.real_customer_display_name || pitching.real_building_name || ""}`.trim()
        : pitching.real_customer_display_name || pitching.site_address || selectedId
      : fallbackDisplayName || selectedId;

    if (project) {
      const projectName = project.project_code
        ? `${project.project_code} ${project.project_name || project.real_customer_display_name || ""}`.trim()
        : project.project_name || project.real_customer_display_name || project.id;
      return {
        source,
        pitching_id: selectedId,
        project_id: project.id,
        job_type: "bwa_project",
        display_name: projectName || pitchingName,
        link_id: project.id,
      };
    }

    return {
      source,
      pitching_id: selectedId,
      project_id: null,
      job_type: "bwa_pitching",
      display_name: pitchingName,
      link_id: selectedId,
    };
  }

  if (selectedJobType === "bwa_project") {
    const { data: project } = await supabase
      .from("bwa_projects")
      .select("id, pitching_id, project_code, project_name, real_customer_display_name")
      .eq("id", selectedId)
      .maybeSingle();

    if (!project?.pitching_id) {
      throw new Error("此項目沒有關聯提案，無法建立設計工作項。");
    }

    const display_name = project.project_code
      ? `${project.project_code} ${project.project_name || project.real_customer_display_name || ""}`.trim()
      : project.project_name || project.real_customer_display_name || selectedId;

    return {
      source: "bwa",
      pitching_id: project.pitching_id,
      project_id: project.id,
      job_type: "bwa_project",
      display_name: display_name || fallbackDisplayName || selectedId,
      link_id: project.id,
    };
  }

  if (selectedJobType === "bwf_pitching") {
    const { data: pitching } = await supabase
      .from("bwf_pitchings")
      .select("id, pitching_code, pitching_name, real_customer_display_name")
      .eq("id", selectedId)
      .maybeSingle();

    const { data: project } = await supabase
      .from("bwf_projects")
      .select("id, project_code, project_name, real_customer_display_name")
      .eq("bwf_pitching_id", selectedId)
      .order("created_date", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const pitchingName = pitching
      ? pitching.pitching_code
        ? `${pitching.pitching_code} ${pitching.pitching_name || pitching.real_customer_display_name || ""}`.trim()
        : pitching.pitching_name || pitching.real_customer_display_name || selectedId
      : fallbackDisplayName || selectedId;

    if (project) {
      const projectName = project.project_code
        ? `${project.project_code} ${project.project_name || project.real_customer_display_name || ""}`.trim()
        : project.project_name || project.real_customer_display_name || project.id;
      return {
        source,
        pitching_id: selectedId,
        project_id: project.id,
        job_type: "bwf_project",
        display_name: projectName || pitchingName,
        link_id: project.id,
      };
    }

    return {
      source,
      pitching_id: selectedId,
      project_id: null,
      job_type: "bwf_pitching",
      display_name: pitchingName,
      link_id: selectedId,
    };
  }

  // bwf_project
  const { data: project } = await supabase
    .from("bwf_projects")
    .select("id, bwf_pitching_id, project_code, project_name, real_customer_display_name")
    .eq("id", selectedId)
    .maybeSingle();

  if (!project?.bwf_pitching_id) {
    throw new Error("此項目沒有關聯提案，無法建立設計工作項。");
  }

  const display_name = project.project_code
    ? `${project.project_code} ${project.project_name || project.real_customer_display_name || ""}`.trim()
    : project.project_name || project.real_customer_display_name || selectedId;

  return {
    source: "bwf",
    pitching_id: project.bwf_pitching_id,
    project_id: project.id,
    job_type: "bwf_project",
    display_name: display_name || fallbackDisplayName || selectedId,
    link_id: project.id,
  };
}

// ─── nos_tasks labels ────────────────────────────────────────

/** Batch-resolve nos_tasks.display by UUID. */
export async function getNosTaskDisplayMap(
  nosTaskIds: string[]
): Promise<Record<string, string>> {
  const ids = Array.from(new Set(nosTaskIds.filter(Boolean)));
  if (!ids.length) return {};
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("nos_tasks")
    .select("id, display")
    .in("id", ids);
  if (error) {
    console.error("[DesignJobService] getNosTaskDisplayMap error:", error);
    throw new Error(error.message);
  }
  const map: Record<string, string> = {};
  for (const row of (data || []) as { id: string; display: string | null }[]) {
    if (row.display) map[row.id] = row.display;
  }
  return map;
}

export async function getNosTaskDisplay(nosTaskId: string): Promise<string | null> {
  if (!nosTaskId) return null;
  const map = await getNosTaskDisplayMap([nosTaskId]);
  return map[nosTaskId] || null;
}

// ─── CRUD ────────────────────────────────────────────────────

export async function getDesignJobByKey(
  pitchingId: string,
  source: DesignJobSource,
  nosTaskId: string
): Promise<DesignJob | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("design_jobs")
    .select("*")
    .eq("pitching_id", pitchingId)
    .eq("source", source)
    .eq("nos_task_id", nosTaskId)
    .maybeSingle();

  if (error) {
    console.error("[DesignJobService] getDesignJobByKey error:", error);
    throw new Error(error.message);
  }
  return (data as DesignJob) || null;
}

export async function getDesignJobById(id: string): Promise<DesignJob | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("design_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[DesignJobService] getDesignJobById error:", error);
    throw new Error(error.message);
  }
  return (data as DesignJob) || null;
}

export async function createDesignJob(input: DesignJobCreateInput): Promise<DesignJob> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("design_jobs")
    .insert({
      staff_id: input.staff_id,
      nos_task_id: input.nos_task_id,
      source: input.source,
      pitching_id: input.pitching_id,
      project_id: input.project_id ?? null,
      job_type: input.job_type,
      budget_hours: input.budget_hours,
      due_date: input.due_date,
      progress_pct: input.progress_pct ?? 0,
      design_stage: input.design_stage || "剛剛開始",
      display_name: input.display_name,
    })
    .select()
    .single();

  if (error) {
    console.error("[DesignJobService] createDesignJob error:", error);
    throw new Error(error.message);
  }
  return data as DesignJob;
}

export async function updateDesignJobProgress(
  id: string,
  updates: {
    progress_pct?: number;
    design_stage?: string;
    budget_hours?: number;
    due_date?: string;
    display_name?: string;
    project_id?: string | null;
    job_type?: JobType;
  }
): Promise<DesignJob> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("design_jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[DesignJobService] updateDesignJobProgress error:", error);
    throw new Error(error.message);
  }
  return data as DesignJob;
}

export async function getDesignJobAccumHours(designJobId: string): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("man_hour_tasks")
    .select("work_hour")
    .eq("design_job_id", designJobId);

  if (error) {
    console.error("[DesignJobService] getDesignJobAccumHours error:", error);
    throw new Error(error.message);
  }
  return (data || []).reduce(
    (sum: number, t: { work_hour?: number | string | null }) => sum + (Number(t.work_hour) || 0),
    0
  );
}

export async function getDesignJobStageHours(designJobId: string): Promise<DesignJobStageHours[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("man_hour_tasks")
    .select("design_stage, work_hour")
    .eq("design_job_id", designJobId);

  if (error) {
    console.error("[DesignJobService] getDesignJobStageHours error:", error);
    throw new Error(error.message);
  }

  const map = new Map<string, number>();
  for (const row of data || []) {
    const stage = row.design_stage || "（未標階段）";
    map.set(stage, (map.get(stage) || 0) + (Number(row.work_hour) || 0));
  }

  // Preserve stage order from DESIGN_STAGES, then unknowns
  const result: DesignJobStageHours[] = [];
  for (const stage of DESIGN_STAGES) {
    if (map.has(stage)) {
      result.push({ design_stage: stage, hours: map.get(stage)! });
      map.delete(stage);
    }
  }
  for (const [design_stage, hours] of map) {
    result.push({ design_stage, hours });
  }
  return result;
}

type DesignJobTaskDateRel = {
  report_date: string | null;
  staff_id: string | null;
};

type DesignJobTaskRow = {
  id: string;
  man_hour_date_id: string;
  work_hour: number | null;
  task_description: string | null;
  design_stage: string | null;
  progress_pct: number | null;
  created_at: string;
  man_hour_dates: DesignJobTaskDateRel | DesignJobTaskDateRel[] | null;
};

export async function getDesignJobTasks(designJobId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("man_hour_tasks")
    .select(
      `id, man_hour_date_id, work_hour, task_description, design_stage, progress_pct, created_at,
       man_hour_dates:man_hour_date_id ( report_date, staff_id )`
    )
    .eq("design_job_id", designJobId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[DesignJobService] getDesignJobTasks error:", error);
    throw new Error(error.message);
  }

  const rows = (data || []) as DesignJobTaskRow[];
  const staffIds = Array.from(
    new Set(
      rows
        .map((t: DesignJobTaskRow) => {
          const dateRel = Array.isArray(t.man_hour_dates)
            ? t.man_hour_dates[0]
            : t.man_hour_dates;
          return dateRel?.staff_id ?? null;
        })
        .filter((id: string | null): id is string => Boolean(id))
    )
  );

  const staffMap = new Map<string, string>();
  if (staffIds.length) {
    const { data: staffRows } = await supabase
      .from("staff")
      .select("id, name, full_name")
      .in("id", staffIds);
    for (const s of (staffRows || []) as {
      id: string;
      name: string | null;
      full_name: string | null;
    }[]) {
      staffMap.set(s.id, s.full_name || s.name || s.id);
    }
  }

  return rows.map((t: DesignJobTaskRow) => {
    const dateRel = Array.isArray(t.man_hour_dates)
      ? t.man_hour_dates[0]
      : t.man_hour_dates;
    const staffId = dateRel?.staff_id || null;
    return {
      ...t,
      staff_id: staffId,
      staff_name: staffId ? staffMap.get(staffId) || "—" : "—",
    };
  });
}

/** Attach design jobs (+ linked man_hour_tasks) to a newly created project on convert. */
export async function reattachDesignJobsToProject(params: {
  source: DesignJobSource;
  pitchingId: string;
  projectId: string;
  projectJobType: "bwa_project" | "bwf_project";
}): Promise<void> {
  const supabase = getSupabase();
  const { data: jobs, error } = await supabase
    .from("design_jobs")
    .update({
      project_id: params.projectId,
      job_type: params.projectJobType,
      updated_at: new Date().toISOString(),
    })
    .eq("pitching_id", params.pitchingId)
    .eq("source", params.source)
    .select("id");

  if (error) {
    console.error("[DesignJobService] reattachDesignJobsToProject jobs error:", error);
    throw new Error(error.message);
  }

  const jobIds = ((jobs || []) as { id: string }[]).map((j) => j.id);
  if (jobIds.length === 0) return;

  const { error: taskErr } = await supabase
    .from("man_hour_tasks")
    .update({
      project_id: params.projectId,
      job_type: params.projectJobType,
      updated_at: new Date().toISOString(),
    })
    .in("design_job_id", jobIds);

  if (taskErr) {
    console.error("[DesignJobService] reattachDesignJobsToProject tasks error:", taskErr);
    throw new Error(taskErr.message);
  }
}

export async function listDesignerDailyFeed(
  reportDateYmd: string,
  filters?: { staffId?: string }
): Promise<DesignerDailyFeedItem[]> {
  const supabase = getSupabase();

  // HK day window
  const dayStart = `${reportDateYmd}T00:00:00+08:00`;
  const next = new Date(`${reportDateYmd}T00:00:00+08:00`);
  next.setDate(next.getDate() + 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  const dayEnd = `${y}-${m}-${d}T00:00:00+08:00`;

  type DateRow = { id: string; staff_id: string | null; report_date: string };
  type TaskRow = {
    id: string;
    man_hour_date_id: string;
    work_hour: number | null;
    task_description: string | null;
    progress_pct: number | null;
    design_stage: string | null;
    design_job_id: string | null;
  };
  type JobRow = {
    id: string;
    display_name: string;
    budget_hours: number;
    due_date: string;
    nos_task_id: string;
  };

  let dateQuery = supabase
    .from("man_hour_dates")
    .select("id, staff_id, report_date")
    .gte("report_date", dayStart)
    .lt("report_date", dayEnd);

  if (filters?.staffId && filters.staffId !== "all") {
    dateQuery = dateQuery.eq("staff_id", filters.staffId);
  }

  const { data: datesRaw, error: dateErr } = await dateQuery;
  if (dateErr) {
    console.error("[DesignJobService] listDesignerDailyFeed dates error:", dateErr);
    throw new Error(dateErr.message);
  }
  const dates = (datesRaw || []) as DateRow[];
  if (!dates.length) return [];

  const dateIds = dates.map((x) => x.id);
  const dateMap = new Map<string, DateRow>(dates.map((x) => [x.id, x]));

  const { data: tasksRaw, error: taskErr } = await supabase
    .from("man_hour_tasks")
    .select(
      "id, man_hour_date_id, work_hour, task_description, progress_pct, design_stage, design_job_id"
    )
    .in("man_hour_date_id", dateIds)
    .not("design_job_id", "is", null)
    .order("created_at", { ascending: true });

  if (taskErr) {
    console.error("[DesignJobService] listDesignerDailyFeed tasks error:", taskErr);
    throw new Error(taskErr.message);
  }
  const tasks = (tasksRaw || []) as TaskRow[];
  if (!tasks.length) return [];

  const jobIds = Array.from(
    new Set(tasks.map((t) => t.design_job_id).filter(Boolean))
  ) as string[];
  const { data: jobsRaw, error: jobErr } = await supabase
    .from("design_jobs")
    .select("id, display_name, budget_hours, due_date, nos_task_id")
    .in("id", jobIds);

  if (jobErr) {
    console.error("[DesignJobService] listDesignerDailyFeed jobs error:", jobErr);
    throw new Error(jobErr.message);
  }
  const jobs = (jobsRaw || []) as JobRow[];
  const jobMap = new Map<string, JobRow>(jobs.map((j) => [j.id, j]));
  const nosTaskDisplayMap = await getNosTaskDisplayMap(
    jobs.map((j) => j.nos_task_id)
  );

  const staffIds = Array.from(
    new Set(dates.map((d) => d.staff_id).filter(Boolean))
  ) as string[];
  const staffMap = new Map<string, string>();
  if (staffIds.length) {
    const { data: staffRows } = await supabase
      .from("staff")
      .select("id, name, full_name")
      .in("id", staffIds);
    for (const s of (staffRows || []) as { id: string; name: string | null; full_name: string | null }[]) {
      staffMap.set(s.id, s.full_name || s.name || s.id);
    }
  }

  const accumByJob = new Map<string, number>();
  {
    const { data: allHours } = await supabase
      .from("man_hour_tasks")
      .select("design_job_id, work_hour")
      .in("design_job_id", jobIds);
    for (const row of (allHours || []) as { design_job_id: string | null; work_hour: number | null }[]) {
      if (!row.design_job_id) continue;
      accumByJob.set(
        row.design_job_id,
        (accumByJob.get(row.design_job_id) || 0) + (Number(row.work_hour) || 0)
      );
    }
  }

  const items: DesignerDailyFeedItem[] = [];
  for (const t of tasks) {
    if (!t.design_job_id) continue;
    const job = jobMap.get(t.design_job_id);
    if (!job) continue;
    const dateRow = dateMap.get(t.man_hour_date_id);
    const staffId = dateRow?.staff_id || null;
    items.push({
      task_id: t.id,
      man_hour_date_id: t.man_hour_date_id,
      report_date: dateRow?.report_date || reportDateYmd,
      staff_id: staffId,
      staff_name: staffId ? staffMap.get(staffId) || "—" : "—",
      work_hour: Number(t.work_hour) || 0,
      task_description: t.task_description,
      progress_pct: t.progress_pct != null ? Number(t.progress_pct) : null,
      design_stage: t.design_stage,
      design_job_id: t.design_job_id,
      display_name: job.display_name,
      nos_task_display: nosTaskDisplayMap[job.nos_task_id] || null,
      budget_hours: Number(job.budget_hours) || 0,
      due_date: job.due_date,
      accum_hours: accumByJob.get(t.design_job_id) || 0,
    });
  }
  return items;
}

// ─── 3D sync (phase 2) ───────────────────────────────────────

export async function listThreeDCollectionsForJob(job: DesignJob): Promise<ThreeDCollectionOption[]> {
  if (job.source !== "bwa") return [];
  const supabase = getSupabase();
  let query = supabase.from("three_d_collections").select("id, display_name");
  if (job.project_id) {
    query = query.eq("r_project_id", job.project_id);
  } else {
    query = query.eq("r_pitching_id", job.pitching_id);
  }
  const { data, error } = await query.order("created_date", { ascending: false });
  if (error) {
    console.error("[DesignJobService] listThreeDCollectionsForJob error:", error);
    throw new Error(error.message);
  }
  return (data || []) as ThreeDCollectionOption[];
}

export async function ensureThreeDCollection(params: {
  job: DesignJob;
  mainDesignerId: string;
  collectionId?: string | null;
  createNew?: boolean;
  newDisplayName?: string;
}): Promise<string> {
  const { job, mainDesignerId } = params;
  if (job.source !== "bwa") {
    throw new Error("3D 同步僅支援 BWA");
  }
  const supabase = getSupabase();

  if (params.collectionId && !params.createNew) {
    return params.collectionId;
  }

  const existing = await listThreeDCollectionsForJob(job);
  if (existing.length > 0 && !params.createNew && !params.collectionId) {
    return existing[0].id;
  }

  if (existing.length === 0 || params.createNew || !params.collectionId) {
    const displayName =
      params.newDisplayName?.trim() ||
      job.display_name ||
      "工作匯報效果圖";
    const insert: Record<string, unknown> = {
      display_name: displayName,
      o_3d_status: "草稿",
      main_designer_id: mainDesignerId || null,
      version_number: 1,
      created_date: new Date().toISOString(),
      modified_date: new Date().toISOString(),
      r_pitching_id: job.pitching_id,
    };
    if (job.project_id) insert.r_project_id = job.project_id;

    const { data, error } = await supabase
      .from("three_d_collections")
      .insert(insert)
      .select("id")
      .single();
    if (error) {
      console.error("[DesignJobService] ensureThreeDCollection error:", error);
      throw new Error(error.message);
    }
    return data.id as string;
  }

  return params.collectionId;
}

export async function syncImagesToThreeDRenders(params: {
  job: DesignJob;
  collectionId: string;
  imageUrls: string[];
}): Promise<void> {
  const { job, collectionId, imageUrls } = params;
  if (job.source !== "bwa" || imageUrls.length === 0) return;
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("three_d_renders")
    .select("order")
    .eq("r_3d_collection_id", collectionId);
  let maxOrder = ((existing || []) as { order?: number | null }[]).reduce(
    (max: number, r) => Math.max(max, r.order || 0),
    0
  );

  const rows = imageUrls.map((image) => {
    maxOrder += 1;
    const row: Record<string, unknown> = {
      image,
      order: maxOrder,
      r_3d_collection_id: collectionId,
      pitching_id: job.pitching_id,
      created_date: new Date().toISOString(),
      modified_date: new Date().toISOString(),
    };
    if (job.project_id) row.project_id = job.project_id;
    return row;
  });

  const { error } = await supabase.from("three_d_renders").insert(rows);
  if (error) {
    console.error("[DesignJobService] syncImagesToThreeDRenders error:", error);
    throw new Error(error.message);
  }
}
