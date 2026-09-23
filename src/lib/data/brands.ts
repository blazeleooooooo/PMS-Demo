import { supabase, logError, safeQuery } from "@/lib/data/_core";
import { resolveJunctionProjectTypeIdsForProjects } from "@/lib/data/junctions";
import { WELL_KNOWN_BRANDS_TAG_ID } from "@/lib/data/customers";

// ─── BRANDS (LOGO WALL) ───────────────────────────────────────
// The /brands logo wall lists customers carrying the "知名品牌 Well-known
// Brands" tag. Each brand row carries its CN/EN brand name, logo, and a
// summary of its most recent projects so users can filter and bulk-download
// the logos. Project/service-type filters narrow which brands appear.

export interface CustomerWellKnownBrandState {
  isWellKnownBrand: boolean;
  brand_name_cn: string;
  brand_name_en: string;
  branding_icon: string | null;
  customerTagRowId: string | null;
}

/** Brand fields + well-known tag state for a customer (used in BWA project edit). */
export async function fetchCustomerWellKnownBrandState(
  customerId: string
): Promise<CustomerWellKnownBrandState> {
  return safeQuery(
    async () => {
      const [{ data: customer, error: custErr }, { data: tagRow, error: tagErr }] =
        await Promise.all([
          supabase
            .from("customers")
            .select("brand_name_cn, brand_name_en, branding_icon")
            .eq("id", customerId)
            .single(),
          supabase
            .from("customer_tags")
            .select("id")
            .eq("customer_uuid", customerId)
            .eq("tag_uuid", WELL_KNOWN_BRANDS_TAG_ID)
            .maybeSingle(),
        ]);
      if (custErr) logError("fetchCustomerWellKnownBrandState/customer", custErr);
      if (tagErr) logError("fetchCustomerWellKnownBrandState/tag", tagErr);
      return {
        isWellKnownBrand: !!tagRow,
        brand_name_cn: customer?.brand_name_cn ?? "",
        brand_name_en: customer?.brand_name_en ?? "",
        branding_icon: customer?.branding_icon ?? null,
        customerTagRowId: tagRow?.id ?? null,
      };
    },
    {
      isWellKnownBrand: false,
      brand_name_cn: "",
      brand_name_en: "",
      branding_icon: null,
      customerTagRowId: null,
    },
    "fetchCustomerWellKnownBrandState"
  );
}

export interface BrandProjectSummary {
  id: string;
  project_name: string | null;
  project_code: string | null;
  signed_date: string | null;
  project_type_id: string | null;
  service_type_id: string | null;
}

export interface BrandRow {
  id: string; // customer id
  brand_name_cn: string | null;
  brand_name_en: string | null;
  branding_icon: string | null;
  display_name: string | null;
  company_name: string | null;
  customer_name: string | null;
  view_system: string | null;
  project_count: number;
  latest_project: BrandProjectSummary | null;
  recent_projects: BrandProjectSummary[]; // up to 3, newest first
  // Distinct type ids across this brand's projects (for filtering).
  project_type_ids: string[];
  service_type_ids: string[];
}

