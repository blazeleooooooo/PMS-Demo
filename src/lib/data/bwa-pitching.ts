import { computeOsScheduleGroup } from "@/lib/os-schedule-group";
import type { StaffDataScope } from "@/lib/staff-data-scope";
import {
  supabase,
  adminFetch,
  logError,
  safeQuery,
} from "@/lib/data/_core";
import {
  resolveJunctionProjectTypesForPitchings,
  resolveJunctionServiceTypesForPitchings,
} from "@/lib/data/junctions";
import type { PaginatedResult } from "@/lib/data/customers";

// BWA PITCHINGS MODULE (BWA 競標)
// ═══════════════════════════════════════════════════════════

export interface BWAPitchingRow {
  id: string;
  bubble_id: string | null;
  pitching_code: string | null;
  description: string | null;
  pitching_stages: string | null;
  // Customer (resolved via FK)
  customer: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_company: string | null;
  // PM & Designer (resolved via FK)
  main_pm: string | null;
  main_pm_id: string | null;
  pm_name: string | null;
  main_designer: string | null;
  main_designer_id: string | null;
  designer_name: string | null;
  // Financials
  estimated_income: number | null;
  estimated_expense: number | null;
  os_money_size: string | null;
  // Size & Location
  size: string | null;
  actual_size: string | null;
  site_address: string | null;
  district: string | null;
  district_id: string | null;
  district_name: string | null;
  // Building
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
  // Project Type (resolved via bwa_pitching_project_types junction)
  n_project_types: string | null;
  project_types_name: string | null;
  // Cached display names
  real_customer_display_name: string | null;
  real_customer_co_name: string | null;
  real_building_name: string | null;
  real_district_name: string | null;
  real_creator_member_name: string | null;
  // Meta
  enquiry_date: string | null;
  closed_reason: string | null;
  created_date: string | null;
  modified_date: string | null;
  asana_link: string | null;
  working_folder: string | null;
  /** Comma-separated public URLs; populated when hasSitePhotos filter requests it. */
  site_photos?: string | null;
}

export async function fetchBWAPitchings(): Promise<BWAPitchingRow[]> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let hasMore = true;
    let page = 0;

    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("bwa_pitchings")
        .select(`
          id, bubble_id, pitching_code, description, pitching_stages,
          customer, customer_id, main_pm, main_pm_id, main_designer, main_designer_id,
          estimated_income, estimated_expense, os_money_size,
          size, actual_size, site_address, district, district_id,
          r_building, r_building_id,
          n_financial_year, n_financial_year_id, n_team_type, n_team_type_id,
          n_service_type, n_service_type_id,
          n_project_types,
          real_customer_display_name, real_customer_co_name, real_building_name,
          real_district_name, real_creator_member_name,
          enquiry_date, closed_reason, created_date, modified_date,
          asana_link, working_folder,
          pm:staff!fk_bwa_pitchings_main_pm_id(id, name),
          designer:staff!fk_bwa_pitchings_main_designer_id(id, name),
          cust:customers!fk_bwa_pitchings_customer_id(id, customer_name, company_name),
          dist:districts!fk_bwa_pitchings_district_id(id, name, chinese_display),
          bldg:buildings!fk_bwa_pitchings_r_building_id(id, building_name),
          fy:financial_years!fk_bwa_pitchings_n_financial_year_id(id, display),
          tt:team_types!fk_bwa_pitchings_n_team_type_id(id, display),
          st:service_types!fk_bwa_pitchings_n_service_type_id(id, display)
        `)
        .order("created_date", { ascending: false, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logError("fetchBWAPitchings", error);
        break;
      }

      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }

    // Resolve project/service types from junction tables for ALL pitchings
    const allIds = allData.map((p: any) => p.id);
    const [junctionPtMap, junctionStMap] = await Promise.all([
      resolveJunctionProjectTypesForPitchings(allIds),
      resolveJunctionServiceTypesForPitchings(allIds),
    ]);

    return allData.map((p: any) => ({
      id: p.id,
      bubble_id: p.bubble_id,
      pitching_code: p.pitching_code,
      description: p.description,
      pitching_stages: p.pitching_stages,
      customer: p.customer,
      customer_id: p.customer_id,
      customer_name: p.real_customer_display_name || p.cust?.customer_name || null,
      customer_company: p.real_customer_co_name || p.cust?.company_name || null,
      main_pm: p.main_pm,
      main_pm_id: p.main_pm_id,
      pm_name: p.pm?.name || p.real_creator_member_name || null,
      main_designer: p.main_designer,
      main_designer_id: p.main_designer_id,
      designer_name: p.designer?.name || null,
      estimated_income: p.estimated_income,
      estimated_expense: p.estimated_expense,
      os_money_size: p.os_money_size,
      size: p.size,
      actual_size: p.actual_size,
      site_address: p.site_address,
      district: p.district,
      district_id: p.district_id,
      district_name: p.dist?.chinese_display || p.dist?.name || p.real_district_name || null,
      r_building: p.r_building,
      r_building_id: p.r_building_id,
      building_name: p.bldg?.building_name || p.real_building_name || null,

      n_financial_year: p.n_financial_year,
      n_financial_year_id: p.n_financial_year_id,
      financial_year_name: p.fy?.display || null,
      n_team_type: p.n_team_type,
      n_team_type_id: p.n_team_type_id,
      team_type_name: p.tt?.display || null,
      n_service_type: p.n_service_type,
      n_service_type_id: p.n_service_type_id,
      service_type_name: Array.isArray(p.st)
        ? p.st.map((t: any) => t.display).filter(Boolean).join(", ") || null
        : p.st?.display || junctionStMap.get(p.id) || null,
      n_project_types: p.n_project_types,
      project_types_name: junctionPtMap.get(p.id) || null,
      real_customer_display_name: p.real_customer_display_name,
      real_customer_co_name: p.real_customer_co_name,
      real_building_name: p.real_building_name,
      real_district_name: p.real_district_name,
      real_creator_member_name: p.real_creator_member_name,
      enquiry_date: p.enquiry_date,
      closed_reason: p.closed_reason,
      created_date: p.created_date,
      modified_date: p.modified_date,
      asana_link: p.asana_link,
      working_folder: p.working_folder,
    }));
  }, [], "fetchBWAPitchings");
}

