import {
  getStaffRowScope,
  type StaffDataScope,
} from "@/lib/staff-data-scope";
import {
  supabase,
  adminFetch,
  logError,
  safeQuery,
  fetchAllByProject,
} from "@/lib/data/_core";
import {
  resolveJunctionProjectTypesForProjects,
  resolveJunctionProjectTypeIdsForProjects,
  resolveJunctionServiceTypesForProjects,
} from "@/lib/data/junctions";
import { fetchProjectFinancials } from "@/lib/data/finance";
import type { CascadeRelatedRecord } from "@/lib/data/bwa-pitching";
import { syncProjectDatesToSchedules } from "@/lib/data/schedule";
import {
  isBwaProjectSizeAtLeast,
  resolveBwaProjectSize,
} from "@/lib/bwa-project-size";
import { WELL_KNOWN_BRANDS_TAG_ID } from "@/lib/data/customers";
import { isNewsSpotlightEligible } from "@/lib/news-spotlight";

export { isNewsSpotlightEligible } from "@/lib/news-spotlight";

// BWA PROJECTS MODULE (BWA 工程項目)
// ═══════════════════════════════════════════════════════════

export interface BWAProjectRow {
  id: string;
  bubble_id: string | null;
  project_code: string | null;
  p2_code?: string | null;
  project_name: string | null;
  description: string | null;
  status: string | null;
  payment_status: string | null;
  // Customer (resolved via FK)
  customer: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_display_name: string | null;
  // PM & Designer (resolved via FK)
  main_pm: string | null;
  main_pm_id: string | null;
  pm_name: string | null;
  main_designer: string | null;
  main_designer_id: string | null;
  designer_name: string | null;
  other_pm: string | null;
  other_pm_id: string | null;
  other_pm_name: string | null;
  more_pm: string | null;
  more_pm_id: string | null;
  more_pm_name: string | null;
  // Financials
  estimated_income: number | null;
  estimated_expense: number | null;
  estimated_profit: number | null;
  income_below_estimated_reason?: string | null;
  // Size & Location
  size: string | null;
  actual_size: string | null;
  height_to_tc: string | null;
  height_to_bs: string | null;
  height_to_fc: string | null;
  project_size: string | null;
  site_address: string | null;
  r_nos_district_id: string | null;
  district_name: string | null;
  r_building: string | null;
  r_building_id: string | null;
  building_name: string | null;
  // Classification

  n_financial_year: string | null;
  n_financial_year_id: string | null;
  financial_year_name: string | null;
  n_team_type: string | null;
  n_team_type_id: string | null;
  team_type_name: string | null;
  n_service_type: string | null;
  n_service_type_id: string | null;
  service_type_name: string | null;
  n_project_type: string | null;
  project_type_name: string | null;
  cost_centre: string | null;
  cost_centre_id: string | null;
  cost_centre_bu_code: string | null;
  // Dates
  enquiry_date: string | null;
  signed_date: string | null;
  start_date: string | null;
  handover_date: string | null;
  defect_done_date: string | null;
  e_outstanding_date: string | null;
  os_project_defect?: string | null;
  // Cached display names
  real_customer_display_name: string | null;
  real_customer_name: string | null;
  real_district_name: string | null;
  real_building_name: string | null;
  real_cost_centre: string | null;
  // Links
  asana_link: string | null;
  working_folder: string | null;
  // Suppliers
  main_contractor: string | null;
  main_contractor_id: string | null;
  main_contractor_name: string | null;
  main_air_supplier: string | null;
  main_air_supplier_id: string | null;
  main_air_supplier_name: string | null;
  main_network_supplier: string | null;
  main_network_supplier_id: string | null;
  main_network_supplier_name: string | null;
  supplier: string | null;
  supplier_id: string | null;
  // Pitching link
  pitching: string | null;
  pitching_id: string | null;
  // Schedule group
  os_schedule_group: string | null;
  // Meta
  created_date: string | null;
  modified_date: string | null;
  slug: string | null;
}

// ─── BWA PROJECT CODE GENERATOR ────────────────────────────────

/**
 * Generates a project code based on:
 * {bu_code}{yy_code}{yy_code+1}{quote_initial}-{###}
 *
 * Example: BWA2627CY-003
 */
