import {
  supabase,
  safeQuery,
  logError,
  fetchAllByFk,
  mapBatchesParallel,
} from "@/lib/data/_core";
import { incomeNetOutstanding } from "@/lib/income-outstanding";
import { incomeStatusForCreateInsert } from "@/lib/income-payment-status";
import { expenseStatusForCreateInsert } from "@/lib/expense-payment-status";
import {
  hasIncomeBelowEstimatedReason,
  INCOME_BELOW_ESTIMATED_REASON_CLEARED_MESSAGE,
  INCOME_BELOW_ESTIMATED_REASON_REQUIRED_MESSAGE,
  isProjectIncomeBelowEstimated,
  normalizeIncomeBelowEstimatedReason,
  otherProjectIncomeTotal,
  projectIncomeBelowEstimatedMessage,
  projectIncomeDeleteBlockedMessage,
} from "@/lib/income-estimated-floor";
import { incomeCalendarDate, toHkYmd } from "@/lib/date-utils";
import { invoiceNumberPrefixFromDate, nextIssuedInvoiceNumber } from "@/lib/invoice-number";
import { attachExpectedPaymentDateLogHint } from "@/lib/expected-payment-date-log";
import { parsePdfBranding, type PdfBranding } from "@/lib/pdf-branding";

// ─── BWA PROJECT FINANCIALS (Incomes/Expenses aggregated by project) ────────

export interface ProjectFinancials {
  project_id: string;
  total_sales: number;      // sum of incomes.income_amount
  paid_sales: number;       // sum of incomes.payment_amount
  total_expense: number;    // sum of expenses.installment_amount
  paid_expense: number;     // sum of expenses.paid_amount
  /** Dominant unpaid income payment_status (for list progress views) */
  income_payment_status?: string | null;
}

export async function fetchProjectFinancials(projectIds: string[]): Promise<Record<string, ProjectFinancials>> {
  if (projectIds.length === 0) return {};

  return safeQuery(async () => {
    const result: Record<string, ProjectFinancials> = {};
    for (const pid of projectIds) {
      result[pid] = { project_id: pid, total_sales: 0, paid_sales: 0, total_expense: 0, paid_expense: 0 };
    }

    // SQL aggregation via RPC — one round trip per chunk instead of dozens of row scans.
    const RPC_CHUNK = 500;
    const chunks: string[][] = [];
    for (let i = 0; i < projectIds.length; i += RPC_CHUNK) {
      chunks.push(projectIds.slice(i, i + RPC_CHUNK));
    }

    const responses = await Promise.all(
      chunks.map(async (chunk) => {
        const { data, error } = await supabase.rpc("get_bwa_project_financials", {
          p_project_ids: chunk,
        });
        if (error) {
          logError("fetchProjectFinancials-rpc", error);
          return [] as any[];
        }
        return data ?? [];
      }),
    );

    for (const rows of responses) {
      for (const row of rows) {
        const pid = row.project_id as string;
        if (!pid || !result[pid]) continue;
        result[pid] = {
          project_id: pid,
          total_sales: Number(row.total_sales) || 0,
          paid_sales: Number(row.paid_sales) || 0,
          total_expense: Number(row.total_expense) || 0,
          paid_expense: Number(row.paid_expense) || 0,
        };
      }
    }

    return result;
  }, {}, "fetchProjectFinancials", 30000);
}

// ─── BWF PROJECT FINANCIALS (actual incomes & expenses) ─────────
// BWF actuals now live in the SAME shared incomes / expenses tables as BWA,
// keyed by bwf_project_id (the legacy bwf_incomes / bwf_*_expenses tables were
// retired). Identical paid/total semantics to fetchProjectFinancials.
export async function fetchBWFProjectFinancials(
  projectIds: string[]
): Promise<Record<string, ProjectFinancials>> {
  if (projectIds.length === 0) return {};

  return safeQuery(async () => {
    const result: Record<string, ProjectFinancials> = {};
    for (const pid of projectIds) {
      result[pid] = {
        project_id: pid,
        total_sales: 0,
        paid_sales: 0,
        total_expense: 0,
        paid_expense: 0,
        income_payment_status: null,
      };
    }

    // SQL aggregation via RPC — one round trip per chunk instead of dozens of row scans.
    const RPC_CHUNK = 500;
    const chunks: string[][] = [];
    for (let i = 0; i < projectIds.length; i += RPC_CHUNK) {
      chunks.push(projectIds.slice(i, i + RPC_CHUNK));
    }

    const responses = await Promise.all(
      chunks.map(async (chunk) => {
        const { data, error } = await supabase.rpc("get_bwf_project_financials", {
          p_project_ids: chunk,
        });
        if (error) {
          logError("fetchBWFProjectFinancials-rpc", error);
          return [] as any[];
        }
        return data ?? [];
      }),
    );

    for (const rows of responses) {
      for (const row of rows) {
        const pid = row.project_id as string;
        if (!pid || !result[pid]) continue;
        result[pid] = {
          project_id: pid,
          total_sales: Number(row.total_sales) || 0,
          paid_sales: Number(row.paid_sales) || 0,
          total_expense: Number(row.total_expense) || 0,
          paid_expense: Number(row.paid_expense) || 0,
          income_payment_status: (row.income_payment_status as string | null) ?? null,
        };
      }
    }

    return result;
  }, {}, "fetchBWFProjectFinancials", 30000);
}

export const PAYMENT_PROGRESS_AGING_DAYS = [30, 60, 90, 120] as const;
export type PaymentProgressAgingDay = (typeof PAYMENT_PROGRESS_AGING_DAYS)[number];

/** Receivable aging for /bwf/payment-progress advanced filters and KPI cards. */
export interface BWFPaymentProgressReceivableMeta {
  hasUnpaid: boolean;
  /** Longest unpaid days among incomes with net outstanding and a due_date. */
  maxUnpaidDays: number | null;
  /** Sum of net outstanding (outstanding − bad_debts) on unpaid incomes. */
  unpaidAmount: number;
  /** Invoice-level net outstanding for incomes older than each bucket. */
  amountOverDays: Record<PaymentProgressAgingDay, number>;
}

function emptyAgingAmounts(): Record<PaymentProgressAgingDay, number> {
  return { 30: 0, 60: 0, 90: 0, 120: 0 };
}

function emptyReceivableMeta(): BWFPaymentProgressReceivableMeta {
  return {
    hasUnpaid: false,
    maxUnpaidDays: null,
    unpaidAmount: 0,
    amountOverDays: emptyAgingAmounts(),
  };
}

function startOfTodayHkMs(): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return new Date(`${y}-${m}-${d}T00:00:00+08:00`).getTime();
}

