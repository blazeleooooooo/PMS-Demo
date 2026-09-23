"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("income_expiry_reasons")!;

export default function IncomeExpiryReasonsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
