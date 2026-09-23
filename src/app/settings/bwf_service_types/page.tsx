"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_service_type_2")!;

export default function BwfServiceTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
