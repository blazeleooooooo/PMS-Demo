"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_customer_tags")!;

export default function CustomerTagsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
