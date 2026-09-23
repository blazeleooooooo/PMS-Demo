"use client";

// AI WARNING: Individual report pages reuse shared report components via
// individual-report-registry.tsx (reportScope="individual").

import { useParams } from "next/navigation";
import IndividualReportShell from "@/components/reports/IndividualReportShell";

export default function IndividualReportPage() {
  const params = useParams();
  const reportKey = Array.isArray(params.report)
    ? params.report[0]
    : params.report;
  return <IndividualReportShell reportKey={reportKey} />;
}