export async function fetchBWFPaymentProgressReceivableMeta(
  projectIds: string[],
): Promise<Record<string, BWFPaymentProgressReceivableMeta>> {
  if (projectIds.length === 0) return {};

  return safeQuery(async () => {
    const todayStartMs = startOfTodayHkMs();
    type IncomeRow = {
      bwf_project_id: string | null;
      outstanding: number | null;
      bad_debts: number | null;
      due_date: string | null;
    };

    const rows = await mapBatchesParallel<IncomeRow>(
      projectIds,
      200,
      4,
      (batch) =>
        fetchAllByFk(
          "incomes",
          "bwf_project_id, outstanding, bad_debts, due_date",
          "bwf_project_id",
          batch,
          (q) => q.gt("outstanding", 0),
        ),
    );

    const result: Record<string, BWFPaymentProgressReceivableMeta> = {};
    for (const id of projectIds) {
      result[id] = emptyReceivableMeta();
    }

    for (const row of rows) {
      const net = incomeNetOutstanding(row);
      if (!row.bwf_project_id || net <= 0) continue;
      const current = result[row.bwf_project_id] ?? emptyReceivableMeta();
      current.hasUnpaid = true;
      current.unpaidAmount += net;
      if (row.due_date) {
        const dueMs = new Date(row.due_date).getTime();
        if (!Number.isNaN(dueMs)) {
          const days = Math.floor((todayStartMs - dueMs) / (1000 * 60 * 60 * 24));
          if (current.maxUnpaidDays == null || days > current.maxUnpaidDays) {
            current.maxUnpaidDays = days;
          }
          for (const threshold of PAYMENT_PROGRESS_AGING_DAYS) {
            if (days > threshold) current.amountOverDays[threshold] += net;
          }
        }
      }
      result[row.bwf_project_id] = current;
    }

    return result;
  }, {}, "fetchBWFPaymentProgressReceivableMeta", 30000);
}

// ─── CONTRACT TYPES LOOKUP ──────────────────────────────
export interface ContractTypeOption {
  id: string;
  display: string;
  chinese_display: string | null;
  is_ao: boolean;
}

export async function fetchContractTypes(): Promise<ContractTypeOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("nos_contracts")
      .select("id, display, chinese_display, rank, is_ao")
      .order("rank", { ascending: true });
    if (error) logError("fetchContractTypes", error);
    return (data ?? []).map((ct: any) => ({
      id: ct.id,
      display: ct.display || "未知",
      chinese_display: ct.chinese_display,
      is_ao: ct.is_ao === true,
    }));
  }, [], "fetchContractTypes");
}

// ─── PAYMENT METHODS LOOKUP ─────────────────────────────
export interface PaymentMethodOption {
  id: string;
  display: string;
}

export async function fetchPaymentMethods(): Promise<PaymentMethodOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("nos_payment_methods")
      .select("id, display")
      .order("display", { ascending: true });
    if (error) logError("fetchPaymentMethods", error);
    return (data ?? []).map((pm: any) => ({
      id: pm.id,
      display: pm.display || "未知",
    }));
  }, [], "fetchPaymentMethods");
}

// ─── INCOME CRUD ────────────────────────────────────────
export interface IncomeFormData {
  income_amount: number | null;
  payment_amount: number | null;
  outstanding: number | null;
  receive_date: string | null;
  due_date: string | null;
  expected_payment_date: string | null;
  invoice_number: string | null;
  n_contract_type_id: string | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_method_id: string | null;
  remark: string | null;
  type_display: string | null;
  pdf_file: string | null;
  expiry_reason_id: string | null;
  /** Admin / Super Admin only — omit from payload for other roles so existing values are not wiped. */
  bad_debts?: number | null;
  ao_request_date?: string | null;
  ao_issue_date?: string | null;
  ao_work_days?: number | null;
  ao_design_firm_status?: string | null;
  ao_quotation_firm_date?: string | null;
  ao_work_status?: string | null;
  ao_client_follow_up?: string | null;
}

