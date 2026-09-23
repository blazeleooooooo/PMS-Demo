"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("pitching_close_reasons")!;

export default function PitchingCloseReasonsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
