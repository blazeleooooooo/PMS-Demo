/**
 * Returns the public-facing site URL dynamically.
 *
 * The key principle: redirect the user back to the SAME origin they are
 * currently browsing from. This ensures login/logout flows work correctly
 * across all platforms:
 *  - The demo site (current origin or NEXT_PUBLIC_SITE_URL)
 *  - Local development (localhost:3000)
 *
 * Priority:
 *  1. Client-side: window.location.origin (always use current browsing origin)
 *  2. NEXT_PUBLIC_SITE_URL env var (server-side fallback)
 *  3. NEXT_PUBLIC_VERCEL_URL env var (auto-set by Vercel deployments)
 *  4. Fallback: http://localhost:3000
 */

/** Client-side: returns the public site URL based on current browsing context */
export function getSiteUrl(): string {
  // 1. In the browser, always use the current origin
  //    This ensures auth redirects go back to wherever the user is browsing from
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // 2. Explicit env var (server-side only)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  // 3. Vercel auto-set URL (available at build time on Vercel deployments)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // 4. Server-side fallback — local demo only. Never a live site host.
  return "http://localhost:3000";
}

/**
 * Server-side: returns the public site URL.
 * 
 * Uses request headers to determine which platform the user is on,
 * ensuring redirects go back to the correct origin (Tempo, Vercel, localhost).
 */
export function getServerSiteUrl(request?: Request): string {
  if (request) {
    // 1. Check Origin header first (set by browsers on POST/redirects)
    const origin = request.headers.get("origin");
    if (origin && isValidAppOrigin(origin)) {
      return origin.replace(/\/$/, "");
    }

    // 2. Check Referer header (set on GET requests like auth callbacks)
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        if (isValidAppOrigin(refererOrigin)) {
          return refererOrigin;
        }
      } catch {
        // Invalid referer URL, continue
      }
    }

    // 3. Derive from x-forwarded-host (set by Vercel / reverse proxies)
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`;
    }

    // 4. Fall back to the Host header
    const host = request.headers.get("host");
    if (host) {
      const proto = host.startsWith("localhost") ? "http" : "https";
      return `${proto}://${host}`;
    }
  }

  // 5. Env var fallbacks (no request context)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // 6. Final fallback — local demo only. Never a live site host.
  return "http://localhost:3000";
}

/**
 * Checks if an origin is a valid app origin (not empty, not null-like)
 */
function isValidAppOrigin(origin: string): boolean {
  if (!origin || origin === "null") return false;
  // Accept any http/https origin — the app could be on any platform
  return origin.startsWith("http://") || origin.startsWith("https://");
}
