import {
  supabase,
  safeQuery,
  logError,
  adminFetch,
  fetchAllByFk,
  mapBatchesParallel,
} from "@/lib/data/_core";
import type { LinkOption } from "@/lib/data/lookups";
import { resolveBwfJunctionProductTypesForProducts } from "@/lib/data/junctions";
import {
  searchBWFPitchingOptions,
  fetchBWFPitchingLabel,
  fetchBWFProjectIdByPitching,
  fetchBWFPitchingIdByProject,
} from "@/lib/data/bwf-pitching";

// Phase 3 extract — BWF orders domain (warehouse / install / defect / production / CRUD).
// Pitching⇄project link helpers live in bwf-pitching; project search/label live in bwf-projects.
// searchFactoryOptions / fetchFactoryLabel are order-dialog variants (buildings-factories has fetchFactoryOptions only).

// Orders linked to a BWF pitching / project, for the Overview "Order Product" table.
export interface BWFOrderRow {
  id: string;
  product_name: string | null;
  product_type: string | null;
  quantity: number | null;
  created_by_name: string | null;
  factory_name: string | null;
  production_start_date: string | null;
  order_status: string | null;
}

type BWFOrderDisplaySource = {
  id: string;
  product_id: string | null;
  quantity: number | null;
  created_by_id: string | null;
  factory_id: string | null;
  production_start_date: string | null;
  o_order_status: string | null;
};

/** Resolve product / type / factory / creator labels from UUID FKs only. */
async function enrichBWFOrderDisplayRows(
  rows: BWFOrderDisplaySource[],
): Promise<BWFOrderRow[]> {
  const productIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))] as string[];
  const factoryIds = [...new Set(rows.map((r) => r.factory_id).filter(Boolean))] as string[];
  const userIds = [...new Set(rows.map((r) => r.created_by_id).filter(Boolean))] as string[];

  const [prodRes, factoryRes, userRes, typeMap] = await Promise.all([
    productIds.length
      ? supabase.from("bwf_products").select("id, display").in("id", productIds)
      : Promise.resolve({ data: [] as { id: string; display: string | null }[] }),
    factoryIds.length
      ? supabase.from("factories").select("id, factory_name, display_name").in("id", factoryIds)
      : Promise.resolve({ data: [] as { id: string; factory_name: string | null; display_name: string | null }[] }),
    userIds.length
      ? supabase.from("users").select("id, email, member_id").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; email: string | null; member_id: string | null }[] }),
    resolveBwfJunctionProductTypesForProducts(productIds),
  ]);

  const prodMap = new Map<string, string>(
    (prodRes.data ?? []).map((p: { id: string; display: string | null }) => [p.id, p.display || ""]),
  );
  const factoryMap = new Map<string, string>(
    (factoryRes.data ?? []).map((f: { id: string; factory_name: string | null; display_name: string | null }) => [
      f.id,
      f.factory_name || f.display_name || "",
    ]),
  );

  const staffIds = [
    ...new Set(
      (userRes.data ?? [])
        .map((u: { id: string; email: string | null; member_id: string | null }) => u.member_id)
        .filter(Boolean),
    ),
  ] as string[];
  let staffMap = new Map<string, string>();
  if (staffIds.length) {
    const { data: staffRows } = await supabase
      .from("staff")
      .select("id, name, full_name")
      .in("id", staffIds);
    staffMap = new Map(
      (staffRows ?? []).map((s: { id: string; name: string | null; full_name: string | null }) => [
        s.id,
        s.name || s.full_name || "",
      ]),
    );
  }

  const creatorMap = new Map<string, string>();
  for (const u of (userRes.data ?? []) as { id: string; email: string | null; member_id: string | null }[]) {
    const staffName = u.member_id ? staffMap.get(u.member_id) : null;
    const label = staffName || u.email || null;
    if (label) creatorMap.set(u.id, label);
  }

  return rows.map((r) => ({
    id: r.id,
    product_name: r.product_id ? prodMap.get(r.product_id) || null : null,
    product_type: r.product_id ? typeMap.get(r.product_id) || null : null,
    quantity: r.quantity,
    created_by_name: r.created_by_id ? creatorMap.get(r.created_by_id) || null : null,
    factory_name: r.factory_id ? factoryMap.get(r.factory_id) || null : null,
    production_start_date: r.production_start_date,
    order_status: r.o_order_status,
  }));
}

export async function fetchBWFPitchingOrders(
  bwfPitchingId: string
): Promise<BWFOrderRow[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwf_orders")
      .select(`
        id, product_id, quantity, o_order_status, production_start_date, created_by_id, factory_id
      `)
      .eq("bwf_pitching_id", bwfPitchingId)
      .order("created_date", { ascending: false });
    if (error) {
      logError("fetchBWFPitchingOrders", error);
      return [];
    }
    return enrichBWFOrderDisplayRows((data ?? []) as BWFOrderDisplaySource[]);
  }, [], "fetchBWFPitchingOrders");
}

export async function fetchBWFProjectOrders(
  bwfProjectId: string
): Promise<BWFOrderRow[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwf_orders")
      .select(`
        id, product_id, quantity, o_order_status, production_start_date, created_by_id, factory_id
      `)
      .eq("bwf_project_id", bwfProjectId)
      .order("created_date", { ascending: false });
    if (error) {
      logError("fetchBWFProjectOrders", error);
      return [];
    }
    return enrichBWFOrderDisplayRows((data ?? []) as BWFOrderDisplaySource[]);
  }, [], "fetchBWFProjectOrders");
}

/** Related order dates + defect counts for /bwf/payment-progress. */
export interface BWFPaymentProgressOrderMeta {
  siteArrivalDates: string[];
  installationDates: string[];
  defectOrderCount: number;
}

function uniqueSortedDates(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const items: { raw: string; t: number }[] = [];
  for (const value of values) {
    if (!value) continue;
    const t = new Date(value).getTime();
    if (Number.isNaN(t)) continue;
    const key = value.slice(0, 10);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ raw: value, t });
  }
  items.sort((a, b) => a.t - b.t);
  return items.map((item) => item.raw);
}

