import { CUSTOMER_STATUS_FILTER_VALUES } from "@/lib/customer-status";
import { buildStorageObjectKey } from "@/lib/storage-utils";
import {
  supabase,
  adminFetch,
  logError,
  safeQuery,
} from "@/lib/data/_core";
import type { LinkOption } from "@/lib/data/lookups";

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchCustomerOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    // Paginate — PostgREST defaults to 1000 rows max
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, customer_name, display_name, company_name, brand_name_cn, email")
        .eq("status", "Active")
        .order("customer_name", { ascending: true, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        logError("fetchCustomerOptions", error);
        break;
      }
      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    return allData.map((c: any) => ({
      id: c.id,
      label: c.display_name || c.customer_name || c.company_name || "未命名",
      sublabel: [c.company_name, c.brand_name_cn].filter(Boolean).join(" · "),
    }));
  }, [], "fetchCustomerOptions");
}

// ─── CUSTOMERS LIST ─────────────────────────────────────

export interface CustomerRow {
  id: string;
  bubble_id: string | null;
  customer_name: string | null;
  display_name: string | null;
  company_name: string | null;
  brand_name_cn: string | null;
  brand_name_en: string | null;
  branding_icon: string | null;
  email: string | null;
  phone_display: string | null;
  phone_number_a: string | null;
  address: string | null;
  tags: string | null;
  industry_tags: string[] | null;
  /** True when customer has the「知名品牌」tag */
  is_well_known_brand: boolean;
  view_system: string | null;
  status: string | null;
  status_filter_value: string | null;
  bwa_income: number | null;
  bwa_profit: number | null;
  bwf_income: number | null;
  bwf_profit: number | null;
  bwa_receivable: number | null;
  bwf_receivable: number | null;
  bwa_project_number: number | null;
  bwf_project_number: number | null;
  bwa_pitching_number: number | null;
  bwf_pitching_no: number | null;
  created_date: string | null;
  enquiry_create_date: string | null;
  modified_date: string | null;
  remark: string | null;
  real_created_by_name: string | null;
  // Calculated from bwa_projects (sum of estimated_income for this customer)
  bwa_signed_income: number | null;
  // Calculated from bwa_projects (sum of estimated_profit for this customer)
  bwa_project_profit: number | null;
}

export async function fetchCustomers(): Promise<CustomerRow[]> {
  return safeQuery(async () => {
    // PostgREST defaults to 1000 rows max — paginate to fetch ALL customers
    const PAGE_SIZE = 1000;
    const selectFields =
      "id, bubble_id, customer_name, display_name, company_name, brand_name_cn, brand_name_en, branding_icon, email, phone_display, phone_number_a, address, tags, view_system, status, status_filter_value, bwa_income, bwa_profit, bwf_income, bwf_profit, bwa_receivable, bwf_receivable, bwa_project_number, bwf_project_number, bwa_pitching_number, bwf_pitching_no, created_date, enquiry_create_date, modified_date, remark, real_created_by_name";

    const INDUSTRY_COLLECTION_ID = CUSTOMER_INDUSTRY_COLLECTION_ID;

    // Fetch customer tag lookup + industry tags (junction) + BWA project sums in parallel
    const [
      { data: custTagRows },
      { data: industryTagJunction },
      { data: industryTagLookup },
      { data: bwaProjects },
    ] = await Promise.all([
      supabase.from("nos_customer_tags").select("bubble_id, display"),
      supabase
        .from("customer_tags")
        .select("customer_uuid, tag_uuid")
        .eq("collection_uuid", INDUSTRY_COLLECTION_ID),
      supabase
        .from("nos_customer_tags")
        .select("id, display")
        .eq("collection_id", INDUSTRY_COLLECTION_ID),
      supabase
        .from("bwa_projects")
        .select("customer, estimated_income, estimated_profit"),
    ]);

    const custTagMap = new Map<string, string>();
    (custTagRows ?? []).forEach((t: any) => {
      if (t.bubble_id) custTagMap.set(t.bubble_id, t.display ?? "");
    });

    // Build industry tag name lookup: tag_uuid → display
    const industryTagNameMap = new Map<string, string>();
    (industryTagLookup ?? []).forEach((t: any) => {
      if (t.id) industryTagNameMap.set(t.id, t.display ?? "");
    });

    // Build customer → industry tag names map
    const customerIndustryMap = new Map<string, string[]>();
    (industryTagJunction ?? []).forEach((row: any) => {
      if (!row.customer_uuid || !row.tag_uuid) return;
      const tagName = industryTagNameMap.get(row.tag_uuid);
      if (!tagName) return;
      if (!customerIndustryMap.has(row.customer_uuid)) {
        customerIndustryMap.set(row.customer_uuid, []);
      }
      customerIndustryMap.get(row.customer_uuid)!.push(tagName);
    });

    // Build BWA project aggregation: customer_id → { totalIncome, totalProfit }
    const bwaAggMap = new Map<string, { income: number; profit: number }>();
    (bwaProjects ?? []).forEach((p: any) => {
      if (!p.customer) return;
      const custId = String(p.customer).trim();
      if (!bwaAggMap.has(custId)) bwaAggMap.set(custId, { income: 0, profit: 0 });
      const agg = bwaAggMap.get(custId)!;
      agg.income += (p.estimated_income ?? 0);
      agg.profit += (p.estimated_profit ?? 0);
    });

    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("customers")
        .select(selectFields)
        .eq("status", "Active")
        .order("customer_name", { ascending: true, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logError("fetchCustomers", error);
        break;
      }

      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    return allData.map((c: any) => {
      // Try matching BWA projects by UUID id
      const bwaById = bwaAggMap.get(c.id);
      // Also try by bubble_id (legacy customer field may store bubble_id)
      const bwaByBubble = c.bubble_id ? bwaAggMap.get(c.bubble_id) : null;
      const bwaAgg = bwaById || bwaByBubble;

      return {
        id: c.id,
        bubble_id: c.bubble_id,
        customer_name: c.customer_name,
        display_name: c.display_name,
        company_name: c.company_name,
        brand_name_cn: c.brand_name_cn,
        brand_name_en: c.brand_name_en,
        branding_icon: c.branding_icon,
        email: c.email,
        phone_display: c.phone_display || c.phone_number_a,
        phone_number_a: c.phone_number_a,
        address: c.address,
        tags: (() => {
          if (!c.tags || custTagMap.size === 0) return c.tags;
          const ids = String(c.tags).split(",").map((x: string) => x.trim()).filter(Boolean);
          const names = ids
            .map((id: string) => custTagMap.get(id))
            .filter((name): name is string => !!name);
          return names.length > 0 ? names.join(", ") : null;
        })(),
        industry_tags: customerIndustryMap.get(c.id) ?? null,
        is_well_known_brand: false,
        view_system: c.view_system,
        status: c.status ?? "Active",
        status_filter_value: c.status_filter_value,
        bwa_income: c.bwa_income,
        bwa_profit: c.bwa_profit,
        bwf_income: c.bwf_income,
        bwf_profit: c.bwf_profit,
        bwa_receivable: c.bwa_receivable,
        bwf_receivable: c.bwf_receivable,
        bwa_project_number: c.bwa_project_number,
        bwf_project_number: c.bwf_project_number,
        bwa_pitching_number: c.bwa_pitching_number,
        bwf_pitching_no: c.bwf_pitching_no,
        created_date: c.created_date,
        enquiry_create_date: c.enquiry_create_date ?? null,
        modified_date: c.modified_date,
        remark: c.remark,
        real_created_by_name: c.real_created_by_name,
        bwa_signed_income: bwaAgg?.income ?? null,
        bwa_project_profit: bwaAgg?.profit ?? null,
      };
    });
  }, [], "fetchCustomers");
}

// ─── CUSTOMERS PAGINATED (Server-side filtering/sorting) ──

const CUSTOMER_INDUSTRY_COLLECTION_ID = "4f5de598-2dcb-45a6-a106-9d933e9a8007";

// Tag id for "知名品牌 Well-known Brands" (nos_customer_tags.id).
export const WELL_KNOWN_BRANDS_TAG_ID = "63175251-2c31-46e6-b107-cbe0140983d8";
export const WELL_KNOWN_BRANDS_COLLECTION_ID = "3ec5145d-19dd-45d0-b0cf-8ffed5114e81";

export interface CustomerFilters {
  search?: string;
  viewSystem?: string;
  statusFilter?: string;
  /** Account status: Active | Inactive | Blacklist | all */
  recordStatus?: string;
  industryTagId?: string;
  createdBy?: string;
  /** Filter by「知名品牌」tag: all | yes | no */
  wellKnownBrand?: "all" | "yes" | "no";
  sortField?: string;
  sortDir?: "asc" | "desc";
}

export type CustomerListFilters = Pick<
  CustomerFilters,
  "search" | "viewSystem" | "statusFilter" | "recordStatus" | "industryTagId" | "createdBy" | "wellKnownBrand"
>;

function applyCustomerViewSystemFilter<T extends { or: Function; eq: Function; in: Function }>(
  query: T,
  viewSystem?: string
): T {
  if (!viewSystem || viewSystem === "all") return query;
  // Canonical values: BWA | BWF | Both (legacy PMS/BWF2 accepted for transitional reads)
  if (viewSystem === "BWA" || viewSystem === "PMS") {
    return query.in("view_system", ["BWA", "Both", "PMS", "PMS,BWF2", "BWF2,PMS"]) as T;
  }
  if (viewSystem === "BWF" || viewSystem === "BWF2") {
    return query.in("view_system", ["BWF", "Both", "BWF2", "PMS,BWF2", "BWF2,PMS"]) as T;
  }
  if (viewSystem === "Both") {
    return query.in("view_system", ["Both", "PMS,BWF2", "BWF2,PMS"]) as T;
  }
  return query.eq("view_system", viewSystem) as T;
}

async function resolveCustomerIdsForIndustryTag(industryTagId?: string): Promise<string[] | null> {
  if (!industryTagId || industryTagId === "all") return null;
  const { data: jRows } = await supabase
    .from("customer_tags")
    .select("customer_uuid")
    .eq("tag_uuid", industryTagId)
    .eq("collection_uuid", CUSTOMER_INDUSTRY_COLLECTION_ID);
  return (jRows ?? []).map((r: any) => r.customer_uuid).filter(Boolean);
}

async function fetchWellKnownBrandCustomerIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("customer_tags")
    .select("customer_uuid")
    .eq("tag_uuid", WELL_KNOWN_BRANDS_TAG_ID);
  if (error) {
    logError("fetchWellKnownBrandCustomerIds", error);
    return [];
  }
  return (data ?? []).map((r: any) => r.customer_uuid).filter(Boolean);
}

