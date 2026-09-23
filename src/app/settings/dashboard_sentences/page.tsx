"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("dashboard_sentences")!;

export default function DashboardSentencesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
