import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ASANA_OAUTH_COOKIE,
  AsanaOAuthConfigError,
  buildAsanaAuthorizeUrl,
  createAsanaOAuthState,
  createAsanaPkce,
  getAsanaOAuthConfig,
  safeAsanaReturnPath,
} from "@/lib/asana-oauth";

export const dynamic = "force-dynamic";

function oauthCookieOpts(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 10 * 60,
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { clientId, redirectUri, scope } = getAsanaOAuthConfig(request.url);
    const state = createAsanaOAuthState();
    const { verifier, challenge } = createAsanaPkce();
    const returnTo = safeAsanaReturnPath(
      request.nextUrl.searchParams.get("returnTo")
    );

    const authorizeUrl = buildAsanaAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      challenge,
      scope: scope ?? undefined,
    });

    const cookieOpts = oauthCookieOpts(request);
    const res = NextResponse.redirect(authorizeUrl);
    res.cookies.set(ASANA_OAUTH_COOKIE.state, state, cookieOpts);
    res.cookies.set(ASANA_OAUTH_COOKIE.verifier, verifier, cookieOpts);
    res.cookies.set(ASANA_OAUTH_COOKIE.returnTo, returnTo, cookieOpts);
    res.cookies.set(ASANA_OAUTH_COOKIE.redirect, redirectUri, cookieOpts);
    return res;
  } catch (err) {
    const message =
      err instanceof AsanaOAuthConfigError
        ? err.message
        : "Failed to start Asana OAuth";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
