"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import TopNav from "@/components/dashboard/TopNav";
import TestingManHourDateDetail from "@/components/reports/TestingManHourDateDetail";

/** Testing-phase day detail with design / 3D work-kind form. */
export default function TestingManHourDateDetailPage() {
  const params = useParams();
  const dateId = params.id as string;
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
          <TestingManHourDateDetail dateId={dateId} />
        </main>
      </div>
    </div>
  );
}
