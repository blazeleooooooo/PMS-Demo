import {
  supabase,
  safeQuery,
  logError,
  adminFetch,
} from "@/lib/data/_core";

// ─── SCHEDULE DATA ──────────────────────────────────────

export interface ScheduleTaskDefinition {
  id: string;
  display: string | null;
  sort: number | null;
  stage: string | null;
  is_bwa: boolean | null;
  is_bwf_ob: boolean | null;
  is_custom: boolean | null;
  is_start_date: boolean | null;
  is_handover_date: boolean | null;
  is_fast_build: boolean | null;
  os_schedule_groups_id: string | null;
  group_display?: string | null;
}

export interface ProjectScheduleRow {
  id: string;
  date: string | null;
  is_na: boolean | null;
  schedule_type: string | null;
  project_id: string | null;
  bwf_project_id: string | null;
  main_pm_id: string | null;
  payment_schedule_id: string | null;
  working_schedule_id: string | null;
  created_date: string | null;
  modified_date: string | null;
  // Joined data
  pm_name?: string | null;
  working_task_display?: string | null;
  working_task_sort?: number | null;
  working_task_stage?: string | null;
  working_task_is_custom?: boolean | null;
  working_task_os_schedule_groups_id?: string | null;
  working_task_os_schedule_groups?: string | null;
  payment_task_display?: string | null;
  payment_task_sort?: number | null;
  payment_task_stage?: string | null;
  payment_task_is_custom?: boolean | null;
  payment_task_os_schedule_groups_id?: string | null;
  payment_task_os_schedule_groups?: string | null;
}

/**
 * Fetch all schedule task definitions (NOS lookup).
 * These define the standard schedule milestones for BWA/BWF projects.
 */
export async function fetchScheduleTaskDefinitions(
  isBwa: boolean = true
): Promise<ScheduleTaskDefinition[]> {
  return safeQuery(async () => {
    let query = supabase
      .from("project_schedule_tasks")
      .select(`
        id, display, sort, stage, is_bwa, is_bwf_ob, is_custom,
        is_start_date, is_handover_date, is_fast_build,
        os_schedule_groups_id,
        group:project_schedule_tasks!fk_project_schedule_tasks_os_schedule_groups_id(display)
      `)
      .order("sort", { ascending: true });

    if (isBwa) {
      query = query.eq("is_bwa", true);
    } else {
      query = query.eq("is_bwf_ob", true);
    }

    const { data, error } = await query;
    if (error) {
      logError("fetchScheduleTaskDefinitions", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      ...row,
      group_display: row.group?.display || null,
    }));
  }, [], "fetchScheduleTaskDefinitions");
}

/**
 * Fetch project schedules for a specific BWA project.
 * Joins working_schedule and payment_schedule task definitions + PM name.
 */
export async function fetchProjectSchedules(
  projectId: string,
  entityType: "bwa_project" | "bwf_project" | "pitching" = "bwa_project"
): Promise<ProjectScheduleRow[]> {
  return safeQuery(async () => {
    const filterCol = entityType === "bwf_project" ? "bwf_project_id" : "project_id";

    const { data, error } = await supabase
      .from("project_schedules")
      .select(`
        id, date, is_na, schedule_type, project_id, bwf_project_id,
        main_pm_id, payment_schedule_id, working_schedule_id,
        created_date, modified_date,
        pm:staff!fk_project_schedules_main_pm_id(name),
        working_task:project_schedule_tasks!fk_project_schedules_working_schedule_id(display, sort, stage, is_custom, os_schedule_groups_id, os_schedule_groups),
        payment_task:project_schedule_tasks!fk_project_schedules_payment_schedule_id(display, sort, stage, is_custom, os_schedule_groups_id, os_schedule_groups)
      `)
      .eq(filterCol, projectId)
      .order("date", { ascending: true });

    if (error) {
      logError("fetchProjectSchedules", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      is_na: row.is_na,
      schedule_type: row.schedule_type,
      project_id: row.project_id,
      bwf_project_id: row.bwf_project_id,
      main_pm_id: row.main_pm_id,
      payment_schedule_id: row.payment_schedule_id,
      working_schedule_id: row.working_schedule_id,
      created_date: row.created_date,
      modified_date: row.modified_date,
      pm_name: row.pm?.name || null,
      working_task_display: row.working_task?.display || null,
      working_task_sort: row.working_task?.sort || null,
      working_task_stage: row.working_task?.stage || null,
      working_task_is_custom: row.working_task?.is_custom || null,
      working_task_os_schedule_groups_id: row.working_task?.os_schedule_groups_id || null,
      working_task_os_schedule_groups: row.working_task?.os_schedule_groups || null,
      payment_task_display: row.payment_task?.display || null,
      payment_task_sort: row.payment_task?.sort || null,
      payment_task_stage: row.payment_task?.stage || null,
      payment_task_is_custom: row.payment_task?.is_custom || null,
      payment_task_os_schedule_groups_id: row.payment_task?.os_schedule_groups_id || null,
      payment_task_os_schedule_groups: row.payment_task?.os_schedule_groups || null,
    }));
  }, [], "fetchProjectSchedules");
}

