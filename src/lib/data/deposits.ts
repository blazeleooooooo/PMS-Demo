import {
  supabase,
  safeQuery,
  logError,
  fetchAllRows,
  mapBatchesParallel,
} from "@/lib/data/_core";
import { toHkYmd } from "@/lib/date-utils";

export const REFUNDABLE_CONTRACT_TYPE_ID = "7c663cb6-aaf4-4378-9e69-211f16f545ac";

export type DepositSource = "BWA" | "BWF";

export interface DepositRow {
  id: string;
  bw_type: DepositSource;
  project_id: string | null;
  bwf_project_id: string | null;
  resolved_project_id: string;
  project_name: string | null;
  handover_date: string | null;
  pm_name: string | null;
  supplier_name: string | null;
  supplier_type_label: string | null;
  paid_amount: number;
  latest_payment_date: string | null;
  refunded_amount: number;
  latest_receive_date: string | null;
  disappear: boolean;
  pending_expense_ids: string[];
}

export interface DepositIncomeOption {
  id: string;
  income_amount: number | null;
  outstanding: number | null;
  invoice_number: string | null;
  type_display: string | null;
  created_date: string | null;
  receive_date: string | null;
  remark: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(id: string | null | undefined): id is string {
  return !!id && UUID_RE.test(id);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function relOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

interface ProjectLookup {
  id: string;
  project_name: string | null;
  handover_date: string | null;
  pm?: { name?: string } | { name?: string }[] | null;
}

interface SupplierLookup {
  id: string;
  display_name: string | null;
  chinese_name: string | null;
  name: string | null;
}

interface SupplierTypeLookup {
  id: string;
  chinese_display: string | null;
  display: string | null;
}

interface Acc {
  bw_type: DepositSource;
  project_id: string | null;
  bwf_project_id: string | null;
  paid_amount: number;
  latest_payment_date: string | null;
  refunded_amount: number;
  latest_receive_date: string | null;
  sort_date: string;
  expenses: Array<{
    id: string;
    paid_amount: number;
    disappear: boolean | null;
    supplier_id: string | null;
    n_supplier_type_id: string | null;
    created_date: string | null;
  }>;
}

function projectKey(bwType: DepositSource, projectId: string): string {
  return `${bwType}:${projectId}`;
}

function ensureAcc(
  map: Map<string, Acc>,
  bwType: DepositSource,
  projectId: string
): Acc {
  const key = projectKey(bwType, projectId);
  let acc = map.get(key);
  if (!acc) {
    acc = {
      bw_type: bwType,
      project_id: bwType === "BWA" ? projectId : null,
      bwf_project_id: bwType === "BWF" ? projectId : null,
      paid_amount: 0,
      latest_payment_date: null,
      refunded_amount: 0,
      latest_receive_date: null,
      sort_date: "",
      expenses: [],
    };
    map.set(key, acc);
  }
  return acc;
}

function bumpSort(acc: Acc, date: string | null) {
  if (date && date > acc.sort_date) acc.sort_date = date;
}

function maxYmd(current: string | null, incoming: string | null): string | null {
  const next = toHkYmd(incoming);
  if (!next) return current;
  if (!current) return next;
  return next > current ? next : current;
}

export async function fetchDepositRows(): Promise<DepositRow[]> {
  return safeQuery(
    async () => {
      const [{ data: expenses, error: expError }, { data: incomes, error: incError }] =
        await Promise.all([
          fetchAllRows(
            "expenses",
            "id, paid_amount, disappear, created_date, payment_date, project_id, bwf_project_id, supplier_id, n_supplier_type_id",
            (q) => q.eq("n_contract_type_id", REFUNDABLE_CONTRACT_TYPE_ID)
          ),
          fetchAllRows(
            "incomes",
            "id, payment_amount, created_date, receive_date, project_id, bwf_project_id",
            (q) => q.eq("n_contract_type_id", REFUNDABLE_CONTRACT_TYPE_ID)
          ),
        ]);

      if (expError) {
        logError("fetchDepositRows/expenses", expError);
        return [];
      }
      if (incError) {
        logError("fetchDepositRows/incomes", incError);
        return [];
      }

      const accMap = new Map<string, Acc>();
      const bwaIds = new Set<string>();
      const bwfIds = new Set<string>();
      const supplierIds = new Set<string>();
      const supplierTypeIds = new Set<string>();

      for (const exp of expenses) {
        const bwType: DepositSource | null = isUuid(exp.project_id)
          ? "BWA"
          : isUuid(exp.bwf_project_id)
            ? "BWF"
            : null;
        const projectId = bwType === "BWA" ? exp.project_id : exp.bwf_project_id;
        if (!bwType || !isUuid(projectId)) continue;

        if (bwType === "BWA") bwaIds.add(projectId);
        else bwfIds.add(projectId);
        if (isUuid(exp.supplier_id)) supplierIds.add(exp.supplier_id);
        if (isUuid(exp.n_supplier_type_id)) supplierTypeIds.add(exp.n_supplier_type_id);

        const acc = ensureAcc(accMap, bwType, projectId);
        acc.paid_amount += num(exp.paid_amount);
        acc.latest_payment_date = maxYmd(acc.latest_payment_date, exp.payment_date);
        bumpSort(acc, exp.created_date);
        acc.expenses.push({
          id: exp.id,
          paid_amount: num(exp.paid_amount),
          disappear: exp.disappear,
          supplier_id: exp.supplier_id,
          n_supplier_type_id: exp.n_supplier_type_id,
          created_date: exp.created_date,
        });
      }

      for (const inc of incomes) {
        const bwType: DepositSource | null = isUuid(inc.project_id)
          ? "BWA"
          : isUuid(inc.bwf_project_id)
            ? "BWF"
            : null;
        const projectId = bwType === "BWA" ? inc.project_id : inc.bwf_project_id;
        if (!bwType || !isUuid(projectId)) continue;

        if (bwType === "BWA") bwaIds.add(projectId);
        else bwfIds.add(projectId);

        const acc = ensureAcc(accMap, bwType, projectId);
        acc.refunded_amount += num(inc.payment_amount);
        acc.latest_receive_date = maxYmd(acc.latest_receive_date, inc.receive_date);
        bumpSort(acc, inc.created_date);
      }

      const [bwaProjects, bwfProjects, suppliers, supplierTypes] = await Promise.all([
        mapBatchesParallel([...bwaIds], 200, 4, async (batch) => {
          const { data, error } = await supabase
            .from("bwa_projects")
            .select(
              "id, project_name, handover_date, pm:staff!fk_bwa_projects_main_pm_id(name)"
            )
            .in("id", batch);
          if (error) {
            logError("fetchDepositRows/bwa_projects", error);
            return [] as ProjectLookup[];
          }
          return (data ?? []) as ProjectLookup[];
        }),
        mapBatchesParallel([...bwfIds], 200, 4, async (batch) => {
          const { data, error } = await supabase
            .from("bwf_projects")
            .select(
              "id, project_name, handover_date, pm:staff!fk_bwf_projects_main_pm_id(name)"
            )
            .in("id", batch);
          if (error) {
            logError("fetchDepositRows/bwf_projects", error);
            return [] as ProjectLookup[];
          }
          return (data ?? []) as ProjectLookup[];
        }),
        mapBatchesParallel([...supplierIds], 200, 4, async (batch) => {
          const { data, error } = await supabase
            .from("suppliers")
            .select("id, display_name, chinese_name, name")
            .in("id", batch);
          if (error) {
            logError("fetchDepositRows/suppliers", error);
            return [] as SupplierLookup[];
          }
          return (data ?? []) as SupplierLookup[];
        }),
        mapBatchesParallel([...supplierTypeIds], 200, 4, async (batch) => {
          const { data, error } = await supabase
            .from("supplier_types")
            .select("id, chinese_display, display")
            .in("id", batch);
          if (error) {
            logError("fetchDepositRows/supplier_types", error);
            return [] as SupplierTypeLookup[];
          }
          return (data ?? []) as SupplierTypeLookup[];
        }),
      ]);

      const projectMap = new Map<
        string,
        { project_name: string | null; handover_date: string | null; pm_name: string | null }
      >();
      for (const p of bwaProjects) {
        const pm = relOne(p.pm);
        projectMap.set(`BWA:${p.id}`, {
          project_name: p.project_name || "未命名項目",
          handover_date: p.handover_date || null,
          pm_name: pm?.name || null,
        });
      }
      for (const p of bwfProjects) {
        const pm = relOne(p.pm);
        projectMap.set(`BWF:${p.id}`, {
          project_name: p.project_name || "未命名項目",
          handover_date: p.handover_date || null,
          pm_name: pm?.name || null,
        });
      }

      const supplierMap = new Map<string, string>();
      for (const s of suppliers) {
        supplierMap.set(s.id, s.display_name || s.chinese_name || s.name || "未命名供應商");
      }
      const supplierTypeMap = new Map<string, string>();
      for (const t of supplierTypes) {
        supplierTypeMap.set(t.id, t.chinese_display || t.display || "-");
      }

      const rows: DepositRow[] = [];
      for (const [key, acc] of accMap) {
        const projectId = acc.project_id || acc.bwf_project_id;
        if (!projectId) continue;
        const project = projectMap.get(key);
        if (!project) continue;

        const expensesNewestFirst = [...acc.expenses].sort((a, b) =>
          (b.created_date || "").localeCompare(a.created_date || "")
        );
        const supplierExp = expensesNewestFirst.find((e) => e.supplier_id) ?? expensesNewestFirst[0];
        const pending_expense_ids = acc.expenses
          .filter((e) => e.disappear !== true)
          .map((e) => e.id);
        const incomeOnly = acc.expenses.length === 0;
        const disappear = incomeOnly || pending_expense_ids.length === 0;

        rows.push({
          id: key,
          bw_type: acc.bw_type,
          project_id: acc.project_id,
          bwf_project_id: acc.bwf_project_id,
          resolved_project_id: projectId,
          project_name: project.project_name,
          handover_date: project.handover_date,
          pm_name: project.pm_name,
          supplier_name: supplierExp?.supplier_id
            ? supplierMap.get(supplierExp.supplier_id) || null
            : null,
          supplier_type_label: supplierExp?.n_supplier_type_id
            ? supplierTypeMap.get(supplierExp.n_supplier_type_id) || null
            : null,
          paid_amount: acc.paid_amount,
          latest_payment_date: acc.latest_payment_date,
          refunded_amount: acc.refunded_amount,
          latest_receive_date: acc.latest_receive_date,
          disappear,
          pending_expense_ids,
        });
      }

      rows.sort((a, b) => {
        const da = a.handover_date || "";
        const db = b.handover_date || "";
        if (da !== db) return db.localeCompare(da);
        return (a.project_name || "").localeCompare(b.project_name || "", "zh-Hant");
      });

      return rows;
    },
    [],
    "fetchDepositRows"
  );
}

export async function fetchDepositConfirmIncomes(
  projectId: string,
  bwType: DepositSource
): Promise<DepositIncomeOption[]> {
  if (!isUuid(projectId)) return [];
  const fk = bwType === "BWF" ? "bwf_project_id" : "project_id";
  return safeQuery(
    async () => {
      const { data, error } = await supabase
        .from("incomes")
        .select("id, income_amount, outstanding, invoice_number, type_display, created_date, receive_date, remark")
        .eq(fk, projectId)
        .eq("n_contract_type_id", REFUNDABLE_CONTRACT_TYPE_ID)
        .order("created_date", { ascending: false });
      if (error) {
        logError("fetchDepositConfirmIncomes", error);
        return [];
      }
      return (data ?? []) as DepositIncomeOption[];
    },
    [],
    "fetchDepositConfirmIncomes"
  );
}

export async function confirmDepositRefund(
  expenseIds: string[]
): Promise<{ error: string | null }> {
  const ids = expenseIds.filter(isUuid);
  if (ids.length === 0) return { error: "沒有可確認的支出記錄" };
  return safeQuery(
    async () => {
      const { error } = await supabase.from("expenses").update({ disappear: true }).in("id", ids);
      if (error) {
        logError("confirmDepositRefund", error);
        return { error: error.message };
      }
      return { error: null };
    },
    { error: "確認失敗" },
    "confirmDepositRefund"
  );
}
