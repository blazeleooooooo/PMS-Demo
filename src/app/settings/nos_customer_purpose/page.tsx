"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_customer_purpose")!;

export default function CustomerPurposeSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
