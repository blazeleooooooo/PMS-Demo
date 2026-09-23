import type { SupabaseClient } from "@supabase/supabase-js";
import {
  notificationChannelResult,
  type NotificationChannelResult,
  type NotificationDelivery,
} from "@/lib/notification-delivery";
import {
  normalizeWhatsAppPhone,
  sendWhatsAppTemplateMessage,
} from "@/lib/whatsapp";
import {
  DAILY_PROJECT_SCHEDULE_TEMPLATE,
  formatIncomeDigestTaskDisplay,
  formatTaskBlock,
  hongKongDayUtcBounds,
  hongKongTodayYmd,
  inAppDigestFromBlocks,
  joinTaskBlocks,
  type DailyScheduleTaskInput,
} from "@/lib/daily-project-schedule-digest";
import {
  incomeBelongsOnDigestDate,
  isIncomeUsingExpectedCalendarDate,
} from "@/lib/date-utils";

const DATES_PATH = "/dates";
const PAGE_SIZE = 1000;

type Rel<T> = T | T[] | null | undefined;

function relOne<T>(value: Rel<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function sendTemplateSafe(
  to: string | null | undefined,
  bodyParameters: string[]
): Promise<NotificationChannelResult> {
  const phone = to ? normalizeWhatsAppPhone(to) : "";
  if (!phone) {
    return notificationChannelResult("skipped", { error: "no_phone" });
  }
  try {
    const result = await sendWhatsAppTemplateMessage({
      to: phone,
      templateName: DAILY_PROJECT_SCHEDULE_TEMPLATE.name,
      languageCode: DAILY_PROJECT_SCHEDULE_TEMPLATE.language,
      bodyParameters: bodyParameters.map((text) => ({
        type: "text",
        text: text || "-",
      })),
    });
    return notificationChannelResult("accepted", {
      message_id: result.messageId,
      to: phone,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[daily-schedule-notify] WhatsApp template failed:", error);
    return notificationChannelResult("failed", { error, to: phone });
  }
}

type DistrictRel = { name: string | null; chinese_display: string | null };
type ProjectRel = {
  id: string;
  project_code: string | null;
  project_name: string | null;
  real_district_name?: string | null;
  dist: Rel<DistrictRel>;
};
type TaskRel = { display: string | null };
type ContractRel = { display: string | null; chinese_display: string | null };

type ScheduleRow = {
  id: string;
  date: string | null;
  is_na: boolean | null;
  project_id: string | null;
  bwf_project_id: string | null;
  working_task: Rel<TaskRel>;
  payment_task: Rel<TaskRel>;
  bwa_project: Rel<ProjectRel>;
  bwf_project: Rel<ProjectRel>;
};

export type DailyScheduleDigestTask = DailyScheduleTaskInput & {
  scheduleId: string | null;
  incomeId: string | null;
  projectId: string | null;
  bwfProjectId: string | null;
};

function digestTaskKey(task: DailyScheduleDigestTask): string {
  if (task.scheduleId) return `s:${task.scheduleId}`;
  if (task.incomeId) return `i:${task.incomeId}`;
  return `p:${task.projectId || task.bwfProjectId || ""}:${task.taskDisplay || ""}`;
}

export type DailyScheduleStaffDigest = {
  staffId: string;
  staffName: string;
  workPhone: string | null;
  tasks: DailyScheduleDigestTask[];
};

export type DailyScheduleNotifyResult = {
  date: string;
  scheduleCount: number;
  recipientCount: number;
  sent: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
};

function toTask(row: ScheduleRow): DailyScheduleDigestTask | null {
  const working = relOne(row.working_task);
  const payment = relOne(row.payment_task);
  const isBwf = !!row.bwf_project_id && !row.project_id;
  const project = relOne(isBwf ? row.bwf_project : row.bwa_project);
  const dist = relOne(project?.dist);
  const taskDisplay = working?.display || payment?.display || null;
  if (!taskDisplay && !project?.project_code && !project?.project_name) {
    return null;
  }
  return {
    scheduleId: row.id,
    incomeId: null,
    projectId: row.project_id,
    bwfProjectId: row.bwf_project_id,
    taskDisplay,
    districtName: dist?.name ?? null,
    districtChinese: dist?.chinese_display ?? null,
    realDistrictName: project?.real_district_name ?? null,
    projectName: project?.project_name ?? null,
    projectCode: project?.project_code ?? null,
  };
}

type IncomeRow = {
  id: string;
  due_date: string | null;
  expected_payment_date: string | null;
  payment_status: string | null;
  invoice_number: string | null;
  type_display: string | null;
  project_id: string | null;
  bwf_project_id: string | null;
  ct: Rel<ContractRel>;
  bwa_project: Rel<ProjectRel>;
  bwf_project: Rel<ProjectRel>;
};

function incomeToTask(row: IncomeRow, ymd: string): DailyScheduleDigestTask | null {
  if (!incomeBelongsOnDigestDate(row, ymd)) return null;
  const isBwf = !!row.bwf_project_id && !row.project_id;
  const project = relOne(isBwf ? row.bwf_project : row.bwa_project);
  const dist = relOne(project?.dist);
  const ct = relOne(row.ct);
  const contract = ct?.chinese_display || ct?.display || row.type_display || null;
  const taskDisplay = formatIncomeDigestTaskDisplay({
    usingExpected: isIncomeUsingExpectedCalendarDate(row),
    contractTypeName: contract,
    invoiceNumber: row.invoice_number,
  });
  if (!taskDisplay && !project?.project_code && !project?.project_name) {
    return null;
  }
  return {
    scheduleId: null,
    incomeId: row.id,
    projectId: row.project_id,
    bwfProjectId: row.bwf_project_id,
    taskDisplay,
    districtName: dist?.name ?? null,
    districtChinese: dist?.chinese_display ?? null,
    realDistrictName: project?.real_district_name ?? null,
    projectName: project?.project_name ?? null,
    projectCode: project?.project_code ?? null,
  };
}

async function fetchTodaySchedules(
  supabase: SupabaseClient,
  ymd: string
): Promise<ScheduleRow[]> {
  const { startIso, endIso } = hongKongDayUtcBounds(ymd);
  const rows: ScheduleRow[] = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("project_schedules")
      .select(
        `
        id, date, is_na, project_id, bwf_project_id,
        working_task:project_schedule_tasks!fk_project_schedules_working_schedule_id(display),
        payment_task:project_schedule_tasks!fk_project_schedules_payment_schedule_id(display),
        bwa_project:bwa_projects!fk_project_schedules_project_id(
          id, project_code, project_name, real_district_name,
          dist:districts!fk_bwa_projects_r_nos_district_id(name, chinese_display)
        ),
        bwf_project:bwf_projects!fk_project_schedules_bwf_project_id(
          id, project_code, project_name,
          dist:districts!fk_bwf_projects_r_district_id(name, chinese_display)
        )
      `
      )
      .not("date", "is", null)
      .gte("date", startIso)
      .lt("date", endIso)
      .or("is_na.is.null,is_na.eq.false")
      .or("project_id.not.is.null,bwf_project_id.not.is.null")
      .order("date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[daily-schedule-notify] schedule fetch:", error.message);
      break;
    }
    const batch = (data ?? []) as ScheduleRow[];
    rows.push(...batch);
    hasMore = batch.length === PAGE_SIZE;
    page += 1;
  }
  return rows;
}

const INCOME_DIGEST_SELECT = `
  id, due_date, expected_payment_date, payment_status, invoice_number, type_display,
  project_id, bwf_project_id,
  ct:nos_contracts!fk_incomes_n_contract_type_id(display, chinese_display),
  bwa_project:bwa_projects!fk_incomes_project_id(
    id, project_code, project_name, real_district_name,
    dist:districts!fk_bwa_projects_r_nos_district_id(name, chinese_display)
  ),
  bwf_project:bwf_projects!fk_incomes_bwf_project_id(
    id, project_code, project_name,
    dist:districts!fk_bwf_projects_r_district_id(name, chinese_display)
  )
`;

async function fetchIncomesByDateColumn(
  supabase: SupabaseClient,
  column: "due_date" | "expected_payment_date",
  startIso: string,
  endIso: string
): Promise<IncomeRow[]> {
  const rows: IncomeRow[] = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("incomes")
      .select(INCOME_DIGEST_SELECT)
      .not("due_date", "is", null)
      .or("project_id.not.is.null,bwf_project_id.not.is.null")
      .gte(column, startIso)
      .lt(column, endIso)
      .order("due_date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`[daily-schedule-notify] income ${column} fetch:`, error.message);
      break;
    }
    const batch = (data ?? []) as IncomeRow[];
    rows.push(...batch);
    hasMore = batch.length === PAGE_SIZE;
    page += 1;
  }
  return rows;
}

