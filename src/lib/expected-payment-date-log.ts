import { getActingStaffId } from "@/lib/acting-staff";
import { toHkYmd } from "@/lib/date-utils";

export interface ExpectedPaymentDateLogEntry {
  previous_date: string | null;
  staff_id: string | null;
  changed_at: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseExpectedPaymentDateLog(raw: unknown): ExpectedPaymentDateLogEntry[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const entries: ExpectedPaymentDateLogEntry[] = [];
  for (const item of parsed) {
    const rec = asRecord(item);
    if (!rec) continue;
    const previousRaw =
      typeof rec.previous_date === "string" ? rec.previous_date : null;
    const staffRaw = typeof rec.staff_id === "string" ? rec.staff_id.trim() : "";
    const changedAt = typeof rec.changed_at === "string" ? rec.changed_at : "";
    entries.push({
      previous_date: toHkYmd(previousRaw),
      staff_id: staffRaw || null,
      changed_at: changedAt,
    });
  }
  return entries;
}

/** Last log entry's previous_date — the date before the latest change. */
export function latestPreviousExpectedPaymentDate(
  log: ExpectedPaymentDateLogEntry[]
): string | null {
  if (log.length === 0) return null;
  return log[log.length - 1]?.previous_date ?? null;
}

export function expectedPaymentDateChangeCount(
  log: ExpectedPaymentDateLogEntry[]
): number {
  return log.length;
}

export function formatExpectedPaymentLogDate(ymd: string | null | undefined): string {
  const normalized = toHkYmd(ymd);
  return normalized ? normalized.replace(/-/g, "/") : "—";
}

export function formatExpectedPaymentLogChangedAt(
  changedAt: string | null | undefined
): string {
  if (!changedAt?.trim()) return "—";
  const parsed = new Date(changedAt);
  if (Number.isNaN(parsed.getTime())) return changedAt;
  return parsed.toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 1-element hint consumed by trg_log_expected_payment_date (not persisted as-is). */
export function expectedPaymentDateLogStaffHint(
  staffId?: string | null
): Array<{ staff_id: string }> | undefined {
  const id = staffId?.trim();
  if (!id) return undefined;
  return [{ staff_id: id }];
}

export function attachExpectedPaymentDateLogHint(
  payload: Record<string, unknown>,
  staffId?: string | null
): void {
  const hint = expectedPaymentDateLogStaffHint(staffId ?? getActingStaffId());
  if (hint) payload.expected_payment_date_log = hint;
}
