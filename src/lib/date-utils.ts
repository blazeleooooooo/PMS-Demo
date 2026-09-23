/**
 * BW PMS — Centralized Date Formatting Utilities
 * ================================================
 * 
 * Since migration 20250730: ALL date columns are TIMESTAMPTZ in Supabase.
 * There is only ONE type of date value now:
 * 
 * TIMESTAMPTZ — e.g. "2024-03-15T16:00:00.000Z"
 *   - These are correct UTC timestamps from Bubble.io API
 *   - Display always uses Asia/Hong_Kong (do not rely on the browser timezone)
 *   - Use: formatDateTime() for date display, formatTimestamp() for date+time
 * 
 * LEGACY: Some date-only strings ("2024-03-16") may still exist in older data.
 *         The formatDate() smart formatter handles both formats automatically.
 *         formatDateOnly() is preserved for backward compatibility.
 * 
 * RECOMMENDED:
 *   - Use formatDate() as default — auto-detects format
 *   - Use formatDateTime() when you know it's a TIMESTAMPTZ
 *   - Use formatDateOnly() only for explicit YYYY-MM-DD strings (rare/legacy)
 */

import { isIncomeSettled } from "@/lib/income-payment-status";

const HK_TIMEZONE = "Asia/Hong_Kong";

// ─── FULL TIMESTAMP FORMATTERS (UTC → Hong Kong) ──────────

/**
 * Format a full ISO timestamp string for display in Asia/Hong_Kong.
 *
 * Input: "2024-03-15T14:00:00.000Z" (UTC)
 * Output: "2024年3月15日" or "15/3/2024" depending on options
 */
export function formatDateTime(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("zh-HK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
      timeZone: HK_TIMEZONE,
    });
  } catch {
    return dateStr || "-";
  }
}

/**
 * Format a full ISO timestamp with time portion in Asia/Hong_Kong.
 *
 * Input: "2024-03-15T14:00:00.000Z" (UTC)
 * Output: "2024年3月15日 下午10:00"
 */
export function formatTimestamp(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("zh-HK", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...options,
      timeZone: HK_TIMEZONE,
    });
  } catch {
    return dateStr || "-";
  }
}

/**
 * Compact date+time in Asia/Hong_Kong: "09/09/2026 下午02:28"
 */
export function formatHongKongDateTime(
  dateStr: string | null | undefined
): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("zh-HK", {
      timeZone: HK_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a full ISO timestamp as a short date: YYYY/MM/DD (Asia/Hong_Kong).
 */
export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const year = d.toLocaleDateString("en-CA", { year: "numeric", timeZone: HK_TIMEZONE });
    const month = d.toLocaleDateString("en-CA", { month: "2-digit", timeZone: HK_TIMEZONE });
    const day = d.toLocaleDateString("en-CA", { day: "2-digit", timeZone: HK_TIMEZONE });
    return `${year}/${month}/${day}`;
  } catch {
    return dateStr || "-";
  }
}

/** Compact date in Asia/Hong_Kong: "2026/09/09". Date-only YYYY-MM-DD is kept as-is. */
export function formatHongKongDate(
  dateStr: string | null | undefined
): string {
  const ymd = toHkYmd(dateStr);
  return ymd ? ymd.replace(/-/g, "/") : "—";
}

// ─── DATE-ONLY FORMATTERS (Legacy — preserved for backward compat) ──

/**
 * Format a date-only string (YYYY-MM-DD) for display.
 * LEGACY: Before migration 20250730, dt() stored dates as YYYY-MM-DD TEXT.
 * Now all dates are TIMESTAMPTZ, but this function is kept for backward compatibility.
 * If the input is actually a full timestamp (has "T"), it delegates to formatDateTime().
 * We must NOT let JavaScript shift the date by timezone.
 * 
 * Input: "2024-03-16" (HK date)
 * Output: "2024年3月16日"
 */
export function formatDateOnly(
  dateStr: string | null | undefined,
  options?: { format?: "long" | "short" | "numeric" }
): string {
  if (!dateStr) return "-";
  try {
    // For date-only strings (YYYY-MM-DD), parse manually to avoid TZ shift
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      const y = parseInt(year);
      const m = parseInt(month);
      const d = parseInt(day);

      if (options?.format === "numeric" || options?.format === "short") {
        return `${year}/${month}/${day}`;
      }

      // Chinese long format
      return `${y}年${m}月${d}日`;
    }

    // If it's actually a full timestamp (has "T" or timezone indicator), use formatDateTime
    if (dateStr.includes("T") || dateStr.includes("+") || dateStr.includes("Z")) {
      return formatDateTime(dateStr);
    }

    return dateStr;
  } catch {
    return dateStr || "-";
  }
}

