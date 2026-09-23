import {
  supabase,
  adminFetch,
  logError,
  safeQuery,
} from "@/lib/data/_core";
import {
  resolveBwfJunctionServiceTypesForPitchings,
  resolveBwfJunctionServiceItemsForPitchings,
  resolveBwfJunctionMajorQuotesForPitchings,
  fetchBwfPitchingIdsForServiceType,
} from "@/lib/data/junctions";
import type { LinkOption } from "@/lib/data/lookups";
import type { PaginatedResult } from "@/lib/data/customers";
import type {
  BWAPitchingRow,
  BWAPitchingDetailData,
  PitchingFilters,
  PitchingStaffContext,
  PitchingKPIStats,
} from "@/lib/data/bwa-pitching";

// ─── BWF PITCHINGS (bwf_pitchings) ──────────────────────────
// BWF mirrors the BWA pitching list but reads from bwf_pitchings, which has a
// slightly different schema (pitching_name vs description, os_size vs size,
// r_district_id vs district_id, real_creator_name vs real_creator_member_name,
// case_close_reason vs closed_reason). We map those into the shared
// BWAPitchingRow shape so the same list component can render either source.
// BWF pitching list returns all rows; page access is gated by the permission matrix.
export async function fetchBWFPitchingsPaginated(
  page: number = 1,
  pageSize: number = 20,
  filters: PitchingFilters = {},
  _staffContext?: PitchingStaffContext
): Promise<PaginatedResult<BWAPitchingRow>> {
  return safeQuery(async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("bwf_pitchings")
      .select(`
        id, bubble_id, pitching_code, pitching_name, pitching_stages,
        customer, customer_id, main_pm, main_pm_id, main_designer, main_designer_id,
        more_pms_id, other_pms_id,
        estimated_income, estimated_expense, quote_content,
        size, os_size, site_address, district, r_district_id,
        r_building, r_building_id,
        n_financial_year_id, n_team_type_id,
        n_bwf_service_types_id, n_source_id, n_customer_type_id, n_major_quotes_id, n_service_items_id,
        real_customer_display_name, real_customer_name, real_building_name,
        real_creator_name,
        enquiry_date, case_close_reason, created_date, modified_date,
        asana_link, working_folder,
        pm:staff!fk_bwf_pitchings_main_pm_id(id, name),
        designer:staff!fk_bwf_pitchings_main_designer_id(id, name),
        dist:districts!fk_bwf_pitchings_r_district_id(id, name, chinese_display),
        ctype:client_types!fk_bwf_pitchings_n_customer_type_id(id, display)
      `, { count: "exact" });

    if (filters.search) {
      const q = `%${filters.search}%`;
      query = query.or(
        `pitching_code.ilike.${q},pitching_name.ilike.${q},real_customer_display_name.ilike.${q},real_customer_name.ilike.${q},site_address.ilike.${q},real_building_name.ilike.${q},real_creator_name.ilike.${q}`
      );
    }
    if (filters.stage && filters.stage !== "all") query = query.eq("pitching_stages", filters.stage);
    if (filters.pm && filters.pm !== "all") query = query.eq("main_pm_id", filters.pm);
    if (filters.team && filters.team !== "all") query = query.eq("n_team_type_id", filters.team);
    if (filters.serviceType && filters.serviceType !== "all") {
      const matchIds = await fetchBwfPitchingIdsForServiceType(filters.serviceType);
      if (matchIds.length === 0) {
        return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };
      }
      query = query.in("id", matchIds);
    }
    if (filters.district && filters.district !== "all") query = query.eq("r_district_id", filters.district);
    if (filters.financialYear && filters.financialYear !== "all") query = query.eq("n_financial_year_id", filters.financialYear);
    if (filters.requireMajorQuote) query = query.not("n_major_quotes_id", "is", null);

    const sortField = filters.sortField || "created_date";
    const ascending = (filters.sortDir || "desc") === "asc";
    const sortFieldMap: Record<string, string> = {
      pitching_code: "pitching_code",
      enquiry_date: "enquiry_date",
      estimated_income: "estimated_income",
      estimated_expense: "estimated_expense",
      size: "os_size",
      created_date: "created_date",
    };
    query = query.order(sortFieldMap[sortField] || "created_date", { ascending, nullsFirst: false });
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) {
      logError("fetchBWFPitchingsPaginated", error);
      return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }

    const pageData = data ?? [];
    const pageIds = pageData.map((p: any) => p.id);
    const junctionStMap = await resolveBwfJunctionServiceTypesForPitchings(pageIds);

    const majorQuoteIds = [
      ...new Set(pageData.map((p: any) => p.n_major_quotes_id).filter(Boolean)),
    ];
    let mqMap = new Map<string, string>();
    if (majorQuoteIds.length) {
      const { data: mqRows } = await supabase
        .from("bwf_major_quotes")
        .select("id, display")
        .in("id", majorQuoteIds);
      mqMap = new Map((mqRows ?? []).map((m: any) => [m.id, m.display as string]));
    }

    const rows: BWAPitchingRow[] = pageData.map((p: any) => ({
      id: p.id,
      bubble_id: p.bubble_id,
      pitching_code: p.pitching_code,
      description: p.pitching_name,
      pitching_stages: p.pitching_stages,
      customer: p.customer,
      customer_id: p.customer_id,
      customer_name: p.real_customer_display_name || p.real_customer_name || null,
      customer_company: p.real_customer_name || null,
      main_pm: p.main_pm,
      main_pm_id: p.main_pm_id,
      pm_name: p.pm?.name || p.real_creator_name || null,
      main_designer: p.main_designer,
      main_designer_id: p.main_designer_id,
      designer_name: p.designer?.name || null,
      estimated_income: p.estimated_income,
      estimated_expense: p.estimated_expense,
      os_money_size: null,
      size: p.size,
      actual_size: null,
      site_address: p.site_address,
      district: p.district,
      district_id: p.r_district_id,
      district_name: p.dist?.chinese_display || p.dist?.name || null,
      r_building: p.r_building,
      r_building_id: p.r_building_id,
      building_name: p.real_building_name || null,
      n_financial_year: null,
      n_financial_year_id: p.n_financial_year_id,
      financial_year_name: null,
      n_team_type: null,
      n_team_type_id: p.n_team_type_id,
      team_type_name: null,
      n_service_type: null,
      n_service_type_id: p.n_bwf_service_types_id,
      service_type_name: junctionStMap.get(p.id) || null,
      n_project_types: null,
      project_types_name: null,
      real_customer_display_name: p.real_customer_display_name,
      real_customer_co_name: p.real_customer_name,
      real_building_name: p.real_building_name,
      real_district_name: null,
      real_creator_member_name: p.real_creator_name,
      enquiry_date: p.enquiry_date,
      closed_reason: p.case_close_reason,
      created_date: p.created_date,
      modified_date: p.modified_date,
      asana_link: p.asana_link,
      working_folder: p.working_folder,
      quote_content: p.quote_content,
      os_size: p.os_size,
      n_source_id: p.n_source_id,
      n_customer_type_id: p.n_customer_type_id,
      customer_type_name: p.ctype?.display || null,
      n_major_quotes_id: p.n_major_quotes_id,
      major_quote_display: p.n_major_quotes_id
        ? mqMap.get(p.n_major_quotes_id) || null
        : null,
      n_service_items_id: p.n_service_items_id,
      other_pm_id: p.other_pms_id,
      more_pm_id: p.more_pms_id,
    } as any));

    const totalCount = count ?? 0;
    return {
      data: rows,
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  }, { data: [], totalCount: 0, page, pageSize, totalPages: 0 }, "fetchBWFPitchingsPaginated");
}

