const HKMA_DAILY_URL =
  "https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily";
const FRANKFURTER_URL = "https://api.frankfurter.app";

const LOOKBACK_DAYS = 14;
const HKMA_TIMEOUT_MS = 6_000;
const FRANKFURTER_TIMEOUT_MS = 8_000;

export type ExpenseAmountCurrency = "HKD" | "RMB";
export type ExchangeRateSource = "hkma" | "frankfurter";

export interface CnyHkdRateResult {
  /** HKD per 1 CNY. */
  rate: number;
  /** ISO date of the rate row actually used. */
  rateDate: string;
  /** ISO date requested by the caller. */
  requestedDate: string;
  source: ExchangeRateSource;
}

type HkmaDailyRecord = {
  end_of_day?: string;
  cny?: number | string;
};

type HkmaDailyResponse = {
  header?: { success?: boolean };
  result?: { records?: HkmaDailyRecord[] };
};

type FrankfurterResponse = {
  date?: string;
  rates?: { HKD?: number };
};

/** Today's calendar date in Asia/Hong_Kong (YYYY-MM-DD). */
export function getHongKongTodayIso(): string {
  const hkDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  const yyyy = hkDate.getFullYear();
  const mm = String(hkDate.getMonth() + 1).padStart(2, "0");
  const dd = String(hkDate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatIsoDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(iso: string, delta: number): string {
  const dt = parseIsoDate(iso);
  if (!dt) return iso;
  dt.setUTCDate(dt.getUTCDate() + delta);
  return formatIsoDate(dt);
}

/** Resolve the date used for rate lookup: payment date or HK today. */
export function resolveExpenseRateDate(paymentDate: string | null | undefined): string {
  const trimmed = paymentDate?.trim();
  if (trimmed && parseIsoDate(trimmed)) return trimmed;
  return getHongKongTodayIso();
}

export function convertRmbToHkd(rmbAmount: number, rate: number): number {
  return Math.round(rmbAmount * rate * 100) / 100;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BWA-PMS/1.0)",
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function pickBestRateOnOrBefore(
  records: Array<{ rateDate: string; rate: number }>,
  requestedDate: string,
): { rateDate: string; rate: number } | null {
  const eligible = records
    .filter((row) => row.rateDate <= requestedDate)
    .sort((a, b) => (a.rateDate < b.rateDate ? 1 : a.rateDate > b.rateDate ? -1 : 0));
  return eligible[0] ?? null;
}

async function fetchHkmaCnyHkdRate(requestedDate: string): Promise<CnyHkdRateResult> {
  const from = addDays(requestedDate, -LOOKBACK_DAYS);
  const url = new URL(HKMA_DAILY_URL);
  url.searchParams.set("choose", "end_of_day");
  url.searchParams.set("from", from);
  url.searchParams.set("to", requestedDate);
  url.searchParams.set("fields", "end_of_day,cny");

  const res = await fetchWithTimeout(url.toString(), HKMA_TIMEOUT_MS, {
    next: { revalidate: 60 * 60 },
  });

  if (!res.ok) {
    throw new Error(`HKMA upstream returned ${res.status}`);
  }

  const data = (await res.json()) as HkmaDailyResponse;
  if (!data.header?.success) {
    throw new Error("HKMA response unsuccessful");
  }

  const records = (data.result?.records ?? [])
    .map((row) => {
      const rateDate = row.end_of_day;
      const rate = typeof row.cny === "string" ? parseFloat(row.cny) : row.cny;
      if (!rateDate || rate == null || !Number.isFinite(rate) || rate <= 0) return null;
      return { rateDate, rate };
    })
    .filter((row): row is { rateDate: string; rate: number } => row != null);

  const best = pickBestRateOnOrBefore(records, requestedDate);
  if (!best) {
    throw new Error(`No HKMA CNY/HKD rate found on or before ${requestedDate}`);
  }

  return {
    rate: best.rate,
    rateDate: best.rateDate,
    requestedDate,
    source: "hkma",
  };
}

async function fetchFrankfurterCnyHkdRate(requestedDate: string): Promise<CnyHkdRateResult> {
  const historicalUrl = `${FRANKFURTER_URL}/${requestedDate}?from=CNY&to=HKD`;
  let res = await fetchWithTimeout(historicalUrl, FRANKFURTER_TIMEOUT_MS);

  if (!res.ok) {
    res = await fetchWithTimeout(`${FRANKFURTER_URL}/latest?from=CNY&to=HKD`, FRANKFURTER_TIMEOUT_MS);
  }

  if (!res.ok) {
    throw new Error(`Frankfurter upstream returned ${res.status}`);
  }

  const data = (await res.json()) as FrankfurterResponse;
  const rate = data.rates?.HKD;
  const rateDate = data.date;

  if (!rateDate || rate == null || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Frankfurter response missing CNY/HKD rate");
  }

  return {
    rate,
    rateDate,
    requestedDate,
    source: "frankfurter",
  };
}

/**
 * Fetch HKD-per-CNY rate for a date. Races HKMA (legacy Bubble source) against
 * Frankfurter so the UI is not blocked when HKMA is slow or unavailable.
 */
export async function fetchCnyHkdRateForDate(requestedDate: string): Promise<CnyHkdRateResult> {
  const normalized = parseIsoDate(requestedDate);
  if (!normalized) {
    throw new Error("Invalid date");
  }

  const date = formatIsoDate(normalized);
  const attempts = [
    fetchHkmaCnyHkdRate(date),
    fetchFrankfurterCnyHkdRate(date),
  ];

  try {
    return await Promise.any(attempts);
  } catch (aggregateError) {
    const errors = aggregateError instanceof AggregateError ? aggregateError.errors : [aggregateError];
    console.error("[rmb-hkd-converter] All rate sources failed:", errors);
    throw new Error(`No CNY/HKD rate available for ${date}`);
  }
}