/** Resolve include/exclude customer id constraints from industry + 知名品牌 filters. */
async function resolveCustomerIdConstraints(
  filters: CustomerListFilters
): Promise<{ includeIds: string[] | null; excludeIds: string[] | null; empty: boolean }> {
  const industryIds = await resolveCustomerIdsForIndustryTag(filters.industryTagId);
  if (industryIds && industryIds.length === 0) {
    return { includeIds: null, excludeIds: null, empty: true };
  }

  const wellKnown = filters.wellKnownBrand ?? "all";
  if (wellKnown === "all") {
    return { includeIds: industryIds, excludeIds: null, empty: false };
  }

  const wellKnownIds = await fetchWellKnownBrandCustomerIds();
  const wellKnownSet = new Set(wellKnownIds);

  if (wellKnown === "yes") {
    if (wellKnownIds.length === 0) {
      return { includeIds: null, excludeIds: null, empty: true };
    }
    if (industryIds) {
      const intersected = industryIds.filter((id) => wellKnownSet.has(id));
      return {
        includeIds: intersected,
        excludeIds: null,
        empty: intersected.length === 0,
      };
    }
    return { includeIds: wellKnownIds, excludeIds: null, empty: false };
  }

  // wellKnown === "no"
  if (industryIds) {
    const filtered = industryIds.filter((id) => !wellKnownSet.has(id));
    return { includeIds: filtered, excludeIds: null, empty: filtered.length === 0 };
  }
  return {
    includeIds: null,
    excludeIds: wellKnownIds.length > 0 ? wellKnownIds : null,
    empty: false,
  };
}

function applyCustomerListFilters<
  T extends { or: Function; eq: Function; ilike: Function; in: Function; not: Function },
>(
  query: T,
  filters: CustomerListFilters,
  customerIdsInclude?: string[] | null,
  options?: { skipViewSystem?: boolean; customerIdsExclude?: string[] | null }
): T {
  let q = query;
  if (filters.search?.trim()) {
    const searchQ = `%${filters.search.trim()}%`;
    q = q.or(
      `customer_name.ilike.${searchQ},display_name.ilike.${searchQ},company_name.ilike.${searchQ},brand_name_cn.ilike.${searchQ},brand_name_en.ilike.${searchQ},email.ilike.${searchQ},phone_display.ilike.${searchQ},address.ilike.${searchQ},real_created_by_name.ilike.${searchQ}`
    ) as T;
  }
  if (!options?.skipViewSystem) {
    q = applyCustomerViewSystemFilter(q, filters.viewSystem);
  }
  if (filters.statusFilter && filters.statusFilter !== "all") {
    q = q.eq("status_filter_value", filters.statusFilter) as T;
  }
  if (filters.recordStatus && filters.recordStatus !== "all") {
    q = q.eq("status", filters.recordStatus) as T;
  }
  if (filters.createdBy && filters.createdBy !== "all") {
    q = q.eq("real_created_by_name", filters.createdBy) as T;
  }
  if (customerIdsInclude) {
    q = q.in("id", customerIdsInclude) as T;
  }
  if (options?.customerIdsExclude && options.customerIdsExclude.length > 0) {
    q = q.not("id", "in", `(${options.customerIdsExclude.join(",")})`) as T;
  }
  return q;
}

