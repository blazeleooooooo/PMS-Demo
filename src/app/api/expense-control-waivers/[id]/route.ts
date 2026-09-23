import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveApiStaffId } from "@/lib/supabase/resolve-api-staff";
import {
  INSTALLMENT_WAIVER_PERMISSION_MODULE,
  type WaiverStatus,
  waiverHasInstallmentVsIncomeItem,
} from "@/lib/expense-control-waiver-service";
import { notifyWaiverResult } from "@/lib/expense-control-waiver-notify";
import {
  getStaffRowScope,
  isRowVisibleToStaff,
  isSuperAdminRole,
} from "@/lib/staff-data-scope";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED: Record<string, WaiverStatus[]> = {
  approve: ["pending"],
  reject: ["pending"],
  revoke: ["approved"],
  /** Applicant (or scoped reviewer) withdraws a pending application. */
  cancel: ["pending"],
};

const ACTION_STATUS: Record<string, WaiverStatus> = {
  approve: "approved",
  reject: "rejected",
  revoke: "revoked",
  cancel: "revoked",
};

/** PATCH — approve / reject / revoke / cancel a waiver (+ notify when reviewed). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { staffId } = await resolveApiStaffId();
  if (!staffId) {
    return NextResponse.json({ error: "Staff not found" }, { status: 403 });
  }

  const { data: caller } = await supabase
    .from("staff")
    .select("id, name, role, n_team_type_id")
    .eq("id", staffId)
    .maybeSingle();

  if (!caller) {
    return NextResponse.json({ error: "Staff not found" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, reviewer_note } = (body ?? {}) as {
    action?: unknown;
    reviewer_note?: unknown;
  };

  if (typeof action !== "string" || !(action in ACTION_STATUS)) {
    return NextResponse.json(
      { error: "action must be approve | reject | revoke | cancel" },
      { status: 400 }
    );
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("expense_control_waivers")
    .select(
      `
      id, bwa_project_id, item_keys, status, applicant_id,
      project:bwa_projects!expense_control_waivers_bwa_project_id_fkey(id, project_code, project_name, n_team_type_id)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const project = existing.project as unknown as {
    id: string;
    project_code: string | null;
    project_name: string | null;
    n_team_type_id: string | null;
  } | null;

  const isApplicant = existing.applicant_id === caller.id;
  const isCancelByApplicant = action === "cancel" && isApplicant;

  // Applicants cannot approve their own waiver. Super Admin may override.
  if (action === "approve" && isApplicant && !isSuperAdminRole(caller.role)) {
    return NextResponse.json(
      { error: "不可批准自己的申請" },
      { status: 403 }
    );
  }
  const isInstallmentWaiver = waiverHasInstallmentVsIncomeItem(
    existing.item_keys as string[]
  );

  // Applicant may cancel their own pending application without senior scope.
  // Installment-vs-income reviews require admin.expense-installment-waivers edit.
  // Other waivers keep role-based data-scope visibility.
  if (!isCancelByApplicant) {
    if (isInstallmentWaiver) {
      if (action !== "cancel") {
        const { data: allowed, error: permError } = await supabase.rpc(
          "check_permission",
          {
            p_user_id: caller.id,
            p_module: INSTALLMENT_WAIVER_PERMISSION_MODULE,
            p_action: "edit",
          }
        );
        if (permError) {
          console.error(
            "[api/expense-control-waivers PATCH] check_permission:",
            permError.message
          );
          return NextResponse.json(
            { error: "Permission check failed" },
            { status: 500 }
          );
        }
        if (allowed === false) {
          return NextResponse.json(
            { error: "Forbidden (installment waiver permission)" },
            { status: 403 }
          );
        }
      }
    } else {
      const rowScope = getStaffRowScope(caller.role);
      let isAssigned = false;
      if (rowScope !== "all") {
        const { data: bv } = await supabase
          .from("project_bv")
          .select("project_id")
          .eq("handler_id", caller.id)
          .eq("project_id", existing.bwa_project_id)
          .limit(1)
          .maybeSingle();
        isAssigned = !!bv?.project_id;
      }

      if (
        !isRowVisibleToStaff(rowScope, {
          staffTeamTypeId: caller.n_team_type_id,
          rowTeamTypeId: project?.n_team_type_id ?? null,
          isAssigned,
        })
      ) {
        return NextResponse.json({ error: "Forbidden (data scope)" }, { status: 403 });
      }

      // Approve / reject / revoke still require Senior User+ (or company-wide roles).
      if (action !== "cancel") {
        const scope = getStaffRowScope(caller.role);
        if (scope === "assigned_only") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }
  }

  const allowedFrom = ALLOWED[action];
  if (!allowedFrom.includes(existing.status as WaiverStatus)) {
    return NextResponse.json(
      { error: `Cannot ${action} when status is ${existing.status}` },
      { status: 409 }
    );
  }

  const nextStatus = ACTION_STATUS[action];
  const trimmedNote =
    typeof reviewer_note === "string" ? reviewer_note.trim() : "";
  if (action === "reject" && !trimmedNote) {
    return NextResponse.json(
      { error: "拒絕豁免時必須填寫審核備註" },
      { status: 400 }
    );
  }
  const note =
    trimmedNote ||
    (action === "cancel" ? "申請人撤回" : null);

  const { data: updated, error: updateErr } = await supabase
    .from("expense_control_waivers")
    .update({
      status: nextStatus,
      reviewer_id: caller.id,
      reviewer_note: note,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr) {
    console.error("[api/expense-control-waivers PATCH]", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Applicant self-cancel: no notification. Reviewer revoke/approve/reject: notify.
  if (action !== "cancel") {
    try {
      await notifyWaiverResult(supabase, {
        waiverId: id,
        bwaProjectId: existing.bwa_project_id,
        projectCode: project?.project_code ?? null,
        projectName: project?.project_name ?? null,
        applicantStaffId: existing.applicant_id,
        status: nextStatus as "approved" | "rejected" | "revoked",
        reviewerNote: note,
      });
    } catch (err) {
      console.error("[api/expense-control-waivers PATCH] notify:", err);
    }
  }

  return NextResponse.json({ item: updated });
}
