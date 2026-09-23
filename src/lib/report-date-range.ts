// ─── SHARED REPORT DATE-RANGE PRESETS ─────────────────────────
// Single source of truth for the date-range filter pills used by every
// report on /business-reports, so the option list, ordering, labels, and
// window maths stay identical across reports.
//
// Window bounds are nullable: "All Time" resolves to { from: null, to: null }
// meaning unbounded. Consumers should treat null as ±Infinity, e.g.
//   const fromMs = window.from?.getTime() ?? -Infinity;
//   const toMs   = window.to?.getTime()   ??  Infinity;

export type RangeKey =
  | "last30"
  | "last60"
  | "last90"
  | "last120"
  | "last180"
  | "last365"
  | "thisMonth"
  | "thisQuarter"
  | "thisYear"
  | "fyYear"
  | "lastMonth"
  | "lastQuarter"
  | "lastYear"
  | "lastFyYear"
  | "all"
  // User-picked start/end dates. The actual dates live alongside the key in
  // the shared range state (customFrom / customTo) — see ReportDateRangeContext.
  | "custom";

export interface RangePreset {
  key: RangeKey;
  label: string;
}

// Canonical order + labels — keep in sync with the legacy bubble.io screens.
export const RANGE_PRESETS: RangePreset[] = [
  { key: "last30", label: "Last 30 Days" },
  { key: "last60", label: "Last 60 Days" },
  { key: "last90", label: "Last 90 Days" },
  { key: "last120", label: "Last 120 Days" },
  { key: "last180", label: "Last 180 Days" },
  { key: "last365", label: "Last 365 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "thisQuarter", label: "This Quarter" },
  { key: "thisYear", label: "This Year" },
  { key: "fyYear", label: "FY Year" },
  { key: "lastMonth", label: "Last Month" },
  { key: "lastQuarter", label: "Last Quarter" },
  { key: "lastYear", label: "Last Year" },
  { key: "lastFyYear", label: "Last FY Year" },
  { key: "all", label: "All Time" },
];

// Financial year starts in April (0-indexed month 3). FY runs Apr 1 → Mar 31.
const FY_START_MONTH = 3;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// A user-picked custom window, stored as YYYY-MM-DD strings (or null).
export interface CustomRange {
  from: string | null;
  to: string | null;
}

// Parse a YYYY-MM-DD string to a local Date at the given day boundary.
// `end: true` snaps to 23:59:59.999 so the day is inclusive.
function parseISODate(s: string | null, end: boolean): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return end
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d);
}

// Resolve a preset to an inclusive [from, to] window (null = unbounded).
// For the "custom" key, pass the user-picked dates as the third argument.
export function resolveRange(
  key: RangeKey,
  now: Date,
  custom?: CustomRange | null
): { from: Date | null; to: Date | null } {
  if (key === "all") return { from: null, to: null };

  if (key === "custom") {
    return {
      from: parseISODate(custom?.from ?? null, false),
      to: parseISODate(custom?.to ?? null, true),
    };
  }

  const today = startOfDay(now);
  const endOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999
  );
  const daysAgo = (n: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  const quarterStartMonth = (m: number) => Math.floor(m / 3) * 3;
  const fyStartYear = (d: Date) =>
    d.getMonth() >= FY_START_MONTH ? d.getFullYear() : d.getFullYear() - 1;

  switch (key) {
    case "last30":
      return { from: daysAgo(29), to: endOfToday };
    case "last60":
      return { from: daysAgo(59), to: endOfToday };
    case "last90":
      return { from: daysAgo(89), to: endOfToday };
    case "last120":
      return { from: daysAgo(119), to: endOfToday };
    case "last180":
      return { from: daysAgo(179), to: endOfToday };
    case "last365":
      return { from: daysAgo(364), to: endOfToday };
    case "thisMonth":
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: endOfToday,
      };
    case "lastMonth":
      return {
        from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        to: new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999),
      };
    case "thisQuarter": {
      const qs = quarterStartMonth(today.getMonth());
      return { from: new Date(today.getFullYear(), qs, 1), to: endOfToday };
    }
    case "lastQuarter": {
      const qs = quarterStartMonth(today.getMonth());
      return {
        from: new Date(today.getFullYear(), qs - 3, 1),
        to: new Date(today.getFullYear(), qs, 0, 23, 59, 59, 999),
      };
    }
    case "thisYear":
      return {
        from: new Date(today.getFullYear(), 0, 1),
        to: new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
    case "lastYear":
      return {
        from: new Date(today.getFullYear() - 1, 0, 1),
        to: new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
      };
    case "fyYear": {
      const y = fyStartYear(today);
      return {
        from: new Date(y, FY_START_MONTH, 1),
        to: new Date(y + 1, FY_START_MONTH, 0, 23, 59, 59, 999),
      };
    }
    case "lastFyYear": {
      const y = fyStartYear(today) - 1;
      return {
        from: new Date(y, FY_START_MONTH, 1),
        to: new Date(y + 1, FY_START_MONTH, 0, 23, 59, 59, 999),
      };
    }
    default:
      return { from: null, to: null };
  }
}

// Inclusive millisecond bounds for filtering (handles unbounded "All Time").
export function rangeBounds(window: {
  from: Date | null;
  to: Date | null;
}): { fromMs: number; toMs: number } {
  return {
    fromMs: window.from?.getTime() ?? -Infinity,
    toMs: window.to?.getTime() ?? Infinity,
  };
}

export function fmtRangeDate(d: Date | null): string {
  if (!d) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
