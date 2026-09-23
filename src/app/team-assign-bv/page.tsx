"use client";

import React, { useState } from "react";
import TopNav from "@/components/dashboard/TopNav";
import AssignBVManagement from "@/components/admin/AssignBVManagement";
import StaffBVDeductionManagement from "@/components/admin/StaffBVDeductionManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Team-tools clone of /assign-bv — same UI, separate permission module. */
export default function TeamAssignBVPage() {
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
          <Tabs defaultValue="assign" className="space-y-6">
            <TabsList>
              <TabsTrigger value="assign">項目 BV 分配</TabsTrigger>
              <TabsTrigger value="deduction">個人扣減</TabsTrigger>
            </TabsList>
            <TabsContent value="assign" className="mt-0">
              <AssignBVManagement permissionModule="team-assign-bv" />
            </TabsContent>
            <TabsContent value="deduction" className="mt-0">
              <StaffBVDeductionManagement permissionModule="team-assign-bv" />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
