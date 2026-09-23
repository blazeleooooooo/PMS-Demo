"use client";

// Reference example for the config-driven lookup-table settings.
// To add a new table: copy this file to src/app/settings/<table>/page.tsx,
// swap the getLookupConfig("<table>") key, add the table's config entry in
// src/lib/lookup-tables-config.ts, and add a nav line in src/lib/mock-data.ts.
import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("districts")!;

export default function DistrictsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