export interface PitchingFilters {
  search?: string;
  stage?: string;
  pm?: string;
  team?: string;
  serviceType?: string;
  district?: string;
  financialYear?: string;
  /** BWA: filter by os_money_size (項目規模). */
  osMoneySize?: string;
  /** When true, only rows with non-empty site_photos; also selects site_photos onto the row. */
  hasSitePhotos?: boolean;
  /** BWF only: restrict to pitchings with n_major_quotes_id set (主要查詢列表). */
  requireMajorQuote?: boolean;
  /**
   * Only pitchings whose related man_hour_tasks (job_type pitching) sum(work_hour)
   * is strictly greater than this value. Used by 重點 Pitching.
   */
  minManHourSum?: number;
  sortField?: string;
  sortDir?: "asc" | "desc";
}

/** Pitching IDs whose summed pitching man-hour tasks exceed minHours. */
async function resolvePitchingIdsWithMinManHours(
  minHours: number,
  jobTypes: string[] = ["bwa_pitching"],
): Promise<string[]> {
  const PAGE = 1000;
  const sums = new Map<string, number>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("man_hour_tasks")
      .select("project_id, work_hour")
      .in("job_type", jobTypes)
      .not("project_id", "is", null)
      .range(from, from + PAGE - 1);
    if (error) {
      logError("resolvePitchingIdsWithMinManHours", error);
      return [];
    }
    const rows = data ?? [];
    for (const row of rows) {
      if (!row.project_id) continue;
      sums.set(
        row.project_id,
        (sums.get(row.project_id) || 0) + (Number(row.work_hour) || 0),
      );
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return Array.from(sums.entries())
    .filter(([, hours]) => hours > minHours)
    .map(([id]) => id);
}

/**
 * Staff context for role-based data filtering.
 * - User: only sees pitchings where they are assigned as handler in pitching_bv
 * - Senior User: sees pitchings belonging to their team (n_team_type_id) OR assigned to them via pitching_bv/project_bv
 * - Admin / Super Admin: sees all
 */
export type PitchingStaffContext = StaffDataScope;

export async function fetchBWAPitchingsPaginated(
  page: number = 1,
  pageSize: number = 20,
  filters: PitchingFilters = {},
  staffContext?: PitchingStaffContext
): Promise<PaginatedResult<BWAPitchingRow>> {
  return safeQuery(async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // ─── Role-based row filtering ─────────────────────────
    // For "User" role: only show pitchings where the user is assigned as handler in pitching_bv
    // For "Senior User" role: show pitchings in their team OR assigned via pitching_bv
    let allowedPitchingIds: string[] | null = null;
    if (staffContext) {
      const roleLower = (staffContext.role || "user").toLowerCase();
      if (roleLower === "user" || roleLower === "senior user") {
        // Query pitching_bv to find pitching IDs where handler_id = current staff
        const { data: bvData } = await supabase
          .from("pitching_bv")
          .select("pitching_id")
          .eq("handler_id", staffContext.staffId);
        allowedPitchingIds = (bvData ?? []).map((row: any) => row.pitching_id).filter(Boolean);
        // For "User" role only: if no assignments at all, return empty
        if (roleLower === "user" && (allowedPitchingIds?.length ?? 0) === 0) {
          return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };
        }
      }
    }

    // ─── Min man-hour sum filter (重點 Pitching) ──────────
    let minManHourPitchingIds: string[] | null = null;
    if (filters.minManHourSum != null && filters.minManHourSum > 0) {
      minManHourPitchingIds = await resolvePitchingIdsWithMinManHours(filters.minManHourSum);
      if (minManHourPitchingIds.length === 0) {
        return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };
      }
    }

    let query = supabase
      .from("bwa_pitchings")
      .select(`
        id, bubble_id, pitching_code, description, pitching_stages,
        customer, customer_id, main_pm, main_pm_id, main_designer, main_designer_id,
        estimated_income, estimated_expense, os_money_size,
        size, actual_size, site_address, district, district_id,
        r_building, r_building_id,
        n_financial_year, n_financial_year_id, n_team_type, n_team_type_id,
        n_service_type, n_service_type_id,
        n_project_types,
        real_customer_display_name, real_customer_co_name, real_building_name,
        real_district_name, real_creator_member_name,
        enquiry_date, closed_reason, created_date, modified_date,
        asana_link, working_folder${filters.hasSitePhotos ? ",\n        site_photos" : ""},
        pm:staff!fk_bwa_pitchings_main_pm_id(id, name),
        designer:staff!fk_bwa_pitchings_main_designer_id(id, name),
        dist:districts!fk_bwa_pitchings_district_id(id, name, chinese_display),
        st:service_types!fk_bwa_pitchings_n_service_type_id(id, display)
      `, { count: "exact" });

    // ─── Apply role-based filters ─────────────────────────
    if (staffContext) {
      const roleLower = (staffContext.role || "user").toLowerCase();
      if (roleLower === "user" && allowedPitchingIds) {
        // Filter to only pitchings assigned to this user via pitching_bv
        query = query.in("id", allowedPitchingIds);
      } else if (roleLower === "senior user") {
        // Senior User sees: their team's pitchings + any they're assigned to via pitching_bv
        if (staffContext.teamTypeId && allowedPitchingIds && allowedPitchingIds.length > 0) {
          // Combine: team match OR explicitly assigned
          query = query.or(`n_team_type_id.eq.${staffContext.teamTypeId},id.in.(${allowedPitchingIds.join(",")})`);
        } else if (staffContext.teamTypeId) {
          query = query.eq("n_team_type_id", staffContext.teamTypeId);
        } else if (allowedPitchingIds && allowedPitchingIds.length > 0) {
          query = query.in("id", allowedPitchingIds);
        }
      }
      // "admin" and "super admin" — no filter, see all
    }

    if (minManHourPitchingIds) {
      query = query.in("id", minManHourPitchingIds);
    }

    // Apply filters
    if (filters.search) {
      const q = `%${filters.search}%`;
      query = query.or(
        `pitching_code.ilike.${q},description.ilike.${q},real_customer_display_name.ilike.${q},real_customer_co_name.ilike.${q},site_address.ilike.${q},real_building_name.ilike.${q},real_district_name.ilike.${q},real_creator_member_name.ilike.${q}`
      );
    }

    if (filters.stage && filters.stage !== "all") {
      query = query.eq("pitching_stages", filters.stage);
    }

    if (filters.pm && filters.pm !== "all") {
      // Filter by PM name via the real_creator_member_name field or main_pm_id
      query = query.eq("main_pm_id", filters.pm);
    }

    if (filters.team && filters.team !== "all") {
      query = query.eq("n_team_type_id", filters.team);
    }

    if (filters.serviceType && filters.serviceType !== "all") {
      query = query.eq("n_service_type_id", filters.serviceType);
    }

    if (filters.district && filters.district !== "all") {
      query = query.eq("district_id", filters.district);
    }

    if (filters.financialYear && filters.financialYear !== "all") {
      query = query.eq("n_financial_year_id", filters.financialYear);
    }

    if (filters.osMoneySize && filters.osMoneySize !== "all") {
      query = query.eq("os_money_size", filters.osMoneySize);
    }

    if (filters.hasSitePhotos) {
      query = query.not("site_photos", "is", null).neq("site_photos", "");
    }

    // Sorting
    const sortField = filters.sortField || "created_date";
    const sortDir = filters.sortDir || "desc";
    const ascending = sortDir === "asc";

    // Map sort field names to DB columns
    const sortFieldMap: Record<string, string> = {
      pitching_code: "pitching_code",
      enquiry_date: "enquiry_date",
      estimated_income: "estimated_income",
      estimated_expense: "estimated_expense",
      size: "actual_size",
      created_date: "created_date",
      modified_date: "modified_date",
    };

    const dbSortField = sortFieldMap[sortField] || "created_date";
    query = query.order(dbSortField, { ascending, nullsFirst: false });

    // Pagination
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      logError("fetchBWAPitchingsPaginated", error);
      return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }

    const allData = data ?? [];
    const totalCount = count ?? 0;

    // Resolve project types from junction; service type from n_service_type_id → service_types.display
    const pageIds = allData.map((p: any) => p.id);
    const junctionPtMap = await resolveJunctionProjectTypesForPitchings(pageIds);

    const rows: BWAPitchingRow[] = allData.map((p: any) => ({
      id: p.id,
      bubble_id: p.bubble_id,
      pitching_code: p.pitching_code,
      description: p.description,
      pitching_stages: p.pitching_stages,
      customer: p.customer,
      customer_id: p.customer_id,
      customer_name: p.real_customer_display_name || null,
      customer_company: p.real_customer_co_name || null,
      main_pm: p.main_pm,
      main_pm_id: p.main_pm_id,
      pm_name: p.pm?.name || p.real_creator_member_name || null,
      main_designer: p.main_designer,
      main_designer_id: p.main_designer_id,
      designer_name: p.designer?.name || null,
      estimated_income: p.estimated_income,
      estimated_expense: p.estimated_expense,
      os_money_size: p.os_money_size,
      size: p.size,
      actual_size: p.actual_size,
      site_address: p.site_address,
      district: p.district,
      district_id: p.district_id,
      district_name: p.dist?.chinese_display || p.dist?.name || p.real_district_name || null,
      r_building: p.r_building,
      r_building_id: p.r_building_id,
      building_name: p.real_building_name || null,

      n_financial_year: p.n_financial_year,
      n_financial_year_id: p.n_financial_year_id,
      financial_year_name: null,
      n_team_type: p.n_team_type,
      n_team_type_id: p.n_team_type_id,
      team_type_name: null,
      n_service_type: p.n_service_type,
      n_service_type_id: p.n_service_type_id,
      service_type_name: Array.isArray(p.st)
        ? p.st.map((t: any) => t.display).filter(Boolean).join(", ") || null
        : p.st?.display || null,
      n_project_types: p.n_project_types,
      project_types_name: junctionPtMap.get(p.id) || null,
      real_customer_display_name: p.real_customer_display_name,
      real_customer_co_name: p.real_customer_co_name,
      real_building_name: p.real_building_name,
      real_district_name: p.real_district_name,
      real_creator_member_name: p.real_creator_member_name,
      enquiry_date: p.enquiry_date,
      closed_reason: p.closed_reason,
      created_date: p.created_date,
      modified_date: p.modified_date,
      asana_link: p.asana_link,
      working_folder: p.working_folder,
      site_photos: filters.hasSitePhotos ? (p.site_photos ?? null) : undefined,
    }));

    return {
      data: rows,
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  }, { data: [], totalCount: 0, page, pageSize, totalPages: 0 }, "fetchBWAPitchingsPaginated");
}

