import type { SupabaseClient } from "@supabase/supabase-js";
import { EmailApiError, EmailConfigError, sendEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/get-site-url";
import {
  notificationChannelResult,
  type NotificationChannelResult,
  type NotificationDelivery,
} from "@/lib/notification-delivery";
import {
  normalizeWhatsAppPhone,
  sendWhatsAppTemplateMessage,
} from "@/lib/whatsapp";
import {
  INSTALLMENT_WAIVER_PERMISSION_MODULE,
  INSTALLMENT_WAIVER_QUEUE_PATH,
  labelForWaiverItems,
  waiverHasInstallmentVsIncomeItem,
  type WaiverStatus,
} from "@/lib/expense-control-waiver-service";
import { splitWaiverEmailRecipients } from "@/lib/expense-control-waiver-email";
import {
  isCompanyWideScope,
  isTeamOrAssignedScope,
} from "@/lib/staff-data-scope";

/** Meta UTILITY templates — must be APPROVED on the WABA before production use. */
export const WAIVER_WHATSAPP_TEMPLATES = {
  request: {
    name: "expense_control_waiver_request",
    language: "zh_HK",
  },
  result: {
    name: "expense_control_waiver_result",
    language: "zh_HK",
  },
} as const;

type StaffNotifyRow = {
  id: string;
  name: string | null;
  role: string | null;
  email: string | null;
  work_phone: string | null;
  n_team_type_id: string | null;
};

const STAFF_NOTIFY_SELECT =
  "id, name, role, email, work_phone, n_team_type_id";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendWaiverSubmittedEmailSafe(input: {
  waiverId: string;
  title: string;
  message: string;
  linkUrl: string;
  to: string[];
  cc: string[];
}): Promise<NotificationChannelResult> {
  if (input.to.length === 0) {
    console.error("[waiver-notify] email skipped: no_email_recipients");
    return notificationChannelResult("skipped", { error: "no_email_recipients" });
  }
  const absLink = `${getSiteUrl()}${input.linkUrl}`;
  const text = `${input.message}\n\n${absLink}`;
  const html = `<p>${escapeHtml(input.message)}</p><p><a href="${escapeHtml(absLink)}">${escapeHtml(absLink)}</a></p>`;
  try {
    const result = await sendEmail({
      to: input.to,
      cc: input.cc,
      subject: input.title,
      text,
      html,
      idempotencyKey: `waiver-submitted/${input.waiverId}`,
    });
    return notificationChannelResult("accepted", {
      message_id: result.id,
      to: [...input.to, ...input.cc].join(","),
    });
  } catch (err) {
    const error =
      err instanceof EmailConfigError || err instanceof EmailApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("[waiver-notify] email failed:", error);
    return notificationChannelResult("failed", { error });
  }
}

async function insertInApp(
  supabase: SupabaseClient,
  payload: {
    recipient_staff_id: string;
    title: string;
    message: string;
    type: string;
    bwa_project_id: string;
    link_url: string;
    metadata?: Record<string, unknown>;
    delivery?: NotificationDelivery;
  }
) {
  const { error } = await supabase.from("notifications").insert({
    recipient_staff_id: payload.recipient_staff_id,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    bwa_project_id: payload.bwa_project_id,
    link_url: payload.link_url,
    metadata: payload.metadata ?? {},
    delivery: payload.delivery ?? {},
  });
  if (error) {
    console.error("[waiver-notify] in-app insert failed:", error.message);
  }
}

async function sendTemplateSafe(
  to: string | null | undefined,
  templateName: string,
  languageCode: string,
  bodyParameters: string[]
): Promise<NotificationChannelResult> {
  const phone = to ? normalizeWhatsAppPhone(to) : "";
  if (!phone) {
    return notificationChannelResult("skipped", { error: "no_phone" });
  }
  try {
    const result = await sendWhatsAppTemplateMessage({
      to: phone,
      templateName,
      languageCode,
      bodyParameters: bodyParameters.map((text) => ({
        type: "text",
        text: text || "-",
      })),
    });
    return notificationChannelResult("accepted", {
      message_id: result.messageId,
      to: phone,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[waiver-notify] WhatsApp template failed:", error);
    return notificationChannelResult("failed", { error, to: phone });
  }
}

/**
 * Notify staff who can see this project's waiver under role-based row filtering
 * at team-or-above (company-wide + same-team Senior User). Assigned-only Users
 * are not auto-notified — approval authority is gated by /admin/permissions.
 */
export async function resolveWaiverApproverStaff(
  supabase: SupabaseClient,
  projectTeamId: string | null,
  applicantStaffId: string
): Promise<StaffNotifyRow[]> {
  const { data: activeStaff, error } = await supabase
    .from("staff")
    .select(STAFF_NOTIFY_SELECT)
    .eq("status", "Active");

  if (error) {
    console.error("[waiver-notify] staff fetch:", error.message);
    return [];
  }

  const byId = new Map<string, StaffNotifyRow>();
  for (const s of activeStaff ?? []) {
    if (s.id === applicantStaffId) continue;
    if (isCompanyWideScope(s.role)) {
      byId.set(s.id, s as StaffNotifyRow);
      continue;
    }
    if (
      isTeamOrAssignedScope(s.role) &&
      projectTeamId &&
      s.n_team_type_id &&
      s.n_team_type_id === projectTeamId
    ) {
      byId.set(s.id, s as StaffNotifyRow);
    }
  }
  return [...byId.values()];
}

/**
 * Approvers for installment-vs-income waivers — staff with edit on
 * admin.expense-installment-waivers (matrix-driven; fail-open roster filtered).
 */
export async function resolveInstallmentWaiverApproverStaff(
  supabase: SupabaseClient,
  applicantStaffId: string
): Promise<StaffNotifyRow[]> {
  const { data: roster, error } = await supabase.rpc("get_module_view_roster", {
    p_module: INSTALLMENT_WAIVER_PERMISSION_MODULE,
    p_action: "edit",
  });
  if (error) {
    console.error("[waiver-notify] installment roster:", error.message);
    return [];
  }

  const allowedIds = (roster ?? [])
    .filter((r: { can_view?: boolean; staff_id?: string }) => r.can_view && r.staff_id)
    .map((r: { staff_id: string }) => r.staff_id)
    .filter((id: string) => id !== applicantStaffId);

  if (allowedIds.length === 0) return [];

  const { data: staffRows, error: staffErr } = await supabase
    .from("staff")
    .select(STAFF_NOTIFY_SELECT)
    .in("id", allowedIds)
    .eq("status", "Active");

  if (staffErr) {
    console.error("[waiver-notify] installment staff:", staffErr.message);
    return [];
  }
  return (staffRows ?? []) as StaffNotifyRow[];
}

export async function notifyWaiverSubmitted(
  supabase: SupabaseClient,
  input: {
    waiverId: string;
    bwaProjectId: string;
    projectCode: string | null;
    projectName: string | null;
    projectTeamId: string | null;
    applicantStaffId: string;
    applicantName: string | null;
    itemKeys: string[];
    reason: string;
  }
): Promise<void> {
  const itemSummary = labelForWaiverItems(input.itemKeys).slice(0, 200);
  const projectLabel =
    input.projectCode || input.projectName || input.bwaProjectId.slice(0, 8);
  const applicant = input.applicantName || "同事";
  const isInstallment = waiverHasInstallmentVsIncomeItem(input.itemKeys);
  const title = isInstallment
    ? "支出總額豁免申請待審核"
    : "支出鎖定豁免申請待審核";
  const message = `${applicant} 為項目 ${projectLabel} 申請豁免：${itemSummary}。原因：${input.reason.slice(0, 120)}`;
  const linkUrl = isInstallment
    ? INSTALLMENT_WAIVER_QUEUE_PATH
    : "/expense-control-waivers";
  const whatsappHint = isInstallment
    ? "請前往 PMS「支出總額豁免」審核"
    : "請前往 PMS「支出鎖定豁免」審核";

  const approvers = isInstallment
    ? await resolveInstallmentWaiverApproverStaff(
        supabase,
        input.applicantStaffId
      )
    : await resolveWaiverApproverStaff(
        supabase,
        input.projectTeamId,
        input.applicantStaffId
      );

  // Email first — sequential WhatsApp to ~10 approvers already takes ~12s and
  // used to starve this send when the route hit Vercel's default time limit.
  const { to, cc } = splitWaiverEmailRecipients(
    approvers,
    input.projectTeamId
  );
  const email = await sendWaiverSubmittedEmailSafe({
    waiverId: input.waiverId,
    title,
    message,
    linkUrl,
    to,
    cc,
  });

  await Promise.all(
    approvers.map(async (staff) => {
      const whatsapp = await sendTemplateSafe(
        staff.work_phone,
        WAIVER_WHATSAPP_TEMPLATES.request.name,
        WAIVER_WHATSAPP_TEMPLATES.request.language,
        [projectLabel, applicant, itemSummary, whatsappHint]
      );
      await insertInApp(supabase, {
        recipient_staff_id: staff.id,
        title,
        message,
        type: "approval",
        bwa_project_id: input.bwaProjectId,
        link_url: linkUrl,
        metadata: { waiver_id: input.waiverId },
        delivery: { whatsapp, email },
      });
    })
  );
}

export async function notifyWaiverResult(
  supabase: SupabaseClient,
  input: {
    waiverId: string;
    bwaProjectId: string;
    projectCode: string | null;
    projectName: string | null;
    applicantStaffId: string;
    status: Extract<WaiverStatus, "approved" | "rejected" | "revoked">;
    reviewerNote: string | null;
  }
): Promise<void> {
  const projectLabel =
    input.projectCode || input.projectName || input.bwaProjectId.slice(0, 8);
  const statusLabel =
    input.status === "approved"
      ? "已批准"
      : input.status === "rejected"
        ? "已拒絕"
        : "已撤銷";
  const type =
    input.status === "approved" ? "success" : ("warning" as const);
  const title = `支出鎖定豁免${statusLabel}`;
  const note = (input.reviewerNote || "").trim() || "—";
  const message = `項目 ${projectLabel} 的豁免申請${statusLabel}。${
    input.reviewerNote ? `備註：${input.reviewerNote.slice(0, 120)}` : ""
  }`;
  const linkUrl = `/projects/bwa/${input.bwaProjectId}`;

  const { data: applicant } = await supabase
    .from("staff")
    .select("id, name, work_phone")
    .eq("id", input.applicantStaffId)
    .maybeSingle();

  if (!applicant) return;

  const whatsapp = await sendTemplateSafe(
    applicant.work_phone,
    WAIVER_WHATSAPP_TEMPLATES.result.name,
    WAIVER_WHATSAPP_TEMPLATES.result.language,
    [projectLabel, statusLabel, note]
  );
  await insertInApp(supabase, {
    recipient_staff_id: applicant.id,
    title,
    message,
    type,
    bwa_project_id: input.bwaProjectId,
    link_url: linkUrl,
    metadata: { waiver_id: input.waiverId, status: input.status },
    delivery: { whatsapp },
  });
}
