"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("client_types")!;

export default function ClientTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