// ─── PITCHING FILTER OPTIONS (lightweight, cacheable) ────

export interface PitchingFilterOptions {
  stages: string[];
  pms: { id: string; name: string }[];
  teams: { id: string; display: string }[];
  serviceTypes: { id: string; display: string }[];
  districts: { id: string; name: string }[];
  financialYears: { id: string; display: string }[];
}

export async function fetchPitchingFilterOptions(): Promise<PitchingFilterOptions> {
  return safeQuery(async () => {
    const [stagesRes, pmsRes, teamsRes, stRes, distRes, fyRes] = await Promise.all([
      supabase.from("bwa_pitchings").select("pitching_stages").not("pitching_stages", "is", null),
      supabase.from("staff").select("id, name").order("name"),
      supabase.from("team_types").select("id, display").eq("is_active", true).order("display"),
      supabase.from("service_types").select("id, display").order("display"),
      supabase.from("districts").select("id, name, chinese_display").order("name"),
      supabase.from("financial_years").select("id, display").order("display", { ascending: false }),
    ]);

    // Deduplicate stages
    const stagesSet = new Set<string>();
    (stagesRes.data ?? []).forEach((r: any) => {
      if (r.pitching_stages) stagesSet.add(r.pitching_stages);
    });

    return {
      stages: Array.from(stagesSet).sort(),
      pms: (pmsRes.data ?? []).map((s: any) => ({ id: s.id, name: s.name })),
      teams: (teamsRes.data ?? []).map((t: any) => ({ id: t.id, display: t.display })),
      serviceTypes: (stRes.data ?? []).map((s: any) => ({ id: s.id, display: s.display })),
      districts: (distRes.data ?? []).map((d: any) => ({ id: d.id, name: d.chinese_display || d.name })),
      financialYears: (fyRes.data ?? []).map((f: any) => ({ id: f.id, display: f.display })),
    };
  }, { stages: [], pms: [], teams: [], serviceTypes: [], districts: [], financialYears: [] }, "fetchPitchingFilterOptions");
}

