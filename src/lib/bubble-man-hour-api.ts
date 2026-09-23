"use client";

// ============================================================
// Bubble Man Hour API Service (Client)
// Uses /api/bubble-man-hour proxy to avoid CORS and token exposure
// ============================================================

// ─── Data API Types ─────────────────────────────────────────

export interface BubbleManHourTask {
  _id: string;
  "Created By"?: string;
  "Created Date"?: string;
  "Modified Date"?: string;
  "Asana Link"?: string;
  images?: string[];
  "Keywords"?: string;
  "Man Hour Date"?: string;
  "Meeting Invite sent"?: boolean;
  "Meeting Participant"?: string[];
  "Meeting Topic"?: string;
  "N_Brand"?: string;
  "N_Output & Unit"?: string;
  "N_Task"?: string;
  "N_Task Type"?: string;
  "N_Work Location"?: string;
  "O_Meeting Duration"?: string;
  "O_Meeting Method"?: string;
  "O_Meeting Request Dat"?: string;
  "Output Count"?: number;
  "Project"?: string;
  "Projects"?: string[];
  "Task Description"?: string;
  "Work Hour"?: number;
  // Legacy aliases for backward-compat in UI code
  task_name?: string;
  task_type?: string;
  task_type_name?: string;
  task_description?: string;
  work_hour?: number;
  work_location?: string;
  output_count?: number;
  output_unit?: string;
  project_id?: string;
  project_name?: string;
  brand_id?: string;
  brand_name?: string;
  meeting_topic?: string;
  meeting_participants?: string[];
  meeting_method?: string;
  meeting_duration?: string;
  meeting_request_date?: string;
  meeting_invite_sent?: boolean;
  asana_link?: string;
  keywords?: string;
  man_hour_date_id?: string;
  projects?: string[];
}

export interface BubbleManHourDate {
  _id: string;
  "Created By"?: string;
  "Created Date"?: string;
  "Modified Date"?: string;
  "Report Date"?: string;
  "Staff"?: string;
  "Total Work Hour"?: number;
  // Legacy aliases for backward-compat
  report_date?: string;
  date?: string;
  staff_id?: string;
  staff_name?: string;
  total_hours?: number;
  status?: string;
  man_hour_tasks?: string[];
}

export interface BubbleNOSTask {
  _id: string;
  Display?: string;
  "Eng Display"?: string;
  "Is Active"?: boolean;
  "N_Task Types"?: string[];
  Sorting?: number;
  // Legacy aliases
  task_name?: string;
  task_type?: string;
}

export interface BubbleNOSTaskType {
  _id: string;
  Display?: string;
  "Eng Display"?: string;
  "Is Active"?: boolean;
  "N_Brands"?: string[];
  "N_Teams"?: string[];
  // Legacy alias
  type_name?: string;
}

export interface BubbleNOSTeam {
  _id: string;
  team_name?: string;
  is_active?: boolean;
}

export interface BubbleNOSBU {
  _id: string;
  bu_name?: string;
  is_active?: boolean;
}

export interface BubbleNOSBrand {
  _id: string;
  Display?: string;
  brand_name?: string;
  is_active?: boolean;
}

export interface BubbleNOSWorkLocation {
  _id: string;
  Display?: string;
  "Is Active"?: boolean;
  "Is China"?: boolean;
  "Is GPS"?: boolean;
  "Is HK"?: boolean;
}

export interface BubbleProject {
  _id: string;
  "Display Name"?: string;
  project_name?: string;
  project_name_english?: string;
  project_name_chinese?: string;
  status?: string;
}

export interface BubblePitching {
  _id: string;
  "Pitching Code"?: string;
  "Real Customer Display Name"?: string;
  "Real Building Name"?: string;
  "Site Address"?: string;
  "Pitching Stages"?: string;
  // Computed display
  display_name?: string;
}

