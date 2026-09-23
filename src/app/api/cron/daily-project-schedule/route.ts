import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { runDailyProjectScheduleNotify } from "@/lib/daily-project-schedule-notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  const headerSecret = request.headers.get("x-cron-secret") || "";
  return headerSecret === secret;
}

async function handle(request: NextRequest) {
  if (!cronAuthorized(request)) {
    const missing = !process.env.CRON_SECRET?.trim();
    return NextResponse.json(
      {
        error: missing
          ? "CRON_SECRET is not configured."
          : "Unauthorized",
      },
      { status: missing ? 503 : 401 }
    );
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role client is not configured." },
      { status: 503 }
    );
  }

  const dryRun =
    request.nextUrl.searchParams.get("dryRun") === "1" ||
    request.nextUrl.searchParams.get("dryRun") === "true";

  try {
    const result = await runDailyProjectScheduleNotify(supabase, { dryRun });
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Daily schedule notify failed";
    console.error("[api/cron/daily-project-schedule]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel Cron uses GET. */
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
