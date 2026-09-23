import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lazyProxy, resolvePublicSupabaseEnv } from "@/lib/supabase/public-env";

// Public client (anon key) — for read operations / client-side.
// Lazy so importing this module during `next build` does not require env vars.
export const supabase: SupabaseClient = lazyProxy(() => {
  const { url, key } = resolvePublicSupabaseEnv();
  return createClient(url, key);
});

// Re-export the full auto-generated types for use elsewhere
export type { Database } from "@/types/supabase";
