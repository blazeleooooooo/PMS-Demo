"use client";

// ─── INDIVIDUAL REPORT PAGE SHELL ─────────────────────────────
// TopNav chrome for /individual-reports/* (項目管理 / 項目收支).
// Route permission: individual-reports.<key> via RouteGuard.

import React from "react";
import AppShell from "@/components/layout/AppShell";
import {
  getIndividualReport,
  DEFAULT_INDIVIDUAL_REPORT_KEY,
} from "@/components/reports/individual-report-registry";

export default function IndividualReportShell({
  reportKey,
}: {
  reportKey?: string;
}) {
  const report =
    getIndividualReport(reportKey || DEFAULT_INDIVIDUAL_REPORT_KEY) ||
    getIndividualReport(DEFAULT_INDIVIDUAL_REPORT_KEY)!;

  return (
    <AppShell contentClassName="overflow-hidden" mainClassName="max-w-full overflow-hidden">
      {report.component}
    </AppShell>
  );
}
