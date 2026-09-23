/**
 * BR / 勞保更新 — recent suppliers that need document checks:
 * last-6-month expenses where a supplier has any project with
 * installment_amount ≥ $150,000, or more than one project.
 */
import { buildStorageObjectKey } from "@/lib/storage-utils";
import {
  SUPPLIER_FILE_TYPE_BR,
  SUPPLIER_FILE_TYPE_INSURANCE,
  isSupplierFileNotExpired,
} from "@/lib/expense-amount-rules";
import { supabase, safeQuery, logError } from "./_core";

export const BR_LABOUR_AMOUNT_THRESHOLD = 150_000;
export const BR_LABOUR_LOOKBACK_MONTHS = 6;

export type BrLabourDocKind = "br" | "labour_insurance";

export interface BrLabourSupplierRow {
  supplier_id: string;
  supplier_name: string | null;
  chinese_name: string | null;
  status: string | null;
  project_count: number;
  total_installment_amount: number;
  max_project_amount: number;
  has_large_project: boolean;
  latest_expense_date: string | null;
  latest_project_id: string | null;
  latest_project_kind: "bwa" | "bwf" | null;
  latest_project_name: string | null;
  latest_project_pm_name: string | null;
  br_expiry_date: string | null;
  br_file_url: string | null;
  labour_insurance_expiry_date: string | null;
  labour_insurance_file_url: string | null;
  br_valid: boolean;
  labour_insurance_valid: boolean;
}

export interface BrLabourUpdateSummary {
  supplier_count: number;
  br_expired_or_missing: number;
  labour_expired_or_missing: number;
  either_needs_update: number;
  total_installment_amount: number;
}

export interface BrLabourUpdateData {
  rows: BrLabourSupplierRow[];
  summary: BrLabourUpdateSummary;
}

export interface UploadSupplierBrLabourInput {
  supplierId: string;
  kind: BrLabourDocKind;
  file: File;
  fileName: string;
  expiryDate: string;
  institution?: string;
  codeNumber?: string;
  createdById?: string | null;
}

type ProjectAgg = {
  amount: number;
  latest: string | null;
};

function maxDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function lookbackIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - BR_LABOUR_LOOKBACK_MONTHS);
  return d.toISOString();
}

function projectKey(projectId: string | null, bwfProjectId: string | null): string | null {
  if (projectId) return `bwa:${projectId}`;
  if (bwfProjectId) return `bwf:${bwfProjectId}`;
  return null;
}

function parseProjectKey(
  key: string | null
): { kind: "bwa" | "bwf"; id: string } | null {
  if (!key) return null;
  if (key.startsWith("bwa:")) return { kind: "bwa", id: key.slice(4) };
  if (key.startsWith("bwf:")) return { kind: "bwf", id: key.slice(4) };
  return null;
}

async function fetchRecentExpenses(): Promise<
  {
    supplier_id: string;
    project_id: string | null;
    bwf_project_id: string | null;
    installment_amount: number | null;
    created_date: string | null;
  }[]
> {
  const PAGE = 1000;
  const since = lookbackIso();
  const all: {
    supplier_id: string;
    project_id: string | null;
    bwf_project_id: string | null;
    installment_amount: number | null;
    created_date: string | null;
  }[] = [];
  let from = 0;
  let more = true;
  while (more) {
    const { data, error } = await supabase
      .from("expenses")
      .select("supplier_id, project_id, bwf_project_id, installment_amount, created_date")
      .not("supplier_id", "is", null)
      .or("project_id.not.is.null,bwf_project_id.not.is.null")
      .gte("created_date", since)
      .range(from, from + PAGE - 1);
    if (error) {
      logError("fetchBrLabourUpdate/expenses", error);
      break;
    }
    all.push(...((data ?? []) as typeof all));
    more = (data?.length ?? 0) === PAGE;
    from += PAGE;
  }
  return all;
}

