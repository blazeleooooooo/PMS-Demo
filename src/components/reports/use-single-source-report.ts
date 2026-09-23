"use client";

import { useEffect } from "react";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";
import { useToast } from "@/components/ui/use-toast";

/** Reports that historically required single-source (now the global default).
 *  pm-analysis-source UI is also reused by /design-reports/project-type-analysis
 *  via <PMSourceAnalysisReport role="designer" /> (same useSingleSourceReport). */
export const SINGLE_SOURCE_REPORT_KEYS = new Set([
  "sales-by-category",
  "pm-analysis-source",
]);

/**
 * On mount, if the saved filter has both BWA and BWF selected, show a toast and
 * switch to BWA only. Pair with `sourceMode="single"` on ReportDateRangeBar
 * (single is now the default for all business reports).
 */
export function useSingleSourceReport(): void {
  const { sources, selectSource } = useReportRange();
  const { toast } = useToast();

  useEffect(() => {
    if (!sources.bwa || !sources.bwf) return;
    selectSource("bwa");
    toast({
      title: "只能選擇一個數據來源",
      description: "此報表只支援 BWA 或 BWF（不可同時選擇），已自動切換為 BWA。",
    });
    // Run once when the report mounts — saved filter may still have both enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
