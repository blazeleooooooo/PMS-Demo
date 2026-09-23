"use client";

import React, { useState } from "react";
import TopNav from "@/components/dashboard/TopNav";
import DesignerDailyFeed from "@/components/reports/DesignerDailyFeed";

/** Testing-phase designer daily feed for boss review. */
export default function TestingDesignerDailyFeedPage() {
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
          <DesignerDailyFeed />
        </main>
      </div>
    </div>
  );
}
