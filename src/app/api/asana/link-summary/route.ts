import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AsanaApiError, fetchAsanaLinkTitle } from "@/lib/asana";
import {
  AsanaNotConnectedError,
  AsanaOAuthConfigError,
  getAsanaOAuthStatus,
  getValidAsanaAccessToken,
} from "@/lib/asana-oauth";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabase
    .from("bwa_projects")
    .select("asana_link")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  const asanaLink =
    typeof project?.asana_link === "string" ? project.asana_link.trim() : "";

  let connected = false;
  try {
    const status = await getAsanaOAuthStatus(user.id);
    connected = status.connected;
  } catch (error) {
    const message =
      error instanceof AsanaOAuthConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load Asana status";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (!asanaLink) {
    return NextResponse.json({
      connected,
      asana_link: null,
      title: null,
      kind: null,
    });
  }

  if (!connected) {
    return NextResponse.json({
      connected: false,
      asana_link: asanaLink,
      title: null,
      kind: null,
    });
  }

  try {
    const accessToken = await getValidAsanaAccessToken(user.id);
    const summary = await fetchAsanaLinkTitle(asanaLink, accessToken);
    return NextResponse.json({
      connected: true,
      asana_link: asanaLink,
      title: summary.title,
      kind: summary.kind,
    });
  } catch (error) {
    if (error instanceof AsanaNotConnectedError) {
      return NextResponse.json({
        connected: false,
        asana_link: asanaLink,
        title: null,
        kind: null,
      });
    }
    const message =
      error instanceof AsanaApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load Asana task";
    return NextResponse.json({
      connected: true,
      asana_link: asanaLink,
      title: null,
      kind: null,
      warning: message,
    });
  }
}
