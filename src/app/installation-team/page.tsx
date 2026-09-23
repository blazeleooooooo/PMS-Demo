"use client";

import React, { useState, Suspense } from "react";
import TopNav from "@/components/dashboard/TopNav";
import InstallationTeamManagement from "@/components/installation/InstallationTeamManagement";

function InstallationTeamContent() {
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
          <InstallationTeamManagement />
        </main>
      </div>
    </div>
  );
}

export default function InstallationTeamPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bw-bg" />}>
      <InstallationTeamContent />
    </Suspense>
  );
}
