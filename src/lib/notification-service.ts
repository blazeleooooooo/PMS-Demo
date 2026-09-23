import { createClient } from "@/lib/supabase/client";
import type { NotificationDelivery } from "@/lib/notification-delivery";

export type NotificationType =
  | "info"
  | "warning"
  | "success"
  | "error"
  | "reminder"
  | "approval"
  | "payment"
  | "project_update";

export interface CreateNotificationPayload {
  recipient_staff_id: string;
  title: string;
  message?: string;
  type?: NotificationType;
  bwa_project_id?: string;
  bwf_project_id?: string;
  income_id?: string;
  expense_id?: string;
  link_url?: string;
  metadata?: Record<string, any>;
  /** Outbound channel results (WhatsApp, later email). */
  delivery?: NotificationDelivery;
}

/**
 * Create a system notification for a staff member.
 * Can attach linked entities (bwa_project, bwf_project, income, expense) for click-through navigation.
 *
 * @example
 * // Notify PM about a new income payment received
 * await createNotification({
 *   recipient_staff_id: pmStaffId,
 *   title: "收到新付款",
 *   message: "項目 BWA-2024-001 已收到 HK$50,000 付款",
 *   type: "payment",
 *   bwa_project_id: projectId,
 *   income_id: incomeId,
 * });
 */
export async function createNotification(payload: CreateNotificationPayload) {
  const supabase = createClient();

  const { data, error } = await supabase.from("notifications").insert({
    recipient_staff_id: payload.recipient_staff_id,
    title: payload.title,
    message: payload.message || null,
    type: payload.type || "info",
    bwa_project_id: payload.bwa_project_id || null,
    bwf_project_id: payload.bwf_project_id || null,
    income_id: payload.income_id || null,
    expense_id: payload.expense_id || null,
    link_url: payload.link_url || null,
    metadata: payload.metadata || {},
    delivery: payload.delivery || {},
  }).select().single();

  if (error) {
    console.error("[createNotification] Error:", error);
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Create notifications for multiple staff at once.
 *
 * @example
 * // Notify all PMs about an approval request
 * await createBulkNotifications(
 *   pmStaffIds.map(id => ({
 *     recipient_staff_id: id,
 *     title: "新審批請求",
 *     message: "項目 BWA-2024-001 需要您的審批",
 *     type: "approval",
 *     bwa_project_id: projectId,
 *   }))
 * );
 */
export async function createBulkNotifications(payloads: CreateNotificationPayload[]) {
  const supabase = createClient();

  const rows = payloads.map((p) => ({
    recipient_staff_id: p.recipient_staff_id,
    title: p.title,
    message: p.message || null,
    type: p.type || "info",
    bwa_project_id: p.bwa_project_id || null,
    bwf_project_id: p.bwf_project_id || null,
    income_id: p.income_id || null,
    expense_id: p.expense_id || null,
    link_url: p.link_url || null,
    metadata: p.metadata || {},
    delivery: p.delivery || {},
  }));

  const { data, error } = await supabase
    .from("notifications")
    .insert(rows)
    .select();

  if (error) {
    console.error("[createBulkNotifications] Error:", error);
    return { data: null, error };
  }

  return { data, error: null };
}
