import {
  supabase,
  safeQuery,
  logError,
  fetchAllByFk,
  fetchAllRows,
  mapBatchesParallel,
} from "@/lib/data/_core";
import {
  resolveJunctionProjectTypesForProjects,
  resolveBwfJunctionServiceTypesForProjects,
} from "@/lib/data/junctions";
import {
  attachExpectedPaymentDateLogHint,
  parseExpectedPaymentDateLog,
  type ExpectedPaymentDateLogEntry,
} from "@/lib/expected-payment-date-log";

export type ApPaymentDateSource = "BWA" | "BWF";

export interface ApPaymentDateExpenseRow {
  id: string;
  bw_type: ApPaymentDateSource;
  created_date: string | null;
  due_date: string | null;
  expected_payment_date: string | null;
  expected_payment_date_log: ExpectedPaymentDateLogEntry[];
  payment_date: string | null;
  enquiry_date: string | null;
  signed_date: string | null;
  installment_amount: number | null;
  paid_amount: number | null;
  outstanding: number | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_method_label: string | null;
  invoice_number: string | null;
  rank_report: string | null;
  type_display: string | null;
  remark: string | null;
  project_id: string | null;
  project_code: string | null;
  project_name: string | null;
  project_status: string | null;
  pm_id: string | null;
  pm_name: string | null;
  asana_link: string | null;
  contract_type_label: string | null;
  supplier_name: string | null;
  factory_name: string | null;
}

export interface ApPaymentDateProjectRow {
  id: string;
  bw_type: ApPaymentDateSource;
  status: string | null;
  cost_centre_bu_code: string | null;
  service_type_name: string | null;
  service_type_id: string | null;
  project_type_name: string | null;
  project_type_id: string | null;
  financial_year_name: string | null;
  n_financial_year_id: string | null;
  est_income: number | null;
  project_size: string | null;
  project_name: string | null;
  project_code: string | null;
  pm_name: string | null;
  pm_id: string | null;
  enquiry_date: string | null;
  signed_date: string | null;
  asana_link: string | null;
}

const EXPENSE_BASE_COLUMNS = [
  "id",
  "created_date",
  "due_date",
  "expected_payment_date",
  "expected_payment_date_log",
  "payment_date",
  "installment_amount",
  "paid_amount",
  "outstanding",
  "payment_status",
  "payment_method",
  "payment_method_id",
  "invoice_number",
  "rank_report",
  "type_display",
  "remark_t",
  "n_contract_type_id",
  "supplier_id",
  "factory_id",
  "ct:nos_contracts!fk_expenses_n_contract_type_id(id, display, chinese_display)",
  "pmeth:nos_payment_methods!fk_expenses_payment_method_id(id, display)",
  "sup:suppliers!fk_expenses_supplier_id(id, name, display_name)",
  "fac:factories!fk_expenses_factory_id(id, factory_name, display_name)",
].join(", ");

const BWA_EXPENSE_COLUMNS = `${EXPENSE_BASE_COLUMNS}, project_id`;
const BWF_EXPENSE_COLUMNS = `${EXPENSE_BASE_COLUMNS}, bwf_project_id`;

const BWA_PROJECT_SELECT = `
  id, project_name, project_code, status, project_size, estimated_income,
  enquiry_date, signed_date, asana_link,
  main_pm_id, n_team_type_id, n_financial_year_id, n_service_type_id,
  pm:staff!fk_bwa_projects_main_pm_id(id, name),
  fy:financial_years!fk_bwa_projects_n_financial_year_id(id, display),
  cc:cost_centres!fk_bwa_projects_cost_centre_id(id, bu_code),
  st:service_types!fk_bwa_projects_n_service_type_id(id, display)
`;

const BWF_PROJECT_SELECT = `
  id, project_name, project_code, status, estimated_income,
  enquiry_date, signed_date, asana_link,
  main_pm_id, n_team_type_id, n_financial_year_id, n_customer_type_id,
  pm:staff!fk_bwf_projects_main_pm_id(id, name),
  fy:financial_years!fk_bwf_projects_n_financial_year_id(id, display),
  cc:cost_centres!fk_bwf_projects_cost_center_id(id, bu_code),
  ctype:client_types!fk_bwf_projects_n_customer_type_id(id, display)
`;

type VisibleProjectIds = string[] | null;

function relOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

async function fetchTableRows(
  table: string,
  select: string,
  ids: VisibleProjectIds
): Promise<any[]> {
  if (ids && ids.length === 0) return [];
  if (ids === null) {
    const { data, error } = await fetchAllRows(table, select);
    if (error) {
      logError(`fetchApPaymentDate/${table}`, error);
      return [];
    }
    return data;
  }
  return mapBatchesParallel(ids, 200, 4, async (batch) => {
    const { data, error } = await supabase.from(table).select(select).in("id", batch);
    if (error) {
      logError(`fetchApPaymentDate/${table}`, error);
      return [];
    }
    return data ?? [];
  });
}