// ─── PITCHING KPI STATS (server-side aggregation) ────────

export interface PitchingKPIStats {
  totalPitchings: number;
  activePitchings: number;
  totalEstimatedIncome: number;
  totalEstimatedExpense: number;
  wonPitchings: number;
  // "Ended" pitchings = Confirmed Project + Case Closed. Used as the hit-rate
  // denominator (more accurate than total, which includes in-progress ones).
  endedPitchings: number;
}

// KPI stats for the BWA pitching list. Accepts the SAME filters + staff
// context as fetchBWAPitchingsPaginated so the headline numbers stay in sync
// with the filtered list result (not the whole table).
export async function fetchPitchingKPIStats(
  filters: PitchingFilters = {},
  staffContext?: PitchingStaffContext
): Promise<PitchingKPIStats> {
  return safeQuery(async () => {
    // ─── Role-based row filtering (mirror of the paginated list) ──
    let allowedPitchingIds: string[] | null = null;
    if (staffContext) {
      const roleLower = (staffContext.role || "user").toLowerCase();
      if (roleLower === "user" || roleLower === "senior user") {
        const { data: bvData } = await supabase
          .from("pitching_bv")
          .select("pitching_id")
          .eq("handler_id", staffContext.staffId);
        allowedPitchingIds = (bvData ?? []).map((row: any) => row.pitching_id).filter(Boolean);
        if (roleLower === "user" && (allowedPitchingIds?.length ?? 0) === 0) {
          return { totalPitchings: 0, activePitchings: 0, totalEstimatedIncome: 0, totalEstimatedExpense: 0, wonPitchings: 0, endedPitchings: 0 };
        }
      }
    }

    let minManHourPitchingIds: string[] | null = null;
    if (filters.minManHourSum != null && filters.minManHourSum > 0) {
      minManHourPitchingIds = await resolvePitchingIdsWithMinManHours(filters.minManHourSum);
      if (minManHourPitchingIds.length === 0) {
        return { totalPitchings: 0, activePitchings: 0, totalEstimatedIncome: 0, totalEstimatedExpense: 0, wonPitchings: 0, endedPitchings: 0 };
      }
    }

    // Build a filtered query identical to the list, paginating to pull every
    // matching row (PostgREST caps at 1000 per request).
    const buildQuery = () => {
      let q = supabase
        .from("bwa_pitchings")
        .select("estimated_income, estimated_expense, pitching_stages", { count: "exact" });

      if (staffContext) {
        const roleLower = (staffContext.role || "user").toLowerCase();
        if (roleLower === "user" && allowedPitchingIds) {
          q = q.in("id", allowedPitchingIds);
        } else if (roleLower === "senior user") {
          if (staffContext.teamTypeId && allowedPitchingIds && allowedPitchingIds.length > 0) {
            q = q.or(`n_team_type_id.eq.${staffContext.teamTypeId},id.in.(${allowedPitchingIds.join(",")})`);
          } else if (staffContext.teamTypeId) {
            q = q.eq("n_team_type_id", staffContext.teamTypeId);
          } else if (allowedPitchingIds && allowedPitchingIds.length > 0) {
            q = q.in("id", allowedPitchingIds);
          }
        }
      }

      if (minManHourPitchingIds) {
        q = q.in("id", minManHourPitchingIds);
      }

      if (filters.search) {
        const s = `%${filters.search}%`;
        q = q.or(
          `pitching_code.ilike.${s},description.ilike.${s},real_customer_display_name.ilike.${s},real_customer_co_name.ilike.${s},site_address.ilike.${s},real_building_name.ilike.${s},real_district_name.ilike.${s},real_creator_member_name.ilike.${s}`
        );
      }
      if (filters.stage && filters.stage !== "all") q = q.eq("pitching_stages", filters.stage);
      if (filters.pm && filters.pm !== "all") q = q.eq("main_pm_id", filters.pm);
      if (filters.team && filters.team !== "all") q = q.eq("n_team_type_id", filters.team);
      if (filters.serviceType && filters.serviceType !== "all") q = q.eq("n_service_type_id", filters.serviceType);
      if (filters.district && filters.district !== "all") q = q.eq("district_id", filters.district);
      if (filters.financialYear && filters.financialYear !== "all") q = q.eq("n_financial_year_id", filters.financialYear);
      if (filters.osMoneySize && filters.osMoneySize !== "all") q = q.eq("os_money_size", filters.osMoneySize);
      return q;
    };

    const PAGE = 1000;
    let all: any[] = [];
    let totalCount = 0;
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, count, error } = await buildQuery().range(from, from + PAGE - 1);
      if (error) { logError("fetchPitchingKPIStats", error); break; }
      if (typeof count === "number") totalCount = count;
      const rows = data ?? [];
      all = all.concat(rows);
      hasMore = rows.length === PAGE;
      from += PAGE;
    }

    const totalEstimatedIncome = all.reduce((sum: number, p: any) => sum + (p.estimated_income || 0), 0);
    const totalEstimatedExpense = all.reduce((sum: number, p: any) => sum + (p.estimated_expense || 0), 0);
    // 成功提案 (won) = pitchings at the "Confirmed Project" stage.
    const isConfirmed = (p: any) =>
      (p.pitching_stages || "").trim().toLowerCase() === "confirmed project";
    const activePitchings = all.filter((p: any) => {
      const s = (p.pitching_stages || "").toLowerCase();
      return !isConfirmed(p) && !s.includes("lost") && !s.includes("close") && !s.includes("won") && !s.includes("結案") && !s.includes("成功") && !s.includes("失敗");
    }).length;
    const wonPitchings = all.filter(isConfirmed).length;
    // "Ended" = Confirmed Project + Case Closed (the hit-rate denominator).
    const endedPitchings = all.filter((p: any) => {
      const s = (p.pitching_stages || "").trim().toLowerCase();
      return s === "confirmed project" || s === "case closed";
    }).length;

    return {
      totalPitchings: totalCount || all.length,
      activePitchings,
      totalEstimatedIncome,
      totalEstimatedExpense,
      wonPitchings,
      endedPitchings,
    };
  }, { totalPitchings: 0, activePitchings: 0, totalEstimatedIncome: 0, totalEstimatedExpense: 0, wonPitchings: 0, endedPitchings: 0 }, "fetchPitchingKPIStats");
}