async function assertProjectIncomeMeetsEstimated(params: {
  projectId?: string | null;
  bwfProjectId?: string | null;
  excludeIncomeId?: string | null;
  nextAmount?: number | null;
  mode: "save" | "delete";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const isBwf = !!params.bwfProjectId;
  const projectId = isBwf ? params.bwfProjectId : params.projectId;
  if (!projectId) return { ok: true };

  const projectTable = isBwf ? "bwf_projects" : "bwa_projects";
  const incomeFk = isBwf ? "bwf_project_id" : "project_id";

  const [{ data: project, error: projectError }, { data: incomeRows, error: incomeError }] =
    await Promise.all([
      supabase
        .from(projectTable)
        .select("estimated_income, income_below_estimated_reason")
        .eq("id", projectId)
        .maybeSingle(),
      supabase.from("incomes").select("id, income_amount").eq(incomeFk, projectId),
    ]);

  if (projectError) {
    logError("assertProjectIncomeMeetsEstimated", projectError);
    return { ok: false, error: projectError.message };
  }
  if (incomeError) {
    logError("assertProjectIncomeMeetsEstimated", incomeError);
    return { ok: false, error: incomeError.message };
  }

  const others = otherProjectIncomeTotal(
    (incomeRows ?? []).map((row: { id: string; income_amount: number | null }) => ({
      id: row.id,
      amount: row.income_amount,
    })),
    params.excludeIncomeId
  );
  const projected = params.mode === "delete" ? others : others + (Number(params.nextAmount) || 0);
  const estimated = project?.estimated_income;

  if (hasIncomeBelowEstimatedReason(project?.income_below_estimated_reason)) {
    return { ok: true };
  }

  if (!isProjectIncomeBelowEstimated(projected, estimated)) {
    return { ok: true };
  }

  const estimatedNum = Number(estimated) || 0;
  return {
    ok: false,
    error:
      params.mode === "delete"
        ? projectIncomeDeleteBlockedMessage(estimatedNum)
        : projectIncomeBelowEstimatedMessage(estimatedNum),
  };
}

export async function saveIncomeBelowEstimatedReason(
  projectId: string,
  entityType: "bwa_project" | "bwf_project",
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const normalized = normalizeIncomeBelowEstimatedReason(reason);
  if (!normalized) {
    return { success: false, error: INCOME_BELOW_ESTIMATED_REASON_REQUIRED_MESSAGE };
  }

  const table = entityType === "bwf_project" ? "bwf_projects" : "bwa_projects";
  const { data: current, error: currentError } = await supabase
    .from(table)
    .select("income_below_estimated_reason")
    .eq("id", projectId)
    .maybeSingle();
  if (currentError) {
    logError("saveIncomeBelowEstimatedReason", currentError);
    return { success: false, error: currentError.message };
  }

  const existing = normalizeIncomeBelowEstimatedReason(current?.income_below_estimated_reason);
  if (existing === normalized) {
    return { success: true };
  }

  const { error } = await supabase
    .from(table)
    .update({
      income_below_estimated_reason: normalized,
      modified_date: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) {
    logError("saveIncomeBelowEstimatedReason", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function persistIncomeBelowEstimatedReason(
  projectId: string,
  entityType: "bwa_project" | "bwf_project",
  nextReason: string | null | undefined,
  existingReason: string | null | undefined
): Promise<{ success: boolean; error?: string }> {
  const next = normalizeIncomeBelowEstimatedReason(nextReason);
  const existing = normalizeIncomeBelowEstimatedReason(existingReason);
  if (existing && !next) {
    return { success: false, error: INCOME_BELOW_ESTIMATED_REASON_CLEARED_MESSAGE };
  }
  if (!next || next === existing) {
    return { success: true };
  }
  return saveIncomeBelowEstimatedReason(projectId, entityType, next);
}

export async function createIncome(
  projectId: string,
  formData: IncomeFormData,
  entityType: "bwa_project" | "bwf_project" = "bwa_project"
): Promise<{ success: boolean; id?: string; error?: string }> {
  return safeQuery(async () => {
    const floor = await assertProjectIncomeMeetsEstimated({
      projectId: entityType === "bwf_project" ? null : projectId,
      bwfProjectId: entityType === "bwf_project" ? projectId : null,
      nextAmount: formData.income_amount,
      mode: "save",
    });
    if (!floor.ok) return { success: false, error: floor.error };

    const fkPayload =
      entityType === "bwf_project"
        ? { bwf_project_id: projectId }
        : { project: projectId, project_id: projectId };

    const { data, error } = await supabase
      .from("incomes")
      .insert({
        ...fkPayload,
        income_amount: formData.income_amount,
        payment_amount: formData.payment_amount ?? 0,
        outstanding: formData.outstanding ?? formData.income_amount ?? 0,
        receive_date: formData.receive_date,
        due_date: formData.due_date,
        expected_payment_date: formData.expected_payment_date,
        invoice_number: formData.invoice_number,
        n_contract_type_id: formData.n_contract_type_id,
        payment_status: incomeStatusForCreateInsert(formData.payment_status),
        payment_method: formData.payment_method,
        payment_method_id: formData.payment_method_id,
        remark: formData.remark,
        type_display: formData.type_display,
        pdf_file: formData.pdf_file,
        expiry_reason_id: formData.expiry_reason_id,
        ...(formData.bad_debts !== undefined ? { bad_debts: formData.bad_debts } : {}),
        ao_request_date: formData.ao_request_date ?? null,
        ao_issue_date: formData.ao_issue_date ?? null,
        ao_work_days: formData.ao_work_days ?? null,
        ao_design_firm_status: formData.ao_design_firm_status ?? null,
        ao_quotation_firm_date: formData.ao_quotation_firm_date ?? null,
        ao_work_status: formData.ao_work_status ?? null,
        ao_client_follow_up: formData.ao_client_follow_up ?? null,
        created_date: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logError("createIncome", error);
      return { success: false, error: error.message };
    }
    return { success: true, id: data?.id };
  }, { success: false, error: "Network error" }, "createIncome");
}

export async function updateIncome(
  incomeId: string,
  formData: Partial<IncomeFormData>,
  staffId?: string | null
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    const needsCurrentRow =
      formData.income_amount !== undefined || formData.due_date !== undefined;
    let current: {
      project_id: string | null;
      bwf_project_id: string | null;
      due_date: string | null;
    } | null = null;

    if (needsCurrentRow) {
      const { data, error: currentError } = await supabase
        .from("incomes")
        .select("project_id, bwf_project_id, due_date")
        .eq("id", incomeId)
        .maybeSingle();
      if (currentError) {
        logError("updateIncome", currentError);
        return { success: false, error: currentError.message };
      }
      current = data;
    }

    if (formData.income_amount !== undefined) {
      const floor = await assertProjectIncomeMeetsEstimated({
        projectId: current?.project_id,
        bwfProjectId: current?.bwf_project_id,
        excludeIncomeId: incomeId,
        nextAmount: formData.income_amount,
        mode: "save",
      });
      if (!floor.ok) return { success: false, error: floor.error };
    }

    const updatePayload: Record<string, any> = {
      modified_date: new Date().toISOString(),
    };
    if (formData.income_amount !== undefined) updatePayload.income_amount = formData.income_amount;
    if (formData.payment_amount !== undefined) updatePayload.payment_amount = formData.payment_amount;
    if (formData.outstanding !== undefined) updatePayload.outstanding = formData.outstanding;
    if (formData.receive_date !== undefined) updatePayload.receive_date = formData.receive_date;
    if (formData.expected_payment_date !== undefined) {
      updatePayload.expected_payment_date = formData.expected_payment_date;
      attachExpectedPaymentDateLogHint(updatePayload, staffId);
    }
    // due_date is immutable after first fill — only write when currently empty.
    if (formData.due_date && !toHkYmd(current?.due_date)) {
      updatePayload.due_date = formData.due_date;
    }
    if (formData.invoice_number !== undefined) updatePayload.invoice_number = formData.invoice_number;
    if (formData.n_contract_type_id !== undefined) updatePayload.n_contract_type_id = formData.n_contract_type_id;
    // payment_status is role-gated — only /api/incomes/[id]/payment-status may write it.
    if (formData.payment_method !== undefined) updatePayload.payment_method = formData.payment_method;
    if (formData.payment_method_id !== undefined) updatePayload.payment_method_id = formData.payment_method_id;
    if (formData.remark !== undefined) updatePayload.remark = formData.remark;
    if (formData.type_display !== undefined) updatePayload.type_display = formData.type_display;
    if (formData.pdf_file !== undefined) updatePayload.pdf_file = formData.pdf_file;
    if (formData.expiry_reason_id !== undefined) {
      updatePayload.expiry_reason_id = formData.expiry_reason_id;
    }
    if (formData.bad_debts !== undefined) {
      updatePayload.bad_debts = formData.bad_debts;
    }
    if (formData.ao_request_date !== undefined) updatePayload.ao_request_date = formData.ao_request_date;
    if (formData.ao_issue_date !== undefined) updatePayload.ao_issue_date = formData.ao_issue_date;
    if (formData.ao_work_days !== undefined) updatePayload.ao_work_days = formData.ao_work_days;
    if (formData.ao_design_firm_status !== undefined) {
      updatePayload.ao_design_firm_status = formData.ao_design_firm_status;
    }
    if (formData.ao_quotation_firm_date !== undefined) {
      updatePayload.ao_quotation_firm_date = formData.ao_quotation_firm_date;
    }
    if (formData.ao_work_status !== undefined) updatePayload.ao_work_status = formData.ao_work_status;
    if (formData.ao_client_follow_up !== undefined) {
      updatePayload.ao_client_follow_up = formData.ao_client_follow_up;
    }

    const { error } = await supabase
      .from("incomes")
      .update(updatePayload)
      .eq("id", incomeId);

    if (error) {
      logError("updateIncome", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }, { success: false, error: "Network error" }, "updateIncome");
}

export async function setIncomePaymentStatus(
  incomeId: string,
  paymentStatus: string | null,
  staffId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/incomes/${incomeId}/payment-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_status: paymentStatus,
        staff_id: staffId || undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return { success: false, error: json.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: message };
  }
}

export async function deleteIncome(
  incomeId: string
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    const { data: current, error: currentError } = await supabase
      .from("incomes")
      .select("project_id, bwf_project_id")
      .eq("id", incomeId)
      .maybeSingle();
    if (currentError) {
      logError("deleteIncome", currentError);
      return { success: false, error: currentError.message };
    }
    const floor = await assertProjectIncomeMeetsEstimated({
      projectId: current?.project_id,
      bwfProjectId: current?.bwf_project_id,
      excludeIncomeId: incomeId,
      mode: "delete",
    });
    if (!floor.ok) return { success: false, error: floor.error };

    const { error } = await supabase
      .from("incomes")
      .delete()
      .eq("id", incomeId);

    if (error) {
      logError("deleteIncome", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }, { success: false, error: "Network error" }, "deleteIncome");
}

// ─── SUPPLIER TYPES LOOKUP ───────────────────────────────
export interface SupplierTypeOption {
  id: string;
  display: string;
  chinese_display: string | null;
  is_bwf?: boolean | null;
  is_active?: boolean;
}

/** Active types for dropdowns/filters; `includeIds` keeps a current (possibly inactive) assignment visible. */
export function isSelectableSupplierType(
  row: { id: string; is_active?: boolean | null },
  includeIds?: Array<string | null | undefined> | null
): boolean {
  if (row.is_active !== false) return true;
  if (!includeIds) return false;
  return includeIds.some((id) => !!id && id === row.id);
}

export async function fetchSupplierTypes(
  includeIds?: Array<string | null | undefined> | null
): Promise<SupplierTypeOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("supplier_types")
      .select("id, display, chinese_display, is_bwf, is_active")
      .order("display", { ascending: true });
    if (error) logError("fetchSupplierTypes", error);
    return (data ?? [])
      .filter((st: any) => isSelectableSupplierType(st, includeIds))
      .map((st: any) => ({
        id: st.id,
        display: st.display || "未知",
        chinese_display: st.chinese_display,
        is_bwf: st.is_bwf ?? null,
        is_active: st.is_active !== false,
      }));
  }, [], "fetchSupplierTypes");
}

// ─── EXPENSE CRUD ────────────────────────────────────────
export interface ExpenseFormData {
  installment_amount: number | null;
  converter_input_amount?: number | null;
  paid_amount: number | null;
  outstanding: number | null;
  payment_date: string | null;
  due_date: string | null;
  expected_payment_date: string | null;
  supplier_id: string | null;
  factory_id?: string | null;
  n_contract_type_id: string | null;
  n_supplier_type_id: string | null;
  payment_method_id: string | null;
  cheque_no: string | null;
  rank_report: string | null;
  payment_status: string | null;
  remark_t: string | null;
  type_display: string | null;
  invoice_number: string | null;
  invoice_hash?: string | null;
  pdf_file: string | null;
  supplier_quotation_file: string | null;
}

export async function createExpense(
  projectId: string,
  formData: ExpenseFormData,
  entityType: "bwa_project" | "bwf_project" = "bwa_project"
): Promise<{ success: boolean; id?: string; error?: string }> {
  return safeQuery(async () => {
    const fkPayload =
      entityType === "bwf_project"
        ? { bwf_project_id: projectId }
        : { project: projectId, project_id: projectId };

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        ...fkPayload,
        installment_amount: formData.installment_amount,
        converter_input_amount: formData.converter_input_amount ?? null,
        paid_amount: formData.paid_amount === undefined ? 0 : formData.paid_amount,
        outstanding: formData.outstanding ?? formData.installment_amount ?? 0,
        payment_date: formData.payment_date,
        due_date: formData.due_date,
        expected_payment_date: formData.expected_payment_date,
        supplier_id: formData.supplier_id,
        factory_id: formData.factory_id ?? null,
        n_contract_type_id: formData.n_contract_type_id,
        n_supplier_type_id: formData.n_supplier_type_id,
        payment_method_id: formData.payment_method_id,
        cheque_no: formData.cheque_no,
        rank_report: formData.rank_report,
        payment_status: expenseStatusForCreateInsert(formData.payment_status),
        remark_t: formData.remark_t,
        type_display: formData.type_display,
        invoice_number: formData.invoice_number,
        invoice_hash: formData.invoice_hash ?? null,
        pdf_file: formData.pdf_file,
        supplier_quotation_file: formData.supplier_quotation_file,
        created_date: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logError("createExpense", error);
      return { success: false, error: error.message };
    }
    return { success: true, id: data?.id };
  }, { success: false, error: "Network error" }, "createExpense");
}

export async function updateExpense(
  expenseId: string,
  formData: Partial<ExpenseFormData>,
  staffId?: string | null
): Promise<{ success: boolean; id?: string; error?: string }> {
  return safeQuery(async () => {
    const updatePayload: Record<string, any> = {
      modified_date: new Date().toISOString(),
    };
    if (formData.installment_amount !== undefined) updatePayload.installment_amount = formData.installment_amount;
    if (formData.converter_input_amount !== undefined) {
      updatePayload.converter_input_amount = formData.converter_input_amount;
    }
    if (formData.paid_amount !== undefined) updatePayload.paid_amount = formData.paid_amount;
    if (formData.outstanding !== undefined) updatePayload.outstanding = formData.outstanding;
    if (formData.payment_date !== undefined) updatePayload.payment_date = formData.payment_date;
    if (formData.expected_payment_date !== undefined) {
      updatePayload.expected_payment_date = formData.expected_payment_date;
      attachExpectedPaymentDateLogHint(updatePayload, staffId);
    }
    // due_date is immutable after first fill — only write when currently empty.
    if (formData.due_date !== undefined) {
      const { data: currentDue, error: currentDueError } = await supabase
        .from("expenses")
        .select("due_date")
        .eq("id", expenseId)
        .maybeSingle();
      if (currentDueError) {
        logError("updateExpense", currentDueError);
        return { success: false, error: currentDueError.message };
      }
      if (formData.due_date && !toHkYmd(currentDue?.due_date)) {
        updatePayload.due_date = formData.due_date;
      }
    }
    if (formData.supplier_id !== undefined) updatePayload.supplier_id = formData.supplier_id;
    if (formData.factory_id !== undefined) updatePayload.factory_id = formData.factory_id;
    if (formData.n_contract_type_id !== undefined) updatePayload.n_contract_type_id = formData.n_contract_type_id;
    if (formData.n_supplier_type_id !== undefined) updatePayload.n_supplier_type_id = formData.n_supplier_type_id;
    if (formData.payment_method_id !== undefined) updatePayload.payment_method_id = formData.payment_method_id;
    if (formData.cheque_no !== undefined) updatePayload.cheque_no = formData.cheque_no;
    if (formData.rank_report !== undefined) updatePayload.rank_report = formData.rank_report;
    // payment_status is role-gated — only /api/expenses/[id]/payment-status may write it.
    if (formData.remark_t !== undefined) updatePayload.remark_t = formData.remark_t;
    if (formData.type_display !== undefined) updatePayload.type_display = formData.type_display;
    if (formData.invoice_number !== undefined) updatePayload.invoice_number = formData.invoice_number;
    if (formData.invoice_hash !== undefined) updatePayload.invoice_hash = formData.invoice_hash;
    if (formData.pdf_file !== undefined) updatePayload.pdf_file = formData.pdf_file;
    if (formData.supplier_quotation_file !== undefined) updatePayload.supplier_quotation_file = formData.supplier_quotation_file;

    const { error } = await supabase
      .from("expenses")
      .update(updatePayload)
      .eq("id", expenseId);

    if (error) {
      logError("updateExpense", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }, { success: false, error: "Network error" }, "updateExpense");
}

export async function setExpensePaymentStatus(
  expenseId: string,
  paymentStatus: string | null,
  staffId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/expenses/${expenseId}/payment-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_status: paymentStatus,
        staff_id: staffId || undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return { success: false, error: json.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: message };
  }
}

export async function deleteExpense(
  expenseId: string
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expenseId);

    if (error) {
      logError("deleteExpense", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }, { success: false, error: "Network error" }, "deleteExpense");
}

// ─── COST CENTRES ─────────────────────────────────────────

export interface CostCentreData {
  id: string;
  bu_code: string | null;
  display: string | null;
  chinese_display: string | null;
  business_logo: string | null;
  bank_notes: string | null;
  company_chop: string | null;
  status: string | null;
  expense_control_enabled: boolean;
}

export async function fetchCostCentres(): Promise<CostCentreData[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("cost_centres")
      .select("id, bu_code, display, chinese_display, business_logo, bank_notes, company_chop, status, expense_control_enabled")
      .order("bu_code", { ascending: true });

    if (error) {
      logError("fetchCostCentres", error);
      return [];
    }
    return (data || []) as CostCentreData[];
  }, [], "fetchCostCentres");
}

