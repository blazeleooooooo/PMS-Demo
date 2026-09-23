/**
 * BNI collaboration projects — expenses whose supplier carries the BNI tag
 * (nos_supplier_tags id below), rolled up as project × supplier rows.
 */
import { supabase, safeQuery, logError, mapBatchesParallel } from "./_core";

/** Fixed nos_supplier_tags.id for tag_name = BNI */
export const BNI_SUPPLIER_TAG_ID = "0094d383-e639-417c-8f23-0281c5d58201";

export type BniEntity = "BWA" | "BWF";

export interface BniProjectRow {
  id: string;
  entity: BniEntity;
  project_id: string;
  project_code: string | null;
  project_name: string | null;
  customer_name: string | null;
  status: string | null;
  pm_name: string | null;
  /** expenses.n_supplier_type_id */
  expense_category_id: string | null;
  /** supplier_types display label */
  expense_category_name: string | null;
  supplier_id: string;
  supplier_name: string | null;
  expense_count: number;
  installment_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  latest_payment_date: string | null;
}

export interface BniProjectsSummary {
  project_count: number;
  supplier_count: number;
  expense_count: number;
  installment_total: number;
  paid_total: number;
  outstanding_total: number;
}

export interface BniProjectsData {
  rows: BniProjectRow[];
  summary: BniProjectsSummary;
  tag_name: string;
}

type Agg = {
  entity: BniEntity;
  project_id: string;
  supplier_id: string;
  expense_category_id: string | null;
  expense_count: number;
  installment_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  latest_payment_date: string | null;
};

function pairKey(
  entity: BniEntity,
  projectId: string,
  supplierId: string,
  categoryId: string | null
): string {
  return `${entity}:${projectId}:${supplierId}:${categoryId ?? "_"}`;
}

function maxDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

async function fetchTaggedSupplierIds(tagId: string): Promise<string[]> {
  const ids: string[] = [];
  const PAGE = 1000;
  let from = 0;
  let more = true;
  while (more) {
    const { data, error } = await supabase
      .from("supplier_supplier_tags")
      .select("supplier_id")
      .eq("supplier_tag_id", tagId)
      .range(from, from + PAGE - 1);
    if (error) {
      logError("fetchBniProjects/taggedSuppliers", error);
      break;
    }
    for (const row of data ?? []) {
      if (row.supplier_id) ids.push(row.supplier_id as string);
    }
    more = (data?.length ?? 0) === PAGE;
    from += PAGE;
  }
  return [...new Set(ids)];
}

async function fetchExpensesForSuppliers(supplierIds: string[]): Promise<any[]> {
  const PAGE = 1000;
  const CHUNK = 200;
  const all: any[] = [];
  for (let i = 0; i < supplierIds.length; i += CHUNK) {
    const chunk = supplierIds.slice(i, i + CHUNK);
    let page = 0;
    let more = true;
    while (more) {
      const from = page * PAGE;
      const { data, error } = await supabase
        .from("expenses")
        .select(
          "supplier_id, project_id, bwf_project_id, n_supplier_type_id, installment_amount, paid_amount, outstanding, payment_date"
        )
        .in("supplier_id", chunk)
        .or("project_id.not.is.null,bwf_project_id.not.is.null")
        .range(from, from + PAGE - 1);
      if (error) {
        logError("fetchBniProjects/expenses", error);
        break;
      }
      all.push(...(data ?? []));
      more = (data?.length ?? 0) === PAGE;
      page++;
    }
  }
  return all;
}

type ProjectMeta = {
  project_code: string | null;
  project_name: string | null;
  customer_name: string | null;
  status: string | null;
  pm_name: string | null;
};

type ProjectMetaRow = {
  id: string;
  project_code: string | null;
  project_name: string | null;
  status: string | null;
  real_customer_display_name: string | null;
  real_customer_name: string | null;
  cust: { company_name?: string; customer_name?: string } | null;
  pm: { name?: string } | null;
};

function projectMetaFromRow(p: ProjectMetaRow): ProjectMeta {
  return {
    project_code: p.project_code ?? null,
    project_name: p.project_name ?? null,
    customer_name:
      p.real_customer_display_name ||
      p.real_customer_name ||
      p.cust?.company_name ||
      p.cust?.customer_name ||
      null,
    status: p.status ?? null,
    pm_name: p.pm?.name ?? null,
  };
}

