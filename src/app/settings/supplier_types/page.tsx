"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("supplier_types")!;

export default function SupplierTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
