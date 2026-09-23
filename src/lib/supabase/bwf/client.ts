import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase-bwf";
import {
  BWF_SUPABASE_PROJECT_REF,
  getBwfSupabaseAnonKey,
  getBwfSupabaseUrl,
} from "./config";

let client: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Browser client for Furniture 1000.
 * Uses supabase-js (not @supabase/ssr) with an isolated storage key and no
 * cookie session — PMS and Furniture share a browser origin in SSO flows, and
 * createBrowserClient would otherwise attach the wrong JWT to BWF REST calls.
 */
export function createBwfClient() {
  if (client) return client;
  client = createClient<Database>(
    getBwfSupabaseUrl(),
    getBwfSupabaseAnonKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `sb-${BWF_SUPABASE_PROJECT_REF}-pms-bwf-anon`,
      },
    }
  );
  return client;
}