async function fetchBwaMeta(ids: string[]): Promise<Map<string, ProjectMeta>> {
  const map = new Map<string, ProjectMeta>();
  if (ids.length === 0) return map;
  const rows = await mapBatchesParallel(ids, 200, 4, async (batch) => {
    const { data, error } = await supabase
      .from("bwa_projects")
      .select(
        `id, project_code, project_name, status,
         real_customer_display_name, real_customer_name,
         cust:customers!fk_bwa_projects_customer_id(company_name, customer_name),
         pm:staff!fk_bwa_projects_main_pm_id(name)`
      )
      .in("id", batch);
    if (error) {
      logError("fetchBniProjects/bwaMeta", error);
      return [] as ProjectMetaRow[];
    }
    return (data ?? []) as unknown as ProjectMetaRow[];
  });
  for (const p of rows) {
    map.set(p.id, projectMetaFromRow(p));
  }
  return map;
}

async function fetchBwfMeta(ids: string[]): Promise<Map<string, ProjectMeta>> {
  const map = new Map<string, ProjectMeta>();
  if (ids.length === 0) return map;
  const rows = await mapBatchesParallel(ids, 200, 4, async (batch) => {
    const { data, error } = await supabase
      .from("bwf_projects")
      .select(
        `id, project_code, project_name, status,
         real_customer_display_name, real_customer_name,
         cust:customers!fk_bwf_projects_customer_id(company_name, customer_name),
         pm:staff!fk_bwf_projects_main_pm_id(name)`
      )
      .in("id", batch);
    if (error) {
      logError("fetchBniProjects/bwfMeta", error);
      return [] as ProjectMetaRow[];
    }
    return (data ?? []) as unknown as ProjectMetaRow[];
  });
  for (const p of rows) {
    map.set(p.id, projectMetaFromRow(p));
  }
  return map;
}

async function fetchSupplierNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  type SupplierNameRow = { id: string; display_name: string | null; name: string | null };
  const rows = await mapBatchesParallel(ids, 200, 4, async (batch) => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, display_name, name")
      .in("id", batch);
    if (error) {
      logError("fetchBniProjects/suppliers", error);
      return [] as SupplierNameRow[];
    }
    return (data ?? []) as unknown as SupplierNameRow[];
  });
  for (const s of rows) {
    map.set(s.id, s.display_name || s.name || "");
  }
  return map;
}

async function fetchSupplierTypeNames(
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  type TypeRow = {
    id: string;
    display: string | null;
    chinese_display: string | null;
  };
  const rows = await mapBatchesParallel(ids, 200, 4, async (batch) => {
    const { data, error } = await supabase
      .from("supplier_types")
      .select("id, display, chinese_display")
      .in("id", batch);
    if (error) {
      logError("fetchBniProjects/supplierTypes", error);
      return [] as TypeRow[];
    }
    return (data ?? []) as unknown as TypeRow[];
  });
  for (const t of rows) {
    map.set(t.id, t.chinese_display || t.display || "");
  }
  return map;
}

