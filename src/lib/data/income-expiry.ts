import {
  supabase,
  safeQuery,
  logError,
  fetchAllRows,
  mapBatchesParallel,
} from "@/lib/data/_core";
import {
  resolveJunctionProjectTypesForProjects,
  resolveBwfJunctionServiceTypesForProjects,
} from "@/lib/data/junctions";
import { incomeNetOutstanding } from "@/lib/income-outstanding";

export type IncomeExpirySource = "BWA" | "BWF";

export interface IncomeExpiryRow {
  id: string;
  bw_type: IncomeExpirySource;
  created_date: string | null;
  due_date: string | null;
  expected_payment_date: string | null;
  receive_date: string | null;
  income_amount: number | null;
  payment_amount: number | null;
  outstanding: number | null;
  bad_debts: number | null;
  net_outstanding: number;
  payment_status: string | null;
  invoice_number: string | null;
  type_display: string | null;
  contract_type_label: string | null;
  installment_label: string | null;
  remark: string | null;
  expiry_reason_id: string;
  expiry_reason: string | null;
  project_id: string | null;
  project_code: string | null;
  project_name: string | null;
  status: string | null;
  pm_name: string | null;
  cost_centre_bu_code: string | null;
  service_type_name: string | null;
  service_type_id: string | null;
  project_type_name: string | null;
  project_type_id: string | null;
  financial_year_name: string | null;
  n_financial_year_id: string | null;
  est_income: number | null;
  project_size: string | null;
}

const INCOME_SELECT = [
  "id",
  "created_date",
  "due_date",
  "expected_payment_date",
  "receive_date",
  "income_amount",
  "payment_amount",
  "outstanding",
  "bad_debts",
  "payment_status",
  "invoice_number",
  "n_contract_type_id",
  "type_display",
  "remark",
  "expiry_reason_id",
  "project_id",
  "bwf_project_id",
  "reason:income_expiry_reasons!incomes_expiry_reason_id_fkey(id, display)",
  "ct:nos_contracts!fk_incomes_n_contract_type_id(id, display, chinese_display)",
].join(", ");

const BWA_PROJECT_SELECT = `
  id, project_name, project_code, status, project_size, estimated_income,
  main_pm_id, n_financial_year_id, n_service_type_id,
  pm:staff!fk_bwa_projects_main_pm_id(id, name),
  fy:financial_years!fk_bwa_projects_n_financial_year_id(id, display),
  cc:cost_centres!fk_bwa_projects_cost_centre_id(id, bu_code),
  st:service_types!fk_bwa_projects_n_service_type_id(id, display)
`;

const BWF_PROJECT_SELECT = `
  id, project_name, project_code, status, estimated_income,
  main_pm_id, n_financial_year_id, n_customer_type_id,
  pm:staff!fk_bwf_projects_main_pm_id(id, name),
  fy:financial_years!fk_bwf_projects_n_financial_year_id(id, display),
  cc:cost_centres!fk_bwf_projects_cost_center_id(id, bu_code),
  ctype:client_types!fk_bwf_projects_n_customer_type_id(id, display)
`;

type ProjectMeta = {
  id: string;
  project_code: string | null;
  project_name: string | null;
  status: string | null;
  pm_name: string | null;
  cost_centre_bu_code: string | null;
  service_type_name: string | null;
  service_type_id: string | null;
  project_type_name: string | null;
  project_type_id: string | null;
  financial_year_name: string | null;
  n_financial_year_id: string | null;
  est_income: number | null;
  project_size: string | null;
};

function relOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** e.g. 主體工程 #1 */
export function formatIncomeInstallmentLabel(
  contractType: string | null | undefined,
  invoiceNumber: string | null | undefined
): string | null {
  const type = (contractType || "").trim();
  const num = (invoiceNumber || "").trim();
  if (!type && !num) return null;
  if (!type) return `#${num}`;
  if (!num) return type;
  return `${type} #${num}`;
}

async function fetchProjectsByIds(
  table: "bwa_projects" | "bwf_projects",
  select: string,
  ids: string[]
): Promise<any[]> {
  if (ids.length === 0) return [];
  return mapBatchesParallel(ids, 200, 4, async (batch) => {
    const { data, error } = await supabase.from(table).select(select).in("id", batch);
    if (error) {
      logError(`fetchIncomeExpiry/${table}`, error);
      return [];
    }
    return data ?? [];
  });
}

function mapBwaProject(p: any, projectTypeName: string | null): ProjectMeta {
  const pm = relOne<{ id: string; name: string }>(p.pm);
  const fy = relOne<{ id: string; display: string }>(p.fy);
  const cc = relOne<{ bu_code: string }>(p.cc);
  const st = relOne<{ id: string; display: string }>(p.st);
  return {
    id: p.id,
    project_code: p.project_code ?? null,
    project_name: p.project_name ?? null,
    status: p.status ?? null,
    pm_name: pm?.name ?? null,
    cost_centre_bu_code: cc?.bu_code ?? null,
    service_type_name: st?.display ?? null,
    service_type_id: st?.id ?? p.n_service_type_id ?? null,
    project_type_name: projectTypeName,
    project_type_id: null,
    financial_year_name: fy?.display ?? null,
    n_financial_year_id: fy?.id ?? p.n_financial_year_id ?? null,
    est_income: p.estimated_income ?? null,
    project_size: p.project_size ?? null,
  };
}