export interface BubbleBWFPitching {
  _id: string;
  "Pitching Code"?: string;
  "Pitching Name"?: string;
  "Real Customer Display Name"?: string;
  "Pitching Stages"?: string;
  display_name?: string;
}

export interface BubbleBWFProject {
  _id: string;
  "Project Code"?: string;
  "Project Name"?: string;
  "Real Customer Display Name"?: string;
  "Status"?: string;
  display_name?: string;
}

export interface BubbleManHourPinned {
  _id: string;
  "Staff"?: string;
  "Project"?: string;
  "Task"?: string;
  "Man Hour Task"?: string;
  "Sorting"?: number;
  // The Project field is a reference (Bubble _id of a Project)
  // The Task field is a reference (Bubble _id of a NOS Task)
}

export interface BubbleStaff {
  _id: string;
  "Display Name"?: string;
  "Created Date"?: string;
  "Modified Date"?: string;
}

// ─── Workflow Payloads ──────────────────────────────────────

export interface AddEditManHourDatePayload {
  date?: string;
  staff_id?: string;
  man_hour_date_id?: string;
}

export interface AddEditManHourTaskPayload {
  man_hour_date_id?: string;
  task_name?: string;
  task_type?: string;
  task_description?: string;
  work_hour?: number;
  work_location?: string;
  output_count?: number;
  output_unit?: string;
  project_id?: string;
  brand_id?: string;
  meeting_topic?: string;
  meeting_participants?: string;
  meeting_method?: string;
  meeting_duration?: string;
  meeting_request_date?: string;
  meeting_invite_sent?: boolean;
  asana_link?: string;
  man_hour_task_id?: string;
}

export interface DeleteManHourDateAndTaskPayload {
  man_hour_date_id: string;
}

export interface DeleteManHourTaskPayload {
  man_hour_task_id: string;
}

export interface GetOSStatusPayload {
  project_id?: string;
}

// ─── Internal API Call (via /api/bubble-man-hour proxy) ─────

async function apiCall(body: Record<string, any>): Promise<any> {
  const res = await fetch("/api/bubble-man-hour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || `API error (${res.status})`);
  }
  return data;
}

// ─── PUBLIC DATA API FUNCTIONS ──────────────────────────────

export async function fetchManHourTasks(params?: {
  cursor?: number;
  limit?: number;
  constraints?: any[];
}): Promise<{ results: BubbleManHourTask[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "Man Hour Task",
    sort_field: "Created Date",
    descending: true,
    ...params,
  });
  return res.data;
}

export async function fetchManHourTaskById(id: string): Promise<BubbleManHourTask> {
  const res = await apiCall({
    action: "data_get",
    objectName: "Man Hour Task",
    id,
  });
  return res.data;
}

export async function fetchManHourDates(params?: {
  cursor?: number;
  limit?: number;
  constraints?: any[];
}): Promise<{ results: BubbleManHourDate[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "Man Hour Date",
    sort_field: "Created Date",
    descending: true,
    ...params,
  });
  return res.data;
}

export async function fetchManHourDateById(id: string): Promise<BubbleManHourDate> {
  const res = await apiCall({
    action: "data_get",
    objectName: "Man Hour Date",
    id,
  });
  return res.data;
}

export async function fetchNOSTasks(params?: {
  cursor?: number;
  limit?: number;
  constraints?: any[];
}): Promise<{ results: BubbleNOSTask[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "NOS Task",
    ...params,
  });
  return res.data;
}

export async function fetchNOSTaskTypes(): Promise<{ results: BubbleNOSTaskType[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "NOS Task Type",
    limit: 200,
  });
  return res.data;
}

export async function fetchNOSTeams(): Promise<{ results: BubbleNOSTeam[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "NOS Team",
    limit: 200,
  });
  return res.data;
}

export async function fetchNOSBUs(): Promise<{ results: BubbleNOSBU[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "NOS BU",
    limit: 200,
  });
  return res.data;
}

export async function fetchNOSBrands(): Promise<{ results: BubbleNOSBrand[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "NOS Brand",
    limit: 200,
  });
  return res.data;
}

