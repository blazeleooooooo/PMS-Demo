"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import { ReportDateRangeProvider } from "@/components/reports/ReportDateRangeContext";
import AnnualBonusSettlement from "@/components/admin/AnnualBonusSettlement";

export default function AdminAnnualBonusSettlementPage() {
  return (
    <AppShell contentClassName="overflow-hidden" mainClassName="max-w-full overflow-hidden">
      <ReportDateRangeProvider>
        <AnnualBonusSettlement />
      </ReportDateRangeProvider>
    </AppShell>
  );
}
