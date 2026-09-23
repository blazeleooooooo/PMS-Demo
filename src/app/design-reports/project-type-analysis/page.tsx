"use client";

// AI WARNING — SHARED SOURCE / TYPE ANALYSIS UI
// This page reuses <PMSourceAnalysisReport role="designer" /> from
// src/components/reports/PMSourceAnalysisReport.tsx (also used by
// /business-reports/pm-analysis-source with role="pm", and
// /team-reports/project-type-analysis with role="designer" reportScope="team").
// Do NOT copy-paste a separate ProjectTypeAnalysisReport — changes to the
// shared component apply to ALL linked pages.
// Designer defaults: StaffFilterBar position = "Designer"; attribution =
// main_designer_id via fetchPMSourceProjects/Pitches(role).

import React, { useState } from "react";
import TopNav from "@/components/dashboard/TopNav";
import PMSourceAnalysisReport from "@/components/reports/PMSourceAnalysisReport";

export default function ProjectTypeAnalysisPage() {
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
          <PMSourceAnalysisReport role="designer" reportScope="design" />
        </main>
      </div>
    </div>
  );
}