// ─── INVOICE CRUD ────────────────────────────────────────

export interface InvoiceData {
  id: string;
  bubble_id: string | null;
  income_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  receiver_name: string | null;
  project_name: string | null;
  main_item_name: string | null;
  main_item_quantity: number | null;
  main_item_price: number | null;
  main_item_amount: number | null;
  enable_discount: boolean | null;
  discount_description: string | null;
  discount_amount: number | null;
  total_amount: number | null;
  note: string | null;
  system: string | null;
  cost_center_bu_id: string | null;
  pdf_branding: PdfBranding | null;
  created_date: string | null;
  modified_date: string | null;
}

export interface InvoiceSubItem {
  id: string;
  invoice_id: string | null;
  item_name: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  created_date: string | null;
  modified_date: string | null;
}

export interface InvoiceFormData {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  receiver_name: string | null;
  project_name: string | null;
  main_item_name: string | null;
  main_item_quantity: number | null;
  main_item_price: number | null;
  main_item_amount: number | null;
  enable_discount: boolean;
  discount_description: string | null;
  discount_amount: number | null;
  total_amount: number | null;
  note: string | null;
  system: string | null;
  cost_center_bu_id: string | null;
  pdf_branding: PdfBranding | null;
}

export interface InvoiceSubItemFormData {
  id?: string;
  item_name: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
}

