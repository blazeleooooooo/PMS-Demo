import { supabase } from "@/lib/supabase";
import { fetchSiteStatus, fetchQuestionnaire, fetchAnswers } from "@/lib/site-status-service";
import { fetchDefaultScheduleTasks, fetchProjectProjectTypeIds } from "@/lib/data-service";
import {
  isBwaProjectSizeAtLeast,
  resolveBwaProjectSize,
  type BwaProjectSizeLabel,
} from "@/lib/bwa-project-size";
import {
  fetchApprovedWaiverKeys,
  INSTALLMENT_VS_INCOME_ITEM_KEY,
  OVERDUE_INCOME_EXPECTED_DATE_ITEM_KEY,
} from "@/lib/expense-control-waiver-service";
import { customerHasDocumentType } from "@/lib/data/customer-documents";
import {
  countOverdueTenDayReports,
  fetchWeeklyReports,
} from "@/lib/data/weekly-reports";
import {
  countOverdueIncomesMissingExpectedDate,
  formatMoney,
  overdueIncomeExpectedDateItemLabel,
} from "@/lib/date-utils";

// ============================================================
// Expense Control (出支票受限) — checklist evaluator.
//
// Determines whether a BWA project has completed the data entry required
// before its Expense (出支票) function may be used. Returns a checklist of
// items; if any APPLICABLE item is not passed, expense is restricted.
//
// Applicability by project_size (bwa_projects.project_size):
//   小於$30K          → no restriction
//   $30-100K微型+     → checklist applies (item-level size/service gates below)
//
// Several items are progress-, size-, or service-gated — they only become
// APPLICABLE once that gate has passed.
// ============================================================

// The "company" BV row uses a fixed handler id. It represents the company
// itself rather than a real staff member, so it doesn't count as a person who
// could meaningfully give/receive an internal review.
const COMPANY_BV_HANDLER_ID = "00000000-0000-4000-8000-000000000001";

/** Service types that require design deliverable docs in 尾期檢查. */
const DESIGN_DOC_SERVICE_TYPES = new Set(["Design and Build", "Design Only"]);

function formatTypeList(names: string[]): string {
  return names.length > 0 ? names.join("、") : "（尚未設定）";
}

/**
 * Human-readable applicability rules for the Site Status ≥ 90% checklist item.
 * Required only when ALL three gates pass (same as aug14-deadline / bulk).
 * Lists every service/project type currently flagged site_status_required.
 */
function buildSiteStatusApplicabilityRule(
  requiredServiceTypes: string[],
  requiredProjectTypes: string[]
): string {
  return [
    "適用條件（須全部符合）：",
    "① 項目規模 ≥ $250-500K中小型",
    `② 服務類型須為以下「需填工地狀況」之一（設定 → 服務類型）：${formatTypeList(requiredServiceTypes)}`,
    `③ 項目類型至少一項須為以下「需填工地狀況」之一（設定 → 項目類型）：${formatTypeList(requiredProjectTypes)}`,
  ].join("\n");
}

function buildSiteStatusHint(opts: {
  required: boolean;
  sizeOk: boolean;
  serviceOk: boolean;
  projectTypeOk: boolean;
  requiredServiceTypes: string[];
  requiredProjectTypes: string[];
}): string {
  const rule = buildSiteStatusApplicabilityRule(
    opts.requiredServiceTypes,
    opts.requiredProjectTypes
  );
  if (opts.required) {
    return `${rule}\n問卷需填寫達 90% 以上。`;
  }
  const gaps: string[] = [];
  if (!opts.sizeOk) gaps.push("項目規模未達 $250-500K中小型");
  if (!opts.serviceOk) gaps.push("服務類型未標記「需填工地狀況」");
  if (!opts.projectTypeOk) gaps.push("所選項目類型均未標記「需填工地狀況」");
  return `${rule}\n此項目不適用：${gaps.join("；") || "條件未齊"}。`;
}

export type ExpenseControlTier = "high" | "mid" | "none";

export interface ExpenseControlItemMeta {
  /** Doc types still missing for multi-doc checks. */
  missingDocTypeIds?: string[];
  /** First missing doc type — used to pre-fill the upload dialog. */
  firstMissingDocTypeId?: string | null;
}

