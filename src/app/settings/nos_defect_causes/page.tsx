"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_defect_causes")!;

export default function DefectCausesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
