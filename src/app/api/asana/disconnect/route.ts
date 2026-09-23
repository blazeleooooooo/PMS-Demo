import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteAsanaOAuthTokens } from "@/lib/asana-oauth";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteAsanaOAuthTokens(user.id);
    return NextResponse.json({ connected: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to disconnect Asana";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
