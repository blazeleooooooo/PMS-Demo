"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_customer_tags_collection")!;

export default function CustomerTagCollectionsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
