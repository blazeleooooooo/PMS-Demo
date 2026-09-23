import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveApiStaffId } from "@/lib/supabase/resolve-api-staff";
import { AsanaApiError, collectAsanaTaskGidsFromLinks } from "@/lib/asana";
import { filterImportedAsanaTasks } from "@/lib/asana-import-projects";
import {
  AsanaPatConfigError,
  fetchAsanaImportTasks,
  isAsanaImportProjectKey,
  type AsanaImportProjectKey,
} from "@/lib/asana-pat";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODULE = "asana-import";

async function fetchImportedBwaPitchingAsanaTaskGids(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const pageSize = 1000;
  const links: string[] = [];
  let from = 0;
  while (from < 20_000) {
    const { data, error } = await supabase
      .from("bwa_pitchings")
      .select("asana_link")
      .not("asana_link", "is", null)
      .neq("asana_link", "")
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("[api/asana/import-tasks] bwa_pitchings.asana_link:", error.message);
      break;
    }
    const rows = data ?? [];
    for (const row of rows) {
      if (typeof row.asana_link === "string" && row.asana_link.trim()) {
        links.push(row.asana_link);
      }
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return collectAsanaTaskGidsFromLinks(links);
}

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
      p_module: MODULE,
      p_action: "view",
    }
  );
  if (permError) {
    console.error("[api/asana/import-tasks] check_permission:", permError.message);
    return NextResponse.json({ error: "Permission check failed" }, { status: 500 });
  }
  if (allowed === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectParam = request.nextUrl.searchParams.get("project")?.trim() || "all";
  const includeCompleted =
    request.nextUrl.searchParams.get("includeCompleted") === "1";

  let projectKeys: AsanaImportProjectKey[] | undefined;
  if (projectParam !== "all") {
    if (!isAsanaImportProjectKey(projectParam)) {
      return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    }
    projectKeys = [projectParam];
  }

  try {
    const result = await fetchAsanaImportTasks({ projectKeys, includeCompleted });
    const importedGids = await fetchImportedBwaPitchingAsanaTaskGids(supabase);
    const { visible, hiddenCount } = filterImportedAsanaTasks(
      result.tasks,
      importedGids
    );
    return NextResponse.json({
      tasks: visible,
      hiddenImportedCount: hiddenCount,
      projects: result.projects.map((project) => ({
        key: project.key,
        name: project.name,
        shortName: project.shortName,
      })),
    });
  } catch (error) {
    if (error instanceof AsanaPatConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message =
      error instanceof AsanaApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load Asana tasks";
    const status = error instanceof AsanaApiError ? error.status : 502;
    return NextResponse.json({ error: message }, { status: status >= 400 ? status : 502 });
  }
}
