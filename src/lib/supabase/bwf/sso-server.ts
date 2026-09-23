/**
 * Server-side PMS → Furniture 1000 SSO helpers.
 *
 * Required env (Vercel server only — never NEXT_PUBLIC_):
 * - PMS_SSO_SHARED_SECRET — same as Furniture edge + sync-pms-auth-to-bwf
 * - BWF_SUPABASE_URL — https://YOUR_DEMO_PROJECT_REF.supabase.co (or use NEXT_PUBLIC_BWF_SUPABASE_URL)
 * - FURNITURE_APP_URL — optional; default 
 *
 * Furniture team: VITE_PMS_SSO_START_URL=http://localhost:3000/api/bwf/sso/start
 */
import { getBwfSupabaseUrl } from "./config";

const DEFAULT_FURNITURE_APP_URL = "";

type MintResponse = {
  exchange_url?: string;
  error?: string;
  message?: string;
};

export function getPmsSsoSharedSecret(): string {
  const secret = process.env.PMS_SSO_SHARED_SECRET;
  if (!secret) {
    throw new Error("Missing PMS_SSO_SHARED_SECRET");
  }
  return secret;
}

/** Server-only BWF URL; falls back to NEXT_PUBLIC_BWF_SUPABASE_URL. */
export function getBwfSupabaseUrlServer(): string {
  return (
    process.env.BWF_SUPABASE_URL?.replace(/\/$/, "") || getBwfSupabaseUrl()
  );
}

export function getFurnitureAppUrl(): string {
  return (
    process.env.FURNITURE_APP_URL?.replace(/\/$/, "") ||
    DEFAULT_FURNITURE_APP_URL
  );
}

function getPmsSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url.replace(/\/$/, "");
}

export async function mintFurnitureSsoCode(params: {
  userId: string;
  email: string;
  redirectTo?: string;
}): Promise<
  | { ok: true; exchangeUrl: string }
  | { ok: false; status: number; body: MintResponse }
> {
  const redirectTo =
    params.redirectTo ?? `${getFurnitureAppUrl()}/auth/pms/callback`;

  const res = await fetch(
    `${getBwfSupabaseUrlServer()}/functions/v1/supabase-functions-pms-sso`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pms-sso-secret": getPmsSsoSharedSecret(),
      },
      body: JSON.stringify({
        action: "mint",
        user_id: params.userId,
        email: params.email,
        redirect_to: redirectTo,
      }),
    }
  );

  const body = (await res.json()) as MintResponse;

  if (!res.ok) {
    return { ok: false, status: res.status, body };
  }

  if (!body.exchange_url) {
    return {
      ok: false,
      status: 502,
      body: { error: "missing_exchange_url" },
    };
  }

  return { ok: true, exchangeUrl: body.exchange_url };
}

export async function syncPmsUserToFurniture(userId: string): Promise<boolean> {
  const res = await fetch(
    `${getPmsSupabaseUrl()}/functions/v1/supabase-functions-sync-pms-auth-to-bwf`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": getPmsSsoSharedSecret(),
      },
      body: JSON.stringify({ action: "sync_one", user_id: userId }),
    }
  );
  return res.ok;
}

export function isFurnitureUserNotFound(body: MintResponse): boolean {
  const msg = `${body.error ?? ""} ${body.message ?? ""}`.toLowerCase();
  return (
    msg.includes("user not found") ||
    msg.includes("not found in furniture") ||
    msg.includes("not found in furniture auth")
  );
}
