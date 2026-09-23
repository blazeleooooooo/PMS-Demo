"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_contracts")!;

export default function ContractsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
