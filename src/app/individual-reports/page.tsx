"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_INDIVIDUAL_REPORT_KEY } from "@/components/reports/individual-report-registry";

export default function IndividualReportsIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/individual-reports/${DEFAULT_INDIVIDUAL_REPORT_KEY}`);
  }, [router]);
  return null;
}
