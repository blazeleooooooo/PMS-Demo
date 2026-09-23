"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("product_types")!;

export default function ProductTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
