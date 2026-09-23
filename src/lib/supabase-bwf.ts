import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase-bwf";
import {
  getBwfSupabaseAnonKey,
  getBwfSupabaseUrl,
  isBwfSupabaseConfigured,
} from "@/lib/supabase/bwf/config";

/** Lazy singleton for scripts or legacy imports. Prefer `createBwfClient()` in React. */
let _client: ReturnType<typeof createClient<Database>> | null = null;

export function getBwfSupabase() {
  if (!_client) {
    if (!isBwfSupabaseConfigured()) {
      throw new Error("BWF Supabase is not configured — check .env.local");
    }
    _client = createClient<Database>(
      getBwfSupabaseUrl(),
      getBwfSupabaseAnonKey()
    );
  }
  return _client;
}

export type { Database as BwfDatabase } from "@/types/supabase-bwf";
