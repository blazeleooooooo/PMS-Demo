import { isMiniOrPP } from "@/lib/report-mini-pp";
import { resolveBwaProjectSize } from "@/lib/bwa-project-size";
import { incomeNetOutstanding } from "@/lib/income-outstanding";
import {
  supabase,
  logError,
  safeQuery,
  fetchAllByFk,
  fetchAllByProject,
} from "@/lib/data/_core";
import {
  resolveJunctionProjectTypesForPitchings,
  resolveJunctionProjectTypeIdsForPitchings,
  resolveJunctionProjectTypesForProjects,
  resolveJunctionProjectTypeIdsForProjects,
  resolveBwfJunctionServiceTypesForPitchings,
  resolveBwfJunctionServiceTypesForProjects,
} from "@/lib/data/junctions";
import { invoiceHeaderDiscount } from "@/lib/data/finance";

// Phase 5 extract — business/ops report fetchers.
// Domains must NEVER import this module (import DAG: reports → domains → junctions → _core).

// ─── COST ANALYSIS ───────────────────────────────────────────────────

export interface CostAnalysisProject {
  id: string;
  project_code: string | null;
  project_name: string | null;
  signed_date: string | null;
  customer_name: string | null;
  service_type_name: string | null;
  project_type_name: string | null;
  // Project type is MULTI-SELECT (stored in the bwa_project_project_types
  // junction). These are the type IDs the project belongs to — used for the
  // 項目類型 filter.
  project_type_ids: string[];
  pm_name: string | null;
  other_pm_name: string | null;
  size: string | null;
  actual_size: string | null;
  project_size: string | null;
  estimated_income: number | null;
  estimated_expense: number | null;
  estimated_profit: number | null;
  /** L3 收入 — sum of related incomes.income_amount */
  actual_income: number;
  status: string | null;
  n_financial_year_id: string | null;
  financial_year_name: string | null;
  cost_centre_bu_code: string | null;
  // Duration in days (calculated from signed_date to handover_date or now)
  duration_days: number | null;
  handover_date: string | null;
  start_date: string | null;
}

export interface CostAnalysisExpenseByType {
  project_id: string;
  supplier_type_id: string | null;
  supplier_type_display: string | null;
  total_installment_amount: number;
}

export async function fetchCostAnalysisProjects(): Promise<CostAnalysisProject[]> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let hasMore = true;
    let page = 0;

    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("bwa_projects")
        .select(`
          id, project_code, project_name, signed_date, start_date, handover_date,
          customer, customer_id, status, size, actual_size, project_size,
          estimated_income, estimated_expense, estimated_profit,
          main_pm, main_pm_id, other_pm, other_pm_id, more_pm, more_pm_id,
          n_service_type, n_service_type_id, n_project_type,
          n_financial_year, n_financial_year_id, cost_centre, cost_centre_id,
          real_customer_display_name, real_customer_name, real_cost_centre,
          pm:staff!fk_bwa_projects_main_pm_id(id, name),
          other_pm_staff:staff!fk_bwa_projects_other_pm_id(id, name),
          cust:customers!fk_bwa_projects_customer_id(id, customer_name, company_name),
          fy:financial_years!fk_bwa_projects_n_financial_year_id(id, display),
          st:service_types!fk_bwa_projects_n_service_type_id(id, display),
          cc:cost_centres!fk_bwa_projects_cost_centre_id(id, display, bu_code)
        `)
        .order("signed_date", { ascending: false, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logError("fetchCostAnalysisProjects", error);
        break;
      }

      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }

    // Project type is multi-select — resolve the full set of type IDs per
    // project from the junction table so the 項目類型 filter can match on ID.
    const projectIds = allData.map((p: any) => p.id);
    const [junctionTypeIds, junctionTypeNames, incomeSums] = await Promise.all([
      resolveJunctionProjectTypeIdsForProjects(projectIds),
      resolveJunctionProjectTypesForProjects(projectIds),
      sumAmountsByProject(
        "incomes",
        "income_amount",
        "project_id",
        projectIds,
        "fetchCostAnalysisProjects/incomes",
      ),
    ]);

    return allData.map((p: any) => {
      // Calculate duration
      let duration_days: number | null = null;
      if (p.signed_date) {
        const startDate = new Date(p.signed_date);
        const endDate = p.handover_date ? new Date(p.handover_date) : new Date();
        duration_days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (duration_days < 0) duration_days = 0;
      }

      const ptIds = junctionTypeIds.get(p.id) ?? [];

      return {
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        signed_date: p.signed_date,
        customer_name: p.real_customer_display_name || p.real_customer_name || p.cust?.company_name || p.cust?.customer_name || null,
        service_type_name: Array.isArray(p.st)
          ? p.st.map((t: any) => t.display).filter(Boolean).join(", ") || null
          : p.st?.display || null,
        project_type_name: junctionTypeNames.get(p.id) || null,
        project_type_ids: ptIds,
        pm_name: p.pm?.name || null,
        other_pm_name: p.other_pm_staff?.name || null,
        size: p.size,
        actual_size: p.actual_size ?? null,
        project_size: p.project_size,
        estimated_income: p.estimated_income,
        estimated_expense: p.estimated_expense,
        estimated_profit: p.estimated_profit,
        actual_income: incomeSums.get(p.id) || 0,
        status: p.status,
        n_financial_year_id: p.n_financial_year_id,
        financial_year_name: p.fy?.display || null,
        cost_centre_bu_code: p.cc?.bu_code || null,
        duration_days,
        handover_date: p.handover_date,
        start_date: p.start_date,
      };
    });
  }, [], "fetchCostAnalysisProjects");
}

export async function fetchSupplierTypesForCostAnalysis(): Promise<{ id: string; display: string | null; chinese_display: string | null; is_bwf: boolean | null }[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("supplier_types")
      .select("id, display, chinese_display, is_bwf, is_active")
      .or("is_active.is.null,is_active.eq.true")
      .order("order", { ascending: true });

    if (error) {
      logError("fetchSupplierTypesForCostAnalysis", error);
      return [];
    }
    return data ?? [];
  }, [], "fetchSupplierTypesForCostAnalysis");
}

export async function fetchExpensesByProjects(projectIds: string[]): Promise<CostAnalysisExpenseByType[]> {
  if (projectIds.length === 0) return [];

  return safeQuery(async () => {
    // Fetch expenses with supplier_type join in batches (fully paginated).
    const BATCH_SIZE = 200;
    let allResults: CostAnalysisExpenseByType[] = [];

    for (let i = 0; i < projectIds.length; i += BATCH_SIZE) {
      const batch = projectIds.slice(i, i + BATCH_SIZE);
      const rows = await fetchAllByProject(
        "expenses",
        "project_id, n_supplier_type_id, installment_amount",
        batch,
        (q) => q.not("installment_amount", "is", null),
      );

      // Aggregate by project_id + supplier_type
      const aggMap = new Map<string, CostAnalysisExpenseByType>();
      for (const row of rows) {
        const key = `${row.project_id}__${row.n_supplier_type_id || "unknown"}`;
        const amount = Number(row.installment_amount) || 0;
        const existing = aggMap.get(key);
        if (existing) {
          existing.total_installment_amount += amount;
        } else {
          aggMap.set(key, {
            project_id: row.project_id!,
            supplier_type_id: row.n_supplier_type_id,
            supplier_type_display: null, // will be resolved client-side
            total_installment_amount: amount,
          });
        }
      }
      allResults = allResults.concat(Array.from(aggMap.values()));
    }

    return allResults;
  }, [], "fetchExpensesByProjects");
}

export async function fetchProjectTypes(): Promise<{ id: string; display: string | null }[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("project_types")
      .select("id, display")
      .order("display", { ascending: true });
    if (error) { logError("fetchProjectTypes", error); return []; }
    return data ?? [];
  }, [], "fetchProjectTypes");
}

export async function fetchServiceTypes(): Promise<{ id: string; display: string | null }[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("service_types")
      .select("id, display")
      .order("display", { ascending: true });
    if (error) { logError("fetchServiceTypes", error); return []; }
    return data ?? [];
  }, [], "fetchServiceTypes");
}

export async function fetchFinancialYears(): Promise<{ id: string; display: string | null }[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("financial_years")
      .select("id, display")
      .order("display", { ascending: false });
    if (error) { logError("fetchFinancialYears", error); return []; }
    return data ?? [];
  }, [], "fetchFinancialYears");
}

export async function fetchCostCentresForCostAnalysis(): Promise<{ id: string; display: string | null; bu_code: string | null }[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("cost_centres")
      .select("id, display, bu_code")
      .order("bu_code", { ascending: true });
    if (error) { logError("fetchCostCentresForCostAnalysis", error); return []; }
    return data ?? [];
  }, [], "fetchCostCentresForCostAnalysis");
}

export async function fetchPMStaff(): Promise<{ id: string; name: string | null; position: string | null; status: string | null }[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("staff")
      .select("id, name, position, status")
      .order("name", { ascending: true });
    if (error) { logError("fetchPMStaff", error); return []; }
    return data ?? [];
  }, [], "fetchPMStaff");
}

// ─── BUSINESS REPORTS: BWA / BWF SOURCE TAG ───────────────
// Every business-report row is tagged with the business line it came from
// (BWA 裝修 or BWF 傢俬) so the shared source toggle can filter client-side.
export type BusinessReportSource = "BWA" | "BWF";

// ─── BUSINESS REPORTS: SALES TREND ────────────────────────
// Each row of project_bv is one staff member's share of a project's gross
// profit. We surface the shared estimated/actual GP alongside the handler
// (staff), team, and the project's cost centre, plus the project signed_date
// so the report can bucket rows by how long ago the project was signed.
export interface SalesTrendBVRow {
  id: string;
  source: BusinessReportSource; // BWA 裝修 | BWF 傢俬
  signed_date: string | null;
  shared_estimated_gp: number | null;
  shared_actual_gp: number | null;
  estimated_gp: number | null;
  actual_gp: number | null;
  total_sales: number | null;
  ratio: number | null;
  // Staff (handler) dimension
  staff_id: string | null;
  staff_name: string | null;
  // The handler's OWN attributes (distinct from the project's team / cost centre).
  staff_team_id: string | null;
  staff_team_name: string | null;
  staff_cost_centre_id: string | null;
  staff_cost_centre_name: string | null;
  staff_position: string | null;
  // Team dimension
  team_id: string | null;
  team_name: string | null;
  // Cost centre dimension (resolved from the linked BWA/BWF project)
  cost_centre_id: string | null;
  cost_centre_name: string | null;
  cost_centre_bu_code: string | null;
  // Project context + ProjectFilterBar fields
  project_id: string | null;
  project_name: string | null;
  project_code: string | null;
  project_status: string | null;
  service_type_id: string | null;
  service_type_name: string | null;
  project_type_id: string | null;
  project_type_name: string | null;
  project_size: string | null;
  est_income: number | null;
  financial_year_name: string | null;
  n_financial_year_id: string | null;
}

export async function fetchSalesTrendBV(): Promise<SalesTrendBVRow[]> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;
    let allRows: any[] = [];
    let page = 0;
    let hasMore = true;

    // project_bv rows link to either a BWA project (project_id) or a BWF
    // project (bwf_project_id) — join both sides and tag each row's source.
    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("project_bv")
        .select(`
          id, signed_date, shared_estimated_gp, shared_actual_gp,
          estimated_gp, actual_gp, total_sales, ratio,
          handler_id, n_team_type_id, project_id, bwf_project_id, n_financial_year_id,
          handler:staff!fk_project_bv_handler_id(
            id, name, position,
            staff_team:team_types!fk_staff_n_team_type_id(id, display),
            staff_cc:cost_centres!fk_staff_bu_id(id, display)
          ),
          team:team_types!fk_project_bv_n_team_type_id(id, display),
          fy:financial_years!fk_project_bv_n_financial_year_id(id, display),
          proj:bwa_projects!fk_project_bv_project_id(
            id, project_name, project_code, signed_date, status, cost_centre_id,
            project_size, estimated_income, n_service_type_id,
            cc:cost_centres!fk_bwa_projects_cost_centre_id(id, display, bu_code),
            st:service_types!fk_bwa_projects_n_service_type_id(id, display)
          ),
          bwfproj:bwf_projects!fk_project_bv_bwf_project_id(
            id, project_name, project_code, signed_date, status, cost_center_id,
            estimated_income, n_bwf_service_types_id, n_customer_type_id,
            cc:cost_centres!fk_bwf_projects_cost_center_id(id, display, bu_code),
            ctype:client_types!fk_bwf_projects_n_customer_type_id(id, display)
          )
        `)
        .or("project_id.not.is.null,bwf_project_id.not.is.null")
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logError("fetchSalesTrendBV", error);
        break;
      }

      allRows = allRows.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }

    const bwfIds = [
      ...new Set(
        allRows
          .filter((r) => !r.project_id && r.bwf_project_id)
          .map((r) => r.bwf_project_id as string),
      ),
    ];
    const bwaProjectIds = [
      ...new Set(
        allRows
          .filter((r) => r.project_id)
          .map((r) => r.project_id as string),
      ),
    ];
    const [bwfJunctionStMap, bwaPtNames, bwaPtIds] = await Promise.all([
      resolveBwfJunctionServiceTypesForProjects(bwfIds),
      resolveJunctionProjectTypesForProjects(bwaProjectIds),
      resolveJunctionProjectTypeIdsForProjects(bwaProjectIds),
    ]);

    return allRows.map((r: any) => {
      const isBwf = !r.project_id && !!r.bwf_project_id;
      const proj = isBwf ? r.bwfproj : r.proj;
      const pid = r.project_id || r.bwf_project_id || null;
      const bwaPtIdList = pid ? bwaPtIds.get(pid) : undefined;
      return {
        id: r.id,
        source: (isBwf ? "BWF" : "BWA") as BusinessReportSource,
        // Prefer the project's signed_date; fall back to the BV row's own copy.
        signed_date: proj?.signed_date || r.signed_date || null,
        shared_estimated_gp: r.shared_estimated_gp,
        shared_actual_gp: r.shared_actual_gp,
        estimated_gp: r.estimated_gp,
        actual_gp: r.actual_gp,
        total_sales: r.total_sales,
        ratio: r.ratio,
        staff_id: r.handler?.id || r.handler_id || null,
        staff_name: r.handler?.name || null,
        staff_team_id: r.handler?.staff_team?.id || null,
        staff_team_name: r.handler?.staff_team?.display || null,
        staff_cost_centre_id: r.handler?.staff_cc?.id || null,
        staff_cost_centre_name: r.handler?.staff_cc?.display || null,
        staff_position: r.handler?.position || null,
        team_id: r.team?.id || r.n_team_type_id || null,
        team_name: r.team?.display || null,
        cost_centre_id: proj?.cc?.id || proj?.cost_centre_id || proj?.cost_center_id || null,
        cost_centre_name: proj?.cc?.display || null,
        cost_centre_bu_code: proj?.cc?.bu_code || null,
        project_id: pid,
        project_name: proj?.project_name || null,
        project_code: proj?.project_code || null,
        project_status: proj?.status || null,
        service_type_id: isBwf
          ? (proj?.n_bwf_service_types_id || null)
          : (proj?.st?.id || proj?.n_service_type_id || null),
        service_type_name: isBwf
          ? (pid ? bwfJunctionStMap.get(pid) || null : null)
          : (proj?.st?.display || null),
        project_type_id: isBwf
          ? (proj?.ctype?.id || proj?.n_customer_type_id || null)
          : (bwaPtIdList?.[0] ?? null),
        project_type_name: isBwf
          ? (proj?.ctype?.display || null)
          : (pid ? bwaPtNames.get(pid) || null : null),
        project_size: isBwf ? null : (proj?.project_size || null),
        est_income: proj?.estimated_income ?? null,
        financial_year_name: r.fy?.display || null,
        n_financial_year_id: r.fy?.id || r.n_financial_year_id || null,
      };
    });
  }, [], "fetchSalesTrendBV");
}

