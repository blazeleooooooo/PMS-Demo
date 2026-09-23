"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_cr_delivery_methods")!;

export default function CrDeliveryMethodsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
