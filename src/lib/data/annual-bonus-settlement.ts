import {
  logError,
  safeQuery,
  fetchAllByFk,
  fetchAllRows,
} from "@/lib/data/_core";
import {
  resolveJunctionProjectTypesForProjects,
  resolveJunctionProjectTypeIdsForProjects,
} from "@/lib/data/junctions";

export type AnnualBonusSource = "BWA" | "BWF";

/** Half-cent tolerance for money equality (income_amount = payment_amount). */
export const MONEY_EQ_EPSILON = 0.005;

export function moneyAmountsEqual(a: unknown, b: unknown): boolean {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) < MONEY_EQ_EPSILON;
}

/** Handler share of project GP. Sign always follows project GP. */
export function sharedGpFromRatio(
  projectGp: number,
  ratio: number | null | undefined,
): number {
  const r = Number(ratio);
  if (!Number.isFinite(projectGp) || !Number.isFinite(r) || r === 0) return 0;
  return Math.round((projectGp * r / 100) * 100) / 100;
}

/** Same ±0.01 band as /assign-bv (complete ≈ 100%). */
export const PROJECT_BV_RATIO_COMPLETE_MIN = 99.99;
export const PROJECT_BV_RATIO_COMPLETE_MAX = 100.01;

export type ProjectBvRatioStatus = "all" | "complete" | "under" | "over";

/** Sum of project_bv.ratio for one project, matching /assign-bv group.avgRatio. */
export function sumProjectBvRatios(
  rows: Array<{ project_id?: string | null; ratio?: number | null }>,
): Map<string, number> {
  const sums = new Map<string, number>();
  for (const row of rows) {
    const pid = row.project_id;
    if (!pid) continue;
    sums.set(pid, (sums.get(pid) || 0) + (Number(row.ratio) || 0));
  }
  return sums;
}

export function matchesProjectBvRatioSum(
  ratioSum: number,
  status: ProjectBvRatioStatus,
): boolean {
  if (status === "all") return true;
  if (status === "complete") {
    return ratioSum >= PROJECT_BV_RATIO_COMPLETE_MIN && ratioSum <= PROJECT_BV_RATIO_COMPLETE_MAX;
  }
  if (status === "over") return ratioSum > PROJECT_BV_RATIO_COMPLETE_MAX;
  if (status === "under") return ratioSum < PROJECT_BV_RATIO_COMPLETE_MIN;
  return true;
}

export function collectSettledProjectIds(
  candidateIds: string[],
  lines: Array<{ projectId: string | null; expected: unknown; paid: unknown }>,
): Set<string> {
  const unsettled = new Set<string>();
  for (const line of lines) {
    if (!line.projectId) continue;
    if (!moneyAmountsEqual(line.expected, line.paid)) {
      unsettled.add(line.projectId);
    }
  }
  return new Set(candidateIds.filter((id) => !unsettled.has(id)));
}

/** Later of two ISO/date strings; nulls and unparseable values are ignored. */
export function laterReceiveDate(
  current: string | null,
  incoming: string | null,
): string | null {
  if (!incoming) return current;
  const nextMs = new Date(incoming).getTime();
  if (Number.isNaN(nextMs)) return current;
  if (!current) return incoming;
  const currentMs = new Date(current).getTime();
  if (Number.isNaN(currentMs) || nextMs > currentMs) return incoming;
  return current;
}