export async function fetchCustomersPaginated(
  page: number = 1,
  pageSize: number = 20,
  filters: CustomerFilters = {}
): Promise<PaginatedResult<CustomerRow>> {
  return safeQuery(async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const listFilters: CustomerListFilters = {
      search: filters.search,
      viewSystem: filters.viewSystem,
      statusFilter: filters.statusFilter,
      recordStatus: filters.recordStatus,
      industryTagId: filters.industryTagId,
      createdBy: filters.createdBy,
      wellKnownBrand: filters.wellKnownBrand,
    };

    const idConstraints = await resolveCustomerIdConstraints(listFilters);
    if (idConstraints.empty) {
      return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }

    const selectFields =
      "id, bubble_id, customer_name, display_name, company_name, brand_name_cn, brand_name_en, branding_icon, email, phone_display, phone_number_a, address, tags, view_system, status, status_filter_value, bwa_income, bwa_profit, bwf_income, bwf_profit, bwa_receivable, bwf_receivable, bwa_project_number, bwf_project_number, bwa_pitching_number, bwf_pitching_no, created_date, enquiry_create_date, modified_date, remark, real_created_by_name";

    let query = applyCustomerListFilters(
      supabase.from("customers").select(selectFields, { count: "exact" }),
      listFilters,
      idConstraints.includeIds,
      { customerIdsExclude: idConstraints.excludeIds }
    );

    // Sorting
    const sortField = filters.sortField || "created_date";
    const sortDir = filters.sortDir || "desc";
    const ascending = sortDir === "asc";

    const sortFieldMap: Record<string, string> = {
      created_date: "created_date",
      view_system: "view_system",
      display_name: "display_name",
      customer_name: "customer_name",
      company_name: "company_name",
      bwa_income: "bwa_income",
      bwf_income: "bwf_income",
      bwa_project_number: "bwa_project_number",
      status_filter_value: "status_filter_value",
      bwa_signed_income: "bwa_receivable",
      bwa_project_profit: "bwa_profit",
      bwa_receivable: "bwa_receivable",
      bwf_receivable: "bwf_receivable",
      bwf_profit: "bwf_profit",
    };

    const dbSortField = sortFieldMap[sortField] || "created_date";
    query = query.order(dbSortField, { ascending, nullsFirst: false });

    // Pagination
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      logError("fetchCustomersPaginated", error);
      return { data: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }

    const allData = data ?? [];
    const totalCount = count ?? 0;

    // Resolve industry tags + BWA project aggregation only for this page's records
    const pageIds = allData.map((c: any) => c.id);
    const pageBubbleIds = allData.map((c: any) => c.bubble_id).filter(Boolean);
    const allLookupIds = [...pageIds, ...pageBubbleIds];

    const INDUSTRY_COLLECTION_ID = CUSTOMER_INDUSTRY_COLLECTION_ID;

    const [
      { data: industryTagJunction },
      { data: industryTagLookup },
      { data: wellKnownTagJunction },
      { data: bwaProjects },
    ] = await Promise.all([
      supabase
        .from("customer_tags")
        .select("customer_uuid, tag_uuid")
        .eq("collection_uuid", INDUSTRY_COLLECTION_ID)
        .in("customer_uuid", pageIds),
      supabase
        .from("nos_customer_tags")
        .select("id, display")
        .eq("collection_id", INDUSTRY_COLLECTION_ID),
      pageIds.length > 0
        ? supabase
            .from("customer_tags")
            .select("customer_uuid")
            .eq("tag_uuid", WELL_KNOWN_BRANDS_TAG_ID)
            .in("customer_uuid", pageIds)
        : Promise.resolve({ data: [] as { customer_uuid: string }[] }),
      supabase
        .from("bwa_projects")
        .select("customer, estimated_income, estimated_profit")
        .in("customer", allLookupIds),
    ]);

    // Build industry tag name lookup
    const industryTagNameMap = new Map<string, string>();
    (industryTagLookup ?? []).forEach((t: any) => {
      if (t.id) industryTagNameMap.set(t.id, t.display ?? "");
    });

    // Build customer → industry tag names map
    const customerIndustryMap = new Map<string, string[]>();
    (industryTagJunction ?? []).forEach((row: any) => {
      if (!row.customer_uuid || !row.tag_uuid) return;
      const tagName = industryTagNameMap.get(row.tag_uuid);
      if (!tagName) return;
      if (!customerIndustryMap.has(row.customer_uuid)) {
        customerIndustryMap.set(row.customer_uuid, []);
      }
      customerIndustryMap.get(row.customer_uuid)!.push(tagName);
    });

    const wellKnownCustomerIds = new Set(
      (wellKnownTagJunction ?? []).map((r: any) => r.customer_uuid).filter(Boolean)
    );

    // Build BWA project aggregation for this page's customers
    const bwaAggMap = new Map<string, { income: number; profit: number }>();
    (bwaProjects ?? []).forEach((p: any) => {
      if (!p.customer) return;
      const custId = String(p.customer).trim();
      if (!bwaAggMap.has(custId)) bwaAggMap.set(custId, { income: 0, profit: 0 });
      const agg = bwaAggMap.get(custId)!;
      agg.income += (p.estimated_income ?? 0);
      agg.profit += (p.estimated_profit ?? 0);
    });

    const rows: CustomerRow[] = allData.map((c: any) => {
      const bwaById = bwaAggMap.get(c.id);
      const bwaByBubble = c.bubble_id ? bwaAggMap.get(c.bubble_id) : null;
      const bwaAgg = bwaById || bwaByBubble;
      return {
        id: c.id,
        bubble_id: c.bubble_id,
        customer_name: c.customer_name,
        display_name: c.display_name,
        company_name: c.company_name,
        brand_name_cn: c.brand_name_cn,
        brand_name_en: c.brand_name_en,
        branding_icon: c.branding_icon,
        email: c.email,
        phone_display: c.phone_display || c.phone_number_a,
        phone_number_a: c.phone_number_a,
        address: c.address,
        tags: null, // Legacy tag resolution skipped for performance
        industry_tags: customerIndustryMap.get(c.id) ?? null,
        is_well_known_brand: wellKnownCustomerIds.has(c.id),
        view_system: c.view_system,
        status: c.status ?? "Active",
        status_filter_value: c.status_filter_value,
        bwa_income: c.bwa_income,
        bwa_profit: c.bwa_profit,
        bwf_income: c.bwf_income,
        bwf_profit: c.bwf_profit,
        bwa_receivable: c.bwa_receivable,
        bwf_receivable: c.bwf_receivable,
        bwa_project_number: c.bwa_project_number,
        bwf_project_number: c.bwf_project_number,
        bwa_pitching_number: c.bwa_pitching_number,
        bwf_pitching_no: c.bwf_pitching_no,
        created_date: c.created_date,
        modified_date: c.modified_date,
        remark: c.remark,
        real_created_by_name: c.real_created_by_name,
        bwa_signed_income: bwaAgg?.income ?? null,
        bwa_project_profit: bwaAgg?.profit ?? null,
      };
    });

    return {
      data: rows,
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  }, { data: [], totalCount: 0, page, pageSize, totalPages: 0 }, "fetchCustomersPaginated");
}

// ─── CUSTOMER KPI STATS (lightweight) ─────────────────────
export interface CustomerKPIStats {
  totalCustomers: number;
  bwaCustomers: number;
  bwfCustomers: number;
  totalBwaIncome: number;
}

export async function fetchCustomerKPIStats(
  filters: CustomerListFilters = {}
): Promise<CustomerKPIStats> {
  return safeQuery(async () => {
    const idConstraints = await resolveCustomerIdConstraints(filters);
    if (idConstraints.empty) {
      return { totalCustomers: 0, bwaCustomers: 0, bwfCustomers: 0, totalBwaIncome: 0 };
    }

    const viewSystem = filters.viewSystem ?? "all";
    const baseFilters: CustomerListFilters = {
      search: filters.search,
      statusFilter: filters.statusFilter,
      recordStatus: filters.recordStatus,
      industryTagId: filters.industryTagId,
      createdBy: filters.createdBy,
      wellKnownBrand: filters.wellKnownBrand,
    };
    const idOpts = { customerIdsExclude: idConstraints.excludeIds };

    const [
      { count: totalCount },
      { count: bwaCount },
      { count: bwfCount },
      { data: incomeData },
    ] = await Promise.all([
      applyCustomerListFilters(
        supabase.from("customers").select("id", { count: "exact", head: true }),
        { ...baseFilters, viewSystem },
        idConstraints.includeIds,
        idOpts
      ),
      viewSystem === "BWF" || viewSystem === "BWF2"
        ? Promise.resolve({ count: 0 })
        : applyCustomerListFilters(
            supabase.from("customers").select("id", { count: "exact", head: true }),
            { ...baseFilters, viewSystem: "BWA" },
            idConstraints.includeIds,
            idOpts
          ),
      viewSystem === "BWA" || viewSystem === "PMS"
        ? Promise.resolve({ count: 0 })
        : applyCustomerListFilters(
            supabase.from("customers").select("id", { count: "exact", head: true }),
            { ...baseFilters, viewSystem: "BWF" },
            idConstraints.includeIds,
            idOpts
          ),
      applyCustomerListFilters(
        supabase.from("customers").select("bwa_income"),
        { ...baseFilters, viewSystem },
        idConstraints.includeIds,
        idOpts
      ),
    ]);

    const totalBwaIncome = (incomeData ?? []).reduce((sum: number, c: any) => sum + (c.bwa_income || 0), 0);
    const isBwfOnly = viewSystem === "BWF" || viewSystem === "BWF2";
    const isBwaOnly = viewSystem === "BWA" || viewSystem === "PMS";

    return {
      totalCustomers: totalCount ?? 0,
      bwaCustomers: isBwfOnly ? 0 : isBwaOnly ? (totalCount ?? 0) : (bwaCount ?? 0),
      bwfCustomers: isBwaOnly ? 0 : isBwfOnly ? (totalCount ?? 0) : (bwfCount ?? 0),
      totalBwaIncome,
    };
  }, { totalCustomers: 0, bwaCustomers: 0, bwfCustomers: 0, totalBwaIncome: 0 }, "fetchCustomerKPIStats");
}

