/**
 * Role-based row filtering (shared across BWA pitchings/projects, waivers, etc.).
 *
 * - Admin / Super Admin → company-wide (all rows)
 * - Senior User → same team (n_team_type_id) OR explicitly assigned
 * - User → only rows they are assigned to
 *
 * Page open / create / edit / delete stays in /admin/permissions.
 * This module only answers: which data rows is this staff allowed to see/act on?
 */

export interface StaffDataScope {
  staffId: string;
  role: string | null;
  teamTypeId: string | null;
}

/** Visibility tier used when filtering lists / gating row actions. */
export type StaffRowScope = "all" | "team_or_assigned" | "assigned_only";

export function normalizeStaffRoleKey(role: string | null | undefined): string {
  return (role || "").trim().toLowerCase();
}

/** Super Admin only — not Admin. Used for rare overrides (e.g. self-approve). */
export function isSuperAdminRole(role: string | null | undefined): boolean {
  const r = normalizeStaffRoleKey(role);
  return r === "super admin" || (r.includes("super") && r.includes("admin"));
}

/** Super Admin or Admin — field-level edits such as income payment_status. */
export function isAdminOrAboveRole(role: string | null | undefined): boolean {
  if (isSuperAdminRole(role)) return true;
  return normalizeStaffRoleKey(role) === "admin";
}

/**
 * Map staff.role → row-visibility tier.
 * Matches list filtering in fetchBWAPitchingsPaginated / fetchBWAProjects:
 * only "user" and "senior user" are restricted; everything else sees all.
 * Missing/blank role is treated as User (assigned-only), same as the list fetchers.
 */
export function getStaffRowScope(role: string | null | undefined): StaffRowScope {
  const r = normalizeStaffRoleKey(role) || "user";
  if (r === "senior user" || (r.includes("senior") && r.includes("user"))) {
    return "team_or_assigned";
  }
  if (r === "user") return "assigned_only";
  return "all";
}

export function isCompanyWideScope(role: string | null | undefined): boolean {
  return getStaffRowScope(role) === "all";
}

export function isTeamOrAssignedScope(role: string | null | undefined): boolean {
  return getStaffRowScope(role) === "team_or_assigned";
}

export function isAssignedOnlyScope(role: string | null | undefined): boolean {
  return getStaffRowScope(role) === "assigned_only";
}

/** Pure visibility check for one row given assignment + team ids. */
export function isRowVisibleToStaff(
  scope: StaffRowScope,
  opts: {
    staffTeamTypeId: string | null | undefined;
    rowTeamTypeId: string | null | undefined;
    isAssigned: boolean;
  }
): boolean {
  if (scope === "all") return true;
  if (scope === "assigned_only") return opts.isAssigned;
  const staffTeam = opts.staffTeamTypeId || null;
  const rowTeam = opts.rowTeamTypeId || null;
  const sameTeam = !!staffTeam && !!rowTeam && staffTeam === rowTeam;
  return sameTeam || opts.isAssigned;
}

export function filterRowsByStaffScope<T>(
  rows: T[],
  staff: StaffDataScope,
  getMeta: (row: T) => {
    teamTypeId: string | null | undefined;
    isAssigned: boolean;
  }
): T[] {
  const scope = getStaffRowScope(staff.role);
  if (scope === "all") return rows;
  return rows.filter((row) => {
    const meta = getMeta(row);
    return isRowVisibleToStaff(scope, {
      staffTeamTypeId: staff.teamTypeId,
      rowTeamTypeId: meta.teamTypeId,
      isAssigned: meta.isAssigned,
    });
  });
}
