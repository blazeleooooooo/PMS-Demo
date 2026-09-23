import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBwfSupabaseAnonKey, getBwfSupabaseUrl } from "@/lib/supabase/bwf/config";

export const dynamic = "force-dynamic";

function decodeJwtMeta(token: string) {
  try {
    const [headerB64, payloadB64] = token.split(".").slice(0, 2);
    const header = JSON.parse(
      Buffer.from(headerB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    );
    const payload = JSON.parse(
      Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    );
    return {
      alg: header.alg as string | undefined,
      kid: header.kid as string | undefined,
      iss: payload.iss as string | undefined,
      ref: payload.ref as string | undefined,
    };
  } catch {
    return null;
  }
}

/** Verifies PMS session and tests Furniture 1000 accepts the forwarded JWT. */
export async function GET() {
  const pms = await createClient();
  const {
    data: { session },
    error: sessionError,
  } = await pms.auth.getSession();

  if (sessionError || !session?.access_token) {
    return NextResponse.json(
      { ok: false, error: "Not logged in to PMS" },
      { status: 401 }
    );
  }

  const res = await fetch(`${getBwfSupabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: getBwfSupabaseAnonKey(),
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const bodyText = await res.text();
  let bwfUser: { id?: string; email?: string } | null = null;
  try {
    bwfUser = JSON.parse(bodyText);
  } catch {
    bwfUser = null;
  }

  const uidMatch = bwfUser?.id === session.user.id;

  return NextResponse.json({
    ok: res.ok && uidMatch,
    pmsUserId: session.user.id,
    pmsEmail: session.user.email,
    pmsJwt: decodeJwtMeta(session.access_token),
    bwfStatus: res.status,
    bwfUser,
    uidMatch,
    hint:
      res.status === 403 && !uidMatch
        ? "Furniture 1000 HS256 shared secret likely does not match PMS Current HS256 key. Re-import on Furniture JWT Signing Keys tab."
        : undefined,
  });
}