// ─── CUSTOMER FILTER OPTIONS ──────────────────────────────
export interface CustomerFilterOptions {
  statuses: string[];
  industryTags: { id: string; name: string }[];
  creators: string[];
}

export async function fetchCustomerFilterOptions(): Promise<CustomerFilterOptions> {
  return safeQuery(async () => {
    const [{ data: creators }, { data: industryTags }] = await Promise.all([
      supabase
        .from("customers")
        .select("real_created_by_name")
        .not("real_created_by_name", "is", null),
      supabase
        .from("nos_customer_tags")
        .select("id, display")
        .eq("collection_id", CUSTOMER_INDUSTRY_COLLECTION_ID)
        .order("display"),
    ]);

    const uniqueCreators: string[] = [
      ...new Set<string>(
        (creators ?? [])
          .map((r: any) => String(r.real_created_by_name ?? "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "zh-HK"));

    const industryTagOptions = (industryTags ?? []).map((t: any) => ({
      id: t.id,
      name: t.display || t.id,
    }));

    return {
      statuses: [...CUSTOMER_STATUS_FILTER_VALUES],
      industryTags: industryTagOptions,
      creators: uniqueCreators,
    };
  }, { statuses: [], industryTags: [], creators: [] }, "fetchCustomerFilterOptions");
}

/** @deprecated Use fetchCustomerFilterOptions instead */
export async function fetchCustomerSystemOptions(): Promise<string[]> {
  return safeQuery(async () => {
    const { data } = await supabase
      .from("customers")
      .select("view_system")
      .not("view_system", "is", null);

    const systems = new Set<string>();
    (data ?? []).forEach((c: any) => {
      if (c.view_system) systems.add(c.view_system);
    });
    return Array.from(systems).sort();
  }, [], "fetchCustomerSystemOptions");
}

// ─── CUSTOMER DETAIL ─────────────────────────────────────

export interface CustomerDetailData {
  id: string;
  customer_name: string | null;
  display_name: string | null;
  company_name: string | null;
  brand_name_cn: string | null;
  brand_name_en: string | null;
  branding_icon: string | null;
  email: string | null;
  phone_display: string | null;
  phone_number_a: string | null;
  phone_number_b: string | null;
  address: string | null;
  tags: string | null;
  view_system: string | null;
  status: string | null;
  status_filter_value: string | null;
  remark: string | null;
  created_date: string | null;
  modified_date: string | null;
  // Financial summary
  bwa_income: number | null;
  bwa_profit: number | null;
  bwa_project_number: number | null;
  bwa_pitching_number: number | null;
  bwa_receivable: number | null;
  bwf_income: number | null;
  bwf_profit: number | null;
  bwf_project_number: number | null;
  bwf_pitching_no: number | null;
  bwf_receivable: number | null;
  // Created by
  real_created_by_name: string | null;
}

export interface CustomerProjectRow {
  id: string;
  project_code: string | null;
  project_name: string | null;
  status: string | null;
  estimated_income: number | null;
  estimated_expense: number | null;
  estimated_profit: number | null;
  signed_date: string | null;
  start_date: string | null;
  handover_date: string | null;
  site_address: string | null;
  size: string | null;
  actual_size: string | null;
  pm_name: string | null;
  type: "BWA" | "BWF";
  income_total: number;       // sum of incomes.income_amount for this project
  payment_total: number;      // sum of incomes.payment_amount for this project
}

export interface CustomerPitchingRow {
  id: string;
  pitching_code: string | null;
  /** BWF uses pitching_name; BWA uses description. Both are mapped into description for display. */
  pitching_name?: string | null;
  description: string | null;
  status?: string | null;
  pitching_stages: string | null;
  estimated_income: number | null;
  estimated_expense: number | null;
  enquiry_date: string | null;
  site_address: string | null;
  size: string | null;
  actual_size: string | null;
  pm_name: string | null;
  type: "BWA" | "BWF";
}

export async function fetchCustomerDetail(
  customerId: string
): Promise<{
  customer: CustomerDetailData | null;
  projects: CustomerProjectRow[];
  pitchings: CustomerPitchingRow[];
  bwaProjects: CustomerProjectRow[];
  bwfProjects: CustomerProjectRow[];
  bwaPitchings: CustomerPitchingRow[];
  bwfPitchings: CustomerPitchingRow[];
}> {
  return safeQuery(
    async () => {
      // 1. Fetch customer detail + resolve customer tags
      const [{ data: customer, error: custErr }, { data: custTagRows }] = await Promise.all([
        supabase
          .from("customers")
          .select(
            "id, customer_name, display_name, company_name, brand_name_cn, brand_name_en, branding_icon, email, phone_display, phone_number_a, phone_number_b, address, tags, view_system, status, status_filter_value, remark, created_date, modified_date, bwa_income, bwa_profit, bwa_project_number, bwa_pitching_number, bwa_receivable, bwf_income, bwf_profit, bwf_project_number, bwf_pitching_no, bwf_receivable, real_created_by_name"
          )
          .eq("id", customerId)
          .single(),
        supabase.from("nos_customer_tags").select("bubble_id, display"),
      ]);

      if (custErr) {
        logError("fetchCustomerDetail/customer", custErr);
        return { customer: null, projects: [], pitchings: [], bwaProjects: [], bwfProjects: [], bwaPitchings: [], bwfPitchings: [] };
      }

      // Resolve customer tags (Bubble IDs → display names)
      if (customer && customer.tags) {
        const custTagMap = new Map<string, string>();
        (custTagRows ?? []).forEach((t: any) => {
          if (t.bubble_id) custTagMap.set(t.bubble_id, t.display ?? "");
        });
        const ids = String(customer.tags).split(",").map((x: string) => x.trim()).filter(Boolean);
        const names = ids
          .map((id: string) => custTagMap.get(id))
          .filter((name): name is string => !!name);
        (customer as any).tags = names.length > 0 ? names.join(", ") : null;
      }

      // 2. Fetch BWA projects for this customer
      const { data: bwaProjects, error: bwaProjErr } = await supabase
        .from("bwa_projects")
        .select(
          "id, project_code, project_name, status, estimated_income, estimated_expense, estimated_profit, signed_date, start_date, handover_date, site_address, size, actual_size, pm:staff!fk_bwa_projects_main_pm_id(name)"
        )
        .eq("customer_id", customerId)
        .order("created_date", { ascending: false });

      if (bwaProjErr) logError("fetchCustomerDetail/bwaProjects", bwaProjErr);

      // 3. Fetch BWF projects for this customer
      const { data: bwfProjects, error: bwfProjErr } = await supabase
        .from("bwf_projects")
        .select(
          "id, project_code, project_name, status, estimated_income, estimated_expense, estimated_profit, signed_date, start_date, handover_date, site_address, size, pm:staff!fk_bwf_projects_main_pm_id(name)"
        )
        .eq("customer_id", customerId)
        .order("created_date", { ascending: false });

      if (bwfProjErr) logError("fetchCustomerDetail/bwfProjects", bwfProjErr);

      // 4. Fetch BWA pitchings for this customer
      const { data: bwaPitchings, error: bwaPitchErr } = await supabase
        .from("bwa_pitchings")
        .select(
          "id, pitching_code, description, pitching_stages, estimated_income, estimated_expense, enquiry_date, site_address, size, actual_size, pm:staff!fk_bwa_pitchings_main_pm_id(name)"
        )
        .eq("customer_id", customerId)
        .order("created_date", { ascending: false });

      if (bwaPitchErr) logError("fetchCustomerDetail/bwaPitchings", bwaPitchErr);

      // 5. Fetch BWF pitchings for this customer
      // bwf_pitchings uses pitching_name (not description — that column does not exist)
      const { data: bwfPitchings, error: bwfPitchErr } = await supabase
        .from("bwf_pitchings")
        .select(
          "id, pitching_code, pitching_name, pitching_stages, estimated_income, estimated_expense, enquiry_date, site_address, size, pm:staff!fk_bwf_pitchings_main_pm_id(name)"
        )
        .eq("customer_id", customerId)
        .order("created_date", { ascending: false });

      if (bwfPitchErr) logError("fetchCustomerDetail/bwfPitchings", bwfPitchErr);

      // 6. Fetch income sums for BWA projects (by project_id)
      const bwaProjectIds = (bwaProjects ?? []).map((p: any) => p.id).filter(Boolean);
      const bwaIncomeSums: Record<string, { income_total: number; payment_total: number }> = {};
      if (bwaProjectIds.length > 0) {
        const { data: bwaIncomes } = await supabase
          .from("incomes")
          .select("project_id, income_amount, payment_amount")
          .in("project_id", bwaProjectIds);
        for (const row of (bwaIncomes ?? [])) {
          if (!row.project_id) continue;
          if (!bwaIncomeSums[row.project_id]) bwaIncomeSums[row.project_id] = { income_total: 0, payment_total: 0 };
          bwaIncomeSums[row.project_id].income_total += (row.income_amount || 0);
          bwaIncomeSums[row.project_id].payment_total += (row.payment_amount || 0);
        }
      }

      // 7. Fetch income sums for BWF projects (by bwf_project_id)
      const bwfProjectIds = (bwfProjects ?? []).map((p: any) => p.id).filter(Boolean);
      const bwfIncomeSums: Record<string, { income_total: number; payment_total: number }> = {};
      if (bwfProjectIds.length > 0) {
        const { data: bwfIncomes } = await supabase
          .from("incomes")
          .select("bwf_project_id, income_amount, payment_amount")
          .in("bwf_project_id", bwfProjectIds);
        for (const row of (bwfIncomes ?? [])) {
          if (!row.bwf_project_id) continue;
          if (!bwfIncomeSums[row.bwf_project_id]) bwfIncomeSums[row.bwf_project_id] = { income_total: 0, payment_total: 0 };
          bwfIncomeSums[row.bwf_project_id].income_total += (row.income_amount || 0);
          bwfIncomeSums[row.bwf_project_id].payment_total += (row.payment_amount || 0);
        }
      }

      // Separate arrays for each tab
      const bwaProjectsArr: CustomerProjectRow[] = (bwaProjects ?? []).map((p: any) => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
        estimated_income: p.estimated_income,
        estimated_expense: p.estimated_expense,
        estimated_profit: p.estimated_profit,
        signed_date: p.signed_date,
        start_date: p.start_date,
        handover_date: p.handover_date,
        site_address: p.site_address,
        size: p.size,
        actual_size: p.actual_size ?? null,
        pm_name: p.pm?.name ?? null,
        type: "BWA" as const,
        income_total: bwaIncomeSums[p.id]?.income_total ?? 0,
        payment_total: bwaIncomeSums[p.id]?.payment_total ?? 0,
      }));

      const bwfProjectsArr: CustomerProjectRow[] = (bwfProjects ?? []).map((p: any) => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        status: p.status,
        estimated_income: p.estimated_income,
        estimated_expense: p.estimated_expense,
        estimated_profit: p.estimated_profit,
        signed_date: p.signed_date,
        start_date: p.start_date,
        handover_date: p.handover_date,
        site_address: p.site_address,
        size: p.size,
        actual_size: null,
        pm_name: p.pm?.name ?? null,
        type: "BWF" as const,
        income_total: bwfIncomeSums[p.id]?.income_total ?? 0,
        payment_total: bwfIncomeSums[p.id]?.payment_total ?? 0,
      }));

      const bwaPitchingsArr: CustomerPitchingRow[] = (bwaPitchings ?? []).map((p: any) => ({
        id: p.id,
        pitching_code: p.pitching_code,
        pitching_name: null,
        description: p.description,
        pitching_stages: p.pitching_stages,
        estimated_income: p.estimated_income,
        estimated_expense: p.estimated_expense,
        enquiry_date: p.enquiry_date,
        site_address: p.site_address,
        size: p.size,
        actual_size: p.actual_size ?? null,
        pm_name: p.pm?.name ?? null,
        type: "BWA" as const,
      }));

      const bwfPitchingsArr: CustomerPitchingRow[] = (bwfPitchings ?? []).map((p: any) => ({
        id: p.id,
        pitching_code: p.pitching_code,
        pitching_name: p.pitching_name ?? null,
        description: p.pitching_name ?? null,
        pitching_stages: p.pitching_stages,
        estimated_income: p.estimated_income,
        estimated_expense: p.estimated_expense,
        enquiry_date: p.enquiry_date,
        site_address: p.site_address,
        size: p.size,
        actual_size: null,
        pm_name: p.pm?.name ?? null,
        type: "BWF" as const,
      }));

      // Merged arrays (backward compat)
      const projects: CustomerProjectRow[] = [...bwaProjectsArr, ...bwfProjectsArr];
      const pitchings: CustomerPitchingRow[] = [...bwaPitchingsArr, ...bwfPitchingsArr];

      return {
        customer: customer as CustomerDetailData,
        projects,
        pitchings,
        bwaProjects: bwaProjectsArr,
        bwfProjects: bwfProjectsArr,
        bwaPitchings: bwaPitchingsArr,
        bwfPitchings: bwfPitchingsArr,
      };
    },
    { customer: null, projects: [], pitchings: [], bwaProjects: [], bwfProjects: [], bwaPitchings: [], bwfPitchings: [] },
    "fetchCustomerDetail"
  );
}

