"use client";

// Shared local + sessionStorage state for Project / Staff / L2 filters.
// Date + BWA/BWF live in ReportDateRangeContext separately.

import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_PROJECT_FILTERS,
  type ProjectFilterState,
} from "@/components/reports/ProjectFilterBar";
import {
  applyStaffLocks,
  EMPTY_STAFF_FILTERS,
  type StaffFilterLocks,
  type StaffFilterState,
} from "@/components/reports/StaffFilterBar";
import type { MoneyBasis } from "@/components/reports/MoneyBasisToggle";
import {
  readAlignedFilters,
  writeAlignedFilters,
} from "@/lib/report-filter-persist";
import {
  useReportStaffLock,
  type ReportStaffScope,
} from "@/hooks/use-report-staff-lock";

export function useAlignedReportFilters(scope: ReportStaffScope = "business") {
  const { locks, isSuperAdmin, defaultStaffFilter, teamTypeId } =
    useReportStaffLock(scope);
  const lockedStaffId = locks.staffId ?? null;

  const stored = typeof window !== "undefined" ? readAlignedFilters() : null;

  const [projectFilter, setProjectFilterRaw] = useState<ProjectFilterState>(
    () => stored?.project ?? { ...EMPTY_PROJECT_FILTERS },
  );
  const [staffFilter, setStaffFilterRaw] = useState<StaffFilterState>(() => {
    const fromStore = stored?.staff ?? { ...EMPTY_STAFF_FILTERS };
    // Merge route defaults (e.g. design Designer / individual self) then apply locks.
    const merged = {
      ...fromStore,
      position:
        scope === "design" && fromStore.position === "all"
          ? "Designer"
          : fromStore.position,
      team:
        scope === "team" && fromStore.team === "all" && teamTypeId
          ? teamTypeId
          : fromStore.team,
      staffId:
        scope === "individual" && fromStore.staffId === "all" && lockedStaffId
          ? lockedStaffId
          : fromStore.staffId,
    };
    return applyStaffLocks(merged, locks, isSuperAdmin);
  });
  const [moneyBasis, setMoneyBasis] = useState<MoneyBasis>(
    () => stored?.moneyBasis ?? "l2",
  );

  // Re-apply locks when team id resolves after auth load.
  useEffect(() => {
    setStaffFilterRaw((prev) => applyStaffLocks(prev, locks, isSuperAdmin));
  }, [locks.teamId, locks.position, locks.staffId, isSuperAdmin]);

  useEffect(() => {
    writeAlignedFilters({
      project: projectFilter,
      staff: staffFilter,
      moneyBasis,
    });
  }, [projectFilter, staffFilter, moneyBasis]);

  const setProjectFilter = useCallback((next: ProjectFilterState) => {
    setProjectFilterRaw({ ...next, pm: "all" });
  }, []);

  const setStaffFilter = useCallback(
    (next: StaffFilterState) => {
      setStaffFilterRaw(applyStaffLocks(next, locks, isSuperAdmin));
    },
    [locks, isSuperAdmin],
  );

  return {
    projectFilter,
    setProjectFilter,
    staffFilter,
    setStaffFilter,
    moneyBasis,
    setMoneyBasis,
    staffLocks: locks as StaffFilterLocks,
    isSuperAdmin,
    defaultStaffFilter,
    teamTypeId,
  };
}