export interface ExpenseControlItem {
  key: string;
  label: string;        // Chinese label
  labelEn: string;
  passed: boolean;      // is the requirement satisfied?
  /**
   * false = size/service gate not met — shown as 不適用 (does not block).
   * Omit / true = normal checklist item.
   */
  applicable?: boolean;
  hint?: string;        // short explanation shown when failed
  meta?: ExpenseControlItemMeta;
}

// A stage of checks. The whole section only "turns on" once its gate condition
// is met; until then its items are not evaluated for restriction.
export interface ExpenseControlSection {
  key: string;
  title: string;        // Chinese title
  titleEn: string;
  active: boolean;      // gate condition met → this stage's checks are live
  gateHint: string;     // explains when the stage turns on
  items: ExpenseControlItem[];
}

export interface ExpenseControlResult {
  tier: ExpenseControlTier;
  totalAmount: number;
  /** Resolved project_size label used for gates (stored or income-derived). */
  projectSize: BwaProjectSizeLabel | null;
  /** Raw `bwa_projects.project_size` before income fallback (may be null/invalid). */
  storedProjectSize: string | null;
  sections: ExpenseControlSection[];
  /** False when the project's cost centre has expense_control_enabled = false. */
  applicable: boolean;
  /** Human-readable BU code when excluded by cost centre (for UI). */
  costCentreBuCode?: string | null;
  // Restricted when any item in an ACTIVE section is not passed.
  restricted: boolean;
  // Counts over items in ACTIVE sections only.
  passedCount: number;
  activeItemCount: number;
  /** Checklist keys with an approved expense-control waiver (do not block lock). */
  waivedItemKeys: string[];
}

function excludedByCostCentreResult(
  tier: ExpenseControlTier,
  totalAmount: number,
  projectSize: BwaProjectSizeLabel | null,
  storedProjectSize: string | null,
  costCentreBuCode: string | null
): ExpenseControlResult {
  return {
    tier,
    totalAmount,
    projectSize,
    storedProjectSize,
    sections: [],
    applicable: false,
    costCentreBuCode,
    restricted: false,
    passedCount: 0,
    activeItemCount: 0,
    waivedItemKeys: [],
  };
}

// A date string is "reached" when it is today or in the past (date-only compare).
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

// Site physical completion ratio (0–1), interpolated linearly between the
// start date and the handover date: (today − start) / (handover − start),
// clamped to [0,1]. Returns null when the dates are missing/invalid.
export function siteCompletionRatio(start: string | null | undefined, handover: string | null | undefined): number | null {
  if (!start || !handover) return null;
  const s = new Date(start).getTime();
  const h = new Date(handover).getTime();
  if (isNaN(s) || isNaN(h) || h <= s) return null;
  const ratio = (Date.now() - s) / (h - s);
  return Math.max(0, Math.min(1, ratio));
}

type DocTypeRow = { id: string; display: string | null; is_project_initial_doc: boolean | null };

function findDocTypeId(rows: DocTypeRow[], ...patterns: string[]): string | null {
  return (
    rows.find(
      (r) =>
        r.display &&
        patterns.some((p) => r.display!.toLowerCase().includes(p.toLowerCase()))
    )?.id ?? null
  );
}

/** Project-scoped nos_doc_types only (BR / Form S1 / Testimonial → customer_documents). */
async function resolveProjectDocTypeIds(): Promise<{
  insurance: string | null;
  plan: string | null;
  detailedDrawing: string | null;
  projectPpt: string | null;
  completionPhotos: string | null;
  formS3: string | null;
}> {
  const { data } = await supabase
    .from("nos_doc_types")
    .select("id, display, is_project_initial_doc");
  const rows = (data ?? []) as DocTypeRow[];
  return {
    insurance: findDocTypeId(rows, "工地保險", "site work insurance"),
    plan: findDocTypeId(rows, "平面圖", "8 plan"),
    detailedDrawing: findDocTypeId(rows, "施工圖紙", "detailed drawing"),
    projectPpt: findDocTypeId(rows, "項目ppt"),
    completionPhotos: findDocTypeId(rows, "完工相片"),
    formS3: findDocTypeId(rows, "form s3"),
  };
}

function hasRenderImage(image: string | null | undefined): boolean {
  return !!image && image.trim() !== "";
}

