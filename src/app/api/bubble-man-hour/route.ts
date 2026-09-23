import { NextRequest, NextResponse } from "next/server";

// ─── Bubble API Proxy Route ─────────────────────────────────
// Proxies requests to Bubble Data API and Workflow API to avoid
// CORS issues and keep the API token server-side.

const BUBBLE_WF_BASE = "";
const BUBBLE_DATA_BASE = "";
const BUBBLE_API_TOKEN = process.env.NEXT_PUBLIC_BUBBLE_API_TOKEN || "";

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${BUBBLE_API_TOKEN}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!BUBBLE_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing NEXT_PUBLIC_BUBBLE_API_TOKEN" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      // ─── Data API: List objects ─────────────────────────
      case "data_list": {
        const { objectName, cursor, limit, sort_field, descending, constraints } = params;
        if (!objectName) {
          return NextResponse.json({ success: false, error: "objectName is required" }, { status: 400 });
        }

        const url = new URL(`${BUBBLE_DATA_BASE}/${encodeURIComponent(objectName)}`);
        if (cursor) url.searchParams.set("cursor", String(cursor));
        if (limit) url.searchParams.set("limit", String(limit));
        if (sort_field) url.searchParams.set("sort_field", String(sort_field));
        if (descending !== undefined) url.searchParams.set("descending", String(descending));
        if (constraints) url.searchParams.set("constraints", JSON.stringify(constraints));

        const res = await fetch(url.toString(), { headers: authHeaders() });
        if (!res.ok) {
          const errText = await res.text();
          return NextResponse.json(
            { success: false, error: `Bubble API ${res.status}: ${errText}` },
            { status: res.status }
          );
        }
        const data = await res.json();
        return NextResponse.json({ success: true, data: data.response });
      }

      // ─── Data API: Get by ID ───────────────────────────
      case "data_get": {
        const { objectName: objName, id } = params;
        if (!objName || !id) {
          return NextResponse.json({ success: false, error: "objectName and id are required" }, { status: 400 });
        }

        const url = `${BUBBLE_DATA_BASE}/${encodeURIComponent(objName)}/${id}`;
        const res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) {
          const errText = await res.text();
          return NextResponse.json(
            { success: false, error: `Bubble API ${res.status}: ${errText}` },
            { status: res.status }
          );
        }
        const data = await res.json();
        return NextResponse.json({ success: true, data: data.response });
      }

      // ─── Workflow API: Trigger ─────────────────────────
      case "workflow": {
        const { workflowName, payload } = params;
        if (!workflowName) {
          return NextResponse.json({ success: false, error: "workflowName is required" }, { status: 400 });
        }

        const url = `${BUBBLE_WF_BASE}/${encodeURIComponent(workflowName)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload || {}),
        });

        if (!res.ok) {
          const errText = await res.text();
          return NextResponse.json(
            { success: false, error: `Bubble Workflow API ${res.status}: ${errText}` },
            { status: res.status }
          );
        }

        const text = await res.text();
        let responseData: any = { success: true };
        if (text) {
          try {
            responseData = { success: true, data: JSON.parse(text) };
          } catch {
            responseData = { success: true, data: text };
          }
        }
        return NextResponse.json(responseData);
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error("[bubble-man-hour API route] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
