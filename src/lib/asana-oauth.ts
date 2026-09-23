import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const ASANA_AUTHORIZE_URL = "https://app.asana.com/-/oauth_authorize";
const ASANA_TOKEN_URL = "https://app.asana.com/-/oauth_token";
const ASANA_REVOKE_URL = "https://app.asana.com/-/oauth_revoke";

/** Registered on the Asana app. Override with ASANA_OAUTH_REDIRECT_URI for localhost. */
export const DEFAULT_ASANA_REDIRECT_URI =
  "http://localhost:3000/api/asana/callback";

export const ASANA_OAUTH_COOKIE = {
  state: "pms_asana_oauth_state",
  verifier: "pms_asana_oauth_verifier",
  returnTo: "pms_asana_oauth_return",
  redirect: "pms_asana_oauth_redirect",
} as const;

export class AsanaOAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsanaOAuthConfigError";
  }
}

export class AsanaNotConnectedError extends Error {
  constructor(message = "Asana 尚未連結。請先連接你的 Asana 帳號。") {
    super(message);
    this.name = "AsanaNotConnectedError";
  }
}

type AsanaTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  data?: { id?: number | string; gid?: string; name?: string };
};

export type AsanaOAuthStatus = {
  connected: boolean;
  asana_user_name: string | null;
};

export function getAsanaOAuthConfig(requestUrl?: string): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string | null;
} {
  const clientId = process.env.ASANA_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.ASANA_CLIENT_SECRET?.trim() || "";
  const redirectUri = resolveAsanaRedirectUri(requestUrl);
  const scope = process.env.ASANA_OAUTH_SCOPES?.trim() || null;

  if (!clientId || !clientSecret) {
    throw new AsanaOAuthConfigError(
      "Asana OAuth is not configured. Set ASANA_CLIENT_ID and ASANA_CLIENT_SECRET."
    );
  }

  return { clientId, clientSecret, redirectUri, scope };
}

/** Prefer env override, then localhost origin, otherwise the production callback. */
export function resolveAsanaRedirectUri(requestUrl?: string): string {
  const override = process.env.ASANA_OAUTH_REDIRECT_URI?.trim();
  if (override) return override;
  if (requestUrl) {
    try {
      const url = new URL(requestUrl);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return `${url.protocol}//${url.host}/api/asana/callback`;
      }
    } catch {
      // fall through
    }
  }
  return DEFAULT_ASANA_REDIRECT_URI;
}

export function isAllowedAsanaRedirectUri(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === process.env.ASANA_OAUTH_REDIRECT_URI?.trim()) return true;
  if (trimmed === DEFAULT_ASANA_REDIRECT_URI) return true;
  try {
    const url = new URL(trimmed);
    return (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.pathname === "/api/asana/callback"
    );
  } catch {
    return false;
  }
}

export function safeAsanaReturnPath(raw: string | null | undefined): string {
  const value = (raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("://")) return "/";
  return value;
}

export function createAsanaPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createAsanaOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function buildAsanaAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  scope?: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
  });
  if (input.scope) params.set("scope", input.scope);
  return `${ASANA_AUTHORIZE_URL}?${params.toString()}`;
}

async function postAsanaToken(
  body: Record<string, string>
): Promise<AsanaTokenResponse> {
  const res = await fetch(ASANA_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as AsanaTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || `Asana token exchange failed (${res.status})`
    );
  }
  return json;
}

export async function exchangeAsanaAuthCode(input: {
  code: string;
  verifier: string;
  redirectUri?: string;
}): Promise<AsanaTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getAsanaOAuthConfig();
  return postAsanaToken({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: input.redirectUri || redirectUri,
    code: input.code,
    code_verifier: input.verifier,
  });
}

export async function refreshAsanaAccessToken(
  refreshToken: string
): Promise<AsanaTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getAsanaOAuthConfig();
  return postAsanaToken({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    refresh_token: refreshToken,
  });
}