// ─── BUSINESS REPORTS: PERSONAL PERFORMANCE (個人BV表現) ────
// One row per project_bv assignment (handler share). Project context carries
// main PM / designer for the Main PM/Designer filter; money columns are the
// handler's ratio share of project L2/L3 figures.
export interface PersonalPerformanceBVRow {
  id: string;
  source: BusinessReportSource;
  handler_id: string | null;
  handler_name: string | null;
  ratio: number | null;
  signed_date: string | null;
  n_financial_year_id: string | null;
  financial_year_name: string | null;
  project_id: string | null;
  project_name: string | null;
  project_code: string | null;
  project_status: string | null;
  main_pm_id: string | null;
  main_pm_name: string | null;
  main_designer_id: string | null;
  main_designer_name: string | null;
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
  /** Aligned ProjectFilterBar dims */
  cost_centre_bu_code: string | null;
  service_type_name: string | null;
  service_type_id: string | null;
  project_type_name: string | null;
  project_type_id: string | null;
  project_size: string | null;
}

export async function fetchPersonalPerformanceBV(): Promise<PersonalPerformanceBVRow[]> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;
    let allRows: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("project_bv")
        .select(`
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
        `)
        .or("project_id.not.is.null,bwf_project_id.not.is.null")
        .not("handler_id", "is", null)
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logError("fetchPersonalPerformanceBV", error);
        break;
      }

      allRows = allRows.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }

    const bwaIds = new Set<string>();
    const bwfIds = new Set<string>();
    for (const r of allRows) {
      if (r.project_id) bwaIds.add(r.project_id);
      else if (r.bwf_project_id) bwfIds.add(r.bwf_project_id);
    }

    const [bwaPayment, bwaPaid, bwfPayment, bwfPaid, bwaPtNames, bwaPtIds] = await Promise.all([
      sumAmountsByProject("incomes", "payment_amount", "project_id", [...bwaIds], "fetchPersonalPerformanceBV/bwaPayment"),
      sumAmountsByProject("expenses", "paid_amount", "project_id", [...bwaIds], "fetchPersonalPerformanceBV/bwaPaid"),
      sumAmountsByProject("incomes", "payment_amount", "bwf_project_id", [...bwfIds], "fetchPersonalPerformanceBV/bwfPayment"),
      sumAmountsByProject("expenses", "paid_amount", "bwf_project_id", [...bwfIds], "fetchPersonalPerformanceBV/bwfPaid"),
      resolveJunctionProjectTypesForProjects([...bwaIds]),
      resolveJunctionProjectTypeIdsForProjects([...bwaIds]),
    ]);

    return allRows.map((r: any) => {
      const isBwf = !r.project_id && !!r.bwf_project_id;
      const proj = isBwf ? r.bwfproj : r.proj;
      const pid = r.project_id || r.bwf_project_id || null;
      const paymentMap = isBwf ? bwfPayment : bwaPayment;
      const paidMap = isBwf ? bwfPaid : bwaPaid;
      const bwaPtIdList = pid ? bwaPtIds.get(pid) : undefined;

      return {
        id: r.id,
        source: (isBwf ? "BWF" : "BWA") as BusinessReportSource,
        handler_id: r.handler?.id || r.handler_id || null,
        handler_name: r.handler?.name || null,
        ratio: r.ratio,
        signed_date: proj?.signed_date || r.signed_date || null,
        n_financial_year_id: r.n_financial_year_id,
        financial_year_name: r.fy?.display || null,
        project_id: pid,
        project_name: proj?.project_name || null,
        project_code: proj?.project_code || null,
        project_status: proj?.status || null,
        main_pm_id: proj?.pm?.id || proj?.main_pm_id || null,
        main_pm_name: proj?.pm?.name || null,
        main_designer_id: proj?.designer?.id || proj?.main_designer_id || null,
        main_designer_name: proj?.designer?.name || null,
        project_est_income: proj?.estimated_income ?? null,
        project_est_expense: proj?.estimated_expense ?? null,
        project_act_income: pid ? (paymentMap.get(pid) || 0) : 0,
        project_act_expense: pid ? (paidMap.get(pid) || 0) : 0,
        estimated_gp: r.estimated_gp,
        actual_gp: r.actual_gp,
        shared_estimated_gp: r.shared_estimated_gp,
        shared_actual_gp: r.shared_actual_gp,
        estimated_bv: r.estimated_bv,
        actual_bv: r.actual_bv,
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
  }, [], "fetchPersonalPerformanceBV");
}

// ─── BUSINESS REPORTS: BV PERFORMANCE (BV 業績) ───────────
// One row per project_bv assignment. Monetary columns use estimated_bv (L2)
// / actual_bv (L3). Project dimensions are joined for filters + Mini/PP rules.
export interface BVPerformanceProjectRow {
  id: string;
  source: BusinessReportSource;
  // Handler who owns this BV share (aggregation key).
  staff_id: string | null;
  staff_name: string | null;
  // Project identity + filter fields (ProjectFilterFields-compatible).
  project_id: string | null;
  project_name: string | null;
  project_code: string | null;
  signed_date: string | null;
  status: string | null;
  pm_id: string | null;
  pm_name: string | null;
  cost_centre_bu_code: string | null;
  service_type_name: string | null;
  project_type_name: string | null;
  financial_year_name: string | null;
  project_size: string | null;
  n_source_id: string | null;
  est_income: number | null;
  // BV amounts (L2 / L3 toggle).
  estimated_bv: number | null;
  actual_bv: number | null;
  n_financial_year_id: string | null;
}

export interface BVPerformanceDeductionRow {
  staff_id: string;
  staff_name: string | null;
  staff_team_name: string | null;
  staff_position: string | null;
  n_financial_year_id: string;
  deduction_pct: number;
}

export async function fetchStaffBVDeductions(): Promise<BVPerformanceDeductionRow[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("staff_bv_deductions")
      .select(`
        staff_id, n_financial_year_id, deduction_bv,
        staff:staff!staff_bv_deductions_staff_id_fkey(
          id, name, position,
          staff_team:team_types!fk_staff_n_team_type_id(id, display)
        )
      `);

    if (error) {
      logError("fetchStaffBVDeductions", error);
      return [];
    }

    return (data ?? []).map((r: any) => ({
      staff_id: r.staff_id,
      staff_name: r.staff?.name || null,
      staff_team_name: r.staff?.staff_team?.display || null,
      staff_position: r.staff?.position || null,
      n_financial_year_id: r.n_financial_year_id,
      deduction_pct: Number(r.deduction_bv) || 0,
    }));
  }, [], "fetchStaffBVDeductions");
}

export async function fetchBVPerformanceProjects(): Promise<BVPerformanceProjectRow[]> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;
    let allRows: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("project_bv")
        .select(`
          id, signed_date, estimated_bv, actual_bv, n_financial_year_id,
          handler_id, project_id, bwf_project_id,
          handler:staff!fk_project_bv_handler_id(id, name),
          fy:financial_years!fk_project_bv_n_financial_year_id(id, display),
          proj:bwa_projects!fk_project_bv_project_id(
            id, project_name, project_code, signed_date, status, project_size,
            main_pm_id, estimated_income,
            pm:staff!fk_bwa_projects_main_pm_id(id, name),
            cc:cost_centres!fk_bwa_projects_cost_centre_id(id, bu_code),
            st:service_types!fk_bwa_projects_n_service_type_id(id, display)
          ),
          bwfproj:bwf_projects!fk_project_bv_bwf_project_id(
            id, project_name, project_code, signed_date, status,
            main_pm_id, n_source_id, estimated_income,
            pm:staff!fk_bwf_projects_main_pm_id(id, name),
            cc:cost_centres!fk_bwf_projects_cost_center_id(id, bu_code)
          )
        `)
        .or("project_id.not.is.null,bwf_project_id.not.is.null")
        .not("handler_id", "is", null)
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logError("fetchBVPerformanceProjects", error);
        break;
      }

      allRows = allRows.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }

    const bwfIds = [
      ...new Set(
        allRows
          .filter((r) => !r.project_id && r.bwf_project_id)
          .map((r) => r.bwf_project_id as string),
      ),
    ];
    const [bwfJunctionStMap, bwaPtNames] = await Promise.all([
      resolveBwfJunctionServiceTypesForProjects(bwfIds),
      resolveJunctionProjectTypesForProjects(
        allRows.filter((r) => r.project_id).map((r) => r.project_id as string),
      ),
    ]);

    return allRows.map((r: any): BVPerformanceProjectRow => {
      const isBwf = !r.project_id && !!r.bwf_project_id;
      const proj = isBwf ? r.bwfproj : r.proj;
      const pid = r.project_id || r.bwf_project_id || null;
      const source: BusinessReportSource = isBwf ? "BWF" : "BWA";

      return {
        id: r.id,
        source,
        staff_id: r.handler?.id || r.handler_id || null,
        staff_name: r.handler?.name || null,
        project_id: pid,
        project_name: proj?.project_name || null,
        project_code: proj?.project_code || null,
        signed_date: proj?.signed_date || r.signed_date || null,
        status: proj?.status || null,
        pm_id: proj?.pm?.id || proj?.main_pm_id || null,
        pm_name: proj?.pm?.name || null,
        cost_centre_bu_code: proj?.cc?.bu_code || null,
        service_type_name: isBwf
          ? (pid ? bwfJunctionStMap.get(pid) || null : null)
          : (proj?.st?.display || null),
        project_type_name: isBwf
          ? null
          : (pid ? bwaPtNames.get(pid) || null : null),
        financial_year_name: r.fy?.display || null,
        project_size: isBwf ? null : (proj?.project_size || null),
        n_source_id: isBwf ? (proj?.n_source_id || null) : null,
        est_income: proj?.estimated_income ?? null,
        estimated_bv: r.estimated_bv,
        actual_bv: r.actual_bv,
        n_financial_year_id: r.n_financial_year_id,
      };
    });
  }, [], "fetchBVPerformanceProjects");
}

/** @deprecated Prefer fetchBVPerformanceProjects + fetchStaffBVDeductions. */
export async function fetchBVPerformanceSources(): Promise<{
  projects: BVPerformanceProjectRow[];
  deductions: BVPerformanceDeductionRow[];
}> {
  return safeQuery(async () => {
    const [projects, deductions] = await Promise.all([
      fetchBVPerformanceProjects(),
      fetchStaffBVDeductions(),
    ]);
    return { projects, deductions };
  }, { projects: [], deductions: [] }, "fetchBVPerformanceSources");
}

// ─── BUSINESS REPORTS: SALES BY PROJECT MANAGER ───────────
// One row per BWA or BWF project, attributed to its main PM. Carries both
// the L2 "signed/estimated" figures (from bwa_projects / bwf_projects) and
// the L3 "actual" figures (summed from the incomes / expenses tables, keyed
// on project_id for BWA and bwf_project_id for BWF). The report groups
// these by PM and filters by the project's signed_date. BWF Mini/PP uses
// n_source_id (BWA-PP); BWA uses project_size bands. BWF has no BWA
// project-type; their service type comes from the BWF taxonomy
// (nos_service_type_2).
export interface SalesByPMProject {
  id: string;
  source: BusinessReportSource; // BWA 裝修 | BWF 傢俬
  project_name: string | null;
  project_code: string | null;
  signed_date: string | null;
  start_date: string | null;
  status: string | null;
  /** Display area: BWA uses actual_size (SA); BWF uses size */
  size: string | null;
  pm_id: string | null;
  pm_name: string | null;
  designer_id: string | null;
  designer_name: string | null;
  team_id: string | null;
  team_name: string | null;
  // Financial year (project year) — for the report year filter.
  n_financial_year_id: string | null;
  financial_year_name: string | null;
  // Extra dimensions for the full /projects/bwa-style filter bar.
  cost_centre_bu_code: string | null; // BU
  service_type_name: string | null;
  project_type_name: string | null;
  project_size: string | null;
  n_source_id: string | null; // BWF only — BWA-PP filter for ❌ Mini/PP columns
  is_mini: boolean; // BWA: mini project_size bands; BWF: n_source_id = BWA-PP
  // L2 (signed / estimated)
  est_income: number | null;
  est_expense: number | null;
  est_profit: number | null;
  // L3 (actual — aggregated from incomes/expenses)
  actual_income: number;
  actual_expense: number;
}

// Page through every row of a projects table with the given select string.
async function fetchAllProjectRows(table: string, select: string, context: string): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let rows: any[] = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      logError(context, error);
      break;
    }
    rows = rows.concat(data ?? []);
    hasMore = (data?.length ?? 0) === PAGE_SIZE;
    page++;
  }
  return rows;
}

// Sum an incomes/expenses amount column per project, fully paginated, keyed
// on either project_id (BWA) or bwf_project_id (BWF).
async function sumAmountsByProject(
  table: string,
  amountCol: string,
  fkColumn: "project_id" | "bwf_project_id",
  projectIds: string[],
  context: string,
): Promise<Map<string, number>> {
  const target = new Map<string, number>();
  const BATCH = 200;
  for (let i = 0; i < projectIds.length; i += BATCH) {
    const batch = projectIds.slice(i, i + BATCH);
    const rows = await fetchAllByFk(
      table,
      `${fkColumn}, ${amountCol}`,
      fkColumn,
      batch,
      (q) => q.not(amountCol, "is", null),
    );
    for (const row of rows) {
      const pid = row[fkColumn];
      if (!pid) continue;
      target.set(pid, (target.get(pid) || 0) + (Number(row[amountCol]) || 0));
    }
  }
  return target;
}