// ─── SMART FORMATTER (auto-detects type) ──────────────────────

/**
 * Smart date formatter that auto-detects whether the value is:
 * - A full ISO timestamp / TIMESTAMPTZ → formats in Asia/Hong_Kong
 * - A date-only string → formats as-is (legacy HK date)
 * 
 * RECOMMENDED: Use this as your default date formatter.
 * Since migration 20250730, most values will be full timestamps.
 */
export function formatDate(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "-";
  try {
    // Check if it's a date-only string (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return formatDateOnly(dateStr);
    }

    // It's a full timestamp — Asia/Hong_Kong
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("zh-HK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
      timeZone: HK_TIMEZONE,
    });
  } catch {
    return dateStr || "-";
  }
}

// ─── RELATIVE TIME ────────────────────────────────────────────

/**
 * Returns a relative time string like "3 小時前", "2 天前", etc.
 * Works with full ISO timestamps. Uses browser timezone internally.
 */
export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "剛才";
    if (diffMins < 60) return `${diffMins} 分鐘前`;
    if (diffHours < 24) return `${diffHours} 小時前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} 週前`;

    return formatDate(dateStr);
  } catch {
    return dateStr || "-";
  }
}

// ─── UTILITY ──────────────────────────────────────────────────

/**
 * Get today's date in YYYY-MM-DD format in user's local timezone.
 * Useful for default date picker values.
 */
export function getTodayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert a Date object to ISO string preserving the intent
 * (for saving new records to Supabase).
 * Since all date columns are now TIMESTAMPTZ, this is the standard save method.
 */
export function toUTCTimestamp(d: Date): string {
  return d.toISOString();
}

/**
 * Convert a stored date/timestamp to YYYY-MM-DD for `<input type="date">`.
 * TIMESTAMPTZ values must not be passed through raw — the control renders blank.
 */
export function toDateInputValue(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = parseDate(trimmed);
  if (d) return toDateOnlyString(d);
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

/** Today's calendar date in Asia/Hong_Kong as YYYY-MM-DD. */
export function todayHkYmd(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: HK_TIMEZONE });
}

/** Calendar date in Asia/Hong_Kong as YYYY-MM-DD, or null if unparseable. */
export function toHkYmd(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-CA", { timeZone: HK_TIMEZONE });
}

/** due_date is locked after first fill; empty legacy rows stay editable. */
export function isDueDateLocked(
  persistedDueDate: string | null | undefined
): boolean {
  return Boolean(toHkYmd(persistedDueDate));
}

/** True when today (HK calendar) is after due_date. Empty due_date is not expired. */
export function isDueDateExpired(
  dueDate: string | null | undefined,
  todayYmd: string = todayHkYmd()
): boolean {
  const dueYmd = toHkYmd(dueDate);
  if (!dueYmd) return false;
  return todayYmd > dueYmd;
}

/** Payment % for list badges: paid / amount, rounded. Missing amount is 0. */
export function paymentPercent(
  amount: number | null | undefined,
  paid: number | null | undefined
): number {
  const amt = amount || 0;
  if (amt <= 0) return 0;
  return Math.round(((paid || 0) / amt) * 100);
}

/** Due date has passed (HK) and paid / amount is not 100%. Empty due or zero amount is not overdue. */
export function isPastDueUnpaid(
  dueDate: string | null | undefined,
  amount: number | null | undefined,
  paid: number | null | undefined,
  todayYmd: string = todayHkYmd()
): boolean {
  const amt = amount || 0;
  if (amt <= 0) return false;
  return isDueDateExpired(dueDate, todayYmd) && paymentPercent(amount, paid) < 100;
}

/**
 * expected_payment_date is a secondary confirmation.
 * Required only after the contractual due_date has already passed (HK calendar).
 * Received / Zoho Completed incomes skip this — payment is already collected.
 */
export function isExpectedPaymentDateRequired(
  dueDate: string | null | undefined,
  todayYmd: string = todayHkYmd(),
  paymentStatus?: string | null
): boolean {
  if (isIncomeSettled(paymentStatus)) return false;
  return isDueDateExpired(dueDate, todayYmd);
}

/** Income expiry reason is required only after due_date has passed (not settled). */
export function isIncomeExpiryReasonMissing(
  dueDate: string | null | undefined,
  reasonId: string | null | undefined,
  todayYmd: string = todayHkYmd(),
  paymentStatus?: string | null
): boolean {
  if (isIncomeSettled(paymentStatus)) return false;
  return isDueDateExpired(dueDate, todayYmd) && !reasonId;
}

