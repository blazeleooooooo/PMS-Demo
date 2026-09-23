export const FINANCIAL_MASK = "—";

/** Designers must not see currency or BV amounts in the UI. */
export function canViewFinancialValues(
  position: string | null | undefined
): boolean {
  return position !== "Designer";
}

/** BV share ratios (佔比 %) are hidden from Designers and User-role staff. */
export function canViewBVPercentage(
  position: string | null | undefined,
  role: string | null | undefined
): boolean {
  if (position === "Designer") return false;
  if (role === "User") return false;
  return true;
}

export function formatBVRatioDisplay(
  ratio: number | null | undefined,
  canView: boolean
): string {
  return maskIfHidden(canView, () =>
    ratio != null ? `${ratio}%` : "-"
  );
}

export function maskIfHidden(
  canView: boolean,
  render: () => string
): string {
  return canView ? render() : FINANCIAL_MASK;
}

/** Format BV share (not currency — no $ prefix). */
export function formatBVValue(
  val: number | null | undefined,
  options?: { fallback?: string }
): string {
  const fallback = options?.fallback ?? "-";
  if (val == null || val === 0) return fallback;
  return val.toFixed(2);
}
