"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import TopNav from "@/components/dashboard/TopNav";
import CustomerDetail from "@/components/clients/CustomerDetail";

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;
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
          <CustomerDetail customerId={customerId} />
        </main>
      </div>
    </div>
  );
}