export async function fetchBWFPitchingKPIStats(
  filters: PitchingFilters = {},
  _staffContext?: PitchingStaffContext
): Promise<PitchingKPIStats> {
  return safeQuery(async () => {
    let serviceTypeMatchIds: string[] | null = null;
    if (filters.serviceType && filters.serviceType !== "all") {
      serviceTypeMatchIds = await fetchBwfPitchingIdsForServiceType(filters.serviceType);
      if (serviceTypeMatchIds.length === 0) {
        return { totalPitchings: 0, activePitchings: 0, totalEstimatedIncome: 0, totalEstimatedExpense: 0, wonPitchings: 0, endedPitchings: 0 };
      }
    }

    const buildQuery = () => {
      let q = supabase
        .from("bwf_pitchings")
        .select("estimated_income, estimated_expense, pitching_stages", { count: "exact" });

      if (filters.search) {
        const s = `%${filters.search}%`;
        q = q.or(
          `pitching_code.ilike.${s},pitching_name.ilike.${s},real_customer_display_name.ilike.${s},real_customer_name.ilike.${s},site_address.ilike.${s},real_building_name.ilike.${s},real_creator_name.ilike.${s}`
        );
      }
      if (filters.stage && filters.stage !== "all") q = q.eq("pitching_stages", filters.stage);
      if (filters.pm && filters.pm !== "all") q = q.eq("main_pm_id", filters.pm);
      if (filters.team && filters.team !== "all") q = q.eq("n_team_type_id", filters.team);
      if (serviceTypeMatchIds) q = q.in("id", serviceTypeMatchIds);
      if (filters.district && filters.district !== "all") q = q.eq("r_district_id", filters.district);
      if (filters.financialYear && filters.financialYear !== "all") q = q.eq("n_financial_year_id", filters.financialYear);
      if (filters.requireMajorQuote) q = q.not("n_major_quotes_id", "is", null);
      return q;
    };

    const PAGE = 1000;
    let all: any[] = [];
    let totalCount = 0;
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, count, error } = await buildQuery().range(from, from + PAGE - 1);
      if (error) { logError("fetchBWFPitchingKPIStats", error); break; }
      if (typeof count === "number") totalCount = count;
      const rows = data ?? [];
      all = all.concat(rows);
      hasMore = rows.length === PAGE;
      from += PAGE;
    }

    const totalEstimatedIncome = all.reduce((s: number, p: any) => s + (p.estimated_income || 0), 0);
    const totalEstimatedExpense = all.reduce((s: number, p: any) => s + (p.estimated_expense || 0), 0);
    const isConfirmed = (p: any) =>
      (p.pitching_stages || "").trim().toLowerCase() === "confirmed project";
    const activePitchings = all.filter((p: any) => {
      const s = (p.pitching_stages || "").toLowerCase();
      return !isConfirmed(p) && !s.includes("lost") && !s.includes("close") && !s.includes("won") && !s.includes("結案") && !s.includes("成功") && !s.includes("失敗");
    }).length;
    const wonPitchings = all.filter(isConfirmed).length;
    const endedPitchings = all.filter((p: any) => {
      const s = (p.pitching_stages || "").trim().toLowerCase();
      return s === "confirmed project" || s === "case closed";
    }).length;

    return { totalPitchings: totalCount || all.length, activePitchings, totalEstimatedIncome, totalEstimatedExpense, wonPitchings, endedPitchings };
  }, { totalPitchings: 0, activePitchings: 0, totalEstimatedIncome: 0, totalEstimatedExpense: 0, wonPitchings: 0, endedPitchings: 0 }, "fetchBWFPitchingKPIStats");
}