async function fetchExpensesForSource(
  source: ApPaymentDateSource,
  visibleProjectIds: VisibleProjectIds
): Promise<any[]> {
  if (visibleProjectIds && visibleProjectIds.length === 0) return [];
  const columns = source === "BWF" ? BWF_EXPENSE_COLUMNS : BWA_EXPENSE_COLUMNS;
  const fk = source === "BWF" ? "bwf_project_id" : "project_id";
  if (visibleProjectIds === null) {
    const { data, error } = await fetchAllRows("expenses", columns, (q) =>
      q.not(fk, "is", null).order("due_date", { ascending: true, nullsFirst: false })
    );
    if (error) {
      logError(`fetchApPaymentDateExpenses/${source}`, error);
      return [];
    }
    return data;
  }
  return mapBatchesParallel(visibleProjectIds, 120, 4, (batch) =>
    fetchAllByFk("expenses", columns, fk, batch, (q) =>
      q.order("due_date", { ascending: true, nullsFirst: false })
    )
  );
}

function mapExpenseRow(
  row: any,
  source: ApPaymentDateSource,
  projectKey: "project_id" | "bwf_project_id",
  projectMap: Map<string, ApPaymentDateProjectRow>
): ApPaymentDateExpenseRow {
  const projectId = (row[projectKey] as string | null) || null;
  const proj = projectId ? projectMap.get(projectId) : undefined;
  const ct = relOne<{ chinese_display?: string | null; display?: string | null }>(row.ct);
  const pmeth = relOne<{ display?: string | null }>(row.pmeth);
  const sup = relOne<{ display_name?: string | null; name?: string | null }>(row.sup);
  const fac = relOne<{ factory_name?: string | null; display_name?: string | null }>(row.fac);
  return {
    id: row.id,
    bw_type: source,
    created_date: row.created_date || null,
    due_date: row.due_date || null,
    expected_payment_date: row.expected_payment_date || null,
    expected_payment_date_log: parseExpectedPaymentDateLog(row.expected_payment_date_log),
    payment_date: row.payment_date || null,
    enquiry_date: proj?.enquiry_date || null,
    signed_date: proj?.signed_date || null,
    installment_amount: row.installment_amount ?? null,
    paid_amount: row.paid_amount ?? null,
    outstanding: row.outstanding ?? null,
    payment_status: row.payment_status || null,
    payment_method: row.payment_method || null,
    payment_method_label: pmeth?.display || row.payment_method || null,
    invoice_number: row.invoice_number || null,
    rank_report: row.rank_report || null,
    type_display: row.type_display || null,
    remark: row.remark_t || null,
    project_id: projectId,
    project_code: proj?.project_code || null,
    project_name: proj?.project_name || null,
    project_status: proj?.status || null,
    pm_id: proj?.pm_id || null,
    pm_name: proj?.pm_name || null,
    asana_link: proj?.asana_link || null,
    contract_type_label: ct?.chinese_display || ct?.display || null,
    supplier_name: sup?.display_name || sup?.name || null,
    factory_name: fac?.factory_name || fac?.display_name || null,
  };
}

function mapBwaProject(
  p: any,
  projectTypeName: string | null
): ApPaymentDateProjectRow {
  const pm = relOne<{ id: string; name: string }>(p.pm);
  const fy = relOne<{ id: string; display: string }>(p.fy);
  const cc = relOne<{ bu_code: string }>(p.cc);
  const st = relOne<{ id: string; display: string }>(p.st);
  return {
    id: p.id,
    bw_type: "BWA",
    status: p.status ?? null,
    cost_centre_bu_code: cc?.bu_code ?? null,
    service_type_name: st?.display ?? null,
    service_type_id: st?.id ?? p.n_service_type_id ?? null,
    project_type_name: projectTypeName,
    project_type_id: null,
    financial_year_name: fy?.display ?? null,
    n_financial_year_id: fy?.id ?? p.n_financial_year_id ?? null,
    est_income: p.estimated_income ?? null,
    project_size: p.project_size ?? null,
    project_name: p.project_name ?? null,
    project_code: p.project_code ?? null,
    pm_name: pm?.name ?? null,
    pm_id: pm?.id ?? p.main_pm_id ?? null,
    enquiry_date: p.enquiry_date ?? null,
    signed_date: p.signed_date ?? null,
    asana_link: p.asana_link ?? null,
  };
}

