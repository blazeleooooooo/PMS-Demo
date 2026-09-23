"use client";

import React from "react";
import LookupTableSettings from "@/components/settings/LookupTableSettings";
import SettingsPageShell from "@/components/settings/SettingsPageShell";
import { type LookupTableConfig } from "@/lib/lookup-tables-config";

// Shared page shell for every lookup-table settings screen. A per-table page
// is then just:
//   export default function Page() { return <LookupSettingsPage config={CFG} />; }
// where CFG = getLookupConfig("<table>")! from the registry.
export default function LookupSettingsPage({
  config,
  settingsComponent: SettingsComponent = LookupTableSettings,
}: {
  config: LookupTableConfig;
  settingsComponent?: React.ComponentType<{
    config: LookupTableConfig;
  }>;
}) {
  return (
    <SettingsPageShell>
      <SettingsComponent config={config} />
    </SettingsPageShell>
  );
}