function mapBwfProject(p: any, serviceTypeName: string | null): ProjectMeta {
  const pm = relOne<{ id: string; name: string }>(p.pm);
  const fy = relOne<{ id: string; display: string }>(p.fy);
  const cc = relOne<{ bu_code: string }>(p.cc);
  const ctype = relOne<{ id: string; display: string }>(p.ctype);
  return {
    id: p.id,
    project_code: p.project_code ?? null,
    project_name: p.project_name ?? null,
    status: p.status ?? null,
    pm_name: pm?.name ?? null,
    cost_centre_bu_code: cc?.bu_code ?? null,
    service_type_name: serviceTypeName,
    service_type_id: null,
    project_type_name: ctype?.display ?? null,
    project_type_id: ctype?.id ?? p.n_customer_type_id ?? null,
    financial_year_name: fy?.display ?? null,
    n_financial_year_id: fy?.id ?? p.n_financial_year_id ?? null,
    est_income: p.estimated_income ?? null,
    project_size: null,
  };
}

function mapIncomeRow(
  row: any,
  source: IncomeExpirySource,
  projectKey: "project_id" | "bwf_project_id",
  projectMap: Map<string, ProjectMeta>
): IncomeExpiryRow | null {
  const reasonId = (row.expiry_reason_id as string | null) || null;
  if (!reasonId) return null;
  const projectId = (row[projectKey] as string | null) || null;
  const proj = projectId ? projectMap.get(projectId) : undefined;
  const reason = relOne<{ id: string; display: string | null }>(row.reason);
  const ct = relOne<{ chinese_display?: string | null; display?: string | null }>(row.ct);
  const contractTypeLabel = ct?.chinese_display || ct?.display || null;
  return {
    id: row.id,
    bw_type: source,
    created_date: row.created_date || null,
    due_date: row.due_date || null,
    expected_payment_date: row.expected_payment_date || null,
    receive_date: row.receive_date || null,
    income_amount: row.income_amount ?? null,
    payment_amount: row.payment_amount ?? null,
    outstanding: row.outstanding ?? null,
    bad_debts: row.bad_debts ?? null,
    net_outstanding: incomeNetOutstanding({
      outstanding: row.outstanding,
      bad_debts: row.bad_debts,
    }),
    payment_status: row.payment_status || null,
    invoice_number: row.invoice_number || null,
    type_display: row.type_display || null,
    contract_type_label: contractTypeLabel,
    installment_label: formatIncomeInstallmentLabel(
      contractTypeLabel,
      row.invoice_number
    ),
    remark: row.remark || null,
    expiry_reason_id: reasonId,
    expiry_reason: reason?.display || null,
    project_id: projectId,
    project_code: proj?.project_code || null,
    project_name: proj?.project_name || null,
    status: proj?.status || null,
    pm_name: proj?.pm_name || null,
    cost_centre_bu_code: proj?.cost_centre_bu_code || null,
    service_type_name: proj?.service_type_name || null,
    service_type_id: proj?.service_type_id || null,
    project_type_name: proj?.project_type_name || null,
    project_type_id: proj?.project_type_id || null,
    financial_year_name: proj?.financial_year_name || null,
    n_financial_year_id: proj?.n_financial_year_id || null,
    est_income: proj?.est_income ?? null,
    project_size: proj?.project_size || null,
  };
}

/** All incomes that have an expiry reason, with BWA/BWF project labels. */
export async function fetchIncomesWithExpiryReason(): Promise<IncomeExpiryRow[]> {
  return safeQuery(
    async () => {
      const { data: raw, error } = await fetchAllRows("incomes", INCOME_SELECT, (q) =>
        q.not("expiry_reason_id", "is", null).order("due_date", {
          ascending: false,
          nullsFirst: false,
        })
      );
      if (error) {
        logError("fetchIncomesWithExpiryReason", error);
        return [];
      }

      const bwaIds = [
        ...new Set(
          (raw ?? [])
            .map((r: { project_id?: string | null }) => r.project_id)
            .filter((id): id is string => !!id)
        ),
      ];
      const bwfIds = [
        ...new Set(
          (raw ?? [])
            .map((r: { bwf_project_id?: string | null }) => r.bwf_project_id)
            .filter((id): id is string => !!id)
        ),
      ];

      const [bwaRows, bwfRows] = await Promise.all([
        fetchProjectsByIds("bwa_projects", BWA_PROJECT_SELECT, bwaIds),
        fetchProjectsByIds("bwf_projects", BWF_PROJECT_SELECT, bwfIds),
      ]);
      const [bwaPtNames, bwfStNames] = await Promise.all([
        resolveJunctionProjectTypesForProjects(bwaRows.map((p) => p.id).filter(Boolean)),
        resolveBwfJunctionServiceTypesForProjects(bwfRows.map((p) => p.id).filter(Boolean)),
      ]);

      const projectMap = new Map<string, ProjectMeta>();
      for (const p of bwaRows) {
        projectMap.set(p.id, mapBwaProject(p, bwaPtNames.get(p.id) ?? null));
      }
      for (const p of bwfRows) {
        projectMap.set(p.id, mapBwfProject(p, bwfStNames.get(p.id) ?? null));
      }

      return (raw ?? [])
        .map((row: any) => {
          if (row.bwf_project_id) {
            return mapIncomeRow(row, "BWF", "bwf_project_id", projectMap);
          }
          if (row.project_id) {
            return mapIncomeRow(row, "BWA", "project_id", projectMap);
          }
          return mapIncomeRow(row, "BWA", "project_id", projectMap);
        })
        .filter((row): row is IncomeExpiryRow => row != null);
    },
    [],
    "fetchIncomesWithExpiryReason",
    45000
  );
}
