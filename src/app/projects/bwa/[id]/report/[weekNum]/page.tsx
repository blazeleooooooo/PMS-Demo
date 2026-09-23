"use client";

import React, { useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import TopNav from "@/components/dashboard/TopNav";
import WeeklyReportEditor from "@/components/projects/WeeklyReportEditor";
import { Loader2 } from "lucide-react";

function WeeklyReportContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const weekNum = parseInt(params.weekNum as string, 10);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Read params from URL search params
  const reportId = searchParams.get("reportId") || null;
  const weekStartStr = searchParams.get("weekStart") || "";
  const weekEndStr = searchParams.get("weekEnd") || "";
  const projectName = searchParams.get("projectName") || undefined;
  const projectCode = searchParams.get("projectCode") || undefined;
  const pmName = searchParams.get("pmName") || undefined;
  const designerName = searchParams.get("designerName") || undefined;
  const costCentreId = searchParams.get("costCentreId") || null;

  const weekStart = weekStartStr ? new Date(weekStartStr) : new Date();
  const weekEnd = weekEndStr ? new Date(weekEndStr) : new Date();

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
          <WeeklyReportEditor
            reportId={reportId}
            projectId={projectId}
            weekNumber={weekNum}
            weekStart={weekStart}
            weekEnd={weekEnd}
            projectName={projectName}
            projectCode={projectCode}
            pmName={pmName}
            designerName={designerName}
            costCentreId={costCentreId}
            onClose={() => {
              window.history.back();
            }}
            onSaved={() => {
              // Stay on the page after save
            }}
          />
        </main>
      </div>
    </div>
  );
}

export default function WeeklyReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bw-bg flex items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">載入10日報告編輯器...</span>
          </div>
        </div>
      }
    >
      <WeeklyReportContent />
    </Suspense>
  );
}