// ─── CUSTOMER TAGS (GROUPED BY COLLECTION) ──────────────

export interface TagCollection {
  id: string;
  display: string;
  isSingleSelect: boolean;  // true for Industry Tags
  tags: { id: string; display: string }[];
}

export interface CustomerTagEntry {
  id: string;
  tag_uuid: string;
  collection_uuid: string;
}

const INDUSTRY_TAG_COLLECTION_ID = "4f5de598-2dcb-45a6-a106-9d933e9a8007";

/**
 * Fetches all tag collections with their tags,
 * plus the customer's currently assigned tags.
 */
export async function fetchCustomerTagsGrouped(
  customerId: string
): Promise<{
  collections: TagCollection[];
  customerTags: CustomerTagEntry[];
}> {
  return safeQuery(
    async () => {
      const [
        { data: collections, error: colErr },
        { data: allTags, error: tagErr },
        { data: customerTags, error: ctErr },
      ] = await Promise.all([
        supabase
          .from("nos_customer_tags_collection")
          .select("id, display")
          .order("display"),
        supabase
          .from("nos_customer_tags")
          .select("id, display, collection_id")
          .order("display"),
        supabase
          .from("customer_tags")
          .select("id, tag_uuid, collection_uuid")
          .eq("customer_uuid", customerId),
      ]);

      if (colErr) logError("fetchCustomerTagsGrouped/collections", colErr);
      if (tagErr) logError("fetchCustomerTagsGrouped/tags", tagErr);
      if (ctErr) logError("fetchCustomerTagsGrouped/customerTags", ctErr);

      const tagsByCollection = new Map<string, { id: string; display: string }[]>();
      (allTags ?? []).forEach((t: any) => {
        const cid = t.collection_id;
        if (!cid) return;
        if (!tagsByCollection.has(cid)) tagsByCollection.set(cid, []);
        tagsByCollection.get(cid)!.push({ id: t.id, display: t.display ?? "" });
      });

      const result: TagCollection[] = (collections ?? []).map((c: any) => ({
        id: c.id,
        display: c.display ?? "",
        isSingleSelect: c.id === INDUSTRY_TAG_COLLECTION_ID,
        tags: tagsByCollection.get(c.id) ?? [],
      }));

      return {
        collections: result,
        customerTags: (customerTags ?? []) as CustomerTagEntry[],
      };
    },
    { collections: [], customerTags: [] },
    "fetchCustomerTagsGrouped"
  );
}