async function fetchTodayIncomes(
  supabase: SupabaseClient,
  ymd: string
): Promise<IncomeRow[]> {
  const { startIso, endIso } = hongKongDayUtcBounds(ymd);
  const [byDue, byExpected] = await Promise.all([
    fetchIncomesByDateColumn(supabase, "due_date", startIso, endIso),
    fetchIncomesByDateColumn(supabase, "expected_payment_date", startIso, endIso),
  ]);
  const byId = new Map<string, IncomeRow>();
  for (const row of [...byDue, ...byExpected]) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

async function fetchHandlersByProject(
  supabase: SupabaseClient,
  bwaIds: string[],
  bwfIds: string[]
): Promise<{ bwa: Map<string, string[]>; bwf: Map<string, string[]> }> {
  const bwa = new Map<string, string[]>();
  const bwf = new Map<string, string[]>();
  const chunks: Array<{ col: "project_id" | "bwf_project_id"; ids: string[] }> =
    [];
  for (let i = 0; i < bwaIds.length; i += 200) {
    chunks.push({ col: "project_id", ids: bwaIds.slice(i, i + 200) });
  }
  for (let i = 0; i < bwfIds.length; i += 200) {
    chunks.push({ col: "bwf_project_id", ids: bwfIds.slice(i, i + 200) });
  }

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("project_bv")
      .select("handler_id, project_id, bwf_project_id")
      .in(chunk.col, chunk.ids)
      .not("handler_id", "is", null);
    if (error) {
      console.error("[daily-schedule-notify] project_bv fetch:", error.message);
      continue;
    }
    for (const row of data ?? []) {
      const handlerId = row.handler_id as string;
      if (row.project_id && chunk.col === "project_id") {
        const list = bwa.get(row.project_id) ?? [];
        if (!list.includes(handlerId)) list.push(handlerId);
        bwa.set(row.project_id, list);
      }
      if (row.bwf_project_id && chunk.col === "bwf_project_id") {
        const list = bwf.get(row.bwf_project_id) ?? [];
        if (!list.includes(handlerId)) list.push(handlerId);
        bwf.set(row.bwf_project_id, list);
      }
    }
  }
  return { bwa, bwf };
}

