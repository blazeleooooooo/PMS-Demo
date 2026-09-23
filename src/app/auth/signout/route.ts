import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSiteUrl } from "@/lib/get-site-url";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  const siteUrl = getServerSiteUrl(req);
  const response = NextResponse.redirect(`${siteUrl}/login`, {
    status: 302,
  });
  // Clear the 7-day session login timestamp cookie
  response.cookies.delete("pms_last_login_at");
  return response;
}
