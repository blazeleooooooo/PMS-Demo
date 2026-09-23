"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("team_types")!;

export default function TeamTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
