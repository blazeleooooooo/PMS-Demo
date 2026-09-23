import {
  supabase,
  adminFetch,
  logError,
  isBubbleId,
  safeQuery,
} from "@/lib/data/_core";
import type { LinkOption } from "@/lib/data/lookups";

// ─── BUILDINGS LIST ─────────────────────────────────────

export interface BuildingRow {
  id: string;
  bubble_id: string | null;
  building_name: string | null;
  building_name_eng: string | null;
  address: string | null;
  address_eng: string | null;
  district: string | null;
  x_display_name: string | null;
  first_contact: string | null;
  second_contact: string | null;
  third_contact: string | null;
  delivery_note: string | null;
  guideline: string | null;
  noisy_control: string | null;
  vetting_approval_time: string | null;
  x_night_works: string | null;
  x_comment: string | null;
  remarks: string | null;
  created_date: string | null;
  modified_date: string | null;
}

export async function fetchBuildings(): Promise<BuildingRow[]> {
  return safeQuery(async () => {
    const selectFields =
      "id, bubble_id, building_name, building_name_eng, address, address_eng, district, x_display_name, first_contact, second_contact, third_contact, delivery_note, guideline, noisy_control, vetting_approval_time, x_night_works, x_comment, remarks, created_date, modified_date, " +
      "resolved_district:districts!fk_buildings_district_id(name)";

    // Paginate — PostgREST defaults to 1000 rows max
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("buildings")
        .select(selectFields)
        .order("building_name", { ascending: true, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logError("fetchBuildings", error);
        break;
      }

      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    return allData.map((b: any) => ({
      id: b.id,
      bubble_id: b.bubble_id,
      building_name: b.building_name,
      building_name_eng: b.building_name_eng,
      address: b.address,
      address_eng: b.address_eng,
      district: b.resolved_district?.name ?? b.district_name ?? b.district,
      x_display_name: b.x_display_name,
      first_contact: b.first_contact,
      second_contact: b.second_contact,
      third_contact: b.third_contact,
      delivery_note: b.delivery_note,
      guideline: b.guideline,
      noisy_control: b.noisy_control,
      vetting_approval_time: b.vetting_approval_time,
      x_night_works: b.x_night_works,
      x_comment: b.x_comment,
      remarks: b.remarks,
      created_date: b.created_date,
      modified_date: b.modified_date,
    }));
  }, [], "fetchBuildings");
}

// ─── FACTORIES LIST ─────────────────────────────────────

export interface FactoryRow {
  id: string;
  bubble_id: string | null;
  factory_name: string | null;
  factory_eng_name: string | null;
  display_name: string | null;
  factory_code: string | null;
  email: string | null;
  phone: string | null;
  wechat: string | null;
  contact_person: string | null;
  location: string | null;
  website: string | null;
  key_product_categories: string | null;
  category_names: string[];
  priority: string | null;
  real_level: string | null;
  auto_level: string | null;
  admin_level: string | null;
  status: string | null;
  join_date: string | null;
  project_number: number | null;
  amount: number | null;
  outstanding: number | null;
  moq: string | null;
  delivery_period: string | null;
  delivery_days: string | null;
  manufacture_days: string | null;
  product_quality: string | null;
  remarks: string | null;
  asana_link: string | null;
  created_date: string | null;
  modified_date: string | null;
  created_by_id: string | null;
  created_by_name: string | null;
}

function resolveFactoryCategories(
  raw: string | null,
  productTypeMap: Map<string, string>
): { stored: string | null; names: string[] } {
  if (!raw) return { stored: null, names: [] };
  const parts = String(raw).split(",").map((x) => x.trim()).filter(Boolean);
  const names = parts
    .map((id) => productTypeMap.get(id) || (isBubbleId(id) ? null : id))
    .filter((name): name is string => !!name);
  return { stored: raw, names };
}

async function loadProductTypeMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data: types } = await supabase.from("product_types").select("id, bubble_id, display");
  (types ?? []).forEach((t: any) => {
    const label = t.display || t.id;
    if (t.id) map.set(t.id, label);
    if (t.bubble_id) map.set(t.bubble_id, label);
  });
  return map;
}

