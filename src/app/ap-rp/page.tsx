"use client";

import React, { useState } from "react";
import TopNav from "@/components/dashboard/TopNav";
import ARAPManagement from "@/components/accounting/ARAPManagement";
import { ReportDateRangeProvider } from "@/components/reports/ReportDateRangeContext";

export default function APRPPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-bw-bg">
      <TopNav
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        className={`pt-[52px] transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-[56px]" : "lg:ml-[200px]"
        }`}
      >
        <main className="p-8">
          <ReportDateRangeProvider>
            <ARAPManagement />
          </ReportDateRangeProvider>
        </main>
      </div>
    </div>
  );
}
