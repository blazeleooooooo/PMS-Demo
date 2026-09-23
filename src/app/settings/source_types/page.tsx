"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("source_types")!;

export default function SourceTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
