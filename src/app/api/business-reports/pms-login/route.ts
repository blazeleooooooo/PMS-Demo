import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

const PAGE = 1000;

async function fetchAll(table: string, cols: string): Promise<any[]> {
  const out: any[] = [];
  let page = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabaseAdmin!
      .from(table)
      .select(cols)
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) break;
    page++;
  }
  return out;
}

async function listAllAuthUsers() {
  const users: any[] = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabaseAdmin!.auth.admin.listUsers({
      page,
      perPage: PAGE,
    });
    if (error) throw new Error(`auth.admin.listUsers: ${error.message}`);
    users.push(...(data.users ?? []));
    if ((data.users?.length ?? 0) < PAGE) break;
    page++;
  }
  return users;
}

function primaryProvider(identities: { provider?: string }[] | undefined): string {
  if (!identities?.length) return "email";
  const google = identities.find((i) => i.provider === "google");
  if (google) return "google";
  return identities[0]?.provider || "email";
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "google":
      return "Google";
    case "email":
      return "Email / OTP";
    default:
      return provider;
  }
}

/** Latest ISO timestamp among candidates (nulls ignored). */
function maxIso(...dates: (string | null | undefined)[]): string | null {
  let bestMs: number | null = null;
  let best: string | null = null;
  for (const d of dates) {
    if (!d) continue;
    const ms = new Date(d).getTime();
    if (!Number.isFinite(ms)) continue;
    if (bestMs == null || ms > bestMs) {
      bestMs = ms;
      best = d;
    }
  }
  return best;
}

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: "Supabase admin client not initialised." },
      { status: 500 }
    );
  }

  try {
    const [authUsers, publicUsers, staffRows, supplierRows, customerRows, sessionsResult] =
      await Promise.all([
        listAllAuthUsers(),
        fetchAll(
          "users",
          "id, email, auth_user_id, user_type, member, member_id, supplier, supplier_id, customer, customer_id, approval_status, last_login_at, is_developer"
        ),
        fetchAll("staff", "id, name, full_name, email, status"),
        fetchAll("suppliers", "id, name, display_name"),
        fetchAll("customers", "id, customer_name, display_name, company_name"),
        supabaseAdmin.rpc("get_pms_auth_sessions"),
      ]);

    if (sessionsResult.error) {
      throw new Error(`get_pms_auth_sessions: ${sessionsResult.error.message}`);
    }

    const publicByAuthId = new Map<string, any>();
    const publicByEmail = new Map<string, any>();
    for (const u of publicUsers) {
      if (u.auth_user_id) publicByAuthId.set(u.auth_user_id, u);
      if (u.email) publicByEmail.set(String(u.email).toLowerCase(), u);
    }

    const staffById = new Map(staffRows.map((s) => [s.id, s]));
    const supplierById = new Map(supplierRows.map((s) => [s.id, s]));
    const customerById = new Map(customerRows.map((c) => [c.id, c]));

    function resolveMemberName(pub: any | undefined): string | null {
      if (!pub) return null;
      if (pub.member_id) {
        const st = staffById.get(pub.member_id);
        if (st) return st.name || st.full_name || null;
      }
      if (pub.supplier_id) {
        const sp = supplierById.get(pub.supplier_id);
        if (sp) return sp.display_name || sp.name || null;
      }
      if (pub.customer_id) {
        const cu = customerById.get(pub.customer_id);
        if (cu) return cu.display_name || cu.customer_name || cu.company_name || null;
      }
      return pub.member || pub.supplier || pub.customer || null;
    }

    const authUserById = new Map(authUsers.map((u) => [u.id, u]));

    const sessionActivityByUser = new Map<string, string>();
    for (const s of sessionsResult.data ?? []) {
      const active = s.last_active_at || s.login_at || null;
      if (!active || !s.auth_user_id) continue;
      const prev = sessionActivityByUser.get(s.auth_user_id);
      const next = maxIso(prev, active);
      if (next) sessionActivityByUser.set(s.auth_user_id, next);
    }

    const users = authUsers
      .filter((u) => !u.deleted_at)
      .map((au) => {
        const pub =
          publicByAuthId.get(au.id) ||
          (au.email ? publicByEmail.get(au.email.toLowerCase()) : undefined);
        const provider = primaryProvider(au.identities);
        const lastSignIn = au.last_sign_in_at || pub?.last_login_at || null;
        const lastActivity = maxIso(
          au.last_sign_in_at,
          pub?.last_login_at,
          sessionActivityByUser.get(au.id)
        );
        const staffRow = pub?.member_id ? staffById.get(pub.member_id) : undefined;
        return {
          auth_user_id: au.id,
          email: au.email || pub?.email || null,
          member_name: resolveMemberName(pub),
          user_type: pub?.user_type || null,
          approval_status: pub?.approval_status || null,
          provider,
          provider_label: providerLabel(provider),
          last_sign_in_at: lastSignIn,
          last_activity_at: lastActivity,
          account_created_at: au.created_at,
          linked: !!pub,
          member_id: pub?.member_id || null,
          staff_status: staffRow?.status || null,
          is_developer: pub?.is_developer === true,
        };
      })
      .sort((a, b) => {
        const ta = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        const tb = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
        return tb - ta;
      });

    const sessions = (sessionsResult.data ?? []).map((s: any) => {
      const au = authUserById.get(s.auth_user_id);
      const pub =
        publicByAuthId.get(s.auth_user_id) ||
        (au?.email ? publicByEmail.get(au.email.toLowerCase()) : undefined);
      return {
        session_id: s.session_id,
        auth_user_id: s.auth_user_id,
        login_at: s.login_at,
        last_active_at: s.last_active_at || s.login_at || null,
        ip: s.ip,
        user_agent: s.user_agent,
        email: au?.email || pub?.email || null,
        member_name: resolveMemberName(pub),
        user_type: pub?.user_type || null,
      };
    });

    return NextResponse.json({ success: true, users, sessions });
  } catch (err: any) {
    console.error("[api/business-reports/pms-login] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
