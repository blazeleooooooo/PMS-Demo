import { createClient } from "@/lib/supabase/server";

/**
 * Resolve the staff id for an API request.
 * Uses the logged-in user's staff record; optional requestedStaffId supports
 * developer impersonation (client-side) when the real user is is_developer.
 */
export async function resolveApiStaffId(
  requestedStaffId?: string | null
): Promise<{ staffId: string | null; isDeveloper: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { staffId: null, isDeveloper: false };
  }

  const { data, error } = await supabase.rpc("get_complete_user_context", {
    input_email: user.email.toLowerCase().trim(),
  });

  if (error || !data?.length) {
    return { staffId: null, isDeveloper: false };
  }

  const row = data[0];
  const profile = row.profile_data as Record<string, unknown> | null;
  const staff = row.staff_data as { id?: string } | null;
  const authStaffId =
    (staff?.id as string | undefined) ?? (profile?.member_id as string | undefined) ?? null;
  const isDeveloper = profile?.is_developer === true;

  if (requestedStaffId) {
    if (requestedStaffId === authStaffId || isDeveloper) {
      return { staffId: requestedStaffId, isDeveloper };
    }
    return { staffId: null, isDeveloper: false };
  }

  return { staffId: authStaffId, isDeveloper };
}