export interface BWFPitchingDetailData extends BWAPitchingDetailData {
  service_item_name: string | null;
  major_quote_name: string | null;
  source_name: string | null;
  customer_type_name: string | null;
  quote_content?: string | null;
  os_size?: string | null;
  n_source_id?: string | null;
  n_customer_type_id?: string | null;
  n_major_quotes_id?: string | null;
  n_service_items_id?: string | null;
}

export async function fetchBWFPitchingDetail(
  pitchingId: string
): Promise<BWFPitchingDetailData | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwf_pitchings")
      .select(`
        *,
        pm:staff!fk_bwf_pitchings_main_pm_id(id, name),
        designer:staff!fk_bwf_pitchings_main_designer_id(id, name),
        other_pm_staff:staff!fk_bwf_pitchings_other_pms_id(id, name),
        more_pm_staff:staff!fk_bwf_pitchings_more_pms_id(id, name),
        cust:customers!fk_bwf_pitchings_customer_id(id, customer_name, company_name, display_name, email, phone_display, address),
        dist:districts!fk_bwf_pitchings_r_district_id(id, name, chinese_display),
        bldg:buildings!fk_bwf_pitchings_r_building_id(id, building_name),
        fy:financial_years!fk_bwf_pitchings_n_financial_year_id(id, display),
        tt:team_types!fk_bwf_pitchings_n_team_type_id(id, display),
        src:source_types!fk_bwf_pitchings_n_source_id(id, display),
        ctype:client_types!fk_bwf_pitchings_n_customer_type_id(id, display)
      `)
      .eq("id", pitchingId)
      .single();

    if (error) {
      logError("fetchBWFPitchingDetail", error);
      return null;
    }
    if (!data) return null;

    const [junctionStMap, junctionSiMap, junctionMqMap] = await Promise.all([
      resolveBwfJunctionServiceTypesForPitchings([pitchingId]),
      resolveBwfJunctionServiceItemsForPitchings([pitchingId]),
      resolveBwfJunctionMajorQuotesForPitchings([pitchingId]),
    ]);

    return {
      id: data.id,
      bubble_id: data.bubble_id,
      pitching_code: data.pitching_code,
      description: data.pitching_name,
      pitching_stages: data.pitching_stages,
      customer: data.customer,
      customer_id: data.customer_id,
      customer_name: data.real_customer_display_name || data.cust?.customer_name || null,
      customer_company: data.real_customer_name || data.cust?.company_name || null,
      customer_display_name: data.cust?.display_name || data.real_customer_display_name || null,
      customer_raw_name: data.cust?.customer_name || null,
      customer_raw_company: data.cust?.company_name || null,
      customer_email: data.cust?.email || null,
      customer_phone: data.cust?.phone_display || null,
      customer_address: data.cust?.address || null,
      main_pm: data.main_pm,
      main_pm_id: data.main_pm_id,
      pm_name: data.pm?.name || data.real_creator_name || null,
      main_designer: data.main_designer,
      main_designer_id: data.main_designer_id,
      designer_name: data.designer?.name || null,
      other_pm: data.other_pms,
      other_pm_id: data.other_pms_id,
      other_pm_name: data.other_pm_staff?.name || null,
      more_pm: data.more_pms,
      more_pm_id: data.more_pms_id,
      more_pm_name: data.more_pm_staff?.name || null,
      estimated_income: data.estimated_income,
      estimated_expense: data.estimated_expense,
      size: data.os_size,
      actual_size: data.size,
      site_address: data.site_address,
      district: data.district,
      district_id: data.r_district_id,
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
      service_type_name: junctionStMap.get(pitchingId) || null,
      n_project_types: null,
      project_types_name: null,
      real_customer_display_name: data.real_customer_display_name,
      real_customer_co_name: data.real_customer_name,
      real_building_name: data.real_building_name,
      real_district_name: null,
      real_creator_member_name: data.real_creator_name,
      enquiry_date: data.enquiry_date,
      closed_reason: data.case_close_reason,
      created_date: data.created_date,
      modified_date: data.modified_date,
      asana_link: data.asana_link,
      working_folder: data.working_folder,
      height_to_bs: null,
      height_to_fc: null,
      height_to_tc: null,
      os_money_size: null,
      send_email: data.send_email,
      site_photos: null,
      service_item_name: junctionSiMap.get(pitchingId) || null,
      major_quote_name: junctionMqMap.get(pitchingId) || null,
      source_name: data.src?.display || null,
      customer_type_name: data.ctype?.display || null,
      quote_content: data.quote_content,
      os_size: data.os_size,
      n_source_id: data.n_source_id,
      n_customer_type_id: data.n_customer_type_id,
      n_major_quotes_id: data.n_major_quotes_id,
      n_service_items_id: data.n_service_items_id,
    } as BWFPitchingDetailData;
  }, null, "fetchBWFPitchingDetail");
}

