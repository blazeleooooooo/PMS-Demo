import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { resolveApiStaffId } from "@/lib/supabase/resolve-api-staff";

export const dynamic = "force-dynamic";

function sanitizeErrorMessage(message: string): string {
  return message.replace(/\d{10,}([×x]\d+)?/g, "[internal_id]");
}

/**
 * POST /api/customers/merge
 * Body: { customerAId: string, customerBId: string, merged: Record<string, unknown> }
 *
 * Creates new customer C from merged scalars, moves all A/B related rows to C,
 * sets A and B Inactive. Requires authenticated user with clients edit permission.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { staffId } = await resolveApiStaffId();
  if (!staffId) {
    return NextResponse.json({ success: false, error: "Staff profile not found" }, { status: 403 });
  }

  const { data: allowed, error: permError } = await supabase.rpc("check_permission", {
    p_user_id: staffId,
    p_module: "clients",
    p_action: "edit",
  });

  if (permError) {
    console.error("[api/customers/merge] check_permission error:", permError.message);
    return NextResponse.json(
      { success: false, error: "Permission check failed" },
      { status: 500 }
    );
  }

  if (allowed === false) {
    return NextResponse.json(
      { success: false, error: "Missing clients edit permission" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { customerAId, customerBId, merged } = body as {
    customerAId?: unknown;
    customerBId?: unknown;
    merged?: unknown;
  };

  if (typeof customerAId !== "string" || !customerAId.trim()) {
    return NextResponse.json(
      { success: false, error: "Missing customerAId" },
      { status: 400 }
    );
  }
  if (typeof customerBId !== "string" || !customerBId.trim()) {
    return NextResponse.json(
      { success: false, error: "Missing customerBId" },
      { status: 400 }
    );
  }
  if (customerAId === customerBId) {
    return NextResponse.json(
      { success: false, error: "Cannot merge a customer with itself" },
      { status: 400 }
    );
  }
  if (!merged || typeof merged !== "object" || Array.isArray(merged)) {
    return NextResponse.json(
      { success: false, error: "Missing merged customer payload" },
      { status: 400 }
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Admin client not configured" },
      { status: 500 }
    );
  }

  const { data: newId, error } = await admin.rpc("merge_customers", {
    p_customer_a: customerAId,
    p_customer_b: customerBId,
    p_merged: merged,
  });

  if (error) {
    console.error("[api/customers/merge] RPC error:", error.message);
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(error.message) },
      { status: 400 }
    );
  }

  if (!newId || typeof newId !== "string") {
    return NextResponse.json(
      { success: false, error: "Merge did not return a new customer id" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: newId });
}