export function isExpectedPaymentDateMissing(
  dueDate: string | null | undefined,
  expectedPaymentDate: string | null | undefined,
  todayYmd: string = todayHkYmd(),
  paymentStatus?: string | null
): boolean {
  return (
    isExpectedPaymentDateRequired(dueDate, todayYmd, paymentStatus) &&
    !toHkYmd(expectedPaymentDate)
  );
}

export type IncomeCalendarDateFields = {
  due_date?: string | null;
  expected_payment_date?: string | null;
  payment_status?: string | null;
};

/**
 * Calendar / digest day for an income.
 * Settled rows stay on due_date. Unsettled rows with expected_payment_date
 * move to that revised date; otherwise they stay on due_date.
 */
export function incomeCalendarDate(
  row: IncomeCalendarDateFields
): string | null {
  const dueYmd = toHkYmd(row.due_date);
  const expectedYmd = toHkYmd(row.expected_payment_date);
  if (isIncomeSettled(row.payment_status)) return dueYmd;
  return expectedYmd || dueYmd;
}

/** True when the chip / digest should treat expected_payment_date as the day. */
export function isIncomeUsingExpectedCalendarDate(
  row: IncomeCalendarDateFields
): boolean {
  if (isIncomeSettled(row.payment_status)) return false;
  return Boolean(toHkYmd(row.expected_payment_date));
}

/** Unsettled incomes whose effective collection date is `ymd`. */
export function incomeBelongsOnDigestDate(
  row: IncomeCalendarDateFields,
  ymd: string
): boolean {
  if (isIncomeSettled(row.payment_status)) return false;
  return incomeCalendarDate(row) === ymd;
}

export const OVERDUE_INCOME_EXPECTED_DATE_LABEL = "逾期收入已填寫預計收款日期";

/** Overdue incomes with empty expected_payment_date. Settled rows are excluded. */
export function countOverdueIncomesMissingExpectedDate(
  incomes: Array<{
    due_date?: string | null;
    expected_payment_date?: string | null;
    payment_status?: string | null;
  }>,
  todayYmd: string = todayHkYmd()
): number {
  return incomes.filter(
    (row) =>
      !isIncomeSettled(row.payment_status) &&
      isExpectedPaymentDateMissing(row.due_date, row.expected_payment_date, todayYmd)
  ).length;
}

/** Checklist / expense-locked chip for the overdue-expected-date item. */
export function overdueIncomeExpectedDateItemLabel(missingCount: number): string {
  return missingCount > 0
    ? `${OVERDUE_INCOME_EXPECTED_DATE_LABEL} (缺 ${missingCount} 筆)`
    : OVERDUE_INCOME_EXPECTED_DATE_LABEL;
}

/** Whole HK calendar days past due_date, or null when not overdue. */
export function overdueDaysHk(
  dueDate: string | null | undefined,
  todayYmd: string = todayHkYmd()
): number | null {
  const dueYmd = toHkYmd(dueDate);
  if (!dueYmd || todayYmd <= dueYmd) return null;
  const [y1, m1, d1] = dueYmd.split("-").map(Number);
  const [y2, m2, d2] = todayYmd.split("-").map(Number);
  const start = Date.UTC(y1, m1 - 1, d1);
  const end = Date.UTC(y2, m2 - 1, d2);
  return Math.round((end - start) / 86400000);
}

/** Whole HK calendar days until due_date, or null when due is today/past/missing. */
export function remainingDaysHk(
  dueDate: string | null | undefined,
  todayYmd: string = todayHkYmd()
): number | null {
  const dueYmd = toHkYmd(dueDate);
  if (!dueYmd || todayYmd >= dueYmd) return null;
  const [y1, m1, d1] = todayYmd.split("-").map(Number);
  const [y2, m2, d2] = dueYmd.split("-").map(Number);
  const start = Date.UTC(y1, m1 - 1, d1);
  const end = Date.UTC(y2, m2 - 1, d2);
  return Math.round((end - start) / 86400000);
}

/**
 * Convert a local date selection to a date-only string (YYYY-MM-DD).
 * LEGACY: For new code, prefer toUTCTimestamp() to store as full TIMESTAMPTZ.
 * Only use this for date pickers that need a date-only value.
 */
export function toDateOnlyString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── DATE RANGE FORMATTING ────────────────────────────────────

/**
 * Format a date range like "3月15日 — 3月21日" for 10-day report headers, etc.
 * Accepts Date objects or date strings.
 */