export interface BWFCostStructureRow {
  id: string;
  expense_type_id: string | null;
  expense_type_name: string | null;
  amount: number | null;
}

export async function fetchBWFPitchingCostStructure(
  bwfPitchingId: string
): Promise<BWFCostStructureRow[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("quotation_expenses")
      .select(`
        id, amount, n_expense_type_id,
        etype:supplier_types!fk_quotation_expenses_n_expense_type_id(id, display, chinese_display)
      `)
      .eq("bwf_pitching_id", bwfPitchingId)
      .order("created_date", { ascending: true });
    if (error) {
      logError("fetchBWFPitchingCostStructure", error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      expense_type_id: r.n_expense_type_id,
      expense_type_name: r.etype?.chinese_display || r.etype?.display || null,
      amount: r.amount,
    }));
  }, [], "fetchBWFPitchingCostStructure");
}

export async function searchBWFPitchingOptions(searchTerm: string = "", limit: number = 30): Promise<LinkOption[]> {
  return safeQuery(async () => {
    let query = supabase
      .from("bwf_pitchings")
      .select("id, pitching_code, pitching_name, real_customer_display_name")
      .order("pitching_code", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (searchTerm) {
      const q = `%${searchTerm}%`;
      query = query.or(`pitching_code.ilike.${q},pitching_name.ilike.${q},real_customer_display_name.ilike.${q}`);
    }
    const { data, error } = await query;
    if (error) { logError("searchBWFPitchingOptions", error); return []; }
    return (data ?? []).map((p: any) => ({
      id: p.id,
      label: p.pitching_code || "(無編號)",
      sublabel: p.pitching_name || p.real_customer_display_name || undefined,
    }));
  }, [], "searchBWFPitchingOptions");
}

export async function fetchBWFPitchingLabel(pitchingId: string): Promise<string> {
  return safeQuery(async () => {
    const { data } = await supabase
      .from("bwf_pitchings")
      .select("pitching_code, pitching_name")
      .eq("id", pitchingId)
      .maybeSingle();
    return data?.pitching_code || data?.pitching_name || "";
  }, "", "fetchBWFPitchingLabel");
}

export async function fetchBWFProjectIdByPitching(
  pitchingId: string,
): Promise<{ id: string; label: string } | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwf_projects")
      .select("id, project_code, project_name")
      .eq("bwf_pitching_id", pitchingId)
      .limit(1)
      .maybeSingle();
    if (error) { logError("fetchBWFProjectIdByPitching", error); return null; }
    if (!data?.id) return null;
    return {
      id: data.id,
      label: data.project_code || data.project_name || "",
    };
  }, null, "fetchBWFProjectIdByPitching");
}

