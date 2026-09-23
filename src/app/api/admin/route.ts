import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Server-side only — service role key bypasses RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Sanitize error messages to prevent leaking internal IDs (e.g. Bubble IDs)
function sanitizeErrorMessage(message: string): string {
  // Replace Bubble-style IDs (long numeric strings with optional x separator)
  // e.g. "1685672350576x963059408873114900" → "[internal_id]"
  return message.replace(/\d{10,}([×x]\d+)?/g, "[internal_id]");
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "Supabase admin client not initialized. Check SUPABASE_SERVICE_KEY." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { action, table, data, id, updates, filter } = body;

    let result;

    switch (action) {
      case "query": {
        let query = supabaseAdmin.from(table).select("*");
        if (filter && typeof filter === "object") {
          for (const [key, value] of Object.entries(filter)) {
            query = query.eq(key, value as string);
          }
        }
        const { data: rows, error } = await query;
        if (error) {
          console.error(`[api/admin] query ${table} error:`, error.message);
          return NextResponse.json({ success: false, error: sanitizeErrorMessage(error.message) }, { status: 400 });
        }
        return NextResponse.json({ success: true, data: rows });
      }

      case "create": {
        const { data: created, error } = await supabaseAdmin
          .from(table)
          .insert(data)
          .select("id")
          .single();
        if (error) {
          console.error(`[api/admin] create ${table} error:`, error.message);
          return NextResponse.json({ success: false, error: sanitizeErrorMessage(error.message) }, { status: 400 });
        }
        result = { success: true, id: created?.id };
        break;
      }

      case "update": {
        const { error } = await supabaseAdmin
          .from(table)
          .update(updates)
          .eq("id", id);
        if (error) {
          console.error(`[api/admin] update ${table} error:`, error.message);
          return NextResponse.json({ success: false, error: sanitizeErrorMessage(error.message) }, { status: 400 });
        }
        result = { success: true };
        break;
      }

      case "delete": {
        const { error } = await supabaseAdmin
          .from(table)
          .delete()
          .eq("id", id);
        if (error) {
          console.error(`[api/admin] delete ${table} error:`, error.message);
          return NextResponse.json({ success: false, error: sanitizeErrorMessage(error.message) }, { status: 400 });
        }
        result = { success: true };
        break;
      }

      case "delete-where": {
        if (!filter || typeof filter !== "object") {
          return NextResponse.json({ success: false, error: "delete-where requires a filter object" }, { status: 400 });
        }
        let deleteQuery = supabaseAdmin.from(table).delete();
        for (const [key, value] of Object.entries(filter)) {
          deleteQuery = deleteQuery.eq(key, value as string);
        }
        const { error: delWhereErr } = await deleteQuery;
        if (delWhereErr) {
          console.error(`[api/admin] delete-where ${table} error:`, delWhereErr.message);
          return NextResponse.json({ success: false, error: sanitizeErrorMessage(delWhereErr.message) }, { status: 400 });
        }
        result = { success: true };
        break;
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[api/admin] Error:", err);
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(err?.message || "Internal server error") },
      { status: 500 }
    );
  }
}
