import { fetchAllByFk, logError, safeQuery, supabase } from "@/lib/data/_core";
import {
  isProjectFilterUuid,
  type ProjectFilterExtra,
} from "@/lib/project-collection-site-filter";

const extraCache = new Map<string, ProjectFilterExtra>();

const EMPTY_EXTRA: ProjectFilterExtra = {
  start_date: null,
  handover_date: null,
  income_amount_sum: 0,
  payment_amount_sum: 0,
};

async function fetchProjectDates(
  table: "bwa_projects" | "bwf_projects",
  ids: string[],
): Promise<Map<string, { start_date: string | null; handover_date: string | null }>> {
  const out = new Map<string, { start_date: string | null; handover_date: string | null }>();
  const BATCH = 200;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from(table)
      .select("id, start_date, handover_date")
      .in("id", batch);
    if (error) {
      logError(`fetchProjectFilterExtras/${table}`, error);
      continue;
    }
    for (const row of data ?? []) {
      out.set(row.id, {
        start_date: row.start_date ?? null,
        handover_date: row.handover_date ?? null,
      });
    }
  }
  return out;
}

async function sumIncomeColumns(
  fkColumn: "project_id" | "bwf_project_id",
  ids: string[],
): Promise<Map<string, { income: number; payment: number }>> {
  const out = new Map<string, { income: number; payment: number }>();
  const BATCH = 200;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const rows = await fetchAllByFk(
      "incomes",
      `${fkColumn}, income_amount, payment_amount`,
      fkColumn,
      batch,
    );
    for (const row of rows) {
      const pid = row[fkColumn] as string | null;
      if (!pid) continue;
      const cur = out.get(pid) ?? { income: 0, payment: 0 };
      cur.income += Number(row.income_amount) || 0;
      cur.payment += Number(row.payment_amount) || 0;
      out.set(pid, cur);
    }
  }
  return out;
}

async function fetchMissingExtras(
  ids: string[],
): Promise<Map<string, ProjectFilterExtra>> {
  return safeQuery(async () => {
    const [bwaDates, bwfDates, bwaIncomes, bwfIncomes] = await Promise.all([
      fetchProjectDates("bwa_projects", ids),
      fetchProjectDates("bwf_projects", ids),
      sumIncomeColumns("project_id", ids),
      sumIncomeColumns("bwf_project_id", ids),
    ]);

    const out = new Map<string, ProjectFilterExtra>();
    for (const id of ids) {
      const dates = bwaDates.get(id) ?? bwfDates.get(id);
      const sums = bwaIncomes.get(id) ?? bwfIncomes.get(id);
      out.set(id, {
        start_date: dates?.start_date ?? null,
        handover_date: dates?.handover_date ?? null,
        income_amount_sum: sums?.income ?? 0,
        payment_amount_sum: sums?.payment ?? 0,
      });
    }
    return out;
  }, new Map(), "fetchProjectFilterExtras", 60_000);
}

/** Batch-fetch start/handover dates + income/payment sums. Cached per session. */
export async function fetchProjectFilterExtras(
  projectIds: string[],
): Promise<Map<string, ProjectFilterExtra>> {
  const unique = Array.from(new Set(projectIds.filter(isProjectFilterUuid)));
  const missing = unique.filter((id) => !extraCache.has(id));
  if (missing.length > 0) {
    const fetched = await fetchMissingExtras(missing);
    for (const id of missing) {
      extraCache.set(id, fetched.get(id) ?? { ...EMPTY_EXTRA });
    }
  }
  const out = new Map<string, ProjectFilterExtra>();
  for (const id of unique) {
    out.set(id, extraCache.get(id) ?? { ...EMPTY_EXTRA });
  }
  return out;
}
