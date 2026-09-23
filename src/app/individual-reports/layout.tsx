"use client";

import { ReportDateRangeProvider } from "@/components/reports/ReportDateRangeContext";
import { useTeamReportSourceSync } from "@/hooks/use-team-report-source-sync";

function IndividualReportSourceSync({ children }: { children: React.ReactNode }) {
  useTeamReportSourceSync();
  return <>{children}</>;
}

// Keeps date range + BWA/BWF filter state mounted while switching
// between /individual-reports/* routes.
// Same team-line source sync as /team-reports (BWF staff default to BWF).
export default function IndividualReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ReportDateRangeProvider>
      <IndividualReportSourceSync>{children}</IndividualReportSourceSync>
    </ReportDateRangeProvider>
  );
}
