import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase-bwf";
import {
  getBwfSupabaseAnonKey,
  getBwfSupabaseServerKey,
  getBwfSupabaseUrl,
} from "./config";

/**
 * Server-side client for the BWF Supabase project.
 * Uses BWF_SUPABASE_SERVICE_KEY when set; otherwise the anon key.
 * Separate from PMS auth — no cookie/session sharing with the main project.
 */
export function createBwfServerClient() {
  const key = getBwfSupabaseServerKey();
  if (!key) {
    throw new Error(
      "Missing BWF Supabase key — set BWF_SUPABASE_SERVICE_KEY or NEXT_PUBLIC_BWF_SUPABASE_ANON_KEY"
    );
  }

  return createSupabaseClient<Database>(getBwfSupabaseUrl(), key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** Read-only server client using the anon/publishable key. */
export function createBwfAnonServerClient() {
  return createSupabaseClient<Database>(
    getBwfSupabaseUrl(),
    getBwfSupabaseAnonKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
