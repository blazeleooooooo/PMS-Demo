"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_cr_event_types")!;

export default function CrEventTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
