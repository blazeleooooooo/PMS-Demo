import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  confirmBwfQuoteStatus,
  fetchBwfQuotesForPitching,
  fetchBwfQuotesForProject,
  linkBwfQuotesToProject,
} from "@/lib/bwf-quote-service";
import { isBwfSupabaseConfigured } from "@/lib/supabase/bwf";

export const dynamic = "force-dynamic";

/**
 * List Furniture 1000 bwf_quote rows linked to a PMS BWF pitching or project.
 * Uses the server-side BWF client (no browser cookie/session collision).
 *
 * Query: pitchingId (+ optional pitchingCode) OR projectId (+ optional projectCode)
 */
export async function GET(request: Request) {
  const pms = await createClient();
  const {
    data: { user },
    error: authError,
  } = await pms.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBwfSupabaseConfigured()) {
    return NextResponse.json(
      { error: "bwf_not_configured", quotes: [] },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const pitchingId = searchParams.get("pitchingId")?.trim();
  const pitchingCode = searchParams.get("pitchingCode")?.trim() || null;
  const projectId = searchParams.get("projectId")?.trim();
  const projectCode = searchParams.get("projectCode")?.trim() || null;

  if (!pitchingId && !projectId) {
    return NextResponse.json(
      { error: "pitchingId or projectId is required" },
      { status: 400 }
    );
  }

  try {
    const quotes = projectId
      ? await fetchBwfQuotesForProject(projectId, projectCode)
      : await fetchBwfQuotesForPitching(pitchingId!, pitchingCode);
    return NextResponse.json({ quotes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load quotes";
    console.error("[api/bwf/quotes]", message);
    return NextResponse.json({ error: message, quotes: [] }, { status: 500 });
  }
}

/**
 * After convert-to-project: set bwf_quote.bwf_project_id for quotes linked
 * to the pitching via bwf_pitching_id. Optionally confirm one selected quote
 * (status → 已確認).
 *
 * Body: { pitchingId: string, projectId: string, confirmQuoteId?: string }
 */
export async function POST(request: Request) {
  const pms = await createClient();
  const {
    data: { user },
    error: authError,
  } = await pms.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBwfSupabaseConfigured()) {
    return NextResponse.json(
      {
        error: "bwf_not_configured",
        updated: 0,
        quoteIds: [],
        confirmed: null,
      },
      { status: 503 }
    );
  }

  let body: {
    pitchingId?: string;
    projectId?: string;
    confirmQuoteId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pitchingId = body.pitchingId?.trim();
  const projectId = body.projectId?.trim();
  const confirmQuoteId = body.confirmQuoteId?.trim() || null;

  if (!pitchingId || !projectId) {
    return NextResponse.json(
      { error: "pitchingId and projectId are required" },
      { status: 400 }
    );
  }

  try {
    const result = await linkBwfQuotesToProject(pitchingId, projectId);
    let confirmed: Awaited<ReturnType<typeof confirmBwfQuoteStatus>> | null =
      null;
    if (confirmQuoteId) {
      confirmed = await confirmBwfQuoteStatus(confirmQuoteId, projectId);
    }
    return NextResponse.json({ ...result, confirmed });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to link quotes to project";
    console.error("[api/bwf/quotes POST]", message);
    return NextResponse.json(
      { error: message, updated: 0, quoteIds: [], confirmed: null },
      { status: 500 }
    );
  }
}
