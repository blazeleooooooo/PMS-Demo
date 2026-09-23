"use client";

import LookupSettingsPage from "@/components/settings/LookupSettingsPage";
import { getLookupConfig } from "@/lib/lookup-tables-config";

const config = getLookupConfig("nos_payment_methods")!;

export default function PaymentMethodsSettingsPage() {
  return <LookupSettingsPage config={config} />;
}
