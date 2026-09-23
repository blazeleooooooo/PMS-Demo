"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_quote_project_types")!;

export default function QuoteProjectTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
