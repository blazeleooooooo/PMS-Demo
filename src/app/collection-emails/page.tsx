"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import CollectionEmailsManagement from "@/components/accounting/CollectionEmailsManagement";
import { ReportDateRangeProvider } from "@/components/reports/ReportDateRangeContext";

export default function CollectionEmailsPage() {
  return (
    <AppShell contentClassName="overflow-hidden" mainClassName="max-w-full overflow-hidden">
      <ReportDateRangeProvider>
        <CollectionEmailsManagement />
      </ReportDateRangeProvider>
    </AppShell>
  );
}
