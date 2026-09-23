import { buildStorageObjectKey } from "@/lib/storage-utils";
import {
  supabase,
  safeQuery,
  logError,
  adminFetch,
  isBubbleId,
} from "@/lib/data/_core";
import type { LinkOption } from "@/lib/data/lookups";
import {
  SUPPLIER_FILE_TYPE_BR,
  SUPPLIER_FILE_TYPE_INSURANCE,
} from "@/lib/expense-amount-rules";


/** BWF Installation 傢俬安裝 — supplier_types.id used for installation team pickers */
export const BWF_INSTALLATION_SUPPLIER_TYPE_ID = "5f8752d6-bbfc-4ed6-aaff-d36351567ef6";

export async function fetchSupplierOptions(
  supplierTypeId?: string,
  status?: string,
  orderBy: "name" | "display_name" = "name"
): Promise<LinkOption[]> {
  return safeQuery(async () => {
    let typeSupplierIds: string[] | null = null;
    if (supplierTypeId) {
      const { data: jRows, error: jErr } = await supabase
        .from("supplier_supplier_types")
        .select("supplier_id")
        .eq("supplier_type_id", supplierTypeId);
      if (jErr) {
        logError("fetchSupplierOptions", jErr);
        return [];
      }
      const ids = (jRows ?? []).map((r: any) => r.supplier_id).filter(Boolean) as string[];
      if (ids.length === 0) return [];
      typeSupplierIds = ids;
    }

    // Paginate — PostgREST defaults to 1000 rows max
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("suppliers")
        .select("id, name, display_name, chinese_name, sort_type, email, phone, professional_skill")
        .order(orderBy, { ascending: true, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);
      if (typeSupplierIds) {
        query = query.in("id", typeSupplierIds);
      }
      if (status) {
        query = query.eq("status", status);
      }
      const { data, error } = await query;
      if (error) {
        logError("fetchSupplierOptions", error);
        break;
      }
      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    return allData.map((s: any) => ({
      id: s.id,
      label: s.display_name || s.chinese_name || s.name,
      sublabel: [s.sort_type, s.name !== (s.display_name || s.chinese_name) ? s.name : null].filter(Boolean).join(" · "),
      searchText: [s.phone, s.email, s.professional_skill, s.sort_type].filter(Boolean).join(" "),
    }));
  }, [], "fetchSupplierOptions");
}

/** Active suppliers tagged as BWF Installation (傢俬安裝), sorted by display_name A–Z */
export async function fetchInstallationTeamOptions(): Promise<LinkOption[]> {
  return fetchSupplierOptions(BWF_INSTALLATION_SUPPLIER_TYPE_ID, "Active", "display_name");
}


// ─── SUPPLIER EXPENSE AGGREGATES (distinct projects + money) ───

interface SupplierExpenseAggregates {
  /** BWA + BWF distinct project totals */
  project_number: number;
  past_12_project: number;
  past_6_project: number;
  bwa_project_number: number;
  bwf_project_number: number;
  bwa_past_12_project: number;
  bwf_past_12_project: number;
  bwa_past_6_project: number;
  bwf_past_6_project: number;
  /** Sums from expenses (installment / paid / outstanding); totals = BWA + BWF */
  amount: number;
  paid: number;
  outstanding: number;
  bwa_amount: number;
  bwa_paid: number;
  bwa_outstanding: number;
  bwf_amount: number;
  bwf_paid: number;
  bwf_outstanding: number;
}

function emptySupplierExpenseAggregates(): SupplierExpenseAggregates {
  return {
    project_number: 0,
    past_12_project: 0,
    past_6_project: 0,
    bwa_project_number: 0,
    bwf_project_number: 0,
    bwa_past_12_project: 0,
    bwf_past_12_project: 0,
    bwa_past_6_project: 0,
    bwf_past_6_project: 0,
    amount: 0,
    paid: 0,
    outstanding: 0,
    bwa_amount: 0,
    bwa_paid: 0,
    bwa_outstanding: 0,
    bwf_amount: 0,
    bwf_paid: 0,
    bwf_outstanding: 0,
  };
}

function supplierExpenseAggregateFields(
  agg?: SupplierExpenseAggregates | null
): Pick<
  SupplierRow,
  | "project_number"
  | "past_12_project"
  | "past_6_project"
  | "bwa_project_number"
  | "bwf_project_number"
  | "bwa_past_12_project"
  | "bwf_past_12_project"
  | "bwa_past_6_project"
  | "bwf_past_6_project"
  | "amount"
  | "paid"
  | "outstanding"
  | "bwa_amount"
  | "bwa_paid"
  | "bwa_outstanding"
  | "bwf_amount"
  | "bwf_paid"
  | "bwf_outstanding"
> {
  const c = agg ?? emptySupplierExpenseAggregates();
  return {
    project_number: c.project_number,
    past_12_project: c.past_12_project,
    past_6_project: c.past_6_project,
    bwa_project_number: c.bwa_project_number,
    bwf_project_number: c.bwf_project_number,
    bwa_past_12_project: c.bwa_past_12_project,
    bwf_past_12_project: c.bwf_past_12_project,
    bwa_past_6_project: c.bwa_past_6_project,
    bwf_past_6_project: c.bwf_past_6_project,
    amount: c.amount,
    paid: c.paid,
    outstanding: c.outstanding,
    bwa_amount: c.bwa_amount,
    bwa_paid: c.bwa_paid,
    bwa_outstanding: c.bwa_outstanding,
    bwf_amount: c.bwf_amount,
    bwf_paid: c.bwf_paid,
    bwf_outstanding: c.bwf_outstanding,
  };
}

/**
 * Aggregate distinct projects + money from expenses for the given suppliers.
 * BWA = expenses.project_id; BWF = expenses.bwf_project_id (money attributed once:
 * BWA preferred if both FKs set). Windows use expense created_date.
 */
async function fetchSupplierExpenseAggregates(
  supplierIds: string[]
): Promise<Map<string, SupplierExpenseAggregates>> {
  const result = new Map<string, SupplierExpenseAggregates>();
  if (supplierIds.length === 0) return result;

  const now = Date.now();
  const ms6 = new Date();
  ms6.setMonth(ms6.getMonth() - 6);
  const t6 = ms6.getTime();
  const ms12 = new Date();
  ms12.setMonth(ms12.getMonth() - 12);
  const t12 = ms12.getTime();

  type Agg = {
    bwaAll: Set<string>;
    bwfAll: Set<string>;
    bwa12: Set<string>;
    bwf12: Set<string>;
    bwa6: Set<string>;
    bwf6: Set<string>;
    bwaAmount: number;
    bwaPaid: number;
    bwaOutstanding: number;
    bwfAmount: number;
    bwfPaid: number;
    bwfOutstanding: number;
  };
  const usage = new Map<string, Agg>();
  for (const id of supplierIds) {
    usage.set(id, {
      bwaAll: new Set(),
      bwfAll: new Set(),
      bwa12: new Set(),
      bwf12: new Set(),
      bwa6: new Set(),
      bwf6: new Set(),
      bwaAmount: 0,
      bwaPaid: 0,
      bwaOutstanding: 0,
      bwfAmount: 0,
      bwfPaid: 0,
      bwfOutstanding: 0,
    });
  }

  const PAGE_SIZE = 1000;
  const ID_CHUNK = 200;
  for (let i = 0; i < supplierIds.length; i += ID_CHUNK) {
    const chunk = supplierIds.slice(i, i + ID_CHUNK);
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase
        .from("expenses")
        .select(
          "supplier_id, project_id, bwf_project_id, created_date, installment_amount, paid_amount, outstanding"
        )
        .in("supplier_id", chunk)
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        logError("fetchSupplierExpenseAggregates", error);
        break;
      }
      for (const e of data ?? []) {
        const sid = e.supplier_id as string | null;
        if (!sid) continue;
        const agg = usage.get(sid);
        if (!agg) continue;
        const created = e.created_date ? new Date(e.created_date).getTime() : NaN;
        const inWindow = !isNaN(created) && created <= now;
        const in12 = inWindow && created >= t12;
        const in6 = inWindow && created >= t6;

        const installment = Number(e.installment_amount) || 0;
        const paid = Number(e.paid_amount) || 0;
        const outstanding =
          e.outstanding != null && e.outstanding !== ""
            ? Number(e.outstanding) || 0
            : Math.max(0, installment - paid);

        if (e.project_id) {
          const key = e.project_id as string;
          agg.bwaAll.add(key);
          if (in12) agg.bwa12.add(key);
          if (in6) agg.bwa6.add(key);
        }
        if (e.bwf_project_id) {
          const key = e.bwf_project_id as string;
          agg.bwfAll.add(key);
          if (in12) agg.bwf12.add(key);
          if (in6) agg.bwf6.add(key);
        }

        // Money: attribute each expense row once (BWA preferred if both FKs set)
        if (e.project_id) {
          agg.bwaAmount += installment;
          agg.bwaPaid += paid;
          agg.bwaOutstanding += outstanding;
        } else if (e.bwf_project_id) {
          agg.bwfAmount += installment;
          agg.bwfPaid += paid;
          agg.bwfOutstanding += outstanding;
        }
      }
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      page++;
    }
  }

  for (const [sid, agg] of usage) {
    const bwa = agg.bwaAll.size;
    const bwf = agg.bwfAll.size;
    const bwa12 = agg.bwa12.size;
    const bwf12 = agg.bwf12.size;
    const bwa6 = agg.bwa6.size;
    const bwf6 = agg.bwf6.size;
    result.set(sid, {
      project_number: bwa + bwf,
      past_12_project: bwa12 + bwf12,
      past_6_project: bwa6 + bwf6,
      bwa_project_number: bwa,
      bwf_project_number: bwf,
      bwa_past_12_project: bwa12,
      bwf_past_12_project: bwf12,
      bwa_past_6_project: bwa6,
      bwf_past_6_project: bwf6,
      bwa_amount: agg.bwaAmount,
      bwa_paid: agg.bwaPaid,
      bwa_outstanding: agg.bwaOutstanding,
      bwf_amount: agg.bwfAmount,
      bwf_paid: agg.bwfPaid,
      bwf_outstanding: agg.bwfOutstanding,
      amount: agg.bwaAmount + agg.bwfAmount,
      paid: agg.bwaPaid + agg.bwfPaid,
      outstanding: agg.bwaOutstanding + agg.bwfOutstanding,
    });
  }
  return result;
}


