import { supabase, logError, safeQuery } from "@/lib/data/_core";
import { buildStorageObjectKey } from "@/lib/storage-utils";

// ═══════════════════════════════════════════════════════════
// PROJECT WEEKLY REPORTS (項目每10天工地報告 — DB still uses week_number)
// ═══════════════════════════════════════════════════════════

/** Period 1 → "10 Days" / "10天"; DB `week_number` stays 1, 2, 3… */
export function tenDayPeriodLabel(periodNumber: number, lang: "en" | "zh" = "en"): string {
  const days = periodNumber * 10;
  return lang === "zh" ? `${days}天` : `${days} Days`;
}

export function tenDayReportName(periodNumber: number): string {
  return `${periodNumber * 10}天報告`;
}

/**
 * Clean project title for 10-day report display:
 * - drop standalone "design and build" lines
 * - strip trailing " Design and Build" on the same line
 */
export function normalizeReportProjectName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^design\s+and\s+build$/i.test(line))
    .map((line) => line.replace(/\s+design\s+and\s+build\s*$/i, "").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

// ─── 10-day period slots (shared by panel + expense control) ───

const TEN_DAY_PERIOD_DAYS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface TenDayPeriodSlot {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  hasReport: boolean;
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDaysLocal(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dayCountInclusive(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

/**
 * Build 10-day report periods from start→handover (last short period merges
 * into previous). `hasReport` is true when a row exists for that week_number.
 * Overdue in the UI = `isPast && !hasReport` (current period is never overdue).
 */
export function buildTenDayPeriodSlots(
  startDate: string | null | undefined,
  handoverDate: string | null | undefined,
  reportWeekNumbers: Iterable<number | null | undefined>,
  todayInput: Date = new Date()
): TenDayPeriodSlot[] {
  if (!startDate || !handoverDate) return [];

  const start = parseLocalDate(startDate);
  const end = parseLocalDate(handoverDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];

  const today = new Date(todayInput);
  today.setHours(0, 0, 0, 0);

  const totalDays = dayCountInclusive(start, end);
  const ranges: { start: Date; end: Date }[] = [];
  let offset = 0;

  while (offset < totalDays) {
    const rangeStart = addDaysLocal(start, offset);
    const remaining = totalDays - offset;
    const length = Math.min(TEN_DAY_PERIOD_DAYS, remaining);
    ranges.push({
      start: rangeStart,
      end: addDaysLocal(rangeStart, length - 1),
    });
    offset += length;
  }

  if (ranges.length >= 2) {
    const last = ranges[ranges.length - 1];
    if (dayCountInclusive(last.start, last.end) < TEN_DAY_PERIOD_DAYS) {
      ranges[ranges.length - 2].end = last.end;
      ranges.pop();
    }
  }

  const reportSet = new Set<number>();
  for (const n of reportWeekNumbers) {
    if (n != null) reportSet.add(n);
  }

  return ranges.map((range, index) => {
    const weekNumber = index + 1;
    return {
      weekNumber,
      weekStart: range.start,
      weekEnd: range.end,
      isPast: range.end < today,
      isCurrent: range.start <= today && today <= range.end,
      isFuture: range.start > today,
      hasReport: reportSet.has(weekNumber),
    };
  });
}

/** Count past periods with no report — same as 10 Day's Report tab「逾期」. */
export function countOverdueTenDayReports(
  startDate: string | null | undefined,
  handoverDate: string | null | undefined,
  reportWeekNumbers: Iterable<number | null | undefined>,
  today?: Date
): number {
  return buildTenDayPeriodSlots(startDate, handoverDate, reportWeekNumbers, today).filter(
    (s) => s.isPast && !s.hasReport
  ).length;
}

export interface WeeklyReportRow {
  id: string;
  bubble_id: string | null;
  project: string | null;
  project_id: string | null;
  report_name: string | null;
  /** Editable title for PDF header/footer — not synced to bwa_projects */
  display_project_name: string | null;
  week_number: number | null;
  meeting_date: string | null;
  file: string | null;
  created_by: string | null;
  created_by_id: string | null;
  created_date: string | null;
  modified_date: string | null;
  za_meeting_team: string | null;
  zb_key_focus: string | null;
  zc_completed_work: string | null;
  zd_next_week_work: string | null;
  ze_additional_items: string | null;
  zf_urgent_client_confirm: string | null;
  zg_site_changes: string | null;
  zh_factors_affecting_handover: string | null;
  zi_overall_site_schedule: string | null;
  zj_payment_schedule: string | null;
  zk_appendix: string | null;
}

const WEEKLY_REPORT_SELECT =
  "id, bubble_id, project, project_id, report_name, display_project_name, week_number, meeting_date, file, created_by, created_by_id, created_date, modified_date, za_meeting_team, zb_key_focus, zc_completed_work, zd_next_week_work, ze_additional_items, zf_urgent_client_confirm, zg_site_changes, zh_factors_affecting_handover, zi_overall_site_schedule, zj_payment_schedule, zk_appendix";

type WeeklyReportContentFields = Partial<
  Pick<
    WeeklyReportRow,
    | "za_meeting_team"
    | "zb_key_focus"
    | "zc_completed_work"
    | "zd_next_week_work"
    | "ze_additional_items"
    | "zf_urgent_client_confirm"
    | "zg_site_changes"
    | "zh_factors_affecting_handover"
    | "zi_overall_site_schedule"
    | "zj_payment_schedule"
    | "zk_appendix"
    | "meeting_date"
    | "file"
    | "report_name"
    | "display_project_name"
  >
>;

export async function fetchWeeklyReports(projectId: string): Promise<WeeklyReportRow[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("project_weekly_reports")
      .select(WEEKLY_REPORT_SELECT)
      .eq("project_id", projectId)
      .order("week_number", { ascending: true });
    if (error) {
      logError("fetchWeeklyReports", error);
      return [];
    }
    return data ?? [];
  }, [], "fetchWeeklyReports");
}

/**
 * Default display name for a new/empty report:
 * 1) latest non-empty display_project_name on the same project
 * 2) else normalize(projectNameFallback) from bwa_projects.project_name
 */
export async function resolveDefaultReportProjectName(
  projectId: string,
  projectNameFallback?: string | null
): Promise<string> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("project_weekly_reports")
      .select("display_project_name, modified_date, created_date, week_number")
      .eq("project_id", projectId)
      .not("display_project_name", "is", null)
      .neq("display_project_name", "")
      .order("modified_date", { ascending: false, nullsFirst: false })
      .order("created_date", { ascending: false, nullsFirst: false })
      .order("week_number", { ascending: false, nullsFirst: false })
      .limit(1);
    if (error) {
      logError("resolveDefaultReportProjectName", error);
    } else {
      const latest = data?.[0]?.display_project_name;
      if (latest?.trim()) return normalizeReportProjectName(latest);
    }
    return normalizeReportProjectName(projectNameFallback);
  }, normalizeReportProjectName(projectNameFallback), "resolveDefaultReportProjectName");
}

