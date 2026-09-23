import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchBoxWorkingFolderListing,
  getBoxConfigHelpMessage,
  isBoxConfigured,
  parseBoxWorkingFolderPath,
} from "@/lib/box";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBoxConfigured()) {
    return NextResponse.json(
      {
        error: "Box API is not configured.",
        help: getBoxConfigHelpMessage(),
      },
      { status: 503 }
    );
  }

  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId")?.trim();
  const workingFolderParam = searchParams.get("workingFolder")?.trim();
  const folderId = searchParams.get("folderId")?.trim() || null;
  const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "200", 10);

  let workingFolder = workingFolderParam ?? null;

  if (!workingFolder && projectId) {
    const { data, error } = await supabase
      .from("bwa_projects")
      .select("working_folder")
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    workingFolder = data?.working_folder ?? null;
  }

  if (!workingFolder) {
    return NextResponse.json(
      { error: "Missing working folder. Provide projectId or workingFolder." },
      { status: 400 }
    );
  }

  const parsed = parseBoxWorkingFolderPath(workingFolder);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "This working folder is not a Box path. Only paths starting with D:\\Box\\ are supported.",
        working_folder: workingFolder,
      },
      { status: 422 }
    );
  }

  try {
    const listing = await fetchBoxWorkingFolderListing({
      workingFolder,
      folderId,
      offset: Number.isFinite(offset) ? Math.max(0, offset) : 0,
      limit: Number.isFinite(limit) ? Math.min(Math.max(1, limit), 1000) : 200,
    });

    return NextResponse.json({
      success: true,
      working_folder: workingFolder,
      relative_path: listing.relative_path,
      local_path: listing.local_path,
      folder_id: listing.folder_id,
      folder_name: listing.folder_name,
      items: listing.items,
      total_count: listing.total_count,
      offset: listing.offset,
      limit: listing.limit,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load Box folder items";
    console.error("[api/box/folder-items]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
