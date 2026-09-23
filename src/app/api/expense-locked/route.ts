import { NextResponse } from "next/server";
import { evaluateBulkExpenseLockedProjects } from "@/lib/expense-control-bulk";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export async function GET() {
  const supabaseAdmin = createServiceRoleClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: "Supabase admin client not initialised." },
      { status: 500, headers: noStoreHeaders }
    );
  }

  try {
    const projects = await evaluateBulkExpenseLockedProjects(supabaseAdmin);
    return NextResponse.json(
      { success: true, projects },
      { headers: noStoreHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[api/expense-locked] error:", err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
