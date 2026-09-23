"use client";

import SiteStatusQuestionnaireSettings from "@/components/settings/SiteStatusQuestionnaireSettings";
import SettingsPageShell from "@/components/settings/SettingsPageShell";

export default function SiteStatusQuestionnaireSettingsPage() {
  return (
    <SettingsPageShell>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <SiteStatusQuestionnaireSettings />
      </div>
    </SettingsPageShell>
  );
}