export async function fetchBniProjects(
  tagId: string = BNI_SUPPLIER_TAG_ID
): Promise<BniProjectsData> {
  const empty: BniProjectsData = {
    rows: [],
    summary: {
      project_count: 0,
      supplier_count: 0,
      expense_count: 0,
      installment_total: 0,
      paid_total: 0,
      outstanding_total: 0,
    },
    tag_name: "BNI",
  };

  return safeQuery(async () => {
    const [{ data: tagRow }, supplierIds] = await Promise.all([
      supabase
        .from("nos_supplier_tags")
        .select("tag_name")
        .eq("id", tagId)
        .maybeSingle(),
      fetchTaggedSupplierIds(tagId),
    ]);

    const tag_name = (tagRow?.tag_name as string) || "BNI";
    if (supplierIds.length === 0) {
      return { ...empty, tag_name };
    }

    const expenses = await fetchExpensesForSuppliers(supplierIds);
    const aggs = new Map<string, Agg>();

    for (const e of expenses) {
      const supplierId = e.supplier_id as string | null;
      if (!supplierId) continue;

      // Attribute once: BWA preferred when both FKs set
      let entity: BniEntity | null = null;
      let projectId: string | null = null;
      if (e.project_id) {
        entity = "BWA";
        projectId = e.project_id as string;
      } else if (e.bwf_project_id) {
        entity = "BWF";
        projectId = e.bwf_project_id as string;
      }
      if (!entity || !projectId) continue;

      const installment = Number(e.installment_amount) || 0;
      const paid = Number(e.paid_amount) || 0;
      const outstanding =
        e.outstanding != null && e.outstanding !== ""
          ? Number(e.outstanding) || 0
          : Math.max(0, installment - paid);
      const paymentDate = e.payment_date
        ? String(e.payment_date).slice(0, 10)
        : null;
      const categoryId = (e.n_supplier_type_id as string | null) || null;

      const key = pairKey(entity, projectId, supplierId, categoryId);
      const existing = aggs.get(key);
      if (existing) {
        existing.expense_count += 1;
        existing.installment_amount += installment;
        existing.paid_amount += paid;
        existing.outstanding_amount += outstanding;
        existing.latest_payment_date = maxDate(
          existing.latest_payment_date,
          paymentDate
        );
      } else {
        aggs.set(key, {
          entity,
          project_id: projectId,
          supplier_id: supplierId,
          expense_category_id: categoryId,
          expense_count: 1,
          installment_amount: installment,
          paid_amount: paid,
          outstanding_amount: outstanding,
          latest_payment_date: paymentDate,
        });
      }
    }

    const bwaIds = [
      ...new Set(
        [...aggs.values()]
          .filter((a) => a.entity === "BWA")
          .map((a) => a.project_id)
      ),
    ];
    const bwfIds = [
      ...new Set(
        [...aggs.values()]
          .filter((a) => a.entity === "BWF")
          .map((a) => a.project_id)
      ),
    ];
    const usedSupplierIds = [
      ...new Set([...aggs.values()].map((a) => a.supplier_id)),
    ];
    const categoryIds = [
      ...new Set(
        [...aggs.values()]
          .map((a) => a.expense_category_id)
          .filter((id): id is string => !!id)
      ),
    ];

    const [bwaMeta, bwfMeta, supplierNames, categoryNames] = await Promise.all([
      fetchBwaMeta(bwaIds),
      fetchBwfMeta(bwfIds),
      fetchSupplierNames(usedSupplierIds),
      fetchSupplierTypeNames(categoryIds),
    ]);

    const rows: BniProjectRow[] = [...aggs.values()].map((a) => {
      const meta =
        a.entity === "BWA" ? bwaMeta.get(a.project_id) : bwfMeta.get(a.project_id);
      return {
        id: pairKey(
          a.entity,
          a.project_id,
          a.supplier_id,
          a.expense_category_id
        ),
        entity: a.entity,
        project_id: a.project_id,
        project_code: meta?.project_code ?? null,
        project_name: meta?.project_name ?? null,
        customer_name: meta?.customer_name ?? null,
        status: meta?.status ?? null,
        pm_name: meta?.pm_name ?? null,
        expense_category_id: a.expense_category_id,
        expense_category_name: a.expense_category_id
          ? categoryNames.get(a.expense_category_id) ?? null
          : null,
        supplier_id: a.supplier_id,
        supplier_name: supplierNames.get(a.supplier_id) ?? null,
        expense_count: a.expense_count,
        installment_amount: a.installment_amount,
        paid_amount: a.paid_amount,
        outstanding_amount: a.outstanding_amount,
        latest_payment_date: a.latest_payment_date,
      };
    });

    rows.sort((a, b) => {
      const da = a.latest_payment_date || "";
      const db = b.latest_payment_date || "";
      if (da !== db) return db.localeCompare(da);
      return (b.installment_amount || 0) - (a.installment_amount || 0);
    });

    const projectKeys = new Set(rows.map((r) => `${r.entity}:${r.project_id}`));
    const summary: BniProjectsSummary = {
      project_count: projectKeys.size,
      supplier_count: usedSupplierIds.length,
      expense_count: rows.reduce((s, r) => s + r.expense_count, 0),
      installment_total: rows.reduce((s, r) => s + r.installment_amount, 0),
      paid_total: rows.reduce((s, r) => s + r.paid_amount, 0),
      outstanding_total: rows.reduce((s, r) => s + r.outstanding_amount, 0),
    };

    return { rows, summary, tag_name };
  }, empty, "fetchBniProjects");
}
