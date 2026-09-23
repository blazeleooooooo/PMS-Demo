import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveApiStaffId } from "@/lib/supabase/resolve-api-staff";
import { AsanaApiError } from "@/lib/asana";
import { AsanaPatConfigError } from "@/lib/asana-pat";
import { resolveAsanaImportPrefill } from "@/lib/asana-import-prefill";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { staffId } = await resolveApiStaffId();
  if (!staffId) {
    return NextResponse.json({ error: "Staff not found" }, { status: 403 });
  }

  const { data: allowed, error: permError } = await supabase.rpc(
    "check_permission",
    {
      p_user_id: staffId,
      p_module: "asana-import",
      p_action: "view",
    }
  );
  if (permError) {
    return NextResponse.json({ error: "Permission check failed" }, { status: 500 });
  }
  if (allowed === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const taskGid = request.nextUrl.searchParams.get("task")?.trim() || "";
  if (!/^\d+$/.test(taskGid)) {
    return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  }

  try {
    const prefill = await resolveAsanaImportPrefill(taskGid);
    return NextResponse.json({ prefill });
  } catch (error) {
    if (error instanceof AsanaPatConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message =
      error instanceof AsanaApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load Asana task";
    const status = error instanceof AsanaApiError ? error.status : 502;
    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 502 });
  }
}
