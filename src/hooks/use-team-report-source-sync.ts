"use client";

// Team / individual reports lock StaffFilterBar to the current staff's team,
// but the BWA/BWF source toggle is a separate session default (BWA).
// A BWF team + BWA source yields an empty table — and developer impersonation
// does not reproduce it, because the widget keeps the developer's stored source.
// Sync the source to team_types.is_bwf when the team lock is in effect.

import { useEffect, useRef } from "react";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";
import { useIsSuperAdmin } from "@/hooks/use-report-staff-lock";
import { useAuth } from "@/hooks/use-auth";
import { fetchTeamTypeIsBwf } from "@/lib/data/lookups";

export function useTeamReportSourceSync(): void {
  const { staff } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const { sources, selectSource } = useReportRange();
  const teamTypeId =
    (staff as { n_team_type_id?: string | null } | null)?.n_team_type_id ?? null;
  const lastSyncedTeam = useRef<string | null>(null);

  useEffect(() => {
    if (isSuperAdmin || !teamTypeId) return;
    if (lastSyncedTeam.current === teamTypeId) return;

    let cancelled = false;
    fetchTeamTypeIsBwf(teamTypeId).then((isBwf) => {
      if (cancelled || isBwf == null) return;
      lastSyncedTeam.current = teamTypeId;
      const want: "bwa" | "bwf" = isBwf ? "bwf" : "bwa";
      const already =
        (want === "bwf" && sources.bwf && !sources.bwa) ||
        (want === "bwa" && sources.bwa && !sources.bwf);
      if (!already) selectSource(want);
    });

    return () => {
      cancelled = true;
    };
    // Intentionally omit sources — do not fight a later manual toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamTypeId, isSuperAdmin, selectSource]);
}
