/** Outbound channel result stored on `notifications.delivery`. */
export type NotificationChannelStatus = "accepted" | "failed" | "skipped";

export type NotificationChannelResult = {
  status: NotificationChannelStatus;
  message_id?: string;
  error?: string;
  to?: string;
  sent_at: string;
};

export type NotificationDelivery = {
  whatsapp?: NotificationChannelResult;
  email?: NotificationChannelResult;
};

export function notificationChannelResult(
  status: NotificationChannelStatus,
  extra?: Omit<NotificationChannelResult, "status" | "sent_at">
): NotificationChannelResult {
  return {
    status,
    sent_at: new Date().toISOString(),
    ...extra,
  };
}