export async function generateProjectCode(
  params: { buCode: string; yyCode: string; mainPmId: string }
): Promise<string>;
export async function generateProjectCode(mainPmId: string): Promise<string>;
export async function generateProjectCode(
  paramsOrMainPmId: string | { buCode: string; yyCode: string; mainPmId: string }
): Promise<string> {
  try {
    if (typeof paramsOrMainPmId === "string") {
      return await generateProjectCodeLegacy(paramsOrMainPmId);
    }

    const { buCode, yyCode, mainPmId } = paramsOrMainPmId;
    if (!buCode || !yyCode || !mainPmId) return "";

    const { data: staffRecord, error: staffErr } = await supabase
      .from("staff")
      .select("quote_initial")
      .eq("id", mainPmId)
      .maybeSingle();

    if (staffErr || !staffRecord) {
      console.warn("[generateProjectCode] Could not fetch staff:", mainPmId);
      return "";
    }

    const quoteInitial = staffRecord.quote_initial || "";
    if (!quoteInitial) return "";

    const yyNum = parseInt(yyCode, 10);
    if (isNaN(yyNum)) return "";
    const yearPart = `${String(yyNum).padStart(2, "0")}${String(yyNum + 1).padStart(2, "0")}`;

    const prefix = `${buCode}${yearPart}${quoteInitial}`;

    const { data: matchingProjects, error: searchErr } = await supabase
      .from("bwa_projects")
      .select("project_code")
      .like("project_code", `${prefix}%`);

    if (searchErr) {
      console.warn("[generateProjectCode] Search error:", searchErr.message);
      return "";
    }

    let maxNum = 0;
    if (matchingProjects && matchingProjects.length > 0) {
      for (const row of matchingProjects) {
        if (!row.project_code) continue;
        const afterPrefix = row.project_code.slice(prefix.length);
        const dashMatch = afterPrefix.match(/^-(\d+)/);
        if (dashMatch) {
          const num = parseInt(dashMatch[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    const nextCount = maxNum + 1;
    const countStr = String(nextCount).padStart(3, "0");

    return `${prefix}-${countStr}`;
  } catch (err) {
    console.error("[generateProjectCode] Error:", err);
    return "";
  }
}

async function generateProjectCodeLegacy(mainPmId: string): Promise<string> {
  try {
    const { data: staffRecord, error: staffErr } = await supabase
      .from("staff")
      .select("quote_initial, project_code_initial")
      .eq("id", mainPmId)
      .maybeSingle();

    if (staffErr || !staffRecord) {
      console.warn("[generateProjectCode] Could not fetch staff:", mainPmId);
      return "";
    }

    const codeInitial = staffRecord.project_code_initial || staffRecord.quote_initial || "";
    if (!codeInitial) return "";

    const now = new Date();
    const hkDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
    const yy = String(hkDate.getFullYear()).slice(-2);

    const prefix = `${codeInitial}${yy}`;

    const { data: matchingProjects, error: searchErr } = await supabase
      .from("bwa_projects")
      .select("project_code")
      .like("project_code", `${prefix}%`);

    if (searchErr) {
      console.warn("[generateProjectCode] Search error:", searchErr.message);
      return "";
    }

    let maxNum = 0;
    if (matchingProjects && matchingProjects.length > 0) {
      for (const row of matchingProjects) {
        if (row.project_code && row.project_code.length >= prefix.length + 3) {
          const suffix = row.project_code.slice(prefix.length, prefix.length + 3);
          const num = parseInt(suffix, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    const nextCount = maxNum + 1;
    const countStr = String(nextCount).padStart(3, "0");

    return `${prefix}${countStr}`;
  } catch (err) {
    console.error("[generateProjectCodeLegacy] Error:", err);
    return "";
  }
}

// ─── CREATE BWA PROJECT (Convert from Pitching) ────────────────────

export interface CreateBWAProjectParams {
  project_code: string;
  project_name?: string;
  description?: string;
  status?: string;
  customer_id?: string;
  main_pm_id?: string;
  main_designer_id?: string;
  other_pm_id?: string;
  more_pm_id?: string;
  estimated_income?: number | null;
  estimated_expense?: number | null;
  estimated_profit?: number | null;
  size?: string | null;
  actual_size?: string | null;
  project_size?: string | null;
  site_address?: string | null;
  r_nos_district_id?: string | null;
  r_building_id?: string | null;
  n_financial_year_id?: string | null;
  n_team_type_id?: string | null;
  n_service_type_id?: string | null;
  cost_centre_id?: string | null;
  enquiry_date?: string | null;
  signed_date?: string | null;
  start_date?: string | null;
  handover_date?: string | null;
  defect_done_date?: string | null;
  asana_link?: string | null;
  working_folder?: string | null;
  pitching_id?: string | null;
  os_schedule_group?: string | null;
  sort_financial_year?: string | null;
  real_customer_display_name?: string | null;
  real_customer_name?: string | null;
  real_building_name?: string | null;
  real_district_name?: string | null;
  real_cost_centre?: string | null;
}

export async function createBWAProject(
  params: CreateBWAProjectParams
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const insertData: Record<string, any> = {
      project_code: params.project_code,
      project_name: params.project_name || params.project_code,
      description: params.description || null,
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
      actual_size: params.actual_size || null,
      project_size: params.project_size || null,
      site_address: params.site_address || null,
      r_nos_district_id: params.r_nos_district_id || null,
      r_building_id: params.r_building_id || null,
      n_financial_year_id: params.n_financial_year_id || null,
      n_team_type_id: params.n_team_type_id || null,
      n_service_type_id: params.n_service_type_id || null,
      cost_centre_id: params.cost_centre_id || null,
      enquiry_date: params.enquiry_date || null,
      signed_date: params.signed_date || null,
      start_date: params.start_date || null,
      handover_date: params.handover_date || null,
      defect_done_date: params.defect_done_date || null,
      asana_link: params.asana_link || null,
      working_folder: params.working_folder || null,
      pitching_id: params.pitching_id || null,
      os_schedule_group: params.os_schedule_group || null,
      sort_financial_year: params.sort_financial_year || null,
      real_customer_display_name: params.real_customer_display_name || null,
      real_customer_name: params.real_customer_name || null,
      real_building_name: params.real_building_name || null,
      real_district_name: params.real_district_name || null,
      real_cost_centre: params.real_cost_centre || null,
      created_date: new Date().toISOString(),
      modified_date: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("bwa_projects")
      .insert(insertData)
      .select("id")
      .single();

    if (error) {
      console.error("[createBWAProject] Insert error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error("[createBWAProject] Error:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/**
 * Staff context for role-based project data filtering.
 * - User: only sees projects where they are assigned as handler in project_bv
 * - Senior User: sees projects belonging to their team (n_team_type_id) OR assigned to them via project_bv
 * - Admin / Super Admin: sees all
 */
export type ProjectStaffContext = StaffDataScope;

/**
 * Resolve BWA project IDs visible under the same rules as `/projects/bwa` / `fetchBWAProjects`.
 * - `null` → company-wide (Admin / Super Admin) — no project_id filter
 * - `[]` → no visible projects
 * - `string[]` → restrict to these project ids
 */
export async function resolveVisibleBwaProjectIds(
  staffContext?: ProjectStaffContext
): Promise<string[] | null> {
  if (!staffContext?.staffId) return [];

  const scope = getStaffRowScope(staffContext.role);
  if (scope === "all") return null;

  const { data: bvData } = await supabase
    .from("project_bv")
    .select("project_id")
    .eq("handler_id", staffContext.staffId);

  const assignedIds = Array.from(
    new Set(
      ((bvData ?? []) as Array<{ project_id: string | null }>)
        .map((row) => row.project_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  if (scope === "assigned_only") return assignedIds;

  // Senior User: same team (bwa_projects.n_team_type_id) OR assigned via project_bv
  const ids = new Set<string>(assignedIds);
  if (staffContext.teamTypeId) {
    const PAGE_SIZE = 1000;
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data } = await supabase
        .from("bwa_projects")
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

export async function fetchBWAProjects(staffContext?: ProjectStaffContext): Promise<BWAProjectRow[]> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let hasMore = true;
    let page = 0;

    let allowedProjectIds: string[] | null = null;
    if (staffContext) {
      const roleLower = (staffContext.role || "user").toLowerCase();
      if (roleLower === "user" || roleLower === "senior user") {
        const { data: bvData } = await supabase
          .from("project_bv")
          .select("project_id")
          .eq("handler_id", staffContext.staffId);
        allowedProjectIds = (bvData ?? []).map((row: any) => row.project_id).filter(Boolean);
        if (roleLower === "user" && (allowedProjectIds?.length ?? 0) === 0) {
          return [];
        }
      }
    }

    while (hasMore) {
      const from = page * PAGE_SIZE;
      let query = supabase
        .from("bwa_projects")
        .select(`
          id, project_code, project_name, status, payment_status,
          customer_id, main_pm_id, main_designer_id,
          estimated_income, estimated_expense, estimated_profit,
          size, actual_size, project_size, site_address,
          r_nos_district_id, r_building_id,
          n_financial_year_id, n_team_type_id, n_service_type_id, cost_centre_id,
          enquiry_date, signed_date, start_date, handover_date, defect_done_date,
          real_customer_display_name, real_customer_name, real_district_name, real_building_name, real_cost_centre,
          asana_link, main_contractor_id, created_date,
          pm:staff!fk_bwa_projects_main_pm_id(id, name),
          designer:staff!fk_bwa_projects_main_designer_id(id, name),
          cust:customers!fk_bwa_projects_customer_id(id, customer_name, company_name),
          dist:districts!fk_bwa_projects_r_nos_district_id(id, name, chinese_display),
          bldg:buildings!fk_bwa_projects_r_building_id(id, building_name),
          fy:financial_years!fk_bwa_projects_n_financial_year_id(id, display),
          tt:team_types!fk_bwa_projects_n_team_type_id(id, display),
          st:service_types!fk_bwa_projects_n_service_type_id(id, display),
          main_contractor_sup:suppliers!fk_bwa_projects_main_contractor_id(id, name, display_name),
          cc:cost_centres!fk_bwa_projects_cost_centre_id(id, display, bu_code)
        `);

      if (staffContext) {
        const roleLower = (staffContext.role || "user").toLowerCase();
        if (roleLower === "user" && allowedProjectIds) {
          query = query.in("id", allowedProjectIds);
        } else if (roleLower === "senior user") {
          if (staffContext.teamTypeId && allowedProjectIds && allowedProjectIds.length > 0) {
            query = query.or(`n_team_type_id.eq.${staffContext.teamTypeId},id.in.(${allowedProjectIds.join(",")})`);
          } else if (staffContext.teamTypeId) {
            query = query.eq("n_team_type_id", staffContext.teamTypeId);
          } else if (allowedProjectIds && allowedProjectIds.length > 0) {
            query = query.in("id", allowedProjectIds);
          }
        }
      }

      const { data, error } = await query
        .order("created_date", { ascending: false, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logError("fetchBWAProjects", error);
        break;
      }

      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }

    const allIds = allData.map((p: any) => p.id);
    const [junctionPtMap, junctionStMap] = await Promise.all([
      resolveJunctionProjectTypesForProjects(allIds),
      resolveJunctionServiceTypesForProjects(allIds),
    ]);

    return allData.map((p: any) => ({
      id: p.id,
      bubble_id: null,
      project_code: p.project_code,
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
      actual_size: p.actual_size,
      height_to_tc: null,
      height_to_bs: null,
      height_to_fc: null,
      project_size: p.project_size,
      site_address: p.site_address,
      r_nos_district_id: p.r_nos_district_id,
      district_name: p.dist?.chinese_display || p.dist?.name || p.real_district_name || null,
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
      n_service_type_id: p.n_service_type_id,
      service_type_name: junctionStMap.get(p.id)
        || (Array.isArray(p.st)
          ? p.st.map((t: any) => t.display).filter(Boolean).join(", ") || null
          : p.st?.display || null),
      n_project_type: null,
      project_type_name: junctionPtMap.get(p.id) || null,
      cost_centre: null,
      cost_centre_id: p.cost_centre_id,
      cost_centre_bu_code: p.cc?.bu_code || null,
      enquiry_date: p.enquiry_date,
      signed_date: p.signed_date,
      start_date: p.start_date,
      handover_date: p.handover_date,
      defect_done_date: p.defect_done_date || null,
      e_outstanding_date: null,
      real_customer_display_name: p.real_customer_display_name,
      real_customer_name: p.real_customer_name,
      real_district_name: p.real_district_name,
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
    }));
  }, [], "fetchBWAProjects", 30000);
}

// ─── CASE PDF (個案PDF) — BWA project reference export ────

/** Round deal amount down to nearest 100,000 (e.g. 560123 → 560000). */
export function roundDealAmountTo100k(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n / 100_000) * 100_000;
}

export interface CasePdfRenderImage {
  id: string;
  image: string;
  order: number | null;
}

export interface CasePdfProjectRow {
  id: string;
  projectTypeName: string;
  constructionPeriod: string;
  constructionDays: string;
  districtName: string;
  buildingName: string;
  actualSize: string;
  projectName: string;
  /** Raw sum of incomes.income_amount (for filter); display uses dealAmountRounded. */
  actualIncome: number;
  dealAmountRounded: number;
  dealAmountDisplay: string;
  /** 牽涉工程 — from service_types (n_service_type_id / junction), prefers chin_display */
  involvedWorks: string;
  projectTypeIds: string[];
  startDate: string | null;
  handoverDate: string | null;
  images: CasePdfRenderImage[];
  selectedImageId: string | null;
}

export interface CasePdfFilters {
  projectTypeIds: string[];
  /** YYYY-MM-DD inclusive start of construction overlap window (optional). */
  periodFrom: string | null;
  /** YYYY-MM-DD inclusive end of construction overlap window (optional). */
  periodTo: string | null;
  /** Minimum raw actual income (before 100k rounding). */
  minDealAmount: number | null;
}

function formatYmZh(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

function formatConstructionPeriod(
  startDate: string | null,
  handoverDate: string | null,
): string {
  const a = formatYmZh(startDate);
  const b = formatYmZh(handoverDate);
  if (a && b) return a === b ? a : `${a} – ${b}`;
  return a || b || "";
}

function calcConstructionDays(
  startDate: string | null,
  handoverDate: string | null,
): string {
  if (!startDate || !handoverDate) return "";
  const s = new Date(startDate);
  const e = new Date(handoverDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  const ms = e.getTime() - s.getTime();
  if (ms < 0) return "";
  const days = Math.floor(ms / 86_400_000) + 1;
  return String(days);
}

function toDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export async function fetchCasePdfProjects(
  filters: CasePdfFilters,
  staffContext?: ProjectStaffContext,
): Promise<CasePdfProjectRow[]> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let hasMore = true;
    let page = 0;

    let allowedProjectIds: string[] | null = null;
    if (staffContext) {
      const roleLower = (staffContext.role || "user").toLowerCase();
      if (roleLower === "user" || roleLower === "senior user") {
        const { data: bvData } = await supabase
          .from("project_bv")
          .select("project_id")
          .eq("handler_id", staffContext.staffId);
        allowedProjectIds = (bvData ?? []).map((row: any) => row.project_id).filter(Boolean);
        if (roleLower === "user" && (allowedProjectIds?.length ?? 0) === 0) {
          return [];
        }
      }
    }

    while (hasMore) {
      const from = page * PAGE_SIZE;
      let query = supabase
        .from("bwa_projects")
        .select(`
          id, project_name, actual_size, start_date, handover_date,
          n_service_type_id, r_nos_district_id, r_building_id, n_team_type_id,
          dist:districts!fk_bwa_projects_r_nos_district_id(id, name, chinese_display),
          bldg:buildings!fk_bwa_projects_r_building_id(id, building_name),
          st:service_types!fk_bwa_projects_n_service_type_id(id, display, chin_display)
        `);

      if (staffContext) {
        const roleLower = (staffContext.role || "user").toLowerCase();
        if (roleLower === "user" && allowedProjectIds) {
          query = query.in("id", allowedProjectIds);
        } else if (roleLower === "senior user") {
          if (staffContext.teamTypeId && allowedProjectIds && allowedProjectIds.length > 0) {
            query = query.or(
              `n_team_type_id.eq.${staffContext.teamTypeId},id.in.(${allowedProjectIds.join(",")})`,
            );
          } else if (staffContext.teamTypeId) {
            query = query.eq("n_team_type_id", staffContext.teamTypeId);
          } else if (allowedProjectIds && allowedProjectIds.length > 0) {
            query = query.in("id", allowedProjectIds);
          }
        }
      }

      const { data, error } = await query
        .order("start_date", { ascending: false, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logError("fetchCasePdfProjects", error);
        break;
      }

      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }

    if (allData.length === 0) return [];

    const allIds = allData.map((p: any) => p.id);
    const [junctionPtNames, junctionPtIds, junctionStNames, financials] =
      await Promise.all([
        resolveJunctionProjectTypesForProjects(allIds),
        resolveJunctionProjectTypeIdsForProjects(allIds),
        resolveJunctionServiceTypesForProjects(allIds),
        fetchProjectFinancials(allIds),
      ]);

    const imagesByProject = new Map<string, CasePdfRenderImage[]>();
    {
      const BATCH = 200;
      for (let i = 0; i < allIds.length; i += BATCH) {
        const batch = allIds.slice(i, i + BATCH);
        const rows = await fetchAllByProject(
          "three_d_renders",
          "id, project_id, image, order, created_date",
          batch,
          (q) => q.not("image", "is", null),
        );
        for (const row of rows) {
          if (!row.project_id || !row.image) continue;
          const list = imagesByProject.get(row.project_id) ?? [];
          list.push({
            id: row.id,
            image: row.image,
            order: row.order ?? null,
          });
          imagesByProject.set(row.project_id, list);
        }
      }
      for (const [, list] of imagesByProject) {
        list.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
      }
    }

    const selectedTypeIds = new Set(filters.projectTypeIds.filter(Boolean));
    const minAmount = filters.minDealAmount;
    const periodFrom = toDateOnly(filters.periodFrom);
    const periodTo = toDateOnly(filters.periodTo);

    const rows: CasePdfProjectRow[] = [];
    for (const p of allData) {
      const typeIds = junctionPtIds.get(p.id) ?? [];

      if (selectedTypeIds.size > 0) {
        const match = typeIds.some((id) => selectedTypeIds.has(id));
        if (!match) continue;
      }

      if (periodFrom || periodTo) {
        const start = toDateOnly(p.start_date);
        const end = toDateOnly(p.handover_date);
        if (periodTo && (!start || start > periodTo)) continue;
        if (periodFrom && end && end < periodFrom) continue;
        if (periodFrom && !start && !end) continue;
      }

      const actualIncome = financials[p.id]?.total_sales ?? 0;
      if (minAmount != null && Number.isFinite(minAmount) && actualIncome < minAmount) {
        continue;
      }

      const typeName = junctionPtNames.get(p.id) || "";

      const serviceTypeName =
        junctionStNames.get(p.id) ||
        (Array.isArray(p.st)
          ? p.st.map((t: any) => t.chin_display || t.display).filter(Boolean).join(", ")
          : p.st?.chin_display || p.st?.display || "") ||
        "";
      const involvedWorks = serviceTypeName
        .split(/,\s*/)
        .map((s: string) => s.trim())
        .filter(Boolean)
        .join("、");

      const rounded = roundDealAmountTo100k(actualIncome);
      const images = imagesByProject.get(p.id) ?? [];

      rows.push({
        id: p.id,
        projectTypeName: typeName,
        constructionPeriod: formatConstructionPeriod(p.start_date, p.handover_date),
        constructionDays: calcConstructionDays(p.start_date, p.handover_date),
        districtName:
          p.dist?.chinese_display || p.dist?.name || "",
        buildingName: p.bldg?.building_name || "",
        actualSize: p.actual_size || "",
        projectName: p.project_name || "",
        actualIncome,
        dealAmountRounded: rounded,
        dealAmountDisplay: rounded > 0 ? String(rounded) : "",
        involvedWorks,
        projectTypeIds: typeIds,
        startDate: p.start_date,
        handoverDate: p.handover_date,
        images,
        selectedImageId: images[0]?.id ?? null,
      });
    }

    return rows;
  }, [], "fetchCasePdfProjects");
}

// ─── NEWS SPOTLIGHT (項目新聞中心 → mid+ BWA projects) ────

export interface NewsSpotlightRenderImage {
  id: string;
  image: string;
  order: number | null;
}

export interface NewsSpotlightProjectRow {
  id: string;
  projectName: string;
  /** Display size with unit, e.g. "1200 sqft", or empty. */
  sizeLabel: string;
  districtName: string;
  buildingName: string;
  mainPmName: string;
  mainDesignerName: string;
  startDate: string | null;
  handoverDate: string | null;
  /** Inclusive day count between start and handover; null if either date missing. */
  totalDays: number | null;
  /** Linked project_type ids (for pill tab filtering). */
  projectTypeIds: string[];
  asanaLink: string | null;
  images: NewsSpotlightRenderImage[];
}

export interface NewsSpotlightProjectType {
  id: string;
  label: string;
}

/** Project types flagged site_status_required — used as /news pill tabs. */
export async function fetchNewsSpotlightProjectTypes(): Promise<
  NewsSpotlightProjectType[]
> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("project_types")
      .select("id, display, chin_display")
      .eq("site_status_required", true)
      .order("display");
    if (error) {
      logError("fetchNewsSpotlightProjectTypes", error);
      return [];
    }
    return (data ?? []).map((d: { id: string; display: string | null; chin_display: string | null }) => ({
      id: d.id,
      label: d.chin_display || d.display || "未命名",
    }));
  }, [], "fetchNewsSpotlightProjectTypes");
}

function calcConstructionDaysNumber(
  startDate: string | null,
  handoverDate: string | null,
): number | null {
  if (!startDate || !handoverDate) return null;
  const s = new Date(startDate);
  const e = new Date(handoverDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const ms = e.getTime() - s.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / 86_400_000) + 1;
}

/**
 * Mid-size+ BWA projects for the /news spotlight listing.
 * Include when size ≥ $500K-$1M中型 AND (
 *   any linked project_type.site_status_required = true
 *   OR customer has 知名品牌 tag
 * ).
 */
export async function fetchNewsSpotlightProjects(
  staffContext?: ProjectStaffContext,
): Promise<NewsSpotlightProjectRow[]> {
  return safeQuery(async () => {
    const visibleIds = staffContext
      ? await resolveVisibleBwaProjectIds(staffContext)
      : null;
    if (visibleIds && visibleIds.length === 0) return [];

    const SELECT = `
      id, project_name, size, actual_size, project_size, estimated_income,
      start_date, handover_date, customer_id, asana_link,
      main_pm_id, main_designer_id, r_nos_district_id, r_building_id,
      pm:staff!fk_bwa_projects_main_pm_id(id, name),
      designer:staff!fk_bwa_projects_main_designer_id(id, name),
      dist:districts!fk_bwa_projects_r_nos_district_id(id, name, chinese_display),
      bldg:buildings!fk_bwa_projects_r_building_id(id, building_name)
    `;

    let allData: any[] = [];
    if (visibleIds) {
      // Batch `.in(id)` to avoid PostgREST URL length limits.
      const BATCH = 200;
      for (let i = 0; i < visibleIds.length; i += BATCH) {
        const batch = visibleIds.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from("bwa_projects")
          .select(SELECT)
          .in("id", batch);
        if (error) {
          logError("fetchNewsSpotlightProjects", error);
          continue;
        }
        allData = allData.concat(data ?? []);
      }
      allData.sort((a, b) => {
        const aDate = a.start_date || "";
        const bDate = b.start_date || "";
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate < bDate ? 1 : aDate > bDate ? -1 : 0;
      });
    } else {
      const PAGE_SIZE = 1000;
      let hasMore = true;
      let page = 0;
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase
          .from("bwa_projects")
          .select(SELECT)
          .order("start_date", { ascending: false, nullsFirst: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          logError("fetchNewsSpotlightProjects", error);
          break;
        }

        allData = allData.concat(data ?? []);
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        page++;
      }
    }

    if (allData.length === 0) return [];

    // Pre-filter by size so junction/tag work is smaller.
    const sizeEligible = allData.filter((p) => {
      const resolved = resolveBwaProjectSize(p.project_size, p.estimated_income);
      return isBwaProjectSizeAtLeast(resolved, "$500K-$1M中型");
    });
    if (sizeEligible.length === 0) return [];

    const sizeEligibleIds = sizeEligible.map((p) => p.id as string);

    const [junctionPtIds, requiredPtRes, brandCustomerIds] = await Promise.all([
      resolveJunctionProjectTypeIdsForProjects(sizeEligibleIds),
      supabase
        .from("project_types")
        .select("id")
        .eq("site_status_required", true),
      (async (): Promise<Set<string>> => {
        const ids = new Set<string>();
        const TAG_PAGE = 1000;
        let tagPage = 0;
        let more = true;
        while (more) {
          const { data, error } = await supabase
            .from("customer_tags")
            .select("customer_uuid")
            .eq("tag_uuid", WELL_KNOWN_BRANDS_TAG_ID)
            .range(tagPage * TAG_PAGE, tagPage * TAG_PAGE + TAG_PAGE - 1);
          if (error) {
            logError("fetchNewsSpotlightProjects/brandTags", error);
            break;
          }
          for (const r of data ?? []) {
            if (r.customer_uuid) ids.add(r.customer_uuid as string);
          }
          more = (data?.length ?? 0) === TAG_PAGE;
          tagPage++;
        }
        return ids;
      })(),
    ]);

    if (requiredPtRes.error) {
      logError("fetchNewsSpotlightProjects/projectTypes", requiredPtRes.error);
    }
    const requiredPtIds = new Set<string>(
      (requiredPtRes.data ?? [])
        .map((r: { id: string }) => r.id)
        .filter(
          (id: string): id is string => typeof id === "string" && id.length > 0,
        ),
    );

    const matched = sizeEligible.filter((p) =>
      isNewsSpotlightEligible({
        projectSize: p.project_size,
        estimatedIncome: p.estimated_income,
        projectTypeIds: junctionPtIds.get(p.id) ?? [],
        requiredProjectTypeIds: requiredPtIds,
        customerId: p.customer_id,
        wellKnownBrandCustomerIds: brandCustomerIds,
      }),
    );

    if (matched.length === 0) return [];

    const matchedIds = matched.map((p) => p.id as string);
    const imagesByProject = new Map<string, NewsSpotlightRenderImage[]>();
    {
      const BATCH = 200;
      for (let i = 0; i < matchedIds.length; i += BATCH) {
        const batch = matchedIds.slice(i, i + BATCH);
        const rows = await fetchAllByProject(
          "three_d_renders",
          "id, project_id, image, order, created_date",
          batch,
          (q) => q.not("image", "is", null),
        );
        for (const row of rows) {
          if (!row.project_id || !row.image) continue;
          const list = imagesByProject.get(row.project_id) ?? [];
          list.push({
            id: row.id,
            image: row.image,
            order: row.order ?? null,
          });
          imagesByProject.set(row.project_id, list);
        }
      }
      for (const [, list] of imagesByProject) {
        list.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
      }
    }

    return matched.map((p) => {
      const rawSize = (p.size || p.actual_size || "").toString().trim();
      const sizeLabel = rawSize
        ? rawSize.toLowerCase().includes("sqft")
          ? rawSize
          : `${rawSize} sqft`
        : "";
      const images = imagesByProject.get(p.id) ?? [];
      return {
        id: p.id as string,
        projectName: (p.project_name as string) || "",
        sizeLabel,
        districtName:
          p.dist?.chinese_display || p.dist?.name || "",
        buildingName: p.bldg?.building_name || "",
        mainPmName: p.pm?.name || "",
        mainDesignerName: p.designer?.name || "",
        startDate: p.start_date ?? null,
        handoverDate: p.handover_date ?? null,
        totalDays: calcConstructionDaysNumber(p.start_date, p.handover_date),
        projectTypeIds: junctionPtIds.get(p.id) ?? [],
        asanaLink: (p.asana_link as string | null) || null,
        images,
      };
    });
  }, [], "fetchNewsSpotlightProjects");
}

// ─── BWA PROJECT DETAIL ────────────────────────────────

export interface BWAProjectDetailData extends BWAProjectRow {
  external_customer_name: string | null;
  external_project_name: string | null;
  site_photos: string | null;
  main_divide: string | null;
  required_check_date: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_raw_name: string | null;
  customer_raw_company: string | null;
  x_f_form_s1: string | null;
  x_f_form_s2: string | null;
  x_f_form_s3: string | null;
  xf_site_work_insurance: string | null;
  incomes: BWAProjectIncome[];
  expenses: BWAProjectExpense[];
  quotation_expenses: QuotationExpenseRow[];
  project_initial_expenses: ProjectInitialExpenseRow[];
}

export interface QuotationExpenseRow {
  id: string;
  amount: number | null;
  expense_type_name: string | null;
  n_expense_type_id: string | null;
  created_by_name: string | null;
}

export interface ProjectInitialExpenseRow {
  id: string;
  amount: number | null;
  expense_type_name: string | null;
  n_expense_type_id: string | null;
  created_by_name: string | null;
}

export interface BWAProjectIncome {
  id: string;
  amount: number | null;
  payment_amount: number | null;
  outstanding: number | null;
  bad_debts?: number | null;
  payment_date: string | null;
  due_date: string | null;
  expected_payment_date: string | null;
  description: string | null;
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  invoice_number: string | null;
  n_contract_type_id: string | null;
  contract_type_name: string | null;
  contract_type_chinese_name: string | null;
  contract_type_english_name: string | null;
  remark: string | null;
  type_display: string | null;
  created_date: string | null;
  approved: boolean | null;
  pdf_file: string | null;
  expiry_reason_id: string | null;
  ao_request_date?: string | null;
  ao_issue_date?: string | null;
  ao_work_days?: number | null;
  ao_design_firm_status?: string | null;
  ao_quotation_firm_date?: string | null;
  ao_work_status?: string | null;
  ao_client_follow_up?: string | null;
}

export interface BWAProjectExpense {
  id: string;
  amount: number | null;
  converter_input_amount: number | null;
  paid_amount: number | null;
  outstanding: number | null;
  payment_date: string | null;
  due_date: string | null;
  expected_payment_date: string | null;
  description: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  factory_id: string | null;
  factory_name: string | null;
  n_contract_type_id: string | null;
  contract_type_name: string | null;
  n_supplier_type_id: string | null;
  supplier_type_name: string | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
  cheque_no: string | null;
  rank_report: string | null;
  status: string | null;
  payment_status: string | null;
  invoice_number: string | null;
  remark: string | null;
  type_display: string | null;
  pdf_file: string | null;
  supplier_quotation_file: string | null;
  approved: boolean | null;
}

export async function fetchBwaProjectAsanaLink(
  projectId: string
): Promise<string | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwa_projects")
      .select("asana_link")
      .eq("id", projectId)
      .maybeSingle();
    if (error) {
      logError("fetchBwaProjectAsanaLink", error);
      return null;
    }
    const link = typeof data?.asana_link === "string" ? data.asana_link.trim() : "";
    return link || null;
  }, null, "fetchBwaProjectAsanaLink");
}

export async function fetchBWAProjectDetail(
  projectId: string
): Promise<BWAProjectDetailData | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwa_projects")
      .select(`
        *,
        pm:staff!fk_bwa_projects_main_pm_id(id, name),
        designer:staff!fk_bwa_projects_main_designer_id(id, name),
        other_pm_staff:staff!fk_bwa_projects_other_pm_id(id, name),
        more_pm_staff:staff!fk_bwa_projects_more_pm_id(id, name),
        cust:customers!fk_bwa_projects_customer_id(id, customer_name, company_name, display_name, email, phone_display, address),
        dist:districts!fk_bwa_projects_r_nos_district_id(id, name, chinese_display),
        bldg:buildings!fk_bwa_projects_r_building_id(id, building_name),
        fy:financial_years!fk_bwa_projects_n_financial_year_id(id, display),
        tt:team_types!fk_bwa_projects_n_team_type_id(id, display),
        st:service_types!fk_bwa_projects_n_service_type_id(id, display),
        main_contractor_sup:suppliers!fk_bwa_projects_main_contractor_id(id, name, display_name),
        main_air_sup:suppliers!fk_bwa_projects_main_air_supplier_id(id, name, display_name),
        main_network_sup:suppliers!fk_bwa_projects_main_network_supplier_id(id, name, display_name),
        cc:cost_centres!fk_bwa_projects_cost_centre_id(id, display, bu_code)
      `)
      .eq("id", projectId)
      .single();

    if (error) {
      logError("fetchBWAProjectDetail", error);
      return null;
    }
    if (!data) return null;

    const [junctionPtMap, junctionStMap] = await Promise.all([
      resolveJunctionProjectTypesForProjects([projectId]),
      resolveJunctionServiceTypesForProjects([projectId]),
    ]);

    const { data: incomeData } = await supabase
      .from("incomes")
      .select("id, income_amount, payment_amount, outstanding, bad_debts, receive_date, due_date, expected_payment_date, remark, payment_status, status, payment_method, invoice_number, n_contract_type_id, type_display, created_date, pdf_file, expiry_reason_id, ao_request_date, ao_issue_date, ao_work_days, ao_design_firm_status, ao_quotation_firm_date, ao_work_status, ao_client_follow_up, ct:nos_contracts!fk_incomes_n_contract_type_id(id, display, chinese_display)")
      .eq("project_id", projectId)
      .order("receive_date", { ascending: false });

    const { data: expenseData, error: expErr } = await supabase
      .from("expenses")
      .select("id, installment_amount, paid_amount, outstanding, payment_date, due_date, expected_payment_date, remark_t, payment_status, type_display, supplier_id, factory_id, n_contract_type_id, n_supplier_type_id, payment_method_id, cheque_no, rank_report, invoice_number, pdf_file, supplier_quotation_file")
      .eq("project_id", projectId)
      .order("payment_date", { ascending: false });

    if (expErr) {
      console.warn("[fetchBWAProjectDetail] expense query error:", expErr.message);
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

    const pitchingIdForCost = data.pitching_id || data.pitching || null;

    let sitePhotosRaw: string | null = null;
    if (pitchingIdForCost) {
      const { data: pitchPhotos } = await supabase
        .from("bwa_pitchings")
        .select("site_photos")
        .eq("id", pitchingIdForCost)
        .maybeSingle();
      sitePhotosRaw = pitchPhotos?.site_photos ?? null;
    }

    if (pitchingIdForCost) {
      const [quotRes, initRes] = await Promise.all([
        supabase
          .from("quotation_expenses")
          .select("id, amount, n_expense_type_id, created_by_id, st:supplier_types!fk_quotation_expenses_n_expense_type_id(id, display, chinese_display)")
          .eq("pitching_id", pitchingIdForCost),
        supabase
          .from("project_initial_expenses")
          .select("id, amount, n_expense_type_id, created_by_id, st:supplier_types!fk_project_initial_expenses_n_expense_type_id(id, display, chinese_display)")
          .eq("pitching_id", pitchingIdForCost),
      ]);

      if (quotRes.error) {
        console.warn("[fetchBWAProjectDetail] quotation_expenses query error:", quotRes.error.message);
        const { data: fallbackQuot } = await supabase
          .from("quotation_expenses")
          .select("id, amount, n_expense_type_id, created_by_id")
          .eq("pitching_id", pitchingIdForCost);
        quotExpData = fallbackQuot ?? [];
      } else {
        quotExpData = quotRes.data ?? [];
      }

      if (initRes.error) {
        console.warn("[fetchBWAProjectDetail] project_initial_expenses query error:", initRes.error.message);
        const { data: fallbackInit } = await supabase
          .from("project_initial_expenses")
          .select("id, amount, n_expense_type_id, created_by_id")
          .eq("pitching_id", pitchingIdForCost);
        projInitExpData = fallbackInit ?? [];
      } else {
        projInitExpData = initRes.data ?? [];
      }
    }

    const allCostExpTypeIds = [
      ...new Set([
        ...quotExpData.map((q: any) => q.n_expense_type_id),
        ...projInitExpData.map((p: any) => p.n_expense_type_id),
      ].filter(Boolean))
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
      description: data.description,
      status: data.status,
      payment_status: data.payment_status,
      customer: data.customer,
      customer_id: data.customer_id,
      customer_name: data.real_customer_display_name || data.real_customer_name || data.cust?.customer_name || null,
      customer_display_name: data.cust?.display_name || data.real_customer_display_name || data.cust?.company_name || null,
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
      actual_size: data.actual_size,
      height_to_tc: data.height_to_tc,
      height_to_bs: data.height_to_bs,
      height_to_fc: data.height_to_fc,
      project_size: data.project_size,
      site_address: data.site_address,
      r_nos_district_id: data.r_nos_district_id,
      district_name: data.dist?.chinese_display || data.dist?.name || data.real_district_name || null,
      r_building: data.r_building,
      r_building_id: data.r_building_id,
      building_name: data.bldg?.building_name || data.real_building_name || null,

      n_financial_year: data.n_financial_year,
      n_financial_year_id: data.n_financial_year_id,
      financial_year_name: data.fy?.display || null,
      n_team_type: data.n_team_type,
      n_team_type_id: data.n_team_type_id,
      team_type_name: data.tt?.display || null,
      n_service_type: data.n_service_type,
      n_service_type_id: data.n_service_type_id,
      service_type_name: junctionStMap.get(projectId)
        || (Array.isArray(data.st)
          ? data.st.map((t: any) => t.display).filter(Boolean).join(", ") || null
          : data.st?.display || null),
      n_project_type: data.n_project_type,
      project_type_name: junctionPtMap.get(projectId) || null,
      cost_centre: data.cost_centre,
      cost_centre_id: data.cost_centre_id,
      cost_centre_bu_code: data.cc?.bu_code || null,
      enquiry_date: data.enquiry_date,
      signed_date: data.signed_date,
      start_date: data.start_date,
      handover_date: data.handover_date,
      defect_done_date: data.defect_done_date || null,
      e_outstanding_date: data.e_outstanding_date,
      real_customer_display_name: data.real_customer_display_name,
      real_customer_name: data.real_customer_name,
      real_district_name: data.real_district_name,
      real_building_name: data.real_building_name,
      real_cost_centre: data.real_cost_centre,
      asana_link: data.asana_link,
      working_folder: data.working_folder,
      main_contractor: data.main_contractor,
      main_contractor_id: data.main_contractor_id,
      main_contractor_name: data.main_contractor_sup?.display_name || data.main_contractor_sup?.name || null,
      main_air_supplier: data.main_air_supplier,
      main_air_supplier_id: data.main_air_supplier_id,
      main_air_supplier_name: data.main_air_sup?.display_name || data.main_air_sup?.name || null,
      main_network_supplier: data.main_network_supplier,
      main_network_supplier_id: data.main_network_supplier_id,
      main_network_supplier_name: data.main_network_sup?.display_name || data.main_network_sup?.name || null,
      supplier: data.supplier,
      supplier_id: data.supplier_id,
      pitching: data.pitching,
      pitching_id: data.pitching_id,
      os_schedule_group: data.os_schedule_group || null,
      created_date: data.created_date,
      modified_date: data.modified_date,
      slug: data.slug,
      external_customer_name: data.external_customer_name,
      external_project_name: data.external_project_name,
      site_photos: sitePhotosRaw,
      main_divide: data.main_divide,
      required_check_date: data.required_check_date,
      x_f_form_s1: data.x_f_form_s1,
      x_f_form_s2: data.x_f_form_s2,
      x_f_form_s3: data.x_f_form_s3,
      xf_site_work_insurance: data.xf_site_work_insurance,
      incomes: (incomeData ?? []).map((i: any) => ({
        id: i.id,
        amount: i.income_amount,
        payment_amount: i.payment_amount,
        outstanding: i.outstanding,
        bad_debts: i.bad_debts ?? null,
        payment_date: i.receive_date,
        due_date: i.due_date,
        expected_payment_date: i.expected_payment_date || null,
        description: i.remark || i.invoice_number || null,
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
        converter_input_amount: null,
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
        created_by_name: q.user?.name || null,
      })),
      project_initial_expenses: projInitExpData.map((p: any) => ({
        id: p.id,
        amount: p.amount ?? null,
        expense_type_name: p.st?.chinese_display || p.st?.display || (p.n_expense_type_id ? (costExpTypeMap[p.n_expense_type_id] || null) : null),
        n_expense_type_id: p.n_expense_type_id || null,
        created_by_name: p.user?.name || null,
      })),
    } as BWAProjectDetailData;
  }, null, "fetchBWAProjectDetail");
}

export async function deleteBWAProject(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({ action: "delete", table: "bwa_projects", id });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── CASCADE DELETE ANALYSIS ────────────────────────────────────────

export interface CascadeAnalysisResult {
  project: { id: string; project_code: string; project_name: string };
  related_groups: CascadeRelatedRecord[];
  pitching_chain: CascadeRelatedRecord | null;
  customer_chain: CascadeRelatedRecord | null;
  total_related_count: number;
}

export async function analyzeCascadeDelete(projectId: string): Promise<{ data?: CascadeAnalysisResult; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/supabase-functions-cascade-delete-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
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

export async function executeCascadeDelete(
  projectId: string,
  selections: Record<string, boolean>,
  deleteProject: boolean,
  deletePitching: boolean,
  deleteCustomer: boolean = false
): Promise<{ success: boolean; deletion_log?: { table: string; deleted: number; error?: string }[]; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/supabase-functions-cascade-delete-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
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

export interface BWAProjectUpdateData {
  project_name?: string | null;
  project_code?: string | null;
  description?: string | null;
  status?: string | null;
  customer_id?: string | null;
  main_pm_id?: string | null;
  main_designer_id?: string | null;
  other_pm_id?: string | null;
  more_pm_id?: string | null;
  estimated_income?: number | null;
  estimated_expense?: number | null;
  income_below_estimated_reason?: string | null;
  size?: string | null;
  actual_size?: string | null;
  height_to_tc?: string | null;
  height_to_bs?: string | null;
  height_to_fc?: string | null;
  project_size?: string | null;
  site_address?: string | null;
  r_nos_district_id?: string | null;
  r_building_id?: string | null;
  n_financial_year_id?: string | null;
  n_team_type_id?: string | null;
  n_service_type_id?: string | null;
  quote_project_type_id?: string | null;
  cost_centre_id?: string | null;
  enquiry_date?: string | null;
  signed_date?: string | null;
  start_date?: string | null;
  handover_date?: string | null;
  defect_done_date?: string | null;
  asana_link?: string | null;
  working_folder?: string | null;
  main_contractor_id?: string | null;
  os_schedule_group?: string | null;
}

export async function updateBWAProject(
  id: string,
  updates: Partial<BWAProjectUpdateData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { b2b_b2c: _omitB2b, ...safeUpdates } = updates as Partial<BWAProjectUpdateData> & {
      b2b_b2c?: string | null;
    };
    const { error } = await supabase.from("bwa_projects").update(safeUpdates).eq("id", id);
    if (error) return { success: false, error: error.message };

    if ("start_date" in updates || "handover_date" in updates) {
      await syncProjectDatesToSchedules({
        projectId: id,
        entityType: "bwa_project",
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

/** Replace junction rows for multi-select project types on a BWA project.
 *  Uses /api/admin because bwa_project_project_types RLS is SELECT-only. */
export async function syncBWAProjectProjectTypes(
  projectId: string,
  projectTypeIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const delResult = await adminFetch({
      action: "delete-where",
      table: "bwa_project_project_types",
      filter: { project_id: projectId },
    });
    if (!delResult.success) {
      return { success: false, error: delResult.error || "刪除項目類型失敗" };
    }

    if (projectTypeIds.length === 0) return { success: true };

    const uniqueIds = [...new Set(projectTypeIds.filter(Boolean))];
    const insertResults = await Promise.all(
      uniqueIds.map((project_type_id) =>
        adminFetch({
          action: "create",
          table: "bwa_project_project_types",
          data: { project_id: projectId, project_type_id },
        })
      )
    );
    const failed = insertResults.find((r) => !r.success);
    if (failed) {
      return { success: false, error: failed.error || "新增項目類型失敗" };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

