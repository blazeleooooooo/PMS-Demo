import { NextRequest, NextResponse } from "next/server";

// Public holiday data sources:
// - Hong Kong: 1823 / HKSAR Government iCal-in-JSON feed
// - China:    NateScarlet/holiday-cn per-year JSON
const HK_HOLIDAY_URL = "https://www.1823.gov.hk/common/ical/tc.json";
const CN_HOLIDAY_URL = (year: number) =>
  `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`;

// Cache upstream responses for 12 hours – holiday data changes very rarely.
const REVALIDATE_SECONDS = 60 * 60 * 12;

export interface NormalizedHoliday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  /**
   * Only meaningful for CN: false means it is a makeup working day
   * (調休上班). HK entries are always true.
   */
  isOffDay: boolean;
}

/** Convert HK "YYYYMMDD" date string to "YYYY-MM-DD". */
function hkDateToISO(raw: string): string | null {
  if (!/^\d{8}$/.test(raw)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

async function fetchHKHolidays(): Promise<NormalizedHoliday[]> {
  const res = await fetch(HK_HOLIDAY_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; BWA-PMS/1.0)" },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(`HK upstream returned ${res.status}`);

  const data = await res.json();
  const events = data?.vcalendar?.[0]?.vevent ?? [];
  const out: NormalizedHoliday[] = [];

  for (const ev of events) {
    // dtstart is shaped like ["20250101", { value: "DATE" }]
    const rawStart = Array.isArray(ev?.dtstart) ? ev.dtstart[0] : ev?.dtstart;
    const iso = typeof rawStart === "string" ? hkDateToISO(rawStart) : null;
    if (!iso) continue;
    out.push({
      date: iso,
      name: typeof ev?.summary === "string" ? ev.summary : "公眾假期",
      isOffDay: true,
    });
  }
  return out;
}

async function fetchCNHolidays(year: number): Promise<NormalizedHoliday[]> {
  const res = await fetch(CN_HOLIDAY_URL(year), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; BWA-PMS/1.0)" },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    // A missing year file should not break the whole request.
    if (res.status === 404) return [];
    throw new Error(`CN upstream (${year}) returned ${res.status}`);
  }

  const data = await res.json();
  const days = Array.isArray(data?.days) ? data.days : [];
  return days
    .filter((d: any) => typeof d?.date === "string")
    .map((d: any) => ({
      date: d.date as string,
      name: typeof d?.name === "string" ? d.name : "假期",
      isOffDay: Boolean(d?.isOffDay),
    }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Accept ?years=2026,2027 (comma separated). Default to current year.
  const yearsParam = searchParams.get("years");
  const years = (
    yearsParam
      ? yearsParam.split(",").map((y) => parseInt(y.trim(), 10))
      : [new Date().getFullYear()]
  ).filter((y) => Number.isInteger(y) && y >= 1970 && y <= 2100);

  if (years.length === 0) {
    return NextResponse.json(
      { error: "Invalid 'years' parameter" },
      { status: 400 }
    );
  }

  try {
    const [hk, cnResults] = await Promise.all([
      fetchHKHolidays().catch((err) => {
        console.error("[holidays] HK fetch failed:", err);
        return [] as NormalizedHoliday[];
      }),
      Promise.all(
        [...new Set(years)].map((year) =>
          fetchCNHolidays(year).catch((err) => {
            console.error(`[holidays] CN fetch failed for ${year}:`, err);
            return [] as NormalizedHoliday[];
          })
        )
      ),
    ]);

    const cn = cnResults.flat();

    return NextResponse.json(
      { hk, cn },
      {
        headers: {
          "Cache-Control": `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS}`,
        },
      }
    );
  } catch (error: unknown) {
    console.error("[holidays] route error:", error);
    return NextResponse.json(
      { error: "Failed to fetch holidays" },
      { status: 500 }
    );
  }
}
