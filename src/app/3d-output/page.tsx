"use client";

import React, { useState } from "react";
import TopNav from "@/components/dashboard/TopNav";
import { ReportDateRangeProvider } from "@/components/reports/ReportDateRangeContext";
import ThreeDOutputReport from "@/components/reports/ThreeDOutputReport";

/** 主選單 doorway — same report as /design-reports/3d-output. */
export default function ThreeDOutputAliasPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-bw-bg">
      <TopNav
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        className={`pt-[52px] transition-all duration-300 overflow-hidden ${
          sidebarCollapsed ? "lg:ml-[56px]" : "lg:ml-[200px]"
        }`}
      >
        <main className="p-8 max-w-full overflow-hidden">
          <ReportDateRangeProvider>
            <ThreeDOutputReport />
          </ReportDateRangeProvider>
        </main>
      </div>
    </div>
  );
}