export async function fetchBWFPaymentProgressOrderMeta(
  projectIds: string[],
): Promise<Record<string, BWFPaymentProgressOrderMeta>> {
  if (projectIds.length === 0) return {};

  return safeQuery(async () => {
    type OrderMetaRow = {
      bwf_project_id: string | null;
      site_arrival_date: string | null;
      complete_installation_date: string | null;
      o_defect_status: string | null;
    };

    const rows = await mapBatchesParallel<OrderMetaRow>(
      projectIds,
      200,
      4,
      (batch) =>
        fetchAllByFk(
          "bwf_orders",
          "bwf_project_id, site_arrival_date, complete_installation_date, o_defect_status",
          "bwf_project_id",
          batch,
        ),
    );

    const grouped = new Map<
      string,
      { arrivals: Array<string | null>; installs: Array<string | null>; defectCount: number }
    >();
    for (const id of projectIds) {
      grouped.set(id, { arrivals: [], installs: [], defectCount: 0 });
    }

    for (const row of rows) {
      if (!row.bwf_project_id) continue;
      let bucket = grouped.get(row.bwf_project_id);
      if (!bucket) {
        bucket = { arrivals: [], installs: [], defectCount: 0 };
        grouped.set(row.bwf_project_id, bucket);
      }
      bucket.arrivals.push(row.site_arrival_date);
      bucket.installs.push(row.complete_installation_date);
      if (row.o_defect_status != null && String(row.o_defect_status).trim() !== "") {
        bucket.defectCount += 1;
      }
    }

    const result: Record<string, BWFPaymentProgressOrderMeta> = {};
    for (const [id, bucket] of grouped) {
      result[id] = {
        siteArrivalDates: uniqueSortedDates(bucket.arrivals),
        installationDates: uniqueSortedDates(bucket.installs),
        defectOrderCount: bucket.defectCount,
      };
    }
    return result;
  }, {}, "fetchBWFPaymentProgressOrderMeta", 30000);
}

// ─── BWF ORDERS LIST (訂單管理) ────────────────────────────
// Full bwf_orders list for the 訂單管理 page (linked projects only: bwf_project_id IS NOT NULL).
// bwf_orders has no DB-level FKs, so product / factory / project (code, name, PM) are
// resolved with batched .in() lookups and stitched together client-side.
export interface BWFOrderListRow {
  id: string;
  project_id: string | null;       // bwf_project_id (or bwf_pitching_id fallback)
  project_code: string | null;
  project_name: string | null;
  pm_name: string | null;
  product_name: string | null;
  quantity: number | null;
  factory_name: string | null;
  est_delivery_date: string | null;     // site_arrival_date_est (到達工地)
  est_installation_date: string | null; // complete_installation_date_est (完成項目)
  actual_installation_date: string | null; // complete_installation_date
  status: string | null;
}

export interface ProductionOrderRow {
  id: string;
  project_id: string | null;
  project_code: string | null;
  project_name: string | null;
  pm_name: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number | null;
  factory_name: string | null;
  factory_id: string | null;
  status: string | null;
  production_start_date: string | null;
  production_finish_date_est: string | null;
  production_finish_date: string | null;
  project_status: string | null;
}

const BWF_ORDER_EXCLUDED_WAREHOUSE_STATUSES = new Set([
  "Completed",
  "Confirmed - Unordered",
]);

/** True when order belongs on the 集運倉 list (Upcoming Deliveries or ready but status not updated). */
export function matchesConsolidationWarehouseOrder(
  order: {
    status: string | null;
    o_delivery_target: string | null;
    production_finish_date: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (order.status === "Upcoming Deliveries") return true;

  if (
    order.o_delivery_target === "Warehouse" &&
    order.production_finish_date &&
    new Date(order.production_finish_date) < now &&
    order.status &&
    !BWF_ORDER_EXCLUDED_WAREHOUSE_STATUSES.has(order.status)
  ) {
    return true;
  }

  return false;
}

/** Orders that match warehouse delivery criteria but are not yet marked Upcoming Deliveries. */
export function consolidationWarehouseNeedsStatusUpdate(
  order: {
    status: string | null;
    o_delivery_target: string | null;
    production_finish_date: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (order.status === "Upcoming Deliveries") return false;
  return matchesConsolidationWarehouseOrder(order, now);
}

export interface ConsolidationWarehouseOrderRow {
  id: string;
  project_id: string | null;
  project_code: string | null;
  project_name: string | null;
  pm_name: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number | null;
  factory_name: string | null;
  status: string | null;
  o_delivery_target: string | null;
  production_finish_date: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  warehouse_arrival_date: string | null;
  site_arrival_date_est: string | null;
  site_arrival_date: string | null;
  needs_status_update: boolean;
}

/** Pending Orders whose BWF project has at least one income with payment_amount > 0. */
export interface PaidPendingOrderRow {
  id: string;
  project_id: string | null;
  project_code: string | null;
  project_name: string | null;
  pm_name: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number | null;
  factory_name: string | null;
  status: string | null;
  o_delivery_target: string | null;
  production_finish_date_est: string | null;
  site_arrival_date_est: string | null;
  created_date: string | null;
  paid_income_total: number;
}

export async function fetchPaidPendingOrders(): Promise<PaidPendingOrderRow[]> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;

    // Projects with any income payment_amount > 0
    const paidProjectIds = new Set<string>();
    {
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("incomes")
          .select("bwf_project_id, payment_amount")
          .not("bwf_project_id", "is", null)
          .gt("payment_amount", 0)
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          logError("fetchPaidPendingOrders.incomes", error);
          return [];
        }
        for (const row of data ?? []) {
          if (row.bwf_project_id) paidProjectIds.add(row.bwf_project_id);
        }
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }
    }

    if (paidProjectIds.size === 0) return [];

    // Pending Orders linked to those projects
    const paidIds = [...paidProjectIds];
    const orderRows: any[] = [];
    // .in() batches to stay under URL limits
    const ID_BATCH = 200;
    for (let i = 0; i < paidIds.length; i += ID_BATCH) {
      const batch = paidIds.slice(i, i + ID_BATCH);
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("bwf_orders")
          .select(`
            id, bwf_project_id, product_id, factory_id, quantity,
            o_order_status, o_delivery_target,
            production_finish_date_est, site_arrival_date_est, created_date
          `)
          .eq("o_order_status", "Pending Orders")
          .in("bwf_project_id", batch)
          .order("created_date", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          logError("fetchPaidPendingOrders.orders", error);
          return [];
        }
        orderRows.push(...(data ?? []));
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }
    }

    if (orderRows.length === 0) return [];

    // Sum payment_amount per project for display
    const projectPaidTotal = new Map<string, number>();
    {
      const projectIds = [...new Set(orderRows.map((r) => r.bwf_project_id).filter(Boolean))];
      for (let i = 0; i < projectIds.length; i += ID_BATCH) {
        const batch = projectIds.slice(i, i + ID_BATCH);
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("incomes")
            .select("bwf_project_id, payment_amount")
            .in("bwf_project_id", batch)
            .gt("payment_amount", 0)
            .range(from, from + PAGE_SIZE - 1);
          if (error) {
            logError("fetchPaidPendingOrders.paidTotals", error);
            break;
          }
          for (const row of data ?? []) {
            if (!row.bwf_project_id) continue;
            projectPaidTotal.set(
              row.bwf_project_id,
              (projectPaidTotal.get(row.bwf_project_id) || 0) + (Number(row.payment_amount) || 0),
            );
          }
          hasMore = (data?.length ?? 0) === PAGE_SIZE;
          from += PAGE_SIZE;
        }
      }
    }

    const productIds = [...new Set(orderRows.map((r) => r.product_id).filter(Boolean))];
    const factoryIds = [...new Set(orderRows.map((r) => r.factory_id).filter(Boolean))];
    const projectIds = [...new Set(orderRows.map((r) => r.bwf_project_id).filter(Boolean))];

    const [prodRes, facRes, projRes] = await Promise.all([
      productIds.length
        ? supabase.from("bwf_products").select("id, display").in("id", productIds)
        : Promise.resolve({ data: [] as any[] }),
      factoryIds.length
        ? supabase.from("factories").select("id, factory_name, display_name").in("id", factoryIds)
        : Promise.resolve({ data: [] as any[] }),
      projectIds.length
        ? supabase.from("bwf_projects").select("id, project_code, project_name, main_pm, main_pm_id").in("id", projectIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const prodMap = new Map<string, string>(
      (prodRes.data ?? []).map((p: any) => [p.id, p.display as string]),
    );
    const facMap = new Map<string, string>(
      (facRes.data ?? []).map((f: any) => [f.id, (f.factory_name || f.display_name) as string]),
    );
    const projMap = new Map<string, any>((projRes.data ?? []).map((p: any) => [p.id, p]));

    const pmIds = [...new Set((projRes.data ?? []).map((p: any) => p.main_pm_id).filter(Boolean))];
    let pmMap = new Map<string, string>();
    if (pmIds.length) {
      const { data: staffRows } = await supabase.from("staff").select("id, name").in("id", pmIds);
      pmMap = new Map((staffRows ?? []).map((s: any) => [s.id, s.name]));
    }

    return orderRows.map((r: any): PaidPendingOrderRow => {
      const proj = r.bwf_project_id ? projMap.get(r.bwf_project_id) : null;
      const pmName = proj?.main_pm_id
        ? pmMap.get(proj.main_pm_id) || proj.main_pm || null
        : proj?.main_pm || null;
      return {
        id: r.id,
        project_id: r.bwf_project_id || null,
        project_code: proj?.project_code || null,
        project_name: proj?.project_name || null,
        pm_name: pmName,
        product_id: r.product_id || null,
        product_name: r.product_id ? prodMap.get(r.product_id) || null : null,
        quantity: r.quantity,
        factory_name: r.factory_id ? facMap.get(r.factory_id) || null : null,
        status: r.o_order_status || null,
        o_delivery_target: r.o_delivery_target || null,
        production_finish_date_est: r.production_finish_date_est || null,
        site_arrival_date_est: r.site_arrival_date_est || null,
        created_date: r.created_date || null,
        paid_income_total: r.bwf_project_id
          ? projectPaidTotal.get(r.bwf_project_id) || 0
          : 0,
      };
    });
  }, [], "fetchPaidPendingOrders");
}