function mapBwfProject(
  p: any,
  serviceTypeName: string | null
): ApPaymentDateProjectRow {
  const pm = relOne<{ id: string; name: string }>(p.pm);
  const fy = relOne<{ id: string; display: string }>(p.fy);
  const cc = relOne<{ bu_code: string }>(p.cc);
  const ctype = relOne<{ id: string; display: string }>(p.ctype);
  return {
    id: p.id,
    bw_type: "BWF",
    status: p.status ?? null,
    cost_centre_bu_code: cc?.bu_code ?? null,
    service_type_name: serviceTypeName,
    service_type_id: null,
    project_type_name: ctype?.display ?? null,
    project_type_id: ctype?.id ?? p.n_customer_type_id ?? null,
    financial_year_name: fy?.display ?? null,
    n_financial_year_id: fy?.id ?? p.n_financial_year_id ?? null,
    est_income: p.estimated_income ?? null,
    project_size: null,
    project_name: p.project_name ?? null,
    project_code: p.project_code ?? null,
    pm_name: pm?.name ?? null,
    pm_id: pm?.id ?? p.main_pm_id ?? null,
    enquiry_date: p.enquiry_date ?? null,
    signed_date: p.signed_date ?? null,
    asana_link: p.asana_link ?? null,
  };
}

async function loadApPaymentDateProjects(scope: {
  bwaIds: VisibleProjectIds;
  bwfIds: VisibleProjectIds;
}): Promise<ApPaymentDateProjectRow[]> {
  const [bwaRows, bwfRows] = await Promise.all([
    fetchTableRows("bwa_projects", BWA_PROJECT_SELECT, scope.bwaIds),
    fetchTableRows("bwf_projects", BWF_PROJECT_SELECT, scope.bwfIds),
  ]);
  const [bwaPtNames, bwfStNames] = await Promise.all([
    resolveJunctionProjectTypesForProjects(bwaRows.map((p) => p.id).filter(Boolean)),
    resolveBwfJunctionServiceTypesForProjects(bwfRows.map((p) => p.id).filter(Boolean)),
  ]);
  return [
    ...bwaRows.map((p) => mapBwaProject(p, bwaPtNames.get(p.id) ?? null)),
    ...bwfRows.map((p) => mapBwfProject(p, bwfStNames.get(p.id) ?? null)),
  ];
}

/**
 * Visible projects + expenses for `/ap-payment-dates`.
 * `null` IDs = company-wide. `[]` = none for that source.
 */
export async function fetchApPaymentDatePageData(scope: {
  bwaIds: VisibleProjectIds;
  bwfIds: VisibleProjectIds;
}): Promise<{
  expenses: ApPaymentDateExpenseRow[];
  projects: ApPaymentDateProjectRow[];
}> {
  return safeQuery(
    async () => {
      const [projects, bwaRaw, bwfRaw] = await Promise.all([
        loadApPaymentDateProjects(scope),
        fetchExpensesForSource("BWA", scope.bwaIds),
        fetchExpensesForSource("BWF", scope.bwfIds),
      ]);
      const projectMap = new Map(projects.map((p) => [p.id, p]));
      return {
        projects,
        expenses: [
          ...bwaRaw.map((row) => mapExpenseRow(row, "BWA", "project_id", projectMap)),
          ...bwfRaw.map((row) => mapExpenseRow(row, "BWF", "bwf_project_id", projectMap)),
        ],
      };
    },
    { expenses: [], projects: [] },
    "fetchApPaymentDatePageData",
    45000
  );
}

export async function updateExpensePaymentDates(
  expenseId: string,
  dates: {
    due_date?: string | null;
    expected_payment_date?: string | null;
    payment_date?: string | null;
  },
  staffId?: string | null
): Promise<{
  success: boolean;
  error?: string;
  expected_payment_date_log?: ExpectedPaymentDateLogEntry[];
}> {
  return safeQuery(
    async () => {
      const updatePayload: Record<string, unknown> = {
        modified_date: new Date().toISOString(),
      };
      if (dates.due_date !== undefined) updatePayload.due_date = dates.due_date;
      if (dates.expected_payment_date !== undefined) {
        updatePayload.expected_payment_date = dates.expected_payment_date;
        attachExpectedPaymentDateLogHint(updatePayload, staffId);
      }
      if (dates.payment_date !== undefined) updatePayload.payment_date = dates.payment_date;

      const query = supabase.from("expenses").update(updatePayload).eq("id", expenseId);
      const { data, error } =
        dates.expected_payment_date !== undefined
          ? await query.select("expected_payment_date_log").maybeSingle()
          : await query;

      if (error) {
        logError("updateExpensePaymentDates", error);
        return { success: false, error: error.message };
      }
      return {
        success: true,
        expected_payment_date_log:
          dates.expected_payment_date !== undefined
            ? parseExpectedPaymentDateLog(
                (data as { expected_payment_date_log?: unknown } | null)
                  ?.expected_payment_date_log
              )
            : undefined,
      };
    },
    { success: false, error: "Network error" },
    "updateExpensePaymentDates"
  );
}
