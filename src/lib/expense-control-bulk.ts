import { type SupabaseClient } from "@supabase/supabase-js";
import {
  isBwaProjectSizeAtLeast,
  resolveBwaProjectSize,
} from "@/lib/bwa-project-size";
import {
  fetchApprovedWaiverKeysByProject,
  INSTALLMENT_VS_INCOME_ITEM_KEY,
  OVERDUE_INCOME_EXPECTED_DATE_ITEM_KEY,
} from "@/lib/expense-control-waiver-service";
import { countOverdueTenDayReports } from "@/lib/data/weekly-reports";
import {
  countOverdueIncomesMissingExpectedDate,
  formatMoney,
  overdueIncomeExpectedDateItemLabel,
  todayHkYmd,
} from "@/lib/date-utils";

// Bulk Expense Control evaluator — mirrors evaluateExpenseControl() in one batched pass.
// Used by /api/expense-locked (admin). Staff deadline list uses fetchMissingSiteStatusDeadlineProjects.

type AdminSupabase = SupabaseClient;

const DESIGN_DOC_SERVICE_TYPES = new Set(["Design and Build", "Design Only"]);
/** Mirrors expense-control-service — company BV row is not a real reviewer. */
const COMPANY_BV_HANDLER_ID = "00000000-0000-4000-8000-000000000001";
const PAGE = 1000;
/** Keep `.in()` URL length under PostgREST limits. */
const IN_CHUNK = 200;

export interface ExpenseLockedRow {
  id: string;
  project_code: string | null;
  project_name: string | null;
  status: string | null;
  signed_date: string | null;
  size: string | null;
  /** Resolved/stored project_size label used by Expense Control gates. */
  project_size: string | null;
  pm_name: string | null;
  customer_name: string | null;
  n_financial_year_id: string | null;
  financial_year_name: string | null;
  cost_centre_bu_code: string | null;
  service_type_name: string | null;
  project_type_name: string | null;
  est_income: number | null;
  expense_count: number;
  tier: "high" | "mid";
  failedItems: string[];
  /** Checklist keys aligned with failedItems (same order). */
  failedKeys: string[];
  passedCount: number;
  activeItemCount: number;
}

export interface BulkExpenseControlOptions {
  /** When set, only projects where main_pm_id matches. */
  mainPmId?: string;
  /** When set, only evaluate these project UUIDs (chunked `.in()`). */
  projectIds?: string[];
  /** Drop non–Work In Progress before related-table fetches (list column). */
  wipOnly?: boolean;
  /**
   * Skip display enrichment (staff/customer/FY names). Still returns
   * ExpenseLockedRow stubs with id + failedItems for callers that only need locks.
   */
  idsOnly?: boolean;
}

/** Static lookup tables reused across list-column status calls (60s TTL). */
type SharedLookupCache = {
  at: number;
  docTypes: any[];
  ssSections: any[];
  ssQuestions: any[];
  ssMap: any[];
  schedTasks: any[];
  costCentres: any[];
  serviceTypes: any[];
  projectTypes: any[];
};

const SHARED_LOOKUP_TTL_MS = 60_000;
let sharedLookupCache: SharedLookupCache | null = null;

async function fetchSharedLookups(
  supabaseAdmin: AdminSupabase,
  useCache: boolean
): Promise<Omit<SharedLookupCache, "at">> {
  if (
    useCache &&
    sharedLookupCache &&
    Date.now() - sharedLookupCache.at < SHARED_LOOKUP_TTL_MS
  ) {
    const { at: _at, ...rest } = sharedLookupCache;
    return rest;
  }
  const [
    docTypes,
    ssSections,
    ssQuestions,
    ssMap,
    schedTasks,
    costCentres,
    serviceTypes,
    projectTypes,
  ] = await Promise.all([
    fetchAll(supabaseAdmin, "nos_doc_types", "id, display, is_project_initial_doc"),
    fetchAll(supabaseAdmin, "site_status_sections", "id, is_active"),
    fetchAll(supabaseAdmin, "site_status_questions", "id, section_id, is_active"),
    fetchAll(supabaseAdmin, "site_status_question_project_types", "question_id, quote_project_type_id"),
    fetchAll(supabaseAdmin, "project_schedule_tasks", "id, os_schedule_groups, os_schedule_groups_id, is_custom"),
    fetchAll(supabaseAdmin, "cost_centres", "id, bu_code, expense_control_enabled"),
    fetchAll(supabaseAdmin, "service_types", "id, display, site_status_required"),
    fetchAll(supabaseAdmin, "project_types", "id, display, chin_display, site_status_required"),
  ]);
  const pack = {
    docTypes,
    ssSections,
    ssQuestions,
    ssMap,
    schedTasks,
    costCentres,
    serviceTypes,
    projectTypes,
  };
  if (useCache) {
    sharedLookupCache = { ...pack, at: Date.now() };
  }
  return pack;
}