/** True when the project has ≥1 3D render image (direct project_id or via collection). */
async function hasProjectThreeDRendering(projectId: string): Promise<boolean> {
  const [{ data: direct }, { data: cols }] = await Promise.all([
    supabase
      .from("three_d_renders")
      .select("id, image")
      .eq("project_id", projectId)
      .limit(20),
    supabase.from("three_d_collections").select("id").eq("r_project_id", projectId),
  ]);
  if ((direct ?? []).some((r: { image: string | null }) => hasRenderImage(r.image))) {
    return true;
  }
  const colIds = (cols ?? []).map((c: { id: string }) => c.id);
  if (colIds.length === 0) return false;
  const { data: viaCol } = await supabase
    .from("three_d_renders")
    .select("id, image")
    .in("r_3d_collection_id", colIds)
    .limit(50);
  return (viaCol ?? []).some((r: { image: string | null }) => hasRenderImage(r.image));
}

// Site Status completion ratio (0–1): filled answers / total questions for the
// project's questionnaire branch.
async function siteStatusCompletion(projectId: string, quoteProjectTypeId: string | null): Promise<number> {
  const ss = await fetchSiteStatus(projectId);
  if (!ss) return 0;
  const [sections, answers] = await Promise.all([
    fetchQuestionnaire(quoteProjectTypeId),
    fetchAnswers(ss.id),
  ]);
  const questions = sections.flatMap((s) => s.questions);
  if (questions.length === 0) return 0;
  const isFilled = (v: any) =>
    v != null && v !== "" && (!Array.isArray(v) || v.length > 0);
  const filled = questions.filter((q) => isFilled(answers[q.id])).length;
  return filled / questions.length;
}

function tierFromProjectSize(projectSize: BwaProjectSizeLabel | null): ExpenseControlTier {
  if (!projectSize || projectSize === "小於$30K") return "none";
  if (isBwaProjectSizeAtLeast(projectSize, "$250-500K中小型")) return "high";
  return "mid";
}

