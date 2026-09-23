"use client";

// Route-level StaffFilterBar locks for design / team / (future) individual reports.
// Super Admin bypass is handled inside StaffFilterBar via isSuperAdmin.

import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { StaffFilterLocks } from "@/components/reports/StaffFilterBar";
import { EMPTY_STAFF_FILTERS, type StaffFilterState } from "@/components/reports/StaffFilterBar";

export type ReportStaffScope = "business" | "design" | "team" | "individual";

export function useIsSuperAdmin(): boolean {
  const { staff } = useAuth();
  return (staff as { role?: string } | null)?.role === "Super Admin";
}

/**
 * Build StaffFilterLocks for a report route family.
 * - design → position Designer
 * - team → teamId = current staff.n_team_type_id
 * - individual → staffId = current staff.id (reserved)
 */
export function useReportStaffLock(scope: ReportStaffScope): {
  locks: StaffFilterLocks;
  isSuperAdmin: boolean;
  defaultStaffFilter: StaffFilterState;
  teamTypeId: string | null;
} {
  const { staff } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const teamTypeId =
    (staff as { n_team_type_id?: string | null } | null)?.n_team_type_id ?? null;
  const staffId = staff?.id ?? null;

  const locks = useMemo<StaffFilterLocks>(() => {
    switch (scope) {
      case "design":
        return { position: "Designer" };
      case "team":
        return { teamId: teamTypeId };
      case "individual":
        return { staffId };
      default:
        return {};
    }
  }, [scope, teamTypeId, staffId]);

  const defaultStaffFilter = useMemo<StaffFilterState>(() => {
    const base = { ...EMPTY_STAFF_FILTERS };
    if (scope === "design") base.position = "Designer";
    if (scope === "team" && teamTypeId) base.team = teamTypeId;
    if (scope === "individual" && staffId) base.staffId = staffId;
    return base;
  }, [scope, teamTypeId, staffId]);

  return { locks, isSuperAdmin, defaultStaffFilter, teamTypeId };
}