/**
 * Fetch working schedules only (filtered by working_schedule_id NOT NULL).
 */
export async function fetchWorkingSchedules(
  projectId: string,
  entityType: "bwa_project" | "bwf_project" = "bwa_project"
): Promise<ProjectScheduleRow[]> {
  return safeQuery(async () => {
    const filterCol = entityType === "bwf_project" ? "bwf_project_id" : "project_id";

    const { data, error } = await supabase
      .from("project_schedules")
      .select(`
        id, date, is_na, schedule_type, project_id, bwf_project_id,
        main_pm_id, working_schedule_id, payment_schedule_id,
        created_date, modified_date,
        pm:staff!fk_project_schedules_main_pm_id(name),
        working_task:project_schedule_tasks!fk_project_schedules_working_schedule_id(display, sort, stage, is_custom, os_schedule_groups_id, os_schedule_groups)
      `)
      .eq(filterCol, projectId)
      .not("working_schedule_id", "is", null)
      .order("date", { ascending: true });

    if (error) {
      logError("fetchWorkingSchedules", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      is_na: row.is_na,
      schedule_type: row.schedule_type,
      project_id: row.project_id,
      bwf_project_id: row.bwf_project_id,
      main_pm_id: row.main_pm_id,
      working_schedule_id: row.working_schedule_id,
      payment_schedule_id: row.payment_schedule_id,
      created_date: row.created_date,
      modified_date: row.modified_date,
      pm_name: row.pm?.name || null,
      working_task_display: row.working_task?.display || null,
      working_task_sort: row.working_task?.sort || null,
      working_task_stage: row.working_task?.stage || null,
      working_task_is_custom: row.working_task?.is_custom || null,
      working_task_os_schedule_groups_id: row.working_task?.os_schedule_groups_id || null,
      working_task_os_schedule_groups: row.working_task?.os_schedule_groups || null,
    }));
  }, [], "fetchWorkingSchedules");
}

/**
 * Fetch payment schedules only (filtered by payment_schedule_id NOT NULL).
 */
export async function fetchPaymentSchedules(
  projectId: string,
  entityType: "bwa_project" | "bwf_project" = "bwa_project"
): Promise<ProjectScheduleRow[]> {
  return safeQuery(async () => {
    const filterCol = entityType === "bwf_project" ? "bwf_project_id" : "project_id";

    const { data, error } = await supabase
      .from("project_schedules")
      .select(`
        id, date, is_na, schedule_type, project_id, bwf_project_id,
        main_pm_id, payment_schedule_id, working_schedule_id,
        created_date, modified_date,
        pm:staff!fk_project_schedules_main_pm_id(name),
        payment_task:project_schedule_tasks!fk_project_schedules_payment_schedule_id(display, sort, stage, is_custom, os_schedule_groups_id, os_schedule_groups)
      `)
      .eq(filterCol, projectId)
      .not("payment_schedule_id", "is", null)
      .order("date", { ascending: true });

    if (error) {
      logError("fetchPaymentSchedules", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      is_na: row.is_na,
      schedule_type: row.schedule_type,
      project_id: row.project_id,
      bwf_project_id: row.bwf_project_id,
      main_pm_id: row.main_pm_id,
      payment_schedule_id: row.payment_schedule_id,
      working_schedule_id: row.working_schedule_id,
      created_date: row.created_date,
      modified_date: row.modified_date,
      pm_name: row.pm?.name || null,
      payment_task_display: row.payment_task?.display || null,
      payment_task_sort: row.payment_task?.sort || null,
      payment_task_stage: row.payment_task?.stage || null,
      payment_task_is_custom: row.payment_task?.is_custom || null,
      payment_task_os_schedule_groups_id: row.payment_task?.os_schedule_groups_id || null,
      payment_task_os_schedule_groups: row.payment_task?.os_schedule_groups || null,
    }));
  }, [], "fetchPaymentSchedules");
}

