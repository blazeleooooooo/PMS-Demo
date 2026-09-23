import { NextRequest, NextResponse } from "next/server";

/**
 * Resolve OTC Bubble Staff._id → Display Name for man-hour UI fallback.
 * Server-side only; never returns Bubble IDs as labels.
 *
 * POST { ids: string[] } → { success: true, names: Record<string, string> }
 */

const BUBBLE_DATA_BASE = "";
const EDGE_SLUG = "supabase-functions-man-hour-staff-phase-a";

function isBubbleId(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\d{10,}([×x]\d+)?$/.test(value.trim());
}

function otcDisplayName(otc: any): string | null {
  const name = String(otc?.["Display Name"] || otc?.["Name"] || "").trim();
  if (!name || isBubbleId(name)) return null;
  return name;
}

async function resolveViaBubbleEnv(ids: string[]): Promise<Record<string, string>> {
  const token =
    process.env.BUBBLE_API_TOKEN || process.env.NEXT_PUBLIC_BUBBLE_API_TOKEN || "";
  if (!token) throw new Error("NO_LOCAL_BUBBLE_TOKEN");

  const names: Record<string, string> = {};
  await Promise.all(
    ids.map(async (id) => {
      const url = `${BUBBLE_DATA_BASE}/${encodeURIComponent("Staff")}/${encodeURIComponent(id)}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) return;
      const json = await res.json();
      const label = otcDisplayName(json.response);
      if (label) names[id] = label;
    })
  );
  return names;
}

async function resolveViaEdge(ids: string[]): Promise<Record<string, string>> {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY for edge fallback");
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/${EDGE_SLUG}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ action: "resolve_names", ids }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Edge resolve_names failed (${res.status})`);
  }
  return (json.names || {}) as Record<string, string>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawIds: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
    const ids: string[] = [
      ...new Set(
        rawIds
          .map((id) => String(id ?? "").trim())
          .filter((id): id is string => id.length > 0)
      ),
    ].slice(0, 100);

    if (ids.length === 0) {
      return NextResponse.json({ success: true, names: {} });
    }

    let names: Record<string, string> = {};
    try {
      names = await resolveViaBubbleEnv(ids);
    } catch {
      names = await resolveViaEdge(ids);
    }

    // Safety: never leak Bubble ID strings as labels
    const cleaned: Record<string, string> = {};
    for (const [id, label] of Object.entries(names)) {
      if (label && !isBubbleId(label)) cleaned[id] = label.trim();
    }

    return NextResponse.json({ success: true, names: cleaned });
  } catch (err: any) {
    console.error("[otc-staff-display-names]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to resolve OTC staff names" },
      { status: 500 }
    );
  }
}
