import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveApiStaffId } from "@/lib/supabase/resolve-api-staff";
import {
  EXPENSE_CONTROL_ITEM_LABELS,
  INSTALLMENT_WAIVER_PERMISSION_MODULE,
  isInstallmentVsIncomeItemKey,
  waiverHasInstallmentVsIncomeItem,
} from "@/lib/expense-control-waiver-service";
import { notifyWaiverSubmitted } from "@/lib/expense-control-waiver-notify";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  filterRowsByStaffScope,
  getStaffRowScope,
  type StaffDataScope,
} from "@/lib/staff-data-scope";

export const dynamic = "force-dynamic";
/** Serial WhatsApp to ~10 approvers can exceed the 10s default; email must still run. */
export const maxDuration = 60;

async function getCallerStaff(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { staffId } = await resolveApiStaffId();
  if (!staffId) return null;
  const { data } = await supabase
    .from("staff")
    .select("id, name, role, n_team_type_id")
    .eq("id", staffId)
    .maybeSingle();
  return data;
}

async function fetchAssignedProjectIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("project_bv")
    .select("project_id")
    .eq("handler_id", staffId);
  if (error) {
    console.error("[api/expense-control-waivers] project_bv:", error.message);
    return new Set();
  }
  return new Set(
    (data ?? []).map((r) => r.project_id as string).filter(Boolean)
  );
}

/** GET — list waivers for the approval queue (role-based row filtering). */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const caller = await getCallerStaff(supabase);
  if (!caller) {
    return NextResponse.json({ error: "Staff not found" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const queue = request.nextUrl.searchParams.get("queue");
  const isInstallmentQueue = queue === "installment";

  if (isInstallmentQueue) {
    const { data: allowed, error: permError } = await supabase.rpc(
      "check_permission",
      {
        p_user_id: caller.id,
        p_module: INSTALLMENT_WAIVER_PERMISSION_MODULE,
        p_action: "view",
      }
    );
    if (permError) {
      console.error(
        "[api/expense-control-waivers GET] check_permission:",
        permError.message
      );
      return NextResponse.json(
        { error: "Permission check failed" },
        { status: 500 }
      );
    }
    if (allowed === false) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let query = supabase
    .from("expense_control_waivers")
    .select(
      `
      id, bwa_project_id, item_keys, reason, status, applicant_id, reviewer_id,
      reviewer_note, reviewed_at, created_at, updated_at,
      applicant:staff!expense_control_waivers_applicant_id_fkey(id, name),
      reviewer:staff!expense_control_waivers_reviewer_id_fkey(id, name),
      project:bwa_projects!expense_control_waivers_bwa_project_id_fkey(id, project_code, project_name, n_team_type_id, main_pm_id)
    `
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[api/expense-control-waivers GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Split queues: installment-vs-income only on admin page; others on team page.
  const queueFiltered = (data ?? []).filter((r: any) => {
    const hasInstallment = waiverHasInstallmentVsIncomeItem(r.item_keys);
    return isInstallmentQueue ? hasInstallment : !hasInstallment;
  });

  let rows = queueFiltered;

  // Installment queue is permission-gated at the page; show all matching rows.
  // Regular queue keeps role-based project row filtering.
  if (!isInstallmentQueue) {
    const staffScope: StaffDataScope = {
      staffId: caller.id,
      role: caller.role,
      teamTypeId: caller.n_team_type_id,
    };

    const rowScope = getStaffRowScope(caller.role);
    const assignedIds =
      rowScope === "all"
        ? new Set<string>()
        : await fetchAssignedProjectIds(supabase, caller.id);

    rows = filterRowsByStaffScope(queueFiltered, staffScope, (r: any) => {
      const projectId = r.bwa_project_id as string;
      return {
        teamTypeId: r.project?.n_team_type_id ?? null,
        isAssigned: assignedIds.has(projectId),
      };
    });
  }

  const items = rows.map((r: any) => ({
    id: r.id,
    bwa_project_id: r.bwa_project_id,
    item_keys: r.item_keys,
    item_labels: (r.item_keys as string[]).map(
      (k) => EXPENSE_CONTROL_ITEM_LABELS[k] ?? k
    ),
    reason: r.reason,
    status: r.status,
    applicant_id: r.applicant_id,
    applicant_name: r.applicant?.name ?? null,
    reviewer_id: r.reviewer_id,
    reviewer_name: r.reviewer?.name ?? null,
    reviewer_note: r.reviewer_note,
    reviewed_at: r.reviewed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    project_code: r.project?.project_code ?? null,
    project_name: r.project?.project_name ?? null,
    project_team_id: r.project?.n_team_type_id ?? null,
  }));

  return NextResponse.json({ items });
}

/** POST — create a waiver application + notify approvers. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const caller = await getCallerStaff(supabase);
  if (!caller) {
    return NextResponse.json({ error: "Staff not found" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { bwa_project_id, item_keys, reason } = (body ?? {}) as {
    bwa_project_id?: unknown;
    item_keys?: unknown;
    reason?: unknown;
  };

  if (typeof bwa_project_id !== "string" || !bwa_project_id) {
    return NextResponse.json({ error: "bwa_project_id required" }, { status: 400 });
  }
  if (!Array.isArray(item_keys) || item_keys.length === 0) {
    return NextResponse.json({ error: "item_keys required" }, { status: 400 });
  }
  const keys = [...new Set(item_keys.map((k) => String(k).trim()).filter(Boolean))];
  for (const k of keys) {
    if (!(k in EXPENSE_CONTROL_ITEM_LABELS)) {
      return NextResponse.json({ error: `Invalid item key: ${k}` }, { status: 400 });
    }
  }
  const hasInstallment = keys.some(isInstallmentVsIncomeItemKey);
  const hasOther = keys.some((k) => !isInstallmentVsIncomeItemKey(k));
  if (hasInstallment && hasOther) {
    return NextResponse.json(
      {
        error:
          "「支出總額」豁免須獨立申請，不可與其他 Expense Control 項目一併提交",
      },
      { status: 400 }
    );
  }
  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "reason required" }, { status: 400 });
  }

  const { data: project, error: projErr } = await supabase
    .from("bwa_projects")
    .select("id, project_code, project_name, n_team_type_id")
    .eq("id", bwa_project_id)
    .maybeSingle();

  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: row, error } = await supabase
    .from("expense_control_waivers")
    .insert({
      bwa_project_id,
      item_keys: keys,
      reason: reason.trim(),
      status: "pending",
      applicant_id: caller.id,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[api/expense-control-waivers POST]", error);
    const conflict =
      error.code === "23505" ||
      (error.message || "").toLowerCase().includes("already has");
    return NextResponse.json(
      { error: conflict ? "所選項目已有待審核或已批准的豁免申請" : error.message },
      { status: conflict ? 409 : 500 }
    );
  }

  // Notify — failures must not roll back the application.
  // Service role so staff.email / work_phone are readable regardless of RLS.
  try {
    const notifyClient = createServiceRoleClient() ?? supabase;
    await notifyWaiverSubmitted(notifyClient, {
      waiverId: row.id,
      bwaProjectId: bwa_project_id,
      projectCode: project.project_code,
      projectName: project.project_name,
      projectTeamId: project.n_team_type_id,
      applicantStaffId: caller.id,
      applicantName: caller.name,
      itemKeys: keys,
      reason: reason.trim(),
    });
  } catch (err) {
    console.error("[api/expense-control-waivers POST] notify:", err);
  }

  return NextResponse.json({ item: row }, { status: 201 });
}