export async function fetchBrandWallCustomers(): Promise<BrandRow[]> {
  return safeQuery(async () => {
    // ── 1. Customer ids carrying the well-known-brands tag ──
    const tagIds = new Set<string>();
    {
      const PAGE = 1000;
      let page = 0;
      let more = true;
      while (more) {
        const { data, error } = await supabase
          .from("customer_tags")
          .select("customer_uuid")
          .eq("tag_uuid", WELL_KNOWN_BRANDS_TAG_ID)
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) {
          logError("fetchBrandWallCustomers/tags", error);
          break;
        }
        for (const r of data ?? []) if (r.customer_uuid) tagIds.add(r.customer_uuid);
        more = (data?.length ?? 0) === PAGE;
        page++;
      }
    }
    if (tagIds.size === 0) return [];
    const ids = Array.from(tagIds);

    // ── 2. Customer brand fields ──
    const customers = new Map<string, any>();
    const BATCH = 300;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, brand_name_cn, brand_name_en, branding_icon, display_name, company_name, customer_name, view_system"
        )
        .eq("status", "Active")
        .in("id", batch);
      if (error) {
        logError("fetchBrandWallCustomers/customers", error);
        continue;
      }
      for (const c of data ?? []) customers.set(c.id, c);
    }

    // ── 3. Projects for these customers (for counts + recent + type filters) ──
    const projectsByCustomer = new Map<string, BrandProjectSummary[]>();
    const allProjectRows: { id: string; customer_id: string; project_name: string | null; project_code: string | null; signed_date: string | null; n_service_type_id: string | null }[] = [];
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("bwa_projects")
        .select(
          "id, customer_id, project_name, project_code, signed_date, n_service_type_id"
        )
        .in("customer_id", batch);
      if (error) {
        logError("fetchBrandWallCustomers/projects", error);
        continue;
      }
      for (const p of data ?? []) {
        if (!p.customer_id) continue;
        allProjectRows.push(p as typeof allProjectRows[number]);
      }
    }

    const projectPtIds = await resolveJunctionProjectTypeIdsForProjects(
      allProjectRows.map((p) => p.id),
    );

    for (const p of allProjectRows) {
      if (!p.customer_id) continue;
      const list = projectsByCustomer.get(p.customer_id) || [];
      const ptIds = projectPtIds.get(p.id) ?? [];
      list.push({
        id: p.id,
        project_name: p.project_name,
        project_code: p.project_code,
        signed_date: p.signed_date,
        project_type_id: ptIds[0] ?? null,
        service_type_id: p.n_service_type_id,
      });
      projectsByCustomer.set(p.customer_id, list);
    }

    // ── 4. Assemble brand rows ──
    const rows: BrandRow[] = [];
    for (const id of ids) {
      const c = customers.get(id);
      if (!c) continue;
      const projects = projectsByCustomer.get(id) || [];
      // Newest first; nulls last.
      projects.sort((a, b) => {
        const at = a.signed_date ? new Date(a.signed_date).getTime() : -Infinity;
        const bt = b.signed_date ? new Date(b.signed_date).getTime() : -Infinity;
        return bt - at;
      });
      const ptIds = new Set<string>();
      const stIds = new Set<string>();
      for (const p of projects) {
        if (p.project_type_id) ptIds.add(p.project_type_id);
        if (p.service_type_id) stIds.add(p.service_type_id);
      }
      rows.push({
        id,
        brand_name_cn: c.brand_name_cn,
        brand_name_en: c.brand_name_en,
        branding_icon: c.branding_icon,
        display_name: c.display_name,
        company_name: c.company_name,
        customer_name: c.customer_name,
        view_system: c.view_system ?? null,
        project_count: projects.length,
        latest_project: projects[0] || null,
        recent_projects: projects.slice(0, 3),
        project_type_ids: Array.from(ptIds),
        service_type_ids: Array.from(stIds),
      });
    }
    return rows;
  }, [], "fetchBrandWallCustomers");
}

// Quick-edit a brand's display fields (CN/EN name + logo url) from the wall.
export async function updateBrandFields(
  customerId: string,
  updates: { brand_name_cn?: string; brand_name_en?: string; branding_icon?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const patch: Record<string, any> = {};
    if (updates.brand_name_cn !== undefined) patch.brand_name_cn = updates.brand_name_cn;
    if (updates.brand_name_en !== undefined) patch.brand_name_en = updates.brand_name_en;
    if (updates.branding_icon !== undefined) patch.branding_icon = updates.branding_icon;
    if (Object.keys(patch).length === 0) return { success: true };
    const { error } = await supabase.from("customers").update(patch).eq("id", customerId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    logError("updateBrandFields", err);
    return { success: false, error: err?.message || "Update failed" };
  }
}
