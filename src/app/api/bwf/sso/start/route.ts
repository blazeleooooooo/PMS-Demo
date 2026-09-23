import { NextResponse } from "next/server";
import { getServerSiteUrl } from "@/lib/get-site-url";
import { createClient } from "@/lib/supabase/server";
import {
  getFurnitureAppUrl,
  getPmsSsoSharedSecret,
  isFurnitureUserNotFound,
  mintFurnitureSsoCode,
  syncPmsUserToFurniture,
} from "@/lib/supabase/bwf/sso-server";

export const dynamic = "force-dynamic";

const SSO_START_PATH = "/api/bwf/sso/start";
const FURNITURE_CALLBACK_PATH = "/auth/pms/callback";

/**
 * Resolve a safe post-login Furniture destination (path + query only).
 * Allows relative paths (e.g. /quote/quick?...) or absolute URLs under FURNITURE_APP_URL.
 */
function resolveSafeFurnitureDestination(raw: string | null): string | null {
  if (!raw) return null;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  const furnitureBase = getFurnitureAppUrl().replace(/\/$/, "");

  if (decoded.startsWith("/") && !decoded.startsWith("//")) {
    return decoded;
  }

  try {
    const target = new URL(decoded);
    const base = new URL(furnitureBase);
    if (target.origin !== base.origin) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

/**
 * Mint redirect_to must hit Furniture SSO callback so the session is established.
 * Final page is passed as `next` (relative path + query).
 */
function buildFurnitureSsoRedirectTo(destinationPath: string | null): string {
  const furnitureBase = getFurnitureAppUrl().replace(/\/$/, "");
  if (!destinationPath) {
    return `${furnitureBase}${FURNITURE_CALLBACK_PATH}`;
  }

  // Already targeting the callback — use as absolute URL under Furniture origin.
  if (
    destinationPath === FURNITURE_CALLBACK_PATH ||
    destinationPath.startsWith(`${FURNITURE_CALLBACK_PATH}?`)
  ) {
    return `${furnitureBase}${destinationPath}`;
  }

  const next = destinationPath.startsWith("/")
    ? destinationPath
    : `/${destinationPath}`;
  return `${furnitureBase}${FURNITURE_CALLBACK_PATH}?next=${encodeURIComponent(next)}`;
}

/** Starts PMS → Furniture 1000 SSO for the current PMS session. */
export async function GET(request: Request) {
  try {
    getPmsSsoSharedSecret();
  } catch {
    return NextResponse.json(
      {
        error: "sso_not_configured",
        message: "PMS SSO is not configured on this server.",
      },
      { status: 503 }
    );
  }

  const requestUrl = new URL(request.url);
  const redirectParam = requestUrl.searchParams.get("redirect_to");
  const safeDestination = resolveSafeFurnitureDestination(redirectParam);

  if (redirectParam && !safeDestination) {
    return NextResponse.json(
      {
        error: "invalid_redirect_to",
        message: "redirect_to must be a Furniture app path or URL.",
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    const login = new URL("/login", getServerSiteUrl(request));
    const returnPath = redirectParam
      ? `${SSO_START_PATH}?redirect_to=${encodeURIComponent(redirectParam)}`
      : SSO_START_PATH;
    login.searchParams.set("return_to", returnPath);
    return NextResponse.redirect(login);
  }

  const mintRedirectTo = buildFurnitureSsoRedirectTo(safeDestination);

  let mintResult = await mintFurnitureSsoCode({
    userId: user.id,
    email: user.email,
    redirectTo: mintRedirectTo,
  });

  if (!mintResult.ok && isFurnitureUserNotFound(mintResult.body)) {
    await syncPmsUserToFurniture(user.id);
    mintResult = await mintFurnitureSsoCode({
      userId: user.id,
      email: user.email,
      redirectTo: mintRedirectTo,
    });
  }

  if (!mintResult.ok) {
    return NextResponse.json(mintResult.body, { status: mintResult.status });
  }

  return NextResponse.redirect(mintResult.exchangeUrl);
}
