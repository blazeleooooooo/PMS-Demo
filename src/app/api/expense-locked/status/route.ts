import { NextRequest, NextResponse } from "next/server";
import { evaluateBulkExpenseLockedProjects } from "@/lib/expense-control-bulk";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

const MAX_IDS = 2000;

/**
 * POST { projectIds: string[] }
 * → { success, lockedIds, evaluatedIds } — project IDs whose Expense Control
 * checklist currently fails (出票受限). Uses WIP-only + idsOnly bulk path.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders }
    );
  }

  const supabaseAdmin = createServiceRoleClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: "Supabase admin client not initialised." },
      { status: 500, headers: noStoreHeaders }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400, headers: noStoreHeaders }
    );
  }

  const rawIds = (body as { projectIds?: unknown })?.projectIds;
  if (!Array.isArray(rawIds)) {
    return NextResponse.json(
      { success: false, error: "projectIds must be an array" },
      { status: 400, headers: noStoreHeaders }
    );
  }

  const projectIds = [
    ...new Set(
      rawIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ].slice(0, MAX_IDS);

  if (projectIds.length === 0) {
    return NextResponse.json(
      { success: true, lockedIds: [] as string[], evaluatedIds: [] as string[] },
      { headers: noStoreHeaders }
    );
  }

  try {
    const projects = await evaluateBulkExpenseLockedProjects(supabaseAdmin, {
      projectIds,
      wipOnly: true,
      idsOnly: true,
    });
    return NextResponse.json(
      {
        success: true,
        lockedIds: projects.map((p) => p.id),
        // Echo requested IDs so the client can mark non-locked as green.
        evaluatedIds: projectIds,
      },
      { headers: noStoreHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[api/expense-locked/status] error:", err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
