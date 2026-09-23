"use client";

import { ReportDateRangeProvider } from "@/components/reports/ReportDateRangeContext";

// Keeps date range + BWA/BWF filter state mounted while the user switches
// between /business-reports/* routes (same pattern as shared report chrome).
export default function BusinessReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ReportDateRangeProvider>{children}</ReportDateRangeProvider>;
}