// ─── DEFAULT SCHEDULE TASK LIST ──────────────────────────
// Fetches all default (non-custom) task definitions from project_schedule_tasks
// for a given os_schedule_groups_id, then cross-references with project_schedules
// to determine which tasks have been set/completed for the current project.

export interface DefaultScheduleTaskRow {
  task_id: string;
  display: string | null;
  sort: number | null;
  stage: string | null;
  is_start_date: boolean | null;
  is_handover_date: boolean | null;
  is_fast_build: boolean | null;
  // From project_schedules (if exists for this project)
  schedule_id: string | null;       // project_schedules.id
  date: string | null;              // project_schedules.date
  is_na: boolean;                   // project_schedules.is_na
  has_record: boolean;              // whether a project_schedules record exists
  schedule_type: string | null;     // "working" or "payment"
}

/**
 * Fetch the distinct list of os schedule group names (時間表類型) available for selection.
 * Parses the comma-separated `os_schedule_groups` column on `project_schedule_tasks`
 * into individual group display names so the list stays in sync with the templates.
 */
export async function fetchOsScheduleGroupOptions(): Promise<string[]> {
  const { data, error } = await supabase
    .from("project_schedule_tasks")
    .select("os_schedule_groups")
    .not("os_schedule_groups", "is", null);
  if (error || !data) return [];
  const set = new Set<string>();
  for (const row of data) {
    const raw = (row as { os_schedule_groups: string | null }).os_schedule_groups;
    if (!raw) continue;
    raw
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean)
      .forEach((g) => set.add(g));
  }
  return Array.from(set).sort();
}

/**
 * Fetch the default schedule task list for a project.
 * This gets all non-custom tasks from project_schedule_tasks where os_schedule_groups matches,
 * then cross-references with project_schedules to get per-project status.
 *
 * NOTE: os_schedule_groups in project_schedule_tasks is a COMMA-SEPARATED list of display names
 * (e.g. "Design & Build,Build Only,Small Build (<$40-150K)").
 * bwa_projects.os_schedule_group stores a single display name (e.g. "Design & Build").
 * is_custom is typically null (not false) for standard tasks.
 *
 * @param projectOsScheduleGroupId - The os_schedule_group value from bwa_projects (display name or UUID)
 * @param projectId - The current project's UUID
 * @param mode - "working" or "payment" to filter which schedule type
 * @param entityType - "bwa_project" or "bwf_project"
 */
