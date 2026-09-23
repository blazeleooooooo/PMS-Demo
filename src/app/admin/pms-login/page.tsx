"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import { ReportDateRangeProvider } from "@/components/reports/ReportDateRangeContext";
import PMSLoginReport from "@/components/reports/PMSLoginReport";

export default function AdminPmsLoginPage() {
  return (
    <AppShell contentClassName="overflow-hidden" mainClassName="max-w-full overflow-hidden">
      <ReportDateRangeProvider>
        <PMSLoginReport />
      </ReportDateRangeProvider>
    </AppShell>
  );
}