export async function fetchSalesByPMProjects(): Promise<SalesByPMProject[]> {
  return safeQuery(async () => {
    // ── 1. Page through all BWA + BWF projects with estimated figures ──
    const [bwaProjects, bwfProjects] = await Promise.all([
      fetchAllProjectRows(
        "bwa_projects",
        `
          id, project_name, project_code, signed_date, start_date, status, size, actual_size, project_size,
          main_pm_id, main_designer_id, n_team_type_id, n_financial_year_id,
          estimated_income, estimated_expense, estimated_profit,
          pm:staff!fk_bwa_projects_main_pm_id(id, name),
          designer:staff!fk_bwa_projects_main_designer_id(id, name),
          team:team_types!fk_bwa_projects_n_team_type_id(id, display),
          fy:financial_years!fk_bwa_projects_n_financial_year_id(id, display),
          cc:cost_centres!fk_bwa_projects_cost_centre_id(id, bu_code),
          st:service_types!fk_bwa_projects_n_service_type_id(id, display)
        `,
        "fetchSalesByPMProjects/projects",
      ),
      fetchAllProjectRows(
        "bwf_projects",
        `
          id, project_name, project_code, signed_date, start_date, status, size,
          main_pm_id, main_designer_id, n_team_type_id, n_financial_year_id, n_source_id,
          n_customer_type_id, estimated_income, estimated_expense, estimated_profit,
          pm:staff!fk_bwf_projects_main_pm_id(id, name),
          designer:staff!fk_bwf_projects_main_designer_id(id, name),
          team:team_types!fk_bwf_projects_n_team_type_id(id, display),
          fy:financial_years!fk_bwf_projects_n_financial_year_id(id, display),
          cc:cost_centres!fk_bwf_projects_cost_center_id(id, bu_code),
          ctype:client_types!fk_bwf_projects_n_customer_type_id(id, display)
        `,
        "fetchSalesByPMProjects/bwfProjects",
      ),
    ]);

    // ── 2. Aggregate actual income / expense per project ──
    // BWA children key on incomes/expenses.project_id, BWF on bwf_project_id.
    const bwaIds = bwaProjects.map((p) => p.id);
    const bwfIds = bwfProjects.map((p) => p.id);
    const bwfJunctionStMap = await resolveBwfJunctionServiceTypesForProjects(bwfIds);
    const [bwaIncome, bwaExpense, bwfIncome, bwfExpense, bwaPtNames] = await Promise.all([
      sumAmountsByProject("incomes", "income_amount", "project_id", bwaIds, "fetchSalesByPMProjects/incomes"),
      sumAmountsByProject("expenses", "installment_amount", "project_id", bwaIds, "fetchSalesByPMProjects/expenses"),
      sumAmountsByProject("incomes", "income_amount", "bwf_project_id", bwfIds, "fetchSalesByPMProjects/bwfIncomes"),
      sumAmountsByProject("expenses", "installment_amount", "bwf_project_id", bwfIds, "fetchSalesByPMProjects/bwfExpenses"),
      resolveJunctionProjectTypesForProjects(bwaIds),
    ]);

    const mapProject = (
      p: any,
      source: BusinessReportSource,
      income: Map<string, number>,
      expense: Map<string, number>,
      bwfStMap?: Map<string, string>,
      bwaPtMap?: Map<string, string>,
    ): SalesByPMProject => ({
      id: p.id,
      source,
      project_name: p.project_name,
      project_code: p.project_code,
      signed_date: p.signed_date,
      start_date: p.start_date,
      status: p.status,
      // BWA single-column area displays use 實用面積 (actual_size); BWF keeps size
      size: source === "BWA" ? (p.actual_size ?? null) : (p.size ?? null),
      pm_id: p.pm?.id || p.main_pm_id || null,
      pm_name: p.pm?.name || null,
      designer_id: p.designer?.id || p.main_designer_id || null,
      designer_name: p.designer?.name || null,
      team_id: p.team?.id || p.n_team_type_id || null,
      team_name: p.team?.display || null,
      n_financial_year_id: p.n_financial_year_id || null,
      financial_year_name: p.fy?.display || null,
      cost_centre_bu_code: p.cc?.bu_code || null,
      service_type_name:
        source === "BWF"
          ? (bwfStMap?.get(p.id) || null)
          : (p.st?.display || null),
      // BWA: project_types; BWF: client_types as project-type dimension
      project_type_name:
        source === "BWF"
          ? (p.ctype?.display || null)
          : (bwaPtMap?.get(p.id) || null),
      project_size: source === "BWF" ? null : (p.project_size || null),
      n_source_id: source === "BWF" ? p.n_source_id || null : null,
      is_mini: isMiniOrPP({
        source,
        project_size: source === "BWF" ? null : p.project_size,
        estimated_income: p.estimated_income,
        n_source_id: source === "BWF" ? p.n_source_id : null,
      }),
      est_income: p.estimated_income,
      est_expense: p.estimated_expense,
      est_profit: p.estimated_profit,
      actual_income: income.get(p.id) || 0,
      actual_expense: expense.get(p.id) || 0,
    });

    return [
      ...bwaProjects.map((p) => mapProject(p, "BWA", bwaIncome, bwaExpense, undefined, bwaPtNames)),
      ...bwfProjects.map((p) => mapProject(p, "BWF", bwfIncome, bwfExpense, bwfJunctionStMap)),
    ];
  }, [], "fetchSalesByPMProjects");
}

// ─── BUSINESS REPORTS: PMS LOGIN (Supabase Auth) ───────────
export interface PMSLoginUserRow {
  auth_user_id: string;
  email: string | null;
  member_name: string | null;
  user_type: string | null;
  approval_status: string | null;
  provider: string;
  provider_label: string;
  last_sign_in_at: string | null;
  /** Max of last_sign_in_at, users.last_login_at, and auth.sessions activity. */
  last_activity_at: string | null;
  account_created_at: string;
  linked: boolean;
  member_id: string | null;
  staff_status: string | null;
  is_developer: boolean;
}

export interface PMSLoginSessionRow {
  session_id: string;
  auth_user_id: string;
  login_at: string;
  /** Max of session created_at / updated_at / refreshed_at */
  last_active_at: string | null;
  ip: string | null;
  user_agent: string | null;
  email: string | null;
  member_name: string | null;
  user_type: string | null;
}

export async function fetchPMSLoginReport(): Promise<
  | { success: true; users: PMSLoginUserRow[]; sessions: PMSLoginSessionRow[] }
  | { success: false; error: string }