// ─── SUPPLIERS LIST ─────────────────────────────────────

export interface SupplierRow {
  id: string;
  bubble_id: string | null;
  name: string | null;
  display_name: string | null;
  chinese_name: string | null;
  account_description: string | null;
  email: string | null;
  phone: string | null;
  fax_no: string | null;
  address: string | null;
  website: string | null;
  contact_persons: string | null;
  company_office_photo: string | null;
  district: string | null;
  district_id: string | null;
  district_name: string | null;
  sort_type: string | null;
  n_type: string | null;
  n_type_id: string | null;
  n_type_ids: string[];
  n_type_name: string | null;
  n_type_names: string[];
  real_level: string | null;
  auto_level: string | null;
  status: string | null;
  account_status: string | null;
  disable_comments: boolean | null;
  join_date: string | null;
  establish_year: string | null;
  director_hkid: string | null;
  asana_link: string | null;
  referer_name: string | null;
  referer_set: string | null;
  /** Distinct BWA + BWF projects linked via expenses */
  project_number: number | null;
  past_12_project: number | null;
  past_6_project: number | null;
  bwa_project_number: number | null;
  bwf_project_number: number | null;
  bwa_past_12_project: number | null;
  bwf_past_12_project: number | null;
  bwa_past_6_project: number | null;
  bwf_past_6_project: number | null;
  /** From expenses: installment / paid / outstanding (BWA+BWF for totals) */
  amount: number | null;
  outstanding: number | null;
  paid: number | null;
  bwa_amount: number | null;
  bwa_paid: number | null;
  bwa_outstanding: number | null;
  bwf_amount: number | null;
  bwf_paid: number | null;
  bwf_outstanding: number | null;
  // Contact Person 1
  contact1_eng_givenname: string | null;
  contact1_eng_surname: string | null;
  contact1_eng_nickname: string | null;
  contact1_chn_surname: string | null;
  contact1_chn_given_name: string | null;
  contact1_chn_nickname: string | null;
  contact1_gender: string | null;
  contact1_phone: string | null;
  contact1_job_title: string | null;
  contact1_name_card: string | null;
  // Contact Person 2
  contact2_eng_givenname: string | null;
  contact2_eng_surname: string | null;
  contact2_eng_nickname: string | null;
  contact2_chn_surname: string | null;
  contact2_chn_given_name: string | null;
  contact2_chn_nickname: string | null;
  contact2_gender: string | null;
  contact2_phone: string | null;
  contact2_job_title: string | null;
  contact2_name_card: string | null;
  // Other
  remark: string | null;
  supplier_tags: string | null;
  professional_skill: string | null;
  moq: string | null;
  order_days: string | null;
  register_form: string | null;
  created_date: string | null;
  modified_date: string | null;
  created_by_id: string | null;
  created_by_name: string | null;
}

