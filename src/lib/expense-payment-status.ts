/** Canonical expenses.payment_status values for the approval workflow. */

export const EXPENSE_PENDING_CHECK = "Pending Check";
export const EXPENSE_APPROVED = "Approved";
export const EXPENSE_REJECTED = "Rejected";
export const EXPENSE_ZOHO_COMPLETED = "Zoho Completed";

export const EXPENSE_DECISION_STATUSES = [
  EXPENSE_APPROVED,
  EXPENSE_REJECTED,
  EXPENSE_ZOHO_COMPLETED,
] as const;

export type ExpenseDecisionStatus = (typeof EXPENSE_DECISION_STATUSES)[number];

export const EXPENSE_PAYMENT_STATUSES = [
  EXPENSE_PENDING_CHECK,
  EXPENSE_APPROVED,
  EXPENSE_REJECTED,
  EXPENSE_ZOHO_COMPLETED,
] as const;

export type ExpensePaymentStatus = (typeof EXPENSE_PAYMENT_STATUSES)[number];

/** Dark green — accountant confirmed the payment is in Zoho. */
export const EXPENSE_ZOHO_COMPLETED_BADGE_CLASS =
  "bg-emerald-800 text-emerald-50 border-emerald-900";

const EXPENSE_PAYMENT_STATUS_BADGE_CLASS: Record<ExpensePaymentStatus, string> = {
  [EXPENSE_PENDING_CHECK]: "bg-amber-50 text-amber-700 border-amber-200",
  [EXPENSE_APPROVED]: "bg-emerald-50 text-emerald-700 border-emerald-200",
  [EXPENSE_REJECTED]: "bg-red-50 text-red-700 border-red-200",
  [EXPENSE_ZOHO_COMPLETED]: EXPENSE_ZOHO_COMPLETED_BADGE_CLASS,
};

export function normalizeExpensePaymentStatus(
  value: string | null | undefined
): ExpensePaymentStatus | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = EXPENSE_PAYMENT_STATUSES.find(
    (s) => s.toLowerCase() === trimmed.toLowerCase()
  );
  return match ?? null;
}

export function expensePaymentStatusBadgeClass(
  value: string | null | undefined
): string {
  const normalized = normalizeExpensePaymentStatus(value);
  if (!normalized) return "bg-gray-50 text-gray-600 border-gray-200";
  return EXPENSE_PAYMENT_STATUS_BADGE_CLASS[normalized];
}

export function isExpenseApproved(
  value: string | null | undefined
): boolean {
  return normalizeExpensePaymentStatus(value) === EXPENSE_APPROVED;
}

/** Approved or Zoho Completed — payment is settled / entered in accounting. */
export function isExpenseSettled(
  value: string | null | undefined
): boolean {
  const normalized = normalizeExpensePaymentStatus(value);
  return normalized === EXPENSE_APPROVED || normalized === EXPENSE_ZOHO_COMPLETED;
}

export function isExpenseDecisionStatus(
  value: string | null | undefined
): value is ExpenseDecisionStatus {
  const normalized = normalizeExpensePaymentStatus(value);
  return (
    normalized === EXPENSE_APPROVED ||
    normalized === EXPENSE_REJECTED ||
    normalized === EXPENSE_ZOHO_COMPLETED
  );
}

export function isExpenseApplyOrCancelStatus(
  value: string | null | undefined
): boolean {
  const normalized = normalizeExpensePaymentStatus(value);
  return normalized === null || normalized === EXPENSE_PENDING_CHECK;
}

/** Zoho Completed is a BWF-only input. */
export function isExpenseZohoCompleted(
  value: string | null | undefined
): boolean {
  return normalizeExpensePaymentStatus(value) === EXPENSE_ZOHO_COMPLETED;
}

/** Non-admin may only move between null and Pending Check. Zoho is BWF-only. */
export function canStaffSetExpensePaymentStatus(
  isAdmin: boolean,
  current: string | null | undefined,
  next: string | null | undefined,
  opts?: { allowZohoCompleted?: boolean }
): boolean {
  const nextNorm = normalizeExpensePaymentStatus(next);
  if (next != null && next.trim() !== "" && nextNorm === null) return false;
  if (nextNorm === EXPENSE_ZOHO_COMPLETED && !opts?.allowZohoCompleted) return false;
  if (isAdmin) return true;
  return isExpenseApplyOrCancelStatus(current) && isExpenseApplyOrCancelStatus(nextNorm);
}

export function expenseApproverStamp(
  next: string | null | undefined,
  staffId: string
): { approve_creator_id: string | null; approved_date: string | null } {
  if (isExpenseDecisionStatus(next)) {
    return {
      approve_creator_id: staffId,
      approved_date: new Date().toISOString(),
    };
  }
  return { approve_creator_id: null, approved_date: null };
}

/** Create may only persist null or Pending Check; decisions go through the API. */
export function expenseStatusForCreateInsert(
  requested: string | null | undefined
): string | null {
  return normalizeExpensePaymentStatus(requested) === EXPENSE_PENDING_CHECK
    ? EXPENSE_PENDING_CHECK
    : null;
}
