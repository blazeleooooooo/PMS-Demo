import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for Route Handlers.
 *
 * Next.js App Router patches global `fetch` and may cache GET responses by URL.
 * Supabase-js uses GET for `.select()` / `.in()` — without `cache: "no-store"`,
 * Vercel can keep stale rows (e.g. project_documents) across expense-locked runs.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "";
  if (!supabaseUrl || !supabaseServiceKey) return null;

  return createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
