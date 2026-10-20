/** Public demo account from supabase/seed.sql. Not a production secret. */
export const DEMO_LOGIN_EMAIL = "demo@example.com";
export const DEMO_LOGIN_PASSWORD = "5550100199";

const DEMO_HOST_MARKER = "pms-demo";

function hostnameOf(value?: string | null): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "";
  try {
    if (raw.includes("://")) return new URL(raw).hostname;
  } catch {
    return "";
  }
  return raw.split("/")[0]?.split(":")[0] ?? "";
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function isDemoHost(hostname: string): boolean {
  return hostname.includes(DEMO_HOST_MARKER) || isLocalHost(hostname);
}

/**
 * Show the public demo credentials only on the demo site or local demo.
 * A non-demo hostname stays hidden unless NEXT_PUBLIC_SITE_URL itself is the demo host.
 */
export function shouldShowDemoLoginHint(options?: {
  hostname?: string | null;
  siteUrl?: string | null;
}): boolean {
  const hostname = hostnameOf(options?.hostname);
  const siteHost = hostnameOf(options?.siteUrl);

  if (hostname && isDemoHost(hostname)) return true;
  if (siteHost.includes(DEMO_HOST_MARKER)) return true;
  if (!hostname && isLocalHost(siteHost)) return true;
  return false;
}