export async function fetchSuppliers(): Promise<SupplierRow[]> {
  return safeQuery(async () => {
    // Use UUID FK JOINs via PostgREST embedded resources
    // district_id → districts, n_type_id → supplier_types, created_by_id → users
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("suppliers")
        .select(`
          *,
          districts!fk_suppliers_district_id(name),
          supplier_types!fk_suppliers_n_type_id(display, chinese_display),
          users!fk_suppliers_created_by_id(email)
        `)
        .order("name", { ascending: true, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        logError("fetchSuppliers", error);
        break;
      }

      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    // Fetch supplier tags junction (many-to-many) with tag details
    const { data: tagJunctionRows } = await supabase
      .from("supplier_supplier_tags")
      .select("supplier_id, supplier_tag_id, nos_supplier_tags(id, tag_name)");

    // Build a map: supplier_id → [{id, name}]
    const supplierTagsMap = new Map<string, { id: string; name: string }[]>();
    (tagJunctionRows ?? []).forEach((row: any) => {
      const supplierId = row.supplier_id;
      const tagId = row.supplier_tag_id;
      const tagName = row.nos_supplier_tags?.tag_name ?? "";
      if (!supplierTagsMap.has(supplierId)) {
        supplierTagsMap.set(supplierId, []);
      }
      supplierTagsMap.get(supplierId)!.push({ id: tagId, name: tagName });
    });

    // Fallback: resolve supplier_tags via nos_supplier_tags bubble_id (for records not yet in junction)
    const { data: tagRows } = await supabase.from("nos_supplier_tags").select("bubble_id, tag_name");
    const tagMap = new Map<string, string>();
    (tagRows ?? []).forEach((t: any) => {
      if (t.bubble_id) tagMap.set(t.bubble_id, t.tag_name ?? "");
    });

    // Fetch supplier types junction (many-to-many) with type details
    const { data: junctionRows } = await supabase
      .from("supplier_supplier_types")
      .select("supplier_id, supplier_type_id, supplier_types(id, display, chinese_display)");
    
    // Build a map: supplier_id → [{id, name}]
    const supplierTypesMap = new Map<string, { id: string; name: string }[]>();
    (junctionRows ?? []).forEach((row: any) => {
      const supplierId = row.supplier_id;
      const typeId = row.supplier_type_id;
      const typeName = row.supplier_types?.chinese_display ?? row.supplier_types?.display ?? "";
      if (!supplierTypesMap.has(supplierId)) {
        supplierTypesMap.set(supplierId, []);
      }
      supplierTypesMap.get(supplierId)!.push({ id: typeId, name: typeName });
    });

    const projectCounts = await fetchSupplierExpenseAggregates(
      allData.map((s: any) => s.id as string)
    );

    return allData.map((s: any) => {
      // Extract joined data from embedded resources
      const districtName = s.districts?.name ?? null;
      // Use junction table for type names (many-to-many)
      const junctionTypes = supplierTypesMap.get(s.id) ?? [];
      const typeNames = junctionTypes.map(t => t.name).filter(Boolean);
      const typeIds = junctionTypes.map(t => t.id);
      // Fallback to single n_type_id if junction is empty
      const typeName = typeNames.length > 0 ? typeNames.join(", ") : (s.supplier_types?.chinese_display ?? s.supplier_types?.display ?? null);
      const createdByName = s.users?.email ?? null;
      const counts = projectCounts.get(s.id);

      // Resolve supplier_tags via junction table first, fallback to bubble_id lookup
      const junctionTags = supplierTagsMap.get(s.id) ?? [];
      let resolvedTags: string | null = null;
      if (junctionTags.length > 0) {
        const tagNames = junctionTags.map(t => t.name).filter(Boolean);
        resolvedTags = tagNames.length > 0 ? tagNames.join(", ") : null;
      } else if (s.supplier_tags && tagMap.size > 0) {
        // Fallback: resolve from legacy comma-separated bubble_ids
        const ids = String(s.supplier_tags).split(",").map((x: string) => x.trim()).filter(Boolean);
        const names = ids
          .map((id: string) => tagMap.get(id))
          .filter((name): name is string => !!name);
        resolvedTags = names.length > 0 ? names.join(", ") : null;
      }

      // Filter professional_skill — strip any Bubble IDs
      let resolvedProfSkill = s.professional_skill;
      if (s.professional_skill) {
        const parts = String(s.professional_skill).split(",").map((x: string) => x.trim()).filter(Boolean);
        const cleaned = parts.filter((p: string) => !isBubbleId(p));
        resolvedProfSkill = cleaned.length > 0 ? cleaned.join(", ") : null;
      }

      return {
        id: s.id,
        bubble_id: s.bubble_id,
        name: s.name,
        display_name: s.display_name,
        chinese_name: s.chinese_name,
        account_description: s.account_description ?? null,
        email: s.email,
        phone: s.phone,
        fax_no: s.fax_no,
        address: s.address,
        website: s.website,
        contact_persons: s.contact_persons ?? null,
        company_office_photo: s.company_office_photo ?? null,
        district: null, // legacy — do not use
        district_id: s.district_id ?? null,
        district_name: districtName,
        sort_type: null, // legacy — do not use
        n_type: null, // legacy — do not use
        n_type_id: s.n_type_id ?? null,
        n_type_ids: typeIds,
        n_type_name: typeName,
        n_type_names: typeNames,
        real_level: s.real_level,
        auto_level: s.auto_level,
        status: s.status,
        account_status: s.account_status,
        disable_comments: s.disable_comments ?? null,
        join_date: s.join_date,
        establish_year: s.establish_year,
        director_hkid: s.director_hkid ?? null,
        asana_link: s.asana_link ?? null,
        referer_name: s.referer_name ?? null,
        referer_set: s.referer_set ?? null,
        ...supplierExpenseAggregateFields(counts),
        // Contact Person 1
        contact1_eng_givenname: s.contact1_eng_givenname,
        contact1_eng_surname: s.contact1_eng_surname,
        contact1_eng_nickname: s.contact1_eng_nickname ?? null,
        contact1_chn_surname: s.contact1_chn_surname,
        contact1_chn_given_name: s.contact1_chn_given_name,
        contact1_chn_nickname: s.contact1_chn_nickname ?? null,
        contact1_gender: s.contact1_gender ?? null,
        contact1_phone: s.contact1_phone,
        contact1_job_title: s.contact1_job_title,
        contact1_name_card: s.contact1_name_card ?? null,
        // Contact Person 2
        contact2_eng_givenname: s.contact2_eng_givenname,
        contact2_eng_surname: s.contact2_eng_surname,
        contact2_eng_nickname: s.contact2_eng_nickname ?? null,
        contact2_chn_surname: s.contact2_chn_surname ?? null,
        contact2_chn_given_name: s.contact2_chn_given_name ?? null,
        contact2_chn_nickname: s.contact2_chn_nickname ?? null,
        contact2_gender: s.contact2_gender ?? null,
        contact2_phone: s.contact2_phone,
        contact2_job_title: s.contact2_job_title,
        contact2_name_card: s.contact2_name_card ?? null,
        // Other
        remark: s.remark,
        supplier_tags: resolvedTags,
        professional_skill: resolvedProfSkill,
        moq: s.moq,
        order_days: s.order_days,
        register_form: s.register_form ?? null,
        created_date: s.created_date,
        modified_date: s.modified_date,
        created_by_id: s.created_by_id ?? null,
        created_by_name: createdByName,
      };
    });
  }, [], "fetchSuppliers");
}


// ─── SUPPLIERS PAGINATED (SERVER-SIDE SEARCH/FILTER/SORT) ─────────────────

export interface SupplierPageParams {
  page: number;        // 0-based
  pageSize: number;    // rows per page (default 50)
  search?: string;     // free-text search across name, display_name, chinese_name, email, phone, professional_skill
  typeFilter?: string; // supplier_type id (filters via junction table)
  statusFilter?: string; // exact match on status column
  levelFilter?: string;  // exact match on real_level column
  sortField?: "name" | "n_type_name" | "real_level" | "project_number" | "amount" | "join_date" | "status";
  sortDir?: "asc" | "desc";
}

export type SupplierListFilters = Pick<
  SupplierPageParams,
  "search" | "typeFilter" | "statusFilter" | "levelFilter"
>;

async function resolveSupplierIdsForType(typeFilter?: string): Promise<string[] | null> {
  if (!typeFilter || typeFilter === "all") return null;
  const { data: jRows } = await supabase
    .from("supplier_supplier_types")
    .select("supplier_id")
    .eq("supplier_type_id", typeFilter);
  return (jRows ?? []).map((r: any) => r.supplier_id).filter(Boolean);
}

function applySupplierListFilters<T extends { or: Function; eq: Function; in: Function }>(
  query: T,
  filters: SupplierListFilters,
  supplierIdsForType: string[] | null
): T {
  let q = query;
  if (filters.search?.trim()) {
    const searchQ = filters.search.trim();
    q = q.or(
      `name.ilike.%${searchQ}%,display_name.ilike.%${searchQ}%,chinese_name.ilike.%${searchQ}%,email.ilike.%${searchQ}%,phone.ilike.%${searchQ}%,professional_skill.ilike.%${searchQ}%,address.ilike.%${searchQ}%,contact_persons.ilike.%${searchQ}%`
    ) as T;
  }
  if (filters.statusFilter && filters.statusFilter !== "all") {
    q = q.eq("status", filters.statusFilter) as T;
  }
  if (filters.levelFilter && filters.levelFilter !== "all") {
    q = q.eq("real_level", filters.levelFilter) as T;
  }
  if (supplierIdsForType) {
    q = q.in("id", supplierIdsForType) as T;
  }
  return q;
}

export interface SupplierPageResult {
  data: SupplierRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export async function fetchSuppliersPage(params: SupplierPageParams): Promise<SupplierPageResult> {
  const {
    page = 0,
    pageSize = 50,
    search,
    typeFilter,
    statusFilter,
    levelFilter,
    sortField = "name",
    sortDir = "asc",
  } = params;

  return safeQuery(async () => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const supplierIdsForType = await resolveSupplierIdsForType(typeFilter);
    if (supplierIdsForType && supplierIdsForType.length === 0) {
      return { data: [], totalCount: 0, page, pageSize, hasMore: false };
    }

    const listFilters: SupplierListFilters = { search, typeFilter, statusFilter, levelFilter };

    // Build query
    let query = applySupplierListFilters(
      supabase
        .from("suppliers")
        .select(`
        *,
        districts!fk_suppliers_district_id(name),
        supplier_types!fk_suppliers_n_type_id(display, chinese_display),
        users!fk_suppliers_created_by_id(email)
      `, { count: "exact" }),
      listFilters,
      supplierIdsForType
    );

    // Apply sort
    const ascending = sortDir === "asc";
    const sortColumn = sortField === "n_type_name" ? "name" : sortField; // fallback — n_type_name can't be sorted server-side via junction
    query = query.order(sortColumn, { ascending, nullsFirst: false });

    // Apply pagination
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      logError("fetchSuppliersPage", error);
      return { data: [], totalCount: 0, page, pageSize, hasMore: false };
    }

    const totalCount = count ?? 0;

    // Fetch supplier types junction for this page's suppliers
    const supplierIds = (data ?? []).map((s: any) => s.id);
    let supplierTypesMap = new Map<string, { id: string; name: string }[]>();

    if (supplierIds.length > 0) {
      const { data: junctionRows } = await supabase
        .from("supplier_supplier_types")
        .select("supplier_id, supplier_type_id, supplier_types(id, display, chinese_display)")
        .in("supplier_id", supplierIds);

      (junctionRows ?? []).forEach((row: any) => {
        const supplierId = row.supplier_id;
        const typeId = row.supplier_type_id;
        const typeName = row.supplier_types?.chinese_display ?? row.supplier_types?.display ?? "";
        if (!supplierTypesMap.has(supplierId)) {
          supplierTypesMap.set(supplierId, []);
        }
        supplierTypesMap.get(supplierId)!.push({ id: typeId, name: typeName });
      });
    }

    // Fetch supplier tags junction for this page's suppliers
    let supplierTagsMap = new Map<string, { id: string; name: string }[]>();
    if (supplierIds.length > 0) {
      const { data: tagJunctionRows } = await supabase
        .from("supplier_supplier_tags")
        .select("supplier_id, supplier_tag_id, nos_supplier_tags(id, tag_name)")
        .in("supplier_id", supplierIds);

      (tagJunctionRows ?? []).forEach((row: any) => {
        const supplierId = row.supplier_id;
        const tagId = row.supplier_tag_id;
        const tagName = row.nos_supplier_tags?.tag_name ?? "";
        if (!supplierTagsMap.has(supplierId)) {
          supplierTagsMap.set(supplierId, []);
        }
        supplierTagsMap.get(supplierId)!.push({ id: tagId, name: tagName });
      });
    }

    // Fallback: resolve supplier_tags via nos_supplier_tags bubble_id (for records not yet in junction)
    const { data: tagRows } = await supabase.from("nos_supplier_tags").select("bubble_id, tag_name");
    const tagMap = new Map<string, string>();
    (tagRows ?? []).forEach((t: any) => {
      if (t.bubble_id) tagMap.set(t.bubble_id, t.tag_name ?? "");
    });

    // Distinct project counts from expenses (not stale Bubble project_number columns)
    const projectCounts = await fetchSupplierExpenseAggregates(supplierIds);

    // Transform rows
    const rows: SupplierRow[] = (data ?? []).map((s: any) => {
      const districtName = s.districts?.name ?? null;
      const junctionTypes = supplierTypesMap.get(s.id) ?? [];
      const typeNames = junctionTypes.map(t => t.name).filter(Boolean);
      const typeIds = junctionTypes.map(t => t.id);
      const typeName = typeNames.length > 0 ? typeNames.join(", ") : (s.supplier_types?.chinese_display ?? s.supplier_types?.display ?? null);
      const createdByName = s.users?.email ?? null;
      const counts = projectCounts.get(s.id);

      // Resolve supplier_tags via junction table first, fallback to bubble_id lookup
      const junctionTags = supplierTagsMap.get(s.id) ?? [];
      let resolvedTags: string | null = null;
      if (junctionTags.length > 0) {
        const tagNames = junctionTags.map(t => t.name).filter(Boolean);
        resolvedTags = tagNames.length > 0 ? tagNames.join(", ") : null;
      } else if (s.supplier_tags && tagMap.size > 0) {
        const ids = String(s.supplier_tags).split(",").map((x: string) => x.trim()).filter(Boolean);
        const names = ids.map((id: string) => tagMap.get(id)).filter((name): name is string => !!name);
        resolvedTags = names.length > 0 ? names.join(", ") : null;
      }

      let resolvedProfSkill = s.professional_skill;
      if (s.professional_skill) {
        const parts = String(s.professional_skill).split(",").map((x: string) => x.trim()).filter(Boolean);
        const cleaned = parts.filter((p: string) => !isBubbleId(p));
        resolvedProfSkill = cleaned.length > 0 ? cleaned.join(", ") : null;
      }

      return {
        id: s.id,
        bubble_id: s.bubble_id,
        name: s.name,
        display_name: s.display_name,
        chinese_name: s.chinese_name,
        account_description: s.account_description ?? null,
        email: s.email,
        phone: s.phone,
        fax_no: s.fax_no,
        address: s.address,
        website: s.website,
        contact_persons: s.contact_persons ?? null,
        company_office_photo: s.company_office_photo ?? null,
        district: null,
        district_id: s.district_id ?? null,
        district_name: districtName,
        sort_type: null,
        n_type: null,
        n_type_id: s.n_type_id ?? null,
        n_type_ids: typeIds,
        n_type_name: typeName,
        n_type_names: typeNames,
        real_level: s.real_level,
        auto_level: s.auto_level,
        status: s.status,
        account_status: s.account_status,
        disable_comments: s.disable_comments ?? null,
        join_date: s.join_date,
        establish_year: s.establish_year,
        director_hkid: s.director_hkid ?? null,
        asana_link: s.asana_link ?? null,
        referer_name: s.referer_name ?? null,
        referer_set: s.referer_set ?? null,
        ...supplierExpenseAggregateFields(counts),
        contact1_eng_givenname: s.contact1_eng_givenname,
        contact1_eng_surname: s.contact1_eng_surname,
        contact1_eng_nickname: s.contact1_eng_nickname ?? null,
        contact1_chn_surname: s.contact1_chn_surname,
        contact1_chn_given_name: s.contact1_chn_given_name,
        contact1_chn_nickname: s.contact1_chn_nickname ?? null,
        contact1_gender: s.contact1_gender ?? null,
        contact1_phone: s.contact1_phone,
        contact1_job_title: s.contact1_job_title,
        contact1_name_card: s.contact1_name_card ?? null,
        contact2_eng_givenname: s.contact2_eng_givenname,
        contact2_eng_surname: s.contact2_eng_surname,
        contact2_eng_nickname: s.contact2_eng_nickname ?? null,
        contact2_chn_surname: s.contact2_chn_surname ?? null,
        contact2_chn_given_name: s.contact2_chn_given_name ?? null,
        contact2_chn_nickname: s.contact2_chn_nickname ?? null,
        contact2_gender: s.contact2_gender ?? null,
        contact2_phone: s.contact2_phone,
        contact2_job_title: s.contact2_job_title,
        contact2_name_card: s.contact2_name_card ?? null,
        remark: s.remark,
        supplier_tags: resolvedTags,
        professional_skill: resolvedProfSkill,
        moq: s.moq,
        order_days: s.order_days,
        register_form: s.register_form ?? null,
        created_date: s.created_date,
        modified_date: s.modified_date,
        created_by_id: s.created_by_id ?? null,
        created_by_name: createdByName,
      };
    });

    return {
      data: rows,
      totalCount,
      page,
      pageSize,
      hasMore: (from + rows.length) < totalCount,
    };
  }, { data: [], totalCount: 0, page: params.page, pageSize: params.pageSize, hasMore: false }, "fetchSuppliersPage");
}

