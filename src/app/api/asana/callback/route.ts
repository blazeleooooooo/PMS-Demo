import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ASANA_OAUTH_COOKIE,
  exchangeAsanaAuthCode,
  getAsanaOAuthConfig,
  isAllowedAsanaRedirectUri,
  resolvePmsUserId,
  safeAsanaReturnPath,
  upsertAsanaOAuthTokens,
} from "@/lib/asana-oauth";

export const dynamic = "force-dynamic";

function clearOAuthCookies(res: NextResponse) {
  for (const name of Object.values(ASANA_OAUTH_COOKIE)) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

function finish(request: NextRequest, returnTo: string, status: "connected" | "error") {
  const url = new URL(safeAsanaReturnPath(returnTo), request.url);
  url.searchParams.set("asana_oauth", status);
  const res = NextResponse.redirect(url);
  clearOAuthCookies(res);
  return res;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const returnTo = request.cookies.get(ASANA_OAUTH_COOKIE.returnTo)?.value || "/";
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const errorParam = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(ASANA_OAUTH_COOKIE.state)?.value;
  const verifier = request.cookies.get(ASANA_OAUTH_COOKIE.verifier)?.value;

  if (errorParam || !code || !state || !expectedState || state !== expectedState || !verifier) {
    console.error("[api/asana/callback] oauth denied or state mismatch");
    return finish(request, returnTo, "error");
  }

  try {
    const redirectFromCookie = request.cookies.get(ASANA_OAUTH_COOKIE.redirect)?.value;
    const redirectUri =
      redirectFromCookie && isAllowedAsanaRedirectUri(redirectFromCookie)
        ? redirectFromCookie
        : getAsanaOAuthConfig(request.url).redirectUri;
    const token = await exchangeAsanaAuthCode({ code, verifier, redirectUri });
    const pmsUserId = await resolvePmsUserId(supabase, user.id);
    await upsertAsanaOAuthTokens({
      authUserId: user.id,
      pmsUserId,
      token,
    });
    return finish(request, returnTo, "connected");
  } catch (err) {
    console.error(
      "[api/asana/callback]",
      err instanceof Error ? err.message : err
    );
    return finish(request, returnTo, "error");
  }
}