export function formatDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
  options?: { locale?: string; separator?: string }
): string {
  const locale = options?.locale ?? "zh-HK";
  const sep = options?.separator ?? " — ";

  const fmtOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: HK_TIMEZONE,
  };

  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;

  if (!startDate || isNaN(startDate.getTime())) return "-";
  if (!endDate || isNaN(endDate.getTime())) return startDate.toLocaleDateString(locale, fmtOpts);

  return `${startDate.toLocaleDateString(locale, fmtOpts)}${sep}${endDate.toLocaleDateString(locale, fmtOpts)}`;
}

// ─── DATE PARSING (safe) ──────────────────────────────────────

/**
 * Safely parse a date string into a Date object.
 * For date-only strings (YYYY-MM-DD), parses as LOCAL midnight (not UTC)
 * to avoid timezone date-shift issues.
 * Returns null if invalid.
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    // Date-only format: parse as local midnight to avoid TZ shift
    const dateOnlyMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, y, m, d] = dateOnlyMatch;
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return isNaN(date.getTime()) ? null : date;
    }

    // Full timestamp — let JS parse normally (UTC)
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Parse a date-only string (YYYY-MM-DD) safely without timezone shift.
 * Returns { year, month, day } integers or null.
 */
export function parseDateParts(dateStr: string | null | undefined): {
  year: number;
  month: number;
  day: number;
} | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: parseInt(match[1]),
    month: parseInt(match[2]),
    day: parseInt(match[3]),
  };
}

// ─── DATE COMPARISON ──────────────────────────────────────────

/**
 * Check if a date string is in the past (before today, user's local timezone).
 * Works with both TIMESTAMPTZ and legacy date-only strings.
 */
export function isDatePast(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = parseDate(dateStr);
  if (!d) return false;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d < todayStart;
}

/**
 * Check if a date string is today (user's local timezone).
 * Works with both TIMESTAMPTZ and legacy date-only strings.
 */
export function isDateToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = parseDate(dateStr);
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Calculate the number of days between two date strings.
 * Returns positive if end > start. Works with both TIMESTAMPTZ and YYYY-MM-DD.
 */
export function daysBetween(
  startStr: string | null | undefined,
  endStr: string | null | undefined
): number | null {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / 86400000);
}

// ─── MONEY FORMATTING ─────────────────────────────────────────

/**
 * Format a number as HKD currency string: $1,234,567
 * Use throughout the app instead of inline .toLocaleString() calls.
 * 
 * @param val - The numeric value to format
 * @param options.fallback - What to show when val is null/0 (default: "-")
 * @param options.decimals - Number of decimal places (default: 0)
 * @param options.prefix - Currency prefix (default: "$")
 */
export function formatMoney(
  val: number | null | undefined,
  options?: {
    fallback?: string;
    decimals?: number;
    prefix?: string;
    showZero?: boolean;
  }
): string {
  const fallback = options?.fallback ?? "-";
  const decimals = options?.decimals ?? 0;
  const prefix = options?.prefix ?? "$";
  const showZero = options?.showZero ?? false;

  if (val == null || (!showZero && val === 0)) return fallback;

  return `${prefix}${val.toLocaleString("en-HK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Format money with 2 decimal places: $1,234.56
 * Convenience wrapper for financial/accounting views.
 */
export function formatMoney2(
  val: number | null | undefined,
  options?: { fallback?: string; prefix?: string }
): string {
  return formatMoney(val, { ...options, decimals: 2 });
}

/**
 * Format money in compact form for charts/KPI: $1.2M, $450K
 */
export function formatMoneyCompact(
  val: number | null | undefined,
  options?: { fallback?: string; prefix?: string }
): string {
  const fallback = options?.fallback ?? "-";
  const prefix = options?.prefix ?? "$";

  if (val == null || val === 0) return fallback;

  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${prefix}${(abs / 1_000).toFixed(0)}K`;
  }
  return `${sign}${prefix}${abs.toLocaleString("en-HK")}`;
}

// ─── NUMBER FORMATTING ────────────────────────────────────────

/**
 * Format a number with commas: 1,234,567
 * For non-currency numeric displays (e.g. sqft, count).
 */
export function formatNumber(
  val: number | null | undefined,
  options?: { fallback?: string; decimals?: number }
): string {
  const fallback = options?.fallback ?? "-";
  if (val == null) return fallback;
  return val.toLocaleString("en-HK", {
    minimumFractionDigits: options?.decimals ?? 0,
    maximumFractionDigits: options?.decimals ?? 0,
  });
}

/**
 * Format a percentage: 45.2%
 */
export function formatPercent(
  val: number | null | undefined,
  options?: { fallback?: string; decimals?: number }
): string {
  const fallback = options?.fallback ?? "-";
  if (val == null) return fallback;
  return `${val.toFixed(options?.decimals ?? 1)}%`;
}