async function fetchSupplierNames(
  ids: string[]
): Promise<Map<string, { name: string | null; chinese_name: string | null; status: string | null }>> {
  const map = new Map<
    string,
    { name: string | null; chinese_name: string | null; status: string | null }
  >();
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, display_name, name, chinese_name, status")
      .in("id", chunk);
    if (error) {
      logError("fetchBrLabourUpdate/suppliers", error);
      continue;
    }
    for (const row of data ?? []) {
      map.set(row.id as string, {
        name: (row.display_name as string | null) || (row.name as string | null),
        chinese_name: (row.chinese_name as string | null) ?? null,
        status: (row.status as string | null) ?? null,
      });
    }
  }
  return map;
}

async function fetchLatestDocMeta(
  supplierIds: string[]
): Promise<
  Map<
    string,
    {
      br_expiry_date: string | null;
      br_file_url: string | null;
      labour_insurance_expiry_date: string | null;
      labour_insurance_file_url: string | null;
    }
  >
> {
  const result = new Map<
    string,
    {
      br_expiry_date: string | null;
      br_file_url: string | null;
      labour_insurance_expiry_date: string | null;
      labour_insurance_file_url: string | null;
    }
  >();
  for (const id of supplierIds) {
    result.set(id, {
      br_expiry_date: null,
      br_file_url: null,
      labour_insurance_expiry_date: null,
      labour_insurance_file_url: null,
    });
  }
  if (supplierIds.length === 0) return result;

  const CHUNK = 200;
  for (let i = 0; i < supplierIds.length; i += CHUNK) {
    const chunk = supplierIds.slice(i, i + CHUNK);
    let from = 0;
    let more = true;
    while (more) {
      const { data, error } = await supabase
        .from("supplier_files")
        .select("supplier_id, type_id, expiry_date, file, created_date")
        .in("supplier_id", chunk)
        .in("type_id", [SUPPLIER_FILE_TYPE_BR, SUPPLIER_FILE_TYPE_INSURANCE])
        .range(from, from + 999);
      if (error) {
        logError("fetchBrLabourUpdate/files", error);
        break;
      }
      for (const row of data ?? []) {
        const sid = row.supplier_id as string | null;
        if (!sid) continue;
        const slot = result.get(sid);
        if (!slot) continue;
        const expiry = (row.expiry_date as string | null) ?? null;
        const fileUrl = (row.file as string | null) ?? null;
        if (row.type_id === SUPPLIER_FILE_TYPE_BR) {
          if (!slot.br_expiry_date || (expiry && expiry > slot.br_expiry_date)) {
            slot.br_expiry_date = expiry;
            slot.br_file_url = fileUrl;
          }
        } else if (row.type_id === SUPPLIER_FILE_TYPE_INSURANCE) {
          if (
            !slot.labour_insurance_expiry_date ||
            (expiry && expiry > slot.labour_insurance_expiry_date)
          ) {
            slot.labour_insurance_expiry_date = expiry;
            slot.labour_insurance_file_url = fileUrl;
          }
        }
      }
      more = (data?.length ?? 0) === 1000;
      from += 1000;
    }
  }
  return result;
}

async function fetchProjectMeta(
  bwaIds: string[],
  bwfIds: string[]
): Promise<
  Map<
    string,
    { name: string | null; main_pm_id: string | null }
  >
> {
  const map = new Map<string, { name: string | null; main_pm_id: string | null }>();
  const CHUNK = 200;

  const load = async (table: "bwa_projects" | "bwf_projects", ids: string[]) => {
    if (ids.length === 0) return;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from(table)
        .select("id, project_name, project_code, main_pm_id")
        .in("id", chunk);
      if (error) {
        logError(`fetchBrLabourUpdate/${table}`, error);
        continue;
      }
      for (const row of data ?? []) {
        const name =
          (row.project_name as string | null) ||
          (row.project_code as string | null) ||
          null;
        map.set(row.id as string, {
          name,
          main_pm_id: (row.main_pm_id as string | null) ?? null,
        });
      }
    }
  };

  await Promise.all([load("bwa_projects", bwaIds), load("bwf_projects", bwfIds)]);
  return map;
}

