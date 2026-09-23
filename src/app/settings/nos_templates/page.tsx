"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_templates")!;

export default function TemplatesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
