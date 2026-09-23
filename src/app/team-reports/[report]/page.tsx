"use client";

// AI WARNING: Team report pages reuse shared report components via
// team-report-registry.tsx (reportScope="team"). See each component's AI WARNING
// header for the company-wide twin route.

import { useParams } from "next/navigation";
import TeamReportShell from "@/components/reports/TeamReportShell";

export default function TeamReportPage() {
  const params = useParams();
  const reportKey = Array.isArray(params.report)
    ? params.report[0]
    : params.report;
  return <TeamReportShell reportKey={reportKey} />;
}
