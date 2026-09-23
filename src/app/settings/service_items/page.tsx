"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("service_items")!;

export default function ServiceItemsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
