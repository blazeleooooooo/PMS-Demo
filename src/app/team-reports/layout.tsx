"use client";

import { ReportDateRangeProvider } from "@/components/reports/ReportDateRangeContext";
import { useTeamReportSourceSync } from "@/hooks/use-team-report-source-sync";

function TeamReportSourceSync({ children }: { children: React.ReactNode }) {
  useTeamReportSourceSync();
  return <>{children}</>;
}

// Keeps date range + BWA/BWF filter state mounted while switching
// between /team-reports/* routes (same provider as business/design reports).
// Source sync: locked team is_bwf → BWF (otherwise BWA). Super Admin skipped.
export default function TeamReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ReportDateRangeProvider>
      <TeamReportSourceSync>{children}</TeamReportSourceSync>
    </ReportDateRangeProvider>
  );
}