export async function fetchConsolidationWarehouseOrders(): Promise<ConsolidationWarehouseOrderRow[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwf_orders")
      .select(`
        id, bwf_project_id, product_id, factory_id, quantity,
        o_order_status, o_delivery_target,
        production_finish_date, warehouse_id, warehouse_arrival_date,
        site_arrival_date_est, site_arrival_date, created_date
      `)
      .order("created_date", { ascending: false });
    if (error) {
      logError("fetchConsolidationWarehouseOrders", error);
      return [];
    }

    const now = new Date();
    const rows = (data ?? []).filter((r: any) =>
      matchesConsolidationWarehouseOrder(
        {
          status: r.o_order_status || null,
          o_delivery_target: r.o_delivery_target || null,
          production_finish_date: r.production_finish_date || null,
        },
        now,
      ),
    );

    const productIds = [...new Set(rows.map((r: any) => r.product_id).filter(Boolean))];
    const factoryIds = [...new Set(rows.map((r: any) => r.factory_id).filter(Boolean))];
    const projectIds = [...new Set(rows.map((r: any) => r.bwf_project_id).filter(Boolean))];
    const warehouseIds = [...new Set(rows.map((r: any) => r.warehouse_id).filter(Boolean))];

    const [prodRes, facRes, projRes, whRes] = await Promise.all([
      productIds.length
        ? supabase.from("bwf_products").select("id, display").in("id", productIds)
        : Promise.resolve({ data: [] as any[] }),
      factoryIds.length
        ? supabase.from("factories").select("id, factory_name, display_name").in("id", factoryIds)
        : Promise.resolve({ data: [] as any[] }),
      projectIds.length
        ? supabase.from("bwf_projects").select("id, project_code, project_name, main_pm, main_pm_id").in("id", projectIds)
        : Promise.resolve({ data: [] as any[] }),
      warehouseIds.length
        ? supabase.from("suppliers").select("id, display_name, chinese_name, name").in("id", warehouseIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const prodMap = new Map((prodRes.data ?? []).map((p: any) => [p.id, p.display]));
    const facMap = new Map((facRes.data ?? []).map((f: any) => [f.id, f.factory_name || f.display_name]));
    const projMap = new Map<string, any>((projRes.data ?? []).map((p: any) => [p.id, p]));
    const whMap = new Map(
      (whRes.data ?? []).map((s: any) => [s.id, s.display_name || s.chinese_name || s.name]),
    );

    const pmIds = [...new Set((projRes.data ?? []).map((p: any) => p.main_pm_id).filter(Boolean))];
    let pmMap = new Map<string, string>();
    if (pmIds.length) {
      const { data: staffRows } = await supabase.from("staff").select("id, name").in("id", pmIds);
      pmMap = new Map((staffRows ?? []).map((s: any) => [s.id, s.name]));
    }

    return rows.map((r: any) => {
      const proj = r.bwf_project_id ? projMap.get(r.bwf_project_id) : null;
      const pmName = proj?.main_pm_id
        ? pmMap.get(proj.main_pm_id) || proj.main_pm || null
        : proj?.main_pm || null;
      const base = {
        status: r.o_order_status || null,
        o_delivery_target: r.o_delivery_target || null,
        production_finish_date: r.production_finish_date || null,
      };
      return {
        id: r.id,
        project_id: r.bwf_project_id || null,
        project_code: proj?.project_code || null,
        project_name: proj?.project_name || null,
        pm_name: pmName,
        product_id: r.product_id || null,
        product_name: r.product_id ? prodMap.get(r.product_id) || null : null,
        quantity: r.quantity,
        factory_name: r.factory_id ? facMap.get(r.factory_id) || null : null,
        status: r.o_order_status || null,
        o_delivery_target: r.o_delivery_target || null,
        production_finish_date: r.production_finish_date || null,
        warehouse_id: r.warehouse_id || null,
        warehouse_name: r.warehouse_id ? whMap.get(r.warehouse_id) || null : null,
        warehouse_arrival_date: r.warehouse_arrival_date || null,
        site_arrival_date_est: r.site_arrival_date_est || null,
        site_arrival_date: r.site_arrival_date || null,
        needs_status_update: consolidationWarehouseNeedsStatusUpdate(base, now),
      };
    });
  }, [], "fetchConsolidationWarehouseOrders");
}

/** Logistics suppliers used as 集運倉 (warehouse_id → suppliers). */
export async function fetchWarehouseSupplierOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, display_name, chinese_name, sort_type")
        .ilike("sort_type", "%Logistic%")
        .order("display_name", { ascending: true, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        logError("fetchWarehouseSupplierOptions", error);
        break;
      }
      allData = allData.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    return allData.map(
      (s: any): LinkOption => ({
        id: s.id,
        label: s.display_name || s.chinese_name || s.name,
        sublabel: s.sort_type || undefined,
      }),
    );
  }, [] as LinkOption[], "fetchWarehouseSupplierOptions");
}

