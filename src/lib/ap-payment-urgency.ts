import { todayHkYmd, toHkYmd } from "@/lib/date-utils";

export const AP_URGENCY_URGENT = "urgent" as const;
export const AP_URGENCY_NORMAL = "normal" as const;
export const AP_URGENCY_LARGE_AMOUNT = "large_amount" as const;

export type ApUrgencyBadge =
  | typeof AP_URGENCY_URGENT
  | typeof AP_URGENCY_NORMAL
  | typeof AP_URGENCY_LARGE_AMOUNT;

export type ApUrgencyFilter = ApUrgencyBadge | null;

export const AP_LARGE_AMOUNT_THRESHOLD = 30_000;

export const AP_URGENCY_FILTER_OPTIONS: {
  value: Exclude<ApUrgencyFilter, null>;
  label: string;
  shortLabel: string;
}[] = [
  { value: AP_URGENCY_URGENT, label: "緊急, 要安排開工", shortLabel: "緊急" },
  { value: AP_URGENCY_NORMAL, label: "一般 3-7日就可以", shortLabel: "一般" },
  { value: AP_URGENCY_LARGE_AMOUNT, label: "金額比較大, 早申請", shortLabel: "金額較大" },
];

function hkCalendarDays(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split("-").map(Number);
  const [y2, m2, d2] = toYmd.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** HK calendar days of `today − expected_payment_date`. Null if the date is missing. */
export function daysSinceExpectedPayment(
  expectedPaymentDate: string | null | undefined,
  todayYmd: string = todayHkYmd()
): number | null {
  const expectedYmd = toHkYmd(expectedPaymentDate);
  if (!expectedYmd) return null;
  return hkCalendarDays(expectedYmd, todayYmd);
}

export function isLargeApInstallment(amount: number | null | undefined): boolean {
  return (Number(amount) || 0) > AP_LARGE_AMOUNT_THRESHOLD;
}

/**
 * AP 緊急程度 badges. Date windows use today − expected_payment_date (HK):
 * 緊急 = [0, 3), 一般 = [3, 7). 金額較大 stacks independently.
 */
export function getApUrgencyBadges(
  row: {
    expected_payment_date?: string | null;
    installment_amount?: number | null;
  },
  todayYmd: string = todayHkYmd()
): ApUrgencyBadge[] {
  const badges: ApUrgencyBadge[] = [];
  const days = daysSinceExpectedPayment(row.expected_payment_date, todayYmd);
  if (days != null && days >= 0 && days < 3) badges.push(AP_URGENCY_URGENT);
  else if (days != null && days >= 3 && days < 7) badges.push(AP_URGENCY_NORMAL);
  if (isLargeApInstallment(row.installment_amount)) {
    badges.push(AP_URGENCY_LARGE_AMOUNT);
  }
  return badges;
}

export function rowMatchesApUrgencyFilter(
  row: {
    expected_payment_date?: string | null;
    installment_amount?: number | null;
  },
  filter: ApUrgencyFilter,
  todayYmd: string = todayHkYmd()
): boolean {
  if (filter == null) return true;
  return getApUrgencyBadges(row, todayYmd).includes(filter);
}
