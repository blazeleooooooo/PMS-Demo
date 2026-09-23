/** Project incomes must stay at or above the project's estimated_income unless a reason is stored. */

function moneyToCents(value: number): number {
  return Math.round(value * 100);
}

export function normalizeIncomeBelowEstimatedReason(
  reason: string | null | undefined
): string | null {
  if (reason == null) return null;
  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasIncomeBelowEstimatedReason(
  reason: string | null | undefined
): boolean {
  return normalizeIncomeBelowEstimatedReason(reason) != null;
}

export type IncomeAmountRow = {
  id?: string | null;
  amount?: number | null;
};

export function otherProjectIncomeTotal(
  incomes: IncomeAmountRow[],
  excludeIncomeId?: string | null
): number {
  return incomes.reduce((sum, income) => {
    if (excludeIncomeId && income.id === excludeIncomeId) return sum;
    return sum + (Number(income.amount) || 0);
  }, 0);
}

export function isProjectIncomeBelowEstimated(
  projectedTotal: number,
  estimatedIncome: number | null | undefined
): boolean {
  if (estimatedIncome == null) return false;
  const estimated = Number(estimatedIncome);
  if (!Number.isFinite(estimated) || estimated <= 0) return false;
  return moneyToCents(projectedTotal) < moneyToCents(estimated);
}

export function formatEstimatedIncomeAmount(value: number): string {
  return value.toLocaleString("en-HK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function projectIncomeBelowEstimatedMessage(estimatedIncome: number): string {
  return `項目收入總額不可少於預計收入 $${formatEstimatedIncomeAmount(estimatedIncome)}`;
}

export function projectIncomeDeleteBlockedMessage(estimatedIncome: number): string {
  return `刪除此收入後，項目收入總額將少於預計收入 $${formatEstimatedIncomeAmount(estimatedIncome)}，因此無法刪除。`;
}

export const INCOME_BELOW_ESTIMATED_REASON_REQUIRED_MESSAGE = "請填寫收入少於預計之原因";
export const INCOME_BELOW_ESTIMATED_REASON_CLEARED_MESSAGE =
  "收入少於預計之原因已填寫，不可清空";