export async function uploadWeeklyReportFile(
  projectId: string,
  weekNumber: number,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  return safeQuery(async () => {
    const fileName = buildStorageObjectKey(`${projectId}/week_${weekNumber}`, file.name);
    const { error: uploadError } = await supabase.storage
      .from("weekly-reports")
      .upload(fileName, file, { upsert: true });
    if (uploadError) return { success: false, error: uploadError.message };
    const { data: urlData } = supabase.storage.from("weekly-reports").getPublicUrl(fileName);
    return { success: true, url: urlData.publicUrl };
  }, { success: false, error: "Network error" }, "uploadWeeklyReportFile");
}

export async function createWeeklyReport(
  projectId: string,
  weekNumber: number,
  meetingDate: string,
  fileUrl: string,
  reportName?: string,
  displayProjectName?: string | null,
  projectNameFallback?: string | null
): Promise<{ success: boolean; id?: string; error?: string }> {
  return safeQuery(async () => {
    const resolvedDisplayName =
      displayProjectName?.trim() ||
      (await resolveDefaultReportProjectName(projectId, projectNameFallback));
    const { data, error } = await supabase
      .from("project_weekly_reports")
      .insert({
        project_id: projectId,
        week_number: weekNumber,
        meeting_date: meetingDate,
        file: fileUrl,
        report_name: reportName || tenDayReportName(weekNumber),
        display_project_name: resolvedDisplayName || null,
        created_date: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  }, { success: false, error: "Network error" }, "createWeeklyReport");
}

export async function updateWeeklyReportContent(
  id: string,
  fields: WeeklyReportContentFields
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    const { error } = await supabase
      .from("project_weekly_reports")
      .update({ ...fields, modified_date: new Date().toISOString() })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, { success: false, error: "Network error" }, "updateWeeklyReportContent");
}

export async function fetchSingleWeeklyReport(id: string): Promise<WeeklyReportRow | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("project_weekly_reports")
      .select(WEEKLY_REPORT_SELECT)
      .eq("id", id)
      .single();
    if (error) return null;
    return data;
  }, null, "fetchSingleWeeklyReport");
}

