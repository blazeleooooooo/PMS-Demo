"use client";

// ─── INDIVIDUAL-REPORTS REGISTRY ──────────────────────────────
// Individual-scoped pages under /individual-reports/*
// (top-nav 項目管理 → 業務報表, or 項目收支 for cash-related reports).
// AI WARNING: Reuse shared report components with reportScope="individual"
// so StaffFilterBar locks 員工 to the current user (unless Super Admin).
// Do NOT fork separate Individual*Report components — edit the shared files.

import React from "react";
import PersonalPerformanceReport from "@/components/reports/PersonalPerformanceReport";
import L2L3VarianceReport from "@/components/reports/L2L3VarianceReport";
import SharedGpTrendReport from "@/components/reports/SharedGpTrendReport";
import PMHitRateReport from "@/components/reports/PMHitRateReport";
import ReceivableManagement from "@/components/accounting/ReceivableManagement";

export interface IndividualReportDef {
  key: string;
  label: string;
  labelEn: string;
  /** Company-wide or related reference path (for AI / docs). */
  referenceHref?: string;
  component: React.ReactNode;
}

export const INDIVIDUAL_REPORTS: IndividualReportDef[] = [
  {
    key: "personal-performance",
    label: "個人BV表現",
    labelEn: "Personal BV Performance",
    referenceHref: "/business-reports/personal-performance",
    // AI WARNING: shared with /business-reports + /team-reports personal-performance
    component: <PersonalPerformanceReport reportScope="individual" />,
  },
  {
    key: "risky-project",
    label: "L2 L3 比較表",
    labelEn: "L2 L3 Comparison Table",
    referenceHref: "/business-reports/risky-project",
    // AI WARNING: shared with /business-reports/risky-project (L2L3VarianceReport)
    component: <L2L3VarianceReport reportScope="individual" />,
  },
  {
    key: "overdue-receivable",
    label: "個人逾期應收",
    labelEn: "Personal Overdue Receivable",
    // Layout/reference: /receivable (ReceivableManagement), not the PM-aggregate
    // /business-reports/overdue-receivable report.
    referenceHref: "/receivable",
    component: <ReceivableManagement mode="personal-overdue" />,
  },
  {
    key: "shared-gp-trend",
    label: "Shared GP趨勢",
    labelEn: "Shared GP Trend",
    // Layout mirrors /business-reports/financial-summary; metrics from project_bv shared GP.
    component: <SharedGpTrendReport reportScope="individual" />,
  },
  {
    key: "pitch-hit-rate",
    label: "投標Hit Rate",
    labelEn: "Pitch Hit Rate",
    referenceHref: "/business-reports/pm-hit-rate",
    // AI WARNING: shared with /business-reports/pm-hit-rate (role="pm").
    // Individual layout = one staff row's Overall Pitching / Projects / Hit Rate.
    component: <PMHitRateReport role="pm" reportScope="individual" />,
  },
];

export const DEFAULT_INDIVIDUAL_REPORT_KEY = INDIVIDUAL_REPORTS[0].key;

export function getIndividualReport(key: string): IndividualReportDef | undefined {
  return INDIVIDUAL_REPORTS.find((r) => r.key === key);
}
