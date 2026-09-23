import { NextRequest, NextResponse } from "next/server";
import { fetchMissingSiteStatusDeadlineProjects } from "@/lib/expense-control-bulk";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { resolveApiStaffId } from "@/lib/supabase/resolve-api-staff";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

type StaffAuthRow = {
  id: string;
  role: string | null;
  n_team_type_id: string | null;
};

function normalizeRole(role: string | null | undefined): string {
  return (role || "").trim().toLowerCase();
}

function isSuperAdmin(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r.includes("super") && r.includes("admin");
}

function isAdmin(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  if (isSuperAdmin(role)) return true;
  return r === "admin" || (r.includes("admin") && !r.includes("non") && !r.includes("super"));
}

function isSeniorUser(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === "senior user" || (r.includes("senior") && r.includes("user"));
}

/**
 * Role-scoped access for viewing another staff's Aug-14 Site Status deadline list:
 * - User: own only
 * - Senior User: same n_team_type_id, Active staff
 * - Admin / Super Admin: any Active staff
 * - Developer impersonation path: always allowed
 */
async function canViewAsPm(
  supabaseAdmin: SupabaseClient,
  authStaff: StaffAuthRow,
  targetStaffId: string,
  isDeveloper: boolean
): Promise<boolean> {
  if (targetStaffId === authStaff.id || isDeveloper) return true;

  const { data: target, error } = await supabaseAdmin
    .from("staff")
    .select("id, status, n_team_type_id")
    .eq("id", targetStaffId)
    .maybeSingle();

  if (error || !target) return false;
  if ((target.status || "").trim() !== "Active") return false;

  if (isAdmin(authStaff.role) || isSuperAdmin(authStaff.role)) return true;

  if (isSeniorUser(authStaff.role)) {
    if (!authStaff.n_team_type_id || !target.n_team_type_id) return false;
    return authStaff.n_team_type_id === target.n_team_type_id;
  }

  return false;
}

export async function GET(request: NextRequest) {
  const supabaseAdmin = createServiceRoleClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: "Supabase admin client not initialised." },
      { status: 500, headers: noStoreHeaders }
    );
  }

  const requestedStaffId = request.nextUrl.searchParams.get("staffId");
  // Resolve the real logged-in staff first — do not trust client staffId for auth.
  const { staffId: authStaffId, isDeveloper } = await resolveApiStaffId(null);

  if (!authStaffId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders }
    );
  }

  const { data: authStaff, error: authStaffError } = await supabaseAdmin
    .from("staff")
    .select("id, role, n_team_type_id")
    .eq("id", authStaffId)
    .maybeSingle();

  if (authStaffError || !authStaff) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders }
    );
  }

  const wantAllStaff = requestedStaffId === "all" || requestedStaffId === "__all__";
  if (wantAllStaff) {
    const allowedAll =
      isDeveloper || isAdmin(authStaff.role) || isSuperAdmin(authStaff.role);
    if (!allowedAll) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403, headers: noStoreHeaders }
      );
    }
  }

  let targetStaffId: string | null = authStaffId;
  if (wantAllStaff) {
    targetStaffId = null; // no Main-PM filter — all qualifying projects
  } else if (requestedStaffId && requestedStaffId !== authStaffId) {
    const allowed = await canViewAsPm(
      supabaseAdmin,
      authStaff as StaffAuthRow,
      requestedStaffId,
      isDeveloper
    );
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403, headers: noStoreHeaders }
      );
    }
    targetStaffId = requestedStaffId;
  }

  try {
    const projects = await fetchMissingSiteStatusDeadlineProjects(supabaseAdmin, {
      ...(targetStaffId ? { mainPmId: targetStaffId } : {}),
    });
    return NextResponse.json(
      {
        success: true,
        projects,
        staffId: targetStaffId ?? "all",
      },
      { headers: noStoreHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[api/expense-locked/staff-deadline] error:", err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