export async function bulkUpdateBWFOrdersDelivery(
  orderIds: string[],
  updates: {
    warehouse_id?: string | null;
    site_arrival_date?: string | null;
    o_order_status?: string | null;
  },
): Promise<{ success: boolean; error?: string; updated: number }> {
  const payload: Record<string, unknown> = { modified_date: new Date().toISOString() };
  if (updates.warehouse_id !== undefined) payload.warehouse_id = updates.warehouse_id;
  if (updates.site_arrival_date !== undefined) payload.site_arrival_date = updates.site_arrival_date;
  if (updates.o_order_status !== undefined) payload.o_order_status = updates.o_order_status;

  let updated = 0;
  for (const id of orderIds) {
    const result = await updateBWFOrder(id, payload);
    if (!result.success) {
      return { success: false, error: result.error, updated };
    }
    updated++;
  }
  return { success: true, updated };
}

/** Bulk-set actual production finish date + status on selected in-production orders. */
export async function bulkUpdateBWFOrdersProductionFinish(
  orderIds: string[],
  updates: {
    production_finish_date: string;
    o_order_status?: string | null;
  },
): Promise<{ success: boolean; error?: string; updated: number }> {
  const payload: Record<string, unknown> = {
    modified_date: new Date().toISOString(),
    production_finish_date: updates.production_finish_date,
  };
  if (updates.o_order_status !== undefined) payload.o_order_status = updates.o_order_status;

  let updated = 0;
  for (const id of orderIds) {
    const result = await updateBWFOrder(id, payload);
    if (!result.success) {
      return { success: false, error: result.error, updated };
    }
    updated++;
  }
  return { success: true, updated };
}

/** Bulk-assign initial production / delivery dates + status on selected orders. */
export async function bulkUpdateBWFOrdersInitialDates(
  orderIds: string[],
  updates: {
    production_finish_date_est: string;
    site_arrival_date_est: string;
    complete_installation_date_est: string;
    production_start_date: string;
    production_finish_date?: string | null;
    o_delivery_target: string;
    o_order_status: string;
  },
): Promise<{ success: boolean; error?: string; updated: number }> {
  const payload: Record<string, unknown> = {
    modified_date: new Date().toISOString(),
    production_finish_date_est: updates.production_finish_date_est,
    site_arrival_date_est: updates.site_arrival_date_est,
    complete_installation_date_est: updates.complete_installation_date_est,
    production_start_date: updates.production_start_date,
    o_delivery_target: updates.o_delivery_target,
    o_order_status: updates.o_order_status,
  };
  if (updates.production_finish_date) {
    payload.production_finish_date = updates.production_finish_date;
  }

  let updated = 0;
  for (const id of orderIds) {
    const result = await updateBWFOrder(id, payload);
    if (!result.success) {
      return { success: false, error: result.error, updated };
    }
    updated++;
  }
  return { success: true, updated };
}

const BWF_ORDER_EXCLUDED_INSTALLATION_STATUSES = new Set([
  "Completed",
  "Confirmed - Unordered",
]);