export async function evaluateExpenseControl(projectId: string): Promise<ExpenseControlResult> {
  // Pull the project fields we need directly so the evaluator is self-contained.
  const { data: proj } = await supabase
    .from("bwa_projects")
    .select("bubble_id, customer_id, estimated_income, project_size, signed_date, start_date, handover_date, defect_done_date, main_contractor, main_contractor_id, quote_project_type_id, n_service_type_id, os_schedule_group, cost_centre_id")
    .eq("id", projectId)
    .maybeSingle();

  const totalAmount = Number(proj?.estimated_income ?? 0);
  const storedProjectSize =
    typeof proj?.project_size === "string" ? proj.project_size : null;
  const projectSize = resolveBwaProjectSize(storedProjectSize, totalAmount);
  const tier = tierFromProjectSize(projectSize);

  // Cost centre exclusion — only BUs flagged expense_control_enabled participate.
  if (proj?.cost_centre_id) {
    const { data: cc } = await supabase
      .from("cost_centres")
      .select("expense_control_enabled, bu_code")
      .eq("id", proj.cost_centre_id)
      .maybeSingle();
    if (cc?.expense_control_enabled === false) {
      return excludedByCostCentreResult(
        tier,
        totalAmount,
        projectSize,
        storedProjectSize,
        cc.bu_code ?? null
      );
    }
  }

  // ── Stage gate conditions ──
  // Stage 1 (Initial) is always on. Stage 2 turns on at the start date.
  // Stage 3 (Early Stage) turns on at 工地進度 ≥ 40%, interpolated between
  // start and handover dates. Stage 4 (尾期) at ≥ 75%. Stage 5 (交場) at ≥ 90%.
  // Stage 6 (後續) turns on at handover date + 7 days.
  // Section 8 (執漏) turns on once defect_done_date is today or in the past.
  const completion = siteCompletionRatio(proj?.start_date, proj?.handover_date);
  const stage2On = dateReached(proj?.start_date);
  const stage3On = completion != null && completion >= 0.4;
  const stageFinalOn = completion != null && completion >= 0.75;
  const stage4On = completion != null && completion >= 0.9;
  const stageFollowUpOn = dateReachedAfterDays(proj?.handover_date, 7);
  const stageDefectOn = dateReached(proj?.defect_done_date);

  // 小於$30K: never restricted, empty checklist.
  if (tier === "none") {
    return {
      tier,
      totalAmount,
      projectSize,
      storedProjectSize,
      sections: [],
      applicable: true,
      restricted: false,
      passedCount: 0,
      activeItemCount: 0,
      waivedItemKeys: [],
    };
  }

  const sizeAtLeast100k = isBwaProjectSizeAtLeast(projectSize, "$100-250K小型");
  const sizeAtLeast250k = isBwaProjectSizeAtLeast(projectSize, "$250-500K中小型");
  const sizeAtLeast500k = isBwaProjectSizeAtLeast(projectSize, "$500K-$1M中型");

  // Gather supporting data in parallel.
  const docIds = await resolveProjectDocTypeIds();
  const docTypeIds = [
    docIds.insurance,
    docIds.plan,
    docIds.detailedDrawing,
    docIds.projectPpt,
    docIds.completionPhotos,
    docIds.formS3,
  ].filter(Boolean) as string[];

  const customerId = proj?.customer_id as string | null | undefined;

  const [
    docRes,
    hasCustomerBr,
    hasCustomerFormS1,
    hasCustomerTestimonial,
    siteCompletion,
    scheduleTasks,
    internalRes,
    supplierRes,
    expenseSupplierRes,
    projectTypeIds,
    bvRes,
    serviceTypeRes,
    hasThreeD,
    requiredServiceTypesRes,
    requiredProjectTypesRes,
    weeklyReports,
    expenseAmountsRes,
    incomeAmountsRes,
  ] = await Promise.all([
    docTypeIds.length
      ? supabase.from("project_documents").select("doc_type_id").eq("project_id", projectId).in("doc_type_id", docTypeIds)
      : Promise.resolve({ data: [] as any[] }),
    customerId ? customerHasDocumentType(customerId, "br") : Promise.resolve(false),
    customerId ? customerHasDocumentType(customerId, "form_s1") : Promise.resolve(false),
    customerId ? customerHasDocumentType(customerId, "testimonial") : Promise.resolve(false),
    siteStatusCompletion(projectId, proj?.quote_project_type_id ?? null),
    // Reuse the Work Schedule tab's data source so progress matches the
    // "預設任務完成進度" bar exactly.
    proj?.os_schedule_group
      ? fetchDefaultScheduleTasks(proj.os_schedule_group, projectId, "working", "bwa_project")
      : Promise.resolve([]),
    supabase.from("internal_comments").select("id").eq("project_id", projectId).not("comment", "is", null).limit(1),
    supabase.from("staff_supplier_comments").select("id").eq("project_id", projectId).limit(1),
    // Supplier comments are written against suppliers that appear on expenses.
    // If no expense has a supplier_id yet, the check must not block expense CRUD
    // (otherwise users cannot add a supplier via the expense dialog).
    supabase
      .from("expenses")
      .select("id")
      .eq("project_id", projectId)
      .not("supplier_id", "is", null)
      .limit(1),
    fetchProjectProjectTypeIds(projectId),
    proj?.bubble_id
      ? supabase.from("project_bv").select("handler_id").eq("project", proj.bubble_id)
      : Promise.resolve({ data: [] as { handler_id: string | null }[] }),
    proj?.n_service_type_id
      ? supabase
          .from("service_types")
          .select("site_status_required, display")
          .eq("id", proj.n_service_type_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { site_status_required: boolean | null; display: string | null } | null }),
    hasProjectThreeDRendering(projectId),
    supabase
      .from("service_types")
      .select("display")
      .eq("site_status_required", true)
      .order("display"),
    supabase
      .from("project_types")
      .select("display")
      .eq("site_status_required", true)
      .order("display"),
    fetchWeeklyReports(projectId),
    supabase
      .from("expenses")
      .select("installment_amount")
      .eq("project_id", projectId),
    supabase
      .from("incomes")
      .select("income_amount, due_date, expected_payment_date, payment_status")
      .eq("project_id", projectId),
  ]);

  const expenseInstallmentSum = (expenseAmountsRes.data ?? []).reduce(
    (sum, row: { installment_amount: number | null }) =>
      sum + Number(row.installment_amount ?? 0),
    0
  );
  const incomeAmountSum = (incomeAmountsRes.data ?? []).reduce(
    (sum, row: { income_amount: number | null }) =>
      sum + Number(row.income_amount ?? 0),
    0
  );
  const installmentWithinIncome = expenseInstallmentSum <= incomeAmountSum;
  const overdueIncomeMissingExpectedCount = countOverdueIncomesMissingExpectedDate(
    incomeAmountsRes.data ?? []
  );

  // Align with 10 Day's Report tab「逾期」: past periods with no report row.
  const tenDayDatesReady = !!proj?.start_date && !!proj?.handover_date;
  const overdueTenDayCount = tenDayDatesReady
    ? countOverdueTenDayReports(
        proj?.start_date,
        proj?.handover_date,
        weeklyReports.map((r) => r.week_number)
      )
    : 0;

  const uploadedDocTypes = new Set((docRes.data ?? []).map((r: any) => r.doc_type_id));
  const hasDoc = (id: string | null) => !!id && uploadedDocTypes.has(id);

  // ── Conditional Site Status requirement ──
  // Required when ALL hold:
  //   1. ONE of its project types is flagged site_status_required (OR), AND
  //   2. its service type is flagged site_status_required, AND
  //   3. project_size ≥ $250-500K中小型 (Mini / &lt;$250k bands are exempt).
  let anyProjectTypeRequired = false;
  if (projectTypeIds.length > 0) {
    const { data: ptFlags } = await supabase
      .from("project_types")
      .select("site_status_required")
      .in("id", projectTypeIds);
    anyProjectTypeRequired = (ptFlags ?? []).some((r: any) => r.site_status_required === true);
  }
  const serviceTypeRequired = serviceTypeRes.data?.site_status_required === true;
  const serviceTypeDisplay = (serviceTypeRes.data?.display || "").trim();
  const designDocsRequired = DESIGN_DOC_SERVICE_TYPES.has(serviceTypeDisplay);
  const siteStatusRequired =
    anyProjectTypeRequired && serviceTypeRequired && sizeAtLeast250k;
  const requiredServiceTypes = (requiredServiceTypesRes.data ?? [])
    .map((r: { display: string | null }) => (r.display || "").trim())
    .filter(Boolean);
  const requiredProjectTypes = (requiredProjectTypesRes.data ?? [])
    .map((r: { display: string | null }) => (r.display || "").trim())
    .filter(Boolean);
  const siteStatusHint = buildSiteStatusHint({
    required: siteStatusRequired,
    sizeOk: sizeAtLeast250k,
    serviceOk: serviceTypeRequired,
    projectTypeOk: anyProjectTypeRequired,
    requiredServiceTypes,
    requiredProjectTypes,
  });

  // Work-schedule progress — identical formula to SchedulePanel's
  // getDefaultStageStats / "預設任務完成進度": a task is "completed" when it has a
  // date OR is marked N/A; progress = completed / total default tasks.
  const totalSchedule = scheduleTasks.length;
  const completedSchedule = scheduleTasks.filter((t) => t.is_na || !!t.date).length;
  const scheduleRatio = totalSchedule > 0 ? completedSchedule / totalSchedule : 0;

  const hasInternalComment = (internalRes.data ?? []).length > 0;
  const hasSupplierComment = (supplierRes.data ?? []).length > 0;
  const hasExpenseSupplier = (expenseSupplierRes.data ?? []).length > 0;

  // ── Internal Review applicability ──
  // The internal review is only meaningful when there is more than one real
  // person on the project. The "company" BV row is not a person. So if the
  // project's BV has only the company plus a single staff member (i.e. just the
  // main PM commenting on himself), the internal review check is pointless and
  // should NOT block expense control.
  const distinctRealHandlers = new Set(
    (bvRes.data ?? [])
      .map((r) => r.handler_id)
      .filter((id): id is string => !!id && id !== COMPANY_BV_HANDLER_ID)
  );
  const internalCommentRequired = distinctRealHandlers.size > 1;
  // When not required, treat the item as passed so it never blocks.
  const internalCommentPassed = hasInternalComment || !internalCommentRequired;

  // ── Supplier Comment applicability ──
  // Mirror SupplierCommentPanel: only expenses with a supplier_id produce
  // comment targets. With none, skip the check so expense create/edit stays open.
  const supplierCommentRequired = hasExpenseSupplier;
  const supplierCommentPassed = hasSupplierComment || !supplierCommentRequired;

  const docItem = (
    key: string,
    label: string,
    labelEn: string,
    docTypeId: string | null,
    hint: string,
    applicable = true
  ): ExpenseControlItem => ({
    key,
    label,
    labelEn,
    // Keep real validation even when N/A so the UI can show check vs cross.
    passed: hasDoc(docTypeId),
    applicable,
    hint,
    meta: { firstMissingDocTypeId: docTypeId },
  });

  const customerDocItem = (
    key: string,
    label: string,
    labelEn: string,
    passed: boolean,
    hint: string,
    applicable = true
  ): ExpenseControlItem => ({
    key,
    label,
    labelEn,
    passed,
    applicable,
    hint,
  });

  const sections: ExpenseControlSection[] = [
    {
      key: "initial",
      title: "初步檢查 Initial",
      titleEn: "Initial Checks",
      active: true,
      gateHint: "項目建立後即時生效",
      items: [
        {
          key: "dates",
          label: "已填寫開工日及交場日",
          labelEn: "Start Date & Handover Date set",
          passed: !!proj?.start_date && !!proj?.handover_date,
          hint: "需填寫開工日 (Start Date) 及交場日 (Handover Date)",
        },
        {
          key: INSTALLMENT_VS_INCOME_ITEM_KEY,
          label: "支出總額不大於收入總額",
          labelEn: "Expense total ≤ income total",
          passed: installmentWithinIncome,
          hint: `相關支出總額合計 ${formatMoney(expenseInstallmentSum, { showZero: true })} 不可大於相關收入總額合計 ${formatMoney(incomeAmountSum, { showZero: true })}`,
        },
        {
          key: OVERDUE_INCOME_EXPECTED_DATE_ITEM_KEY,
          label: overdueIncomeExpectedDateItemLabel(overdueIncomeMissingExpectedCount),
          labelEn: "Overdue incomes have expected payment date",
          passed: overdueIncomeMissingExpectedCount === 0,
          hint: "到期日已過且未收款的收入必須填寫預計收款日期 Expected Payment Date，否則無法新增/編輯支出。收款狀態為 Received 的收入除外。",
        },
      ],
    },
    {
      key: "started",
      title: "開工檢查 Project Started",
      titleEn: "Project Started Checks",
      active: stage2On,
      gateHint: "開工日 (Start Date) 後生效",
      items: [
        customerDocItem(
          "customer-br",
          "已上載「BR 商業登記證」",
          "Customer BR uploaded",
          hasCustomerBr,
          customerId ? "須於客戶文件上載 BR 商業登記證" : "須先關聯客戶並上載 BR 商業登記證"
        ),
        customerDocItem(
          "customer-form-s1",
          "已上載「Form S1 - BW Start Project Form」",
          "Customer Form S1 uploaded",
          hasCustomerFormS1,
          customerId
            ? "須於客戶文件上載 Form S1（項目規模 $100-250K小型 或以上）"
            : "須先關聯客戶並上載 Form S1",
          sizeAtLeast100k
        ),
        docItem(
          "insurance",
          "已上載「Site Work Insurance 工地保險」",
          "Site Work Insurance uploaded",
          docIds.insurance,
          "須上載工地保險"
        ),
        {
          key: "main-contractor",
          label: "已填寫主要承包商 Main Contractor",
          labelEn: "Main Contractor set",
          passed: !!proj?.main_contractor_id,
          hint: "須填寫主要承包商",
        },
        {
          key: "site-status",
          label: `工地狀況 Site Status 最少填寫 90% (目前 ${Math.round(siteCompletion * 100)}%)`,
          labelEn: "Site Status ≥ 90% complete",
          passed: siteCompletion >= 0.9,
          applicable: siteStatusRequired,
          hint: siteStatusHint,
        },
      ],
    },
    {
      key: "ten-day",
      title: "每10天檢查 10 Day's Report",
      titleEn: "10-Day Report Checks",
      active: stage2On,
      gateHint: "開工日 (Start Date) 後生效",
      items: [
        {
          key: "ten-day-reports",
          label: tenDayDatesReady
            ? `每10天工地報告無逾期 (逾期 ${overdueTenDayCount} 期)`
            : "每10天工地報告無逾期",
          labelEn: "No overdue 10-day reports",
          passed: overdueTenDayCount === 0,
          applicable: tenDayDatesReady,
          hint: tenDayDatesReady
            ? "過往期次須已完成每10天工地報告（與「10 Day's Report」分頁「逾期」一致；本期除外）。可申請豁免令此項目無需每10天報告。"
            : "須先填寫開工日及交場日才能產生每10天報告時間表",
        },
      ],
    },
    {
      key: "early-stage",
      title: "初期檢查 Early Stage",
      titleEn: "Early Stage Checks",
      active: stage3On,
      gateHint: "工地進度達 40% 後生效 (依開工日及交場日計算)",
      items: [
        {
          key: "schedule",
          label: `時間表最少填寫 70% (目前 ${Math.round(scheduleRatio * 100)}%)`,
          labelEn: "Work schedule ≥ 70% filled",
          passed: scheduleRatio >= 0.7,
          hint: "工地進度達 40% 後須填寫 70% 時間表",
        },
      ],
    },
    {
      key: "final-stage",
      title: "尾期檢查 Final Stage",
      titleEn: "Final Stage Checks",
      active: stageFinalOn,
      gateHint: "工地完成度 ≥ 75% 後生效 (依開工日及交場日計算)；僅 Design and Build / Design Only",
      items: [
        docItem("plan", "已上載最新「平面圖 8 Plan」", "Latest 8 Plan uploaded", docIds.plan, "須上載最新平面圖 8 Plan", designDocsRequired),
        docItem(
          "detailed-drawing",
          "已上載「施工圖紙 Detailed Drawing」",
          "Detailed Drawing uploaded",
          docIds.detailedDrawing,
          "須上載施工圖紙 Detailed Drawing",
          designDocsRequired
        ),
        {
          key: "rendering",
          label: "已上載「效果圖 3D Rendering」",
          labelEn: "3D Rendering uploaded",
          // Checked via three_d_collections / three_d_renders (not Docs).
          passed: hasThreeD,
          applicable: designDocsRequired,
          hint: "須於 3D Render 分頁上載效果圖",
        },
        docItem("project-ppt", "已上載「項目ppt」", "Project PPT uploaded", docIds.projectPpt, "須上載項目ppt", designDocsRequired),
      ],
    },
    {
      key: "handover",
      title: "交場檢查 Project Handover",
      titleEn: "Project Handover Checks",
      active: stage4On,
      gateHint: "工地完成度 ≥ 90% 後生效 (依開工日及交場日計算)",
      items: [
        {
          key: "internal-comment",
          label: "已填寫「內部評論」",
          labelEn: "Internal Review completed",
          passed: internalCommentPassed,
          hint: "須填寫內部評論",
        },
        {
          key: "supplier-comment",
          label: "已填寫「供應商評論」",
          labelEn: "Supplier Comment completed",
          passed: supplierCommentPassed,
          hint: supplierCommentRequired
            ? "須填寫供應商評論"
            : "支出尚未關聯供應商，暫無需填寫供應商評論",
        },
      ],
    },
    {
      key: "follow-up",
      title: "後續檢查 Follow-up",
      titleEn: "Follow-up Checks",
      active: stageFollowUpOn,
      gateHint: "交場日 (Handover Date) + 7 天後生效",
      items: [
        docItem(
          "completion-photos",
          "已上載「完工相片」",
          "Completion photos uploaded",
          docIds.completionPhotos,
          "須上載完工相片",
          designDocsRequired
        ),
        docItem(
          "form-s3",
          "已上載「Form S3 Handover Report」",
          "Form S3 Handover Report uploaded",
          docIds.formS3,
          "須上載 Form S3（項目規模 $100-250K小型 或以上）",
          sizeAtLeast100k
        ),
      ],
    },
    {
      key: "defect",
      title: "執漏檢查 Defect",
      titleEn: "Defect Checks",
      active: stageDefectOn,
      gateHint: "執漏完成日 (Defect Date) 後生效",
      items: [
        customerDocItem(
          "customer-testimonial",
          "已上載「Testimonial Letter 推薦信」",
          "Customer Testimonial uploaded",
          hasCustomerTestimonial,
          customerId
            ? "須於客戶文件上載推薦信（項目規模 $500K-$1M中型 或以上）"
            : "須先關聯客戶並上載推薦信",
          sizeAtLeast500k
        ),
      ],
    },
  ];

  // Restriction / counts ignore 不適用 items (applicable === false).
  // Approved waivers unlock failed items for locking only (UI still shows real pass/fail).
  const waivedItemKeys = await fetchApprovedWaiverKeys(projectId);
  const waivedSet = new Set(waivedItemKeys);
  const activeItems = sections.filter((s) => s.active).flatMap((s) => s.items);
  const countableItems = activeItems.filter((i) => i.applicable !== false);
  const passedCount = countableItems.filter(
    (i) => i.passed || waivedSet.has(i.key)
  ).length;
  const restricted = countableItems.some(
    (i) => !i.passed && !waivedSet.has(i.key)
  );

  return {
    tier,
    totalAmount,
    projectSize,
    storedProjectSize,
    sections,
    applicable: true,
    restricted,
    passedCount,
    activeItemCount: countableItems.length,
    waivedItemKeys,
  };
}
