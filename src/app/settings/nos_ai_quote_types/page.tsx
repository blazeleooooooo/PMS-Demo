"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_ai_quote_types")!;

export default function AiQuoteTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