export interface InvoiceFullData extends InvoiceData {
  sub_items: InvoiceSubItem[];
  income?: {
    id: string;
    income_amount: number | null;
    invoice_number: string | null;
    payment_status: string | null;
    contract_type_name: string | null;
  } | null;
  cost_centre?: CostCentreData | null;
}

function moneyToCents(value: number): number {
  return Math.round(value * 100);
}

export function getInvoiceItemsGrossTotal(
  formData: Pick<InvoiceFormData, "main_item_quantity" | "main_item_price">,
  subItems: InvoiceSubItemFormData[]
): number {
  const mainAmt = (formData.main_item_quantity || 0) * (formData.main_item_price || 0);
  const subTotal = subItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  return mainAmt + subTotal;
}

/**
 * Invoice-generator discount (header fields, not negative sub-items).
 * Matches InvoiceEditor: net = (main + extras) − discount when enable_discount.
 * Returns signed discount (negative) and pre-discount gross, or null if unused.
 */
export function invoiceHeaderDiscount(inv: {
  enable_discount?: boolean | null;
  discount_amount?: number | null;
  total_amount?: number | null;
  main_item_amount?: number | null;
}): { discount: number; gross: number } | null {
  if (!inv.enable_discount) return null;
  const raw = Number(inv.discount_amount);
  if (!raw || Number.isNaN(raw)) return null;
  const abs = Math.abs(raw);
  const totalNum = inv.total_amount == null ? NaN : Number(inv.total_amount);
  const gross = !Number.isNaN(totalNum)
    ? totalNum + abs
    : Number(inv.main_item_amount) || 0;
  return { discount: -abs, gross };
}

/** Pre-discount main + sub items must be >= related income.income_amount. Discount may then reduce the net total. */
export function invoiceItemsMeetIncomeAmount(
  formData: Pick<InvoiceFormData, "main_item_quantity" | "main_item_price">,
  subItems: InvoiceSubItemFormData[],
  incomeAmount: number | null | undefined
): boolean {
  if (incomeAmount == null) return true;
  return moneyToCents(getInvoiceItemsGrossTotal(formData, subItems)) >= moneyToCents(Number(incomeAmount) || 0);
}

async function assertInvoiceItemsMeetIncomeAmount(
  incomeId: string,
  formData: InvoiceFormData,
  subItems: InvoiceSubItemFormData[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("incomes")
    .select("income_amount")
    .eq("id", incomeId)
    .maybeSingle();

  if (error) {
    logError("assertInvoiceItemsMeetIncomeAmount", error);
    return { ok: false, error: error.message };
  }

  if (invoiceItemsMeetIncomeAmount(formData, subItems, data?.income_amount)) {
    return { ok: true };
  }

  return {
    ok: false,
    error: "Main item and sub items total must be at least the related income amount. Use discount to reduce the invoice below income amount.",
  };
}

export async function fetchInvoiceByIncomeId(
  incomeId: string
): Promise<InvoiceFullData | null> {
  return safeQuery(async () => {
    // First check if an invoice already exists for this income
    const { data, error } = await supabase
      .from("income_invoices")
      .select("*, cc:cost_centres!fk_income_invoices_cost_center_bu_id(id, bu_code, display, chinese_display, business_logo, bank_notes, company_chop, status)")
      .eq("income_id", incomeId)
      .maybeSingle();

    if (error) {
      logError("fetchInvoiceByIncomeId", error);
      return null;
    }
    if (!data) return null;

    // Fetch sub items
    const { data: subItems } = await supabase
      .from("invoice_sub_items")
      .select("*")
      .eq("invoice_id", data.id)
      .order("created_date", { ascending: true });

    // Fetch parent income info
    const { data: incomeInfo } = await supabase
      .from("incomes")
      .select("id, income_amount, invoice_number, payment_status, ct:nos_contracts!fk_incomes_n_contract_type_id(display)")
      .eq("id", incomeId)
      .maybeSingle();

    return {
      ...data,
      pdf_branding: parsePdfBranding((data as { pdf_branding?: unknown }).pdf_branding),
      sub_items: subItems || [],
      income: incomeInfo ? {
        id: incomeInfo.id,
        income_amount: incomeInfo.income_amount,
        invoice_number: incomeInfo.invoice_number,
        payment_status: incomeInfo.payment_status,
        contract_type_name: (incomeInfo as any).ct?.display || null,
      } : null,
      cost_centre: (data as any).cc || null,
    } as InvoiceFullData;
  }, null, "fetchInvoiceByIncomeId");
}

export async function fetchInvoiceById(
  invoiceId: string
): Promise<InvoiceFullData | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("income_invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (error) {
      logError("fetchInvoiceById", error);
      return null;
    }

    // Fetch sub items
    const { data: subItems } = await supabase
      .from("invoice_sub_items")
      .select("*")
      .eq("invoice_id", data.id)
      .order("created_date", { ascending: true });

    // Fetch parent income info if income_id exists
    let incomeInfo = null;
    if (data.income_id) {
      const { data: inc } = await supabase
        .from("incomes")
        .select("id, income_amount, invoice_number, payment_status, ct:nos_contracts!fk_incomes_n_contract_type_id(display)")
        .eq("id", data.income_id)
        .maybeSingle();
      if (inc) {
        incomeInfo = {
          id: inc.id,
          income_amount: inc.income_amount,
          invoice_number: inc.invoice_number,
          payment_status: inc.payment_status,
          contract_type_name: (inc as any).ct?.display || null,
        };
      }
    }

    return {
      ...data,
      sub_items: subItems || [],
      income: incomeInfo,
    } as InvoiceFullData;
  }, null, "fetchInvoiceById");
}