// ─── SUPPLIER STATS (lightweight KPI query) ─────────────────
export interface SupplierStats {
  total: number;
  active: number;
  levelA: number;
  totalAmount: number;
}

export async function fetchSupplierStats(
  filters: SupplierListFilters = {}
): Promise<SupplierStats> {
  return safeQuery(async () => {
    const supplierIdsForType = await resolveSupplierIdsForType(filters.typeFilter);
    if (supplierIdsForType && supplierIdsForType.length === 0) {
      return { total: 0, active: 0, levelA: 0, totalAmount: 0 };
    }

    const [
      { count: total },
      { count: active },
      { count: levelA },
      { data: amountData },
    ] = await Promise.all([
      applySupplierListFilters(
        supabase.from("suppliers").select("id", { count: "exact", head: true }),
        filters,
        supplierIdsForType
      ),
      applySupplierListFilters(
        supabase.from("suppliers").select("id", { count: "exact", head: true }),
        filters,
        supplierIdsForType
      ).eq("status", "Active"),
      applySupplierListFilters(
        supabase.from("suppliers").select("id", { count: "exact", head: true }),
        filters,
        supplierIdsForType
      ).eq("real_level", "A"),
      applySupplierListFilters(
        supabase.from("suppliers").select("amount"),
        filters,
        supplierIdsForType
      ).not("amount", "is", null),
    ]);

    const totalAmount = (amountData ?? []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    return {
      total: total ?? 0,
      active: active ?? 0,
      levelA: levelA ?? 0,
      totalAmount,
    };
  }, { total: 0, active: 0, levelA: 0, totalAmount: 0 }, "fetchSupplierStats");
}

// ─── SUPPLIER FILTER OPTIONS (lightweight) ─────────────────
export interface SupplierFilterOptions {
  types: { id: string; name: string }[];
  levels: string[];
  statuses: string[];
}

export async function fetchSupplierFilterOptions(): Promise<SupplierFilterOptions> {
  return safeQuery(async () => {
    const [{ data: types }, { data: levels }, { data: statuses }] = await Promise.all([
      supabase
        .from("supplier_types")
        .select("id, display, chinese_display, is_active")
        .or("is_active.is.null,is_active.eq.true")
        .order("display"),
      supabase.from("suppliers").select("real_level").not("real_level", "is", null),
      supabase.from("suppliers").select("status").not("status", "is", null),
    ]);

    const typeOptions = (types ?? []).map((t: any) => ({
      id: t.id,
      name: t.display || t.id,
    }));

    const uniqueLevels = [...new Set((levels ?? []).map((r: any) => r.real_level as string))].sort() as string[];
    const uniqueStatuses = [...new Set((statuses ?? []).map((r: any) => r.status as string))].sort() as string[];

    return { types: typeOptions, levels: uniqueLevels, statuses: uniqueStatuses };
  }, { types: [], levels: [], statuses: [] }, "fetchSupplierFilterOptions");
}


// ─── SUPPLIER CRUD ─────────────────────────────────────

export async function uploadSupplierNameCard(
  supplierId: string,
  contactNumber: 1 | 2,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const fileName = buildStorageObjectKey(`${supplierId}/contact${contactNumber}`, file.name);
    const { error: uploadError } = await supabase.storage
      .from("supplier-name-cards")
      .upload(fileName, file, { upsert: true });
    if (uploadError) return { success: false, error: uploadError.message };
    const { data: urlData } = supabase.storage.from("supplier-name-cards").getPublicUrl(fileName);
    // Update the supplier record with the new name card URL
    const column = contactNumber === 1 ? "contact1_name_card" : "contact2_name_card";
    const { error: updateErr } = await supabase
      .from("suppliers")
      .update({ [column]: urlData.publicUrl, modified_date: new Date().toISOString() })
      .eq("id", supplierId);
    if (updateErr) {
      logError("uploadSupplierNameCard:updateColumn", updateErr);
    }
    return { success: true, url: urlData.publicUrl };
  } catch (err: any) {
    logError("uploadSupplierNameCard", err);
    return { success: false, error: err?.message || "Upload failed" };
  }
}