export async function createWeeklyReportWithContent(
  projectId: string,
  weekNumber: number,
  meetingDate: string | null,
  fields: WeeklyReportContentFields
): Promise<{ success: boolean; id?: string; error?: string }> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("project_weekly_reports")
      .insert({
        project_id: projectId,
        week_number: weekNumber,
        meeting_date: meetingDate || null,
        report_name: fields.report_name || tenDayReportName(weekNumber),
        created_date: new Date().toISOString(),
        ...fields,
      })
      .select("id")
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  }, { success: false, error: "Network error" }, "createWeeklyReportWithContent");
}

/** Upload a generated PDF blob and attach it to an existing report (or create one). */
export async function persistWeeklyReportPdf(
  projectId: string,
  weekNumber: number,
  blob: Blob,
  options: {
    reportId?: string | null;
    meetingDate: string | null;
    reportName?: string;
    contentFields?: WeeklyReportContentFields;
  }
): Promise<{ success: boolean; id?: string; url?: string; error?: string }> {
  const fileName = `${tenDayReportName(weekNumber)}.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });
  const uploadResult = await uploadWeeklyReportFile(projectId, weekNumber, file);
  if (!uploadResult.success || !uploadResult.url) {
    return { success: false, error: uploadResult.error || "上傳 PDF 失敗" };
  }

  const meetingDateValue = options.meetingDate?.trim() || null;

  if (options.reportId) {
    const updateResult = await updateWeeklyReportContent(options.reportId, {
      file: uploadResult.url,
      meeting_date: meetingDateValue,
      ...(options.reportName ? { report_name: options.reportName } : {}),
      ...(options.contentFields || {}),
    });
    if (!updateResult.success) {
      return { success: false, error: updateResult.error || "更新報告失敗" };
    }
    return { success: true, id: options.reportId, url: uploadResult.url };
  }

  const createResult = await createWeeklyReportWithContent(
    projectId,
    weekNumber,
    meetingDateValue,
    {
      ...(options.contentFields || {}),
      file: uploadResult.url,
      report_name: options.reportName || tenDayReportName(weekNumber),
    }
  );
  if (!createResult.success) {
    return { success: false, error: createResult.error || "建立報告失敗" };
  }
  return { success: true, id: createResult.id, url: uploadResult.url };
}

export async function deleteWeeklyReport(id: string): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    const { error } = await supabase
      .from("project_weekly_reports")
      .delete()
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, { success: false, error: "Network error" }, "deleteWeeklyReport");
}

export async function deleteWeeklyReportFile(
  fileUrl: string
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    const parts = fileUrl.split("/weekly-reports/");
    if (parts.length < 2) return { success: false, error: "Invalid file URL" };
    const filePath = parts[1];
    const { error } = await supabase.storage
      .from("weekly-reports")
      .remove([filePath]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, { success: false, error: "Network error" }, "deleteWeeklyReportFile");
}