/**
 * Fetches all tag collections with their tags (without customer association).
 * Used in the create/edit dialog where we need all options.
 */
export async function fetchTagCollectionsAll(): Promise<TagCollection[]> {
  return safeQuery(
    async () => {
      const [
        { data: collections, error: colErr },
        { data: allTags, error: tagErr },
      ] = await Promise.all([
        supabase
          .from("nos_customer_tags_collection")
          .select("id, display")
          .order("display"),
        supabase
          .from("nos_customer_tags")
          .select("id, display, collection_id")
          .order("display"),
      ]);

      if (colErr) logError("fetchTagCollectionsAll/collections", colErr);
      if (tagErr) logError("fetchTagCollectionsAll/tags", tagErr);

      const tagsByCollection = new Map<string, { id: string; display: string }[]>();
      (allTags ?? []).forEach((t: any) => {
        const cid = t.collection_id;
        if (!cid) return;
        if (!tagsByCollection.has(cid)) tagsByCollection.set(cid, []);
        tagsByCollection.get(cid)!.push({ id: t.id, display: t.display ?? "" });
      });

      return (collections ?? []).map((c: any) => ({
        id: c.id,
        display: c.display ?? "",
        isSingleSelect: c.id === INDUSTRY_TAG_COLLECTION_ID,
        tags: tagsByCollection.get(c.id) ?? [],
      }));
    },
    [],
    "fetchTagCollectionsAll"
  );
}

/**
 * Saves customer tags. Handles add/remove diffs.
 * For single-select collections, removes old tag before adding new.
 */
export async function saveCustomerTags(
  customerId: string,
  toAdd: { tag_uuid: string; collection_uuid: string }[],
  toRemove: string[] // IDs of customer_tags rows to delete
): Promise<{ success: boolean; error?: string }> {
  try {
    // Remove deselected tags
    if (toRemove.length > 0) {
      const { error: delErr } = await supabase
        .from("customer_tags")
        .delete()
        .in("id", toRemove);
      if (delErr) {
        logError("saveCustomerTags/delete", delErr);
        return { success: false, error: delErr.message };
      }
    }

    // Add new tags
    if (toAdd.length > 0) {
      const rows = toAdd.map((t) => ({
        customer_uuid: customerId,
        customer_id: customerId,
        tag_uuid: t.tag_uuid,
        tag_id: t.tag_uuid,
        collection_uuid: t.collection_uuid,
      }));
      const { error: insErr } = await supabase
        .from("customer_tags")
        .insert(rows);
      if (insErr) {
        logError("saveCustomerTags/insert", insErr);
        return { success: false, error: insErr.message };
      }
    }

    return { success: true };
  } catch (err: any) {
    logError("saveCustomerTags", err);
    return { success: false, error: err?.message ?? "Unknown error" };
  }
}

/** Quick add/remove the「知名品牌」tag for a customer (list checkbox). */
export async function setCustomerWellKnownBrandTag(
  customerId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: existing, error: findErr } = await supabase
      .from("customer_tags")
      .select("id")
      .eq("customer_uuid", customerId)
      .eq("tag_uuid", WELL_KNOWN_BRANDS_TAG_ID)
      .maybeSingle();
    if (findErr) {
      logError("setCustomerWellKnownBrandTag/find", findErr);
      return { success: false, error: findErr.message };
    }

    if (enabled) {
      if (existing?.id) return { success: true };
      return saveCustomerTags(
        customerId,
        [
          {
            tag_uuid: WELL_KNOWN_BRANDS_TAG_ID,
            collection_uuid: WELL_KNOWN_BRANDS_COLLECTION_ID,
          },
        ],
        []
      );
    }

    if (!existing?.id) return { success: true };
    return saveCustomerTags(customerId, [], [existing.id]);
  } catch (err: any) {
    logError("setCustomerWellKnownBrandTag", err);
    return { success: false, error: err?.message ?? "Unknown error" };
  }
}

// ─── CUSTOMER CRUD ─────────────────────────────────────

