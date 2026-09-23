"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("financial_years")!;

export default function FinancialYearsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