export async function createInvoice(
  incomeId: string,
  formData: InvoiceFormData,
  subItems: InvoiceSubItemFormData[]
): Promise<{ success: boolean; id?: string; error?: string }> {
  return safeQuery(async () => {
    const check = await assertInvoiceItemsMeetIncomeAmount(incomeId, formData, subItems);
    if (!check.ok) return { success: false, error: check.error };

    const { data, error } = await supabase
      .from("income_invoices")
      .insert({
        income_id: incomeId,
        income: incomeId,
        invoice_number: formData.invoice_number,
        invoice_date: formData.invoice_date,
        due_date: formData.due_date,
        receiver_name: formData.receiver_name,
        project_name: formData.project_name,
        main_item_name: formData.main_item_name,
        main_item_quantity: formData.main_item_quantity,
        main_item_price: formData.main_item_price,
        main_item_amount: formData.main_item_amount,
        enable_discount: formData.enable_discount,
        discount_description: formData.discount_description,
        discount_amount: formData.discount_amount,
        total_amount: formData.total_amount,
        note: formData.note,
        system: formData.system || "BWA",
        cost_center_bu_id: formData.cost_center_bu_id,
        pdf_branding: formData.pdf_branding,
        created_date: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logError("createInvoice", error);
      return { success: false, error: error.message };
    }

    // Insert sub items if any
    if (subItems.length > 0 && data?.id) {
      const subItemPayloads = subItems.map(si => ({
        invoice_id: data.id,
        invoice: data.id,
        item_name: si.item_name,
        quantity: si.quantity,
        price: si.price,
        amount: si.amount,
        created_date: new Date().toISOString(),
      }));
      const { error: subError } = await supabase
        .from("invoice_sub_items")
        .insert(subItemPayloads);
      if (subError) {
        logError("createInvoice:subItems", subError);
      }
    }

    return { success: true, id: data?.id };
  }, { success: false, error: "Network error" }, "createInvoice");
}

export async function updateInvoice(
  invoiceId: string,
  formData: InvoiceFormData,
  subItems: InvoiceSubItemFormData[]
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    const { data: invoiceRow, error: invoiceLookupError } = await supabase
      .from("income_invoices")
      .select("income_id")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceLookupError) {
      logError("updateInvoice:incomeLookup", invoiceLookupError);
      return { success: false, error: invoiceLookupError.message };
    }

    if (invoiceRow?.income_id) {
      const check = await assertInvoiceItemsMeetIncomeAmount(invoiceRow.income_id, formData, subItems);
      if (!check.ok) return { success: false, error: check.error };
    }

    const { error } = await supabase
      .from("income_invoices")
      .update({
        invoice_number: formData.invoice_number,
        invoice_date: formData.invoice_date,
        due_date: formData.due_date,
        receiver_name: formData.receiver_name,
        project_name: formData.project_name,
        main_item_name: formData.main_item_name,
        main_item_quantity: formData.main_item_quantity,
        main_item_price: formData.main_item_price,
        main_item_amount: formData.main_item_amount,
        enable_discount: formData.enable_discount,
        discount_description: formData.discount_description,
        discount_amount: formData.discount_amount,
        total_amount: formData.total_amount,
        note: formData.note,
        system: formData.system,
        cost_center_bu_id: formData.cost_center_bu_id,
        pdf_branding: formData.pdf_branding,
        modified_date: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (error) {
      logError("updateInvoice", error);
      return { success: false, error: error.message };
    }

    // Delete existing sub items and re-insert
    await supabase.from("invoice_sub_items").delete().eq("invoice_id", invoiceId);

    if (subItems.length > 0) {
      const subItemPayloads = subItems.map(si => ({
        invoice_id: invoiceId,
        invoice: invoiceId,
        item_name: si.item_name,
        quantity: si.quantity,
        price: si.price,
        amount: si.amount,
        created_date: new Date().toISOString(),
      }));
      const { error: subError } = await supabase
        .from("invoice_sub_items")
        .insert(subItemPayloads);
      if (subError) {
        logError("updateInvoice:subItems", subError);
      }
    }

    return { success: true };
  }, { success: false, error: "Network error" }, "updateInvoice");
}

/** True when another invoice already stores this number. Blank numbers are allowed. */
export async function isInvoiceNumberTaken(
  invoiceNumber: string,
  excludeInvoiceId?: string | null,
): Promise<boolean> {
  const trimmed = invoiceNumber.trim();
  if (!trimmed) return false;
  return safeQuery(async () => {
    let query = supabase
      .from("income_invoices")
      .select("id")
      .eq("invoice_number", trimmed)
      .limit(1);
    if (excludeInvoiceId) query = query.neq("id", excludeInvoiceId);
    const { data, error } = await query;
    if (error) {
      logError("isInvoiceNumberTaken", error);
      return true;
    }
    return (data?.length ?? 0) > 0;
  }, true, "isInvoiceNumberTaken");
}