> {
  try {
    const res = await fetch("/api/business-reports/pms-login", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || `HTTP ${res.status}` };
    }
    return {
      success: true,
      users: json.users ?? [],
      sessions: json.sessions ?? [],
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

// ─── BUSINESS REPORTS: PROJECT MANAGER / DESIGNER HIT RATE ─
// AI WARNING (SHARED): This fetch + PMHitRatePitch shape power BOTH
//   /business-reports/pm-hit-rate (role="pm") AND
//   /design-reports/designer-hit-rate (role="designer").
// Any change to conversion rules, Mini/PP split, or returned fields applies
// to BOTH pages — do not fork a Designer-only copy; pass HitRateStaffRole.
//
// One row per pitching, attributed to main_pm (pm) or main_designer (designer).
// A pitching is "converted" when a project links back to it
// (bwa_projects.pitching_id / bwf_projects.bwf_pitching_id).
// Pitches are split into normal vs "Mini" so the report can show both the
// headline hit rate (w/o Mini) and the PP (mini-only) hit rate.
// The report window filters on the pitch's enquiry_date.
export type HitRateStaffRole = "pm" | "designer";

export interface PMHitRatePitch extends PitchProjectFilterDims {
  id: string;
  source: BusinessReportSource; // BWA 裝修 | BWF 傢俬
  /** Attributed staff id (main_pm_id or main_designer_id depending on role). */
  pm_id: string | null;
  /** Attributed staff display name. */
  pm_name: string | null;
  /** staff.position of the attributed person (e.g. "PM", "Designer"). */
  staff_position: string | null;
  // Display label for the pitch (customer / code), used in hover breakdowns.
  pitch_label: string | null;
  pitch_code: string | null;
  /** Pitch-native stage (bwa/bwf_pitchings.pitching_stages) — not overwritten by project status. */
  pitching_stages: string | null;
  enquiry_date: string | null;
  n_source_id: string | null; // BWF only — BWA-PP filter for Mini / ❌ Mini/PP split
  is_mini: boolean; // BWA: mini project_size bands; BWF: n_source_id = BWA-PP
  converted: boolean; // a BWA project links back to this pitching
  // Status of the linked (converted) project, if any. Used to apply the
  // project-status counting rules to the "Converted Projects" headcount.
  converted_status: string | null;
}

// ─── SHARED PITCHING BACKBONE (BWA + BWF) ─────────────────
// The PM-oriented reports (hit rate, discounted, A.O., overdue, outstanding,
// bad debt) all start from "every pitching, attributed to its main PM" and
// join the converted project via bwa_projects.pitching_id (BWA) or
// bwf_projects.bwf_pitching_id (BWF). These helpers page through both sides
// and tag each row with its source. BWF Mini/PP split uses n_source_id
// (BWA-PP source is excluded from ❌ Mini/PP columns).
/** Extra columns on converted projects for aligned ProjectFilterBar. */
const CONVERTED_PROJECT_FILTER_COLS_BWA =
  "project_name, project_code, estimated_income, project_size, n_financial_year_id, " +
  "fy:financial_years!fk_bwa_projects_n_financial_year_id(id, display), " +
  "cc:cost_centres!fk_bwa_projects_cost_centre_id(id, bu_code), " +
  "st:service_types!fk_bwa_projects_n_service_type_id(id, display)";

const CONVERTED_PROJECT_FILTER_COLS_BWF =
  "project_name, project_code, estimated_income, n_financial_year_id, " +
  "fy:financial_years!fk_bwf_projects_n_financial_year_id(id, display), " +
  "cc:cost_centres!fk_bwf_projects_cost_center_id(id, bu_code), " +
  "ctype:client_types!fk_bwf_projects_n_customer_type_id(id, display)";

/** Project-filter dims shared by pitch-based business/team reports. */
export interface PitchProjectFilterDims {
  status: string | null;
  cost_centre_bu_code: string | null;
  service_type_name: string | null;
  service_type_id: string | null;
  project_type_name: string | null;
  project_type_id: string | null;
  financial_year_name: string | null;
  n_financial_year_id: string | null;
  project_size: string | null;
  est_income: number | null;
  project_name: string | null;
  project_code: string | null;
  /** Converted project UUID for 收款/工地 filters (pitch id is not an income FK). */
  filter_project_id: string | null;
}

function pitchProjectFilterDimsOf(
  p: any,
  proj: any | undefined,
  junctionCtx?: {
    pitchingPtNames?: Map<string, string>;
    pitchingPtIds?: Map<string, string[]>;
    projectPtNames?: Map<string, string>;
    projectPtIds?: Map<string, string[]>;
  },
): PitchProjectFilterDims {
  // Prefer converted project attrs; fall back to pitch-native fields.
  const status = proj?.status ?? p.pitching_stages ?? null;
  const est_income = proj?.estimated_income ?? p.estimated_income ?? null;
  const projectPtIdList = proj?.id ? junctionCtx?.projectPtIds?.get(proj.id) : undefined;
  const pitchingPtIdList = junctionCtx?.pitchingPtIds?.get(p.id);
  return {
    status,
    cost_centre_bu_code: proj?.cc?.bu_code ?? null,
    service_type_name:
      proj?.st?.display ??
      p.st?.display ??
      p.st2?.display ??
      null,
    service_type_id:
      proj?.st?.id ??
      p.st?.id ??
      p.n_service_type_id ??
      p.n_bwf_service_types_id ??
      null,
    project_type_name:
      (proj?.id ? junctionCtx?.projectPtNames?.get(proj.id) : undefined) ??
      junctionCtx?.pitchingPtNames?.get(p.id) ??
      proj?.ctype?.display ??
      p.ctype?.display ??
      null,
    project_type_id:
      projectPtIdList?.[0] ??
      pitchingPtIdList?.[0] ??
      proj?.ctype?.id ??
      p.ctype?.id ??
      p.n_customer_type_id ??
      null,
    financial_year_name: proj?.fy?.display ?? p.fy?.display ?? null,
    n_financial_year_id:
      proj?.n_financial_year_id ?? p.n_financial_year_id ?? null,
    project_size: proj?.project_size ?? p.os_money_size ?? null,
    est_income,
    project_name: proj?.project_name ?? pitchLabelOf(p),
    project_code: proj?.project_code ?? p.pitching_code ?? null,
    filter_project_id: proj?.id ?? null,
  };
}

async function buildBwaPitchProjectTypeJunctionCtx(
  pitches: any[],
  bwaConverted: Map<string, any>,
) {
  const bwaPitchIds = pitches.filter((p) => p.source === "BWA").map((p) => p.id);
  const bwaConvertedProjIds = [...bwaConverted.values()].map((row) => row.id).filter(Boolean);
  const [pitchingPtNames, pitchingPtIds, projectPtNames, projectPtIds] = await Promise.all([
    resolveJunctionProjectTypesForPitchings(bwaPitchIds),
    resolveJunctionProjectTypeIdsForPitchings(bwaPitchIds),
    resolveJunctionProjectTypesForProjects(bwaConvertedProjIds),
    resolveJunctionProjectTypeIdsForProjects(bwaConvertedProjIds),
  ]);
  return { pitchingPtNames, pitchingPtIds, projectPtNames, projectPtIds };
}

async function fetchAllPitchRows(context: string): Promise<any[]> {
  const [bwa, bwf] = await Promise.all([
    fetchAllProjectRows(
      "bwa_pitchings",
      `
        id, main_pm_id, main_designer_id, estimated_income, enquiry_date, pitching_code, os_money_size,
        pitching_stages, n_financial_year_id, n_service_type_id,
        real_customer_display_name, real_customer_co_name,
        pm:staff!fk_bwa_pitchings_main_pm_id(id, name, position),
        designer:staff!fk_bwa_pitchings_main_designer_id(id, name, position),
        fy:financial_years!fk_bwa_pitchings_n_financial_year_id(id, display),
        st:service_types!fk_bwa_pitchings_n_service_type_id(id, display)
      `,
      `${context}/pitches`,
    ),
    fetchAllProjectRows(
      "bwf_pitchings",
      `
        id, main_pm_id, main_designer_id, estimated_income, enquiry_date, pitching_code, pitching_name,
        n_source_id, pitching_stages, n_financial_year_id, n_bwf_service_types_id, n_customer_type_id,
        real_customer_display_name, real_customer_name,
        pm:staff!fk_bwf_pitchings_main_pm_id(id, name, position),
        designer:staff!fk_bwf_pitchings_main_designer_id(id, name, position),
        fy:financial_years!fk_bwf_pitchings_n_financial_year_id(id, display),
        st2:nos_service_type_2!fk_bwf_pitchings_n_bwf_service_types_id(id, display),
        ctype:client_types!fk_bwf_pitchings_n_customer_type_id(id, display)
      `,
      `${context}/bwfPitches`,
    ),
  ]);
  return [
    ...bwa.map((p) => ({ ...p, source: "BWA" as BusinessReportSource })),
    ...bwf.map((p) => ({ ...p, source: "BWF" as BusinessReportSource })),
  ];
}

// Display label for a pitch — customer name first, then code (BWF also has a
// pitching_name field).
function pitchLabelOf(p: any): string | null {
  return (
    p.real_customer_display_name ||
    p.real_customer_co_name ||
    p.real_customer_name ||
    p.pitching_name ||
    p.pitching_code ||
    null
  );
}

// Map pitching id → converted-project row for one side. `extraColumns` are
// appended to the base id/status/link selection.
async function fetchConvertedProjectMap(
  source: BusinessReportSource,
  extraColumns: string,
  context: string,
): Promise<Map<string, any>> {
  const table = source === "BWF" ? "bwf_projects" : "bwa_projects";
  const linkCol = source === "BWF" ? "bwf_pitching_id" : "pitching_id";
  const map = new Map<string, any>();
  const PAGE_SIZE = 1000;
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${linkCol}, status${extraColumns ? `, ${extraColumns}` : ""}`)
      .not(linkCol, "is", null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      logError(context, error);
      break;
    }
    for (const row of (data ?? []) as any[]) {
      if (row[linkCol]) map.set(row[linkCol], row);
    }
    hasMore = (data?.length ?? 0) === PAGE_SIZE;
    page++;
  }
  return map;
}

/**
 * AI WARNING (SHARED): Used by PM hit rate AND Designer hit rate.
 * role="pm" → attribute via main_pm_id (no position filter).
 * role="designer" → attribute via main_designer_id, keep only staff.position = "Designer".
 */
export async function fetchPMHitRatePitches(
  role: HitRateStaffRole = "pm",
): Promise<PMHitRatePitch[]> {
  return safeQuery(async () => {
    // ── 1. All pitchings (BWA + BWF) with PM/designer + enquiry date ──
    const pitches = await fetchAllPitchRows("fetchPMHitRatePitches");

    // ── 2. Converted pitching id → linked project + filter dims, per side ──
    const [bwaConverted, bwfConverted] = await Promise.all([
      fetchConvertedProjectMap(
        "BWA",
        CONVERTED_PROJECT_FILTER_COLS_BWA,
        "fetchPMHitRatePitches/projects",
      ),
      fetchConvertedProjectMap(
        "BWF",
        CONVERTED_PROJECT_FILTER_COLS_BWF,
        "fetchPMHitRatePitches/bwfProjects",
      ),
    ]);

    const junctionCtx = await buildBwaPitchProjectTypeJunctionCtx(pitches, bwaConverted);

    const rows: PMHitRatePitch[] = [];
    for (const p of pitches as any[]) {
      const proj = (p.source === "BWF" ? bwfConverted : bwaConverted).get(p.id);
      const staff =
        role === "designer"
          ? p.designer
            ? { id: p.designer.id, name: p.designer.name, position: p.designer.position }
            : p.main_designer_id
              ? { id: p.main_designer_id, name: null, position: null }
              : null
          : p.pm
            ? { id: p.pm.id, name: p.pm.name, position: p.pm.position }
            : p.main_pm_id
              ? { id: p.main_pm_id, name: null, position: null }
              : null;

      // Designer report: exact match staff.position = "Designer" (excludes 3D Designer / missing).
      if (role === "designer" && staff?.position !== "Designer") continue;

      const dims = pitchProjectFilterDimsOf(p, proj, junctionCtx);
      rows.push({
        id: p.id,
        source: p.source,
        pm_id: staff?.id || null,
        pm_name: staff?.name || null,
        staff_position: staff?.position || null,
        pitch_label: pitchLabelOf(p),
        pitch_code: p.pitching_code || null,
        pitching_stages: p.pitching_stages || null,
        enquiry_date: p.enquiry_date,
        n_source_id: p.source === "BWF" ? p.n_source_id || null : null,
        is_mini: isMiniOrPP({
          source: p.source,
          project_size: p.source === "BWF" ? null : p.os_money_size,
          estimated_income: p.estimated_income,
          n_source_id: p.source === "BWF" ? p.n_source_id : null,
        }),
        converted: !!proj,
        converted_status: proj?.status ?? null,
        ...dims,
      });
    }
    return rows;
  }, [], "fetchPMHitRatePitches");
}

// ─── BUSINESS REPORTS: DISCOUNTED PROJECT ─────────────────
// One row per project that has at least one invoice-generator discount.
// Discount lives on income_invoices (enable_discount + discount_amount),
// same as InvoiceEditor — not as a negative invoice_sub_items line.
// Chain: income_invoices → incomes.project_id / bwf_project_id → project → main PM.
// Report filters on project enquiry_date and shows, per PM, discounted count,
// total discount $, and avg % (discount ÷ pre-discount invoice total).
export interface DiscountedProject {
  project_id: string;
  source: BusinessReportSource; // BWA 裝修 | BWF 傢俬
  project_name: string | null;
  project_code: string | null;
  enquiry_date: string | null;
  /** Project status — used for 計錢 gating in discounted-project report. */
  status: string | null;
  pm_id: string | null;
  pm_name: string | null;
  // Summed across all discounted invoices for the project.
  discount_amount: number; // negative — −income_invoices.discount_amount
  gross_amount: number; // pre-discount (net total + discount), for %
}

export async function fetchDiscountedProjects(): Promise<DiscountedProject[]> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;
    const BATCH = 200;

    // ── 1. Invoices with the generator discount toggle on ──
    const invoices: any[] = [];
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("income_invoices")
        .select("id, income_id, enable_discount, discount_amount, total_amount, main_item_amount")
        .eq("enable_discount", true)
        .not("income_id", "is", null)
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        logError("fetchDiscountedProjects/invoices", error);
        break;
      }
      invoices.push(...(data ?? []));
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }

    if (invoices.length === 0) return [];

    // ── 2. Resolve income_id → BWA project_id / BWF bwf_project_id ──
    const incomeIds = Array.from(
      new Set(invoices.map((i) => i.income_id).filter(Boolean)),
    );
    const incomeToProject = new Map<string, { id: string; source: BusinessReportSource }>();
    for (let i = 0; i < incomeIds.length; i += BATCH) {
      const batch = incomeIds.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("incomes")
        .select("id, project_id, bwf_project_id")
        .in("id", batch);
      if (error) {
        logError("fetchDiscountedProjects/incomes", error);
        continue;
      }
      for (const row of data ?? []) {
        if (!row.id) continue;
        if (row.project_id) incomeToProject.set(row.id, { id: row.project_id, source: "BWA" });
        else if (row.bwf_project_id) incomeToProject.set(row.id, { id: row.bwf_project_id, source: "BWF" });
      }
    }

    // ── 3. Aggregate header discount + pre-discount gross per project ──
    const discountByProject = new Map<string, number>();
    const grossByProject = new Map<string, number>();
    const sourceByProject = new Map<string, BusinessReportSource>();
    for (const inv of invoices) {
      const parsed = invoiceHeaderDiscount(inv);
      if (!parsed) continue;
      const proj = incomeToProject.get(inv.income_id);
      if (!proj) continue;
      sourceByProject.set(proj.id, proj.source);
      discountByProject.set(
        proj.id,
        (discountByProject.get(proj.id) || 0) + parsed.discount,
      );
      grossByProject.set(
        proj.id,
        (grossByProject.get(proj.id) || 0) + parsed.gross,
      );
    }

    const bwaProjectIds = Array.from(discountByProject.keys()).filter((id) => sourceByProject.get(id) === "BWA");
    const bwfProjectIds = Array.from(discountByProject.keys()).filter((id) => sourceByProject.get(id) === "BWF");
    if (bwaProjectIds.length === 0 && bwfProjectIds.length === 0) return [];

    // ── 4. Load the discounted projects with their PM, per side ──
    async function loadProjects(
      table: "bwa_projects" | "bwf_projects",
      pmFk: string,
      ids: string[],
    ): Promise<any[]> {
      const out: any[] = [];
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from(table)
          .select(`
            id, project_name, project_code, enquiry_date, status, main_pm_id,
            pm:staff!${pmFk}(id, name)
          `)
          .in("id", batch);
        if (error) {
          logError(`fetchDiscountedProjects/${table}`, error);
          continue;
        }
        out.push(...(data ?? []));
      }
      return out;
    }

    const [bwaProjects, bwfProjects] = await Promise.all([
      loadProjects("bwa_projects", "fk_bwa_projects_main_pm_id", bwaProjectIds),
      loadProjects("bwf_projects", "fk_bwf_projects_main_pm_id", bwfProjectIds),
    ]);

    const mapProject = (p: any, source: BusinessReportSource): DiscountedProject => ({
      project_id: p.id,
      source,
      project_name: p.project_name,
      project_code: p.project_code,
      enquiry_date: p.enquiry_date,
      status: p.status ?? null,
      pm_id: p.pm?.id || p.main_pm_id || null,
      pm_name: p.pm?.name || null,
      discount_amount: discountByProject.get(p.id) || 0,
      gross_amount: grossByProject.get(p.id) || 0,
    });

    return [
      ...bwaProjects.map((p) => mapProject(p, "BWA")),
      ...bwfProjects.map((p) => mapProject(p, "BWF")),
    ];
  }, [], "fetchDiscountedProjects");
}

// ─── BUSINESS REPORTS: SALES ANALYSIS BY CATEGORY ─────────
// One row per BWA project, carrying its project-type and service-type
// labels plus L2 (estimated) and L3 (actual) figures. The report groups
// these by project type or service type and filters by signed_date.
// The full category lists (incl. zero-activity categories) are returned
// separately so the report can show every category like the legacy screen.
export interface CategoryProject {
  id: string;
  source: BusinessReportSource; // BWA 裝修 | BWF 傢俬
  project_name: string | null;
  project_code: string | null;
  signed_date: string | null;
  status: string | null;
  // Project type is MULTI-SELECT — a project can belong to several types
  // (stored in the bwa_project_project_types junction). The report attributes
  // the project to EACH of these types.
  project_types: { id: string; name: string }[];
  service_type_id: string | null;
  service_type_name: string | null;
  // Project filter bar + Staff attribution (main PM)
  pm_id: string | null;
  pm_name: string | null;
  cost_centre_bu_code: string | null;
  project_size: string | null;
  n_financial_year_id: string | null;
  financial_year_name: string | null;
  // L2 (signed / estimated)
  est_income: number | null;
  est_expense: number | null;
  // L3 (actual — aggregated from incomes / expenses)
  actual_income: number;
  actual_expense: number;
}

export interface SalesByCategoryData {
  projects: CategoryProject[];
  // Category lists carry the side they belong to so the BWA/BWF toggle can
  // hide a side's (possibly empty) categories entirely.
  projectTypes: { id: string; name: string; source: BusinessReportSource }[];
  serviceTypes: { id: string; name: string; source: BusinessReportSource }[];
}

// BWF projects use client_types (n_customer_type_id) in place of BWA project_types
// on Sales by Category and PM Source Analysis when the BWF filter is active.
export async function fetchSalesByCategory(): Promise<SalesByCategoryData> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;

    // ── 1. Page through all BWA + BWF projects with category + estimates ──
    // BWF's service dimension is its own taxonomy (nos_service_type_2),
    // surfaced alongside the BWA service types as extra categories.
    const [projects, bwfProjects] = await Promise.all([
      fetchAllProjectRows(
        "bwa_projects",
        `
          id, project_name, project_code, signed_date, status, project_size,
          n_service_type_id, n_financial_year_id, main_pm_id,
          estimated_income, estimated_expense,
          st:service_types!fk_bwa_projects_n_service_type_id(id, display),
          fy:financial_years!fk_bwa_projects_n_financial_year_id(id, display),
          cc:cost_centres!fk_bwa_projects_cost_centre_id(id, bu_code),
          pm:staff!fk_bwa_projects_main_pm_id(id, name)
        `,
        "fetchSalesByCategory/projects",
      ),
      fetchAllProjectRows(
        "bwf_projects",
        `
          id, project_name, project_code, signed_date, status,
          n_bwf_service_types_id, n_customer_type_id, n_financial_year_id, main_pm_id,
          estimated_income, estimated_expense,
          st:nos_service_type_2!fk_bwf_projects_n_bwf_service_types_id(id, display),
          ctype:client_types!fk_bwf_projects_n_customer_type_id(id, display),
          fy:financial_years!fk_bwf_projects_n_financial_year_id(id, display),
          cc:cost_centres!fk_bwf_projects_cost_center_id(id, bu_code),
          pm:staff!fk_bwf_projects_main_pm_id(id, name)
        `,
        "fetchSalesByCategory/bwfProjects",
      ),
    ]);

    // ── 2. Aggregate actual income / expense per project, per side ──
    const [actualIncome, actualExpense, bwfIncome, bwfExpense] = await Promise.all([
      sumAmountsByProject("incomes", "income_amount", "project_id", projects.map((p) => p.id), "fetchSalesByCategory/incomes"),
      sumAmountsByProject("expenses", "installment_amount", "project_id", projects.map((p) => p.id), "fetchSalesByCategory/expenses"),
      sumAmountsByProject("incomes", "income_amount", "bwf_project_id", bwfProjects.map((p) => p.id), "fetchSalesByCategory/bwfIncomes"),
      sumAmountsByProject("expenses", "installment_amount", "bwf_project_id", bwfProjects.map((p) => p.id), "fetchSalesByCategory/bwfExpenses"),
    ]);

    const bwfJunctionStMap = await resolveBwfJunctionServiceTypesForProjects(
      bwfProjects.map((p) => p.id),
    );

    // ── 3. Fetch the full category lists (so empty categories still show) ──
    const [ptRes, stRes, bwfStRes, ctRes] = await Promise.all([
      supabase.from("project_types").select("id, display").order("display"),
      supabase.from("service_types").select("id, display").order("display"),
      supabase.from("nos_service_type_2").select("id, display").order("display"),
      supabase.from("client_types").select("id, display").order("display"),
    ]);
    if (ptRes.error) logError("fetchSalesByCategory/projectTypes", ptRes.error);
    if (stRes.error) logError("fetchSalesByCategory/serviceTypes", stRes.error);
    if (bwfStRes.error) logError("fetchSalesByCategory/bwfServiceTypes", bwfStRes.error);
    if (ctRes.error) logError("fetchSalesByCategory/clientTypes", ctRes.error);

    // Project-type display lookup, used to name junction rows.
    const ptNameById = new Map<string, string>();
    for (const t of ptRes.data ?? []) ptNameById.set(t.id, t.display || "—");

    // ── 4. Project type is multi-select: page through the junction table and
    //       collect every type per project. ──
    const typesByProject = new Map<string, { id: string; name: string }[]>();
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("bwa_project_project_types")
        .select("project_id, project_type_id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        logError("fetchSalesByCategory/junction", error);
        break;
      }
      for (const row of data ?? []) {
        if (!row.project_id || !row.project_type_id) continue;
        const list = typesByProject.get(row.project_id) ?? [];
        // Guard against duplicate junction rows.
        if (!list.some((t) => t.id === row.project_type_id)) {
          list.push({
            id: row.project_type_id,
            name: ptNameById.get(row.project_type_id) || "—",
          });
        }
        typesByProject.set(row.project_id, list);
      }
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }

    const mappedProjects: CategoryProject[] = projects.map((p: any) => {
      const projectTypes = typesByProject.get(p.id) ?? [];
      return {
        id: p.id,
        source: "BWA" as BusinessReportSource,
        project_name: p.project_name,
        project_code: p.project_code,
        signed_date: p.signed_date,
        status: p.status,
        project_types: projectTypes,
        service_type_id: p.st?.id || p.n_service_type_id || null,
        service_type_name: p.st?.display || null,
        pm_id: p.pm?.id || p.main_pm_id || null,
        pm_name: p.pm?.name || null,
        cost_centre_bu_code: p.cc?.bu_code || null,
        project_size: p.project_size || null,
        n_financial_year_id: p.fy?.id || p.n_financial_year_id || null,
        financial_year_name: p.fy?.display || null,
        est_income: p.estimated_income,
        est_expense: p.estimated_expense,
        actual_income: actualIncome.get(p.id) || 0,
        actual_expense: actualExpense.get(p.id) || 0,
      };
    });

    const mappedBwfProjects: CategoryProject[] = bwfProjects.map((p: any) => {
      const clientTypeId = p.ctype?.id || p.n_customer_type_id || null;
      const clientTypeName = p.ctype?.display || null;
      return {
        id: p.id,
        source: "BWF" as BusinessReportSource,
        project_name: p.project_name,
        project_code: p.project_code,
        signed_date: p.signed_date,
        status: p.status,
        // BWF "project type" dimension = client_types (single-select).
        project_types: clientTypeId
          ? [{ id: clientTypeId, name: clientTypeName || "—" }]
          : [],
        service_type_id: p.st?.id || p.n_bwf_service_types_id || null,
        service_type_name: bwfJunctionStMap.get(p.id) || p.st?.display || null,
        pm_id: p.pm?.id || p.main_pm_id || null,
        pm_name: p.pm?.name || null,
        cost_centre_bu_code: p.cc?.bu_code || null,
        project_size: null,
        n_financial_year_id: p.fy?.id || p.n_financial_year_id || null,
        financial_year_name: p.fy?.display || null,
        est_income: p.estimated_income,
        est_expense: p.estimated_expense,
        actual_income: bwfIncome.get(p.id) || 0,
        actual_expense: bwfExpense.get(p.id) || 0,
      };
    });

    return {
      projects: [...mappedProjects, ...mappedBwfProjects],
      projectTypes: [
        ...(ptRes.data ?? []).map((t: any) => ({ id: t.id, name: t.display || "—", source: "BWA" as BusinessReportSource })),
        ...(ctRes.data ?? []).map((t: any) => ({ id: t.id, name: t.display || "—", source: "BWF" as BusinessReportSource })),
      ],
      serviceTypes: [
        ...(stRes.data ?? []).map((t: any) => ({ id: t.id, name: t.display || "—", source: "BWA" as BusinessReportSource })),
        ...(bwfStRes.data ?? []).map((t: any) => ({ id: t.id, name: t.display || "—", source: "BWF" as BusinessReportSource })),
      ],
    };
  }, { projects: [], projectTypes: [], serviceTypes: [] }, "fetchSalesByCategory");
}

// ─── BUSINESS REPORTS: PM ANALYSIS BY SOURCE ──────────────
// One row per BWA project, carrying its main PM plus both "source" dimensions
// (project type and service type) and L2/L3 figures. The PM Analysis by Source
// report pivots these into a staff × type matrix so you can see, for each
// staff member, how they perform across project types or service types — both
// by project count (計隻數) and by financials (計錢). Filters on signed_date.
export interface PMSourceProject {
  id: string;
  source: BusinessReportSource; // BWA 裝修 | BWF 傢俬
  project_name: string | null;
  project_code: string | null;
  signed_date: string | null;
  status: string | null;
  /** Attributed staff id (main_pm_id or main_designer_id depending on role). */
  pm_id: string | null;
  /** Attributed staff display name. */
  pm_name: string | null;
  project_type_id: string | null;
  project_type_name: string | null;
  service_type_id: string | null;
  service_type_name: string | null;
  // L2 (signed / estimated)
  est_income: number | null;
  est_expense: number | null;
  // L3 (actual — aggregated from incomes / expenses)
  actual_income: number;
  actual_expense: number;
}

/** Resolve attributed staff from a project/pitch row (pm vs designer join). */
function sourceAnalysisStaffOf(
  p: any,
  role: HitRateStaffRole,
): { id: string | null; name: string | null } {
  if (role === "designer") {
    return {
      id: p.designer?.id || p.main_designer_id || null,
      name: p.designer?.name || null,
    };
  }
  return {
    id: p.pm?.id || p.main_pm_id || null,
    name: p.pm?.name || null,
  };
}

export async function fetchPMSourceProjects(
  role: HitRateStaffRole = "pm",
): Promise<PMSourceProject[]> {
  return safeQuery(async () => {
    // ── 1. Page through all BWA + BWF projects with PM/designer + type dimensions ──
    // BWF uses client_types for the project-type dimension and nos_service_type_2
    // for service type. role switches attribution (main_pm vs main_designer) —
    // shared by /business-reports/pm-analysis-source and
    // /design-reports/project-type-analysis.
    const [projects, bwfProjects] = await Promise.all([
      fetchAllProjectRows(
        "bwa_projects",
        `
          id, project_name, project_code, signed_date, status,
          main_pm_id, main_designer_id, n_service_type_id,
          estimated_income, estimated_expense,
          pm:staff!fk_bwa_projects_main_pm_id(id, name),
          designer:staff!fk_bwa_projects_main_designer_id(id, name),
          st:service_types!fk_bwa_projects_n_service_type_id(id, display)
        `,
        "fetchPMSourceProjects/projects",
      ),
      fetchAllProjectRows(
        "bwf_projects",
        `
          id, project_name, project_code, signed_date, status,
          main_pm_id, main_designer_id, n_bwf_service_types_id, n_customer_type_id,
          estimated_income, estimated_expense,
          pm:staff!fk_bwf_projects_main_pm_id(id, name),
          designer:staff!fk_bwf_projects_main_designer_id(id, name),
          st:nos_service_type_2!fk_bwf_projects_n_bwf_service_types_id(id, display),
          ctype:client_types!fk_bwf_projects_n_customer_type_id(id, display)
        `,
        "fetchPMSourceProjects/bwfProjects",
      ),
    ]);

    // ── 2. Aggregate actual income / expense per project, per side ──
    const [actualIncome, actualExpense, bwfIncome, bwfExpense] = await Promise.all([
      sumAmountsByProject("incomes", "income_amount", "project_id", projects.map((p) => p.id), "fetchPMSourceProjects/incomes"),
      sumAmountsByProject("expenses", "installment_amount", "project_id", projects.map((p) => p.id), "fetchPMSourceProjects/expenses"),
      sumAmountsByProject("incomes", "income_amount", "bwf_project_id", bwfProjects.map((p) => p.id), "fetchPMSourceProjects/bwfIncomes"),
      sumAmountsByProject("expenses", "installment_amount", "bwf_project_id", bwfProjects.map((p) => p.id), "fetchPMSourceProjects/bwfExpenses"),
    ]);

    const bwfJunctionStMap = await resolveBwfJunctionServiceTypesForProjects(
      bwfProjects.map((p) => p.id),
    );
    const [bwaPtNames, bwaPtIds] = await Promise.all([
      resolveJunctionProjectTypesForProjects(projects.map((p) => p.id)),
      resolveJunctionProjectTypeIdsForProjects(projects.map((p) => p.id)),
    ]);

    const mapped: PMSourceProject[] = projects.map((p: any) => {
      const staff = sourceAnalysisStaffOf(p, role);
      const ptIdList = bwaPtIds.get(p.id);
      return {
        id: p.id,
        source: "BWA" as BusinessReportSource,
        project_name: p.project_name,
        project_code: p.project_code,
        signed_date: p.signed_date,
        status: p.status,
        pm_id: staff.id,
        pm_name: staff.name,
        project_type_id: ptIdList?.[0] ?? null,
        project_type_name: bwaPtNames.get(p.id) || null,
        service_type_id: p.st?.id || p.n_service_type_id || null,
        service_type_name: p.st?.display || null,
        est_income: p.estimated_income,
        est_expense: p.estimated_expense,
        actual_income: actualIncome.get(p.id) || 0,
        actual_expense: actualExpense.get(p.id) || 0,
      };
    });

    const mappedBwf: PMSourceProject[] = bwfProjects.map((p: any) => {
      const staff = sourceAnalysisStaffOf(p, role);
      return {
        id: p.id,
        source: "BWF" as BusinessReportSource,
        project_name: p.project_name,
        project_code: p.project_code,
        signed_date: p.signed_date,
        status: p.status,
        pm_id: staff.id,
        pm_name: staff.name,
        project_type_id: p.ctype?.id || p.n_customer_type_id || null,
        project_type_name: p.ctype?.display || null,
        service_type_id: p.st?.id || p.n_bwf_service_types_id || null,
        service_type_name: bwfJunctionStMap.get(p.id) || p.st?.display || null,
        est_income: p.estimated_income,
        est_expense: p.estimated_expense,
        actual_income: bwfIncome.get(p.id) || 0,
        actual_expense: bwfExpense.get(p.id) || 0,
      };
    });

    return [...mapped, ...mappedBwf];
  }, [], "fetchPMSourceProjects");
}

// ─── BUSINESS REPORTS: PM SOURCE ANALYSIS (PITCHING) ───────
// Pitching counterpart of fetchPMSourceProjects for the 提案數 / 命中率
// metrics on /business-reports/pm-analysis-source. Same type dimensions
// (BWA project/service type; BWF client type / nos_service_type_2).
// Conversion + 計隻數 follow fetchPMHitRatePitches (overall hit rate =
// converted ÷ all pitches; no Mini/PP split). Window filters on enquiry_date.
export interface PMSourcePitch {
  id: string;
  source: BusinessReportSource; // BWA 裝修 | BWF 傢俬
  pitch_label: string | null;
  pitch_code: string | null;
  enquiry_date: string | null;
  /** Attributed staff id (main_pm_id or main_designer_id depending on role). */
  pm_id: string | null;
  /** Attributed staff display name. */
  pm_name: string | null;
  project_type_id: string | null;
  project_type_name: string | null;
  service_type_id: string | null;
  service_type_name: string | null;
  converted: boolean;
  converted_status: string | null;
  /** Converted project UUID for 收款/工地 filters. */
  filter_project_id: string | null;
}

export async function fetchPMSourcePitches(
  role: HitRateStaffRole = "pm",
): Promise<PMSourcePitch[]> {
  return safeQuery(async () => {
    // role switches attribution (main_pm vs main_designer) — shared by
    // /business-reports/pm-analysis-source and /design-reports/project-type-analysis.
    const [bwaPitches, bwfPitches, bwaConverted, bwfConverted] = await Promise.all([
      fetchAllProjectRows(
        "bwa_pitchings",
        `
          id, pitching_code, enquiry_date, main_pm_id, main_designer_id,
          n_service_type_id,
          real_customer_display_name, real_customer_co_name,
          pm:staff!fk_bwa_pitchings_main_pm_id(id, name),
          designer:staff!fk_bwa_pitchings_main_designer_id(id, name),
          st:service_types!fk_bwa_pitchings_n_service_type_id(id, display)
        `,
        "fetchPMSourcePitches/bwa",
      ),
      fetchAllProjectRows(
        "bwf_pitchings",
        `
          id, pitching_code, pitching_name, enquiry_date, main_pm_id, main_designer_id,
          n_bwf_service_types_id, n_customer_type_id,
          real_customer_display_name, real_customer_name,
          pm:staff!fk_bwf_pitchings_main_pm_id(id, name),
          designer:staff!fk_bwf_pitchings_main_designer_id(id, name),
          st:nos_service_type_2!fk_bwf_pitchings_n_bwf_service_types_id(id, display),
          ctype:client_types!fk_bwf_pitchings_n_customer_type_id(id, display)
        `,
        "fetchPMSourcePitches/bwf",
      ),
      fetchConvertedProjectMap("BWA", "", "fetchPMSourcePitches/bwaProjects"),
      fetchConvertedProjectMap("BWF", "", "fetchPMSourcePitches/bwfProjects"),
    ]);

    const [bwfJunctionStMap, bwaPitchPtNames, bwaPitchPtIds] = await Promise.all([
      resolveBwfJunctionServiceTypesForPitchings(bwfPitches.map((p) => p.id)),
      resolveJunctionProjectTypesForPitchings(bwaPitches.map((p) => p.id)),
      resolveJunctionProjectTypeIdsForPitchings(bwaPitches.map((p) => p.id)),
    ]);

    const mappedBwa: PMSourcePitch[] = bwaPitches.map((p: any) => {
      const proj = bwaConverted.get(p.id);
      const staff = sourceAnalysisStaffOf(p, role);
      const ptIdList = bwaPitchPtIds.get(p.id);
      return {
        id: p.id,
        source: "BWA" as BusinessReportSource,
        pitch_label: pitchLabelOf(p),
        pitch_code: p.pitching_code || null,
        enquiry_date: p.enquiry_date,
        pm_id: staff.id,
        pm_name: staff.name,
        project_type_id: ptIdList?.[0] ?? null,
        project_type_name: bwaPitchPtNames.get(p.id) || null,
        service_type_id: p.st?.id || p.n_service_type_id || null,
        service_type_name: p.st?.display || null,
        converted: !!proj,
        converted_status: proj?.status ?? null,
        filter_project_id: proj?.id ?? null,
      };
    });

    const mappedBwf: PMSourcePitch[] = bwfPitches.map((p: any) => {
      const proj = bwfConverted.get(p.id);
      const staff = sourceAnalysisStaffOf(p, role);
      return {
        id: p.id,
        source: "BWF" as BusinessReportSource,
        pitch_label: pitchLabelOf(p),
        pitch_code: p.pitching_code || null,
        enquiry_date: p.enquiry_date,
        pm_id: staff.id,
        pm_name: staff.name,
        project_type_id: p.ctype?.id || p.n_customer_type_id || null,
        project_type_name: p.ctype?.display || null,
        service_type_id: p.st?.id || p.n_bwf_service_types_id || null,
        service_type_name: bwfJunctionStMap.get(p.id) || p.st?.display || null,
        converted: !!proj,
        converted_status: proj?.status ?? null,
        filter_project_id: proj?.id ?? null,
      };
    });

    return [...mappedBwa, ...mappedBwf];
  }, [], "fetchPMSourcePitches");
}

// ─── BUSINESS REPORTS: OVERDUE RECEIVABLE ─────────────────
// One row per PM. For each PM we count their pitches and converted projects
// (same pitch/conversion model as the Hit Rate report), then layer on the
// receivables side: how many of their projects carry OVERDUE invoices and the
// total overdue amount. An invoice is "overdue" when its due_date is in the
// past and net receivable (outstanding - bad_debts) > 0.
//
// The report window filters on the pitch's enquiry_date (matching the old
// bubble.io screen's note: "based on orders with a project enquiry date in the
// selected period"). Avg Overdue% is the per-project average of
//   overdue_outstanding / estimated_income
// so a project owing more than it was estimated to bill can exceed 100%.
export interface OverdueReceivablePitch extends PitchProjectFilterDims {
  id: string;
  source: BusinessReportSource; // BWA 裝修 | BWF 傢俬
  pm_id: string | null;
  pm_name: string | null;
  enquiry_date: string | null;
  converted: boolean;          // a BWA project links back to this pitching
  converted_status: string | null;
  // Display label for the pitch (customer / code), for hover breakdowns.
  pitch_label: string | null;
  // Overdue receivables on the linked (converted) project, if any.
  project_id: string | null;           // converted project id (for detail link)
  project_label: string | null;       // converted project name / code
  estimated_income: number | null;    // converted project's estimated income
  overdue_amount: number;              // sum of outstanding on past-due invoices
}

// Sum net receivable outstanding per project across both link columns (BWA
// project_id + BWF bwf_project_id), applying the same predicates to each.
// Net = outstanding - bad_debts (never negative). Rows with net <= 0 are skipped.
// Returns a single map — BWA and BWF project UUIDs cannot collide.
async function sumIncomesByProjectBothSides(
  applyFilters: (q: any) => any,
  context: string,
): Promise<Map<string, number>> {
  const PAGE_SIZE = 1000;
  const target = new Map<string, number>();
  for (const fkColumn of ["project_id", "bwf_project_id"] as const) {
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const from = page * PAGE_SIZE;
      let q = supabase
        .from("incomes")
        .select(`${fkColumn}, outstanding, bad_debts`)
        .not(fkColumn, "is", null);
      q = applyFilters(q);
      const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
      if (error) {
        logError(`${context}/${fkColumn}`, error);
        break;
      }
      for (const row of (data ?? []) as any[]) {
        const pid = row[fkColumn];
        if (!pid) continue;
        const net = incomeNetOutstanding(row);
        if (net <= 0) continue;
        target.set(pid, (target.get(pid) || 0) + net);
      }
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }
  }
  return target;
}

export async function fetchOverdueReceivablePitches(): Promise<OverdueReceivablePitch[]> {
  return safeQuery(async () => {
    // ── 1. All pitchings (BWA + BWF) with PM + enquiry date ──
    const pitches = await fetchAllPitchRows("fetchOverdueReceivablePitches");

    // ── 2. Map each converted pitching id → its linked project, per side ──
    // (status drives the count rules; id is needed to attach overdue amounts.)
    const [bwaConverted, bwfConverted] = await Promise.all([
      fetchConvertedProjectMap(
        "BWA",
        CONVERTED_PROJECT_FILTER_COLS_BWA,
        "fetchOverdueReceivablePitches/projects",
      ),
      fetchConvertedProjectMap(
        "BWF",
        CONVERTED_PROJECT_FILTER_COLS_BWF,
        "fetchOverdueReceivablePitches/bwfProjects",
      ),
    ]);

    // ── 3. Sum overdue net outstanding per project (both sides) ──
    // Overdue = past due_date with net receivable (outstanding - bad_debts) > 0.
    const nowIso = new Date().toISOString();
    const overdueByProject = await sumIncomesByProjectBothSides(
      (q) => q.lt("due_date", nowIso).gt("outstanding", 0),
      "fetchOverdueReceivablePitches/incomes",
    );

    const junctionCtx = await buildBwaPitchProjectTypeJunctionCtx(pitches, bwaConverted);

    return pitches.map((p: any) => {
      const proj = (p.source === "BWF" ? bwfConverted : bwaConverted).get(p.id) ?? null;
      const overdue = proj ? overdueByProject.get(proj.id) || 0 : 0;
      const dims = pitchProjectFilterDimsOf(p, proj, junctionCtx);
      return {
        id: p.id,
        source: p.source,
        pm_id: p.pm?.id || p.main_pm_id || null,
        pm_name: p.pm?.name || null,
        enquiry_date: p.enquiry_date,
        converted: !!proj,
        converted_status: proj?.status ?? null,
        pitch_label: pitchLabelOf(p),
        project_id: proj?.id ?? null,
        project_label: proj ? proj.project_name || proj.project_code || null : null,
        estimated_income: proj?.estimated_income ?? null,
        overdue_amount: overdue,
        ...dims,
      };
    });
  }, [], "fetchOverdueReceivablePitches");
}

// ─── BUSINESS REPORTS: A.O. PROJECT ───────────────────────
// "A.O." = Additional Order: extra income lines billed on top of a
// project's Main contract amount (新增了 A.O. 項目的 Project). In the
// incomes table these are the rows whose contract type is flagged
// nos_contracts.is_ao = TRUE (several A.O. contract types exist); Main is
// the original signed amount (type_display = 'Main').
//
// One row per pitching, attributed to its main PM (same backbone as the
// PM Hit Rate report). For pitches that converted to a project we also
// attach that project's A.O. and Main income totals so the report can show:
//   • Total Pitches      — pitches with an enquiry_date in the window
//   • Converted Projects — pitches whose linked project counts (計隻數)
//   • A.O. Projects      — converted projects carrying at least one A.O. line
//   • Total A.O. Amount  — Σ A.O. income across those projects
//   • Avg A.O.%          — mean of per-project (A.O. ÷ Main) over A.O. projects
export interface AOProjectPitch {
  id: string;
  source: BusinessReportSource; // BWA 裝修 | BWF 傢俬
  pm_id: string | null;
  pm_name: string | null;
  pitch_label: string | null;
  enquiry_date: string | null;
  // Linked (converted) project, if any.
  converted: boolean;
  converted_status: string | null;
  project_id: string | null;
  project_label: string | null;
  // signed_date of the converted project (the report windows on this so A.O.
  // projects surface in the period they were signed, not the pitch enquiry).
  signed_date: string | null;
  // Income totals on the converted project.
  ao_amount: number;   // Σ income whose contract type has is_ao = TRUE
  main_amount: number; // Σ income where type_display = 'Main'
}

export async function fetchAOProjectPitches(): Promise<AOProjectPitch[]> {
  return safeQuery(async () => {
    // ── 1. All pitchings (BWA + BWF) with PM + enquiry date ──
    const pitches = await fetchAllPitchRows("fetchAOProjectPitches");

    // ── 2. Map each converted pitching id → its linked project, per side ──
    const projCols = "project_name, project_code, signed_date";
    const [bwaConverted, bwfConverted] = await Promise.all([
      fetchConvertedProjectMap("BWA", projCols, "fetchAOProjectPitches/projects"),
      fetchConvertedProjectMap("BWF", projCols, "fetchAOProjectPitches/bwfProjects"),
    ]);
    const bwaProjectIds = Array.from(bwaConverted.values(), (p: any) => p.id as string);
    const bwfProjectIds = Array.from(bwfConverted.values(), (p: any) => p.id as string);

    // ── 3. Aggregate A.O. and Main income per converted project ──
    // An income line is "A.O." when its contract type is flagged
    // nos_contracts.is_ao = TRUE (there are several A.O. contract types, so we
    // match on the id set rather than the legacy type_display text heuristic).
    // The same contract-type taxonomy covers BWA and BWF income lines.
    const aoContractIds = new Set<string>();
    {
      const { data: aoTypes, error: aoTypesErr } = await supabase
        .from("nos_contracts")
        .select("id")
        .eq("is_ao", true);
      if (aoTypesErr) logError("fetchAOProjectPitches/nos_contracts", aoTypesErr);
      for (const t of aoTypes ?? []) if (t.id) aoContractIds.add(t.id);
    }

    const aoByProject = new Map<string, number>();
    const mainByProject = new Map<string, number>();
    const BATCH = 200;
    for (const [fkColumn, ids] of [
      ["project_id", bwaProjectIds],
      ["bwf_project_id", bwfProjectIds],
    ] as const) {
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const rows = await fetchAllByFk(
          "incomes",
          `${fkColumn}, income_amount, type_display, n_contract_type_id`,
          fkColumn,
          batch,
          (q) => q.not("income_amount", "is", null),
        );
        for (const row of rows) {
          const pid = row[fkColumn];
          if (!pid) continue;
          const amt = Number(row.income_amount) || 0;
          if (row.n_contract_type_id && aoContractIds.has(row.n_contract_type_id)) {
            aoByProject.set(pid, (aoByProject.get(pid) || 0) + amt);
          } else if ((row.type_display || "").trim().toLowerCase() === "main") {
            mainByProject.set(pid, (mainByProject.get(pid) || 0) + amt);
          }
        }
      }
    }

    return pitches.map((p: any) => {
      const proj = (p.source === "BWF" ? bwfConverted : bwaConverted).get(p.id) ?? null;
      return {
        id: p.id,
        source: p.source,
        pm_id: p.pm?.id || p.main_pm_id || null,
        pm_name: p.pm?.name || null,
        pitch_label: pitchLabelOf(p),
        enquiry_date: p.enquiry_date,
        converted: !!proj,
        converted_status: proj?.status ?? null,
        project_id: proj?.id ?? null,
        project_label: proj ? proj.project_name || proj.project_code || null : null,
        signed_date: proj?.signed_date ?? null,
        ao_amount: proj ? aoByProject.get(proj.id) || 0 : 0,
        main_amount: proj ? mainByProject.get(proj.id) || 0 : 0,
      };
    });
  }, [], "fetchAOProjectPitches");
}

// ─── BUSINESS REPORTS: OUTSTANDING PROJECT ────────────────
// One row per PM. Same pitch/conversion model as the Overdue Receivable
// report, but the receivables side measures OUTSTANDING balances rather than
// overdue ones: an invoice contributes whenever net receivable
// (outstanding - bad_debts) > 0, regardless of whether its due_date has passed.
// (Overdue is the past-due subset of Outstanding.)
//
// The report window filters on the pitch's enquiry_date. Avg Outstanding% is
// the per-project average of outstanding / estimated_income, so a project
// owing more than it was estimated to bill can exceed 100%.
export interface OutstandingProjectPitch extends PitchProjectFilterDims {
  id: string;
  source: BusinessReportSource; // BWA 裝修 | BWF 傢俬
  pm_id: string | null;
  pm_name: string | null;
  enquiry_date: string | null;
  converted: boolean;          // a BWA project links back to this pitching
  converted_status: string | null;
  pitch_label: string | null;
  project_id: string | null;           // converted project id (for detail link)
  project_label: string | null;       // converted project name / code
  estimated_income: number | null;    // converted project's estimated income
  outstanding_amount: number;          // sum of outstanding across the project's invoices
}

export async function fetchOutstandingProjectPitches(): Promise<OutstandingProjectPitch[]> {
  return safeQuery(async () => {
    // ── 1. All pitchings (BWA + BWF) with PM + enquiry date ──
    const pitches = await fetchAllPitchRows("fetchOutstandingProjectPitches");

    // ── 2. Map each converted pitching id → its linked project, per side ──
    const [bwaConverted, bwfConverted] = await Promise.all([
      fetchConvertedProjectMap(
        "BWA",
        CONVERTED_PROJECT_FILTER_COLS_BWA,
        "fetchOutstandingProjectPitches/projects",
      ),
      fetchConvertedProjectMap(
        "BWF",
        CONVERTED_PROJECT_FILTER_COLS_BWF,
        "fetchOutstandingProjectPitches/bwfProjects",
      ),
    ]);

    // ── 3. Sum net outstanding balance per project (both sides) ──
    // Outstanding = net receivable (outstanding - bad_debts) > 0; no due-date filter.
    const outstandingByProject = await sumIncomesByProjectBothSides(
      (q) => q.gt("outstanding", 0),
      "fetchOutstandingProjectPitches/incomes",
    );

    const junctionCtx = await buildBwaPitchProjectTypeJunctionCtx(pitches, bwaConverted);

    return pitches.map((p: any) => {
      const proj = (p.source === "BWF" ? bwfConverted : bwaConverted).get(p.id) ?? null;
      const outstanding = proj ? outstandingByProject.get(proj.id) || 0 : 0;
      const dims = pitchProjectFilterDimsOf(p, proj, junctionCtx);
      return {
        id: p.id,
        source: p.source,
        pm_id: p.pm?.id || p.main_pm_id || null,
        pm_name: p.pm?.name || null,
        enquiry_date: p.enquiry_date,
        converted: !!proj,
        converted_status: proj?.status ?? null,
        pitch_label: pitchLabelOf(p),
        project_id: proj?.id ?? null,
        project_label: proj ? proj.project_name || proj.project_code || null : null,
        estimated_income: proj?.estimated_income ?? null,
        outstanding_amount: outstanding,
        ...dims,
      };
    });
  }, [], "fetchOutstandingProjectPitches");
}

// ─── BUSINESS REPORTS: BAD DEBT PROJECT ───────────────────
// A "Bad Debt" project is one whose income lines carry a non-zero
// `bad_debts` write-off (已記錄為壞帳的項目). Same backbone as the A.O.
// and PM Hit Rate reports: one row per pitching, attributed to its main
// PM, with the converted project's bad-debt and Main income totals attached
// so the report can show:
//   • Total Pitches      — pitches with an enquiry_date in the window
//   • Converted Projects — pitches whose linked project counts (計隻數)
//   • Bad Debt Projects  — converted projects carrying a bad-debt write-off
//   • Total Bad Debt Amt — Σ bad_debts across those projects
//   • Avg Bad Debt%      — mean of per-project (bad_debt ÷ Main) over them
export interface BadDebtProjectPitch extends PitchProjectFilterDims {
  id: string;
  source: BusinessReportSource; // BWA 裝修 | BWF 傢俬
  pm_id: string | null;
  pm_name: string | null;
  pitch_label: string | null;
  enquiry_date: string | null;
  converted: boolean;
  converted_status: string | null;
  project_id: string | null;
  project_label: string | null;
  bad_debt_amount: number; // Σ incomes.bad_debts on the converted project
  main_amount: number;     // Σ income where type_display = 'Main'
}

export async function fetchBadDebtProjectPitches(): Promise<BadDebtProjectPitch[]> {
  return safeQuery(async () => {
    // ── 1. All pitchings (BWA + BWF) with PM + enquiry date ──
    const pitches = await fetchAllPitchRows("fetchBadDebtProjectPitches");

    // ── 2. Map each converted pitching id → its linked project, per side ──
    const [bwaConverted, bwfConverted] = await Promise.all([
      fetchConvertedProjectMap(
        "BWA",
        CONVERTED_PROJECT_FILTER_COLS_BWA,
        "fetchBadDebtProjectPitches/projects",
      ),
      fetchConvertedProjectMap(
        "BWF",
        CONVERTED_PROJECT_FILTER_COLS_BWF,
        "fetchBadDebtProjectPitches/bwfProjects",
      ),
    ]);
    const bwaProjectIds = Array.from(bwaConverted.values(), (p: any) => p.id as string);
    const bwfProjectIds = Array.from(bwfConverted.values(), (p: any) => p.id as string);

    // ── 3. Aggregate bad-debt write-offs and Main income per project ──
    const badDebtByProject = new Map<string, number>();
    const mainByProject = new Map<string, number>();
    const BATCH = 200;
    for (const [fkColumn, ids] of [
      ["project_id", bwaProjectIds],
      ["bwf_project_id", bwfProjectIds],
    ] as const) {
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const rows = await fetchAllByFk(
          "incomes",
          `${fkColumn}, income_amount, bad_debts, type_display`,
          fkColumn,
          batch,
        );
        for (const row of rows) {
          const pid = row[fkColumn];
          if (!pid) continue;
          const bd = Number(row.bad_debts) || 0;
          if (bd) {
            badDebtByProject.set(pid, (badDebtByProject.get(pid) || 0) + bd);
          }
          if ((row.type_display || "").trim().toLowerCase() === "main") {
            mainByProject.set(pid, (mainByProject.get(pid) || 0) + (Number(row.income_amount) || 0));
          }
        }
      }
    }

    const junctionCtx = await buildBwaPitchProjectTypeJunctionCtx(pitches, bwaConverted);

    return pitches.map((p: any) => {
      const proj = (p.source === "BWF" ? bwfConverted : bwaConverted).get(p.id) ?? null;
      const dims = pitchProjectFilterDimsOf(p, proj, junctionCtx);
      return {
        id: p.id,
        source: p.source,
        pm_id: p.pm?.id || p.main_pm_id || null,
        pm_name: p.pm?.name || null,
        pitch_label: pitchLabelOf(p),
        enquiry_date: p.enquiry_date,
        converted: !!proj,
        converted_status: proj?.status ?? null,
        project_id: proj?.id ?? null,
        project_label: proj ? proj.project_name || proj.project_code || null : null,
        bad_debt_amount: proj ? badDebtByProject.get(proj.id) || 0 : 0,
        main_amount: proj ? mainByProject.get(proj.id) || 0 : 0,
        ...dims,
      };
    });
  }, [], "fetchBadDebtProjectPitches");
}

// ─── PROJECT BV: RECOMPUTE DERIVED FIGURES ────────────────
// project_bv is a derived table — only handler / project FK / ratio are inputs.
// recalculate_project_bv(project_id) rewrites estimated/actual GP, shared
// splits, and BV units (÷ nos_bv_values) from the linked BWA or BWF project.
// DB triggers already run this on project/income/expense changes, on
// project_bv insert, and on ratio update. This RPC is a manual fallback.
export async function recalculateProjectBV(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  if (!projectId) return { success: false, error: "missing projectId" };
  const { error } = await supabase.rpc("recalculate_project_bv", {
    p_project_id: projectId,
  });
  if (error) {
    logError("recalculateProjectBV", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
// Bubble stores image urls protocol-relative ("//xxx.cdn.bubble.io/..."),
// which break in <img src> on some browsers — normalise to https.
// ─── EXPENSE-LOCKED PROJECTS (no Site Status) ─────────────────
// Expense-locked projects are now computed by the bulk server route
// /api/expense-locked (mirrors evaluateExpenseControl in one batched pass), so
// the admin list reflects the real Expense Control checklist. This type +
// fetchExpenseControlCandidates remain as a client-side fallback / shared shape.
// Superset of SalesByPMProject so the shared ProjectFilterBar /
// applyProjectFilters can be reused directly on this list.
export interface ExpenseLockedProject extends SalesByPMProject {
  customer_name: string | null;
  expense_count: number; // existing expense rows already on the project
}

/**
 * Candidate projects for the Expense-Locked admin list (legacy client fallback).
 * Prefer /api/expense-locked which uses evaluateBulkExpenseLockedProjects.
 * Drops 小於$30K (project_size / income-derived) — mirrors expense-control-service.
 */
export async function fetchExpenseControlCandidates(): Promise<ExpenseLockedProject[]> {
  return safeQuery(async () => {
    // Reuse fetchSalesByPMProjects so the shared ProjectFilterBar fields (BU,
    // service/project type, financial year, B2B/B2C, est_income, etc.) come for
    // free and stay consistent with the business reports.
    const allProjects = await fetchSalesByPMProjects();

    // No Expense Control for 小於$30K only. SalesByPMProject has no project_size;
    // income-derived band is used here. Live lists use /api/expense-locked (bulk).
    const candidates = allProjects.filter((p) => {
      const size = resolveBwaProjectSize(null, p.est_income);
      return !!size && size !== "小於$30K";
    });

    // Existing expense counts + customer name for the candidate projects.
    const expenseCount = new Map<string, number>();
    const customerName = new Map<string, string | null>();
    const ids = candidates.map((p) => p.id);
    const BATCH = 200;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const [expenseRows, projRes] = await Promise.all([
        fetchAllByProject("expenses", "project_id", batch),
        supabase
          .from("bwa_projects")
          .select(`
            id, real_customer_display_name,
            cust:customers!fk_bwa_projects_customer_id(customer_name, company_name)
          `)
          .in("id", batch),
      ]);
      if (projRes.error) logError("fetchExpenseControlCandidates/customers", projRes.error);
      for (const row of expenseRows) {
        if (!row.project_id) continue;
        expenseCount.set(row.project_id, (expenseCount.get(row.project_id) || 0) + 1);
      }
      for (const row of (projRes.data ?? []) as any[]) {
        customerName.set(
          row.id,
          row.real_customer_display_name ||
            row.cust?.customer_name ||
            row.cust?.company_name ||
            null,
        );
      }
    }

    return candidates.map((p) => ({
      ...p,
      customer_name: customerName.get(p.id) ?? null,
      expense_count: expenseCount.get(p.id) || 0,
    }));
  }, [], "fetchExpenseControlCandidates");
}

// ─── SUPPLIER LOAD (主要承辦商工作負載) ──────────────────────────────
// One row per project that has a main contractor (main_contractor_id) plus a
// start_date and handover_date. The /supplier-load board groups these by
// supplier and computes a time-based completion % from start→handover.

export interface SupplierLoadProject {
  id: string;
  project_code: string | null;
  project_name: string | null;
  status: string | null;
  start_date: string | null;
  handover_date: string | null;
  customer_name: string | null;
  pm_name: string | null;
  estimated_income: number | null;
  supplier_id: string;
  supplier_name: string | null;
  source: "bwa" | "bwf";
}

export async function fetchSupplierLoadProjects(): Promise<SupplierLoadProject[]> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;
    const out: SupplierLoadProject[] = [];

    // ── BWA projects ──
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("bwa_projects")
        .select(`
          id, project_code, project_name, status, start_date, handover_date,
          estimated_income, main_contractor_id,
          real_customer_display_name, real_customer_name,
          main_pm:staff!fk_bwa_projects_main_pm_id(id, name),
          cust:customers!fk_bwa_projects_customer_id(id, customer_name, company_name),
          sup:suppliers!fk_bwa_projects_main_contractor_id(id, name, display_name)
        `)
        .not("main_contractor_id", "is", null)
        .not("start_date", "is", null)
        .not("handover_date", "is", null)
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        logError("fetchSupplierLoadProjects/bwa", error);
        break;
      }
      for (const p of (data ?? []) as any[]) {
        out.push({
          id: p.id,
          project_code: p.project_code,
          project_name: p.project_name,
          status: p.status,
          start_date: p.start_date,
          handover_date: p.handover_date,
          customer_name:
            p.real_customer_display_name || p.real_customer_name ||
            p.cust?.company_name || p.cust?.customer_name || null,
          pm_name: p.main_pm?.name || null,
          estimated_income: p.estimated_income,
          supplier_id: p.main_contractor_id,
          supplier_name: p.sup?.display_name || p.sup?.name || null,
          source: "bwa",
        });
      }
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }

    // ── BWF projects ──
    page = 0;
    hasMore = true;
    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("bwf_projects")
        .select(`
          id, project_code, project_name, status, start_date, handover_date,
          estimated_income, main_contractor_id,
          real_customer_display_name, real_customer_name,
          main_pm:staff!fk_bwf_projects_main_pm_id(id, name),
          cust:customers!fk_bwf_projects_customer_id(id, customer_name, company_name),
          sup:suppliers!fk_bwf_projects_main_contractor_id(id, name, display_name)
        `)
        .not("main_contractor_id", "is", null)
        .not("start_date", "is", null)
        .not("handover_date", "is", null)
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        logError("fetchSupplierLoadProjects/bwf", error);
        break;
      }
      for (const p of (data ?? []) as any[]) {
        out.push({
          id: p.id,
          project_code: p.project_code,
          project_name: p.project_name,
          status: p.status,
          start_date: p.start_date,
          handover_date: p.handover_date,
          customer_name:
            p.real_customer_display_name || p.real_customer_name ||
            p.cust?.company_name || p.cust?.customer_name || null,
          pm_name: p.main_pm?.name || null,
          estimated_income: p.estimated_income,
          supplier_id: p.main_contractor_id,
          supplier_name: p.sup?.display_name || p.sup?.name || null,
          source: "bwf",
        });
      }
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }

    return out;
  }, [], "fetchSupplierLoadProjects");
}

// ─── DESIGNER LOAD (設計師負載) ───────────────────────────────
// Concurrent load counted from pitching_bv / project_bv handlers (collaborators),
// not main_designer_id (single person only).
// Pitching stages: Enquiry + Pitching only
//   (Case Closed = out; Confirmed Project = project already created → exclude to avoid double count)
// Project status: Work In Progress only.
// Company BV handler row is excluded.

export type DesignerLoadJobType =
  | "bwa_pitching"
  | "bwa_project"
  | "bwf_pitching"
  | "bwf_project";

/** Pitching stages that count toward designer load. */
export const DESIGNER_LOAD_PITCHING_STAGES = ["Enquiry", "Pitching"] as const;

/** Project statuses that count toward designer load. */
export const DESIGNER_LOAD_PROJECT_STATUSES = ["Work In Progress"] as const;

/** Fixed "company" BV handler — not a person; never counts as load. */
const DESIGNER_LOAD_COMPANY_BV_HANDLER_ID =
  "00000000-0000-4000-8000-000000000001";

export interface DesignerLoadJob {
  id: string;
  job_type: DesignerLoadJobType;
  code: string | null;
  name: string | null;
  status_or_stage: string | null;
  enquiry_date: string | null;
  start_date: string | null;
  handover_date: string | null;
  customer_name: string | null;
  pm_name: string | null;
  /** BV handler staff id (pitching_bv.handler_id / project_bv.handler_id). */
  designer_id: string;
  source: "bwa" | "bwf";
  kind: "pitching" | "project";
}

export interface DesignerLoadStaff {
  staff_id: string;
  staff_name: string;
  position: string | null;
  status: string | null;
  team_id: string | null;
  team_name: string | null;
}

export interface DesignerLoadTeamOption {
  id: string;
  display: string;
}

/** Default team filter: Design + 3D Render (matched by team_types.display). */
export const DESIGNER_LOAD_DEFAULT_TEAM_DISPLAYS = ["Design", "3D Render"] as const;

/** Sentinel value for the combined Design + 3D Render dropdown option. */
export const DESIGNER_LOAD_TEAM_FILTER_DESIGN_3D = "design_3d";

export interface DesignerLoadBoardData {
  /** Active staff roster (plus any Active BV handler not already listed). */
  staff: DesignerLoadStaff[];
  /** One row per (BV handler × active job); filtered by stage/status rules above. */
  jobs: DesignerLoadJob[];
  /** Active team_types for the team dropdown. */
  teams: DesignerLoadTeamOption[];
}

function designerLoadJobRoute(jobType: DesignerLoadJobType, id: string): string {
  switch (jobType) {
    case "bwa_project":
      return `/projects/bwa/${id}`;
    case "bwa_pitching":
      return `/proposals/${id}`;
    case "bwf_project":
      return `/projects/bwf/${id}`;
    case "bwf_pitching":
      return `/bwf/proposals/${id}`;
  }
}

export function designerLoadJobHref(job: DesignerLoadJob): string {
  return designerLoadJobRoute(job.job_type, job.id);
}

type DesignerLoadEntityMeta = Omit<DesignerLoadJob, "designer_id">;

export async function fetchDesignerLoadBoard(): Promise<DesignerLoadBoardData> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;

    async function pageRows(
      table: string,
      select: string,
      applyFilters: (q: any) => any
    ): Promise<any[]> {
      const out: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const from = page * PAGE_SIZE;
        let q = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);
        q = applyFilters(q);
        const { data, error } = await q;
        if (error) {
          logError(`fetchDesignerLoadBoard/${table}`, error);
          break;
        }
        out.push(...(data ?? []));
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        page++;
      }
      return out;
    }

    async function fetchBvHandlers(
      table: "pitching_bv" | "project_bv",
      fkColumn: string,
      ids: string[]
    ): Promise<{ entityId: string; handlerId: string }[]> {
      const out: { entityId: string; handlerId: string }[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        if (chunk.length === 0) continue;
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from(table)
            .select(`handler_id, ${fkColumn}`)
            .in(fkColumn, chunk)
            .not("handler_id", "is", null)
            .neq("handler_id", DESIGNER_LOAD_COMPANY_BV_HANDLER_ID)
            .range(from, from + PAGE_SIZE - 1);
          if (error) {
            logError(`fetchDesignerLoadBoard/${table}/${fkColumn}`, error);
            break;
          }
          for (const row of data ?? []) {
            const handlerId = row.handler_id as string | null;
            const entityId = row[fkColumn] as string | null;
            if (!handlerId || !entityId) continue;
            if (handlerId === DESIGNER_LOAD_COMPANY_BV_HANDLER_ID) continue;
            out.push({ entityId, handlerId });
          }
          hasMore = (data?.length ?? 0) === PAGE_SIZE;
          from += PAGE_SIZE;
        }
      }
      return out;
    }

    const [bwaPitchRows, bwfPitchRows, bwaProjRows, bwfProjRows] =
      await Promise.all([
        pageRows(
          "bwa_pitchings",
          `id, pitching_code, description, pitching_stages, enquiry_date,
           real_customer_display_name, real_building_name,
           main_pm:staff!fk_bwa_pitchings_main_pm_id(id, name)`,
          (q) => q.in("pitching_stages", [...DESIGNER_LOAD_PITCHING_STAGES])
        ),
        pageRows(
          "bwf_pitchings",
          `id, pitching_code, pitching_name, pitching_stages, enquiry_date,
           real_customer_display_name, real_customer_name,
           main_pm:staff!fk_bwf_pitchings_main_pm_id(id, name)`,
          (q) => q.in("pitching_stages", [...DESIGNER_LOAD_PITCHING_STAGES])
        ),
        pageRows(
          "bwa_projects",
          `id, project_code, project_name, status, enquiry_date, start_date, handover_date,
           real_customer_display_name, real_customer_name,
           main_pm:staff!fk_bwa_projects_main_pm_id(id, name)`,
          (q) => q.in("status", [...DESIGNER_LOAD_PROJECT_STATUSES])
        ),
        pageRows(
          "bwf_projects",
          `id, project_code, project_name, status, enquiry_date, start_date, handover_date,
           real_customer_display_name, real_customer_name,
           main_pm:staff!fk_bwf_projects_main_pm_id(id, name)`,
          (q) => q.in("status", [...DESIGNER_LOAD_PROJECT_STATUSES])
        ),
      ]);

    const entityMeta = new Map<string, DesignerLoadEntityMeta>();

    for (const p of bwaPitchRows) {
      entityMeta.set(`bwa_pitching:${p.id}`, {
        id: p.id,
        job_type: "bwa_pitching",
        code: p.pitching_code ?? null,
        name:
          p.description ||
          p.real_customer_display_name ||
          p.real_building_name ||
          null,
        status_or_stage: p.pitching_stages ?? null,
        enquiry_date: p.enquiry_date ?? null,
        start_date: null,
        handover_date: null,
        customer_name: p.real_customer_display_name || null,
        pm_name: p.main_pm?.name || null,
        source: "bwa",
        kind: "pitching",
      });
    }
    for (const p of bwfPitchRows) {
      entityMeta.set(`bwf_pitching:${p.id}`, {
        id: p.id,
        job_type: "bwf_pitching",
        code: p.pitching_code ?? null,
        name:
          p.pitching_name ||
          p.real_customer_display_name ||
          p.real_customer_name ||
          null,
        status_or_stage: p.pitching_stages ?? null,
        enquiry_date: p.enquiry_date ?? null,
        start_date: null,
        handover_date: null,
        customer_name:
          p.real_customer_display_name || p.real_customer_name || null,
        pm_name: p.main_pm?.name || null,
        source: "bwf",
        kind: "pitching",
      });
    }
    for (const p of bwaProjRows) {
      entityMeta.set(`bwa_project:${p.id}`, {
        id: p.id,
        job_type: "bwa_project",
        code: p.project_code ?? null,
        name: p.project_name ?? null,
        status_or_stage: p.status ?? null,
        enquiry_date: p.enquiry_date ?? null,
        start_date: p.start_date ?? null,
        handover_date: p.handover_date ?? null,
        customer_name:
          p.real_customer_display_name || p.real_customer_name || null,
        pm_name: p.main_pm?.name || null,
        source: "bwa",
        kind: "project",
      });
    }
    for (const p of bwfProjRows) {
      entityMeta.set(`bwf_project:${p.id}`, {
        id: p.id,
        job_type: "bwf_project",
        code: p.project_code ?? null,
        name: p.project_name ?? null,
        status_or_stage: p.status ?? null,
        enquiry_date: p.enquiry_date ?? null,
        start_date: p.start_date ?? null,
        handover_date: p.handover_date ?? null,
        customer_name:
          p.real_customer_display_name || p.real_customer_name || null,
        pm_name: p.main_pm?.name || null,
        source: "bwf",
        kind: "project",
      });
    }

    const [
      bwaPitchHandlers,
      bwfPitchHandlers,
      bwaProjHandlers,
      bwfProjHandlers,
    ] = await Promise.all([
      fetchBvHandlers(
        "pitching_bv",
        "pitching_id",
        bwaPitchRows.map((r) => r.id)
      ),
      fetchBvHandlers(
        "pitching_bv",
        "bwf_pitching_id",
        bwfPitchRows.map((r) => r.id)
      ),
      fetchBvHandlers(
        "project_bv",
        "project_id",
        bwaProjRows.map((r) => r.id)
      ),
      fetchBvHandlers(
        "project_bv",
        "bwf_project_id",
        bwfProjRows.map((r) => r.id)
      ),
    ]);

    const jobs: DesignerLoadJob[] = [];
    const seen = new Set<string>();

    function pushJobs(
      jobType: DesignerLoadJobType,
      links: { entityId: string; handlerId: string }[]
    ) {
      for (const link of links) {
        const meta = entityMeta.get(`${jobType}:${link.entityId}`);
        if (!meta) continue;
        const key = `${link.handlerId}:${jobType}:${link.entityId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        jobs.push({ ...meta, designer_id: link.handlerId });
      }
    }

    pushJobs("bwa_pitching", bwaPitchHandlers);
    pushJobs("bwf_pitching", bwfPitchHandlers);
    pushJobs("bwa_project", bwaProjHandlers);
    pushJobs("bwf_project", bwfProjHandlers);

    function mapStaffRow(s: any): DesignerLoadStaff {
      const team = Array.isArray(s.team) ? s.team[0] : s.team;
      return {
        staff_id: s.id,
        staff_name: s.name || s.full_name || "未命名",
        position: s.position ?? null,
        status: s.status ?? null,
        team_id: s.n_team_type_id ?? team?.id ?? null,
        team_name: team?.display ?? null,
      };
    }

    // Roster: all Active staff (team filter applied in UI; default Design + 3D Render).
    const { data: rosterRows, error: rosterErr } = await supabase
      .from("staff")
      .select(
        `id, name, full_name, position, status, n_team_type_id,
         team:team_types!fk_staff_n_team_type_id(id, display)`
      )
      .eq("status", "Active")
      .order("name");
    if (rosterErr) logError("fetchDesignerLoadBoard/staff", rosterErr);

    const staffMap = new Map<string, DesignerLoadStaff>();
    for (const s of rosterRows ?? []) {
      staffMap.set(s.id, mapStaffRow(s));
    }

    const missingIds = Array.from(
      new Set(jobs.map((j) => j.designer_id).filter((id) => !staffMap.has(id)))
    );
    for (let i = 0; i < missingIds.length; i += 200) {
      const chunk = missingIds.slice(i, i + 200);
      const { data, error } = await supabase
        .from("staff")
        .select(
          `id, name, full_name, position, status, n_team_type_id,
           team:team_types!fk_staff_n_team_type_id(id, display)`
        )
        .in("id", chunk)
        .eq("status", "Active");
      if (error) {
        logError("fetchDesignerLoadBoard/staff-missing", error);
        continue;
      }
      for (const s of data ?? []) {
        staffMap.set(s.id, mapStaffRow(s));
      }
    }

    const { data: teamRows, error: teamErr } = await supabase
      .from("team_types")
      .select("id, display")
      .eq("is_active", true)
      .order("display");
    if (teamErr) logError("fetchDesignerLoadBoard/teams", teamErr);

    const teams: DesignerLoadTeamOption[] = (teamRows ?? []).map(
      (t: { id: string; display: string }) => ({
        id: t.id,
        display: t.display,
      })
    );

    const activeStaff = Array.from(staffMap.values()).filter(
      (s) => s.status === "Active"
    );

    return {
      staff: activeStaff,
      jobs,
      teams,
    };
  }, { staff: [], jobs: [], teams: [] }, "fetchDesignerLoadBoard");
}