// ─── BWA PITCHING DETAIL ────────────────────────────────

export interface BWAPitchingDetailData extends BWAPitchingRow {
  // Additional fields for detail view
  other_pm: string | null;
  other_pm_id: string | null;
  other_pm_name: string | null;
  more_pm: string | null;
  more_pm_id: string | null;
  more_pm_name: string | null;
  // Extended customer fields
  customer_display_name: string | null;
  customer_raw_name: string | null;
  customer_raw_company: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  height_to_bs: string | null;
  height_to_fc: string | null;
  height_to_tc: string | null;
  os_money_size: string | null;
  send_email: boolean | null;
  site_photos: string | null;
}

export async function fetchBWAPitchingDetail(
  pitchingId: string
): Promise<BWAPitchingDetailData | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwa_pitchings")
      .select(`
        *,
        pm:staff!fk_bwa_pitchings_main_pm_id(id, name),
        designer:staff!fk_bwa_pitchings_main_designer_id(id, name),
        other_pm_staff:staff!fk_bwa_pitchings_other_pm_id(id, name),
        more_pm_staff:staff!fk_bwa_pitchings_more_pm_id(id, name),
        cust:customers!fk_bwa_pitchings_customer_id(id, customer_name, company_name, display_name, email, phone_display, address),
        dist:districts!fk_bwa_pitchings_district_id(id, name, chinese_display),
        bldg:buildings!fk_bwa_pitchings_r_building_id(id, building_name),
        fy:financial_years!fk_bwa_pitchings_n_financial_year_id(id, display),
        tt:team_types!fk_bwa_pitchings_n_team_type_id(id, display),
        st:service_types!fk_bwa_pitchings_n_service_type_id(id, display)
      `)
      .eq("id", pitchingId)
      .single();

    if (error) {
      logError("fetchBWAPitchingDetail", error);
      return null;
    }
    if (!data) return null;

    // Always resolve from junction tables to get full multi-type data
    const [junctionPtMap, junctionStMap] = await Promise.all([
      resolveJunctionProjectTypesForPitchings([pitchingId]),
      resolveJunctionServiceTypesForPitchings([pitchingId]),
    ]);

    return {
      id: data.id,
      bubble_id: data.bubble_id,
      pitching_code: data.pitching_code,
      description: data.description,
      pitching_stages: data.pitching_stages,
      customer: data.customer,
      customer_id: data.customer_id,
      customer_name: data.real_customer_display_name || data.cust?.customer_name || null,
      customer_company: data.real_customer_co_name || data.cust?.company_name || null,
      customer_display_name: data.cust?.display_name || data.real_customer_display_name || null,
      customer_raw_name: data.cust?.customer_name || null,
      customer_raw_company: data.cust?.company_name || null,
      customer_email: data.cust?.email || null,
      customer_phone: data.cust?.phone_display || null,
      customer_address: data.cust?.address || null,
      main_pm: data.main_pm,
      main_pm_id: data.main_pm_id,
      pm_name: data.pm?.name || data.real_creator_member_name || null,
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
      size: data.size,
      actual_size: data.actual_size,
      site_address: data.site_address,
      district: data.district,
      district_id: data.district_id,
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
      service_type_name: Array.isArray(data.st)
        ? data.st.map((t: any) => t.display).filter(Boolean).join(", ") || null
        : data.st?.display || junctionStMap.get(pitchingId) || null,
      n_project_types: data.n_project_types,
      project_types_name: junctionPtMap.get(pitchingId) || null,
      real_customer_display_name: data.real_customer_display_name,
      real_customer_co_name: data.real_customer_co_name,
      real_building_name: data.real_building_name,
      real_district_name: data.real_district_name,
      real_creator_member_name: data.real_creator_member_name,
      enquiry_date: data.enquiry_date,
      closed_reason: data.closed_reason,
      created_date: data.created_date,
      modified_date: data.modified_date,
      asana_link: data.asana_link,
      working_folder: data.working_folder,
      height_to_bs: data.height_to_bs,
      height_to_fc: data.height_to_fc,
      height_to_tc: data.height_to_tc,
      os_money_size: data.os_money_size,
      send_email: data.send_email,
      site_photos: data.site_photos,
    } as BWAPitchingDetailData;
  }, null, "fetchBWAPitchingDetail");
}

