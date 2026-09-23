import { NextResponse } from "next/server";
import { checkBwfSupabaseConnection } from "@/lib/supabase/bwf/health";

export const dynamic = "force-dynamic";

/** Dev/ops probe for BWF Supabase connectivity (anon + service role). */
export async function GET() {
  const status = await checkBwfSupabaseConnection();
  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