function mapFactoryRow(row: any, productTypeMap: Map<string, string>): FactoryRow {
  const { names } = resolveFactoryCategories(row.key_product_categories, productTypeMap);
  return {
    id: row.id,
    bubble_id: row.bubble_id ?? null,
    factory_name: row.factory_name ?? null,
    factory_eng_name: row.factory_eng_name ?? null,
    display_name: row.display_name ?? null,
    factory_code: row.factory_code ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    wechat: row.wechat ?? null,
    contact_person: row.contact_person ?? null,
    location: row.location ?? null,
    website: row.website ?? null,
    key_product_categories: row.key_product_categories ?? null,
    category_names: names,
    priority: row.priority ?? null,
    real_level: row.real_level ?? null,
    auto_level: row.auto_level ?? null,
    admin_level: row.admin_level ?? null,
    status: row.status ?? null,
    join_date: row.join_date ?? null,
    project_number: row.project_number ?? null,
    amount: row.amount ?? null,
    outstanding: row.outstanding ?? null,
    moq: row.moq ?? null,
    delivery_period: row.delivery_period ?? null,
    delivery_days: row.delivery_days ?? null,
    manufacture_days: row.manufacture_days ?? null,
    product_quality: row.product_quality ?? null,
    remarks: row.remarks ?? null,
    asana_link: row.asana_link ?? null,
    created_date: row.created_date ?? null,
    modified_date: row.modified_date ?? null,
    created_by_id: row.created_by_id ?? null,
    created_by_name: row.users?.email ?? null,
  };
}

export interface FactoryPageParams {
  page: number;
  pageSize: number;
  search?: string;
  categoryFilter?: string;
  statusFilter?: string;
  levelFilter?: string;
  sortField?: "factory_name" | "priority" | "real_level" | "project_number" | "amount" | "join_date" | "status";
  sortDir?: "asc" | "desc";
}

export type FactoryListFilters = Pick<
  FactoryPageParams,
  "search" | "categoryFilter" | "statusFilter" | "levelFilter"
>;

function applyFactoryListFilters<T extends { or: Function; eq: Function; ilike: Function }>(
  query: T,
  filters: FactoryListFilters
): T {
  let q = query;
  if (filters.search?.trim()) {
    const searchQ = filters.search.trim();
    q = q.or(
      `factory_name.ilike.%${searchQ}%,factory_eng_name.ilike.%${searchQ}%,display_name.ilike.%${searchQ}%,email.ilike.%${searchQ}%,phone.ilike.%${searchQ}%,contact_person.ilike.%${searchQ}%,location.ilike.%${searchQ}%,factory_code.ilike.%${searchQ}%`
    ) as T;
  }
  if (filters.statusFilter && filters.statusFilter !== "all") {
    q = q.eq("status", filters.statusFilter) as T;
  }
  if (filters.levelFilter && filters.levelFilter !== "all") {
    q = q.eq("priority", filters.levelFilter) as T;
  }
  if (filters.categoryFilter && filters.categoryFilter !== "all") {
    q = q.ilike("key_product_categories", `%${filters.categoryFilter}%`) as T;
  }
  return q;
}

