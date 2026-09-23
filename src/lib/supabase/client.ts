import { createBrowserClient } from "@supabase/ssr";
import { resolvePublicSupabaseEnv } from "@/lib/supabase/public-env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Browser Supabase client.
 *
 * Bypass navigator.locks: on iOS/iPadOS Safari (and some PWAs), orphaned
 * Web Locks can make auth.getSession() / getUser() hang forever. That leaves
 * RouteGuard stuck on the loading spinner. Server/middleware clients are
 * unaffected (no navigator.locks in Node). Cross-tab refresh safety is less
 * critical than a usable session on mobile Safari.
 */
export function createClient() {
  if (client) return client;
  const { url, key } = resolvePublicSupabaseEnv();
  client = createBrowserClient(
    url,
    key,
    {
      auth: {
        lock: async (_name, _acquireTimeout, fn) => fn(),
      },
    }
  );
  return client;
}