// ─── FREQUENT SUPPLIERS REPORT (常用供應商) ───────────────────
// Usage = expenses.supplier_id. Frequency over the last 12 months;
// cohorts: new join/first-use in 3 months; long-term first use ≥12/24 months.

export type FrequentSupplierCohort = "frequent" | "new_3m" | "long_12" | "long_24";

export interface FrequentSupplierRow {
  id: string;
  display_name: string;
  status: string | null;
  real_level: string | null;
  join_date: string | null;
  type_id: string | null;
  type_label: string;
  type_ids: string[];
  /** Earliest expense ever (collaboration start by usage). */
  first_expense_date: string | null;
  /** Latest expense ever. */
  last_expense_date: string | null;
  expense_count_12m: number;
  project_count_12m: number;
  amount_12m: number;
  expense_count_24m: number;
  project_count_24m: number;
  amount_24m: number;
  /** Months from first expense to now (null if never used). */
  tenure_months: number | null;
  is_new_3m: boolean;
  is_long_12: boolean;
  is_long_24: boolean;
}

export interface FrequentSupplierTypeOption {
  id: string;
  label: string;
  order: number | null;
}

export interface FrequentSuppliersReportData {
  suppliers: FrequentSupplierRow[];
  types: FrequentSupplierTypeOption[];
  summary: {
    used_12m: number;
    new_3m: number;
    long_12: number;
    long_24: number;
  };
}