/** Next free invoice number for the current Hong Kong month (`YYMM` + 5 digits). */
export async function allocateNextInvoiceNumber(): Promise<string> {
  const prefix = invoiceNumberPrefixFromDate(new Date());
  const fallback = nextIssuedInvoiceNumber(prefix, []);
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("income_invoices")
      .select("invoice_number")
      .like("invoice_number", `${prefix}%`);
    if (error) {
      logError("allocateNextInvoiceNumber", error);
      return fallback;
    }
    const rows = (data ?? []) as Array<{ invoice_number: string | null }>;
    const numbers = rows
      .map((row) => row.invoice_number)
      .filter((num): num is string => Boolean(num));
    return nextIssuedInvoiceNumber(prefix, numbers);
  }, fallback, "allocateNextInvoiceNumber");
}

/** Latest non-empty `income_invoices.invoice_number` per income. Missing invoices stay `null`. */
export async function fetchIssuedInvoiceNumbersByIncomeIds(
  incomeIds: string[]
): Promise<Record<string, string | null>> {
  const unique = [...new Set(incomeIds.filter(Boolean))];
  if (unique.length === 0) return {};

  return safeQuery(async () => {
    const rows = await mapBatchesParallel(
      unique,
      200,
      4,
      async (batch) => {
        const { data, error } = await supabase
          .from("income_invoices")
          .select("income_id, invoice_number, created_date")
          .in("income_id", batch)
          .order("created_date", { ascending: false });
        if (error) {
          logError("fetchIssuedInvoiceNumbersByIncomeIds", error);
          return [];
        }
        return (data ?? []) as Array<{
          income_id: string | null;
          invoice_number: string | null;
          created_date: string | null;
        }>;
      }
    );

    const map: Record<string, string | null> = {};
    for (const id of unique) map[id] = null;
    for (const row of rows) {
      if (!row.income_id || map[row.income_id]) continue;
      const number = row.invoice_number?.trim();
      if (number) map[row.income_id] = number;
    }
    return map;
  }, Object.fromEntries(unique.map((id) => [id, null])), "fetchIssuedInvoiceNumbersByIncomeIds");
}

export async function deleteInvoice(
  invoiceId: string
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    // Delete sub items first
    await supabase.from("invoice_sub_items").delete().eq("invoice_id", invoiceId);
    // Then delete invoice
    const { error } = await supabase
      .from("income_invoices")
      .delete()
      .eq("id", invoiceId);

    if (error) {
      logError("deleteInvoice", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }, { success: false, error: "Network error" }, "deleteInvoice");
}

// ─── RECEIPT CRUD ────────────────────────────────────────

export interface ReceiptData {
  id: string;
  bubble_id: string | null;
  income_id: string | null;
  invoice_id: string | null;
  amount_received: number | null;
  customer_name: string | null;
  project_name: string | null;
  receipt_date: string | null;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  enable_price_difference: boolean | null;
  price_difference: number | null;
  price_difference_description: string | null;
  system: string | null;
  cost_center_bu_id: string | null;
  pdf_branding: PdfBranding | null;
  slug: string | null;
  created_by_id: string | null;
  created_date: string | null;
  modified_date: string | null;
}

export interface ReceiptSubItem {
  id: string;
  receipt_id: string | null;
  item_name: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  created_date: string | null;
  modified_date: string | null;
}

export interface ReceiptSubItemFormData {
  id?: string;
  item_name: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
}

export interface ReceiptFormData {
  receipt_number: string | null;
  receipt_date: string | null;
  receiver_name: string | null;
  project_name: string | null;
  amount_received: number | null;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  enable_price_difference: boolean;
  price_difference: number | null;
  price_difference_description: string | null;
  system: string | null;
  cost_center_bu_id: string | null;
  pdf_branding: PdfBranding | null;
}

export interface ReceiptFullData extends ReceiptData {
  sub_items: ReceiptSubItem[];
  income?: {
    id: string;
    income_amount: number | null;
    invoice_number: string | null;
    payment_status: string | null;
    contract_type_name: string | null;
  } | null;
  cost_centre?: CostCentreData | null;
}

export async function fetchReceiptByIncomeId(
  incomeId: string
): Promise<ReceiptFullData | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("receipts")
      .select("*")
      .eq("income_id", incomeId)
      .maybeSingle();

    if (error) {
      logError("fetchReceiptByIncomeId", error);
      return null;
    }
    if (!data) return null;

    // Fetch sub items (receipt-scoped only; not income)
    const { data: subItems } = await supabase
      .from("receipt_sub_items")
      .select("*")
      .eq("receipt_id", data.id)
      .order("created_date", { ascending: true });

    // Fetch parent income info
    const { data: incomeInfo } = await supabase
      .from("incomes")
      .select("id, income_amount, invoice_number, payment_status, ct:nos_contracts!fk_incomes_n_contract_type_id(display)")
      .eq("id", incomeId)
      .maybeSingle();

    // Prefer receipt.cost_center_bu_id; fall back to linked invoice BU
    let costCentre: CostCentreData | null = null;
    let costCentreId = (data as any).cost_center_bu_id as string | null;
    if (!costCentreId && data.invoice_id) {
      const { data: invData } = await supabase
        .from("income_invoices")
        .select("cost_center_bu_id")
        .eq("id", data.invoice_id)
        .maybeSingle();
      costCentreId = invData?.cost_center_bu_id || null;
    }
    if (costCentreId) {
      const { data: ccData } = await supabase
        .from("cost_centres")
        .select("id, bu_code, display, chinese_display, business_logo, bank_notes, company_chop, status")
        .eq("id", costCentreId)
        .maybeSingle();
      if (ccData) costCentre = ccData as CostCentreData;
    }

    return {
      ...data,
      pdf_branding: parsePdfBranding((data as { pdf_branding?: unknown }).pdf_branding),
      cost_center_bu_id: costCentreId,
      sub_items: subItems || [],
      income: incomeInfo ? {
        id: incomeInfo.id,
        income_amount: incomeInfo.income_amount,
        invoice_number: incomeInfo.invoice_number,
        payment_status: incomeInfo.payment_status,
        contract_type_name: (incomeInfo as any).ct?.display || null,
      } : null,
      cost_centre: costCentre,
    } as ReceiptFullData;
  }, null, "fetchReceiptByIncomeId");
}

export async function fetchTotalReceiptCount(): Promise<number> {
  return safeQuery(async () => {
    const { count, error } = await supabase
      .from("receipts")
      .select("*", { count: "exact", head: true });

    if (error) {
      logError("fetchTotalReceiptCount", error);
      return 0;
    }
    return count || 0;
  }, 0, "fetchTotalReceiptCount");
}

