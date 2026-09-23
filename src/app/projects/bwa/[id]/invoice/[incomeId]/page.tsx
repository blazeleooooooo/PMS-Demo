"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import TopNav from "@/components/dashboard/TopNav";
import InvoiceEditor from "@/components/projects/InvoiceEditor";

export default function InvoicePage() {
  const params = useParams();
  const projectId = params.id as string;
  const incomeId = params.incomeId as string;
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
          <InvoiceEditor projectId={projectId} incomeId={incomeId} />
        </main>
      </div>
    </div>
  );
}
