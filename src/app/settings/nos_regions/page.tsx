"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_regions")!;

export default function RegionsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
