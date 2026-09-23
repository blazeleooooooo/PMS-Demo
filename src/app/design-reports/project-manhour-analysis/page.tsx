"use client";

// AI WARNING — SHARED MANHOUR ANALYSIS UI
// Reuses <ProjectManhourAnalysisBoard /> (also /team-reports/project-manhour-analysis
// with reportScope="team"). Edits to that component apply to BOTH pages.

import React, { useState } from "react";
import TopNav from "@/components/dashboard/TopNav";
import ProjectManhourAnalysisBoard from "@/components/reports/ProjectManhourAnalysisBoard";

export default function ProjectManhourAnalysisPage() {
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
          <ProjectManhourAnalysisBoard reportScope="design" />
        </main>
      </div>
    </div>
  );
}
