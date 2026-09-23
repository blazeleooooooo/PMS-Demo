"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_tender_reject_presets")!;

export default function TenderRejectPresetsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
