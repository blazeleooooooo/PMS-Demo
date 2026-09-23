"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_TEAM_REPORT_KEY } from "@/components/reports/team-report-registry";

export default function TeamReportsIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/team-reports/${DEFAULT_TEAM_REPORT_KEY}`);
  }, [router]);
  return null;
}
