"use client";

// ─── SHARED REPORT DATE-RANGE BAR ─────────────────────────────
// The single pill bar used by every report on /business-reports. Renders the
// canonical presets plus a "Custom" option that reveals two date inputs, all
// driven by the shared ReportDateRangeContext so the selection (including a
// custom window) stays synced as the user moves between reports.

import React, { useState, useEffect } from "react";
import { CalendarRange } from "lucide-react";
import { RANGE_PRESETS } from "@/lib/report-date-range";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";

// ─── BWA / BWF SOURCE TOGGLE ──────────────────────────────────
// Two pills deciding which business line's data feeds the report.
// Default single-select (exactly one of BWA / BWF). Exported standalone for
// reports that don't render the date bar (e.g. Sales Trend).
export type ReportSourceMode = "multi" | "single";

export function ReportSourceToggle({ mode = "single" }: { mode?: ReportSourceMode }) {
  const { sources, toggleSource, selectSource } = useReportRange();
  const singleSource = mode === "single";

  const onPillClick = (key: "bwa" | "bwf") => {
    if (singleSource) {
      selectSource(key);
      return;
    }
    toggleSource(key);
  };

  const pill = (key: "bwa" | "bwf", label: string, active: boolean) => (
    <button
      onClick={() => onPillClick(key)}
      className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
        active
          ? "bg-bw-blue/10 text-bw-blue"
          : singleSource
            ? "text-gray-600 hover:bg-gray-50"
            : "text-gray-400 hover:bg-gray-50 line-through decoration-gray-300"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm">
      <span className="text-xs text-gray-400 px-1.5 whitespace-nowrap">數據來源</span>
      {pill("bwa", "BWA", sources.bwa)}
      {pill("bwf", "BWF", sources.bwf)}
    </div>
  );
}

export default function ReportDateRangeBar({
  showSourceToggle = true,
  sourceMode = "single",
}: {
  // Hide the BWA/BWF toggle on reports where it has no meaning (e.g. PMS Login).
  showSourceToggle?: boolean;
  // "single" = BWA or BWF only (radio-style; default). "multi" allows both.
  sourceMode?: ReportSourceMode;
}) {
  const { range, custom, setRange } = useReportRange();

  // Local mirror of the custom inputs so typing one field doesn't immediately
  // re-resolve with a half-filled range. Applied on change once both are set.
  const [from, setFrom] = useState(custom.from ?? "");
  const [to, setTo] = useState(custom.to ?? "");

  // Keep local inputs in sync if another report changed the shared custom range.
  useEffect(() => {
    setFrom(custom.from ?? "");
    setTo(custom.to ?? "");
  }, [custom.from, custom.to]);

  const isCustom = range === "custom";

  const applyCustom = (nextFrom: string, nextTo: string) => {
    // Only push to shared state once both ends are present, so partial input
    // doesn't blank the report.
    if (nextFrom && nextTo) {
      setRange("custom", { from: nextFrom, to: nextTo });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-wrap gap-1 bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm flex-1 min-w-[280px]">
        {RANGE_PRESETS.map((preset) => {
          const active = preset.key === range;
          return (
            <button
              key={preset.key}
              onClick={() => setRange(preset.key)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                active
                  ? "bg-bw-blue/10 text-bw-blue font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {preset.label}
            </button>
          );
        })}

        {/* Custom range toggle pill */}
        <button
          onClick={() => {
            // Seed with today→today if no dates picked yet.
            if (from && to) {
              setRange("custom", { from, to });
            } else {
              setRange("custom", { from: from || "", to: to || "" });
            }
          }}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
            isCustom
              ? "bg-bw-blue/10 text-bw-blue font-medium"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <CalendarRange className="w-3.5 h-3.5" />
          自訂 Custom
        </button>
        </div>

        {/* BWA / BWF data-source toggle */}
        {showSourceToggle && <ReportSourceToggle mode={sourceMode} />}
      </div>

      {/* Custom date inputs — only shown when the Custom pill is active */}
      {isCustom && (
        <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-lg p-2.5 shadow-sm">
          <span className="text-xs text-gray-500 ml-1">由 From</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              applyCustom(e.target.value, to);
            }}
            className="h-8 rounded-md border border-gray-200 px-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
          />
          <span className="text-xs text-gray-500">至 To</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              applyCustom(from, e.target.value);
            }}
            className="h-8 rounded-md border border-gray-200 px-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
          />
          {(!from || !to) && (
            <span className="text-xs text-amber-600 ml-1">請選擇開始及結束日期</span>
          )}
        </div>
      )}
    </div>
  );
}
