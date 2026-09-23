"use client";

// ─── BUSINESS-REPORTS REGISTRY ────────────────────────────────
// Single source of truth mapping each report key → its category, labels,
// and component. Used by the /business-reports/[report] pages to render a
// report, and mirrored by the sidebar nav in mock-data.ts (keep keys/labels
// in sync). Categories become the sidebar `section` headers.

import React from "react";
import SalesTrendReport from "@/components/reports/SalesTrendReport";
import SalesByPMReport from "@/components/reports/SalesByPMReport";
import PMHitRateReport from "@/components/reports/PMHitRateReport";
import SalesByCategoryReport from "@/components/reports/SalesByCategoryReport";
import DiscountedProjectReport from "@/components/reports/DiscountedProjectReport";
import OverdueReceivableReport from "@/components/reports/OverdueReceivableReport";
import OutstandingProjectReport from "@/components/reports/OutstandingProjectReport";
import AOProjectReport from "@/components/reports/AOProjectReport";
import BadDebtProjectReport from "@/components/reports/BadDebtProjectReport";
import FinancialSummaryReport from "@/components/reports/FinancialSummaryReport";
import ProfitabilityByProjectReport from "@/components/reports/ProfitabilityByProjectReport";
import L2L3VarianceReport from "@/components/reports/L2L3VarianceReport";
import PMSourceAnalysisReport from "@/components/reports/PMSourceAnalysisReport";
import BVPerformanceReport from "@/components/reports/BVPerformanceReport";
import PersonalPerformanceReport from "@/components/reports/PersonalPerformanceReport";

export interface ReportDef {
  key: string;
  label: string;
  labelEn: string;
  description: string;
  category: string;
  component: React.ReactNode;
}

// Ordered, flat list — order also drives the sidebar order.
export const REPORTS: ReportDef[] = [
  // 財務報告 Financial Reports
  {
    key: "financial-summary",
    label: "財務摘要",
    labelEn: "Financial Summary",
    description: "收入、成本及毛利的關鍵指標",
    category: "財務報告 Financial Reports",
    component: <FinancialSummaryReport />,
  },
  {
    key: "profitability-by-project",
    label: "項目毛利分析",
    labelEn: "Profitability by Project",
    description: "每張訂單的成本及毛利明細",
    category: "財務報告 Financial Reports",
    component: <ProfitabilityByProjectReport />,
  },
  {
    key: "risky-project",
    label: "L2 L3 比較表",
    labelEn: "L2 L3 Comparison Table",
    description: "找出簽約與實際出現重大差異、需要關注的項目",
    category: "財務報告 Financial Reports",
    // AI WARNING: shared with /individual-reports/risky-project (reportScope="individual").
    component: <L2L3VarianceReport />,
  },
  // 銷售及市場營銷 Sales & Marketing
  {
    key: "sales-trend",
    label: "銷售趨勢報表",
    labelEn: "Sales Trend Report",
    description: "按時間分段分析各員工的共享毛利",
    category: "銷售及市場營銷 Sales & Marketing",
    component: <SalesTrendReport />,
  },
  {
    key: "sales-by-pm",
    // AI WARNING: SalesByPMReport is shared with /team-reports/sales-by-pm
    // (reportScope="team"). Edits to that component affect both pages.
    label: "按PM銷售統計",
    labelEn: "Sales by PM",
    description: "按項目經理分類的銷售表現",
    category: "銷售及市場營銷 Sales & Marketing",
    component: <SalesByPMReport />,
  },
  {
    key: "pm-hit-rate",
    // AI WARNING: PMHitRateReport is shared with /design-reports/designer-hit-rate
    // (role="designer"), /team-reports/pm-hit-rate (reportScope="team"), and
    // /individual-reports/pitch-hit-rate (reportScope="individual").
    // Edits to that component affect all linked pages.
    label: "項目經理命中率",
    labelEn: "PM Hit Rate",
    description: "提案轉化率分析",
    category: "銷售及市場營銷 Sales & Marketing",
    component: <PMHitRateReport role="pm" />,
  },
  {
    key: "pm-analysis-source",
    // AI WARNING: PMSourceAnalysisReport is shared with
    // /design-reports/project-type-analysis (role="designer") and
    // /team-reports/project-type-analysis (role="designer" reportScope="team").
    // Edits to that component affect all linked pages.
    label: "PM來源分析",
    labelEn: "PM Analysis by Source",
    description: "按客戶來源分析PM表現",
    category: "銷售及市場營銷 Sales & Marketing",
    component: <PMSourceAnalysisReport role="pm" />,
  },
  {
    key: "sales-by-category",
    label: "按類別銷售分析",
    labelEn: "Sales by Category",
    description: "按客戶類型或產品類別分類",
    category: "銷售及市場營銷 Sales & Marketing",
    component: <SalesByCategoryReport />,
  },
  {
    key: "bv-performance",
    label: "BV 業績",
    labelEn: "BV Performance",
    description: "按項目經理匯總銷售表現，並依個人扣減比例調整",
    category: "銷售及市場營銷 Sales & Marketing",
    component: <BVPerformanceReport />,
  },
  // PM財務管理表現 PM Management on Financial
  {
    key: "personal-performance",
    // AI WARNING: shared with /team-reports/personal-performance (reportScope="team").
    label: "個人BV表現",
    labelEn: "Personal BV Performance",
    description: "選擇員工查看其項目 BV 分配明細",
    category: "PM財務管理表現 PM Management on Financial",
    component: <PersonalPerformanceReport />,
  },
  {
    key: "discounted-project",
    label: "折扣項目",
    labelEn: "Discounted Project",
    description: "在Invoice出現負數扣減的項目",
    category: "PM財務管理表現 PM Management on Financial",
    component: <DiscountedProjectReport />,
  },
  {
    key: "ao-project",
    label: "A.O. 項目",
    labelEn: "A.O. Project",
    description: "新增了A.O.項目的工程",
    category: "PM財務管理表現 PM Management on Financial",
    component: <AOProjectReport />,
  },
  {
    key: "overdue-receivable",
    // AI WARNING: shared with /team-reports/overdue-receivable (reportScope="team").
    label: "逾期應收項目",
    labelEn: "Overdue Receivable",
    description: "出現逾期應收款的項目",
    category: "PM財務管理表現 PM Management on Financial",
    component: <OverdueReceivableReport />,
  },
  {
    key: "outstanding-project",
    // AI WARNING: shared with /team-reports/outstanding-project (reportScope="team").
    label: "未收款項目",
    labelEn: "Outstanding Project",
    description: "尚未收取全額款項的項目",
    category: "PM財務管理表現 PM Management on Financial",
    component: <OutstandingProjectReport />,
  },
  {
    key: "bad-debt-project",
    // AI WARNING: shared with /team-reports/bad-debt-project (reportScope="team").
    label: "壞帳項目",
    labelEn: "Bad Debt Project",
    description: "已記錄為壞帳的項目",
    category: "PM財務管理表現 PM Management on Financial",
    component: <BadDebtProjectReport />,
  },
];

export const DEFAULT_REPORT_KEY = REPORTS[0].key;

export function getReport(key: string): ReportDef | undefined {
  return REPORTS.find((r) => r.key === key);
}
