import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeReturnTo } from "@/lib/auth/safe-return-to";
import { resolvePermissionModule } from "@/lib/route-modules";

// ─── SESSION EXPIRY CONFIG ───────────────────────────────────
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const SESSION_LOGIN_COOKIE = "pms_last_login_at";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ─── OPTIMIZED: Cookie-based auth check ───────────────────
  // Instead of making a network call to getUser() (which can timeout and add latency),
  // we check for the existence of the Supabase auth cookie.
  // The client-side AuthContext handles full token validation + refresh.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  // Protected route handling — redirect unauthenticated users to login
  const pathname = request.nextUrl.pathname;

  const demoHiddenPages = ["/asana-import", "/admin/migration", "/admin/fk-audit"];
  const demoDisabledApis = [
    "/api/asana",
    "/api/bwf/sso",
    "/api/bwf/quotes",
    "/api/bwf/auth-test",
    "/api/box",
    "/api/bubble-man-hour",
    "/api/otc-staff-display-names",
    "/api/resolve-man-hour-staff",
    "/api/whatsapp",
    "/api/email",
    "/api/collection-emails/send",
    "/api/weekly-reports/ai-fill",
    "/api/cron",
  ];
  const matchesPrefix = (prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);
  if (demoDisabledApis.some(matchesPrefix)) {
    return NextResponse.json(
      { error: "This integration is disabled in the demo." },
      { status: 410 }
    );
  }
  if (demoHiddenPages.some(matchesPrefix)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const isAuthPage = pathname === "/login";
  const isCallbackRoute = pathname.startsWith("/auth/");
  const isApiRoute = pathname.startsWith("/api/");
  const isTempoRoute = pathname.startsWith("/tempobook");
  const isStaticAsset =
    pathname.startsWith("/_next/") || pathname.startsWith("/favicon");
  const isPortalRoute = pathname.startsWith("/portal");

  const isAccessDeniedPage = pathname === "/access-denied";
  const isPendingApprovalPage = pathname === "/pending-approval";

  // Auth callback must refresh the Supabase session cookie (PKCE code exchange).
  if (isCallbackRoute) {
    await supabase.auth.getUser();
    return supabaseResponse;
  }

  // Skip protection for API routes, static assets, tempobook, portal, access-denied
  if (isApiRoute || isStaticAsset || isTempoRoute || isPortalRoute || isAccessDeniedPage) {
    return supabaseResponse;
  }

  // If user is NOT logged in and trying to access a protected page, redirect to login
  if (!hasAuthCookie && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ─── 7-DAY SESSION EXPIRY CHECK ─────────────────────────────
  // Force re-login if session is older than 7 days
  if (hasAuthCookie && !isAuthPage) {
    const lastLoginCookie = request.cookies.get(SESSION_LOGIN_COOKIE);
    
    if (lastLoginCookie?.value) {
      const lastLoginAt = parseInt(lastLoginCookie.value, 10);
      const now = Date.now();
      
      if (now - lastLoginAt > SESSION_MAX_AGE_MS) {
        // Session expired — clear auth cookies and redirect to login
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("reason", "session_expired");
        
        const response = NextResponse.redirect(url);
        // Delete the login timestamp cookie
        response.cookies.delete(SESSION_LOGIN_COOKIE);
        // Delete all Supabase auth cookies to force sign out
        request.cookies.getAll().forEach((cookie) => {
          if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
            response.cookies.delete(cookie.name);
          }
        });
        return response;
      }
    } else {
      // User has auth cookie but no login timestamp — set it now (migration for existing sessions)
      // They'll get another 7 days from this point
      supabaseResponse.cookies.set(SESSION_LOGIN_COOKIE, Date.now().toString(), {
        path: "/",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }
  }

  // If user IS logged in and trying to access /login, redirect to home.
  // Must validate the session — cookie presence alone is not enough. On iPad
  // Safari, orphaned/partial sb-*-auth-token cookies are common; treating them
  // as logged-in causes /login ↔ / redirect loops and an endless spinner.
  if (hasAuthCookie && isAuthPage) {
    try {
      const {
        data: { user: loginPageUser },
      } = await supabase.auth.getUser();
      if (loginPageUser) {
        const returnTo = getSafeReturnTo(request.nextUrl.searchParams.get("return_to"));
        const url = request.nextUrl.clone();
        url.pathname = returnTo ?? "/";
        url.search = "";
        return NextResponse.redirect(url);
      }
      // Cookie present but session invalid — clear bad cookies and stay on /login
      const clearResponse = NextResponse.next({ request });
      request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
          clearResponse.cookies.delete(cookie.name);
        }
      });
      clearResponse.cookies.delete(SESSION_LOGIN_COOKIE);
      return clearResponse;
    } catch {
      // Validation failed — allow /login to render so the user can sign in again
      return supabaseResponse;
    }
  }

  // ─── ACCOUNT-APPROVAL GATE + PERMISSION CHECK ─────────────
  // For authenticated users we resolve the auth user once, then:
  //  1. Auto-provision a public.users row if this is a brand-new login
  //     (status "pending"), so admins see them on /admin/accounts.
  //  2. Gate "pending" users to /pending-approval — they cannot visit any
  //     other page until an admin approves them.
  //  3. Run the existing per-module permission check for approved users.
  if (hasAuthCookie) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        const emailLower = user.email.toLowerCase().trim();

        // Look up the account row to read approval_status. We MUST distinguish
        // "query errored" from "no row" — only the latter means a genuinely new
        // user. Treating an errored lookup as "no row" would wrongly redirect an
        // existing approved user to /pending-approval and insert a duplicate.
        const { data: acctRows, error: acctErr } = await supabase
          .from("users")
          .select("id, approval_status, user_type, member_id")
          .ilike("email", emailLower)
          .limit(1);

        // approvalStatus stays null = "unknown / fail-open" — we only gate when
        // we positively know the account is pending.
        let approvalStatus: string | null = null;
        let acctUserType: string | null = null;
        let acctMemberId: string | null = null;

        if (acctErr) {
          // Lookup failed — do NOT provision or gate. Let the request through;
          // the next successful request will resolve the real status.
          console.error("[middleware] approval lookup error (fail-open):", acctErr.message);
        } else if (acctRows && acctRows.length > 0) {
          approvalStatus = acctRows[0].approval_status ?? "approved";
          acctUserType = acctRows[0].user_type ?? null;
          acctMemberId = acctRows[0].member_id ?? null;
        } else {
          // Query succeeded and returned no row → genuinely new user.
          // Auto-provision a pending account so admins see them on /admin/accounts.
          const nowIso = new Date().toISOString();
          const { error: insertErr } = await supabase.from("users").insert({
            email: emailLower,
            approval_status: "pending",
            auth_user_id: user.id,
            created_date: nowIso,
            modified_date: nowIso,
          });
          if (insertErr) {
            // Insert failed (e.g. race / unique conflict) — fail-open rather than
            // trap the user. Leave status unknown so we don't gate this request.
            console.error("[middleware] auto-provision user error (fail-open):", insertErr.message);
          } else {
            approvalStatus = "pending";
          }
        }

        // Gate: confine known-pending users to the pending-approval page.
        // (approvalStatus === null means unknown → fail-open, no gating.)
        if (approvalStatus === "pending") {
          if (!isPendingApprovalPage) {
            const url = request.nextUrl.clone();
            url.pathname = "/pending-approval";
            return NextResponse.redirect(url);
          }
          // Already on the pending page — allow.
          return supabaseResponse;
        }

        // Known-approved user landed on the pending page — send them home.
        if (approvalStatus === "approved" && isPendingApprovalPage) {
          const url = request.nextUrl.clone();
          url.pathname = "/";
          return NextResponse.redirect(url);
        }

        // ─── INACTIVE STAFF GATE ─────────────────────────────
        // Staff users linked to an Inactive staff row cannot stay signed in.
        if (acctUserType === "Staff" && !isAuthPage) {
          let staffStatus: string | null = null;
          if (acctMemberId) {
            const { data: staffRow } = await supabase
              .from("staff")
              .select("status")
              .eq("id", acctMemberId)
              .maybeSingle();
            staffStatus = staffRow?.status ?? null;
          } else {
            const { data: staffRow } = await supabase
              .from("staff")
              .select("status")
              .ilike("email", emailLower)
              .limit(1)
              .maybeSingle();
            staffStatus = staffRow?.status ?? null;
          }

          if (staffStatus && staffStatus.toLowerCase() === "inactive") {
            const url = request.nextUrl.clone();
            url.pathname = "/login";
            url.searchParams.set("reason", "staff_inactive");
            const response = NextResponse.redirect(url);
            response.cookies.delete(SESSION_LOGIN_COOKIE);
            request.cookies.getAll().forEach((cookie) => {
              if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
                response.cookies.delete(cookie.name);
              }
            });
            return response;
          }
        }

        // ─── PERMISSION CHECK (Page Visit Limitation) ─────────
        const module = resolvePermissionModule(pathname);
        if (module) {

          // Try multiple lookup paths to find staff ID (same as get_complete_user_context RPC)
          let staffId: string | null = acctMemberId;

          // Path 2: Fallback — check staff.email directly
          if (!staffId) {
            const { data: staffData } = await supabase
              .from("staff")
              .select("id")
              .ilike("email", emailLower)
              .eq("status", "Active")
              .limit(1)
              .single();

            if (staffData?.id) {
              staffId = staffData.id;
            }
          }

          if (staffId) {
            // Check permission via RPC
            const { data: allowed, error: rpcError } = await supabase.rpc(
              "check_permission",
              {
                p_user_id: staffId,
                p_module: module,
                p_action: "view",
              }
            );

            // If explicitly denied (and no RPC error), redirect to access-denied page
            if (allowed === false && !rpcError) {
              const url = request.nextUrl.clone();
              url.pathname = "/access-denied";
              url.searchParams.set("module", module);
              return NextResponse.redirect(url);
            }
          }
        }
      }
    } catch (err) {
      // On any approval/permission check failure, allow through (fail-open for
      // UX). The client-side gates are the secondary line of defence.
      console.error("[middleware] Approval/permission check error:", err);
    }
  }

  return supabaseResponse;
}
