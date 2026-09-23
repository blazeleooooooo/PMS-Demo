"use client";

// ─── TEAM REPORT PAGE SHELL ────────────────────────────────
// TopNav chrome for /team-reports/* (團隊工具 top-nav group).
// Same layout pattern as BusinessReportShell / design-reports pages.
// Route permission: team-reports.<key> via RouteGuard.

import React from "react";
import AppShell from "@/components/layout/AppShell";
import {
  getTeamReport,
  DEFAULT_TEAM_REPORT_KEY,
} from "@/components/reports/team-report-registry";

export default function TeamReportShell({ reportKey }: { reportKey?: string }) {
  const report =
    getTeamReport(reportKey || DEFAULT_TEAM_REPORT_KEY) ||
    getTeamReport(DEFAULT_TEAM_REPORT_KEY)!;

  return (
    <AppShell contentClassName="overflow-hidden" mainClassName="max-w-full overflow-hidden">
      {report.component}
    </AppShell>
  );
}
