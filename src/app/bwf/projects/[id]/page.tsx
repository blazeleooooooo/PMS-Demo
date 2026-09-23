"use client";

import React, { useState, Suspense } from "react";
import { useParams } from "next/navigation";
import TopNav from "@/components/dashboard/TopNav";
import BWFProjectDetail from "@/components/projects/BWFProjectDetail";

function BWFProjectDetailContent() {
  const params = useParams();
  const projectId = params.id as string;
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
          <BWFProjectDetail projectId={projectId} />
        </main>
      </div>
    </div>
  );
}

export default function BWFProjectDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bw-bg" />}>
      <BWFProjectDetailContent />
    </Suspense>
  );
}
