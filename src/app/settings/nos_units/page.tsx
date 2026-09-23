"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_units")!;

export default function UnitsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