async function fetchStaffNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const CHUNK = 200;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("staff")
      .select("id, name, full_name")
      .in("id", chunk);
    if (error) {
      logError("fetchBrLabourUpdate/staff", error);
      continue;
    }
    for (const row of data ?? []) {
      const name =
        (row.name as string | null) || (row.full_name as string | null) || null;
      if (name) map.set(row.id as string, name);
    }
  }
  return map;
}

export async function fetchBrLabourUpdateList(): Promise<BrLabourUpdateData> {
  return safeQuery(
    async () => {
      const expenses = await fetchRecentExpenses();
      const bySupplier = new Map<
        string,
        { projects: Map<string, ProjectAgg>; latest: string | null }
      >();

      for (const e of expenses) {
        const sid = e.supplier_id;
        if (!sid) continue;
        const pKey = projectKey(e.project_id, e.bwf_project_id);
        if (!pKey) continue;
        let bucket = bySupplier.get(sid);
        if (!bucket) {
          bucket = { projects: new Map(), latest: null };
          bySupplier.set(sid, bucket);
        }
        const amt = Number(e.installment_amount) || 0;
        const prev = bucket.projects.get(pKey) ?? { amount: 0, latest: null };
        prev.amount += amt;
        prev.latest = maxDate(prev.latest, e.created_date);
        bucket.projects.set(pKey, prev);
        bucket.latest = maxDate(bucket.latest, e.created_date);
      }

      const qualifyingIds: string[] = [];
      const metrics = new Map<
        string,
        {
          project_count: number;
          total_installment_amount: number;
          max_project_amount: number;
          has_large_project: boolean;
          latest_expense_date: string | null;
          latest_project_key: string | null;
        }
      >();

      for (const [sid, bucket] of bySupplier) {
        let total = 0;
        let maxAmt = 0;
        let latestProjectKey: string | null = null;
        let latestProjectDate: string | null = null;
        let latestProjectAmt = 0;
        for (const [pKey, p] of bucket.projects) {
          total += p.amount;
          if (p.amount > maxAmt) maxAmt = p.amount;
          const newer =
            !latestProjectDate ||
            (p.latest && p.latest > latestProjectDate) ||
            (p.latest === latestProjectDate && p.amount > latestProjectAmt);
          if (newer && p.latest) {
            latestProjectKey = pKey;
            latestProjectDate = p.latest;
            latestProjectAmt = p.amount;
          }
        }
        const projectCount = bucket.projects.size;
        const hasLarge = maxAmt >= BR_LABOUR_AMOUNT_THRESHOLD;
        if (!hasLarge && projectCount <= 1) continue;
        qualifyingIds.push(sid);
        metrics.set(sid, {
          project_count: projectCount,
          total_installment_amount: total,
          max_project_amount: maxAmt,
          has_large_project: hasLarge,
          latest_expense_date: bucket.latest,
          latest_project_key: latestProjectKey,
        });
      }

      const bwaIds: string[] = [];
      const bwfIds: string[] = [];
      for (const m of metrics.values()) {
        const parsed = parseProjectKey(m.latest_project_key);
        if (!parsed) continue;
        if (parsed.kind === "bwa") bwaIds.push(parsed.id);
        else bwfIds.push(parsed.id);
      }

      const [names, docs, projectMeta] = await Promise.all([
        fetchSupplierNames(qualifyingIds),
        fetchLatestDocMeta(qualifyingIds),
        fetchProjectMeta(bwaIds, bwfIds),
      ]);

      const pmIds = [...projectMeta.values()]
        .map((p) => p.main_pm_id)
        .filter((id): id is string => !!id);
      const staffNames = await fetchStaffNames(pmIds);

      const rows: BrLabourSupplierRow[] = qualifyingIds.map((id) => {
        const m = metrics.get(id)!;
        const n = names.get(id);
        const d = docs.get(id)!;
        const parsed = parseProjectKey(m.latest_project_key);
        const proj = parsed ? projectMeta.get(parsed.id) : undefined;
        return {
          supplier_id: id,
          supplier_name: n?.name ?? null,
          chinese_name: n?.chinese_name ?? null,
          status: n?.status ?? null,
          project_count: m.project_count,
          total_installment_amount: m.total_installment_amount,
          max_project_amount: m.max_project_amount,
          has_large_project: m.has_large_project,
          latest_expense_date: m.latest_expense_date,
          latest_project_id: parsed?.id ?? null,
          latest_project_kind: parsed?.kind ?? null,
          latest_project_name: proj?.name ?? null,
          latest_project_pm_name: proj?.main_pm_id
            ? staffNames.get(proj.main_pm_id) ?? null
            : null,
          br_expiry_date: d.br_expiry_date,
          br_file_url: d.br_file_url,
          labour_insurance_expiry_date: d.labour_insurance_expiry_date,
          labour_insurance_file_url: d.labour_insurance_file_url,
          br_valid: isSupplierFileNotExpired(d.br_expiry_date),
          labour_insurance_valid: isSupplierFileNotExpired(d.labour_insurance_expiry_date),
        };
      });

      rows.sort((a, b) => {
        const aNeed =
          (!a.br_valid ? 2 : 0) + (!a.labour_insurance_valid ? 2 : 0) + (a.has_large_project ? 1 : 0);
        const bNeed =
          (!b.br_valid ? 2 : 0) + (!b.labour_insurance_valid ? 2 : 0) + (b.has_large_project ? 1 : 0);
        if (bNeed !== aNeed) return bNeed - aNeed;
        return b.total_installment_amount - a.total_installment_amount;
      });

      const summary: BrLabourUpdateSummary = {
        supplier_count: rows.length,
        br_expired_or_missing: rows.filter((r) => !r.br_valid).length,
        labour_expired_or_missing: rows.filter((r) => !r.labour_insurance_valid).length,
        either_needs_update: rows.filter((r) => !r.br_valid || !r.labour_insurance_valid).length,
        total_installment_amount: rows.reduce((s, r) => s + r.total_installment_amount, 0),
      };

      return { rows, summary };
    },
    {
      rows: [],
      summary: {
        supplier_count: 0,
        br_expired_or_missing: 0,
        labour_expired_or_missing: 0,
        either_needs_update: 0,
        total_installment_amount: 0,
      },
    },
    "fetchBrLabourUpdateList",
    60_000
  );
}