export async function fetchDefaultScheduleTasks(
  projectOsScheduleGroupId: string,
  projectId: string,
  mode: "working" | "payment",
  entityType: "bwa_project" | "bwf_project" = "bwa_project"
): Promise<DefaultScheduleTaskRow[]> {
  return safeQuery(async () => {
    // Step 1: Fetch all non-custom task definitions matching the schedule group
    // os_schedule_groups stores COMMA-SEPARATED display names (e.g. "Design & Build,Build Only,Small Build (<$40-150K)")
    // bwa_projects.os_schedule_group stores a single display name (e.g. "Design & Build")
    // is_custom is typically null (not false) for standard tasks, so we must handle null explicitly
    let taskQuery = supabase
      .from("project_schedule_tasks")
      .select("id, display, sort, stage, is_bwa, is_bwf_ob, is_custom, is_start_date, is_handover_date, is_fast_build, os_schedule_groups_id, os_schedule_groups")
      .or("is_custom.is.null,is_custom.eq.false")
      .order("sort", { ascending: true });

    // Try UUID match on os_schedule_groups_id first, otherwise use ILIKE on comma-separated os_schedule_groups
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectOsScheduleGroupId);
    if (isUuid) {
      taskQuery = taskQuery.eq("os_schedule_groups_id", projectOsScheduleGroupId);
    } else {
      // os_schedule_groups is a comma-separated list of group names — use ILIKE for substring match
      taskQuery = taskQuery.ilike("os_schedule_groups", `%${projectOsScheduleGroupId}%`);
    }

    const { data: tasks, error: taskError } = await taskQuery;
    if (taskError) {
      logError("fetchDefaultScheduleTasks.tasks", taskError);
      return [];
    }
    if (!tasks || tasks.length === 0) return [];

    // Step 2: Fetch project_schedules for this project to cross-reference
    const filterCol = entityType === "bwf_project" ? "bwf_project_id" : "project_id";
    const scheduleTaskIdCol = mode === "working" ? "working_schedule_id" : "payment_schedule_id";

    const { data: schedules, error: schedError } = await supabase
      .from("project_schedules")
      .select("id, date, is_na, schedule_type, working_schedule_id, payment_schedule_id")
      .eq(filterCol, projectId)
      .not(scheduleTaskIdCol, "is", null);

    if (schedError) {
      logError("fetchDefaultScheduleTasks.schedules", schedError);
    }

    // Build a map: task_id -> schedule record
    const scheduleMap = new Map<string, any>();
    if (schedules) {
      for (const s of schedules) {
        const taskId = mode === "working" ? s.working_schedule_id : s.payment_schedule_id;
        if (taskId) {
          scheduleMap.set(taskId, s);
        }
      }
    }

    // Step 3: Merge task definitions with project schedule records
    return tasks.map((task: any) => {
      const sched = scheduleMap.get(task.id);
      return {
        task_id: task.id,
        display: task.display,
        sort: task.sort,
        stage: task.stage,
        is_start_date: task.is_start_date,
        is_handover_date: task.is_handover_date,
        is_fast_build: task.is_fast_build,
        schedule_id: sched?.id || null,
        date: sched?.date || null,
        is_na: sched?.is_na || false,
        has_record: !!sched,
        schedule_type: mode,
      };
    });
  }, [], "fetchDefaultScheduleTasks");
}

// ─── PROJECT ↔ SCHEDULE DATE SYNC ─────────────────────────

type ProjectEntityType = "bwa_project" | "bwf_project";

let startHandoverTaskIdsCache: { startId: string | null; handoverId: string | null } | null = null;

async function getStartHandoverTaskIds(): Promise<{ startId: string | null; handoverId: string | null }> {
  if (startHandoverTaskIdsCache) return startHandoverTaskIdsCache;

  const [{ data: startTask }, { data: handoverTask }] = await Promise.all([
    supabase.from("project_schedule_tasks").select("id").eq("is_start_date", true).limit(1).maybeSingle(),
    supabase.from("project_schedule_tasks").select("id").eq("is_handover_date", true).limit(1).maybeSingle(),
  ]);

  startHandoverTaskIdsCache = {
    startId: startTask?.id ?? null,
    handoverId: handoverTask?.id ?? null,
  };
  return startHandoverTaskIdsCache;
}

function normalizeScheduleDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

/** Keep project_schedules in sync when start_date / handover_date change on a project. */
export async function syncProjectDatesToSchedules(params: {
  projectId: string;
  entityType: ProjectEntityType;
  start_date?: string | null;
  handover_date?: string | null;
  mainPmId?: string | null;
}): Promise<void> {
  try {
    const { startId, handoverId } = await getStartHandoverTaskIds();
    const projectCol = params.entityType === "bwf_project" ? "bwf_project_id" : "project_id";

    const syncOne = async (taskId: string | null, date: string | null | undefined) => {
      if (!taskId || date === undefined) return;

      const normalizedDate = normalizeScheduleDate(date);
      const { data: existing } = await supabase
        .from("project_schedules")
        .select("id")
        .eq(projectCol, params.projectId)
        .eq("working_schedule_id", taskId)
        .maybeSingle();

      const now = new Date().toISOString();

      if (!normalizedDate) {
        if (existing?.id) {
          await supabase
            .from("project_schedules")
            .update({ date: null, is_na: false, modified_date: now })
            .eq("id", existing.id);
        }
        return;
      }

      if (existing?.id) {
        await supabase
          .from("project_schedules")
          .update({ date: normalizedDate, is_na: false, modified_date: now })
          .eq("id", existing.id);
        return;
      }

      await supabase.from("project_schedules").insert({
        [projectCol]: params.projectId,
        date: normalizedDate,
        working_schedule_id: taskId,
        schedule_type: "working",
        is_na: false,
        main_pm_id: params.mainPmId ?? null,
        created_date: now,
        modified_date: now,
      });
    };

    await syncOne(startId, params.start_date);
    await syncOne(handoverId, params.handover_date);
  } catch (err) {
    logError("syncProjectDatesToSchedules", err);
  }
}

