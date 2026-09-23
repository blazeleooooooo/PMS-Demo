"use client";

import { Suspense } from "react";
import TaskReportingSettings from "@/components/settings/TaskReportingSettings";
import SettingsPageShell from "@/components/settings/SettingsPageShell";

export default function TaskReportingSettingsPage() {
  return (
    <SettingsPageShell>
      <Suspense fallback={null}>
        <TaskReportingSettings />
      </Suspense>
    </SettingsPageShell>
  );
}
