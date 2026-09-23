import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveApiStaffId } from "@/lib/supabase/resolve-api-staff";
import { isAdminOrAboveRole } from "@/lib/staff-data-scope";
import {
  canStaffSetIncomePaymentStatus,
  incomeApproverStamp,
  normalizeIncomePaymentStatus,
} from "@/lib/income-payment-status";

export const dynamic = "force-dynamic";

/** PATCH — set incomes.payment_status with role + stamp rules. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing income id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = (body ?? {}) as {
    payment_status?: unknown;
    staff_id?: unknown;
  };

  if (!("payment_status" in payload)) {
    return NextResponse.json({ error: "payment_status is required" }, { status: 400 });
  }

  const rawStatus = payload.payment_status;
  if (rawStatus !== null && typeof rawStatus !== "string") {
    return NextResponse.json({ error: "payment_status must be a string or null" }, { status: 400 });
  }

  const nextStatus =
    rawStatus === null || rawStatus === ""
      ? null
      : normalizeIncomePaymentStatus(rawStatus);
  if (rawStatus !== null && rawStatus !== "" && nextStatus === null) {
    return NextResponse.json({ error: "Invalid payment_status" }, { status: 400 });
  }

  const requestedStaffId =
    typeof payload.staff_id === "string" ? payload.staff_id : null;
  const { staffId } = await resolveApiStaffId(requestedStaffId);
  if (!staffId) {
    return NextResponse.json({ error: "Staff not found" }, { status: 403 });
  }

  const { data: caller } = await supabase
    .from("staff")
    .select("id, role")
    .eq("id", staffId)
    .maybeSingle();
  if (!caller) {
    return NextResponse.json({ error: "Staff not found" }, { status: 403 });
  }

  const { data: income, error: fetchErr } = await supabase
    .from("incomes")
    .select("id, payment_status, bwf_project_id")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr || !income) {
    return NextResponse.json({ error: "Income not found" }, { status: 404 });
  }

  const isAdmin = isAdminOrAboveRole(caller.role);
  const allowZohoCompleted = !!income.bwf_project_id;
  if (!canStaffSetIncomePaymentStatus(isAdmin, income.payment_status, nextStatus, { allowZohoCompleted })) {
    return NextResponse.json(
      { error: "無權限變更此收款狀態" },
      { status: 403 }
    );
  }

  const stamp = incomeApproverStamp(nextStatus, staffId);
  const { data: updated, error: updateErr } = await supabase
    .from("incomes")
    .update({
      payment_status: nextStatus,
      approve_creator_id: stamp.approve_creator_id,
      approved_date: stamp.approved_date,
      modified_date: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, payment_status, approve_creator_id, approved_date")
    .maybeSingle();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message || "更新失敗" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, income: updated });
}
