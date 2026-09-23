"use client";

import React from "react";
import { useParams } from "next/navigation";
import BusinessReportShell from "@/components/reports/BusinessReportShell";

export default function BusinessReportPage() {
  const params = useParams();
  const reportKey = Array.isArray(params.report) ? params.report[0] : params.report;
  return <BusinessReportShell reportKey={reportKey} />;
}
