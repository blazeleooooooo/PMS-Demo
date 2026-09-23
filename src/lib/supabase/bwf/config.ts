/** Furniture quote sync is off in the demo. No default project URL. */
export const BWF_SUPABASE_PROJECT_REF = "" as const;

/** Resolve Furniture URL from env only. Empty when unset. */
export function getBwfSupabaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_BWF_SUPABASE_URL ||
    process.env.BWF_SUPABASE_URL ||
    "";
  return url.replace(/\/$/, "");
}

/**
 * Resolve Furniture anon/publishable key.
 * Accepts NEXT_PUBLIC_ (browser+server) or BWF_SUPABASE_ANON_KEY (server-only).
 */
export function getBwfSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_BWF_SUPABASE_ANON_KEY ||
    process.env.BWF_SUPABASE_ANON_KEY ||
    "";
  if (!key) {
    throw new Error(
      "Furniture Supabase is not configured in this demo."
    );
  }
  return key;
}

/** Server-only: prefers BWF_SUPABASE_SERVICE_KEY, falls back to anon key. */
export function getBwfSupabaseServerKey(): string {
  return (
    process.env.BWF_SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_BWF_SUPABASE_ANON_KEY ||
    process.env.BWF_SUPABASE_ANON_KEY ||
    ""
  );
}

/**
 * True when Furniture credentials are available.
 * Server: NEXT_PUBLIC_* or BWF_SUPABASE_ANON_KEY.
 * Client: only NEXT_PUBLIC_* (inlined at build time).
 */
export function isBwfSupabaseConfigured(): boolean {
  if (typeof window === "undefined") {
    return Boolean(
      process.env.NEXT_PUBLIC_BWF_SUPABASE_ANON_KEY ||
        process.env.BWF_SUPABASE_ANON_KEY ||
        process.env.BWF_SUPABASE_SERVICE_KEY
    );
  }
  return Boolean(process.env.NEXT_PUBLIC_BWF_SUPABASE_ANON_KEY);
}

export function isBwfSupabaseServiceKeyConfigured(): boolean {
  return Boolean(process.env.BWF_SUPABASE_SERVICE_KEY);
}
