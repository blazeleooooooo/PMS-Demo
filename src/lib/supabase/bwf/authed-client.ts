import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createPmsClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase-bwf";
import { getBwfSupabaseAnonKey, getBwfSupabaseUrl } from "./config";

/**
 * BWF client that forwards the current PMS session JWT (Path A1 shared auth).
 * Call from client components after the user is logged into PMS.
 */
export async function createBwfAuthedClient() {
  const pms = createPmsClient();
  const {
    data: { session },
  } = await pms.auth.getSession();

  return createSupabaseClient<Database>(
    getBwfSupabaseUrl(),
    getBwfSupabaseAnonKey(),
    {
      global: {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      },
    }
  );
}