export interface AnnualBonusSettlementRow {
  id: string;
  source: AnnualBonusSource;
  handler_id: string | null;
  handler_name: string | null;
  ratio: number | null;
  /** Latest incomes.receive_date among related project incomes. */
  latest_receive_date: string | null;
  n_financial_year_id: string | null;
  financial_year_name: string | null;
  project_id: string | null;
  project_name: string | null;
  project_code: string | null;
  project_status: string | null;
  main_pm_id: string | null;
  main_pm_name: string | null;
  main_designer_id: string | null;
  project_est_income: number | null;
  project_est_expense: number | null;
  project_act_income: number;
  project_act_expense: number;
  estimated_gp: number | null;
  actual_gp: number | null;
  shared_estimated_gp: number | null;
  shared_actual_gp: number | null;
  estimated_bv: number | null;
  actual_bv: number | null;
  /** Sum of all project_bv.ratio on the same project (assign-bv group total). */
  project_ratio_sum: number;
  cost_centre_bu_code: string | null;
  service_type_name: string | null;
  service_type_id: string | null;
  project_type_name: string | null;
  project_type_id: string | null;
  project_size: string | null;
}

const ID_BATCH = 200;

const PROJECT_BV_SELECT = `
  id, signed_date, ratio, handler_id,
  shared_estimated_gp, shared_actual_gp, estimated_gp, actual_gp,
  estimated_bv, actual_bv,
  n_financial_year_id, project_id, bwf_project_id,
  handler:staff!fk_project_bv_handler_id(id, name),
  fy:financial_years!fk_project_bv_n_financial_year_id(id, display),
  proj:bwa_projects!fk_project_bv_project_id(
    id, project_name, project_code, signed_date, status, project_size,
    main_pm_id, main_designer_id, n_service_type_id,
    estimated_income, estimated_expense,
    pm:staff!fk_bwa_projects_main_pm_id(id, name),
    designer:staff!fk_bwa_projects_main_designer_id(id, name),
    cc:cost_centres!fk_bwa_projects_cost_centre_id(id, bu_code),
    st:service_types!fk_bwa_projects_n_service_type_id(id, display)
  ),
  bwfproj:bwf_projects!fk_project_bv_bwf_project_id(
    id, project_name, project_code, signed_date, status,
    main_pm_id, main_designer_id, n_bwf_service_types_id, n_customer_type_id,
    estimated_income, estimated_expense,
    pm:staff!fk_bwf_projects_main_pm_id(id, name),
    designer:staff!fk_bwf_projects_main_designer_id(id, name),
    cc:cost_centres!fk_bwf_projects_cost_center_id(id, bu_code),
    st2:nos_service_type_2!fk_bwf_projects_n_bwf_service_types_id(id, display),
    ctype:client_types!fk_bwf_projects_n_customer_type_id(id, display)
  )
`;

/** Projects that have at least one project_bv row (any status). */
async function fetchCandidateProjectIds(
  fk: "project_id" | "bwf_project_id",
): Promise<string[]> {
  const { data, error } = await fetchAllRows("project_bv", fk, (q) =>
    q.not(fk, "is", null),
  );
  if (error) {
    logError(`fetchAnnualBonusSettlement/project_bv.${fk}`, error);
    return [];
  }
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const id = row[fk] as string | null;
    if (id) ids.add(id);
  }
  return [...ids];
}

