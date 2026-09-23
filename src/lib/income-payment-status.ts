/** Canonical incomes.payment_status values for the approval workflow. */

export const INCOME_PENDING_CHECK = "Pending Check";
export const INCOME_RECEIVED = "Received";
export const INCOME_NOT_RECEIVED = "Not Received";
export const INCOME_BOUNCED = "Bounced Payment";
export const INCOME_ZOHO_COMPLETED = "Zoho Completed";

export const INCOME_DECISION_STATUSES = [
  INCOME_RECEIVED,
  INCOME_NOT_RECEIVED,
  INCOME_BOUNCED,
  INCOME_ZOHO_COMPLETED,
] as const;

export type IncomeDecisionStatus = (typeof INCOME_DECISION_STATUSES)[number];

export const INCOME_PAYMENT_STATUSES = [
  INCOME_PENDING_CHECK,
  INCOME_RECEIVED,
  INCOME_NOT_RECEIVED,
  INCOME_BOUNCED,
  INCOME_ZOHO_COMPLETED,
] as const;

export type IncomePaymentStatus = (typeof INCOME_PAYMENT_STATUSES)[number];

/** Dark green — accountant confirmed the payment is in Zoho. */
export const INCOME_ZOHO_COMPLETED_BADGE_CLASS =
  "bg-emerald-800 text-emerald-50 border-emerald-900";

const INCOME_PAYMENT_STATUS_BADGE_CLASS: Record<IncomePaymentStatus, string> = {
  [INCOME_PENDING_CHECK]: "bg-amber-50 text-amber-700 border-amber-200",
  [INCOME_RECEIVED]: "bg-emerald-50 text-emerald-700 border-emerald-200",
  [INCOME_NOT_RECEIVED]: "bg-red-50 text-red-700 border-red-200",
  [INCOME_BOUNCED]: "bg-rose-50 text-rose-800 border-rose-300",
  [INCOME_ZOHO_COMPLETED]: INCOME_ZOHO_COMPLETED_BADGE_CLASS,
};

export function normalizeIncomePaymentStatus(
  value: string | null | undefined
): IncomePaymentStatus | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = INCOME_PAYMENT_STATUSES.find(
    (s) => s.toLowerCase() === trimmed.toLowerCase()
  );
  return match ?? null;
}

export function incomePaymentStatusBadgeClass(
  value: string | null | undefined
): string {
  const normalized = normalizeIncomePaymentStatus(value);
  if (!normalized) return "bg-gray-50 text-gray-600 border-gray-200";
  return INCOME_PAYMENT_STATUS_BADGE_CLASS[normalized];
}

export function isIncomeReceived(
  value: string | null | undefined
): boolean {
  return normalizeIncomePaymentStatus(value) === INCOME_RECEIVED;
}

/** Received or Zoho Completed — payment is collected / settled. */
export function isIncomeSettled(
  value: string | null | undefined
): boolean {
  const normalized = normalizeIncomePaymentStatus(value);
  return normalized === INCOME_RECEIVED || normalized === INCOME_ZOHO_COMPLETED;
}

export function isIncomeDecisionStatus(
  value: string | null | undefined
): value is IncomeDecisionStatus {
  const normalized = normalizeIncomePaymentStatus(value);
  return (
    normalized === INCOME_RECEIVED ||
    normalized === INCOME_NOT_RECEIVED ||
    normalized === INCOME_BOUNCED ||
    normalized === INCOME_ZOHO_COMPLETED
  );
}

export function isIncomeApplyOrCancelStatus(
  value: string | null | undefined
): boolean {
  const normalized = normalizeIncomePaymentStatus(value);
  return normalized === null || normalized === INCOME_PENDING_CHECK;
}

/** Zoho Completed is a BWF-only input. */
export function isIncomeZohoCompleted(
  value: string | null | undefined
): boolean {
  return normalizeIncomePaymentStatus(value) === INCOME_ZOHO_COMPLETED;
}

/** Non-admin may only move between null and Pending Check. Zoho is BWF-only. */
export function canStaffSetIncomePaymentStatus(
  isAdmin: boolean,
  current: string | null | undefined,
  next: string | null | undefined,
  opts?: { allowZohoCompleted?: boolean }
): boolean {
  const nextNorm = normalizeIncomePaymentStatus(next);
  if (next != null && next.trim() !== "" && nextNorm === null) return false;
  if (nextNorm === INCOME_ZOHO_COMPLETED && !opts?.allowZohoCompleted) return false;
  if (isAdmin) return true;
  return isIncomeApplyOrCancelStatus(current) && isIncomeApplyOrCancelStatus(nextNorm);
}

export function incomeApproverStamp(
  next: string | null | undefined,
  staffId: string
): { approve_creator_id: string | null; approved_date: string | null } {
  if (isIncomeDecisionStatus(next)) {
    return {
      approve_creator_id: staffId,
      approved_date: new Date().toISOString(),
    };
  }
  return { approve_creator_id: null, approved_date: null };
}

/** Create may only persist null or Pending Check; decisions go through the API. */
export function incomeStatusForCreateInsert(
  requested: string | null | undefined
): string | null {
  return normalizeIncomePaymentStatus(requested) === INCOME_PENDING_CHECK
    ? INCOME_PENDING_CHECK
    : null;
}