export async function uploadSupplierBrLabourFile(
  input: UploadSupplierBrLabourInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const typeId =
      input.kind === "br" ? SUPPLIER_FILE_TYPE_BR : SUPPLIER_FILE_TYPE_INSURANCE;
    const defaultName = input.kind === "br" ? "商業登記證明" : "勞工保險";
    const typeName = input.kind === "br" ? "BR" : "Labour Insurance";

    if (!input.fileName.trim()) {
      return { success: false, error: "請填寫檔案名稱" };
    }
    if (!input.expiryDate) {
      return { success: false, error: "請填寫到期日" };
    }

    const filePath = buildStorageObjectKey(input.supplierId, input.file.name);
    const { error: uploadError } = await supabase.storage
      .from("supplier-files")
      .upload(filePath, input.file);
    if (uploadError) {
      return { success: false, error: `上傳失敗: ${uploadError.message}` };
    }

    const { data: publicUrlData } = supabase.storage
      .from("supplier-files")
      .getPublicUrl(filePath);

    const now = new Date().toISOString();
    const record: Record<string, unknown> = {
      supplier_id: input.supplierId,
      file_name: input.fileName.trim() || defaultName,
      type_name: typeName,
      type_id: typeId,
      code_number: input.codeNumber?.trim() || null,
      expiry_date: input.expiryDate,
      institution:
        input.institution?.trim() ||
        (input.kind === "br" ? "稅務局" : null),
      file: publicUrlData.publicUrl,
      created_date: now,
      modified_date: now,
    };
    if (input.createdById) {
      record.created_by_id = input.createdById;
    }

    const { error: insertError } = await supabase.from("supplier_files").insert(record);
    if (insertError) {
      return { success: false, error: `儲存失敗: ${insertError.message}` };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logError("uploadSupplierBrLabourFile", err);
    return { success: false, error: message };
  }
}
