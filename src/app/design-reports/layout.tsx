"use client";

import { ReportDateRangeProvider } from "@/components/reports/ReportDateRangeContext";

// Shared date range + BWA/BWF source filter for /design-reports/* (same chrome
// as /business-reports). Required by PMHitRateReport / PMSourceAnalysisReport
// when role="designer".
export default function DesignReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ReportDateRangeProvider>{children}</ReportDateRangeProvider>;
}
