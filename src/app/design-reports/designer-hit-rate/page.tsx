"use client";

// AI WARNING — SHARED HIT-RATE UI
// This page reuses <PMHitRateReport role="designer" /> from
// src/components/reports/PMHitRateReport.tsx (also used by
// /business-reports/pm-hit-rate with role="pm").
// Do NOT copy-paste a separate DesignerHitRateReport — changes to the shared
// component apply to BOTH the PM and Designer hit-rate pages.

import React, { useState } from "react";
import TopNav from "@/components/dashboard/TopNav";
import PMHitRateReport from "@/components/reports/PMHitRateReport";

export default function DesignerHitRatePage() {
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
          <PMHitRateReport role="designer" reportScope="design" />
        </main>
      </div>
    </div>
  );
}
