"use client";

import React, { useState } from "react";
import TopNav from "@/components/dashboard/TopNav";
import ExpenseControlWaiverQueue from "@/components/team/ExpenseControlWaiverQueue";
import { INSTALLMENT_WAIVER_PERMISSION_MODULE } from "@/lib/expense-control-waiver-service";

export default function ExpenseInstallmentWaiversPage() {
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
          <ExpenseControlWaiverQueue
            variant="installment"
            permissionModule={INSTALLMENT_WAIVER_PERMISSION_MODULE}
            title="支出總額豁免"
            description="審核「支出總額不大於收入總額」的豁免申請。批准後，該檢查項目不再封鎖出支票。審核權限可於權限管理調整。"
          />
        </main>
      </div>
    </div>
  );
}