async function loadSettlementAndSums(
  fk: "project_id" | "bwf_project_id",
  candidateIds: string[],
): Promise<{
  settledIds: Set<string>;
  incomePaid: Map<string, number>;
  expensePaid: Map<string, number>;
  latestReceiveDate: Map<string, string>;
}> {
  if (candidateIds.length === 0) {
    return {
      settledIds: new Set(),
      incomePaid: new Map(),
      expensePaid: new Map(),
      latestReceiveDate: new Map(),
    };
  }

  const incomeLines: Array<{ projectId: string | null; expected: unknown; paid: unknown }> = [];
  const expenseLines: Array<{ projectId: string | null; expected: unknown; paid: unknown }> = [];
  const incomePaid = new Map<string, number>();
  const expensePaid = new Map<string, number>();
  const latestReceiveDate = new Map<string, string>();

  for (let i = 0; i < candidateIds.length; i += ID_BATCH) {
    const batch = candidateIds.slice(i, i + ID_BATCH);
    const [incomes, expenses] = await Promise.all([
      fetchAllByFk(
        "incomes",
        `${fk}, income_amount, payment_amount, receive_date`,
        fk,
        batch,
      ),
      fetchAllByFk(
        "expenses",
        `${fk}, installment_amount, paid_amount`,
        fk,
        batch,
      ),
    ]);
    for (const row of incomes) {
      const pid = (row[fk] as string | null) ?? null;
      incomeLines.push({
        projectId: pid,
        expected: row.income_amount,
        paid: row.payment_amount,
      });
      if (pid) {
        incomePaid.set(pid, (incomePaid.get(pid) || 0) + (Number(row.payment_amount) || 0));
        const latest = laterReceiveDate(
          latestReceiveDate.get(pid) ?? null,
          (row.receive_date as string | null) ?? null,
        );
        if (latest) latestReceiveDate.set(pid, latest);
      }
    }
    for (const row of expenses) {
      const pid = (row[fk] as string | null) ?? null;
      expenseLines.push({
        projectId: pid,
        expected: row.installment_amount,
        paid: row.paid_amount,
      });
      if (pid) {
        expensePaid.set(pid, (expensePaid.get(pid) || 0) + (Number(row.paid_amount) || 0));
      }
    }
  }

  const incomeSettled = collectSettledProjectIds(candidateIds, incomeLines);
  const expenseSettled = collectSettledProjectIds(candidateIds, expenseLines);
  return {
    settledIds: new Set([...incomeSettled].filter((id) => expenseSettled.has(id))),
    incomePaid,
    expensePaid,
    latestReceiveDate,
  };
}

async function fetchProjectBvForIds(
  fk: "project_id" | "bwf_project_id",
  ids: string[],
): Promise<any[]> {
  if (ids.length === 0) return [];
  const rows: any[] = [];
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const batch = ids.slice(i, i + ID_BATCH);
    const chunk = await fetchAllByFk(
      "project_bv",
      PROJECT_BV_SELECT,
      fk,
      batch,
      (q) => q.not("handler_id", "is", null),
    );
    rows.push(...chunk);
  }
  return rows;
}

/** All project_bv ratios for a project (including null handlers), same set as /assign-bv. */
async function fetchProjectBvRatioRows(
  fk: "project_id" | "bwf_project_id",
  ids: string[],
): Promise<Array<{ project_id: string | null; ratio: number | null }>> {
  if (ids.length === 0) return [];
  const rows: Array<{ project_id: string | null; ratio: number | null }> = [];
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const batch = ids.slice(i, i + ID_BATCH);
    const chunk = await fetchAllByFk(
      "project_bv",
      `${fk}, ratio`,
      fk,
      batch,
    );
    for (const row of chunk) {
      rows.push({
        project_id: (row[fk] as string | null) ?? null,
        ratio: row.ratio ?? null,
      });
    }
  }
  return rows;
}

/**
 * project_bv shares for BWA/BWF projects whose related incomes are fully
 * collected (income_amount = payment_amount) and expenses are fully paid
 * (installment_amount = paid_amount). Status is not restricted here — the
 * page defaults 項目狀態 to Project Done so the user can switch.
 */
