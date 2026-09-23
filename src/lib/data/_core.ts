import { createClient } from "@/lib/supabase/client";

// Use the browser client which carries the authenticated session (cookies/tokens).
// The old plain `createClient(url, anonKey)` had no session, so RLS writes failed.
// Lazy-initialize to avoid SSR issues (module-level init may run on server).
let _supabase: ReturnType<typeof createClient> | null = null;
export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient();
  }
  return _supabase;
}
// For convenience, use a getter proxy (backwards-compatible with existing code)
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  },
});

// ─── ADMIN API HELPER (bypasses RLS via server-side service key) ──
export async function adminFetch(body: Record<string, any>): Promise<{ success: boolean; id?: string; error?: string }> {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Check content-type to prevent parsing HTML error pages as JSON
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    console.error("[adminFetch] Non-JSON response:", res.status, text.substring(0, 200));
    return { success: false, error: `伺服器錯誤 (${res.status}): 非 JSON 回應` };
  }

  if (!res.ok) {
    try {
      const errorData = await res.json();
      return { success: false, error: errorData.error || `伺服器錯誤 (${res.status})` };
    } catch {
      return { success: false, error: `伺服器錯誤 (${res.status})` };
    }
  }

  return res.json();
}

// ─── ERROR LOGGING HELPER ────────────────────────────────
export function logError(context: string, error: any) {
  console.error(`[data-service] ${context}:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

// ─── BUBBLE ID DETECTION ─────────────────────────────────
// Bubble IDs are long numeric strings, often with × separator
// e.g. "1685676189764×891066703637381100"
export function isBubbleId(value: string): boolean {
  // Matches strings that are purely digits, or digits×digits patterns
  return /^\d{10,}([×x]\d+)?$/.test(value.trim());
}

// ─── NETWORK SAFETY WRAPPER ──────────────────────────────
// Prevents "TypeError: Failed to fetch" from crashing the UI
// when Supabase is unreachable (paused project, offline, etc.)
// Also includes a 15-second timeout to prevent indefinite hangs.
export async function safeQuery<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string,
  timeoutMs: number = 15000,
): Promise<T> {
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`[safeQuery] ${context}: timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
    return result;
  } catch (err: any) {
    if (err?.message?.includes("timed out")) {
      console.warn(`[data-service] ${context}: Query timed out, using fallback data.`);
    } else if (err?.message?.includes("Failed to fetch") || err?.name === "TypeError") {
      console.warn(`[data-service] ${context}: Supabase unreachable, using fallback data.`);
    } else {
      logError(context, err);
    }
    return fallback;
  }
}

/** Run async work over ID batches with bounded parallelism. */
export async function mapBatchesParallel<T>(
  ids: string[],
  batchSize: number,
  concurrency: number,
  worker: (batch: string[]) => Promise<T[]>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }
  const out: T[] = [];
  for (let i = 0; i < batches.length; i += concurrency) {
    const slice = batches.slice(i, i + concurrency);
    const parts = await Promise.all(slice.map((batch) => worker(batch)));
    for (const part of parts) out.push(...part);
  }
  return out;
}

// ─── PROJECT-SCOPED ROW PAGINATOR ─────────────────────────────
// PostgREST caps every response at 1000 rows. Any aggregation that fetches
// child rows with a single `.in("project_id", batch)` query silently drops
// everything past the first 1000 once the table is large (incomes ~3.8k,
// expenses ~9.7k rows) — which made report totals undercount (e.g. a project's
// $10 expense vanished). This helper pages through EVERY matching row.
// `applyFilters` lets callers add extra predicates (e.g. .not(col,"is",null));
// the .range() pagination is always applied last.
export async function fetchAllByProject(
  table: string,
  columns: string,
  batch: string[],
  applyFilters?: (q: any) => any,
): Promise<any[]> {
  return fetchAllByFk(table, columns, "project_id", batch, applyFilters);
}

// Same paginator keyed on an arbitrary FK column — used for BWF children
// (incomes/expenses/project_bv link to bwf_projects via bwf_project_id).
export async function fetchAllByFk(
  table: string,
  columns: string,
  fkColumn: string,
  batch: string[],
  applyFilters?: (q: any) => any,
): Promise<any[]> {
  const PAGE = 1000;
  let all: any[] = [];
  let from = 0;
  let more = true;
  while (more) {
    let q = supabase.from(table).select(columns).in(fkColumn, batch);
    if (applyFilters) q = applyFilters(q);
    // Stable order is required: .range() without ORDER BY can overlap or
    // skip rows across pages, which inflates income/expense sums.
    const { data, error } = await q.order("id").range(from, from + PAGE - 1);
    if (error) {
      logError(`fetchAllByFk/${table}.${fkColumn}`, error);
      break;
    }
    const rows = data ?? [];
    all = all.concat(rows);
    more = rows.length === PAGE;
    from += PAGE;
  }
  return all;
}

/** Page through a filtered table with no FK batch. PostgREST still caps each
 *  response at 1000 rows — `/audit` incomes (~3.2k Pending Check) and expenses
 *  (~2.6k pending) must use this instead of a single `.limit(500)`. */
export async function fetchAllRows(
  table: string,
  columns: string,
  applyFilters?: (q: any) => any,
): Promise<{ data: any[]; error: any }> {
  const PAGE = 1000;
  let all: any[] = [];
  let from = 0;
  let more = true;
  while (more) {
    let q = supabase.from(table).select(columns);
    if (applyFilters) q = applyFilters(q);
    const { data, error } = await q.order("id").range(from, from + PAGE - 1);
    if (error) {
      logError(`fetchAllRows/${table}`, error);
      return { data: all, error };
    }
    const rows = data ?? [];
    all = all.concat(rows);
    more = rows.length === PAGE;
    from += PAGE;
  }
  return { data: all, error: null };
}
