"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import BusinessReportShell from "@/components/reports/BusinessReportShell";
import { DEFAULT_REPORT_KEY } from "@/components/reports/report-registry";

export default function BusinessReportsPage() {
  const router = useRouter();
  // Canonicalize to the default report's own URL so the sidebar highlights it.
  useEffect(() => {
    router.replace(`/business-reports/${DEFAULT_REPORT_KEY}`);
  }, [router]);

  return <BusinessReportShell reportKey={DEFAULT_REPORT_KEY} />;
}