/** True when order belongs on the 安裝團隊 list. */
export function matchesInstallationTeamOrder(
  order: {
    status: string | null;
    site_arrival_date: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (order.status === "Awaiting Installation") return true;

  if (
    order.site_arrival_date &&
    new Date(order.site_arrival_date) < now &&
    order.status &&
    !BWF_ORDER_EXCLUDED_INSTALLATION_STATUSES.has(order.status)
  ) {
    return true;
  }

  return false;
}

/** Site arrived but status is not yet Awaiting Installation. */
export function installationTeamNeedsStatusUpdate(
  order: {
    status: string | null;
    site_arrival_date: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (order.status === "Awaiting Installation") return false;
  if (
    order.site_arrival_date &&
    new Date(order.site_arrival_date) < now &&
    order.status &&
    !BWF_ORDER_EXCLUDED_INSTALLATION_STATUSES.has(order.status)
  ) {
    return true;
  }
  return false;
}

export interface InstallationTeamOrderRow {
  id: string;
  project_id: string | null;
  project_code: string | null;
  project_name: string | null;
  pm_name: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number | null;
  factory_name: string | null;
  status: string | null;
  site_arrival_date: string | null;
  site_arrival_date_est: string | null;
  complete_installation_date_est: string | null;
  complete_installation_date: string | null;
  installation_team_id: string | null;
  installation_team_name: string | null;
  needs_status_update: boolean;
}

export async function fetchInstallationTeamOrders(): Promise<InstallationTeamOrderRow[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwf_orders")
      .select(`
        id, bwf_project_id, product_id, factory_id, quantity,
        o_order_status, site_arrival_date, site_arrival_date_est,
        complete_installation_date_est, complete_installation_date,
        installation_team_id, created_date
      `)
      .order("created_date", { ascending: false });
    if (error) {
      logError("fetchInstallationTeamOrders", error);
      return [];
    }

    const now = new Date();
    const rows = (data ?? []).filter((r: any) =>
      matchesInstallationTeamOrder(
        {
          status: r.o_order_status || null,
          site_arrival_date: r.site_arrival_date || null,
        },
        now,
      ),
    );

    const productIds = [...new Set(rows.map((r: any) => r.product_id).filter(Boolean))];
    const factoryIds = [...new Set(rows.map((r: any) => r.factory_id).filter(Boolean))];
    const projectIds = [...new Set(rows.map((r: any) => r.bwf_project_id).filter(Boolean))];
    const teamIds = [...new Set(rows.map((r: any) => r.installation_team_id).filter(Boolean))];

    const [prodRes, facRes, projRes, teamRes] = await Promise.all([
      productIds.length
        ? supabase.from("bwf_products").select("id, display").in("id", productIds)
        : Promise.resolve({ data: [] as any[] }),
      factoryIds.length
        ? supabase.from("factories").select("id, factory_name, display_name").in("id", factoryIds)
        : Promise.resolve({ data: [] as any[] }),
      projectIds.length
        ? supabase.from("bwf_projects").select("id, project_code, project_name, main_pm, main_pm_id").in("id", projectIds)
        : Promise.resolve({ data: [] as any[] }),
      teamIds.length
        ? supabase.from("suppliers").select("id, display_name, chinese_name, name").in("id", teamIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const prodMap = new Map((prodRes.data ?? []).map((p: any) => [p.id, p.display]));
    const facMap = new Map((facRes.data ?? []).map((f: any) => [f.id, f.factory_name || f.display_name]));
    const projMap = new Map<string, any>((projRes.data ?? []).map((p: any) => [p.id, p]));
    const teamMap = new Map(
      (teamRes.data ?? []).map((s: any) => [s.id, s.display_name || s.chinese_name || s.name]),
    );

    const pmIds = [...new Set((projRes.data ?? []).map((p: any) => p.main_pm_id).filter(Boolean))];
    let pmMap = new Map<string, string>();
    if (pmIds.length) {
      const { data: staffRows } = await supabase.from("staff").select("id, name").in("id", pmIds);
      pmMap = new Map((staffRows ?? []).map((s: any) => [s.id, s.name]));
    }

    return rows.map((r: any) => {
      const proj = r.bwf_project_id ? projMap.get(r.bwf_project_id) : null;
      const pmName = proj?.main_pm_id
        ? pmMap.get(proj.main_pm_id) || proj.main_pm || null
        : proj?.main_pm || null;
      const base = {
        status: r.o_order_status || null,
        site_arrival_date: r.site_arrival_date || null,
      };
      return {
        id: r.id,
        project_id: r.bwf_project_id || null,
        project_code: proj?.project_code || null,
        project_name: proj?.project_name || null,
        pm_name: pmName,
        product_id: r.product_id || null,
        product_name: r.product_id ? prodMap.get(r.product_id) || null : null,
        quantity: r.quantity,
        factory_name: r.factory_id ? facMap.get(r.factory_id) || null : null,
        status: r.o_order_status || null,
        site_arrival_date: r.site_arrival_date || null,
        site_arrival_date_est: r.site_arrival_date_est || null,
        complete_installation_date_est: r.complete_installation_date_est || null,
        complete_installation_date: r.complete_installation_date || null,
        installation_team_id: r.installation_team_id || null,
        installation_team_name: r.installation_team_id ? teamMap.get(r.installation_team_id) || null : null,
        needs_status_update: installationTeamNeedsStatusUpdate(base, now),
      };
    });
  }, [], "fetchInstallationTeamOrders");
}

export async function bulkUpdateBWFOrdersInstallation(
  orderIds: string[],
  updates: {
    installation_team_id: string;
    installation_completed: boolean;
    complete_installation_date?: string | null;
    o_order_status?: string | null;
  },
): Promise<{ success: boolean; error?: string; updated: number }> {
  const payload: Record<string, unknown> = {
    modified_date: new Date().toISOString(),
    installation_team_id: updates.installation_team_id,
    installer_needed: "true",
  };
  if (updates.installation_completed) {
    if (updates.complete_installation_date !== undefined) {
      payload.complete_installation_date = updates.complete_installation_date;
    }
    if (updates.o_order_status !== undefined) payload.o_order_status = updates.o_order_status;
  }

  let updated = 0;
  for (const id of orderIds) {
    const result = await updateBWFOrder(id, payload);
    if (!result.success) {
      return { success: false, error: result.error, updated };
    }
    updated++;
  }
  return { success: true, updated };
}

// ─── COMPLETION & DEFECT (完工及執漏) ───────────────────────

export interface CompletionDefectOrderRow {
  id: string;
  project_id: string | null;
  project_code: string | null;
  project_name: string | null;
  pm_name: string | null;
  os_project_defect: string | null;
  project_status: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number | null;
  factory_name: string | null;
  complete_installation_date: string | null;
  o_defect_status: string | null;
  o_defect_source: string | null;
  n_defect_cause_id: string | null;
  defect_cause_label: string | null;
  defect_notes: string | null;
  defect_fixed_date: string | null;
}

export interface CompletionDefectOrderDetail {
  id: string;
  project_code: string | null;
  product_name: string | null;
  o_defect_status: string | null;
  o_defect_source: string | null;
  n_defect_cause_id: string | null;
  defect_notes: string | null;
  defect_fixed_date: string | null;
}
export async function fetchCompletionDefectOrders(): Promise<CompletionDefectOrderRow[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwf_orders")
      .select(`
        id, bwf_project_id, product_id, factory_id, quantity,
        complete_installation_date,
        o_defect_status, o_defect_source, n_defect_cause_id,
        defect_notes, defect_fixed_date, created_date
      `)
      .not("complete_installation_date", "is", null)
      .order("created_date", { ascending: false });
    if (error) {
      logError("fetchCompletionDefectOrders", error);
      return [];
    }
    const rows = data ?? [];

    const productIds = [...new Set(rows.map((r: any) => r.product_id).filter(Boolean))];
    const factoryIds = [...new Set(rows.map((r: any) => r.factory_id).filter(Boolean))];
    const projectIds = [...new Set(rows.map((r: any) => r.bwf_project_id).filter(Boolean))];
    const causeIds = [...new Set(rows.map((r: any) => r.n_defect_cause_id).filter(Boolean))];

    const [prodRes, facRes, projRes, causeRes] = await Promise.all([
      productIds.length
        ? supabase.from("bwf_products").select("id, display").in("id", productIds)
        : Promise.resolve({ data: [] as any[] }),
      factoryIds.length
        ? supabase.from("factories").select("id, factory_name, display_name").in("id", factoryIds)
        : Promise.resolve({ data: [] as any[] }),
      projectIds.length
        ? supabase
            .from("bwf_projects")
            .select("id, project_code, project_name, main_pm, main_pm_id, os_project_defect, status")
            .in("id", projectIds)
        : Promise.resolve({ data: [] as any[] }),
      causeIds.length
        ? supabase.from("nos_defect_causes").select("id, display, chin_display").in("id", causeIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const prodMap = new Map((prodRes.data ?? []).map((p: any) => [p.id, p.display]));
    const facMap = new Map((facRes.data ?? []).map((f: any) => [f.id, f.factory_name || f.display_name]));
    const projMap = new Map<string, any>((projRes.data ?? []).map((p: any) => [p.id, p]));
    const causeMap = new Map(
      (causeRes.data ?? []).map((c: any) => [c.id, c.chin_display || c.display]),
    );

    const pmIds = [...new Set((projRes.data ?? []).map((p: any) => p.main_pm_id).filter(Boolean))];
    let pmMap = new Map<string, string>();
    if (pmIds.length) {
      const { data: staffRows } = await supabase.from("staff").select("id, name").in("id", pmIds);
      pmMap = new Map((staffRows ?? []).map((s: any) => [s.id, s.name]));
    }

    return rows.map((r: any) => {
      const proj = r.bwf_project_id ? projMap.get(r.bwf_project_id) : null;
      const pmName = proj?.main_pm_id
        ? pmMap.get(proj.main_pm_id) || proj.main_pm || null
        : proj?.main_pm || null;
      return {
        id: r.id,
        project_id: r.bwf_project_id || null,
        project_code: proj?.project_code || null,
        project_name: proj?.project_name || null,
        pm_name: pmName,
        os_project_defect: proj?.os_project_defect || null,
        project_status: proj?.status || null,
        product_id: r.product_id || null,
        product_name: r.product_id ? prodMap.get(r.product_id) || null : null,
        quantity: r.quantity,
        factory_name: r.factory_id ? facMap.get(r.factory_id) || null : null,
        complete_installation_date: r.complete_installation_date || null,
        o_defect_status: r.o_defect_status || null,
        o_defect_source: r.o_defect_source || null,
        n_defect_cause_id: r.n_defect_cause_id || null,
        defect_cause_label: r.n_defect_cause_id ? causeMap.get(r.n_defect_cause_id) || null : null,
        defect_notes: r.defect_notes || null,
        defect_fixed_date: r.defect_fixed_date || null,
      };
    });
  }, [], "fetchCompletionDefectOrders");
}

export async function fetchCompletionDefectOrderDetail(
  orderId: string,
): Promise<CompletionDefectOrderDetail | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwf_orders")
      .select(`
        id, bwf_project_id, product_id,
        o_defect_status, o_defect_source, n_defect_cause_id,
        defect_notes, defect_fixed_date
      `)
      .eq("id", orderId)
      .maybeSingle();
    if (error || !data) {
      logError("fetchCompletionDefectOrderDetail", error);
      return null;
    }

    let projectCode: string | null = null;
    if (data.bwf_project_id) {
      const { data: proj } = await supabase
        .from("bwf_projects")
        .select("project_code")
        .eq("id", data.bwf_project_id)
        .maybeSingle();
      projectCode = proj?.project_code || null;
    }

    let productName: string | null = null;
    if (data.product_id) {
      const { data: prod } = await supabase
        .from("bwf_products")
        .select("display")
        .eq("id", data.product_id)
        .maybeSingle();
      productName = prod?.display || null;
    }

    return {
      id: data.id,
      project_code: projectCode,
      product_name: productName,
      o_defect_status: data.o_defect_status || null,
      o_defect_source: data.o_defect_source || null,
      n_defect_cause_id: data.n_defect_cause_id || null,
      defect_notes: data.defect_notes || null,
      defect_fixed_date: data.defect_fixed_date || null,
    };
  }, null, "fetchCompletionDefectOrderDetail");
}

export async function updateCompletionDefectOrder(
  orderId: string,
  updates: {
    o_defect_status?: string | null;
    o_defect_source?: string | null;
    n_defect_cause_id?: string | null;
    defect_notes?: string | null;
    defect_fixed_date?: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  const payload: Record<string, unknown> = {
    modified_date: new Date().toISOString(),
  };
  if (updates.o_defect_status !== undefined) payload.o_defect_status = updates.o_defect_status;
  if (updates.o_defect_source !== undefined) payload.o_defect_source = updates.o_defect_source;
  if (updates.n_defect_cause_id !== undefined) payload.n_defect_cause_id = updates.n_defect_cause_id;
  if (updates.defect_notes !== undefined) payload.defect_notes = updates.defect_notes;
  if (updates.defect_fixed_date !== undefined) payload.defect_fixed_date = updates.defect_fixed_date;
  return updateBWFOrder(orderId, payload);
}

export async function updateBWFProjectDefectStatus(
  projectId: string,
  osProjectDefect: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({
      action: "update",
      table: "bwf_projects",
      id: projectId,
      updates: {
        os_project_defect: osProjectDefect,
        modified_date: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchProductionOrders(): Promise<ProductionOrderRow[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwf_orders")
      .select(`
        id, bwf_project_id, product_id, factory_id, factory, quantity,
        production_start_date, production_finish_date_est, production_finish_date,
        o_order_status, created_date
      `)
      .order("created_date", { ascending: false });
    if (error) {
      logError("fetchProductionOrders", error);
      return [];
    }
    const rows = data ?? [];

    const productIds = [...new Set(rows.map((r: any) => r.product_id).filter(Boolean))];
    const factoryIds = [...new Set(rows.map((r: any) => r.factory_id).filter(Boolean))];
    const projectIds = [...new Set(rows.map((r: any) => r.bwf_project_id).filter(Boolean))];

    const [prodRes, facRes, projRes] = await Promise.all([
      productIds.length
        ? supabase.from("bwf_products").select("id, display").in("id", productIds)
        : Promise.resolve({ data: [] as any[] }),
      factoryIds.length
        ? supabase.from("factories").select("id, factory_name, display_name").in("id", factoryIds)
        : Promise.resolve({ data: [] as any[] }),
      projectIds.length
        ? supabase.from("bwf_projects").select("id, project_code, project_name, main_pm, main_pm_id, status").in("id", projectIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const prodMap = new Map((prodRes.data ?? []).map((p: any) => [p.id, p.display]));
    const facMap = new Map((facRes.data ?? []).map((f: any) => [f.id, f.factory_name || f.display_name]));
    const projMap = new Map<string, any>(
      (projRes.data ?? []).map((p: any) => [p.id, p]),
    );

    const pmIds = [
      ...new Set((projRes.data ?? []).map((p: any) => p.main_pm_id).filter(Boolean)),
    ];
    let pmMap = new Map<string, string>();
    if (pmIds.length) {
      const { data: staffRows } = await supabase.from("staff").select("id, name").in("id", pmIds);
      pmMap = new Map((staffRows ?? []).map((s: any) => [s.id, s.name]));
    }

    return rows.map((r: any) => {
      const proj = r.bwf_project_id ? projMap.get(r.bwf_project_id) : null;
      const pmName = proj?.main_pm_id ? pmMap.get(proj.main_pm_id) || proj.main_pm || null : proj?.main_pm || null;
      return {
        id: r.id,
        project_id: r.bwf_project_id || null,
        project_code: proj?.project_code || null,
        project_name: proj?.project_name || null,
        pm_name: pmName,
        product_id: r.product_id || null,
        product_name: r.product_id ? prodMap.get(r.product_id) || null : null,
        quantity: r.quantity,
        factory_name: r.factory_id ? facMap.get(r.factory_id) || null : null,
        factory_id: r.factory_id || null,
        status: r.o_order_status || null,
        production_start_date: r.production_start_date || null,
        production_finish_date_est: r.production_finish_date_est || null,
        production_finish_date: r.production_finish_date || null,
        project_status: proj?.status || null,
      };
    });
  }, [], "fetchProductionOrders");
}

export async function fetchBWFOrders(): Promise<BWFOrderListRow[]> {
  return safeQuery(async () => {
    // Paginate — PostgREST defaults to 1000 rows max
    const PAGE_SIZE = 1000;
    let rows: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("bwf_orders")
        .select(`
          id, bwf_pitching_id, bwf_project_id, product_id, factory_id, quantity,
          site_arrival_date_est, complete_installation_date_est, complete_installation_date,
          o_order_status, created_date
        `)
        .not("bwf_project_id", "is", null)
        .order("created_date", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        logError("fetchBWFOrders", error);
        break;
      }
      rows = rows.concat(data ?? []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    // Batch-resolve products, factories, and projects.
    const productIds = [...new Set(rows.map((r: any) => r.product_id).filter(Boolean))];
    const factoryIds = [...new Set(rows.map((r: any) => r.factory_id).filter(Boolean))];
    const projectIds = [...new Set(rows.map((r: any) => r.bwf_project_id).filter(Boolean))];

    const [prodRes, facRes, projRes] = await Promise.all([
      productIds.length
        ? supabase.from("bwf_products").select("id, display").in("id", productIds)
        : Promise.resolve({ data: [] as any[] }),
      factoryIds.length
        ? supabase.from("factories").select("id, factory_name, display_name").in("id", factoryIds)
        : Promise.resolve({ data: [] as any[] }),
      projectIds.length
        ? supabase.from("bwf_projects").select("id, project_code, project_name, main_pm, main_pm_id").in("id", projectIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const prodMap = new Map<string, string>(
      (prodRes.data ?? []).map((p: any) => [p.id, p.display as string]),
    );
    const facMap = new Map<string, string>(
      (facRes.data ?? []).map((f: any) => [f.id, (f.factory_name || f.display_name) as string]),
    );
    const projMap = new Map<string, any>(
      (projRes.data ?? []).map((p: any) => [p.id, p]),
    );

    // Resolve PM names from staff for projects that have a main_pm_id.
    const pmIds = [
      ...new Set((projRes.data ?? []).map((p: any) => p.main_pm_id).filter(Boolean)),
    ];
    let pmMap = new Map<string, string>();
    if (pmIds.length) {
      const { data: staffRows } = await supabase.from("staff").select("id, name").in("id", pmIds);
      pmMap = new Map((staffRows ?? []).map((s: any) => [s.id, s.name]));
    }

    return rows.map((r: any) => {
      const proj = r.bwf_project_id ? projMap.get(r.bwf_project_id) : null;
      const pmName = proj?.main_pm_id ? pmMap.get(proj.main_pm_id) || proj.main_pm || null : proj?.main_pm || null;
      return {
        id: r.id,
        project_id: r.bwf_project_id || r.bwf_pitching_id || null,
        project_code: proj?.project_code || null,
        project_name: proj?.project_name || null,
        pm_name: pmName,
        product_name: r.product_id ? prodMap.get(r.product_id) || null : null,
        quantity: r.quantity,
        factory_name: r.factory_id ? facMap.get(r.factory_id) || null : null,
        est_delivery_date: r.site_arrival_date_est,
        est_installation_date: r.complete_installation_date_est,
        actual_installation_date: r.complete_installation_date,
        status: r.o_order_status,
      };
    });
  }, [], "fetchBWFOrders");
}

// ─── BWF ORDER DIALOG (create / edit) ─────────────────────
// Single order row, raw columns — used to prefill the Edit Order dialog.
export interface BWFOrderDetail {
  id: string;
  bwf_pitching_id: string | null;
  bwf_project_id: string | null;
  product_id: string | null;
  factory_id: string | null;
  quantity: number | null;
  o_order_status: string | null;
  o_delivery_target: string | null;
  installation_team_id: string | null;
  installer_needed: string | null;
  production_start_date: string | null;
  production_finish_date_est: string | null;
  production_finish_date: string | null;
  site_arrival_date_est: string | null;
  site_arrival_date: string | null;
  complete_installation_date_est: string | null;
  complete_installation_date: string | null;
  remarks: string | null;
}

export async function fetchBWFOrderDetail(orderId: string): Promise<BWFOrderDetail | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwf_orders")
      .select(`id, bwf_pitching_id, bwf_project_id, product_id, factory_id, quantity,
        o_order_status, o_delivery_target, installation_team_id, installer_needed,
        production_start_date, production_finish_date_est, production_finish_date,
        site_arrival_date_est, site_arrival_date,
        complete_installation_date_est, complete_installation_date, remarks`)
      .eq("id", orderId)
      .maybeSingle();
    if (error) {
      logError("fetchBWFOrderDetail", error);
      return null;
    }
    return (data as BWFOrderDetail) ?? null;
  }, null, "fetchBWFOrderDetail");
}

// Product options (bwf_products) for the order dialog.
export async function fetchBWFProductOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("bwf_products")
      .select("id, display")
      .order("display", { ascending: true, nullsFirst: false });
    if (error) { logError("fetchBWFProductOptions", error); return []; }
    const products = data ?? [];
    const productIds = products.map((p: any) => p.id);
    const ptMap = await resolveBwfJunctionProductTypesForProducts(productIds);
    return products.map((p: any) => ({
      id: p.id,
      label: p.display || "未命名產品",
      sublabel: ptMap.get(p.id) || undefined,
    }));
  }, [], "fetchBWFProductOptions");
}

async function fetchBwfProductIdsForType(productTypeId: string): Promise<string[]> {
  const ids = new Set<string>();
  const [{ data: direct }, { data: junction }] = await Promise.all([
    supabase.from("bwf_products").select("id").eq("product_types_id", productTypeId),
    supabase
      .from("bwf_product_product_types")
      .select("product_id")
      .eq("product_type_id", productTypeId),
  ]);
  for (const row of direct ?? []) {
    if (row.id) ids.add(row.id);
  }
  for (const row of junction ?? []) {
    if (row.product_id) ids.add(row.product_id);
  }
  return [...ids];
}

/** Search product types for the order dialog's two-level product picker. */
export async function searchBWFProductTypeOptions(
  searchTerm: string = "",
  limit: number = 50,
): Promise<LinkOption[]> {
  return safeQuery(async () => {
    let query = supabase
      .from("product_types")
      .select("id, display")
      .order("display", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (searchTerm) {
      query = query.ilike("display", `%${searchTerm}%`);
    }
    const { data, error } = await query;
    if (error) { logError("searchBWFProductTypeOptions", error); return []; }
    return (data ?? []).map((t: any) => ({
      id: t.id,
      label: t.display || "未命名類型",
    }));
  }, [], "searchBWFProductTypeOptions");
}

/** Search products scoped to a product type (direct FK + junction). */
export async function searchBWFProductOptionsByType(
  productTypeId: string,
  searchTerm: string = "",
  limit: number = 50,
): Promise<LinkOption[]> {
  if (!productTypeId) return [];
  return safeQuery(async () => {
    const productIds = await fetchBwfProductIdsForType(productTypeId);
    if (productIds.length === 0) return [];

    let query = supabase
      .from("bwf_products")
      .select("id, display")
      .in("id", productIds)
      .order("display", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (searchTerm) {
      query = query.ilike("display", `%${searchTerm}%`);
    }
    const { data, error } = await query;
    if (error) { logError("searchBWFProductOptionsByType", error); return []; }
    return (data ?? []).map((p: any) => ({
      id: p.id,
      label: p.display || "未命名產品",
    }));
  }, [], "searchBWFProductOptionsByType");
}

/** Resolve product type UUID for a product (for edit prefills). */
export async function fetchBWFProductTypeForProduct(productId: string): Promise<string | null> {
  return safeQuery(async () => {
    const { data: product } = await supabase
      .from("bwf_products")
      .select("product_types_id")
      .eq("id", productId)
      .maybeSingle();
    if (product?.product_types_id) return product.product_types_id;

    const { data: junction } = await supabase
      .from("bwf_product_product_types")
      .select("product_type_id")
      .eq("product_id", productId)
      .limit(1)
      .maybeSingle();
    return junction?.product_type_id ?? null;
  }, null, "fetchBWFProductTypeForProduct");
}

export async function fetchBWFProductLabel(productId: string): Promise<string> {
  return safeQuery(async () => {
    const { data } = await supabase
      .from("bwf_products")
      .select("display")
      .eq("id", productId)
      .maybeSingle();
    return data?.display || "";
  }, "", "fetchBWFProductLabel");
}

export async function fetchBWFProductTypeLabel(typeId: string): Promise<string> {
  return safeQuery(async () => {
    const { data } = await supabase
      .from("product_types")
      .select("display")
      .eq("id", typeId)
      .maybeSingle();
    return data?.display || "";
  }, "", "fetchBWFProductTypeLabel");
}
/** Search factories for the order dialog picker. */
export async function searchFactoryOptions(searchTerm: string = "", limit: number = 50): Promise<LinkOption[]> {
  return safeQuery(async () => {
    let query = supabase
      .from("factories")
      .select("id, factory_name, display_name")
      .order("factory_name", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (searchTerm) {
      const q = `%${searchTerm}%`;
      query = query.or(`factory_name.ilike.${q},display_name.ilike.${q}`);
    }
    const { data, error } = await query;
    if (error) { logError("searchFactoryOptions", error); return []; }
    return (data ?? []).map((f: any) => ({
      id: f.id,
      label: f.factory_name || f.display_name || "未命名廠商",
      sublabel: f.display_name && f.display_name !== f.factory_name ? f.display_name : undefined,
    }));
  }, [], "searchFactoryOptions");
}

export async function fetchFactoryLabel(factoryId: string): Promise<string> {
  return safeQuery(async () => {
    const { data } = await supabase
      .from("factories")
      .select("factory_name, display_name")
      .eq("id", factoryId)
      .maybeSingle();
    return data?.factory_name || data?.display_name || "";
  }, "", "fetchFactoryLabel");
}

/** Verify pitching ↔ project alignment before saving an order. */
export async function verifyBWFOrderLinkAlignment(
  pitchingId: string | null,
  projectId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!pitchingId && !projectId) {
    return { ok: false, error: "請選擇項目或提案 Please select a project or pitching" };
  }
  if (pitchingId && projectId) {
    const linked = await fetchBWFProjectIdByPitching(pitchingId);
    if (!linked || linked.id !== projectId) {
      return { ok: false, error: "提案與項目不相符 Pitching and project are not aligned" };
    }
  }
  if (projectId && !pitchingId) {
    const linked = await fetchBWFPitchingIdByProject(projectId);
    if (!linked) {
      return { ok: false, error: "此項目沒有關聯提案 This project has no linked pitching" };
    }
  }
  return { ok: true };
}

export async function createBWFOrder(data: Record<string, any>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await adminFetch({ action: "create", table: "bwf_orders", data });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateBWFOrder(id: string, updates: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  try {
    return await adminFetch({ action: "update", table: "bwf_orders", id, updates });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
