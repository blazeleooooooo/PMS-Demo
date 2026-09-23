"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("term_template_types")!;

export default function TermTemplateTypesSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