export async function createCustomer(
  data: {
    customer_name?: string;
    display_name?: string;
    company_name?: string;
    brand_name_cn?: string;
    brand_name_en?: string;
    email?: string;
    phone_display?: string;
    phone_number_a?: string;
    phone_number_b?: string;
    address?: string;
    tags?: string;
    view_system?: string;
    remark?: string;
    asana?: string;
    enquiry_create_date?: string;
    status?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await adminFetch({
      action: "create",
      table: "customers",
      data: {
        customer_name: data.customer_name || null,
        display_name: data.display_name || null,
        company_name: data.company_name || null,
        brand_name_cn: data.brand_name_cn || null,
        brand_name_en: data.brand_name_en || null,
        email: data.email || null,
        phone_display: data.phone_display || null,
        phone_number_a: data.phone_number_a || null,
        phone_number_b: data.phone_number_b || null,
        address: data.address || null,
        tags: data.tags || null,
        view_system: data.view_system || null,
        remark: data.remark || null,
        asana: data.asana || null,
        enquiry_create_date: data.enquiry_create_date ? new Date(data.enquiry_create_date).toISOString() : new Date().toISOString(),
        status: data.status || "Active",
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logError("createCustomer", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/**
 * Quick-create a customer from the pitching dialog with minimal fields.
 * Returns the new customer ID and display label on success.
 */
export async function quickCreateCustomer(
  data: {
    display_name: string;
    customer_name: string;
    phone_display?: string;
    phone_number_a?: string;
    email?: string;
    asana_link?: string;
    enquiry_date?: string;
    remark?: string;
  }
): Promise<{ success: boolean; id?: string; label?: string; error?: string }> {
  try {
    const result = await adminFetch({
      action: "create",
      table: "customers",
      data: {
        display_name: data.display_name || null,
        customer_name: data.customer_name || null,
        phone_display: data.phone_display || null,
        phone_number_a: data.phone_number_a || null,
        email: data.email || null,
        asana: data.asana_link || null,
        remark: data.remark || null,
        view_system: "BWA",
        status: "Active",
        enquiry_create_date: data.enquiry_date ? new Date(data.enquiry_date).toISOString() : new Date().toISOString(),
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      },
    });
    if (result.success && result.id) {
      return { success: true, id: result.id, label: data.display_name || data.customer_name };
    }
    return result;
  } catch (err: any) {
    logError("quickCreateCustomer", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function uploadCustomerLogo(
  customerId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const fileName = buildStorageObjectKey(customerId, file.name);
    const { error: uploadError } = await supabase.storage
      .from("customer-logos")
      .upload(fileName, file, { upsert: true });
    if (uploadError) return { success: false, error: uploadError.message };
    const { data: urlData } = supabase.storage.from("customer-logos").getPublicUrl(fileName);
    return { success: true, url: urlData.publicUrl };
  } catch (err: any) {
    logError("uploadCustomerLogo", err);
    return { success: false, error: err?.message || "Upload failed" };
  }
}

export async function updateCustomer(
  id: string,
  updates: {
    customer_name?: string;
    display_name?: string;
    company_name?: string;
    brand_name_cn?: string;
    brand_name_en?: string;
    branding_icon?: string;
    email?: string;
    phone_display?: string;
    phone_number_a?: string;
    phone_number_b?: string;
    address?: string;
    tags?: string;
    view_system?: string;
    remark?: string;
    asana?: string;
    enquiry_create_date?: string;
    status?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = { ...updates, modified_date: new Date().toISOString() };
    if (payload.enquiry_create_date) {
      payload.enquiry_create_date = new Date(payload.enquiry_create_date).toISOString();
    }
    return await adminFetch({
      action: "update",
      table: "customers",
      id,
      updates: payload,
    });
  } catch (err: any) {
    logError("updateCustomer", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function deleteCustomer(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({ action: "delete", table: "customers", id });
  } catch (err: any) {
    logError("deleteCustomer", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function searchCustomerOptions(searchTerm: string = "", limit: number = 30): Promise<LinkOption[]> {
  return safeQuery(async () => {
    let query = supabase
      .from("customers")
      .select("id, customer_name, display_name, company_name, brand_name_cn")
      .eq("status", "Active")
      .order("customer_name", { ascending: true })
      .limit(limit);

    if (searchTerm) {
      const q = `%${searchTerm}%`;
      query = query.or(
        `customer_name.ilike.${q},display_name.ilike.${q},company_name.ilike.${q},brand_name_cn.ilike.${q}`
      );
    }

    const { data, error } = await query;
    if (error) logError("searchCustomerOptions", error);

    return (data ?? []).map((c: any) => ({
      id: c.id,
      label: c.display_name || c.customer_name || c.company_name || "未命名",
      sublabel: [c.company_name, c.brand_name_cn].filter(Boolean).join(" · "),
    }));
  }, [], "searchCustomerOptions");
}

export async function fetchCustomerDisplayName(customerId: string): Promise<string> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("display_name, customer_name, company_name")
      .eq("id", customerId)
      .single();
    if (error) logError("fetchCustomerDisplayName", error);
    return data?.display_name || data?.customer_name || data?.company_name || "";
  }, "", "fetchCustomerDisplayName");
}

// ─── CUSTOMER MERGE ─────────────────────────────────────

export interface CustomerMergeSource {
  id: string;
  bubble_id: string | null;
  customer_name: string | null;
  display_name: string | null;
  company_name: string | null;
  brand_name_cn: string | null;
  brand_name_en: string | null;
  branding_icon: string | null;
  email: string | null;
  phone_display: string | null;
  phone_number_a: string | null;
  phone_number_b: string | null;
  address: string | null;
  view_system: string | null;
  status: string | null;
  status_filter_value: string | null;
  remark: string | null;
  asana: string | null;
  enquiry_create_date: string | null;
  tag_ids: string[];
  tag_names: string[];
}

export interface CustomerMergeRelatedCounts {
  bwaProjects: number;
  bwfProjects: number;
  bwaPitchings: number;
  bwfPitchings: number;
  comments: number;
  documents: number;
  tags: number;
  quotations: number;
  crEventDetails: number;
  crEvents: number;
  portalUsers: number;
}

export type CustomerMergeScalarPayload = {
  customer_name?: string | null;
  display_name?: string | null;
  company_name?: string | null;
  brand_name_cn?: string | null;
  brand_name_en?: string | null;
  branding_icon?: string | null;
  email?: string | null;
  phone_display?: string | null;
  phone_number_a?: string | null;
  phone_number_b?: string | null;
  address?: string | null;
  view_system?: string | null;
  status?: string | null;
  status_filter_value?: string | null;
  remark?: string | null;
  asana?: string | null;
  enquiry_create_date?: string | null;
};

async function countCustomerEq(
  table: string,
  column: string,
  value: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (error) {
    logError(`fetchCustomerMergeRelatedCounts/${table}.${column}`, error);
    return 0;
  }
  return count ?? 0;
}

async function countCustomerTextRefs(
  table: string,
  column: string,
  refs: string[]
): Promise<number> {
  if (refs.length === 0) return 0;
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .in(column, refs);
  if (error) {
    logError(`fetchCustomerMergeRelatedCounts/${table}.${column}`, error);
    return 0;
  }
  return count ?? 0;
}

/** Candidates for merge picker: Active customers only. */
export async function fetchCustomerMergeCandidates(
  search: string,
  excludeId: string,
  limit: number = 40
): Promise<CustomerRow[]> {
  return safeQuery(async () => {
    const selectFields =
      "id, bubble_id, customer_name, display_name, company_name, brand_name_cn, brand_name_en, branding_icon, email, phone_display, phone_number_a, address, tags, view_system, status, status_filter_value, bwa_income, bwa_profit, bwf_income, bwf_profit, bwa_receivable, bwf_receivable, bwa_project_number, bwf_project_number, bwa_pitching_number, bwf_pitching_no, created_date, enquiry_create_date, modified_date, remark, real_created_by_name";

    let query = supabase
      .from("customers")
      .select(selectFields)
      .eq("status", "Active")
      .neq("id", excludeId)
      .order("display_name", { ascending: true })
      .limit(limit);

    const trimmed = search.trim();
    if (trimmed) {
      const searchQ = `%${trimmed}%`;
      query = query.or(
        `customer_name.ilike.${searchQ},display_name.ilike.${searchQ},company_name.ilike.${searchQ},brand_name_cn.ilike.${searchQ},brand_name_en.ilike.${searchQ},email.ilike.${searchQ},phone_display.ilike.${searchQ}`
      );
    }

    const { data, error } = await query;
    if (error) {
      logError("fetchCustomerMergeCandidates", error);
      return [];
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      bubble_id: row.bubble_id ?? null,
      customer_name: row.customer_name ?? null,
      display_name: row.display_name ?? null,
      company_name: row.company_name ?? null,
      brand_name_cn: row.brand_name_cn ?? null,
      brand_name_en: row.brand_name_en ?? null,
      branding_icon: row.branding_icon ?? null,
      email: row.email ?? null,
      phone_display: row.phone_display ?? null,
      phone_number_a: row.phone_number_a ?? null,
      address: row.address ?? null,
      tags: row.tags ?? null,
      industry_tags: null,
      is_well_known_brand: false,
      view_system: row.view_system ?? null,
      status: row.status ?? "Active",
      status_filter_value: row.status_filter_value ?? null,
      bwa_income: row.bwa_income ?? null,
      bwa_profit: row.bwa_profit ?? null,
      bwf_income: row.bwf_income ?? null,
      bwf_profit: row.bwf_profit ?? null,
      bwa_receivable: row.bwa_receivable ?? null,
      bwf_receivable: row.bwf_receivable ?? null,
      bwa_project_number: row.bwa_project_number ?? null,
      bwf_project_number: row.bwf_project_number ?? null,
      bwa_pitching_number: row.bwa_pitching_number ?? null,
      bwf_pitching_no: row.bwf_pitching_no ?? null,
      created_date: row.created_date ?? null,
      enquiry_create_date: row.enquiry_create_date ?? null,
      modified_date: row.modified_date ?? null,
      remark: row.remark ?? null,
      real_created_by_name: row.real_created_by_name ?? null,
      bwa_signed_income: null,
      bwa_project_profit: null,
    })) as CustomerRow[];
  }, [], "fetchCustomerMergeCandidates");
}

export async function fetchCustomerMergeSource(
  customerId: string
): Promise<CustomerMergeSource | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, bubble_id, customer_name, display_name, company_name, brand_name_cn, brand_name_en, branding_icon, email, phone_display, phone_number_a, phone_number_b, address, view_system, status, status_filter_value, remark, asana, enquiry_create_date"
      )
      .eq("id", customerId)
      .single();
    if (error) {
      logError("fetchCustomerMergeSource", error);
      return null;
    }
    if (!data) return null;

    const { data: tagRows } = await supabase
      .from("customer_tags")
      .select("tag_uuid, nos_customer_tags(id, display)")
      .eq("customer_uuid", customerId);

    const tagIds: string[] = [];
    const tagNames: string[] = [];
    (tagRows ?? []).forEach((row: any) => {
      if (row.tag_uuid) tagIds.push(row.tag_uuid);
      const name = row.nos_customer_tags?.display;
      if (name) tagNames.push(name);
    });

    return {
      id: data.id,
      bubble_id: data.bubble_id ?? null,
      customer_name: data.customer_name ?? null,
      display_name: data.display_name ?? null,
      company_name: data.company_name ?? null,
      brand_name_cn: data.brand_name_cn ?? null,
      brand_name_en: data.brand_name_en ?? null,
      branding_icon: data.branding_icon ?? null,
      email: data.email ?? null,
      phone_display: data.phone_display ?? null,
      phone_number_a: data.phone_number_a ?? null,
      phone_number_b: data.phone_number_b ?? null,
      address: data.address ?? null,
      view_system: data.view_system ?? null,
      status: data.status ?? "Active",
      status_filter_value: data.status_filter_value ?? null,
      remark: data.remark ?? null,
      asana: data.asana ?? null,
      enquiry_create_date: data.enquiry_create_date ?? null,
      tag_ids: tagIds,
      tag_names: tagNames,
    };
  }, null, "fetchCustomerMergeSource");
}

export async function fetchCustomerMergeRelatedCounts(
  customerId: string,
  bubbleId?: string | null
): Promise<CustomerMergeRelatedCounts> {
  const empty: CustomerMergeRelatedCounts = {
    bwaProjects: 0,
    bwfProjects: 0,
    bwaPitchings: 0,
    bwfPitchings: 0,
    comments: 0,
    documents: 0,
    tags: 0,
    quotations: 0,
    crEventDetails: 0,
    crEvents: 0,
    portalUsers: 0,
  };

  return safeQuery(async () => {
    const refs = [customerId];
    if (bubbleId && String(bubbleId).trim()) refs.push(String(bubbleId).trim());

    const [
      bwaProjects,
      bwfProjects,
      bwaPitchings,
      bwfPitchings,
      comments,
      documents,
      tags,
      quotations,
      crEventDetails,
      crEvents,
      portalUsers,
    ] = await Promise.all([
      countCustomerEq("bwa_projects", "customer_id", customerId),
      countCustomerEq("bwf_projects", "customer_id", customerId),
      countCustomerEq("bwa_pitchings", "customer_id", customerId),
      countCustomerEq("bwf_pitchings", "customer_id", customerId),
      countCustomerEq("customer_comments", "customer_id", customerId),
      countCustomerEq("customer_documents", "customer_id", customerId),
      countCustomerEq("customer_tags", "customer_uuid", customerId),
      countCustomerEq("quotations", "customer_id", customerId),
      countCustomerEq("cr_event_details", "customer_id", customerId),
      countCustomerTextRefs("customer_cr_events", "customer_id", refs),
      countCustomerEq("users", "customer_id", customerId),
    ]);

    return {
      bwaProjects,
      bwfProjects,
      bwaPitchings,
      bwfPitchings,
      comments,
      documents,
      tags,
      quotations,
      crEventDetails,
      crEvents,
      portalUsers,
    };
  }, empty, "fetchCustomerMergeRelatedCounts");
}

export function coalesceCustomerScalar(
  a: string | null | undefined,
  b: string | null | undefined
): string {
  const av = a != null && String(a).trim() !== "" ? String(a) : "";
  if (av) return av;
  const bv = b != null && String(b).trim() !== "" ? String(b) : "";
  return bv;
}

export function buildMergedCustomerDefaults(
  a: CustomerMergeSource,
  b: CustomerMergeSource
): CustomerMergeScalarPayload {
  const pick = (key: keyof CustomerMergeSource) =>
    coalesceCustomerScalar(
      a[key] as string | null | undefined,
      b[key] as string | null | undefined
    );

  return {
    customer_name: pick("customer_name") || null,
    display_name: pick("display_name") || null,
    company_name: pick("company_name") || null,
    brand_name_cn: pick("brand_name_cn") || null,
    brand_name_en: pick("brand_name_en") || null,
    branding_icon: pick("branding_icon") || null,
    email: pick("email") || null,
    phone_display: pick("phone_display") || null,
    phone_number_a: pick("phone_number_a") || null,
    phone_number_b: pick("phone_number_b") || null,
    address: pick("address") || null,
    view_system: pick("view_system") || null,
    status: "Active",
    status_filter_value: pick("status_filter_value") || null,
    remark: pick("remark") || null,
    asana: pick("asana") || null,
    enquiry_create_date: coalesceCustomerScalar(
      a.enquiry_create_date,
      b.enquiry_create_date
    ) || null,
  };
}

export function sumCustomerMergeRelatedCounts(
  a: CustomerMergeRelatedCounts,
  b: CustomerMergeRelatedCounts
): CustomerMergeRelatedCounts {
  return {
    bwaProjects: a.bwaProjects + b.bwaProjects,
    bwfProjects: a.bwfProjects + b.bwfProjects,
    bwaPitchings: a.bwaPitchings + b.bwaPitchings,
    bwfPitchings: a.bwfPitchings + b.bwfPitchings,
    comments: a.comments + b.comments,
    documents: a.documents + b.documents,
    tags: a.tags + b.tags,
    quotations: a.quotations + b.quotations,
    crEventDetails: a.crEventDetails + b.crEventDetails,
    crEvents: a.crEvents + b.crEvents,
    portalUsers: a.portalUsers + b.portalUsers,
  };
}

export async function mergeCustomers(
  customerAId: string,
  customerBId: string,
  merged: CustomerMergeScalarPayload
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("/api/customers/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerAId, customerBId, merged }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      console.error("[mergeCustomers] Non-JSON response:", res.status, text.substring(0, 200));
      return { success: false, error: `伺服器錯誤 (${res.status})` };
    }
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return { success: false, error: data?.error || `伺服器錯誤 (${res.status})` };
    }
    return { success: true, id: data.id as string };
  } catch (err: any) {
    logError("mergeCustomers", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

// ─── PHONE DUPLICATE CHECK ─────────────────────────────

export function normalizePhoneDigits(phone: string): string {
  return phone.trim().replace(/[\s\-()+/]/g, "");
}

export interface CustomerPhoneDuplicateMatch {
  id: string;
  display_name: string | null;
  customer_name: string | null;
  company_name: string | null;
  phone_display: string | null;
  phone_number_a: string | null;
  phone_number_b: string | null;
}

export interface CustomerPhoneDuplicateResult {
  exactMatches: CustomerPhoneDuplicateMatch[];
  similarMatches: CustomerPhoneDuplicateMatch[];
  isBlocked: boolean;
}

/**
 * Check whether a phone number is already used by another customer
 * (across phone_display / phone_number_a / phone_number_b).
 */
export async function checkCustomerPhoneDuplicate(
  phone: string,
  excludeId?: string
): Promise<CustomerPhoneDuplicateResult> {
  const empty: CustomerPhoneDuplicateResult = {
    exactMatches: [],
    similarMatches: [],
    isBlocked: false,
  };

  const rawTrimmed = phone.trim();
  const normalized = normalizePhoneDigits(rawTrimmed);
  if (!normalized || normalized.length < 4) return empty;

  return safeQuery(
    async () => {
      const patterns = new Set<string>([rawTrimmed, normalized]);
      const orParts: string[] = [];
      for (const p of patterns) {
        // Escape PostgREST filter special chars in user input
        const safe = p.replace(/[,()]/g, "");
        if (!safe) continue;
        orParts.push(
          `phone_display.ilike.%${safe}%`,
          `phone_number_a.ilike.%${safe}%`,
          `phone_number_b.ilike.%${safe}%`
        );
      }
      if (orParts.length === 0) return empty;

      let query = supabase
        .from("customers")
        .select(
          "id, display_name, customer_name, company_name, phone_display, phone_number_a, phone_number_b"
        )
        .or(orParts.join(","))
        .limit(30);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }

      const { data, error } = await query;
      if (error) {
        logError("checkCustomerPhoneDuplicate", error);
        return empty;
      }

      const exact: CustomerPhoneDuplicateMatch[] = [];
      const similar: CustomerPhoneDuplicateMatch[] = [];

      for (const row of data ?? []) {
        const phones = [
          row.phone_display,
          row.phone_number_a,
          row.phone_number_b,
        ].map((v) => normalizePhoneDigits(v || ""));

        if (phones.some((p) => p && p === normalized)) {
          exact.push(row as CustomerPhoneDuplicateMatch);
        } else {
          similar.push(row as CustomerPhoneDuplicateMatch);
        }
      }

      return {
        exactMatches: exact,
        similarMatches: similar,
        isBlocked: exact.length > 0,
      };
    },
    empty,
    "checkCustomerPhoneDuplicate"
  );
}
