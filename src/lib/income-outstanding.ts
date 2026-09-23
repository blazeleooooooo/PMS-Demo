/**
 * Receivable "outstanding" for display/filter is always net of bad debts:
 *   net = outstanding - bad_debts
 * Rows with net <= 0 are treated as fully written off / not receivable.
 */

import { INCOME_RECEIVED, isIncomeSettled } from "@/lib/income-payment-status";

export type IncomeOutstandingFields = {
  outstanding?: number | null;
  bad_debts?: number | null;
};

/** Net receivable after bad-debt write-off (never negative). */
export function incomeNetOutstanding(row: IncomeOutstandingFields): number {
  const outstanding = Number(row.outstanding) || 0;
  const badDebts = Number(row.bad_debts) || 0;
  return Math.max(0, outstanding - badDebts);
}

/** Whether an income row should appear in outstanding-focused lists. */
export function hasReceivableOutstanding(row: IncomeOutstandingFields): boolean {
  return incomeNetOutstanding(row) > 0;
}

/** Canonical incomes.payment_status that means the installment is settled. */
export const INCOME_SETTLED_PAYMENT_STATUS = INCOME_RECEIVED;

/** True when payment_status is Received or Zoho Completed. */
export function isIncomeSettledByStatus(paymentStatus: string | null | undefined): boolean {
  return isIncomeSettled(paymentStatus);
}
