"use client";

// ─── TEAM-REPORTS REGISTRY ────────────────────────────────
// Team-scoped clones under /team-reports/* (top-nav 團隊工具 → 業務報表).
// AI WARNING: Each entry reuses the SAME component as the company-wide
// /business-reports/* or /design-reports/* reference. Pass reportScope="team"
// so StaffFilterBar locks Team (unless Super Admin).
// Do NOT fork separate Team*Report components — edit the shared files.

import React from "react";
import PMHitRateReport from "@/components/reports/PMHitRateReport";
import PersonalPerformanceReport from "@/components/reports/PersonalPerformanceReport";
import ProjectManhourAnalysisBoard from "@/components/reports/ProjectManhourAnalysisBoard";
import PMSourceAnalysisReport from "@/components/reports/PMSourceAnalysisReport";
import OverdueReceivableReport from "@/components/reports/OverdueReceivableReport";
import OutstandingProjectReport from "@/components/reports/OutstandingProjectReport";
import BadDebtProjectReport from "@/components/reports/BadDebtProjectReport";
import SalesByPMReport from "@/components/reports/SalesByPMReport";

export interface TeamReportDef {
  key: string;
  label: string;
  labelEn: string;
  /** Company-wide reference path (for AI / docs). */
  referenceHref: string;
  component: React.ReactNode;
}

export const TEAM_REPORTS: TeamReportDef[] = [
  {
    key: "pm-hit-rate",
    label: "項目經理命中率",
    labelEn: "PM Hit Rate",
    referenceHref: "/business-reports/pm-hit-rate",
    // AI WARNING: shared with pm-hit-rate + designer-hit-rate + pitch-hit-rate
    component: <PMHitRateReport role="pm" reportScope="team" />,
  },
  {
    key: "personal-performance",
    label: "個人BV表現",
    labelEn: "Personal BV Performance",
    referenceHref: "/business-reports/personal-performance",
    // AI WARNING: shared with /business-reports/personal-performance
    component: <PersonalPerformanceReport reportScope="team" />,
  },
  {
    key: "project-manhour-analysis",
    label: "項目工時分析",
    labelEn: "Project Manhour Analysis",
    referenceHref: "/design-reports/project-manhour-analysis",
    // AI WARNING: shared with /design-reports/project-manhour-analysis
    component: <ProjectManhourAnalysisBoard reportScope="team" />,
  },
  {
    key: "project-type-analysis",
    label: "項目類型分析",
    labelEn: "Project Type Analysis",
    referenceHref: "/design-reports/project-type-analysis",
    // AI WARNING: shared with /design-reports/project-type-analysis
    // (+ /business-reports/pm-analysis-source role="pm")
    component: <PMSourceAnalysisReport role="designer" reportScope="team" />,
  },
  {
    key: "overdue-receivable",
    label: "逾期應收項目",
    labelEn: "Overdue Receivable",
    referenceHref: "/business-reports/overdue-receivable",
    // AI WARNING: shared with /business-reports/overdue-receivable
    component: <OverdueReceivableReport reportScope="team" />,
  },
  {
    key: "outstanding-project",
    label: "未收款項目",
    labelEn: "Outstanding Project",
    referenceHref: "/business-reports/outstanding-project",
    // AI WARNING: shared with /business-reports/outstanding-project
    component: <OutstandingProjectReport reportScope="team" />,
  },
  {
    key: "bad-debt-project",
    label: "壞帳項目",
    labelEn: "Bad Debt Project",
    referenceHref: "/business-reports/bad-debt-project",
    // AI WARNING: shared with /business-reports/bad-debt-project
    component: <BadDebtProjectReport reportScope="team" />,
  },
  {
    key: "sales-by-pm",
    label: "按PM銷售統計",
    labelEn: "Sales by PM",
    referenceHref: "/business-reports/sales-by-pm",
    // AI WARNING: shared with /business-reports/sales-by-pm
    component: <SalesByPMReport reportScope="team" />,
  },
];

export const DEFAULT_TEAM_REPORT_KEY = TEAM_REPORTS[0].key;

export function getTeamReport(key: string): TeamReportDef | undefined {
  return TEAM_REPORTS.find((r) => r.key === key);
}