export async function fetchBWFPitchingIdByProject(
  projectId: string,
): Promise<{ id: string; label: string } | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwf_projects")
      .select("bwf_pitching_id")
      .eq("id", projectId)
      .maybeSingle();
    if (error) { logError("fetchBWFPitchingIdByProject", error); return null; }
    if (!data?.bwf_pitching_id) return null;
    const label = await fetchBWFPitchingLabel(data.bwf_pitching_id);
    return { id: data.bwf_pitching_id, label };
  }, null, "fetchBWFPitchingIdByProject");
}

export interface BWFPitchingWriteData {
  pitching_code?: string;
  pitching_name?: string;
  pitching_stages?: string;
  customer_id?: string;
  real_customer_display_name?: string;
  main_pm_id?: string;
  main_designer_id?: string;
  other_pms_id?: string;
  more_pms_id?: string;
  estimated_income?: number;
  estimated_expense?: number;
  quote_content?: string;
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
  enquiry_date?: string;
  case_close_reason?: string;
  asana_link?: string;
  working_folder?: string;
  created_by_id?: string;
  created_date?: string;
  modified_date?: string;
}

export async function createBWFPitching(
  data: BWFPitchingWriteData
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await adminFetch({ action: "create", table: "bwf_pitchings", data });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateBWFPitching(
  id: string,
  updates: BWFPitchingWriteData
): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({ action: "update", table: "bwf_pitchings", id, updates });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteBWFPitching(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({ action: "delete", table: "bwf_pitchings", id });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchBWFPitchingServiceTypeIds(pitchingId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("bwf_pitching_bwf_service_types")
    .select("service_type_id")
    .eq("pitching_id", pitchingId);
  if (error || !data) return [];
  return (data as any[]).map((r) => r.service_type_id).filter(Boolean);
}

export async function fetchBWFPitchingServiceItemIds(pitchingId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("bwf_pitching_service_items")
    .select("service_item_id")
    .eq("pitching_id", pitchingId);
  if (error || !data) return [];
  return (data as any[]).map((r) => r.service_item_id).filter(Boolean);
}

export async function fetchBWFPitchingMajorQuoteIds(pitchingId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("bwf_pitching_major_quotes")
    .select("major_quote_id")
    .eq("pitching_id", pitchingId);
  if (error || !data) return [];
  return (data as any[]).map((r) => r.major_quote_id).filter(Boolean);
}

export interface BWFPitchingCodeParams {
  serviceTypeId?: string | null;
  sourceId?: string | null;
  customerTypeId?: string | null;
  financialYearId?: string | null;
}

const BWF_SOURCE_PP_DISPLAY = "BWA-PP";

export async function generateBWFPitchingCode(
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

    const group2 = `${group2Prefix}${yyCode}`;
    const prefix = `${group1}-${group2}`;

    const { data: matching } = await supabase
      .from("bwf_pitchings")
      .select("pitching_code")
      .like("pitching_code", `${prefix}-%`);

    let maxNum = 0;
    for (const row of matching ?? []) {
      const code = row.pitching_code;
      if (!code || !code.startsWith(`${prefix}-`)) continue;
      const lastGroup = code.slice(prefix.length + 1).split("-")[0];
      const num = parseInt(lastGroup, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }

    return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
  } catch (err) {
    console.error("[generateBWFPitchingCode] Error:", err);
    return "";
  }
}
