"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import ProjectScheduleTasksSettings from "@/components/settings/ProjectScheduleTasksSettings";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("project_schedule_tasks")!;

export default function ProjectScheduleTasksSettingsPage() {
  return (
    <LookupSettingsPage
      config={config}
      settingsComponent={ProjectScheduleTasksSettings}
    />
  );
}
