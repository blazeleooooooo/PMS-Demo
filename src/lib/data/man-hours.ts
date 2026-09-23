import { supabase, safeQuery, logError } from "@/lib/data/_core";

// Legacy Base44 man-hour task API (edge-function proxy). Not re-exported from
// `@/lib/man-hour-service` — that module uses direct Supabase CRUD with different types.

// ============================================================
// ─── MAN HOUR TASKS (Base44 API via Edge Function proxy) ────
// ============================================================

export interface ManHourTask {
  id: string;
  bubble_id?: string;
  asana_link?: string;
  work_hour?: number;
  images?: string[];
  keywords?: string;
  meeting_topic?: string;
  output_count?: number;
  task_description?: string;
  task_id?: string;
  task_name?: string;
  project_id?: string;
  project_name?: string;
  brand_id?: string;
  brand_name?: string;
  meeting_invite_sent?: boolean;
  projects?: string[];
  task_type_id?: string;
  task_type_name?: string;
  man_hour_date_id: string;
  meeting_participants?: string[];
  meeting_method?: string;
  output_unit?: string;
  work_location?: string;
  meeting_duration?: string;
  meeting_request_date?: string;
  created_date?: string;
  updated_date?: string;
  created_by?: string;
}

export interface ManHourListParams {
  query?: Record<string, unknown>;
  limit?: number;
  skip?: number;
  sort_by?: string;
}

async function invokeBase44ManHours(
  body: Record<string, unknown>,
): Promise<{ data: any; success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "supabase-functions-base44-man-hours",
      { body },
    );
    if (error) throw error;
    // supabase.functions.invoke may return data as string if content-type is missing
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return parsed;
  } catch (err: any) {
    logError("invokeBase44ManHours", err);
    return { data: null, success: false, error: err?.message || "Unknown error" };
  }
}

export async function fetchManHourTasks(
  params: ManHourListParams = {},
): Promise<ManHourTask[]> {
  return safeQuery(async () => {
    const result = await invokeBase44ManHours({
      action: "list",
      ...params,
    });
    if (!result.success || !result.data) return [];
    return Array.isArray(result.data) ? result.data : [];
  }, [], "fetchManHourTasks");
}

export async function fetchManHourTasksByProject(
  projectId: string,
  params: ManHourListParams = {},
): Promise<ManHourTask[]> {
  return safeQuery(async () => {
    const result = await invokeBase44ManHours({
      action: "list",
      query: { ...params.query, project_id: projectId },
      limit: params.limit,
      skip: params.skip,
      sort_by: params.sort_by || "-created_date",
    });
    if (!result.success || !result.data) return [];
    return Array.isArray(result.data) ? result.data : [];
  }, [], "fetchManHourTasksByProject");
}

// ─── PROJECT MAN-HOUR RESULT ATTACHMENTS (工作匯報成果) ─────
// Flatten every attachment on this project's man-hour tasks into a single
// gallery list, for the "工作匯報成果" section on the project Docs tab.
export interface ManHourImage {
  url: string;
  task_id: string;
  task_name: string | null;
  created_at: string | null;
}

export async function fetchProjectManHourImages(projectId: string): Promise<ManHourImage[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("man_hour_tasks")
      .select("id, task_name, images, created_at")
      .eq("project_id", projectId)
      .not("images", "is", null)
      .order("created_at", { ascending: false, nullsFirst: false });
    if (error) {
      logError("fetchProjectManHourImages", error);
      return [];
    }
    const out: ManHourImage[] = [];
    for (const t of data ?? []) {
      const imgs: string[] = Array.isArray(t.images) ? t.images : [];
      for (const url of imgs) {
        if (url) out.push({ url, task_id: t.id, task_name: t.task_name ?? null, created_at: t.created_at ?? null });
      }
    }
    return out;
  }, [], "fetchProjectManHourImages");
}

export async function fetchManHourTasksByDateId(
  manHourDateId: string,
  params: ManHourListParams = {},
): Promise<ManHourTask[]> {
  return safeQuery(async () => {
    const result = await invokeBase44ManHours({
      action: "list",
      query: { ...params.query, man_hour_date_id: manHourDateId },
      limit: params.limit,
      skip: params.skip,
      sort_by: params.sort_by || "-created_date",
    });
    if (!result.success || !result.data) return [];
    return Array.isArray(result.data) ? result.data : [];
  }, [], "fetchManHourTasksByDateId");
}

export async function fetchSingleManHourTask(
  id: string,
): Promise<ManHourTask | null> {
  return safeQuery(async () => {
    const result = await invokeBase44ManHours({
      action: "get",
      id,
    });
    if (!result.success || !result.data) return null;
    return result.data as ManHourTask;
  }, null, "fetchSingleManHourTask");
}