// ─── BWA PITCHING CODE GENERATOR ────────────────────────────────

/**
 * Generates a default pitching code based on:
 * Q + staff.quote_initial + YYYYMM + 3-digit count
 *
 * Example: QJH202604058
 *
 * @param mainPmId - The selected Main PM's staff UUID
 * @returns The generated pitching code string, or "" if unable to generate
 */
export async function generatePitchingCode(mainPmId: string): Promise<string> {
  try {
    // 1. Get the staff's quote_initial
    const { data: staffRecord, error: staffErr } = await supabase
      .from("staff")
      .select("quote_initial")
      .eq("id", mainPmId)
      .maybeSingle();

    if (staffErr || !staffRecord?.quote_initial) {
      console.warn("[generatePitchingCode] Could not fetch quote_initial for staff:", mainPmId);
      return "";
    }

    const quoteInitial = staffRecord.quote_initial;

    // 2. Get current YYYYMM in HK timezone
    const now = new Date();
    const hkDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
    const yyyy = hkDate.getFullYear();
    const mm = String(hkDate.getMonth() + 1).padStart(2, "0");
    const yyyymm = `${yyyy}${mm}`;

    // 3. Build the prefix to search: Q + quote_initial + YYYYMM
    const prefix = `Q${quoteInitial}${yyyymm}`;

    // 4. Find all pitchings whose pitching_code starts with this prefix
    const { data: matchingPitchings, error: searchErr } = await supabase
      .from("bwa_pitchings")
      .select("pitching_code")
      .like("pitching_code", `${prefix}%`);

    if (searchErr) {
      console.warn("[generatePitchingCode] Search query error:", searchErr.message);
      return "";
    }

    // 5. Extract the last 3 digits from each matched code and find the max
    let maxNum = 0;
    if (matchingPitchings && matchingPitchings.length > 0) {
      for (const row of matchingPitchings) {
        if (row.pitching_code && row.pitching_code.length >= prefix.length + 3) {
          const suffix = row.pitching_code.slice(prefix.length, prefix.length + 3);
          const num = parseInt(suffix, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    const nextCount = maxNum + 1;
    const countStr = String(nextCount).padStart(3, "0");

    // 5. Assemble: Q + quote_initial + YYYYMM + 3-digit count
    return `Q${quoteInitial}${yyyymm}${countStr}`;
  } catch (err) {
    console.error("[generatePitchingCode] Error:", err);
    return "";
  }
}

// ─── BWA PITCHING CRUD ────────────────────────────────

export async function createBWAPitching(
  data: {
    pitching_code?: string;
    description?: string;
    pitching_stages?: string;
    customer_id?: string;
    main_pm_id?: string;
    main_designer_id?: string;
    other_pm_id?: string;
    more_pm_id?: string;
    estimated_income?: number;
    estimated_expense?: number;
    os_money_size?: string;
    size?: string;
    actual_size?: string;
    site_address?: string;
    district_id?: string;
    r_building_id?: string;

    n_financial_year_id?: string;
    n_team_type_id?: string;
    n_service_type_id?: string;
    enquiry_date?: string;
    asana_link?: string;
    working_folder?: string;
    created_by_id?: string;
    created_date?: string;
    modified_date?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { b2b_b2c: _omitB2b, ...safeData } = data as typeof data & { b2b_b2c?: string };
    return await adminFetch({ action: "create", table: "bwa_pitchings", data: safeData });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createPitchingBV(
  data: {
    pitching_status: string;
    created_date: string;
    modified_date: string;
    handler_id: string;
    // Either pitching_id (BWA) or bwf_pitching_id (BWF) links the BV record.
    pitching_id?: string;
    bwf_pitching_id?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await adminFetch({ action: "create", table: "pitching_bv", data });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchPitchingBVByPitchingId(
  pitchingId: string
): Promise<{ id: string; handler_id: string | null; pitching_status: string | null }[]> {
  try {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "query", table: "pitching_bv", filter: { pitching_id: pitchingId } }),
    });
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error("[data-service] fetchPitchingBVByPitchingId error:", err);
    return [];
  }
}

export async function updatePitchingBV(
  id: string,
  updates: { handler_id?: string; pitching_status?: string; modified_date?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({ action: "update", table: "pitching_bv", id, updates });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deletePitchingBV(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({ action: "delete", table: "pitching_bv", id });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function syncBWAProjectOsScheduleGroupFromPitching(
  pitchingId: string,
): Promise<void> {
  try {
    const { data: pitching, error: fetchErr } = await supabase
      .from("bwa_pitchings")
      .select("n_service_type_id, estimated_income")
      .eq("id", pitchingId)
      .maybeSingle();

    if (fetchErr || !pitching) {
      if (fetchErr) logError("syncBWAProjectOsScheduleGroupFromPitching fetch", fetchErr);
      return;
    }

    const osScheduleGroup = computeOsScheduleGroup(
      pitching.n_service_type_id,
      pitching.estimated_income != null ? Number(pitching.estimated_income) : null,
    );

    const { error: updateErr } = await supabase
      .from("bwa_projects")
      .update({ os_schedule_group: osScheduleGroup })
      .eq("pitching_id", pitchingId);

    if (updateErr) {
      logError("syncBWAProjectOsScheduleGroupFromPitching update", updateErr);
    }
  } catch (err) {
    logError("syncBWAProjectOsScheduleGroupFromPitching", err);
  }
}

export async function updateBWAPitching(
  id: string,
  updates: {
    pitching_code?: string;
    description?: string;
    pitching_stages?: string;
    customer_id?: string;
    main_pm_id?: string;
    main_designer_id?: string;
    other_pm_id?: string;
    more_pm_id?: string;
    estimated_income?: number;
    estimated_expense?: number;
    size?: string;
    actual_size?: string;
    site_address?: string;
    district_id?: string;
    r_building_id?: string;

    n_financial_year_id?: string;
    n_team_type_id?: string;
    n_service_type_id?: string;
    quote_project_type_id?: string | null;
    enquiry_date?: string;
    closed_reason?: string;
    asana_link?: string;
    working_folder?: string;
    height_to_tc?: string;
    height_to_bs?: string;
    height_to_fc?: string;
    os_money_size?: string;
    site_photos?: string;
    modified_date?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { b2b_b2c: _omitB2b, ...safeUpdates } = updates as typeof updates & { b2b_b2c?: string };
    const result = await adminFetch({
      action: "update",
      table: "bwa_pitchings",
      id,
      updates: safeUpdates,
    });
    if (
      result.success &&
      (safeUpdates.n_service_type_id !== undefined || safeUpdates.estimated_income !== undefined)
    ) {
      await syncBWAProjectOsScheduleGroupFromPitching(id);
    }
    return result;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteBWAPitching(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({ action: "delete", table: "bwa_pitchings", id });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── PITCHING CASCADE DELETE ANALYSIS ────────────────────────────────────────

export interface CascadeRelatedRecord {
  table: string;
  label: string;
  count: number;
  records: { id: string; display: string }[];
  fk_action: string;
  children?: CascadeRelatedRecord[];
}

export interface PitchingCascadeAnalysisResult {
  pitching: { id: string; pitching_code: string; pitching_name: string };
  related_groups: CascadeRelatedRecord[];
  project_chain: CascadeRelatedRecord | null;
  customer_chain: CascadeRelatedRecord | null;
  total_related_count: number;
}

export async function analyzePitchingCascadeDelete(pitchingId: string): Promise<{ data?: PitchingCascadeAnalysisResult; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/supabase-functions-pitching-cascade-delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({ pitching_id: pitchingId, action: "analyze" }),
    });
    const text = await res.text();
    if (!res.ok) return { error: `Analysis failed (${res.status}): ${text}` };
    const parsed = JSON.parse(text);
    return { data: parsed };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function executePitchingCascadeDelete(
  pitchingId: string,
  selections: Record<string, boolean>,
  deletePitching: boolean = true,
  deleteProject: boolean = false,
  deleteCustomer: boolean = false
): Promise<{ success: boolean; deletion_log?: { table: string; deleted: number; error?: string }[]; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/supabase-functions-pitching-cascade-delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({
        pitching_id: pitchingId,
        action: "execute",
        selections,
        delete_pitching: deletePitching,
        delete_project: deleteProject,
        delete_customer: deleteCustomer,
      }),
    });
    const text = await res.text();
    if (!res.ok) return { success: false, error: `Execution failed (${res.status}): ${text}` };
    const parsed = JSON.parse(text);
    return parsed;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
