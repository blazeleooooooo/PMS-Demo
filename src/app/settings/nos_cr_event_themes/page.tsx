"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_cr_event_themes")!;

export default function CrEventThemesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
