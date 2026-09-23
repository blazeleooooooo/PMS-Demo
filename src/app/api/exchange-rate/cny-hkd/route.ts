import { NextRequest, NextResponse } from "next/server";
import {
  fetchCnyHkdRateForDate,
  getHongKongTodayIso,
  resolveExpenseRateDate,
} from "@/lib/rmb-hkd-converter";

const REVALIDATE_SECONDS = 60 * 60;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const dateParam = searchParams.get("date");
  const resolvedDate = resolveExpenseRateDate(dateParam || null);

  try {
    const result = await fetchCnyHkdRateForDate(resolvedDate);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS}`,
      },
    });
  } catch (error: unknown) {
    console.error("[exchange-rate/cny-hkd] fetch failed:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch CNY/HKD rate",
        requestedDate: resolvedDate,
        fallbackDate: getHongKongTodayIso(),
      },
      { status: 502 },
    );
  }
}