export async function revokeAsanaToken(token: string): Promise<void> {
  const { clientId, clientSecret } = getAsanaOAuthConfig();
  await fetch(ASANA_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token,
    }),
    cache: "no-store",
  }).catch(() => undefined);
}

function requireAdmin(): SupabaseClient {
  const admin = createServiceRoleClient();
  if (!admin) {
    throw new AsanaOAuthConfigError(
      "SUPABASE_SERVICE_KEY is required to store Asana OAuth tokens."
    );
  }
  return admin;
}

function expiresAtFrom(expiresIn?: number): string | null {
  if (!expiresIn || !Number.isFinite(expiresIn)) return null;
  return new Date(Date.now() + Math.max(expiresIn - 60, 30) * 1000).toISOString();
}

function asanaUserFromToken(data: AsanaTokenResponse["data"]): {
  gid: string | null;
  name: string | null;
} {
  const gid =
    data?.gid != null
      ? String(data.gid)
      : data?.id != null
        ? String(data.id)
        : null;
  return { gid, name: data?.name?.trim() || null };
}

export async function upsertAsanaOAuthTokens(input: {
  authUserId: string;
  pmsUserId: string | null;
  token: AsanaTokenResponse;
}): Promise<void> {
  const admin = requireAdmin();
  const user = asanaUserFromToken(input.token.data);
  const row: Record<string, unknown> = {
    auth_user_id: input.authUserId,
    user_id: input.pmsUserId,
    asana_user_gid: user.gid,
    asana_user_name: user.name,
    access_token: input.token.access_token,
    expires_at: expiresAtFrom(input.token.expires_in),
    updated_at: new Date().toISOString(),
  };
  if (input.token.refresh_token) {
    row.refresh_token = input.token.refresh_token;
  }

  const { error } = await admin
    .from("asana_oauth_tokens")
    .upsert(row, { onConflict: "auth_user_id" });
  if (error) throw new Error(error.message);
}

export async function getAsanaOAuthStatus(
  authUserId: string
): Promise<AsanaOAuthStatus> {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("asana_oauth_tokens")
    .select("asana_user_name")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    connected: !!data,
    asana_user_name: data?.asana_user_name ?? null,
  };
}

export async function deleteAsanaOAuthTokens(authUserId: string): Promise<void> {
  const admin = requireAdmin();
  const { data } = await admin
    .from("asana_oauth_tokens")
    .select("access_token, refresh_token")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (data?.access_token) await revokeAsanaToken(data.access_token);
  else if (data?.refresh_token) await revokeAsanaToken(data.refresh_token);
  await admin.from("asana_oauth_tokens").delete().eq("auth_user_id", authUserId);
}

export async function getValidAsanaAccessToken(
  authUserId: string
): Promise<string> {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("asana_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.access_token) throw new AsanaNotConnectedError();

  const expired =
    data.expires_at && Date.parse(data.expires_at) <= Date.now();
  if (!expired) return data.access_token;
  if (!data.refresh_token) {
    await admin.from("asana_oauth_tokens").delete().eq("auth_user_id", authUserId);
    throw new AsanaNotConnectedError("Asana 授權已過期，請重新連接。");
  }

  try {
    const refreshed = await refreshAsanaAccessToken(data.refresh_token);
    await admin
      .from("asana_oauth_tokens")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || data.refresh_token,
        expires_at: expiresAtFrom(refreshed.expires_in),
        updated_at: new Date().toISOString(),
      })
      .eq("auth_user_id", authUserId);

    return refreshed.access_token as string;
  } catch {
    await admin.from("asana_oauth_tokens").delete().eq("auth_user_id", authUserId);
    throw new AsanaNotConnectedError("Asana 授權已過期，請重新連接。");
  }
}

export async function resolvePmsUserId(
  supabase: SupabaseClient,
  authUserId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data?.id ?? null;
}
