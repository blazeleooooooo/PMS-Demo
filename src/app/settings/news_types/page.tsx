"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("news_types")!;

export default function NewsTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
