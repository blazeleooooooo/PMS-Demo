"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_doc_types")!;

export default function DocTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
