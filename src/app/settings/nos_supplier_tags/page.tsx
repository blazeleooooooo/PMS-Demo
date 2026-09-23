"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_supplier_tags")!;

export default function SupplierTagsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
