import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  AsanaOAuthConfigError,
  getAsanaOAuthStatus,
} from "@/lib/asana-oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getAsanaOAuthStatus(user.id);
    return NextResponse.json(status);
  } catch (err) {
    const message =
      err instanceof AsanaOAuthConfigError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Failed to load Asana status";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