function dateReached(d: string | null | undefined): boolean {
  if (!d) return false;
  const day = new Date(d);
  if (isNaN(day.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return day.getTime() <= today.getTime();
}

/** True when today is on/after (d + days). */
function dateReachedAfterDays(d: string | null | undefined, days: number): boolean {
  if (!d) return false;
  const day = new Date(d);
  if (isNaN(day.getTime())) return false;
  day.setDate(day.getDate() + days);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return day.getTime() <= today.getTime();
}

function siteCompletionRatio(
  start: string | null | undefined,
  handover: string | null | undefined
): number | null {
  if (!start || !handover) return null;
  const s = new Date(start).getTime();
  const h = new Date(handover).getTime();
  if (isNaN(s) || isNaN(h) || h <= s) return null;
  const ratio = (Date.now() - s) / (h - s);
  return Math.max(0, Math.min(1, ratio));
}

function chunkIds(ids: string[], size = IN_CHUNK): string[][] {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

/** Paginate a full-table select (small lookup tables only). */
async function fetchAll(
  supabaseAdmin: AdminSupabase,
  table: string,
  cols: string
): Promise<any[]> {
  const out: any[] = [];
  let page = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Stable order required — range/offset without ORDER BY can skip/dupe rows.
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(cols)
      .order("id", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) break;
    page++;
  }
  return out;
}

/** Paginate rows matching `.in(fkColumn, ids)` across chunks. */
async function fetchByIn(
  supabaseAdmin: AdminSupabase,
  table: string,
  cols: string,
  fkColumn: string,
  ids: string[]
): Promise<any[]> {
  if (ids.length === 0) return [];
  const out: any[] = [];
  for (const batch of chunkIds(ids)) {
    let from = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Stable order required — range/offset without ORDER BY can skip/dupe rows.
      const { data, error } = await supabaseAdmin
        .from(table)
        .select(cols)
        .in(fkColumn, batch)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}.${fkColumn}: ${error.message}`);
      out.push(...(data ?? []));
      if ((data?.length ?? 0) < PAGE) break;
      from += PAGE;
    }
  }
  return out;
}

/**
 * Candidate projects with DB-side filters so admin expense-locked never pulls
 * the full bwa_projects table into Node when scoped by Main PM or project IDs.
 */
async function fetchCandidateProjects(
  supabaseAdmin: AdminSupabase,
  options: BulkExpenseControlOptions
): Promise<any[]> {
  const cols =
    "id, bubble_id, project_code, project_name, status, signed_date, start_date, handover_date, defect_done_date, estimated_income, project_size, main_contractor_id, quote_project_type_id, os_schedule_group, real_customer_display_name, main_pm_id, customer_id, n_financial_year_id, size, n_service_type_id, cost_centre_id";

  // Scoped by explicit IDs — chunk `.in()` to stay under PostgREST URL limits.
  if (options.projectIds) {
    const ids = [...new Set(options.projectIds.filter(Boolean))];
    if (ids.length === 0) return [];
    const out: any[] = [];
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
      const chunk = ids.slice(i, i + IN_CHUNK);
      let q = supabaseAdmin.from("bwa_projects").select(cols).in("id", chunk);
      if (options.mainPmId) {
        q = q.eq("main_pm_id", options.mainPmId);
      }
      const { data, error } = await q;
      if (error) throw new Error(`bwa_projects: ${error.message}`);
      out.push(...(data ?? []));
    }
    return out;
  }

  const out: any[] = [];
  let page = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Size gate (小於$30K) is applied in JS via resolveBwaProjectSize.
    let q = supabaseAdmin.from("bwa_projects").select(cols);

    if (options.mainPmId) {
      q = q.eq("main_pm_id", options.mainPmId);
    }

    const { data, error } = await q
      .order("id", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(`bwa_projects: ${error.message}`);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) break;
    page++;
  }
  return out;
}

export async function evaluateBulkExpenseLockedProjects(
  supabaseAdmin: AdminSupabase,
  options: BulkExpenseControlOptions = {}
): Promise<ExpenseLockedRow[]> {
  let projects = await fetchCandidateProjects(supabaseAdmin, options);

  if (projects.length === 0) return [];

  // Cheap pre-filters before related-table fan-out (list column path).
  if (options.wipOnly) {
    projects = projects.filter(
      (p) => (p.status || "").trim() === "Work In Progress"
    );
  }
  projects = projects.filter((p) => {
    const projectSize = resolveBwaProjectSize(
      p.project_size,
      Number(p.estimated_income ?? 0)
    );
    return !!projectSize && projectSize !== "小於$30K";
  });
  if (projects.length === 0) return [];

  const projIds = projects.map((p) => p.id as string);
  const projIdSet = new Set(projIds);
  const bubbleIds = [
    ...new Set(
      projects.map((p) => p.bubble_id as string | null).filter((id): id is string => !!id)
    ),
  ];
  const customerIds = [
    ...new Set(
      projects.map((p) => p.customer_id as string | null).filter((id): id is string => !!id)
    ),
  ];
  const pmIds = [
    ...new Set(
      projects.map((p) => p.main_pm_id as string | null).filter((id): id is string => !!id)
    ),
  ];

  const empty: any[] = [];
  // Shared lookups (cached on idsOnly) + project-scoped tables in one wave.
  const [
    shared,
    siteStatusRows,
    projectDocs,
    projSchedules,
    internalComments,
    supplierComments,
    staff,
    customers,
    finYears,
    projectTypeJunction,
    expenses,
    incomes,
    projectBvRows,
    threeDCollections,
    threeDRendersDirect,
    customerDocuments,
    weeklyReports,
  ] = await Promise.all([
    fetchSharedLookups(supabaseAdmin, !!options.idsOnly),
    fetchByIn(supabaseAdmin, "site_statuses", "id, project_id, project", "project_id", projIds),
    fetchByIn(supabaseAdmin, "project_documents", "project_id, doc_type_id", "project_id", projIds),
    fetchByIn(
      supabaseAdmin,
      "project_schedules",
      "project_id, working_schedule_id, date, is_na",
      "project_id",
      projIds
    ),
    fetchByIn(supabaseAdmin, "internal_comments", "project_id, comment", "project_id", projIds),
    fetchByIn(supabaseAdmin, "staff_supplier_comments", "project_id", "project_id", projIds),
    options.idsOnly
      ? Promise.resolve(empty)
      : fetchByIn(supabaseAdmin, "staff", "id, name", "id", pmIds),
    options.idsOnly
      ? Promise.resolve(empty)
      : fetchByIn(supabaseAdmin, "customers", "id, customer_name, company_name", "id", customerIds),
    options.idsOnly
      ? Promise.resolve(empty)
      : fetchAll(supabaseAdmin, "financial_years", "id, display"),
    fetchByIn(
      supabaseAdmin,
      "bwa_project_project_types",
      "project_id, project_type_id",
      "project_id",
      projIds
    ),
    fetchByIn(
      supabaseAdmin,
      "expenses",
      "project_id, supplier_id, installment_amount",
      "project_id",
      projIds
    ),
    fetchByIn(
      supabaseAdmin,
      "incomes",
      "project_id, income_amount, due_date, expected_payment_date, payment_status",
      "project_id",
      projIds
    ),
    // project_bv.project is still the Bubble project id (legacy TEXT).
    fetchByIn(supabaseAdmin, "project_bv", "project, handler_id", "project", bubbleIds),
    fetchByIn(supabaseAdmin, "three_d_collections", "id, r_project_id", "r_project_id", projIds),
    fetchByIn(supabaseAdmin, "three_d_renders", "id, image, project_id, r_3d_collection_id", "project_id", projIds),
    fetchByIn(
      supabaseAdmin,
      "customer_documents",
      "customer_id, customer_document_types(type_key)",
      "customer_id",
      customerIds
    ),
    fetchByIn(
      supabaseAdmin,
      "project_weekly_reports",
      "project_id, week_number",
      "project_id",
      projIds
    ),
  ]);

  const {
    docTypes,
    ssSections,
    ssQuestions,
    ssMap,
    schedTasks,
    costCentres,
    serviceTypes,
    projectTypes,
  } = shared;

  const findDoc = (...patterns: string[]) =>
    docTypes.find(
      (r) =>
        r.display &&
        patterns.some((p) => String(r.display).toLowerCase().includes(p.toLowerCase()))
    )?.id ?? null;
  const insuranceId = findDoc("工地保險", "site work insurance");
  const planId = findDoc("平面圖", "8 plan");
  const detailedDrawingId = findDoc("施工圖紙", "detailed drawing");
  const projectPptId = findDoc("項目ppt");
  const completionPhotosId = findDoc("完工相片");
  const formS3Id = findDoc("form s3");
  const watchedDocIds = new Set(
    [
      insuranceId,
      planId,
      detailedDrawingId,
      projectPptId,
      completionPhotosId,
      formS3Id,
    ].filter(Boolean) as string[]
  );

  const weekNumbersByProject = new Map<string, number[]>();
  for (const row of weeklyReports) {
    const pid = row.project_id as string | null;
    const wn = row.week_number as number | null;
    if (!pid || wn == null) continue;
    const arr = weekNumbersByProject.get(pid) ?? [];
    arr.push(wn);
    weekNumbersByProject.set(pid, arr);
  }

  const waivedByProject = await fetchApprovedWaiverKeysByProject(
    projIds,
    supabaseAdmin as any
  );

  const threeDCollectionIds = threeDCollections
    .map((c) => c.id as string)
    .filter(Boolean);
  const threeDRendersViaCol = await fetchByIn(
    supabaseAdmin,
    "three_d_renders",
    "id, image, project_id, r_3d_collection_id",
    "r_3d_collection_id",
    threeDCollectionIds
  );

  const ssIds = siteStatusRows.map((r) => r.id as string).filter(Boolean);
  const ssAnswers = await fetchByIn(
    supabaseAdmin,
    "site_status_answers",
    "site_status_id, question_id, value",
    "site_status_id",
    ssIds
  );

  const ptIdsByProject = new Map<string, string[]>();
  for (const r of projectTypeJunction) {
    if (!r.project_id || !r.project_type_id || !projIdSet.has(String(r.project_id))) continue;
    const arr = ptIdsByProject.get(String(r.project_id)) ?? [];
    arr.push(r.project_type_id);
    ptIdsByProject.set(String(r.project_id), arr);
  }

  const expenseCount = new Map<string, number>();
  const expenseInstallmentSumByProject = new Map<string, number>();
  const incomeAmountSumByProject = new Map<string, number>();
  const incomesByProject = new Map<
    string,
    {
      due_date?: string | null;
      expected_payment_date?: string | null;
      payment_status?: string | null;
    }[]
  >();
  // Projects that have at least one expense with a supplier_id — supplier
  // comment is only required for those (matches evaluateExpenseControl).
  const hasExpenseSupplierByProject = new Set<string>();
  for (const e of expenses) {
    if (e.project_id && projIdSet.has(String(e.project_id))) {
      const pid = String(e.project_id);
      expenseCount.set(pid, (expenseCount.get(pid) || 0) + 1);
      expenseInstallmentSumByProject.set(
        pid,
        (expenseInstallmentSumByProject.get(pid) || 0) +
          Number(e.installment_amount ?? 0)
      );
      if (e.supplier_id) hasExpenseSupplierByProject.add(pid);
    }
  }
  for (const inc of incomes) {
    if (inc.project_id && projIdSet.has(String(inc.project_id))) {
      const pid = String(inc.project_id);
      incomeAmountSumByProject.set(
        pid,
        (incomeAmountSumByProject.get(pid) || 0) + Number(inc.income_amount ?? 0)
      );
      const arr = incomesByProject.get(pid) ?? [];
      arr.push({
        due_date: inc.due_date ?? null,
        expected_payment_date: inc.expected_payment_date ?? null,
        payment_status: inc.payment_status ?? null,
      });
      incomesByProject.set(pid, arr);
    }
  }

  const activeQuestionIds = new Set(ssQuestions.filter((q) => q.is_active).map((q) => q.id));
  const typesByQ = new Map<string, string[]>();
  for (const m of ssMap) {
    if (!activeQuestionIds.has(m.question_id)) continue;
    const arr = typesByQ.get(m.question_id) ?? [];
    arr.push(m.quote_project_type_id);
    typesByQ.set(m.question_id, arr);
  }
  const activeSectionIds = new Set(ssSections.filter((s) => s.is_active).map((s) => s.id));
  const questionsList = ssQuestions
    .filter((q) => q.is_active && q.section_id && activeSectionIds.has(q.section_id))
    .map((q) => ({ id: q.id, typeIds: typesByQ.get(q.id) ?? [] }));

  const ssIdByProject = new Map<string, string>();
  for (const r of siteStatusRows) {
    const pid = r.project_id ?? r.project;
    if (pid && projIdSet.has(String(pid))) ssIdByProject.set(String(pid), r.id);
  }

  const isFilled = (v: any) => v != null && v !== "" && (!Array.isArray(v) || v.length > 0);
  const filledByss = new Map<string, Set<string>>();
  for (const a of ssAnswers) {
    if (!isFilled(a.value)) continue;
    const set = filledByss.get(a.site_status_id) ?? new Set<string>();
    set.add(a.question_id);
    filledByss.set(a.site_status_id, set);
  }

  const docsByProject = new Map<string, Set<string>>();
  for (const d of projectDocs) {
    if (!d.project_id || !projIdSet.has(String(d.project_id))) continue;
    if (!watchedDocIds.has(d.doc_type_id)) continue;
    const set = docsByProject.get(String(d.project_id)) ?? new Set<string>();
    set.add(d.doc_type_id);
    docsByProject.set(String(d.project_id), set);
  }

  /** customer_id → set of customer_document_types.type_key present. */
  const customerDocTypeKeys = new Map<string, Set<string>>();
  for (const row of customerDocuments) {
    const cid = row.customer_id as string | null;
    if (!cid) continue;
    const typeKey =
      (row.customer_document_types as { type_key?: string | null } | null)?.type_key ??
      null;
    if (!typeKey) continue;
    const set = customerDocTypeKeys.get(cid) ?? new Set<string>();
    set.add(typeKey);
    customerDocTypeKeys.set(cid, set);
  }

  const workingSchedByProject = new Map<string, { taskId: string; date: any; is_na: boolean }[]>();
  for (const s of projSchedules) {
    if (!s.project_id || !projIdSet.has(String(s.project_id)) || !s.working_schedule_id) continue;
    const arr = workingSchedByProject.get(String(s.project_id)) ?? [];
    arr.push({ taskId: s.working_schedule_id, date: s.date, is_na: !!s.is_na });
    workingSchedByProject.set(String(s.project_id), arr);
  }

  const hasInternalByProject = new Set<string>();
  for (const c of internalComments) {
    if (c.project_id && c.comment != null && projIdSet.has(String(c.project_id))) {
      hasInternalByProject.add(String(c.project_id));
    }
  }
  const hasSupplierByProject = new Set<string>();
  for (const c of supplierComments) {
    if (c.project_id && projIdSet.has(String(c.project_id))) {
      hasSupplierByProject.add(String(c.project_id));
    }
  }

  // Distinct real BV handlers per Bubble project id (excludes company row).
  const realBvHandlersByBubble = new Map<string, Set<string>>();
  for (const r of projectBvRows) {
    if (!r.project || !r.handler_id || r.handler_id === COMPANY_BV_HANDLER_ID) continue;
    const set = realBvHandlersByBubble.get(String(r.project)) ?? new Set<string>();
    set.add(String(r.handler_id));
    realBvHandlersByBubble.set(String(r.project), set);
  }

  // 3D rendering: collection → project, plus renders with image (direct or via collection).
  const projectIdByCollection = new Map<string, string>();
  for (const c of threeDCollections) {
    if (c.id && c.r_project_id && projIdSet.has(String(c.r_project_id))) {
      projectIdByCollection.set(String(c.id), String(c.r_project_id));
    }
  }
  const hasThreeDByProject = new Set<string>();
  const markThreeD = (projectId: string | null | undefined, image: string | null | undefined) => {
    if (!projectId || !projIdSet.has(String(projectId))) return;
    if (!image || String(image).trim() === "") return;
    hasThreeDByProject.add(String(projectId));
  };
  for (const r of threeDRendersDirect) {
    markThreeD(r.project_id, r.image);
  }
  for (const r of threeDRendersViaCol) {
    const pid = r.r_3d_collection_id
      ? projectIdByCollection.get(String(r.r_3d_collection_id))
      : null;
    markThreeD(pid ?? r.project_id, r.image);
  }

  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const custById = new Map(customers.map((c) => [c.id, c]));
  const fyName = new Map(finYears.map((f) => [f.id, f.display]));
  const ccBu = new Map(costCentres.map((c) => [c.id, c.bu_code]));
  const ccExpenseControlEnabled = new Map(
    costCentres.map((c) => [c.id, c.expense_control_enabled !== false])
  );
  const stName = new Map(serviceTypes.map((s) => [s.id, s.display]));
  const ptName = new Map(projectTypes.map((t) => [t.id, t.chin_display || t.display]));
  const stRequired = new Map(serviceTypes.map((s) => [s.id, s.site_status_required === true]));
  const ptRequired = new Map(projectTypes.map((t) => [t.id, t.site_status_required === true]));

  const defaultTasks = schedTasks.filter((t) => t.is_custom == null || t.is_custom === false);
  const todayYmd = todayHkYmd();

  function matchingTaskIds(osGroup: string | null): string[] {
    if (!osGroup) return [];
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(osGroup);
    return defaultTasks
      .filter((t) =>
        isUuid
          ? t.os_schedule_groups_id === osGroup
          : (t.os_schedule_groups || "").toLowerCase().includes(osGroup.toLowerCase())
      )
      .map((t) => t.id);
  }

  const result: ExpenseLockedRow[] = [];
  for (const p of projects) {
    // Skip projects whose cost centre is excluded from expense control.
    if (p.cost_centre_id && ccExpenseControlEnabled.get(p.cost_centre_id) === false) {
      continue;
    }

    const totalAmount = Number(p.estimated_income ?? 0);
    const projectSize = resolveBwaProjectSize(p.project_size, totalAmount);
    // No control for 小於$30K (including income-derived fallback).
    if (!projectSize || projectSize === "小於$30K") continue;

    const tier: "high" | "mid" = isBwaProjectSizeAtLeast(projectSize, "$250-500K中小型")
      ? "high"
      : "mid";
    const sizeAtLeast100k = isBwaProjectSizeAtLeast(projectSize, "$100-250K小型");
    const sizeAtLeast250k = isBwaProjectSizeAtLeast(projectSize, "$250-500K中小型");
    const sizeAtLeast500k = isBwaProjectSizeAtLeast(projectSize, "$500K-$1M中型");

    const completion = siteCompletionRatio(p.start_date, p.handover_date);
    const stage2On = dateReached(p.start_date);
    const stage3On = completion != null && completion >= 0.4;
    const stageFinalOn = completion != null && completion >= 0.75;
    const stage4On = completion != null && completion >= 0.9;
    const stageFollowUpOn = dateReachedAfterDays(p.handover_date, 7);
    const stageDefectOn = dateReached(p.defect_done_date);

    const ssId = ssIdByProject.get(p.id);
    const branchQuestions = questionsList.filter(
      (q) =>
        q.typeIds.length === 0 ||
        (p.quote_project_type_id != null && q.typeIds.includes(p.quote_project_type_id))
    );
    let siteCompletion = 0;
    if (ssId && branchQuestions.length > 0) {
      const filled = filledByss.get(ssId) ?? new Set<string>();
      const filledCount = branchQuestions.filter((q) => filled.has(q.id)).length;
      siteCompletion = filledCount / branchQuestions.length;
    }

    const taskIds = matchingTaskIds(p.os_schedule_group);
    const totalSchedule = taskIds.length;
    let completedSchedule = 0;
    if (totalSchedule > 0) {
      const recs = workingSchedByProject.get(p.id) ?? [];
      const recByTask = new Map(recs.map((r) => [r.taskId, r]));
      for (const tid of taskIds) {
        const r = recByTask.get(tid);
        if (r && (r.is_na || !!r.date)) completedSchedule++;
      }
    }
    const scheduleRatio = totalSchedule > 0 ? completedSchedule / totalSchedule : 0;

    const uploadedDocs = docsByProject.get(p.id) ?? new Set<string>();
    const hasDoc = (id: string | null) => !!id && uploadedDocs.has(id);
    const customerTypeKeys = p.customer_id
      ? (customerDocTypeKeys.get(String(p.customer_id)) ?? new Set<string>())
      : new Set<string>();
    const hasCustomerDoc = (typeKey: string) => customerTypeKeys.has(typeKey);
    const serviceTypeDisplay = p.n_service_type_id ? (stName.get(p.n_service_type_id) ?? "") : "";
    const designDocsRequired = DESIGN_DOC_SERVICE_TYPES.has(serviceTypeDisplay);

    const waivedSet = waivedByProject.get(p.id) ?? new Set<string>();
    const failed: string[] = [];
    const failedKeys: string[] = [];
    let activeItemCount = 0;
    let passedCount = 0;
    const check = (key: string, label: string, passed: boolean) => {
      activeItemCount++;
      if (passed || waivedSet.has(key)) passedCount++;
      else {
        failed.push(label);
        failedKeys.push(key);
      }
    };

    check("dates", "已填寫開工日及交場日", !!p.start_date && !!p.handover_date);
    {
      const expenseSum = expenseInstallmentSumByProject.get(p.id) ?? 0;
      const incomeSum = incomeAmountSumByProject.get(p.id) ?? 0;
      check(
        INSTALLMENT_VS_INCOME_ITEM_KEY,
        `支出總額不大於收入總額 (支出 ${formatMoney(expenseSum, { showZero: true })} / 收入 ${formatMoney(incomeSum, { showZero: true })})`,
        expenseSum <= incomeSum
      );
    }
    {
      const overdueIncomeMissingExpectedCount = countOverdueIncomesMissingExpectedDate(
        incomesByProject.get(p.id) ?? [],
        todayYmd
      );
      check(
        OVERDUE_INCOME_EXPECTED_DATE_ITEM_KEY,
        overdueIncomeExpectedDateItemLabel(overdueIncomeMissingExpectedCount),
        overdueIncomeMissingExpectedCount === 0
      );
    }
    if (stage2On) {
      check(
        "customer-br",
        "已上載「BR 商業登記證」",
        hasCustomerDoc("br")
      );
      if (sizeAtLeast100k) {
        check(
          "customer-form-s1",
          "已上載「Form S1 - BW Start Project Form」",
          hasCustomerDoc("form_s1")
        );
      }
      check("insurance", "已上載「Site Work Insurance 工地保險」", hasDoc(insuranceId));
      check("main-contractor", "已填寫主要承包商 Main Contractor", !!p.main_contractor_id);
      const projTypeIds = ptIdsByProject.get(p.id) ?? [];
      const anyProjectTypeRequired = projTypeIds.some((id) => ptRequired.get(id) === true);
      const serviceTypeRequired = p.n_service_type_id
        ? stRequired.get(p.n_service_type_id) === true
        : false;
      const siteStatusRequired =
        anyProjectTypeRequired && serviceTypeRequired && sizeAtLeast250k;
      if (siteStatusRequired) {
        check(
          "site-status",
          `工地狀況 Site Status 最少填寫 90% (目前 ${Math.round(siteCompletion * 100)}%)`,
          siteCompletion >= 0.9
        );
      }
      // 每10天檢查 — between Project Started and Early Stage
      if (p.start_date && p.handover_date) {
        const overdueTenDay = countOverdueTenDayReports(
          p.start_date,
          p.handover_date,
          weekNumbersByProject.get(p.id) ?? []
        );
        check(
          "ten-day-reports",
          `每10天工地報告無逾期 (逾期 ${overdueTenDay} 期)`,
          overdueTenDay === 0
        );
      }
    }
    if (stage3On) {
      check(
        "schedule",
        `時間表最少填寫 70% (目前 ${Math.round(scheduleRatio * 100)}%)`,
        scheduleRatio >= 0.7
      );
    }
    if (stageFinalOn && designDocsRequired) {
      check("plan", "已上載最新「平面圖 8 Plan」", hasDoc(planId));
      check("detailed-drawing", "已上載「施工圖紙 Detailed Drawing」", hasDoc(detailedDrawingId));
      check("rendering", "已上載「效果圖 3D Rendering」", hasThreeDByProject.has(p.id));
      check("project-ppt", "已上載「項目ppt」", hasDoc(projectPptId));
    }
    if (stage4On) {
      // Match evaluateExpenseControl: internal review only required when >1 real BV handlers.
      const realHandlerCount = p.bubble_id
        ? (realBvHandlersByBubble.get(String(p.bubble_id))?.size ?? 0)
        : 0;
      const internalCommentPassed =
        hasInternalByProject.has(p.id) || realHandlerCount <= 1;
      check("internal-comment", "已填寫「內部評論」", internalCommentPassed);
      // Skip supplier-comment when no expense has a supplier_id yet (avoids
      // locking expense CRUD before a supplier exists to comment on).
      const supplierCommentPassed =
        hasSupplierByProject.has(p.id) || !hasExpenseSupplierByProject.has(p.id);
      check("supplier-comment", "已填寫「供應商評論」", supplierCommentPassed);
    }
    if (stageFollowUpOn) {
      if (designDocsRequired) {
        check("completion-photos", "已上載「完工相片」", hasDoc(completionPhotosId));
      }
      if (sizeAtLeast100k) {
        check("form-s3", "已上載「Form S3 Handover Report」", hasDoc(formS3Id));
      }
    }
    if (stageDefectOn && sizeAtLeast500k) {
      check(
        "customer-testimonial",
        "已上載「Testimonial Letter 推薦信」",
        hasCustomerDoc("testimonial")
      );
    }

    if (failed.length === 0) continue;

    if (options.idsOnly) {
      result.push({
        id: p.id,
        project_code: null,
        project_name: null,
        status: p.status,
        signed_date: null,
        size: null,
        project_size: projectSize,
        pm_name: null,
        customer_name: null,
        n_financial_year_id: null,
        financial_year_name: null,
        cost_centre_bu_code: null,
        service_type_name: null,
        project_type_name: null,
        est_income: totalAmount,
        expense_count: 0,
        tier,
        failedItems: failed,
        failedKeys,
        passedCount,
        activeItemCount,
      });
      continue;
    }

    const cust = p.customer_id ? custById.get(p.customer_id) : null;
    result.push({
      id: p.id,
      project_code: p.project_code,
      project_name: p.project_name,
      status: p.status,
      signed_date: p.signed_date,
      size: p.size ?? null,
      project_size: projectSize,
      pm_name: p.main_pm_id ? (staffName.get(p.main_pm_id) ?? null) : null,
      customer_name:
        p.real_customer_display_name || cust?.customer_name || cust?.company_name || null,
      n_financial_year_id: p.n_financial_year_id ?? null,
      financial_year_name: p.n_financial_year_id
        ? (fyName.get(p.n_financial_year_id) ?? null)
        : null,
      cost_centre_bu_code: p.cost_centre_id ? (ccBu.get(p.cost_centre_id) ?? null) : null,
      service_type_name: p.n_service_type_id ? (stName.get(p.n_service_type_id) ?? null) : null,
      project_type_name: (() => {
        const ids = ptIdsByProject.get(p.id) ?? [];
        if (ids.length === 0) return null;
        return ids.map((id) => ptName.get(id)).filter(Boolean).join(", ") || null;
      })(),
      est_income: totalAmount,
      expense_count: expenseCount.get(p.id) || 0,
      tier,
      failedItems: failed,
      failedKeys,
      passedCount,
      activeItemCount,
    });
  }

  return result;
}

/**
 * /reports/aug14-deadline — projects whose Site Status is below 90%.
 *
 * Include when ALL hold (same applicability as Expense Control Site Status):
 *   1. service type has site_status_required
 *   2. at least one linked project type has site_status_required
 *   3. project_size ≥ $250-500K中小型 (resolveBwaProjectSize; not raw income &gt;)
 *   4. Site Status completion &lt; 90%
 *
 * Completion % matches Expense Control / evaluateExpenseControl:
 * filled answers ÷ active questionnaire questions for the project's
 * quote_project_type branch (no site_statuses row → 0%).
 */
export async function fetchMissingSiteStatusDeadlineProjects(
  supabaseAdmin: AdminSupabase,
  options: { mainPmId?: string } = {}
): Promise<ExpenseLockedRow[]> {
  const [
    requiredServiceTypes,
    requiredProjectTypes,
    finYears,
    costCentres,
    ssSections,
    ssQuestions,
    ssMap,
  ] = await Promise.all([
    supabaseAdmin
      .from("service_types")
      .select("id, display")
      .eq("site_status_required", true),
    supabaseAdmin
      .from("project_types")
      .select("id, display, chin_display")
      .eq("site_status_required", true),
    fetchAll(supabaseAdmin, "financial_years", "id, display"),
    fetchAll(supabaseAdmin, "cost_centres", "id, bu_code"),
    fetchAll(supabaseAdmin, "site_status_sections", "id, is_active"),
    fetchAll(supabaseAdmin, "site_status_questions", "id, section_id, is_active"),
    fetchAll(supabaseAdmin, "site_status_question_project_types", "question_id, quote_project_type_id"),
  ]);

  if (requiredServiceTypes.error) {
    throw new Error(`service_types: ${requiredServiceTypes.error.message}`);
  }
  if (requiredProjectTypes.error) {
    throw new Error(`project_types: ${requiredProjectTypes.error.message}`);
  }

  const requiredStIds = (requiredServiceTypes.data ?? []).map((r) => r.id as string);
  const requiredPtIds = (requiredProjectTypes.data ?? []).map((r) => r.id as string);
  if (requiredStIds.length === 0 || requiredPtIds.length === 0) return [];

  const stName = new Map(
    (requiredServiceTypes.data ?? []).map((s) => [s.id as string, s.display as string | null])
  );
  const ptName = new Map(
    (requiredProjectTypes.data ?? []).map((t) => [
      t.id as string,
      (t.chin_display || t.display) as string | null,
    ])
  );
  const fyName = new Map(finYears.map((f) => [f.id, f.display]));
  const ccBu = new Map(costCentres.map((c) => [c.id, c.bu_code]));

  // Same questionnaire branch model as evaluateBulkExpenseLockedProjects /
  // expense-control-service siteStatusCompletion.
  const activeQuestionIds = new Set(ssQuestions.filter((q) => q.is_active).map((q) => q.id));
  const typesByQ = new Map<string, string[]>();
  for (const m of ssMap) {
    if (!activeQuestionIds.has(m.question_id)) continue;
    const arr = typesByQ.get(m.question_id) ?? [];
    arr.push(m.quote_project_type_id);
    typesByQ.set(m.question_id, arr);
  }
  const activeSectionIds = new Set(ssSections.filter((s) => s.is_active).map((s) => s.id));
  const questionsList = ssQuestions
    .filter((q) => q.is_active && q.section_id && activeSectionIds.has(q.section_id))
    .map((q) => ({ id: q.id as string, typeIds: typesByQ.get(q.id) ?? [] }));

  const cols =
    "id, project_code, project_name, status, signed_date, estimated_income, project_size, size, real_customer_display_name, main_pm_id, customer_id, n_financial_year_id, n_service_type_id, cost_centre_id, quote_project_type_id";

  const projects: any[] = [];
  let page = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Size gate is applied in JS via resolveBwaProjectSize + isBwaProjectSizeAtLeast
    // (same as Expense Control) — do not use estimated_income > 250000 here, or
    // exact-$250k rows and stored project_size overrides are wrongly excluded.
    let q = supabaseAdmin
      .from("bwa_projects")
      .select(cols)
      .in("n_service_type_id", requiredStIds);

    if (options.mainPmId) {
      q = q.eq("main_pm_id", options.mainPmId);
    }

    const { data, error } = await q
      .order("id", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(`bwa_projects: ${error.message}`);
    projects.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) break;
    page++;
  }

  if (projects.length === 0) return [];

  const projIds = projects.map((p) => p.id as string);
  const projIdSet = new Set(projIds);
  const customerIds = [
    ...new Set(
      projects.map((p) => p.customer_id as string | null).filter((id): id is string => !!id)
    ),
  ];
  const pmIds = [
    ...new Set(
      projects.map((p) => p.main_pm_id as string | null).filter((id): id is string => !!id)
    ),
  ];

  const [projectTypeJunction, siteStatusRows, staff, customers, waivedSiteStatusByProject] =
    await Promise.all([
      fetchByIn(
        supabaseAdmin,
        "bwa_project_project_types",
        "project_id, project_type_id",
        "project_id",
        projIds
      ),
      fetchByIn(supabaseAdmin, "site_statuses", "id, project_id", "project_id", projIds),
      fetchByIn(supabaseAdmin, "staff", "id, name", "id", pmIds),
      fetchByIn(supabaseAdmin, "customers", "id, customer_name, company_name", "id", customerIds),
      fetchApprovedWaiverKeysByProject(projIds, supabaseAdmin as any),
    ]);

  const ssIds = siteStatusRows.map((r) => r.id as string).filter(Boolean);
  const ssAnswers = await fetchByIn(
    supabaseAdmin,
    "site_status_answers",
    "site_status_id, question_id, value",
    "site_status_id",
    ssIds
  );

  const requiredPtSet = new Set(requiredPtIds);
  /** First site_status_required project-type id per project (for display). */
  const requiredPtIdByProject = new Map<string, string>();
  for (const r of projectTypeJunction) {
    if (!r.project_id || !r.project_type_id) continue;
    const pid = String(r.project_id);
    const ptid = String(r.project_type_id);
    if (requiredPtSet.has(ptid) && !requiredPtIdByProject.has(pid)) {
      requiredPtIdByProject.set(pid, ptid);
    }
  }

  const ssIdByProject = new Map<string, string>();
  for (const r of siteStatusRows) {
    if (r.project_id && projIdSet.has(String(r.project_id))) {
      ssIdByProject.set(String(r.project_id), r.id);
    }
  }

  const isFilled = (v: any) => v != null && v !== "" && (!Array.isArray(v) || v.length > 0);
  const filledByss = new Map<string, Set<string>>();
  for (const a of ssAnswers) {
    if (!isFilled(a.value)) continue;
    const set = filledByss.get(a.site_status_id) ?? new Set<string>();
    set.add(a.question_id);
    filledByss.set(a.site_status_id, set);
  }

  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const custById = new Map(customers.map((c) => [c.id, c]));

  const result: ExpenseLockedRow[] = [];
  for (const p of projects) {
    const matchedPtId = requiredPtIdByProject.get(p.id);
    if (!matchedPtId) continue;

    const totalAmount = Number(p.estimated_income ?? 0);
    const projectSize = resolveBwaProjectSize(p.project_size, totalAmount);
    // Same size gate as expense-control-service siteStatusRequired.
    if (!projectSize || !isBwaProjectSizeAtLeast(projectSize, "$250-500K中小型")) {
      continue;
    }

    // Identical to Expense Control Site Status %:
    // branch questions (no type map = all types) × filled answers / total.
    const ssId = ssIdByProject.get(p.id);
    const branchQuestions = questionsList.filter(
      (q) =>
        q.typeIds.length === 0 ||
        (p.quote_project_type_id != null && q.typeIds.includes(p.quote_project_type_id))
    );
    let siteCompletion = 0;
    if (ssId && branchQuestions.length > 0) {
      const filled = filledByss.get(ssId) ?? new Set<string>();
      const filledCount = branchQuestions.filter((q) => filled.has(q.id)).length;
      siteCompletion = filledCount / branchQuestions.length;
    }
    if (siteCompletion >= 0.9) continue;

    // Approved Expense Control waiver for site-status → not on the deadline list.
    const waivedKeys = waivedSiteStatusByProject.get(p.id);
    if (waivedKeys?.has("site-status")) continue;

    const tier: "high" | "mid" = "high";
    const cust = p.customer_id ? custById.get(p.customer_id) : null;
    const displayPtId = matchedPtId;
    const pctLabel = `工地狀況 Site Status 最少填寫 90% (目前 ${Math.round(siteCompletion * 100)}%)`;

    result.push({
      id: p.id,
      project_code: p.project_code,
      project_name: p.project_name,
      status: p.status,
      signed_date: p.signed_date,
      size: p.size ?? null,
      project_size: projectSize,
      pm_name: p.main_pm_id ? (staffName.get(p.main_pm_id) ?? null) : null,
      customer_name:
        p.real_customer_display_name || cust?.customer_name || cust?.company_name || null,
      n_financial_year_id: p.n_financial_year_id ?? null,
      financial_year_name: p.n_financial_year_id
        ? (fyName.get(p.n_financial_year_id) ?? null)
        : null,
      cost_centre_bu_code: p.cost_centre_id ? (ccBu.get(p.cost_centre_id) ?? null) : null,
      service_type_name: p.n_service_type_id ? (stName.get(p.n_service_type_id) ?? null) : null,
      project_type_name: ptName.get(displayPtId) ?? null,
      est_income: totalAmount,
      expense_count: 0,
      tier,
      failedItems: [pctLabel],
      failedKeys: ["site-status"],
      passedCount: 0,
      activeItemCount: 1,
    });
  }

  return result;
}
