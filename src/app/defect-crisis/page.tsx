"use client";

import React, { useState, Suspense } from "react";
import TopNav from "@/components/dashboard/TopNav";
import BWAProjectList from "@/components/projects/BWAProjectList";

function DefectCrisisContent() {
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
          <BWAProjectList variant="defect-crisis" />
        </main>
      </div>
    </div>
  );
}

export default function DefectCrisisPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bw-bg" />}>
      <DefectCrisisContent />
    </Suspense>
  );
}