export async function createReceipt(
  incomeId: string,
  formData: ReceiptFormData,
  subItems: ReceiptSubItemFormData[] = []
): Promise<{ success: boolean; id?: string; error?: string }> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("receipts")
      .insert({
        income_id: incomeId,
        income: incomeId,
        slug: formData.receipt_number,
        amount_received: formData.amount_received,
        customer_name: formData.receiver_name,
        project_name: formData.project_name,
        receipt_date: formData.receipt_date,
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        notes: formData.notes,
        enable_price_difference: formData.enable_price_difference,
        price_difference: formData.price_difference,
        price_difference_description: formData.price_difference_description,
        system: formData.system || "BWA",
        cost_center_bu_id: formData.cost_center_bu_id,
        pdf_branding: formData.pdf_branding,
        created_date: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logError("createReceipt", error);
      return { success: false, error: error.message };
    }

    // Insert sub items if any (receipt-scoped; does not touch incomes)
    if (subItems.length > 0 && data?.id) {
      const subItemPayloads = subItems.map(si => ({
        receipt_id: data.id,
        item_name: si.item_name,
        quantity: si.quantity,
        price: si.price,
        amount: si.amount,
        created_date: new Date().toISOString(),
      }));
      const { error: subError } = await supabase
        .from("receipt_sub_items")
        .insert(subItemPayloads);
      if (subError) {
        logError("createReceipt:subItems", subError);
      }
    }

    return { success: true, id: data?.id };
  }, { success: false, error: "Network error" }, "createReceipt");
}

export async function updateReceipt(
  receiptId: string,
  formData: ReceiptFormData,
  subItems: ReceiptSubItemFormData[] = []
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    const { error } = await supabase
      .from("receipts")
      .update({
        slug: formData.receipt_number,
        amount_received: formData.amount_received,
        customer_name: formData.receiver_name,
        project_name: formData.project_name,
        receipt_date: formData.receipt_date,
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        notes: formData.notes,
        enable_price_difference: formData.enable_price_difference,
        price_difference: formData.price_difference,
        price_difference_description: formData.price_difference_description,
        system: formData.system,
        cost_center_bu_id: formData.cost_center_bu_id,
        pdf_branding: formData.pdf_branding,
        modified_date: new Date().toISOString(),
      })
      .eq("id", receiptId);

    if (error) {
      logError("updateReceipt", error);
      return { success: false, error: error.message };
    }

    // Delete existing sub items and re-insert (receipt-scoped only)
    await supabase.from("receipt_sub_items").delete().eq("receipt_id", receiptId);

    if (subItems.length > 0) {
      const subItemPayloads = subItems.map(si => ({
        receipt_id: receiptId,
        item_name: si.item_name,
        quantity: si.quantity,
        price: si.price,
        amount: si.amount,
        created_date: new Date().toISOString(),
      }));
      const { error: subError } = await supabase
        .from("receipt_sub_items")
        .insert(subItemPayloads);
      if (subError) {
        logError("updateReceipt:subItems", subError);
      }
    }

    return { success: true };
  }, { success: false, error: "Network error" }, "updateReceipt");
}

export async function deleteReceipt(
  receiptId: string
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(async () => {
    // Sub items cascade on receipt delete; delete explicitly for clarity
    await supabase.from("receipt_sub_items").delete().eq("receipt_id", receiptId);
    const { error } = await supabase
      .from("receipts")
      .delete()
      .eq("id", receiptId);

    if (error) {
      logError("deleteReceipt", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }, { success: false, error: "Network error" }, "deleteReceipt");
}

// ─── CALENDAR INCOME DUE DATES ────────────────────────────
// Fetches income records whose due_date or expected_payment_date falls in range.
// Chips are placed on incomeCalendarDate (expected when set and unsettled).

export interface CalendarIncomeItem {
  id: string;
  due_date: string;
  expected_payment_date: string | null;
  /** Effective collection day used by /dates (YYYY-MM-DD). */
  calendar_date: string;
  project_id: string | null;
  bwf_project_id: string | null;
  /** Related BWA/BWF project main_pm_id. */
  pm_id: string | null;
  project_name: string | null;
  project_code: string | null;
  asana_link: string | null;
  project_type: "BWA" | "BWF";
  income_amount: number | null;
  payment_amount: number | null;
  outstanding: number | null;
  bad_debts?: number | null;
  payment_status: string | null;
  invoice_number: string | null;
  contract_type_name: string | null;
  type_display: string | null;
  remark: string | null;
}

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const CALENDAR_INCOME_SELECT = `
  id, due_date, expected_payment_date, project_id, bwf_project_id, income_amount, payment_amount, outstanding, bad_debts,
  payment_status, invoice_number, type_display, remark,
  ct:nos_contracts!fk_incomes_n_contract_type_id(display, chinese_display),
  bwa_project:bwa_projects!fk_incomes_project_id(project_name, project_code, asana_link, main_pm_id),
  bwf_project:bwf_projects!fk_incomes_bwf_project_id(project_name, project_code, asana_link, main_pm_id)
`;

function mapCalendarIncomeRow(row: any): CalendarIncomeItem | null {
  const isBwf = !!row.bwf_project_id && !row.project_id;
  const project = isBwf ? row.bwf_project : row.bwa_project;
  const ct = row.ct;
  const calendarDate = incomeCalendarDate({
    due_date: row.due_date,
    expected_payment_date: row.expected_payment_date,
    payment_status: row.payment_status,
  });
  if (!calendarDate) return null;
  return {
    id: row.id,
    due_date: row.due_date,
    expected_payment_date: row.expected_payment_date || null,
    calendar_date: calendarDate,
    project_id: row.project_id,
    bwf_project_id: row.bwf_project_id || null,
    pm_id: project?.main_pm_id || null,
    project_name: project?.project_name || null,
    project_code: project?.project_code || null,
    asana_link: project?.asana_link || null,
    project_type: isBwf ? "BWF" as const : "BWA" as const,
    income_amount: row.income_amount,
    payment_amount: row.payment_amount,
    outstanding: row.outstanding,
    bad_debts: row.bad_debts ?? null,
    payment_status: row.payment_status,
    invoice_number: row.invoice_number,
    contract_type_name: ct?.chinese_display || ct?.display || null,
    type_display: row.type_display,
    remark: row.remark,
  };
}

export async function fetchCalendarIncomes(
  startDate: string,
  endDate: string
): Promise<CalendarIncomeItem[]> {
  return safeQuery(async () => {
    if (!isYmd(startDate) || !isYmd(endDate)) return [];

    const queryByColumn = (column: "due_date" | "expected_payment_date") =>
      supabase
        .from("incomes")
        .select(CALENDAR_INCOME_SELECT)
        .not("due_date", "is", null)
        .or("project_id.not.is.null,bwf_project_id.not.is.null")
        .gte(column, startDate)
        .lte(column, endDate)
        .order("due_date", { ascending: true });

    const [dueResult, expectedResult] = await Promise.all([
      queryByColumn("due_date"),
      queryByColumn("expected_payment_date"),
    ]);

    if (dueResult.error) {
      logError("fetchCalendarIncomes", dueResult.error);
      return [];
    }
    if (expectedResult.error) {
      logError("fetchCalendarIncomes.expected", expectedResult.error);
      return [];
    }

    const byId = new Map<string, CalendarIncomeItem>();
    for (const row of [...(dueResult.data || []), ...(expectedResult.data || [])]) {
      const mapped = mapCalendarIncomeRow(row);
      if (mapped) byId.set(mapped.id, mapped);
    }
    return [...byId.values()].sort((a, b) =>
      a.calendar_date.localeCompare(b.calendar_date)
    );
  }, [], "fetchCalendarIncomes");
}