export interface FactoryPageResult {
  data: FactoryRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export async function fetchFactoriesPage(params: FactoryPageParams): Promise<FactoryPageResult> {
  const {
    page = 0,
    pageSize = 50,
    search,
    categoryFilter,
    statusFilter,
    levelFilter,
    sortField = "factory_name",
    sortDir = "asc",
  } = params;

  return safeQuery(async () => {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const productTypeMap = await loadProductTypeMap();
    const listFilters: FactoryListFilters = { search, categoryFilter, statusFilter, levelFilter };

    let query = applyFactoryListFilters(
      supabase
        .from("factories")
        .select(
          `
        *,
        users!fk_factories_created_by_id(email)
      `,
          { count: "exact" }
        ),
      listFilters
    );

    const ascending = sortDir === "asc";
    query = query.order(sortField, { ascending, nullsFirst: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) {
      logError("fetchFactoriesPage", error);
      return { data: [], totalCount: 0, page, pageSize, hasMore: false };
    }

    const rows = (data ?? []).map((row: any) => mapFactoryRow(row, productTypeMap));
    const totalCount = count ?? 0;

    return {
      data: rows,
      totalCount,
      page,
      pageSize,
      hasMore: from + rows.length < totalCount,
    };
  }, { data: [], totalCount: 0, page: params.page, pageSize: params.pageSize, hasMore: false }, "fetchFactoriesPage");
}

export interface FactoryStats {
  total: number;
  active: number;
  levelA: number;
  totalAmount: number;
}

export async function fetchFactoryStats(
  filters: FactoryListFilters = {}
): Promise<FactoryStats> {
  return safeQuery(async () => {
    const [
      { count: total },
      { count: active },
      { count: levelA },
      { data: amountData },
    ] = await Promise.all([
      applyFactoryListFilters(
        supabase.from("factories").select("id", { count: "exact", head: true }),
        filters
      ),
      applyFactoryListFilters(
        supabase.from("factories").select("id", { count: "exact", head: true }),
        filters
      ).eq("status", "Active"),
      applyFactoryListFilters(
        supabase.from("factories").select("id", { count: "exact", head: true }),
        filters
      ).eq("priority", "1st Priority"),
      applyFactoryListFilters(
        supabase.from("factories").select("amount"),
        filters
      ).not("amount", "is", null),
    ]);

    const totalAmount = (amountData ?? []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    return {
      total: total ?? 0,
      active: active ?? 0,
      levelA: levelA ?? 0,
      totalAmount,
    };
  }, { total: 0, active: 0, levelA: 0, totalAmount: 0 }, "fetchFactoryStats");
}

export interface FactoryFilterOptions {
  categories: { id: string; name: string }[];
  levels: string[];
  statuses: string[];
}

export async function fetchFactoryFilterOptions(): Promise<FactoryFilterOptions> {
  return safeQuery(async () => {
    const [{ data: types }, { data: levels }, { data: statuses }] = await Promise.all([
      supabase.from("product_types").select("id, bubble_id, display").order("display"),
      supabase.from("factories").select("priority").not("priority", "is", null),
      supabase.from("factories").select("status").not("status", "is", null),
    ]);

    const categories = (types ?? []).map((t: any) => ({
      id: t.bubble_id || t.id,
      name: t.display || t.id,
    }));

    const uniqueLevels = [...new Set((levels ?? []).map((r: any) => r.priority as string))].sort() as string[];
    const uniqueStatuses = [...new Set((statuses ?? []).map((r: any) => r.status as string))].sort() as string[];

    return { categories, levels: uniqueLevels, statuses: uniqueStatuses };
  }, { categories: [], levels: [], statuses: [] }, "fetchFactoryFilterOptions");
}

export async function createFactory(
  data: {
    factory_name?: string;
    factory_eng_name?: string;
    display_name?: string;
    factory_code?: string;
    key_product_categories?: string;
    location?: string;
    status?: string;
    priority?: string;
    join_date?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    wechat?: string;
    website?: string;
    moq?: string;
    delivery_period?: string;
    delivery_days?: string;
    manufacture_days?: string;
    product_quality?: string;
    remarks?: string;
    asana_link?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data: created, error } = await supabase
      .from("factories")
      .insert({
        factory_name: data.factory_name || null,
        factory_eng_name: data.factory_eng_name || null,
        display_name: data.display_name || null,
        factory_code: data.factory_code || null,
        key_product_categories: data.key_product_categories || null,
        location: data.location || null,
        status: data.status || "Active",
        priority: data.priority || null,
        join_date: data.join_date || new Date().toISOString().split("T")[0],
        contact_person: data.contact_person || null,
        phone: data.phone || null,
        email: data.email || null,
        wechat: data.wechat || null,
        website: data.website || null,
        moq: data.moq || null,
        delivery_period: data.delivery_period || null,
        delivery_days: data.delivery_days || null,
        manufacture_days: data.manufacture_days || null,
        product_quality: data.product_quality || null,
        remarks: data.remarks || null,
        asana_link: data.asana_link || null,
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      })
      .select("id");
    if (error) {
      logError("createFactory", error);
      return { success: false, error: error.message };
    }
    return { success: true, id: created?.[0]?.id };
  } catch (err: any) {
    logError("createFactory", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function updateFactory(
  id: string,
  updates: {
    factory_name?: string;
    factory_eng_name?: string;
    display_name?: string;
    factory_code?: string;
    key_product_categories?: string;
    location?: string;
    status?: string;
    priority?: string;
    join_date?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    wechat?: string;
    website?: string;
    moq?: string;
    delivery_period?: string;
    delivery_days?: string;
    manufacture_days?: string;
    product_quality?: string;
    remarks?: string;
    asana_link?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("factories")
      .update({
        ...updates,
        modified_date: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id");
    if (error) {
      logError("updateFactory", error);
      return { success: false, error: error.message };
    }
    if (!data || data.length === 0) {
      return { success: false, error: "沒有權限或記錄不存在" };
    }
    return { success: true };
  } catch (err: any) {
    logError("updateFactory", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function deleteFactory(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("factories").delete().eq("id", id);
    if (error) {
      logError("deleteFactory", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    logError("deleteFactory", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

// ─── FACTORY DETAIL ─────────────────────────────────────

export type FactoryDetailData = FactoryRow;

export async function fetchFactoryDetail(
  factoryId: string
): Promise<FactoryDetailData | null> {
  return safeQuery(async () => {
    const productTypeMap = await loadProductTypeMap();
    const { data, error } = await supabase
      .from("factories")
      .select(
        `
        *,
        users!fk_factories_created_by_id(email)
      `
      )
      .eq("id", factoryId)
      .single();

    if (error) {
      logError("fetchFactoryDetail", error);
      return null;
    }
    if (!data) return null;

    return mapFactoryRow(data, productTypeMap);
  }, null, "fetchFactoryDetail");
}

// ─── BUILDING CRUD ─────────────────────────────────────

export async function createBuilding(
  data: {
    building_name?: string;
    building_name_eng?: string;
    address?: string;
    address_eng?: string;
    district?: string;
    first_contact?: string;
    second_contact?: string;
    third_contact?: string;
    delivery_note?: string;
    guideline?: string;
    noisy_control?: string;
    vetting_approval_time?: string;
    x_night_works?: string;
    x_comment?: string;
    remarks?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await adminFetch({
      action: "create",
      table: "buildings",
      data: {
        building_name: data.building_name || null,
        building_name_eng: data.building_name_eng || null,
        address: data.address || null,
        address_eng: data.address_eng || null,
        district: data.district || null,
        first_contact: data.first_contact || null,
        second_contact: data.second_contact || null,
        third_contact: data.third_contact || null,
        delivery_note: data.delivery_note || null,
        guideline: data.guideline || null,
        noisy_control: data.noisy_control || null,
        vetting_approval_time: data.vetting_approval_time || null,
        x_night_works: data.x_night_works || null,
        x_comment: data.x_comment || null,
        remarks: data.remarks || null,
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logError("createBuilding", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function updateBuilding(
  id: string,
  updates: {
    building_name?: string;
    building_name_eng?: string;
    address?: string;
    address_eng?: string;
    district?: string;
    first_contact?: string;
    second_contact?: string;
    third_contact?: string;
    delivery_note?: string;
    guideline?: string;
    noisy_control?: string;
    vetting_approval_time?: string;
    x_night_works?: string;
    x_comment?: string;
    remarks?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({
      action: "update",
      table: "buildings",
      id,
      updates: { ...updates, modified_date: new Date().toISOString() },
    });
  } catch (err: any) {
    logError("updateBuilding", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function deleteBuilding(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({ action: "delete", table: "buildings", id });
  } catch (err: any) {
    logError("deleteBuilding", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

// ─── FACTORY OPTIONS ────────────────────────────────────

export async function fetchFactoryOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const PAGE = 1000;
    let all: any[] = [];
    let from = 0;
    let more = true;
    while (more) {
      const { data, error } = await supabase
        .from("factories")
        .select("id, factory_name, display_name")
        .order("factory_name", { ascending: true, nullsFirst: false })
        .range(from, from + PAGE - 1);
      if (error) { logError("fetchFactoryOptions", error); break; }
      all = all.concat(data ?? []);
      more = (data?.length ?? 0) === PAGE;
      from += PAGE;
    }
    return all.map((f: any) => ({
      id: f.id,
      label: f.factory_name || f.display_name || "未命名廠商",
      sublabel: f.display_name && f.display_name !== f.factory_name ? f.display_name : undefined,
    }));
  }, [], "fetchFactoryOptions");
}

// ─── BUILDING OPTIONS ───────────────────────────────────

export async function fetchBuildingOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("buildings")
      .select("id, building_name")
      .order("building_name");
    if (error) logError("fetchBuildingOptions", error);
    return (data ?? []).map((d: any) => ({
      id: d.id,
      label: d.building_name || "未命名",
    }));
  }, [], "fetchBuildingOptions");
}

// ─── BUILDING SEARCH (dialog typeahead) ─────────────────

export async function searchBuildingOptions(searchTerm: string = "", limit: number = 30): Promise<LinkOption[]> {
  return safeQuery(async () => {
    let query = supabase
      .from("buildings")
      .select("id, building_name")
      .order("building_name")
      .limit(limit);

    if (searchTerm) {
      query = query.ilike("building_name", `%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) logError("searchBuildingOptions", error);

    return (data ?? []).map((d: any) => ({
      id: d.id,
      label: d.building_name || "未命名",
    }));
  }, [], "searchBuildingOptions");
}

