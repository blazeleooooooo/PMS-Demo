"use client";

// ─── BUSINESS REPORT PAGE SHELL ───────────────────────────────
// Renders a single report as a top-level page: TopNav chrome (業務報表 is now
// its own top-nav group, its reports are the sidebar items), the shared
// date-range provider lives in app/business-reports/layout.tsx,
// and the active report component. Route-level view permission is enforced by
// RouteGuard via business-reports.<key> modules.

import React from "react";
import AppShell from "@/components/layout/AppShell";
import { getReport, DEFAULT_REPORT_KEY } from "@/components/reports/report-registry";

export default function BusinessReportShell({ reportKey }: { reportKey?: string }) {
  const report = getReport(reportKey || DEFAULT_REPORT_KEY) || getReport(DEFAULT_REPORT_KEY)!;

  return (
    <AppShell contentClassName="overflow-hidden" mainClassName="max-w-full overflow-hidden">
      {report.component}
    </AppShell>
  );
}
