import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { assertStaffActiveForLogin } from "@/lib/auth/assert-staff-active";
import { getSafeReturnTo } from "@/lib/auth/safe-return-to";
import { createClient } from "@/lib/supabase/server";
import { getServerSiteUrl } from "@/lib/get-site-url";

function parseReturnToCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)pms_return_to=([^;]*)/);
  if (!match?.[1]) return null;
  try {
    return getSafeReturnTo(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");

  // Prefer the actual request origin (Supabase official pattern) so localhost
  // and production always redirect back to the same host that started OAuth.
  const origin = requestUrl.origin || getServerSiteUrl(request);

  if (oauthError) {
    console.error("[auth/callback] OAuth error from provider:", oauthError);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
  }

  try {
    const supabase = await createClient();
    const { data: sessionData, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error || !sessionData?.user?.email) {
      console.error(
        "[auth/callback] exchangeCodeForSession failed:",
        error?.message ?? "no session"
      );
      return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
    }

    const emailLower = sessionData.user.email.toLowerCase().trim();

    const staffGate = await assertStaffActiveForLogin(supabaseAdmin, emailLower);
    if (!staffGate.allowed) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        `${origin}/login?reason=staff_inactive`
      );
    }

    // Use the authenticated session client (same as middleware) — no service key needed.
    const { data: profile } = await supabase
      .from("users")
      .select("user_type")
      .ilike("email", emailLower)
      .maybeSingle();

    const userType = profile?.user_type;

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("users")
      .update({ last_login_at: now, modified_date: now })
      .eq("email", emailLower);

    const returnTo = parseReturnToCookie(request);
    let redirectPath = returnTo ?? "/";
    if (!returnTo) {
      if (userType === "Supplier") {
        redirectPath = "/portal/supplier";
      } else if (userType === "Customer") {
        redirectPath = "/portal/customer";
      }
    }

    const response = NextResponse.redirect(`${origin}${redirectPath}`);
    response.cookies.set("pms_return_to", "", {
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("pms_last_login_at", Date.now().toString(), {
      path: "/",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (err) {
    console.error("[auth/callback] unexpected error:", err);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
  }
}