export async function loadDailyProjectScheduleDigests(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<{
  date: string;
  tasks: DailyScheduleDigestTask[];
  recipients: DailyScheduleStaffDigest[];
}> {
  const date = hongKongTodayYmd(now);
  const [scheduleRows, incomeRows] = await Promise.all([
    fetchTodaySchedules(supabase, date),
    fetchTodayIncomes(supabase, date),
  ]);
  const tasks = [
    ...scheduleRows.map(toTask),
    ...incomeRows.map((row) => incomeToTask(row, date)),
  ].filter((t): t is DailyScheduleDigestTask => t !== null);

  const bwaIds = [
    ...new Set(tasks.map((t) => t.projectId).filter((id): id is string => !!id)),
  ];
  const bwfIds = [
    ...new Set(
      tasks.map((t) => t.bwfProjectId).filter((id): id is string => !!id)
    ),
  ];
  const handlers = await fetchHandlersByProject(supabase, bwaIds, bwfIds);

  const byStaff = new Map<string, DailyScheduleDigestTask[]>();
  for (const task of tasks) {
    const staffIds = [
      ...(task.projectId ? handlers.bwa.get(task.projectId) ?? [] : []),
      ...(task.bwfProjectId ? handlers.bwf.get(task.bwfProjectId) ?? [] : []),
    ];
    const uniqueStaff = [...new Set(staffIds)];
    for (const staffId of uniqueStaff) {
      const list = byStaff.get(staffId) ?? [];
      if (!list.some((t) => digestTaskKey(t) === digestTaskKey(task))) {
        list.push(task);
      }
      byStaff.set(staffId, list);
    }
  }

  const staffIds = [...byStaff.keys()];
  const recipients: DailyScheduleStaffDigest[] = [];
  for (let i = 0; i < staffIds.length; i += 200) {
    const slice = staffIds.slice(i, i + 200);
    const { data, error } = await supabase
      .from("staff")
      .select("id, name, work_phone, status")
      .in("id", slice)
      .eq("status", "Active");
    if (error) {
      console.error("[daily-schedule-notify] staff fetch:", error.message);
      continue;
    }
    for (const staff of data ?? []) {
      recipients.push({
        staffId: staff.id,
        staffName: (staff.name || "").trim() || "同事",
        workPhone: staff.work_phone,
        tasks: byStaff.get(staff.id) ?? [],
      });
    }
  }

  recipients.sort((a, b) => a.staffName.localeCompare(b.staffName, "zh-Hant"));
  return { date, tasks, recipients };
}

async function insertInApp(
  supabase: SupabaseClient,
  payload: {
    recipient_staff_id: string;
    title: string;
    message: string;
    delivery?: NotificationDelivery;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("notifications").insert({
    recipient_staff_id: payload.recipient_staff_id,
    title: payload.title,
    message: payload.message,
    type: "reminder",
    link_url: DATES_PATH,
    metadata: payload.metadata ?? {},
    delivery: payload.delivery ?? {},
  });
  if (error) {
    console.error("[daily-schedule-notify] in-app insert failed:", error.message);
  }
}

export async function runDailyProjectScheduleNotify(
  supabase: SupabaseClient,
  options?: { dryRun?: boolean; now?: Date }
): Promise<DailyScheduleNotifyResult> {
  const dryRun = options?.dryRun === true;
  const { date, tasks, recipients } = await loadDailyProjectScheduleDigests(
    supabase,
    options?.now
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const blocks = recipient.tasks.map((t) => formatTaskBlock(t));
    const { digest, omittedCount } = joinTaskBlocks(blocks);
    const count = String(recipient.tasks.length);
    const inAppBody = inAppDigestFromBlocks(blocks);
    const title = `今日有 ${count} 項項目日程`;
    const message =
      omittedCount > 0
        ? `${inAppBody}\n\n…及其他 ${omittedCount} 項`
        : inAppBody;

    if (dryRun) {
      skipped += 1;
      continue;
    }

    const whatsapp = await sendTemplateSafe(recipient.workPhone, [
      recipient.staffName,
      count,
      digest,
    ]);
    if (whatsapp.status === "accepted") sent += 1;
    else if (whatsapp.status === "failed") failed += 1;
    else skipped += 1;

    await insertInApp(supabase, {
      recipient_staff_id: recipient.staffId,
      title,
      message,
      delivery: { whatsapp },
      metadata: {
        kind: "daily_project_schedule",
        date,
        schedule_ids: recipient.tasks
          .map((t) => t.scheduleId)
          .filter((id): id is string => !!id),
        income_ids: recipient.tasks
          .map((t) => t.incomeId)
          .filter((id): id is string => !!id),
        task_count: recipient.tasks.length,
      },
    });
  }

  return {
    date,
    scheduleCount: tasks.length,
    recipientCount: recipients.length,
    sent,
    skipped,
    failed,
    dryRun,
  };
}