export async function fetchNOSWorkLocations(): Promise<{ results: BubbleNOSWorkLocation[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "NOS Work Location",
    limit: 200,
  });
  return res.data;
}

export async function fetchProjects(params?: {
  cursor?: number;
  limit?: number;
  constraints?: any[];
}): Promise<{ results: BubbleProject[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "Project",
    limit: params?.limit || 200,
    ...params,
  });
  return res.data;
}

export async function fetchProjectById(id: string): Promise<BubbleProject> {
  const res = await apiCall({
    action: "data_get",
    objectName: "Project",
    id,
  });
  return res.data;
}

export async function fetchPitchings(params?: {
  cursor?: number;
  limit?: number;
  constraints?: any[];
}): Promise<{ results: BubblePitching[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "Pitching",
    limit: params?.limit || 200,
    ...params,
  });
  return res.data;
}

export async function fetchBWFPitchings(params?: {
  cursor?: number;
  limit?: number;
  constraints?: any[];
}): Promise<{ results: BubbleBWFPitching[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "BWF Pitching",
    limit: params?.limit || 200,
    ...params,
  });
  return res.data;
}

export async function fetchBWFProjects(params?: {
  cursor?: number;
  limit?: number;
  constraints?: any[];
}): Promise<{ results: BubbleBWFProject[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "BWF Project",
    limit: params?.limit || 200,
    ...params,
  });
  return res.data;
}

export async function fetchManHourPinned(params?: {
  cursor?: number;
  limit?: number;
  constraints?: any[];
}): Promise<{ results: BubbleManHourPinned[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "Man Hour Pinned",
    limit: params?.limit || 200,
    ...params,
  });
  return res.data;
}

export async function fetchStaff(params?: {
  cursor?: number;
  limit?: number;
  constraints?: any[];
}): Promise<{ results: BubbleStaff[]; remaining: number; count: number }> {
  const res = await apiCall({
    action: "data_list",
    objectName: "Staff",
    limit: params?.limit || 200,
    ...params,
  });
  return res.data;
}

/**
 * Look up a Staff record by "Display Name" and return its Bubble _id.
 * Used for filtering Man Hour Date by the "Staff" relation field.
 */
export async function getStaffBubbleId(displayName: string): Promise<string | null> {
  const res = await fetchStaff({
    limit: 1,
    constraints: [
      {
        key: "Display Name",
        constraint_type: "equals",
        value: displayName,
      },
    ],
  });
  if (res.results.length > 0) {
    return res.results[0]._id;
  }
  return null;
}

// ─── PUBLIC WORKFLOW API FUNCTIONS ───────────────────────────

export async function addEditManHourDate(payload: AddEditManHourDatePayload): Promise<any> {
  return apiCall({
    action: "workflow",
    workflowName: "PMS Add+Edit Man Hour Date",
    payload,
  });
}

export async function addEditManHourTask(payload: AddEditManHourTaskPayload): Promise<any> {
  return apiCall({
    action: "workflow",
    workflowName: "PMS Add+Edit Man Hour Task",
    payload,
  });
}

export async function addEditProject(payload: Record<string, any>): Promise<any> {
  return apiCall({
    action: "workflow",
    workflowName: "PMS Add+Edit Project",
    payload,
  });
}

export async function deleteManHourDateAndTasks(payload: DeleteManHourDateAndTaskPayload): Promise<any> {
  return apiCall({
    action: "workflow",
    workflowName: "PMS delete MH date&task",
    payload,
  });
}

export async function deleteManHourTask(payload: DeleteManHourTaskPayload): Promise<any> {
  return apiCall({
    action: "workflow",
    workflowName: "PMS delete MH task",
    payload,
  });
}

export async function getOSStatus(payload: GetOSStatusPayload): Promise<any> {
  return apiCall({
    action: "workflow",
    workflowName: "PMS GET OS Status",
    payload,
  });
}
