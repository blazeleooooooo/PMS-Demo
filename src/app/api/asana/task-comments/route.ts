import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AsanaApiError, fetchAsanaTaskComments, parseAsanaTaskGid } from "@/lib/asana";
import {
  AsanaNotConnectedError,
  AsanaOAuthConfigError,
  getValidAsanaAccessToken,
} from "@/lib/asana-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidAsanaAccessToken(user.id);
  } catch (error) {
    if (error instanceof AsanaNotConnectedError) {
      return NextResponse.json(
        { error: error.message, code: "asana_not_connected" },
        { status: 409 }
      );
    }
    const message =
      error instanceof AsanaOAuthConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load Asana token";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;

  // Guard against literal "undefined"/"null"/"" strings arriving as query params,
  // which would otherwise be passed straight into a UUID column comparison.
  const cleanParam = (value: string | null): string | null => {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;
    return trimmed;
  };

  const asanaLink = cleanParam(searchParams.get("url"));
  const supplierId = cleanParam(searchParams.get("supplierId"));
  const projectId = cleanParam(searchParams.get("projectId"));

  let resolvedLink = asanaLink ?? null;

  if (!resolvedLink && supplierId) {
    const { data, error } = await supabase
      .from("suppliers")
      .select("asana_link")
      .eq("id", supplierId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    resolvedLink = data?.asana_link ?? null;
  }

  if (!resolvedLink && projectId) {
    const { data, error } = await supabase
      .from("bwa_projects")
      .select("asana_link")
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    resolvedLink = data?.asana_link ?? null;
  }

  if (!resolvedLink) {
    return NextResponse.json(
      { error: "Missing Asana link. Provide url, supplierId, or projectId." },
      { status: 400 }
    );
  }

  const taskGid = parseAsanaTaskGid(resolvedLink);
  if (!taskGid) {
    return NextResponse.json(
      {
        error:
          "Could not find a task ID in this Asana link. Link directly to an Asana task.",
        asana_link: resolvedLink,
      },
      { status: 422 }
    );
  }

  try {
    const result = await fetchAsanaTaskComments(taskGid, accessToken);

    return NextResponse.json({
      success: true,
      asana_link: resolvedLink,
      task_gid: result.taskGid,
      task_name: result.taskName,
      comments: result.comments,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch Asana comments";
    console.error("[api/asana/task-comments]", message);

    if (error instanceof AsanaApiError && (error.status === 403 || error.status === 404)) {
      return NextResponse.json(
        { error: message, code: "asana_forbidden" },
        { status: 403 }
      );
    }
    if (error instanceof AsanaApiError && error.code === "asana_mcp_token") {
      return NextResponse.json(
        { error: message, code: "asana_mcp_token" },
        { status: 502 }
      );
    }
    if (error instanceof AsanaApiError && error.status === 401) {
      return NextResponse.json(
        { error: message, code: "asana_token_rejected" },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
