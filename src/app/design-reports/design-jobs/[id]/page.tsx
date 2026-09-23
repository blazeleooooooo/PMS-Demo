"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import TopNav from "@/components/dashboard/TopNav";
import DesignJobDetail from "@/components/reports/DesignJobDetail";

export default function DesignJobDetailPage() {
  const params = useParams();
  const jobId = typeof params?.id === "string" ? params.id : "";
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
          {jobId ? <DesignJobDetail jobId={jobId} /> : null}
        </main>
      </div>
    </div>
  );
}
