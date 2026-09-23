"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_sections")!;

export default function SectionsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
