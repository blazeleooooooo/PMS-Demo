"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("service_types")!;

export default function ServiceTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