export async function createSupplier(
  data: {
    name?: string;
    display_name?: string;
    chinese_name?: string;
    account_description?: string;
    email?: string;
    phone?: string;
    fax_no?: string;
    address?: string;
    website?: string;
    contact_persons?: string;
    n_type_id?: string;
    n_type_ids?: string[];
    district_id?: string;
    real_level?: string;
    status?: string;
    account_status?: string;
    join_date?: string;
    establish_year?: string;
    // Contact Person 1
    contact1_chn_surname?: string;
    contact1_chn_given_name?: string;
    contact1_chn_nickname?: string;
    contact1_eng_surname?: string;
    contact1_eng_givenname?: string;
    contact1_eng_nickname?: string;
    contact1_gender?: string;
    contact1_phone?: string;
    contact1_job_title?: string;
    // Contact Person 2
    contact2_chn_surname?: string;
    contact2_chn_given_name?: string;
    contact2_chn_nickname?: string;
    contact2_eng_surname?: string;
    contact2_eng_givenname?: string;
    contact2_eng_nickname?: string;
    contact2_gender?: string;
    contact2_phone?: string;
    contact2_job_title?: string;
    // Name cards
    contact1_name_card?: string;
    contact2_name_card?: string;
    // Business & Legal
    director_hkid?: string;
    referer_name?: string;
    referer_set?: string;
    asana_link?: string;
    remark?: string;
    supplier_tags?: string;
    professional_skill?: string;
    moq?: string;
    order_days?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { n_type_ids, ...tableData } = data;
    const result = await adminFetch({
      action: "create",
      table: "suppliers",
      data: {
        name: tableData.name || null,
        display_name: tableData.display_name || null,
        chinese_name: tableData.chinese_name || null,
        account_description: tableData.account_description || null,
        email: tableData.email || null,
        phone: tableData.phone || null,
        fax_no: tableData.fax_no || null,
        address: tableData.address || null,
        website: tableData.website || null,
        contact_persons: tableData.contact_persons || null,
        n_type_id: (n_type_ids && n_type_ids.length > 0) ? n_type_ids[0] : (tableData.n_type_id || null),
        district_id: tableData.district_id || null,
        real_level: tableData.real_level || null,
        status: tableData.status || "Active",
        account_status: tableData.account_status || null,
        join_date: tableData.join_date || new Date().toISOString().split("T")[0],
        establish_year: tableData.establish_year || null,
        contact1_chn_surname: tableData.contact1_chn_surname || null,
        contact1_chn_given_name: tableData.contact1_chn_given_name || null,
        contact1_chn_nickname: tableData.contact1_chn_nickname || null,
        contact1_eng_surname: tableData.contact1_eng_surname || null,
        contact1_eng_givenname: tableData.contact1_eng_givenname || null,
        contact1_eng_nickname: tableData.contact1_eng_nickname || null,
        contact1_gender: tableData.contact1_gender || null,
        contact1_phone: tableData.contact1_phone || null,
        contact1_job_title: tableData.contact1_job_title || null,
        contact2_chn_surname: tableData.contact2_chn_surname || null,
        contact2_chn_given_name: tableData.contact2_chn_given_name || null,
        contact2_chn_nickname: tableData.contact2_chn_nickname || null,
        contact2_eng_surname: tableData.contact2_eng_surname || null,
        contact2_eng_givenname: tableData.contact2_eng_givenname || null,
        contact2_eng_nickname: tableData.contact2_eng_nickname || null,
        contact2_gender: tableData.contact2_gender || null,
        contact2_phone: tableData.contact2_phone || null,
        contact2_job_title: tableData.contact2_job_title || null,
        contact1_name_card: tableData.contact1_name_card || null,
        contact2_name_card: tableData.contact2_name_card || null,
        director_hkid: tableData.director_hkid || null,
        referer_name: tableData.referer_name || null,
        referer_set: tableData.referer_set || null,
        asana_link: tableData.asana_link || null,
        remark: tableData.remark || null,
        supplier_tags: tableData.supplier_tags || null,
        professional_skill: tableData.professional_skill || null,
        moq: tableData.moq || null,
        order_days: tableData.order_days || null,
        created_date: new Date().toISOString(),
        modified_date: new Date().toISOString(),
      },
    });

    // Sync junction table if n_type_ids provided and creation successful
    if (result.success && result.id && n_type_ids && n_type_ids.length > 0) {
      await syncSupplierTypes(result.id, n_type_ids);
    }

    return result;
  } catch (err: any) {
    logError("createSupplier", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

export async function updateSupplier(
  id: string,
  updates: {
    name?: string;
    display_name?: string;
    chinese_name?: string;
    account_description?: string;
    email?: string;
    phone?: string;
    fax_no?: string;
    address?: string;
    website?: string;
    contact_persons?: string;
    n_type_id?: string;
    n_type_ids?: string[];
    district_id?: string;
    status?: string;
    account_status?: string;
    join_date?: string;
    establish_year?: string;
    director_hkid?: string;
    referer_name?: string;
    referer_set?: string;
    asana_link?: string;
    professional_skill?: string;
    moq?: string;
    order_days?: string;
    contact1_eng_givenname?: string;
    contact1_eng_surname?: string;
    contact1_eng_nickname?: string;
    contact1_chn_surname?: string;
    contact1_chn_given_name?: string;
    contact1_chn_nickname?: string;
    contact1_gender?: string;
    contact1_phone?: string;
    contact1_job_title?: string;
    contact2_eng_givenname?: string;
    contact2_eng_surname?: string;
    contact2_eng_nickname?: string;
    contact2_chn_surname?: string;
    contact2_chn_given_name?: string;
    contact2_chn_nickname?: string;
    contact2_gender?: string;
    contact2_phone?: string;
    contact2_job_title?: string;
    contact1_name_card?: string;
    contact2_name_card?: string;
    remark?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract n_type_ids for junction table handling (don't send to suppliers table)
    const { n_type_ids, ...tableUpdates } = updates;

    // Convert empty string UUID fields to null to avoid "invalid input syntax for type uuid" errors
    const uuidFields = ["district_id", "n_type_id"];
    for (const field of uuidFields) {
      if (field in tableUpdates && (tableUpdates as any)[field] === "") {
        (tableUpdates as any)[field] = null;
      }
    }

    // Update the supplier row itself
    const result = await adminFetch({
      action: "update",
      table: "suppliers",
      id,
      updates: { ...tableUpdates, modified_date: new Date().toISOString() },
    });

    // Sync junction table if n_type_ids provided
    if (n_type_ids !== undefined) {
      await syncSupplierTypes(id, n_type_ids);
    }

    return result;
  } catch (err: any) {
    logError("updateSupplier", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

async function syncSupplierTypes(supplierId: string, typeIds: string[]): Promise<void> {
  // Delete existing junction rows for this supplier
  const { error: deleteErr } = await supabase
    .from("supplier_supplier_types")
    .delete()
    .eq("supplier_id", supplierId);
  if (deleteErr) {
    logError("syncSupplierTypes:delete", deleteErr);
  }

  // Insert new junction rows
  if (typeIds.length > 0) {
    const rows = typeIds.map(typeId => ({
      supplier_id: supplierId,
      supplier_type_id: typeId,
    }));
    const { error: insertErr } = await supabase
      .from("supplier_supplier_types")
      .insert(rows);
    if (insertErr) {
      logError("syncSupplierTypes:insert", insertErr);
    }
  }

  // Also update n_type_id to the first type for backwards compatibility
  const firstTypeId = typeIds.length > 0 ? typeIds[0] : null;
  const { error: updateErr } = await supabase
    .from("suppliers")
    .update({ n_type_id: firstTypeId })
    .eq("id", supplierId);
  if (updateErr) {
    logError("syncSupplierTypes:updateFirst", updateErr);
  }
}

export async function deleteSupplier(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({ action: "delete", table: "suppliers", id });
  } catch (err: any) {
    logError("deleteSupplier", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}


// ─── SUPPLIER DETAIL ────────────────────────────────────

export interface SupplierDetailData extends SupplierRow {
  // No legacy resolved fields needed — all come from UUID FK JOINs
  /** Latest (max) BR file expiry_date for this supplier */
  br_expiry_date: string | null;
  /** Latest (max) Labour Insurance file expiry_date for this supplier */
  labour_insurance_expiry_date: string | null;
}

export async function fetchSupplierDetail(
  supplierId: string
): Promise<SupplierDetailData | null> {
  return safeQuery(async () => {
    // Use UUID FK JOINs via PostgREST embedded resources
    const { data, error } = await supabase
      .from("suppliers")
      .select(`
        *,
        districts!fk_suppliers_district_id(name),
        supplier_types!fk_suppliers_n_type_id(display, chinese_display),
        users!fk_suppliers_created_by_id(email)
      `)
      .eq("id", supplierId)
      .single();

    if (error) {
      logError("fetchSupplierDetail", error);
      return null;
    }

    if (!data) return null;

    // Extract joined data from embedded resources
    const districtName = (data as any).districts?.name ?? null;
    const singleTypeName = (data as any).supplier_types?.chinese_display ?? (data as any).supplier_types?.display ?? null;
    const createdByName = (data as any).users?.email ?? null;

    // Fetch supplier types from junction table (many-to-many)
    const { data: junctionRows } = await supabase
      .from("supplier_supplier_types")
      .select("supplier_type_id, supplier_types(id, display, chinese_display)")
      .eq("supplier_id", supplierId);

    const typeIds: string[] = [];
    const typeNames: string[] = [];
    (junctionRows ?? []).forEach((row: any) => {
      typeIds.push(row.supplier_type_id);
      const name = row.supplier_types?.chinese_display ?? row.supplier_types?.display ?? "";
      if (name) typeNames.push(name);
    });
    // Use junction results, fallback to single FK if junction is empty
    const typeName = typeNames.length > 0 ? typeNames.join(", ") : singleTypeName;

    // Resolve supplier_tags via junction table first, fallback to bubble_id lookup
    const { data: tagJunctionRows } = await supabase
      .from("supplier_supplier_tags")
      .select("supplier_tag_id, nos_supplier_tags(id, tag_name)")
      .eq("supplier_id", supplierId);

    const tagNamesFromJunction = (tagJunctionRows ?? [])
      .map((row: any) => row.nos_supplier_tags?.tag_name)
      .filter(Boolean);

    let resolvedTags: string | null = null;
    if (tagNamesFromJunction.length > 0) {
      resolvedTags = tagNamesFromJunction.join(", ");
    } else if (data.supplier_tags) {
      // Fallback: resolve from legacy comma-separated bubble_ids
      const { data: tagRows } = await supabase.from("nos_supplier_tags").select("bubble_id, tag_name");
      const tagMap = new Map<string, string>();
      (tagRows ?? []).forEach((t: any) => {
        if (t.bubble_id) tagMap.set(t.bubble_id, t.tag_name ?? "");
      });
      const ids = String(data.supplier_tags).split(",").map((x: string) => x.trim()).filter(Boolean);
      const names = ids
        .map((id: string) => tagMap.get(id))
        .filter((name): name is string => !!name);
      resolvedTags = names.length > 0 ? names.join(", ") : null;
    }

    // Filter professional_skill — strip any Bubble IDs
    let resolvedProfSkill = data.professional_skill;
    if (data.professional_skill) {
      const parts = String(data.professional_skill).split(",").map((x: string) => x.trim()).filter(Boolean);
      const cleaned = parts.filter((p: string) => !isBubbleId(p));
      resolvedProfSkill = cleaned.length > 0 ? cleaned.join(", ") : null;
    }

    // Distinct project counts from expenses (align with Project tab listing)
    const projectCounts = await fetchSupplierExpenseAggregates([supplierId]);
    const counts = projectCounts.get(supplierId);

    // Latest expiry per BR / Labour Insurance file type
    const { data: expiryRows } = await supabase
      .from("supplier_files")
      .select("type_id, expiry_date")
      .eq("supplier_id", supplierId)
      .in("type_id", [SUPPLIER_FILE_TYPE_BR, SUPPLIER_FILE_TYPE_INSURANCE])
      .not("expiry_date", "is", null);

    let brExpiryDate: string | null = null;
    let labourInsuranceExpiryDate: string | null = null;
    for (const row of expiryRows ?? []) {
      if (!row.expiry_date) continue;
      if (row.type_id === SUPPLIER_FILE_TYPE_BR) {
        if (!brExpiryDate || row.expiry_date > brExpiryDate) {
          brExpiryDate = row.expiry_date;
        }
      } else if (row.type_id === SUPPLIER_FILE_TYPE_INSURANCE) {
        if (
          !labourInsuranceExpiryDate ||
          row.expiry_date > labourInsuranceExpiryDate
        ) {
          labourInsuranceExpiryDate = row.expiry_date;
        }
      }
    }

    return {
      id: data.id,
      bubble_id: data.bubble_id,
      name: data.name,
      display_name: data.display_name,
      chinese_name: data.chinese_name,
      account_description: data.account_description ?? null,
      email: data.email,
      phone: data.phone,
      fax_no: data.fax_no,
      address: data.address,
      website: data.website,
      contact_persons: data.contact_persons ?? null,
      company_office_photo: data.company_office_photo ?? null,
      district: null, // legacy — do not use
      district_id: data.district_id ?? null,
      district_name: districtName,
      sort_type: null, // legacy — do not use
      n_type: null, // legacy — do not use
      n_type_id: data.n_type_id ?? null,
      n_type_ids: typeIds,
      n_type_name: typeName,
      n_type_names: typeNames,
      real_level: data.real_level,
      auto_level: data.auto_level,
      status: data.status,
      account_status: data.account_status,
      disable_comments: data.disable_comments ?? null,
      join_date: data.join_date,
      establish_year: data.establish_year,
      director_hkid: data.director_hkid ?? null,
      asana_link: data.asana_link ?? null,
      referer_name: data.referer_name ?? null,
      referer_set: data.referer_set ?? null,
      ...supplierExpenseAggregateFields(counts),
      // Contact Person 1
      contact1_eng_givenname: data.contact1_eng_givenname,
      contact1_eng_surname: data.contact1_eng_surname,
      contact1_eng_nickname: data.contact1_eng_nickname ?? null,
      contact1_chn_surname: data.contact1_chn_surname,
      contact1_chn_given_name: data.contact1_chn_given_name,
      contact1_chn_nickname: data.contact1_chn_nickname ?? null,
      contact1_gender: data.contact1_gender ?? null,
      contact1_phone: data.contact1_phone,
      contact1_job_title: data.contact1_job_title,
      contact1_name_card: data.contact1_name_card ?? null,
      // Contact Person 2
      contact2_eng_givenname: data.contact2_eng_givenname,
      contact2_eng_surname: data.contact2_eng_surname,
      contact2_eng_nickname: data.contact2_eng_nickname ?? null,
      contact2_chn_surname: data.contact2_chn_surname ?? null,
      contact2_chn_given_name: data.contact2_chn_given_name ?? null,
      contact2_chn_nickname: data.contact2_chn_nickname ?? null,
      contact2_gender: data.contact2_gender ?? null,
      contact2_phone: data.contact2_phone,
      contact2_job_title: data.contact2_job_title,
      contact2_name_card: data.contact2_name_card ?? null,
      // Other
      remark: data.remark,
      supplier_tags: resolvedTags,
      professional_skill: resolvedProfSkill,
      moq: data.moq,
      order_days: data.order_days,
      register_form: data.register_form ?? null,
      created_date: data.created_date,
      modified_date: data.modified_date,
      created_by_id: data.created_by_id ?? null,
      created_by_name: createdByName,
      br_expiry_date: brExpiryDate,
      labour_insurance_expiry_date: labourInsuranceExpiryDate,
    } as SupplierDetailData;
  }, null, "fetchSupplierDetail");
}

// ─── SUPPLIER MERGE ─────────────────────────────────────

export interface SupplierMergeRelatedCounts {
  expenses: number;
  comments: number;
  files: number;
  pricings: number;
  recentStatuses: number;
  registerForms: number;
  tags: number;
  types: number;
  portalUsers: number;
  bwaProjectLinks: number;
  bwfProjectLinks: number;
  bwfOrders: number;
  apRemarks: number;
  bwfProjectSuppliers: number;
  loginCodes: number;
  feedback: number;
}

export type SupplierMergeScalarPayload = {
  display_name?: string | null;
  name?: string | null;
  chinese_name?: string | null;
  account_description?: string | null;
  email?: string | null;
  phone?: string | null;
  fax_no?: string | null;
  address?: string | null;
  website?: string | null;
  contact_persons?: string | null;
  district_id?: string | null;
  n_type_id?: string | null;
  real_level?: string | null;
  status?: string | null;
  account_status?: string | null;
  join_date?: string | null;
  establish_year?: string | null;
  director_hkid?: string | null;
  asana_link?: string | null;
  referer_name?: string | null;
  referer_set?: string | null;
  professional_skill?: string | null;
  remark?: string | null;
  moq?: string | null;
  order_days?: string | null;
  company_office_photo?: string | null;
  contact1_chn_surname?: string | null;
  contact1_chn_given_name?: string | null;
  contact1_chn_nickname?: string | null;
  contact1_eng_surname?: string | null;
  contact1_eng_givenname?: string | null;
  contact1_eng_nickname?: string | null;
  contact1_gender?: string | null;
  contact1_phone?: string | null;
  contact1_job_title?: string | null;
  contact1_name_card?: string | null;
  contact2_chn_surname?: string | null;
  contact2_chn_given_name?: string | null;
  contact2_chn_nickname?: string | null;
  contact2_eng_surname?: string | null;
  contact2_eng_givenname?: string | null;
  contact2_eng_nickname?: string | null;
  contact2_gender?: string | null;
  contact2_phone?: string | null;
  contact2_job_title?: string | null;
  contact2_name_card?: string | null;
};

async function countEq(
  table: string,
  column: string,
  value: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (error) {
    logError(`fetchSupplierMergeRelatedCounts/${table}.${column}`, error);
    return 0;
  }
  return count ?? 0;
}

async function countOrColumns(
  table: string,
  columns: string[],
  value: string
): Promise<number> {
  const orFilter = columns.map((c) => `${c}.eq.${value}`).join(",");
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .or(orFilter);
  if (error) {
    logError(`fetchSupplierMergeRelatedCounts/${table}.or`, error);
    return 0;
  }
  return count ?? 0;
}

async function countTextRefs(
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
    logError(`fetchSupplierMergeRelatedCounts/${table}.${column}`, error);
    return 0;
  }
  return count ?? 0;
}

/** Related-row counts for merge preview (one supplier). */
export async function fetchSupplierMergeRelatedCounts(
  supplierId: string,
  bubbleId?: string | null
): Promise<SupplierMergeRelatedCounts> {
  const empty: SupplierMergeRelatedCounts = {
    expenses: 0,
    comments: 0,
    files: 0,
    pricings: 0,
    recentStatuses: 0,
    registerForms: 0,
    tags: 0,
    types: 0,
    portalUsers: 0,
    bwaProjectLinks: 0,
    bwfProjectLinks: 0,
    bwfOrders: 0,
    apRemarks: 0,
    bwfProjectSuppliers: 0,
    loginCodes: 0,
    feedback: 0,
  };

  return safeQuery(async () => {
    const refs = [supplierId];
    if (bubbleId && String(bubbleId).trim()) refs.push(String(bubbleId).trim());

    const [
      expenses,
      comments,
      files,
      pricings,
      recentStatuses,
      registerForms,
      tags,
      types,
      portalUsers,
      bwaProjectLinks,
      bwfProjectLinks,
      bwfOrders,
      apRemarks,
      bwfProjectSuppliers,
      loginCodes,
      feedback,
    ] = await Promise.all([
      countEq("expenses", "supplier_id", supplierId),
      countEq("staff_supplier_comments", "supplier_id", supplierId),
      countEq("supplier_files", "supplier_id", supplierId),
      countEq("supplier_pricings", "supplier_id", supplierId),
      countEq("supplier_recent_statuses", "supplier_id", supplierId),
      countEq("supplier_register_forms", "supplier_id", supplierId),
      countEq("supplier_supplier_tags", "supplier_id", supplierId),
      countEq("supplier_supplier_types", "supplier_id", supplierId),
      countEq("users", "supplier_id", supplierId),
      countOrColumns(
        "bwa_projects",
        [
          "supplier_id",
          "main_contractor_id",
          "main_air_supplier_id",
          "main_network_supplier_id",
        ],
        supplierId
      ),
      countOrColumns("bwf_projects", ["supplier_id", "main_contractor_id"], supplierId),
      countOrColumns(
        "bwf_orders",
        ["warehouse_id", "installation_team_id", "defect_supplier_id"],
        supplierId
      ),
      countEq("ap_report_remarks", "supplier_id", supplierId),
      countEq("bwf_project_suppliers", "supplier_id", supplierId),
      countTextRefs("supplier_login_codes", "supplier", refs),
      countTextRefs("supplier_feedback", "supplier", refs),
    ]);

    return {
      expenses,
      comments,
      files,
      pricings,
      recentStatuses,
      registerForms,
      tags,
      types,
      portalUsers,
      bwaProjectLinks,
      bwfProjectLinks,
      bwfOrders,
      apRemarks,
      bwfProjectSuppliers,
      loginCodes,
      feedback,
    };
  }, empty, "fetchSupplierMergeRelatedCounts");
}

/** Prefer A else B for scalar merge defaults (empty string treated as null). */
export function coalesceSupplierScalar(
  a: string | null | undefined,
  b: string | null | undefined
): string {
  const av = a != null && String(a).trim() !== "" ? String(a) : "";
  if (av) return av;
  const bv = b != null && String(b).trim() !== "" ? String(b) : "";
  return bv;
}

export function buildMergedSupplierDefaults(
  a: SupplierDetailData,
  b: SupplierDetailData
): SupplierMergeScalarPayload {
  const pick = (key: keyof SupplierDetailData) =>
    coalesceSupplierScalar(
      a[key] as string | null | undefined,
      b[key] as string | null | undefined
    );

  return {
    display_name: pick("display_name") || null,
    name: pick("name") || null,
    chinese_name: pick("chinese_name") || null,
    account_description: pick("account_description") || null,
    email: pick("email") || null,
    phone: pick("phone") || null,
    fax_no: pick("fax_no") || null,
    address: pick("address") || null,
    website: pick("website") || null,
    contact_persons: pick("contact_persons") || null,
    district_id: coalesceSupplierScalar(a.district_id, b.district_id) || null,
    n_type_id: coalesceSupplierScalar(a.n_type_id, b.n_type_id) || null,
    real_level: pick("real_level") || null,
    status: "Active",
    account_status: pick("account_status") || null,
    join_date: coalesceSupplierScalar(a.join_date, b.join_date) || null,
    establish_year: pick("establish_year") || null,
    director_hkid: pick("director_hkid") || null,
    asana_link: pick("asana_link") || null,
    referer_name: pick("referer_name") || null,
    referer_set: pick("referer_set") || null,
    professional_skill: pick("professional_skill") || null,
    remark: pick("remark") || null,
    moq: pick("moq") || null,
    order_days: pick("order_days") || null,
    company_office_photo: pick("company_office_photo") || null,
    contact1_chn_surname: pick("contact1_chn_surname") || null,
    contact1_chn_given_name: pick("contact1_chn_given_name") || null,
    contact1_chn_nickname: pick("contact1_chn_nickname") || null,
    contact1_eng_surname: pick("contact1_eng_surname") || null,
    contact1_eng_givenname: pick("contact1_eng_givenname") || null,
    contact1_eng_nickname: pick("contact1_eng_nickname") || null,
    contact1_gender: pick("contact1_gender") || null,
    contact1_phone: pick("contact1_phone") || null,
    contact1_job_title: pick("contact1_job_title") || null,
    contact1_name_card: pick("contact1_name_card") || null,
    contact2_chn_surname: pick("contact2_chn_surname") || null,
    contact2_chn_given_name: pick("contact2_chn_given_name") || null,
    contact2_chn_nickname: pick("contact2_chn_nickname") || null,
    contact2_eng_surname: pick("contact2_eng_surname") || null,
    contact2_eng_givenname: pick("contact2_eng_givenname") || null,
    contact2_eng_nickname: pick("contact2_eng_nickname") || null,
    contact2_gender: pick("contact2_gender") || null,
    contact2_phone: pick("contact2_phone") || null,
    contact2_job_title: pick("contact2_job_title") || null,
    contact2_name_card: pick("contact2_name_card") || null,
  };
}

export function sumMergeRelatedCounts(
  a: SupplierMergeRelatedCounts,
  b: SupplierMergeRelatedCounts
): SupplierMergeRelatedCounts {
  return {
    expenses: a.expenses + b.expenses,
    comments: a.comments + b.comments,
    files: a.files + b.files,
    pricings: a.pricings + b.pricings,
    recentStatuses: a.recentStatuses + b.recentStatuses,
    registerForms: a.registerForms + b.registerForms,
    tags: a.tags + b.tags,
    types: a.types + b.types,
    portalUsers: a.portalUsers + b.portalUsers,
    bwaProjectLinks: a.bwaProjectLinks + b.bwaProjectLinks,
    bwfProjectLinks: a.bwfProjectLinks + b.bwfProjectLinks,
    bwfOrders: a.bwfOrders + b.bwfOrders,
    apRemarks: a.apRemarks + b.apRemarks,
    bwfProjectSuppliers: a.bwfProjectSuppliers + b.bwfProjectSuppliers,
    loginCodes: a.loginCodes + b.loginCodes,
    feedback: a.feedback + b.feedback,
  };
}

export async function mergeSuppliers(
  supplierAId: string,
  supplierBId: string,
  merged: SupplierMergeScalarPayload
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("/api/suppliers/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierAId, supplierBId, merged }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      console.error("[mergeSuppliers] Non-JSON response:", res.status, text.substring(0, 200));
      return { success: false, error: `伺服器錯誤 (${res.status})` };
    }
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return { success: false, error: data?.error || `伺服器錯誤 (${res.status})` };
    }
    return { success: true, id: data.id as string };
  } catch (err: any) {
    logError("mergeSuppliers", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

// ─── SUPPLIER TAGS (JUNCTION TABLE) ─────────────────────

export interface SupplierTagOption {
  id: string;
  tag_name: string;
}

export interface SupplierTagEntry {
  id: string; // junction table row ID
  supplier_tag_id: string; // FK → nos_supplier_tags.id
}

/**
 * Fetches all available supplier tags + the supplier's current tags via junction table.
 */
export async function fetchSupplierTagsGrouped(
  supplierId: string
): Promise<{
  allTags: SupplierTagOption[];
  supplierTags: SupplierTagEntry[];
}> {
  return safeQuery(
    async () => {
      const [
        { data: allTags, error: tagErr },
        { data: supplierTags, error: stErr },
      ] = await Promise.all([
        supabase
          .from("nos_supplier_tags")
          .select("id, tag_name")
          .order("tag_name"),
        supabase
          .from("supplier_supplier_tags")
          .select("id, supplier_tag_id")
          .eq("supplier_id", supplierId),
      ]);

      if (tagErr) logError("fetchSupplierTagsGrouped/allTags", tagErr);
      if (stErr) logError("fetchSupplierTagsGrouped/supplierTags", stErr);

      return {
        allTags: (allTags ?? []) as SupplierTagOption[],
        supplierTags: (supplierTags ?? []) as SupplierTagEntry[],
      };
    },
    { allTags: [], supplierTags: [] },
    "fetchSupplierTagsGrouped"
  );
}

/**
 * Saves supplier tags via junction table. Handles add/remove diffs.
 */
export async function saveSupplierTags(
  supplierId: string,
  toAdd: string[], // supplier_tag_id values to add
  toRemove: string[] // junction table row IDs to delete
): Promise<{ success: boolean; error?: string }> {
  try {
    // Remove deselected tags
    if (toRemove.length > 0) {
      const { error: delErr } = await supabase
        .from("supplier_supplier_tags")
        .delete()
        .in("id", toRemove);
      if (delErr) {
        logError("saveSupplierTags/delete", delErr);
        return { success: false, error: delErr.message };
      }
    }

    // Add new tags
    if (toAdd.length > 0) {
      const rows = toAdd.map((tagId) => ({
        supplier_id: supplierId,
        supplier_tag_id: tagId,
      }));
      const { error: insErr } = await supabase
        .from("supplier_supplier_tags")
        .insert(rows);
      if (insErr) {
        logError("saveSupplierTags/insert", insErr);
        return { success: false, error: insErr.message };
      }
    }

    return { success: true };
  } catch (err: any) {
    logError("saveSupplierTags", err);
    return { success: false, error: err?.message ?? "Unknown error" };
  }
}

// ─── PHONE DUPLICATE CHECK ─────────────────────────────

export function normalizeSupplierPhoneDigits(phone: string): string {
  return phone.trim().replace(/[\s\-()+/]/g, "");
}

export interface SupplierPhoneDuplicateMatch {
  id: string;
  display_name: string | null;
  phone: string | null;
  chinese_name: string | null;
  name: string | null;
  contact1_phone: string | null;
  contact2_phone: string | null;
}

export interface SupplierPhoneDuplicateResult {
  exactMatches: SupplierPhoneDuplicateMatch[];
  similarMatches: SupplierPhoneDuplicateMatch[];
  isBlocked: boolean;
}

/**
 * Check whether a phone number is already used by another supplier
 * (across phone / contact1_phone / contact2_phone).
 */
export async function checkSupplierPhoneDuplicate(
  phone: string,
  excludeId?: string
): Promise<SupplierPhoneDuplicateResult> {
  const empty: SupplierPhoneDuplicateResult = {
    exactMatches: [],
    similarMatches: [],
    isBlocked: false,
  };

  const rawTrimmed = phone.trim();
  const normalized = normalizeSupplierPhoneDigits(rawTrimmed);
  if (!normalized || normalized.length < 4) return empty;

  return safeQuery(
    async () => {
      const patterns = new Set<string>([rawTrimmed, normalized]);
      const orParts: string[] = [];
      for (const p of patterns) {
        const safe = p.replace(/[,()]/g, "");
        if (!safe) continue;
        orParts.push(
          `phone.ilike.%${safe}%`,
          `contact1_phone.ilike.%${safe}%`,
          `contact2_phone.ilike.%${safe}%`
        );
      }
      if (orParts.length === 0) return empty;

      let query = supabase
        .from("suppliers")
        .select(
          "id, display_name, phone, chinese_name, name, contact1_phone, contact2_phone"
        )
        .or(orParts.join(","))
        .limit(30);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }

      const { data, error } = await query;
      if (error) {
        logError("checkSupplierPhoneDuplicate", error);
        return empty;
      }

      const exact: SupplierPhoneDuplicateMatch[] = [];
      const similar: SupplierPhoneDuplicateMatch[] = [];

      for (const row of data ?? []) {
        const phones = [row.phone, row.contact1_phone, row.contact2_phone].map(
          (v) => normalizeSupplierPhoneDigits(v || "")
        );

        if (phones.some((p) => p && p === normalized)) {
          exact.push(row as SupplierPhoneDuplicateMatch);
        } else {
          similar.push(row as SupplierPhoneDuplicateMatch);
        }
      }

      return {
        exactMatches: exact,
        similarMatches: similar,
        isBlocked: exact.length > 0,
      };
    },
    empty,
    "checkSupplierPhoneDuplicate"
  );
}
