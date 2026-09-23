"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_bv_values")!;

export default function BvValuesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