export async function createManHourTask(
  data: Partial<ManHourTask>,
): Promise<{ success: boolean; data?: ManHourTask; error?: string }> {
  try {
    const result = await invokeBase44ManHours({
      action: "create",
      data,
    });
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (err: any) {
    logError("createManHourTask", err);
    return { success: false, error: err?.message };
  }
}

export async function updateManHourTask(
  id: string,
  data: Partial<ManHourTask>,
): Promise<{ success: boolean; data?: ManHourTask; error?: string }> {
  try {
    const result = await invokeBase44ManHours({
      action: "update",
      id,
      data,
    });
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (err: any) {
    logError("updateManHourTask", err);
    return { success: false, error: err?.message };
  }
}

export async function deleteManHourTask(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await invokeBase44ManHours({
      action: "delete",
      id,
    });
    if (!result.success) return { success: false, error: result.error };
    return { success: true };
  } catch (err: any) {
    logError("deleteManHourTask", err);
    return { success: false, error: err?.message };
  }
}

export async function bulkCreateManHourTasks(
  tasks: Partial<ManHourTask>[],
): Promise<{ success: boolean; data?: ManHourTask[]; error?: string }> {
  try {
    const result = await invokeBase44ManHours({
      action: "bulk_create",
      bulk_data: tasks,
    });
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (err: any) {
    logError("bulkCreateManHourTasks", err);
    return { success: false, error: err?.message };
  }
}

/**
 * Fetch man hour tasks related to a BWA project via the BubbleProject junction:
 *
 *   bwa_projects.bubble_id
 *     → BubbleProject.bubble_api_id  (Step 1: find the BubbleProject record)
 *     → BubbleProject.bubble_id      (Step 2: get the Bubble-native ID — NOT the Base44 `id`!)
 *     → ManHourTask.projects[]       (Step 3: array of BubbleProject.bubble_id values)
 *
 * IMPORTANT: ManHourTask.projects[] stores BubbleProject.bubble_id values,
 * NOT BubbleProject.id (Base44 record IDs). Verified via test on 2025-07-22.
 *
 * We paginate through ALL ManHourTasks (in batches of 500) to ensure none are missed.
 */
export async function fetchManHourTasksByBubbleId(
  projectBubbleId: string,
  params: ManHourListParams = {},
): Promise<ManHourTask[]> {
  return safeQuery(async () => {
    console.log("[fetchManHourTasksByBubbleId] START — projectBubbleId:", projectBubbleId);

    // Step 1: Find BubbleProject records whose bubble_api_id matches the BWA project's bubble_id
    const bpResult = await invokeBase44ManHours({
      action: "list",
      entity: "BubbleProject",
      query: { bubble_api_id: projectBubbleId },
      limit: 50,
    });

    console.log("[fetchManHourTasksByBubbleId] Step 1 result — success:", bpResult.success, "data type:", typeof bpResult.data, "is array:", Array.isArray(bpResult.data));

    if (!bpResult.success || !bpResult.data) {
      console.warn("[fetchManHourTasksByBubbleId] No BubbleProject found for bubble_api_id:", projectBubbleId, "result:", JSON.stringify(bpResult).slice(0, 200));
      return [];
    }

    const bubbleProjects = Array.isArray(bpResult.data) ? bpResult.data : [];
    if (bubbleProjects.length === 0) {
      console.warn("[fetchManHourTasksByBubbleId] Empty BubbleProject result for:", projectBubbleId);
      return [];
    }

    // Step 2: Collect BubbleProject.bubble_id values (NOT .id which is the Base44 record ID)
    // ManHourTask.projects[] stores bubble_id, not the Base44 id
    const bubbleProjectBubbleIds = new Set<string>(
      bubbleProjects.map((bp: any) => bp.bubble_id).filter(Boolean),
    );

    console.log(
      `[fetchManHourTasksByBubbleId] Step 2 — Found ${bubbleProjectBubbleIds.size} BubbleProject(s) for bubble_api_id="${projectBubbleId}". ` +
      `bubble_id(s): [${[...bubbleProjectBubbleIds].join(", ")}]`,
    );

    if (bubbleProjectBubbleIds.size === 0) {
      console.warn("[fetchManHourTasksByBubbleId] All BubbleProject records have null/empty bubble_id. First record keys:", Object.keys(bubbleProjects[0] || {}));
      return [];
    }

    // Step 3: Fetch ALL ManHourTasks via pagination and filter by projects array
    const PAGE_SIZE = 500;
    const matchedTasks: ManHourTask[] = [];
    let skip = params.skip || 0;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore) {
      pageCount++;
      const result = await invokeBase44ManHours({
        action: "list",
        query: params.query,
        limit: PAGE_SIZE,
        skip,
        sort_by: params.sort_by || "-created_date",
      });

      if (!result.success || !result.data) {
        console.warn(`[fetchManHourTasksByBubbleId] Step 3 page ${pageCount} failed — success:`, result.success, "error:", result.error);
        break;
      }

      const pageTasks = Array.isArray(result.data) ? result.data : [];
      console.log(`[fetchManHourTasksByBubbleId] Step 3 page ${pageCount} — fetched ${pageTasks.length} tasks (skip=${skip})`);

      // Filter: keep tasks whose `projects` array contains any of the BubbleProject.bubble_id values
      for (const t of pageTasks) {
        if (
          Array.isArray(t.projects) &&
          t.projects.some((pid: string) => bubbleProjectBubbleIds.has(pid))
        ) {
          matchedTasks.push(t);
        }
      }

      // If we got fewer than PAGE_SIZE, there are no more pages
      if (pageTasks.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        skip += PAGE_SIZE;
      }

      // Safety: max 20 pages (10,000 records)
      if (pageCount >= 20) {
        console.warn("[fetchManHourTasksByBubbleId] Reached max page limit (20). Stopping pagination.");
        hasMore = false;
      }
    }

    console.log(`[fetchManHourTasksByBubbleId] DONE — matched ${matchedTasks.length} tasks across ${pageCount} page(s)`);
    return matchedTasks;
  }, [], "fetchManHourTasksByBubbleId");
}
