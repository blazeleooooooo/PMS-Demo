"use client";

import React, { useState } from "react";
import TopNav from "@/components/dashboard/TopNav";
import DesignerLoadBoard from "@/components/design/DesignerLoadBoard";

export default function DesignerLoadPage() {
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
          <DesignerLoadBoard />
        </main>
      </div>
    </div>
  );
}
