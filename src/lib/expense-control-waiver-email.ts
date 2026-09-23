import { isTeamOrAssignedScope } from "@/lib/staff-data-scope";

export type WaiverEmailStaff = {
  role: string | null;
  email: string | null;
  n_team_type_id: string | null;
};

function normalizeStaffEmail(raw: string | null | undefined): string | null {
  const email = (raw || "").trim().toLowerCase();
  return email.includes("@") ? email : null;
}

function isSameTeamSeniorUser(
  staff: WaiverEmailStaff,
  projectTeamId: string | null
): boolean {
  return (
    isTeamOrAssignedScope(staff.role) &&
    !!projectTeamId &&
    !!staff.n_team_type_id &&
    staff.n_team_type_id === projectTeamId
  );
}

/** Same-team Senior Users → To; other approvers → Cc. Skip missing emails. */
export function splitWaiverEmailRecipients(
  approvers: WaiverEmailStaff[],
  projectTeamId: string | null
): { to: string[]; cc: string[] } {
  const to = new Set<string>();
  const cc = new Set<string>();
  for (const staff of approvers) {
    const email = normalizeStaffEmail(staff.email);
    if (!email) continue;
    if (isSameTeamSeniorUser(staff, projectTeamId)) {
      to.add(email);
    } else {
      cc.add(email);
    }
  }
  for (const email of to) cc.delete(email);

  // Resend requires To. If no same-team Senior User has email, promote first Cc.
  if (to.size === 0 && cc.size > 0) {
    const [first, ...rest] = [...cc];
    return { to: [first], cc: rest };
  }
  return { to: [...to], cc: [...cc] };
}
