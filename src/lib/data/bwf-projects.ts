import {
  getStaffRowScope,
  type StaffDataScope,
} from "@/lib/staff-data-scope";
import {
  supabase,
  adminFetch,
  logError,
  safeQuery,
} from "@/lib/data/_core";
import {
  resolveBwfJunctionServiceTypesForProjects,
  resolveBwfJunctionServiceItemsForProjects,
  resolveBwfJunctionMajorQuotesForProjects,
} from "@/lib/data/junctions";
import type { PaginatedResult } from "@/lib/data/customers";
import type { LinkOption } from "@/lib/data/lookups";
import {
  fetchBWFPitchingCostStructure,
  type BWFCostStructureRow,
  type BWFPitchingCodeParams,
} from "@/lib/data/bwf-pitching";
import type {
  BWAProjectRow,
  QuotationExpenseRow,
  ProjectInitialExpenseRow,
  BWAProjectIncome,
  BWAProjectExpense,
  CascadeAnalysisResult,
} from "@/lib/data/bwa-projects";
import { syncProjectDatesToSchedules } from "@/lib/data/schedule";

// Shared row/detail types owned by bwa-projects (import type only — no re-export).

/**
 * Resolve BWF project IDs visible under the same role rules as Assign BV / BWA:
 * - `null` → company-wide (Admin / Super Admin)
 * - `[]` → no visible projects
 * - `string[]` → restrict to these bwf project ids
 *
 * User → projects where they appear on project_bv.bwf_project_id;
 * Senior → same team (bwf_projects.n_team_type_id) OR assigned via project_bv.
 */
