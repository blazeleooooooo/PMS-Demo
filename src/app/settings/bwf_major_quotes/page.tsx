"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("bwf_major_quotes")!;

export default function BwfMajorQuotesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