/** Keep project start_date / handover_date in sync when schedule milestone dates change. */
async function syncScheduleDateToProject(params: {
  taskId: string;
  projectId: string;
  entityType: ProjectEntityType;
  date: string | null;
}): Promise<void> {
  try {
    const { startId, handoverId } = await getStartHandoverTaskIds();
    const updates: { start_date?: string | null; handover_date?: string | null } = {};
    const normalizedDate = normalizeScheduleDate(params.date);

    if (params.taskId === startId) updates.start_date = normalizedDate;
    else if (params.taskId === handoverId) updates.handover_date = normalizedDate;
    else return;

    if (params.entityType === "bwf_project") {
      await adminFetch({
        action: "update",
        table: "bwf_projects",
        id: params.projectId,
        updates,
      });
      return;
    }

    await supabase.from("bwa_projects").update(updates).eq("id", params.projectId);
  } catch (err) {
    logError("syncScheduleDateToProject", err);
  }
}

// ─── SCHEDULE EDIT FUNCTIONS ──────────────────────────────

/**
 * Upsert a schedule date for a task.
 * If schedule_id is provided, updates the existing record.
 * If not, creates a new project_schedules record linked to the task.
 */
export async function upsertScheduleDate(params: {
  scheduleId: string | null;
  taskId: string;
  projectId: string;
  entityType: "bwa_project" | "bwf_project";
  mode: "working" | "payment";
  date: string; // ISO date string (YYYY-MM-DD)
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (params.scheduleId) {
      // Update existing record
      const { data, error } = await supabase
        .from("project_schedules")
        .update({
          date: params.date,
          is_na: false,
          modified_date: new Date().toISOString(),
        })
        .eq("id", params.scheduleId)
        .select("id")
        .single();

      if (error) {
        logError("upsertScheduleDate.update", error);
        return { success: false, error: error.message };
      }
      if (params.mode === "working") {
        await syncScheduleDateToProject({
          taskId: params.taskId,
          projectId: params.projectId,
          entityType: params.entityType,
          date: params.date,
        });
      }
      return { success: true, id: data?.id };
    } else {
      // Create new record
      const insertData: Record<string, any> = {
        date: params.date,
        is_na: false,
        schedule_type: params.mode,
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      };
      if (params.entityType === "bwf_project") {
        insertData.bwf_project_id = params.projectId;
      } else {
        insertData.project_id = params.projectId;
      }
      if (params.mode === "working") {
        insertData.working_schedule_id = params.taskId;
      } else {
        insertData.payment_schedule_id = params.taskId;
      }

      const { data, error } = await supabase
        .from("project_schedules")
        .insert(insertData)
        .select("id")
        .single();

      if (error) {
        logError("upsertScheduleDate.insert", error);
        return { success: false, error: error.message };
      }
      if (params.mode === "working") {
        await syncScheduleDateToProject({
          taskId: params.taskId,
          projectId: params.projectId,
          entityType: params.entityType,
          date: params.date,
        });
      }
      return { success: true, id: data?.id };
    }
  } catch (err: any) {
    logError("upsertScheduleDate", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/**
 * Set a schedule task as N/A.
 * If schedule_id exists, update it. Otherwise, create a new record with is_na = true.
 */
export async function setScheduleNA(params: {
  scheduleId: string | null;
  taskId: string;
  projectId: string;
  entityType: "bwa_project" | "bwf_project";
  mode: "working" | "payment";
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (params.scheduleId) {
      const { data, error } = await supabase
        .from("project_schedules")
        .update({
          date: null,
          is_na: true,
          modified_date: new Date().toISOString(),
        })
        .eq("id", params.scheduleId)
        .select("id")
        .single();

      if (error) {
        logError("setScheduleNA.update", error);
        return { success: false, error: error.message };
      }
      return { success: true, id: data?.id };
    } else {
      const insertData: Record<string, any> = {
        date: null,
        is_na: true,
        schedule_type: params.mode,
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      };
      if (params.entityType === "bwf_project") {
        insertData.bwf_project_id = params.projectId;
      } else {
        insertData.project_id = params.projectId;
      }
      if (params.mode === "working") {
        insertData.working_schedule_id = params.taskId;
      } else {
        insertData.payment_schedule_id = params.taskId;
      }

      const { data, error } = await supabase
        .from("project_schedules")
        .insert(insertData)
        .select("id")
        .single();

      if (error) {
        logError("setScheduleNA.insert", error);
        return { success: false, error: error.message };
      }
      return { success: true, id: data?.id };
    }
  } catch (err: any) {
    logError("setScheduleNA", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/**
 * Remove a schedule date (set date to null and is_na to false).
 * Only works on existing records (scheduleId required).
 */
export async function removeScheduleDate(
  scheduleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sched, error: fetchErr } = await supabase
      .from("project_schedules")
      .select("working_schedule_id, project_id, bwf_project_id")
      .eq("id", scheduleId)
      .maybeSingle();

    if (fetchErr) {
      logError("removeScheduleDate.fetch", fetchErr);
      return { success: false, error: fetchErr.message };
    }

    const { error } = await supabase
      .from("project_schedules")
      .update({
        date: null,
        is_na: false,
        modified_date: new Date().toISOString(),
      })
      .eq("id", scheduleId);

    if (error) {
      logError("removeScheduleDate", error);
      return { success: false, error: error.message };
    }

    if (sched?.working_schedule_id) {
      const entityType: ProjectEntityType = sched.bwf_project_id ? "bwf_project" : "bwa_project";
      const projectId = sched.bwf_project_id || sched.project_id;
      if (projectId) {
        await syncScheduleDateToProject({
          taskId: sched.working_schedule_id,
          projectId,
          entityType,
          date: null,
        });
      }
    }

    return { success: true };
  } catch (err: any) {
    logError("removeScheduleDate", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/**
 * Bulk set N/A for all incomplete (no date and not yet N/A) default schedule tasks.
 * Returns the count of records affected.
 */
export async function bulkSetScheduleNA(params: {
  tasks: DefaultScheduleTaskRow[];
  projectId: string;
  entityType: "bwa_project" | "bwf_project";
  mode: "working" | "payment";
}): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const incompleteTasks = params.tasks.filter(
      (t) => !t.is_na && !t.date
    );
    if (incompleteTasks.length === 0) {
      return { success: true, count: 0 };
    }

    let successCount = 0;
    let firstError: string | undefined;
    for (const task of incompleteTasks) {
      const result = await setScheduleNA({
        scheduleId: task.schedule_id,
        taskId: task.task_id,
        projectId: params.projectId,
        entityType: params.entityType,
        mode: params.mode,
      });
      if (result.success) {
        successCount++;
      } else if (!firstError) {
        firstError = result.error;
      }
    }

    // If any task failed, report failure (with the count that DID succeed) so the
    // UI doesn't claim success while leaving tasks un-set — which previously made
    // the progress bar unable to reach 100%.
    if (successCount < incompleteTasks.length) {
      return {
        success: false,
        count: successCount,
        error: `僅成功設定 ${successCount}/${incompleteTasks.length} 項${firstError ? `：${firstError}` : ""}`,
      };
    }

    return { success: true, count: successCount };
  } catch (err: any) {
    logError("bulkSetScheduleNA", err);
    return { success: false, count: 0, error: err?.message || "Unknown error" };
  }
}

/**
 * Bulk reset N/A to empty for all N/A schedule tasks.
 * Returns the count of records affected.
 */
export async function bulkResetScheduleNA(params: {
  tasks: DefaultScheduleTaskRow[];
}): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const naTasks = params.tasks.filter((t) => t.is_na && t.schedule_id);
    if (naTasks.length === 0) {
      return { success: true, count: 0 };
    }

    let successCount = 0;
    let firstError: string | undefined;
    for (const task of naTasks) {
      if (task.schedule_id) {
        const result = await removeScheduleDate(task.schedule_id);
        if (result.success) {
          successCount++;
        } else if (!firstError) {
          firstError = result.error;
        }
      }
    }

    if (successCount < naTasks.length) {
      return {
        success: false,
        count: successCount,
        error: `僅成功重置 ${successCount}/${naTasks.length} 項${firstError ? `：${firstError}` : ""}`,
      };
    }

    return { success: true, count: successCount };
  } catch (err: any) {
    logError("bulkResetScheduleNA", err);
    return { success: false, count: 0, error: err?.message || "Unknown error" };
  }
}

// ─── CUSTOM SCHEDULE FUNCTIONS ──────────────────────────────

/**
 * Fetch custom schedule tasks for a project.
 * These are project_schedules records linked to project_schedule_tasks where is_custom = true.
 * Custom tasks are user-created (not part of the default template).
 */
export async function fetchCustomScheduleTasks(
  projectId: string,
  mode: "working" | "payment",
  entityType: "bwa_project" | "bwf_project" = "bwa_project"
): Promise<DefaultScheduleTaskRow[]> {
  return safeQuery(async () => {
    const filterCol = entityType === "bwf_project" ? "bwf_project_id" : "project_id";
    const scheduleTaskIdCol = mode === "working" ? "working_schedule_id" : "payment_schedule_id";

    const { data: schedules, error } = await supabase
      .from("project_schedules")
      .select(`
        id, date, is_na, schedule_type, working_schedule_id, payment_schedule_id,
        working_task:project_schedule_tasks!fk_project_schedules_working_schedule_id(id, display, sort, stage, is_custom),
        payment_task:project_schedule_tasks!fk_project_schedules_payment_schedule_id(id, display, sort, stage, is_custom)
      `)
      .eq(filterCol, projectId)
      .not(scheduleTaskIdCol, "is", null);

    if (error) {
      logError("fetchCustomScheduleTasks", error);
      return [];
    }
    if (!schedules) return [];

    // Filter to only custom tasks
    const customSchedules = schedules.filter((s: any) => {
      const task = mode === "working" ? s.working_task : s.payment_task;
      return task?.is_custom === true;
    });

    return customSchedules.map((s: any) => {
      const task = mode === "working" ? s.working_task : s.payment_task;
      return {
        task_id: task?.id || "",
        display: task?.display || "自定義任務",
        sort: task?.sort || 9999,
        stage: task?.stage || "自定義",
        is_start_date: null,
        is_handover_date: null,
        is_fast_build: null,
        schedule_id: s.id,
        date: s.date || null,
        is_na: s.is_na || false,
        has_record: true,
        schedule_type: mode,
      };
    });
  }, [], "fetchCustomScheduleTasks");
}

/**
 * Create a custom schedule task and link it to a project.
 * 1. Creates a new project_schedule_tasks record with is_custom = true
 * 2. Creates a new project_schedules record linking the task to the project
 */
export async function createCustomScheduleTask(params: {
  display: string;
  projectId: string;
  entityType: "bwa_project" | "bwf_project";
  mode: "working" | "payment";
  date?: string | null;
}): Promise<{ success: boolean; taskId?: string; scheduleId?: string; error?: string }> {
  try {
    // Step 1: Create a custom task definition in project_schedule_tasks
    const { data: taskData, error: taskError } = await supabase
      .from("project_schedule_tasks")
      .insert({
        display: params.display,
        is_custom: true,
        sort: 9999,
        stage: "自定義",
      })
      .select("id")
      .single();

    if (taskError) {
      logError("createCustomScheduleTask.task", taskError);
      return { success: false, error: taskError.message };
    }

    // Step 2: Create a project_schedules record linking to this task
    const insertData: Record<string, any> = {
      date: params.date || null,
      is_na: false,
      schedule_type: params.mode,
      created_date: new Date().toISOString(),
      modified_date: new Date().toISOString(),
    };
    if (params.entityType === "bwf_project") {
      insertData.bwf_project_id = params.projectId;
    } else {
      insertData.project_id = params.projectId;
    }
    if (params.mode === "working") {
      insertData.working_schedule_id = taskData.id;
    } else {
      insertData.payment_schedule_id = taskData.id;
    }

    const { data: schedData, error: schedError } = await supabase
      .from("project_schedules")
      .insert(insertData)
      .select("id")
      .single();

    if (schedError) {
      logError("createCustomScheduleTask.schedule", schedError);
      return { success: false, error: schedError.message };
    }

    return { success: true, taskId: taskData.id, scheduleId: schedData.id };
  } catch (err: any) {
    logError("createCustomScheduleTask", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/**
 * Delete a custom schedule task.
 * Removes the project_schedules record and the project_schedule_tasks record.
 */
export async function deleteCustomScheduleTask(params: {
  scheduleId: string;
  taskId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete project_schedules record first
    const { error: schedError } = await supabase
      .from("project_schedules")
      .delete()
      .eq("id", params.scheduleId);

    if (schedError) {
      logError("deleteCustomScheduleTask.schedule", schedError);
      return { success: false, error: schedError.message };
    }

    // Delete the task definition
    const { error: taskError } = await supabase
      .from("project_schedule_tasks")
      .delete()
      .eq("id", params.taskId);

    if (taskError) {
      logError("deleteCustomScheduleTask.task", taskError);
      // Schedule was already deleted, so partial success
      return { success: true };
    }

    return { success: true };
  } catch (err: any) {
    logError("deleteCustomScheduleTask", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

// ─── CALENDAR SCHEDULE ────────────────────────────────────────
// Fetches project_schedules for BWA (project_id) and BWF (bwf_project_id).
// Returns schedules with project info joined.

export interface CalendarScheduleItem {
  id: string;
  date: string;
  is_na: boolean | null;
  schedule_type: string | null;
  project_id: string | null;
  bwf_project_id: string | null;
  /** Related BWA/BWF project main_pm_id (falls back to schedule.main_pm_id). */
  pm_id: string | null;
  pm_name: string | null;
  project_name: string | null;
  project_code: string | null;
  asana_link: string | null;
  project_type: "BWA" | "BWF";
  task_display: string | null;
  task_stage: string | null;
  task_sort: number | null;
  task_is_custom: boolean | null;
}

export async function fetchCalendarSchedules(
  startDate: string,
  endDate: string
): Promise<CalendarScheduleItem[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("project_schedules")
      .select(`
        id, date, is_na, schedule_type, project_id, bwf_project_id,
        main_pm_id,
        working_schedule_id, payment_schedule_id,
        pm:staff!fk_project_schedules_main_pm_id(name),
        working_task:project_schedule_tasks!fk_project_schedules_working_schedule_id(display, sort, stage, is_custom),
        payment_task:project_schedule_tasks!fk_project_schedules_payment_schedule_id(display, sort, stage, is_custom),
        bwa_project:bwa_projects!fk_project_schedules_project_id(project_name, project_code, asana_link, main_pm_id),
        bwf_project:bwf_projects!fk_project_schedules_bwf_project_id(project_name, project_code, asana_link, main_pm_id)
      `)
      .not("date", "is", null)
      .or("project_id.not.is.null,bwf_project_id.not.is.null")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (error) {
      logError("fetchCalendarSchedules", error);
      return [];
    }

    return (data || []).map((row: any) => {
      const task = row.working_task || row.payment_task;
      const isBwf = !!row.bwf_project_id && !row.project_id;
      const project = isBwf ? row.bwf_project : row.bwa_project;
      return {
        id: row.id,
        date: row.date,
        is_na: row.is_na,
        schedule_type: row.schedule_type,
        project_id: row.project_id,
        bwf_project_id: row.bwf_project_id || null,
        pm_id: project?.main_pm_id || row.main_pm_id || null,
        pm_name: row.pm?.name || null,
        project_name: project?.project_name || null,
        project_code: project?.project_code || null,
        asana_link: project?.asana_link || null,
        project_type: isBwf ? "BWF" as const : "BWA" as const,
        task_display: task?.display || null,
        task_stage: task?.stage || null,
        task_sort: task?.sort || null,
        task_is_custom: task?.is_custom || null,
      };
    });
  }, [], "fetchCalendarSchedules");
}