export async function resolveVisibleBwfProjectIds(
  staffContext?: StaffDataScope
): Promise<string[] | null> {
  if (!staffContext?.staffId) return [];

  const scope = getStaffRowScope(staffContext.role);
  if (scope === "all") return null;

  const { data: bvData } = await supabase
    .from("project_bv")
    .select("bwf_project_id")
    .eq("handler_id", staffContext.staffId)
    .not("bwf_project_id", "is", null);

  const assignedIds = Array.from(
    new Set(
      ((bvData ?? []) as Array<{ bwf_project_id: string | null }>)
        .map((row) => row.bwf_project_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  if (scope === "assigned_only") return assignedIds;

  const ids = new Set<string>(assignedIds);
  if (staffContext.teamTypeId) {
    const PAGE_SIZE = 1000;
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data } = await supabase
        .from("bwf_projects")
        .select("id")
        .eq("n_team_type_id", staffContext.teamTypeId)
        .range(from, from + PAGE_SIZE - 1);
      const rows = data ?? [];
      for (const row of rows) {
        if (row.id) ids.add(row.id as string);
      }
      hasMore = rows.length === PAGE_SIZE;
      page++;
    }
  }

  return Array.from(ids);
}

/** BWF project IDs linked to a factory via junction table. */
export async function fetchBWFProjectIdsByFactory(factoryId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("bwf_project_factories")
    .select("project_id")
    .eq("factory_id", factoryId);
  if (error) {
    logError("fetchBWFProjectIdsByFactory", error);
    return [];
  }
  const ids = (data ?? [])
    .map((r: { project_id: string | null }) => r.project_id)
    .filter((id: string | null): id is string => Boolean(id));
  return Array.from(new Set(ids));
}

// ─── BWF PROJECT UPDATE ─────────────────────────────────

export interface BWFProjectUpdateData {
  project_code?: string;
  project_name?: string;
  project_content?: string;
  status?: string;
  payment_status?: string;
  customer_id?: string;
  real_customer_display_name?: string;
  main_pm_id?: string;
  main_designer_id?: string;
  other_pm_id?: string;
  more_pm_id?: string;
  estimated_income?: number;
  estimated_expense?: number;
  estimated_profit?: number;
  income_below_estimated_reason?: string | null;
  size?: string;
  os_size?: string;
  site_address?: string;
  r_district_id?: string;
  r_building_id?: string;
  n_financial_year_id?: string;
  n_team_type_id?: string;
  n_bwf_service_types_id?: string;
  n_source_id?: string;
  n_customer_type_id?: string;
  n_major_quotes_id?: string;
  n_service_items_id?: string;
  cost_center_id?: string | null;
  real_cost_centre?: string | null;
  enquiry_date?: string;
  signed_date?: string;
  start_date?: string;
  handover_date?: string;
  asana_link?: string;
  working_folder?: string;
  completion_photos?: string;
  modified_date?: string;
}

export async function updateBWFProject(
  id: string,
  updates: Partial<BWFProjectUpdateData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await adminFetch({ action: "update", table: "bwf_projects", id, updates });
    if (!result.success) return result;

    if ("start_date" in updates || "handover_date" in updates) {
      await syncProjectDatesToSchedules({
        projectId: id,
        entityType: "bwf_project",
        start_date: "start_date" in updates ? updates.start_date ?? null : undefined,
        handover_date: "handover_date" in updates ? updates.handover_date ?? null : undefined,
        mainPmId: "main_pm_id" in updates ? updates.main_pm_id ?? null : undefined,
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function analyzeBWFCascadeDelete(projectId: string): Promise<{ data?: CascadeAnalysisResult; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/supabase-functions-bwf-cascade-delete-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({ project_id: projectId, action: "analyze" }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error || "Analysis failed" };
    return { data: json };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function executeBWFCascadeDelete(
  projectId: string,
  selections: Record<string, boolean>,
  deleteProject: boolean,
  deletePitching: boolean,
  deleteCustomer: boolean = false
): Promise<{ success: boolean; deletion_log?: { table: string; deleted: number; error?: string }[]; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/supabase-functions-bwf-cascade-delete-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({
        project_id: projectId,
        action: "execute",
        selections,
        delete_project: deleteProject,
        delete_pitching: deletePitching,
        delete_customer: deleteCustomer,
      }),
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error || "Execution failed" };
    return json;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchBWFProjectServiceTypeIds(projectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("bwf_project_bwf_service_types")
    .select("service_type_id")
    .eq("project_id", projectId);
  if (error || !data) return [];
  return (data as { service_type_id: string }[]).map((r) => r.service_type_id).filter(Boolean);
}

export async function fetchBWFProjectServiceItemIds(projectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("bwf_project_service_items")
    .select("service_item_id")
    .eq("project_id", projectId);
  if (error || !data) return [];
  return (data as { service_item_id: string }[]).map((r) => r.service_item_id).filter(Boolean);
}

export async function fetchBWFProjectMajorQuoteIds(projectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("bwf_project_major_quotes")
    .select("major_quote_id")
    .eq("project_id", projectId);
  if (error || !data) return [];
  return (data as { major_quote_id: string }[]).map((r) => r.major_quote_id).filter(Boolean);
}

const BWF_SOURCE_PP_DISPLAY = "BWA-PP";

export async function generateBWFProjectCode(
  params: BWFPitchingCodeParams
): Promise<string> {
  try {
    const { serviceTypeId, sourceId, customerTypeId, financialYearId } = params;
    if (!serviceTypeId || !financialYearId) return "";

    const { data: serviceTypeRow } = await supabase
      .from("nos_service_type_2")
      .select("code")
      .eq("id", serviceTypeId)
      .maybeSingle();
    const group1 = (serviceTypeRow?.code || "").trim();
    if (!group1) return "";

    let isPP = false;
    if (sourceId) {
      const { data: sourceRow } = await supabase
        .from("source_types")
        .select("display")
        .eq("id", sourceId)
        .maybeSingle();
      isPP =
        (sourceRow?.display || "").trim().toUpperCase() ===
        BWF_SOURCE_PP_DISPLAY.toUpperCase();
    }

    let group2Prefix = "";
    if (isPP) {
      group2Prefix = "PP";
    } else if (customerTypeId) {
      const { data: customerTypeRow } = await supabase
        .from("client_types")
        .select("code")
        .eq("id", customerTypeId)
        .maybeSingle();
      group2Prefix = (customerTypeRow?.code || "").trim();
    }
    if (!group2Prefix) return "";

    const { data: fyRow } = await supabase
      .from("financial_years")
      .select("yy_code")
      .eq("id", financialYearId)
      .maybeSingle();
    const yyCode = (fyRow?.yy_code || "").trim();
    if (!yyCode) return "";

    const prefix = `${group1}-${group2Prefix}${yyCode}`;
    const { data: matching } = await supabase
      .from("bwf_projects")
      .select("project_code")
      .like("project_code", `${prefix}-%`);

    let maxNum = 0;
    for (const row of matching ?? []) {
      const code = row.project_code;
      if (!code || !code.startsWith(`${prefix}-`)) continue;
      const lastGroup = code.slice(prefix.length + 1).split("-")[0];
      const num = parseInt(lastGroup, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }

    return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
  } catch (err) {
    console.error("[generateBWFProjectCode] Error:", err);
    return "";
  }
}

/**
 * Generates a BWF P2 code: BWF{yy}{yy+1}{quote_initial}-{###}
 * Example: BWF2627IC-001
 */
export async function generateBWFP2Code(params: {
  financialYearId: string;
  mainPmId: string;
}): Promise<string> {
  try {
    const { financialYearId, mainPmId } = params;
    if (!financialYearId || !mainPmId) return "";

    const { data: staffRecord, error: staffErr } = await supabase
      .from("staff")
      .select("quote_initial")
      .eq("id", mainPmId)
      .maybeSingle();

    if (staffErr || !staffRecord?.quote_initial) {
      console.warn("[generateBWFP2Code] Could not fetch quote_initial for staff:", mainPmId);
      return "";
    }

    const quoteInitial = (staffRecord.quote_initial || "").trim();
    if (!quoteInitial) return "";

    const { data: fyRow, error: fyErr } = await supabase
      .from("financial_years")
      .select("yy_code")
      .eq("id", financialYearId)
      .maybeSingle();

    if (fyErr || !fyRow?.yy_code) {
      console.warn("[generateBWFP2Code] Could not fetch financial year:", financialYearId);
      return "";
    }

    const yyNum = parseInt(String(fyRow.yy_code).trim(), 10);
    if (isNaN(yyNum)) return "";
    const yearPart = `${String(yyNum).padStart(2, "0")}${String(yyNum + 1).padStart(2, "0")}`;
    const prefix = `BWF${yearPart}${quoteInitial}`;

    const { data: matchingProjects, error: searchErr } = await supabase
      .from("bwf_projects")
      .select("p2_code")
      .like("p2_code", `${prefix}-%`);

    if (searchErr) {
      console.warn("[generateBWFP2Code] Search error:", searchErr.message);
      return "";
    }

    let maxNum = 0;
    for (const row of matchingProjects ?? []) {
      if (!row.p2_code) continue;
      const afterPrefix = row.p2_code.slice(prefix.length);
      const dashMatch = afterPrefix.match(/^-(\d+)/);
      if (dashMatch) {
        const num = parseInt(dashMatch[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }

    return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
  } catch (err) {
    console.error("[generateBWFP2Code] Error:", err);
    return "";
  }
}

export interface CreateBWFProjectParams {
  project_code: string;
  p2_code?: string | null;
  project_name?: string;
  project_content?: string | null;
  status?: string;
  customer_id?: string | null;
  main_pm_id?: string | null;
  main_designer_id?: string | null;
  other_pm_id?: string | null;
  more_pm_id?: string | null;
  estimated_income?: number | null;
  estimated_expense?: number | null;
  estimated_profit?: number | null;
  size?: string | null;
  os_size?: string | null;
  site_address?: string | null;
  r_district_id?: string | null;
  r_building_id?: string | null;
  n_financial_year_id?: string | null;
  n_team_type_id?: string | null;
  n_bwf_service_types_id?: string | null;
  n_source_id?: string | null;
  n_customer_type_id?: string | null;
  n_major_quotes_id?: string | null;
  n_service_items_id?: string | null;
  cost_center_id?: string | null;
  enquiry_date?: string | null;
  signed_date?: string | null;
  start_date?: string | null;
  handover_date?: string | null;
  asana_link?: string | null;
  working_folder?: string | null;
  bwf_pitching_id?: string | null;
  sort_financial_year?: string | null;
  real_customer_display_name?: string | null;
  real_customer_name?: string | null;
  real_building_name?: string | null;
  real_cost_centre?: string | null;
}

export async function createBWFProject(
  params: CreateBWFProjectParams
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const insertData: Record<string, unknown> = {
      project_code: params.project_code,
      p2_code: params.p2_code || null,
      project_name: params.project_name || params.project_code,
      project_content: params.project_content || null,
      status: params.status || "Work In Progress",
      customer_id: params.customer_id || null,
      main_pm_id: params.main_pm_id || null,
      main_designer_id: params.main_designer_id || null,
      other_pm_id: params.other_pm_id || null,
      more_pm_id: params.more_pm_id || null,
      estimated_income: params.estimated_income ?? null,
      estimated_expense: params.estimated_expense ?? null,
      estimated_profit: params.estimated_profit ?? null,
      size: params.size || null,
      os_size: params.os_size || null,
      site_address: params.site_address || null,
      r_district_id: params.r_district_id || null,
      r_building_id: params.r_building_id || null,
      n_financial_year_id: params.n_financial_year_id || null,
      n_team_type_id: params.n_team_type_id || null,
      n_bwf_service_types_id: params.n_bwf_service_types_id || null,
      n_source_id: params.n_source_id || null,
      n_customer_type_id: params.n_customer_type_id || null,
      n_major_quotes_id: params.n_major_quotes_id || null,
      n_service_items_id: params.n_service_items_id || null,
      cost_center_id: params.cost_center_id || null,
      enquiry_date: params.enquiry_date || null,
      signed_date: params.signed_date || null,
      start_date: params.start_date || null,
      handover_date: params.handover_date || null,
      asana_link: params.asana_link || null,
      working_folder: params.working_folder || null,
      bwf_pitching_id: params.bwf_pitching_id || null,
      sort_financial_year: params.sort_financial_year || null,
      real_customer_display_name: params.real_customer_display_name || null,
      real_customer_name: params.real_customer_name || null,
      real_building_name: params.real_building_name || null,
      real_cost_centre: params.real_cost_centre || null,
      created_date: new Date().toISOString(),
      modified_date: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("bwf_projects")
      .insert(insertData)
      .select("id")
      .single();

    if (error) {
      console.error("[createBWFProject] Insert error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: unknown) {
    console.error("[createBWFProject] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── BWF (傢俬) PROJECTS ────────────────────────────────

export async function fetchBWFProjects(): Promise<BWAProjectRow[]> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let hasMore = true;
    let page = 0;

    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("bwf_projects")
        .select(`
          id, project_code, p2_code, project_name, status, payment_status,
          customer_id, main_pm_id, main_designer_id,
          estimated_income, estimated_expense, estimated_profit,
          size, os_size, site_address,
          r_district_id, r_building_id,
          n_financial_year_id, n_team_type_id, n_bwf_service_types_id, cost_center_id,
          enquiry_date, signed_date, start_date, handover_date, os_project_defect,
          real_customer_display_name, real_customer_name, real_building_name, real_cost_centre,
          asana_link, main_contractor_id, created_date,
          pm:staff!fk_bwf_projects_main_pm_id(id, name),
          designer:staff!fk_bwf_projects_main_designer_id(id, name),
          cust:customers!fk_bwf_projects_customer_id(id, customer_name, company_name),
          dist:districts!fk_bwf_projects_r_district_id(id, name, chinese_display),
          bldg:buildings!fk_bwf_projects_r_building_id(id, building_name),
          fy:financial_years!fk_bwf_projects_n_financial_year_id(id, display),
          tt:team_types!fk_bwf_projects_n_team_type_id(id, display),
          main_contractor_sup:suppliers!fk_bwf_projects_main_contractor_id(id, name, display_name),
          cc:cost_centres!fk_bwf_projects_cost_center_id(id, display, bu_code)
        `)
        .order("created_date", { ascending: false, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logError("fetchBWFProjects", error);
        break;
      }

      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }

    const projectIds = allData.map((p: any) => p.id);
    const junctionStMap = await resolveBwfJunctionServiceTypesForProjects(projectIds);

    return allData.map((p: any) => ({
      id: p.id,
      bubble_id: null,
      project_code: p.project_code,
      p2_code: p.p2_code ?? null,
      project_name: p.project_name,
      description: null,
      status: p.status,
      payment_status: p.payment_status,
      customer: null,
      customer_id: p.customer_id,
      customer_name: p.real_customer_display_name || p.real_customer_name || p.cust?.customer_name || null,
      customer_display_name: p.real_customer_display_name || p.cust?.company_name || null,
      main_pm: null,
      main_pm_id: p.main_pm_id,
      pm_name: p.pm?.name || null,
      main_designer: null,
      main_designer_id: p.main_designer_id,
      designer_name: p.designer?.name || null,
      other_pm: null,
      other_pm_id: null,
      other_pm_name: null,
      more_pm: null,
      more_pm_id: null,
      more_pm_name: null,
      estimated_income: p.estimated_income,
      estimated_expense: p.estimated_expense,
      estimated_profit: p.estimated_profit,
      size: p.size,
      actual_size: null,
      height_to_tc: null,
      height_to_bs: null,
      height_to_fc: null,
      project_size: p.os_size,
      site_address: p.site_address,
      r_nos_district_id: p.r_district_id,
      district_name: p.dist?.chinese_display || p.dist?.name || null,
      r_building: null,
      r_building_id: p.r_building_id,
      building_name: p.bldg?.building_name || p.real_building_name || null,
      n_financial_year: null,
      n_financial_year_id: p.n_financial_year_id,
      financial_year_name: p.fy?.display || null,
      n_team_type: null,
      n_team_type_id: p.n_team_type_id,
      team_type_name: p.tt?.display || null,
      n_service_type: null,
      n_service_type_id: p.n_bwf_service_types_id,
      service_type_name: junctionStMap.get(p.id) || null,
      n_project_type: null,
      project_type_name: null,
      cost_centre: null,
      cost_centre_id: p.cost_center_id,
      cost_centre_bu_code: p.cc?.bu_code || null,
      enquiry_date: p.enquiry_date,
      signed_date: p.signed_date,
      start_date: p.start_date,
      handover_date: p.handover_date,
      defect_done_date: null,
      os_project_defect: p.os_project_defect || null,
      e_outstanding_date: null,
      real_customer_display_name: p.real_customer_display_name,
      real_customer_name: p.real_customer_name,
      real_district_name: null,
      real_building_name: p.real_building_name,
      real_cost_centre: p.real_cost_centre,
      asana_link: p.asana_link,
      working_folder: null,
      main_contractor: null,
      main_contractor_id: p.main_contractor_id,
      main_contractor_name: p.main_contractor_sup?.display_name || p.main_contractor_sup?.name || null,
      main_air_supplier: null,
      main_air_supplier_id: null,
      main_air_supplier_name: null,
      main_network_supplier: null,
      main_network_supplier_id: null,
      main_network_supplier_name: null,
      supplier: null,
      supplier_id: null,
      pitching: null,
      pitching_id: null,
      os_schedule_group: null,
      created_date: p.created_date,
      modified_date: null,
      slug: null,
    })) as BWAProjectRow[];
  }, [], "fetchBWFProjects", 30000);
}

export interface BWFProjectDetailData extends BWAProjectRow {
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_raw_name: string | null;
  customer_raw_company: string | null;
  service_item_name: string | null;
  major_quote_name: string | null;
  source_name: string | null;
  customer_type_name: string | null;
  p2_code: string | null;
  completion_photos: string | null;
  incomes: BWAProjectIncome[];
  expenses: BWAProjectExpense[];
  quotation_expenses: QuotationExpenseRow[];
  project_initial_expenses: ProjectInitialExpenseRow[];
}

export async function fetchBWFProjectDetail(
  projectId: string
): Promise<BWFProjectDetailData | null> {
  return safeQuery(async () => {
    const detailSelect = `
        *,
        pm:staff!fk_bwf_projects_main_pm_id(id, name),
        designer:staff!fk_bwf_projects_main_designer_id(id, name),
        other_pm_staff:staff!fk_bwf_projects_other_pm_id(id, name),
        more_pm_staff:staff!fk_bwf_projects_more_pm_id(id, name),
        cust:customers!fk_bwf_projects_customer_id(id, customer_name, company_name, display_name, email, phone_display, address),
        dist:districts!fk_bwf_projects_r_district_id(id, name, chinese_display),
        bldg:buildings!fk_bwf_projects_r_building_id(id, building_name),
        fy:financial_years!fk_bwf_projects_n_financial_year_id(id, display),
        tt:team_types!fk_bwf_projects_n_team_type_id(id, display),
        src:source_types!fk_bwf_projects_n_source_id(id, display),
        ctype:client_types!fk_bwf_projects_n_customer_type_id(id, display),
        main_contractor_sup:suppliers!fk_bwf_projects_main_contractor_id(id, name, display_name),
        cc:cost_centres!fk_bwf_projects_cost_center_id(id, display, bu_code)
      `;

    let { data, error } = await supabase
      .from("bwf_projects")
      .select(detailSelect)
      .eq("id", projectId)
      .single();

    if (error) {
      console.warn("[fetchBWFProjectDetail] joined query failed, retrying plain select:", error.message);
      const fallback = await supabase
        .from("bwf_projects")
        .select("*")
        .eq("id", projectId)
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      logError("fetchBWFProjectDetail", error);
      return null;
    }
    if (!data) return null;

    const [junctionStMap, junctionSiMap, junctionMqMap] = await Promise.all([
      resolveBwfJunctionServiceTypesForProjects([projectId]),
      resolveBwfJunctionServiceItemsForProjects([projectId]),
      resolveBwfJunctionMajorQuotesForProjects([projectId]),
    ]);

    const { data: incomeData } = await supabase
      .from("incomes")
      .select("id, income_amount, payment_amount, outstanding, bad_debts, receive_date, due_date, expected_payment_date, remark, payment_status, status, payment_method, invoice_number, n_contract_type_id, type_display, created_date, pdf_file, expiry_reason_id, ao_request_date, ao_issue_date, ao_work_days, ao_design_firm_status, ao_quotation_firm_date, ao_work_status, ao_client_follow_up, ct:nos_contracts!fk_incomes_n_contract_type_id(id, display, chinese_display)")
      .eq("bwf_project_id", projectId)
      .order("receive_date", { ascending: false });

    const { data: expenseData, error: expErr } = await supabase
      .from("expenses")
      .select("id, installment_amount, converter_input_amount, paid_amount, outstanding, payment_date, due_date, expected_payment_date, remark_t, payment_status, type_display, supplier_id, factory_id, n_contract_type_id, n_supplier_type_id, payment_method_id, cheque_no, rank_report, invoice_number, pdf_file, supplier_quotation_file")
      .eq("bwf_project_id", projectId)
      .order("payment_date", { ascending: false });

    if (expErr) {
      console.warn("[fetchBWFProjectDetail] expense query error:", expErr.message);
    }

    const expSupplierIds = [...new Set((expenseData ?? []).map((e: any) => e.supplier_id).filter(Boolean))];
    let supplierMap: Record<string, string> = {};
    if (expSupplierIds.length > 0) {
      const { data: supData } = await supabase
        .from("suppliers")
        .select("id, name, display_name")
        .in("id", expSupplierIds);
      (supData ?? []).forEach((s: any) => {
        supplierMap[s.id] = s.display_name || s.name || "";
      });
    }

    const expFactoryIds = [...new Set((expenseData ?? []).map((e: any) => e.factory_id).filter(Boolean))];
    let factoryMap: Record<string, string> = {};
    if (expFactoryIds.length > 0) {
      const { data: facData } = await supabase
        .from("factories")
        .select("id, factory_name, display_name")
        .in("id", expFactoryIds);
      (facData ?? []).forEach((f: any) => {
        factoryMap[f.id] = f.factory_name || f.display_name || "";
      });
    }

    const expContractIds = [...new Set((expenseData ?? []).map((e: any) => e.n_contract_type_id).filter(Boolean))];
    let contractMap: Record<string, string> = {};
    if (expContractIds.length > 0) {
      const { data: ctData } = await supabase
        .from("nos_contracts")
        .select("id, display, chinese_display")
        .in("id", expContractIds);
      (ctData ?? []).forEach((c: any) => {
        contractMap[c.id] = c.chinese_display || c.display || "";
      });
    }

    const expSupplierTypeIds = [...new Set((expenseData ?? []).map((e: any) => e.n_supplier_type_id).filter(Boolean))];
    let supplierTypeMap: Record<string, string> = {};
    if (expSupplierTypeIds.length > 0) {
      const { data: stData } = await supabase
        .from("supplier_types")
        .select("id, display, chinese_display")
        .in("id", expSupplierTypeIds);
      (stData ?? []).forEach((st: any) => {
        supplierTypeMap[st.id] = st.chinese_display || st.display || "";
      });
    }

    const expPayMethodIds = [...new Set((expenseData ?? []).map((e: any) => e.payment_method_id).filter(Boolean))];
    let payMethodMap: Record<string, string> = {};
    if (expPayMethodIds.length > 0) {
      const { data: pmData } = await supabase
        .from("nos_payment_methods")
        .select("id, display")
        .in("id", expPayMethodIds);
      (pmData ?? []).forEach((pm: any) => {
        payMethodMap[pm.id] = pm.display || "";
      });
    }

    let quotExpData: any[] = [];
    let projInitExpData: any[] = [];
    const pitchingIdForCost = data.bwf_pitching_id || null;
    if (pitchingIdForCost) {
      const [quotRes, initRes] = await Promise.all([
        supabase
          .from("quotation_expenses")
          .select("id, amount, n_expense_type_id, created_by_id, st:supplier_types!fk_quotation_expenses_n_expense_type_id(id, display, chinese_display)")
          .eq("bwf_pitching_id", pitchingIdForCost),
        supabase
          .from("project_initial_expenses")
          .select("id, amount, n_expense_type_id, created_by_id, st:supplier_types!fk_project_initial_expenses_n_expense_type_id(id, display, chinese_display)")
          .eq("bwf_pitching_id", pitchingIdForCost),
      ]);

      if (quotRes.error) {
        console.warn("[fetchBWFProjectDetail] quotation_expenses query error:", quotRes.error.message);
        const { data: fallbackQuot } = await supabase
          .from("quotation_expenses")
          .select("id, amount, n_expense_type_id, created_by_id")
          .eq("bwf_pitching_id", pitchingIdForCost);
        quotExpData = fallbackQuot ?? [];
      } else {
        quotExpData = quotRes.data ?? [];
      }

      if (initRes.error) {
        console.warn("[fetchBWFProjectDetail] project_initial_expenses query error:", initRes.error.message);
        const { data: fallbackInit } = await supabase
          .from("project_initial_expenses")
          .select("id, amount, n_expense_type_id, created_by_id")
          .eq("bwf_pitching_id", pitchingIdForCost);
        projInitExpData = fallbackInit ?? [];
      } else {
        projInitExpData = initRes.data ?? [];
      }
    }

    const allCostExpTypeIds = [
      ...new Set([
        ...quotExpData.map((q: any) => q.n_expense_type_id),
        ...projInitExpData.map((p: any) => p.n_expense_type_id),
      ].filter(Boolean)),
    ];
    let costExpTypeMap: Record<string, string> = {};
    if (allCostExpTypeIds.length > 0) {
      const { data: stData } = await supabase
        .from("supplier_types")
        .select("id, display, chinese_display")
        .in("id", allCostExpTypeIds);
      (stData ?? []).forEach((st: any) => {
        costExpTypeMap[st.id] = st.chinese_display || st.display || "";
      });
    }

    return {
      id: data.id,
      bubble_id: data.bubble_id,
      project_code: data.project_code,
      project_name: data.project_name,
      description: data.project_content,
      status: data.status,
      payment_status: data.payment_status,
      customer: data.customer,
      customer_id: data.customer_id,
      customer_name: data.real_customer_display_name || data.real_customer_name || data.cust?.customer_name || null,
      customer_display_name: data.cust?.display_name || data.real_customer_display_name || null,
      customer_raw_name: data.cust?.customer_name || null,
      customer_raw_company: data.cust?.company_name || null,
      customer_email: data.cust?.email || null,
      customer_phone: data.cust?.phone_display || null,
      customer_address: data.cust?.address || null,
      main_pm: data.main_pm,
      main_pm_id: data.main_pm_id,
      pm_name: data.pm?.name || null,
      main_designer: data.main_designer,
      main_designer_id: data.main_designer_id,
      designer_name: data.designer?.name || null,
      other_pm: data.other_pm,
      other_pm_id: data.other_pm_id,
      other_pm_name: data.other_pm_staff?.name || null,
      more_pm: data.more_pm,
      more_pm_id: data.more_pm_id,
      more_pm_name: data.more_pm_staff?.name || null,
      estimated_income: data.estimated_income,
      estimated_expense: data.estimated_expense,
      estimated_profit: data.estimated_profit,
      income_below_estimated_reason: data.income_below_estimated_reason ?? null,
      size: data.size,
      project_size: data.os_size,
      site_address: data.site_address,
      r_nos_district_id: data.r_district_id,
      district_name: data.dist?.chinese_display || data.dist?.name || null,
      r_building: data.r_building,
      r_building_id: data.r_building_id,
      building_name: data.bldg?.building_name || data.real_building_name || null,
      n_financial_year: data.n_financial_year,
      n_financial_year_id: data.n_financial_year_id,
      financial_year_name: data.fy?.display || null,
      n_team_type: data.n_team_type,
      n_team_type_id: data.n_team_type_id,
      team_type_name: data.tt?.display || null,
      n_service_type: data.n_bwf_service_types,
      n_service_type_id: data.n_bwf_service_types_id,
      service_type_name: junctionStMap.get(projectId) || null,
      n_project_type: null,
      project_type_name: null,
      cost_centre: data.cost_center,
      cost_centre_id: data.cost_center_id,
      cost_centre_bu_code: data.cc?.bu_code || null,
      enquiry_date: data.enquiry_date,
      signed_date: data.signed_date,
      start_date: data.start_date,
      handover_date: data.handover_date,
      defect_done_date: null,
      e_outstanding_date: data.e_outstanding_date,
      real_customer_display_name: data.real_customer_display_name,
      real_customer_name: data.real_customer_name,
      real_district_name: null,
      real_building_name: data.real_building_name,
      real_cost_centre: data.real_cost_centre,
      asana_link: data.asana_link,
      working_folder: data.working_folder,
      main_contractor: data.main_contractor,
      main_contractor_id: data.main_contractor_id,
      main_contractor_name: data.main_contractor_sup?.display_name || data.main_contractor_sup?.name || null,
      main_air_supplier: null,
      main_air_supplier_id: null,
      main_air_supplier_name: null,
      main_network_supplier: null,
      main_network_supplier_id: null,
      main_network_supplier_name: null,
      supplier: data.supplier,
      supplier_id: data.supplier_id,
      pitching: data.bwf_pitching,
      pitching_id: data.bwf_pitching_id,
      os_schedule_group: null,
      created_date: data.created_date,
      modified_date: data.modified_date,
      slug: data.slug,
      service_item_name: junctionSiMap.get(projectId) || null,
      major_quote_name: junctionMqMap.get(projectId) || null,
      source_name: data.src?.display || null,
      customer_type_name: data.ctype?.display || null,
      p2_code: data.p2_code,
      completion_photos: data.completion_photos ?? null,
      incomes: (incomeData ?? []).map((i: any) => ({
        id: i.id,
        amount: i.income_amount,
        payment_amount: i.payment_amount,
        outstanding: i.outstanding,
        bad_debts: i.bad_debts ?? null,
        payment_date: i.receive_date,
        due_date: i.due_date,
        expected_payment_date: i.expected_payment_date || null,
        description: i.remark || i.type_display || null,
        status: i.status,
        payment_status: i.payment_status,
        payment_method: i.payment_method,
        invoice_number: i.invoice_number,
        n_contract_type_id: i.n_contract_type_id,
        contract_type_name: i.ct?.chinese_display || i.ct?.display || null,
        contract_type_chinese_name: i.ct?.chinese_display || null,
        contract_type_english_name: i.ct?.display || null,
        remark: i.remark,
        type_display: i.type_display,
        created_date: i.created_date,
        approved: null,
        pdf_file: i.pdf_file || null,
        expiry_reason_id: i.expiry_reason_id || null,
        ao_request_date: i.ao_request_date || null,
        ao_issue_date: i.ao_issue_date || null,
        ao_work_days: i.ao_work_days ?? null,
        ao_design_firm_status: i.ao_design_firm_status || null,
        ao_quotation_firm_date: i.ao_quotation_firm_date || null,
        ao_work_status: i.ao_work_status || null,
        ao_client_follow_up: i.ao_client_follow_up || null,
      })),
      expenses: (expenseData ?? []).map((e: any) => ({
        id: e.id,
        amount: e.installment_amount,
        converter_input_amount: e.converter_input_amount ?? null,
        paid_amount: e.paid_amount,
        outstanding: e.outstanding,
        payment_date: e.payment_date,
        due_date: e.due_date || null,
        expected_payment_date: e.expected_payment_date || null,
        description: e.remark_t || e.type_display || null,
        supplier_id: e.supplier_id,
        supplier_name: e.supplier_id ? (supplierMap[e.supplier_id] || null) : null,
        factory_id: e.factory_id || null,
        factory_name: e.factory_id ? (factoryMap[e.factory_id] || null) : null,
        n_contract_type_id: e.n_contract_type_id,
        contract_type_name: e.n_contract_type_id ? (contractMap[e.n_contract_type_id] || null) : null,
        n_supplier_type_id: e.n_supplier_type_id || null,
        supplier_type_name: e.n_supplier_type_id ? (supplierTypeMap[e.n_supplier_type_id] || null) : null,
        payment_method_id: e.payment_method_id || null,
        payment_method_name: e.payment_method_id ? (payMethodMap[e.payment_method_id] || null) : null,
        cheque_no: e.cheque_no || null,
        rank_report: e.rank_report || null,
        status: e.payment_status || null,
        payment_status: e.payment_status,
        invoice_number: e.invoice_number,
        remark: e.remark_t,
        type_display: e.type_display,
        pdf_file: e.pdf_file || null,
        supplier_quotation_file:
          typeof e.supplier_quotation_file === "string" && e.supplier_quotation_file.trim()
            ? e.supplier_quotation_file.trim()
            : null,
        approved: null,
      })),
      quotation_expenses: quotExpData.map((q: any) => ({
        id: q.id,
        amount: q.amount ?? null,
        expense_type_name: q.st?.chinese_display || q.st?.display || (q.n_expense_type_id ? (costExpTypeMap[q.n_expense_type_id] || null) : null),
        n_expense_type_id: q.n_expense_type_id || null,
        created_by_name: null,
      })),
      project_initial_expenses: projInitExpData.map((p: any) => ({
        id: p.id,
        amount: p.amount ?? null,
        expense_type_name: p.st?.chinese_display || p.st?.display || (p.n_expense_type_id ? (costExpTypeMap[p.n_expense_type_id] || null) : null),
        n_expense_type_id: p.n_expense_type_id || null,
        created_by_name: null,
      })),
    } as BWFProjectDetailData;
  }, null, "fetchBWFProjectDetail");
}

export async function fetchBWFProjectCostStructure(
  bwfProjectId: string,
  bwfPitchingId?: string | null
): Promise<BWFCostStructureRow[]> {
  if (bwfPitchingId) {
    return fetchBWFPitchingCostStructure(bwfPitchingId);
  }
  return safeQuery(async () => {
    const { data: proj } = await supabase
      .from("bwf_projects")
      .select("bwf_pitching_id")
      .eq("id", bwfProjectId)
      .maybeSingle();
    if (proj?.bwf_pitching_id) {
      return fetchBWFPitchingCostStructure(proj.bwf_pitching_id);
    }
    return [];
  }, [], "fetchBWFProjectCostStructure");
}

// Copied from bwf-orders.ts — Integrator should remove duplicates from orders barrel.
export async function searchBWFProjectOptions(searchTerm: string = "", limit: number = 30): Promise<LinkOption[]> {
  return safeQuery(async () => {
    let query = supabase
      .from("bwf_projects")
      .select("id, project_code, project_name, real_customer_display_name")
      .order("project_code", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (searchTerm) {
      const q = `%${searchTerm}%`;
      query = query.or(`project_code.ilike.${q},project_name.ilike.${q},real_customer_display_name.ilike.${q}`);
    }
    const { data, error } = await query;
    if (error) { logError("searchBWFProjectOptions", error); return []; }
    return (data ?? []).map((p: any) => ({
      id: p.id,
      label: p.project_code || "(無編號)",
      sublabel: p.project_name || p.real_customer_display_name || undefined,
    }));
  }, [], "searchBWFProjectOptions");
}

export async function fetchBWFProjectLabel(projectId: string): Promise<string> {
  return safeQuery(async () => {
    const { data } = await supabase
      .from("bwf_projects")
      .select("project_code, project_name")
      .eq("id", projectId)
      .maybeSingle();
    return data?.project_code || data?.project_name || "";
  }, "", "fetchBWFProjectLabel");
}

export interface BWFCompletionPhotoProjectRow {
  id: string;
  project_code: string | null;
  p2_code: string | null;
  project_name: string | null;
  status: string | null;
  completion_photos: string | null;
  site_address: string | null;
  handover_date: string | null;
  modified_date: string | null;
  customer_name: string | null;
  pm_name: string | null;
  designer_name: string | null;
}

export interface BWFCompletionPhotoFilters {
  search?: string;
  status?: string;
  pm?: string;
  financialYear?: string;
}

export async function fetchBWFProjectsWithCompletionPhotos(
  page: number = 1,
  pageSize: number = 20,
  filters: BWFCompletionPhotoFilters = {},
  staffContext?: StaffDataScope
): Promise<PaginatedResult<BWFCompletionPhotoProjectRow>> {
  return safeQuery(async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const visibleIds = staffContext
      ? await resolveVisibleBwfProjectIds(staffContext)
      : null;
    if (visibleIds && visibleIds.length === 0) {
      return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }

    let query = supabase
      .from("bwf_projects")
      .select(
        `
        id, project_code, p2_code, project_name, status, completion_photos,
        site_address, handover_date, modified_date,
        real_customer_display_name, real_customer_name,
        pm:staff!fk_bwf_projects_main_pm_id(id, name),
        designer:staff!fk_bwf_projects_main_designer_id(id, name)
      `,
        { count: "exact" }
      )
      .not("completion_photos", "is", null)
      .neq("completion_photos", "");

    if (visibleIds) {
      query = query.in("id", visibleIds);
    }

    if (filters.search) {
      const q = `%${filters.search}%`;
      query = query.or(
        `project_code.ilike.${q},p2_code.ilike.${q},project_name.ilike.${q},real_customer_display_name.ilike.${q},real_customer_name.ilike.${q},site_address.ilike.${q}`
      );
    }

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters.pm && filters.pm !== "all") {
      query = query.eq("main_pm_id", filters.pm);
    }

    if (filters.financialYear && filters.financialYear !== "all") {
      query = query.eq("n_financial_year_id", filters.financialYear);
    }

    query = query
      .order("modified_date", { ascending: false, nullsFirst: false })
      .range(from, to);

    const { data, error, count } = await query;
    if (error) {
      logError("fetchBWFProjectsWithCompletionPhotos", error);
      return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }

    const rows: BWFCompletionPhotoProjectRow[] = (data ?? []).map((p: any) => ({
      id: p.id,
      project_code: p.project_code ?? null,
      p2_code: p.p2_code ?? null,
      project_name: p.project_name ?? null,
      status: p.status ?? null,
      completion_photos: p.completion_photos ?? null,
      site_address: p.site_address ?? null,
      handover_date: p.handover_date ?? null,
      modified_date: p.modified_date ?? null,
      customer_name:
        p.real_customer_display_name || p.real_customer_name || null,
      pm_name: p.pm?.name || null,
      designer_name: p.designer?.name || null,
    }));

    const totalCount = count ?? 0;
    return {
      data: rows,
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  }, { data: [], totalCount: 0, page, pageSize, totalPages: 0 }, "fetchBWFProjectsWithCompletionPhotos");
}
