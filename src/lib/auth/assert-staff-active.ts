import type { SupabaseClient } from "@supabase/supabase-js";

export const STAFF_INACTIVE_LOGIN_ERROR =
  "此職員帳戶已停用，無法登入。請聯繫管理員。";

type StaffActiveResult =
  | { allowed: true }
  | { allowed: false; error: string };

/**
 * For Staff users, block login when the linked staff row is Inactive.
 * Supplier / Customer / unknown types are not gated here.
 * Fail-open when no staff link is found (only block on positive Inactive).
 */
export async function assertStaffActiveForLogin(
  admin: SupabaseClient,
  email: string
): Promise<StaffActiveResult> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) return { allowed: true };

  const { data: user, error: userError } = await admin
    .from("users")
    .select("id, user_type, member_id")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (userError || !user) return { allowed: true };
  if (user.user_type !== "Staff") return { allowed: true };

  let status: string | null = null;

  if (user.member_id) {
    const { data: staff } = await admin
      .from("staff")
      .select("status")
      .eq("id", user.member_id)
      .maybeSingle();
    status = staff?.status ?? null;
  } else {
    const { data: staff } = await admin
      .from("staff")
      .select("status")
      .ilike("email", normalizedEmail)
      .order("status", { ascending: true }) // Active before Inactive if duplicates
      .limit(1)
      .maybeSingle();
    status = staff?.status ?? null;
  }

  if (status && status.toLowerCase() === "inactive") {
    return { allowed: false, error: STAFF_INACTIVE_LOGIN_ERROR };
  }

  return { allowed: true };
}
