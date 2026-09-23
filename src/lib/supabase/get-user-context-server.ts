import { createClient } from "@/lib/supabase/server";
import type { UserProfile, StaffData, UserContext } from "@/hooks/use-auth";

/**
 * Server-side function to fetch the full user context (session + profile + staff).
 * Called once during SSR in the root layout — data is passed to the client AuthProvider
 * as initial props, eliminating the need for client-side re-fetching on every page load.
 */
export async function getUserContextServer(): Promise<{
  user: { id: string; email: string } | null;
  userContext: UserContext | null;
}> {
  try {
    const supabase = await createClient();

    // getUser() validates the JWT against Supabase Auth — this is the canonical server check
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || !user.email) {
      return { user: null, userContext: null };
    }

    // Fetch user context via the same RPC used client-side
    const { data, error: rpcError } = await supabase.rpc(
      "get_complete_user_context",
      { input_email: user.email.toLowerCase().trim() }
    );

    if (rpcError || !data || data.length === 0) {
      // User is authenticated but profile data not found — return minimal info
      const emailName = user.email.split("@")[0] || "用戶";
      return {
        user: { id: user.id, email: user.email },
        userContext: {
          profile: null,
          staff: null,
          displayName: emailName,
          initials: computeInitials(emailName),
        },
      };
    }

    const row = data[0];

    // Parse profile
    const profileData = row.profile_data as Record<string, any> | null;
    let parsedProfile: UserProfile | null = null;
    if (profileData && profileData.id) {
      parsedProfile = {
        id: profileData.id,
        email: profileData.email ?? null,
        user_type: profileData.user_type ?? null,
        member: profileData.member ?? null,
        member_id: profileData.member_id ?? null,
        supplier: profileData.supplier ?? null,
        supplier_id: profileData.supplier_id ?? null,
        customer: profileData.customer ?? null,
        customer_id: profileData.customer_id ?? null,
        is_developer: profileData.is_developer === true,
      };
    }

    // Parse staff
    const staffData = row.staff_data as Record<string, any> | null;
    let parsedStaff: StaffData | null = null;
    if (staffData && staffData.id) {
      parsedStaff = staffData as StaffData;
    }

    // Resolve display name
    const emailName = user.email.split("@")[0] || "用戶";
    const resolvedName = row.display_name || emailName;

    return {
      user: { id: user.id, email: user.email },
      userContext: {
        profile: parsedProfile,
        staff: parsedStaff,
        displayName: resolvedName,
        initials: computeInitials(resolvedName),
      },
    };
  } catch (err) {
    console.error("[getUserContextServer] Unexpected error:", err);
    return { user: null, userContext: null };
  }
}

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