export async function fetchAnnualBonusSettlement(): Promise<AnnualBonusSettlementRow[]> {
  return safeQuery(async () => {
    const [bwaCandidates, bwfCandidates] = await Promise.all([
      fetchCandidateProjectIds("project_id"),
      fetchCandidateProjectIds("bwf_project_id"),
    ]);

    const [bwaFinance, bwfFinance] = await Promise.all([
      loadSettlementAndSums("project_id", bwaCandidates),
      loadSettlementAndSums("bwf_project_id", bwfCandidates),
    ]);

    const bwaIds = [...bwaFinance.settledIds];
    const bwfIds = [...bwfFinance.settledIds];

    const [bvRows, bwaRatioRows, bwfRatioRows, bwaPtNames, bwaPtIds] = await Promise.all([
      Promise.all([
        fetchProjectBvForIds("project_id", bwaIds),
        fetchProjectBvForIds("bwf_project_id", bwfIds),
      ]).then(([a, b]) => a.concat(b)),
      fetchProjectBvRatioRows("project_id", bwaIds),
      fetchProjectBvRatioRows("bwf_project_id", bwfIds),
      resolveJunctionProjectTypesForProjects(bwaIds),
      resolveJunctionProjectTypeIdsForProjects(bwaIds),
    ]);

    const bwaRatioSums = sumProjectBvRatios(bwaRatioRows);
    const bwfRatioSums = sumProjectBvRatios(bwfRatioRows);

    const bwaPayment = bwaFinance.incomePaid;
    const bwaPaid = bwaFinance.expensePaid;
    const bwaLatestReceive = bwaFinance.latestReceiveDate;
    const bwfPayment = bwfFinance.incomePaid;
    const bwfPaid = bwfFinance.expensePaid;
    const bwfLatestReceive = bwfFinance.latestReceiveDate;

    return bvRows.map((r: any) => {
      const isBwf = !r.project_id && !!r.bwf_project_id;
      const proj = isBwf ? r.bwfproj : r.proj;
      const pid = r.project_id || r.bwf_project_id || null;
      const paymentMap = isBwf ? bwfPayment : bwaPayment;
      const paidMap = isBwf ? bwfPaid : bwaPaid;
      const bwaPtIdList = pid ? bwaPtIds.get(pid) : undefined;

      return {
        id: r.id,
        source: (isBwf ? "BWF" : "BWA") as AnnualBonusSource,
        handler_id: r.handler?.id || r.handler_id || null,
        handler_name: r.handler?.name || null,
        ratio: r.ratio,
        latest_receive_date: pid
          ? (isBwf ? bwfLatestReceive : bwaLatestReceive).get(pid) ?? null
          : null,
        n_financial_year_id: r.n_financial_year_id,
        financial_year_name: r.fy?.display || null,
        project_id: pid,
        project_name: proj?.project_name || null,
        project_code: proj?.project_code || null,
        project_status: proj?.status || null,
        main_pm_id: proj?.pm?.id || proj?.main_pm_id || null,
        main_pm_name: proj?.pm?.name || null,
        main_designer_id: proj?.designer?.id || proj?.main_designer_id || null,
        project_est_income: proj?.estimated_income ?? null,
        project_est_expense: proj?.estimated_expense ?? null,
        project_act_income: pid ? paymentMap.get(pid) || 0 : 0,
        project_act_expense: pid ? paidMap.get(pid) || 0 : 0,
        estimated_gp: r.estimated_gp,
        actual_gp: r.actual_gp,
        shared_estimated_gp: r.shared_estimated_gp,
        shared_actual_gp: r.shared_actual_gp,
        estimated_bv: r.estimated_bv,
        actual_bv: r.actual_bv,
        project_ratio_sum: pid
          ? (isBwf ? bwfRatioSums : bwaRatioSums).get(pid) ?? 0
          : 0,
        cost_centre_bu_code: proj?.cc?.bu_code ?? null,
        service_type_name: isBwf
          ? (proj?.st2?.display ?? null)
          : (proj?.st?.display ?? null),
        service_type_id: isBwf
          ? (proj?.st2?.id ?? proj?.n_bwf_service_types_id ?? null)
          : (proj?.st?.id ?? proj?.n_service_type_id ?? null),
        project_type_name: isBwf
          ? (proj?.ctype?.display ?? null)
          : (pid ? bwaPtNames.get(pid) ?? null : null),
        project_type_id: isBwf
          ? (proj?.ctype?.id ?? proj?.n_customer_type_id ?? null)
          : (bwaPtIdList?.[0] ?? null),
        project_size: isBwf ? null : (proj?.project_size ?? null),
      };
    });
  }, [], "fetchAnnualBonusSettlement", 30000);
}