function monthsBetween(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  return Math.max(0, years * 12 + months);
}

export async function fetchFrequentSuppliersReport(): Promise<FrequentSuppliersReportData> {
  const empty: FrequentSuppliersReportData = {
    suppliers: [],
    types: [],
    summary: { used_12m: 0, new_3m: 0, long_12: 0, long_24: 0 },
  };

  return safeQuery(async () => {
    const PAGE_SIZE = 1000;
    const now = new Date();
    const ms3m = new Date(now);
    ms3m.setMonth(ms3m.getMonth() - 3);
    const ms12m = new Date(now);
    ms12m.setMonth(ms12m.getMonth() - 12);
    const ms24m = new Date(now);
    ms24m.setMonth(ms24m.getMonth() - 24);
    const t3 = ms3m.getTime();
    const t12 = ms12m.getTime();
    const t24 = ms24m.getTime();

    // ── Supplier types ──
    const { data: typeRows, error: typeErr } = await supabase
      .from("supplier_types")
      .select("id, display, chinese_display, order, is_active")
      .order("order", { ascending: true, nullsFirst: false });
    if (typeErr) logError("fetchFrequentSuppliersReport/types", typeErr);

    const allTypes: FrequentSupplierTypeOption[] = (typeRows ?? []).map((t: any) => ({
      id: t.id,
      label: t.chinese_display || t.display || "未分類",
      order: t.order ?? null,
    }));
    const types: FrequentSupplierTypeOption[] = (typeRows ?? [])
      .filter((t: any) => t.is_active !== false)
      .map((t: any) => ({
        id: t.id,
        label: t.chinese_display || t.display || "未分類",
        order: t.order ?? null,
      }));
    const typeLabelById = new Map(allTypes.map((t) => [t.id, t.label]));

    // ── Suppliers ──
    const suppliersRaw: any[] = [];
    {
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase
          .from("suppliers")
          .select("id, name, display_name, chinese_name, status, real_level, join_date, n_type_id")
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          logError("fetchFrequentSuppliersReport/suppliers", error);
          break;
        }
        suppliersRaw.push(...(data ?? []));
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        page++;
      }
    }

    // ── Junction types ──
    const junctionBySupplier = new Map<string, string[]>();
    {
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase
          .from("supplier_supplier_types")
          .select("supplier_id, supplier_type_id")
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          logError("fetchFrequentSuppliersReport/junction", error);
          break;
        }
        for (const row of data ?? []) {
          if (!row.supplier_id || !row.supplier_type_id) continue;
          const list = junctionBySupplier.get(row.supplier_id) ?? [];
          list.push(row.supplier_type_id);
          junctionBySupplier.set(row.supplier_id, list);
        }
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        page++;
      }
    }

    // ── Expenses (usage) ──
    type Agg = {
      first: number | null;
      last: number | null;
      exp12: number;
      exp24: number;
      amt12: number;
      amt24: number;
      proj12: Set<string>;
      proj24: Set<string>;
    };
    const usage = new Map<string, Agg>();

    {
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase
          .from("expenses")
          .select("supplier_id, created_date, installment_amount, project_id, bwf_project_id")
          .not("supplier_id", "is", null)
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          logError("fetchFrequentSuppliersReport/expenses", error);
          break;
        }
        for (const e of data ?? []) {
          const sid = e.supplier_id as string;
          if (!sid) continue;
          let agg = usage.get(sid);
          if (!agg) {
            agg = {
              first: null,
              last: null,
              exp12: 0,
              exp24: 0,
              amt12: 0,
              amt24: 0,
              proj12: new Set(),
              proj24: new Set(),
            };
            usage.set(sid, agg);
          }
          const created = e.created_date ? new Date(e.created_date).getTime() : NaN;
          if (!isNaN(created)) {
            if (agg.first === null || created < agg.first) agg.first = created;
            if (agg.last === null || created > agg.last) agg.last = created;
          }
          const amount = Number(e.installment_amount) || 0;
          const projectKey = (e.project_id as string) || (e.bwf_project_id as string) || null;
          if (!isNaN(created) && created >= t24) {
            agg.exp24++;
            agg.amt24 += amount;
            if (projectKey) agg.proj24.add(projectKey);
          }
          if (!isNaN(created) && created >= t12) {
            agg.exp12++;
            agg.amt12 += amount;
            if (projectKey) agg.proj12.add(projectKey);
          }
        }
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        page++;
      }
    }

    const rows: FrequentSupplierRow[] = [];
    for (const s of suppliersRaw) {
      const agg = usage.get(s.id);
      const typeIds =
        junctionBySupplier.get(s.id) ??
        (s.n_type_id ? [s.n_type_id] : []);
      const primaryTypeId = typeIds[0] ?? s.n_type_id ?? null;
      const typeLabel = primaryTypeId
        ? typeLabelById.get(primaryTypeId) ?? "未分類"
        : "未分類";

      const joinMs = s.join_date ? new Date(s.join_date).getTime() : NaN;
      const firstMs = agg?.first ?? null;
      const lastMs = agg?.last ?? null;

      // 新上合作：join_date 在 3 個月內；若無 join_date，則以首次費用為準
      const is_new_3m =
        (!isNaN(joinMs) && joinMs >= t3) ||
        (isNaN(joinMs) && firstMs !== null && firstMs >= t3);

      // 長期：首次合作早於 12/24 個月，且近 12 個月仍有使用
      const active12 = (agg?.exp12 ?? 0) > 0;
      const is_long_12 = active12 && firstMs !== null && firstMs < t12;
      const is_long_24 = active12 && firstMs !== null && firstMs < t24;

      const used12 = (agg?.exp12 ?? 0) > 0;
      // Keep suppliers that appear in any report cohort (incl. new join with no spend yet)
      if (!used12 && !is_new_3m) continue;

      rows.push({
        id: s.id,
        display_name: s.display_name || s.chinese_name || s.name || "—",
        status: s.status ?? null,
        real_level: s.real_level ?? null,
        join_date: s.join_date ?? null,
        type_id: primaryTypeId,
        type_label: typeLabel,
        type_ids: typeIds,
        first_expense_date: firstMs !== null ? new Date(firstMs).toISOString() : null,
        last_expense_date: lastMs !== null ? new Date(lastMs).toISOString() : null,
        expense_count_12m: agg?.exp12 ?? 0,
        project_count_12m: agg?.proj12.size ?? 0,
        amount_12m: agg?.amt12 ?? 0,
        expense_count_24m: agg?.exp24 ?? 0,
        project_count_24m: agg?.proj24.size ?? 0,
        amount_24m: agg?.amt24 ?? 0,
        tenure_months: firstMs !== null ? monthsBetween(new Date(firstMs), now) : null,
        is_new_3m,
        is_long_12,
        is_long_24,
      });
    }

    rows.sort((a, b) => {
      if (b.project_count_12m !== a.project_count_12m) {
        return b.project_count_12m - a.project_count_12m;
      }
      if (b.expense_count_12m !== a.expense_count_12m) {
        return b.expense_count_12m - a.expense_count_12m;
      }
      return b.amount_12m - a.amount_12m;
    });

    const summary = {
      used_12m: rows.filter((r) => r.expense_count_12m > 0).length,
      new_3m: rows.filter((r) => r.is_new_3m).length,
      long_12: rows.filter((r) => r.is_long_12).length,
      long_24: rows.filter((r) => r.is_long_24).length,
    };

    return { suppliers: rows, types, summary };
  }, empty, "fetchFrequentSuppliersReport");
}
