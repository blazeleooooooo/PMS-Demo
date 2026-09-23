"use client";

// ─── SHARED REPORT DATE-RANGE STATE ───────────────────────────
// A single date-range selection shared by every report on
// /business-reports. Each report's pill bar reads and writes this one
// value, so changing the range in any report carries over when the user
// navigates to another report — letting them browse every report through
// the same time window.

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { RANGE_PRESETS, type RangeKey, type CustomRange } from "@/lib/report-date-range";

// ─── BWA / BWF DATA SOURCE FILTER ─────────────────────────────
// Every business report can carry rows from BWA or BWF.
// Shared toggle is single-select (exactly one source) — default BWA.
// Stored alongside the date range so the choice also persists as the user
// browses between reports (React context + sessionStorage).
// Impersonation does NOT rewrite this store — a developer's BWF toggle will
// still be BWF while "viewing as" a staff member whose own browser is on BWA.
// /team-reports and /individual-reports sync the source to the staff team's
// is_bwf flag (see useTeamReportSourceSync).
export type ReportSource = "BWA" | "BWF";
export interface ReportSourceState {
  bwa: boolean;
  bwf: boolean;
}
export const DEFAULT_REPORT_SOURCES: ReportSourceState = { bwa: true, bwf: false };

/** Coerce legacy "both on" stored filters to a single source (prefer BWA). */
export function normalizeReportSources(s: ReportSourceState): ReportSourceState {
  if (s.bwa && s.bwf) return { bwa: true, bwf: false };
  if (!s.bwa && !s.bwf) return { ...DEFAULT_REPORT_SOURCES };
  return { bwa: !!s.bwa, bwf: !!s.bwf };
}

// Predicate + list helper used by report components to apply the toggle.
export function sourceEnabled(source: ReportSource, s: ReportSourceState): boolean {
  return source === "BWF" ? s.bwf : s.bwa;
}
export function filterBySources<T extends { source: ReportSource }>(
  rows: T[],
  s: ReportSourceState,
): T[] {
  if (s.bwa && s.bwf) return rows;
  return rows.filter((r) => sourceEnabled(r.source, s));
}

interface ReportDateRangeValue {
  range: RangeKey;
  // The user-picked window (used only when range === "custom").
  custom: CustomRange;
  // Set the active preset. Pass custom dates when key === "custom".
  setRange: (key: RangeKey, custom?: CustomRange) => void;
  // Which data sources (BWA / BWF) the reports should include.
  sources: ReportSourceState;
  // Toggle one source (multi mode only). Ignored when it would turn the last off.
  toggleSource: (key: keyof ReportSourceState) => void;
  // Pick exactly one source (BWA or BWF) — default for business-report toggles.
  selectSource: (key: keyof ReportSourceState) => void;
}

const ReportDateRangeContext = createContext<ReportDateRangeValue | null>(null);

const DEFAULT_RANGE: RangeKey = "thisYear";
const EMPTY_CUSTOM: CustomRange = { from: null, to: null };
const STORAGE_KEY = "pms3:business-report-filters";

const VALID_RANGE_KEYS = new Set<RangeKey>([
  ...RANGE_PRESETS.map((p) => p.key),
  "custom",
]);

interface StoredReportFilters {
  range: RangeKey;
  custom: CustomRange;
  sources: ReportSourceState;
}

function readStoredFilters(): StoredReportFilters | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredReportFilters;
    if (!VALID_RANGE_KEYS.has(parsed.range)) return null;
    const sources = parsed.sources;
    if (!sources || (!sources.bwa && !sources.bwf)) return null;
    return {
      range: parsed.range,
      custom: {
        from: parsed.custom?.from ?? null,
        to: parsed.custom?.to ?? null,
      },
      sources: normalizeReportSources({ bwa: !!sources.bwa, bwf: !!sources.bwf }),
    };
  } catch {
    return null;
  }
}

function writeStoredFilters(state: StoredReportFilters): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / private-mode errors.
  }
}

// Shared state hook — used by both the provider and the standalone fallback so
// the two stay behaviourally identical.
function useRangeState(): ReportDateRangeValue {
  const [range, setRangeKey] = useState<RangeKey>(
    () => readStoredFilters()?.range ?? DEFAULT_RANGE,
  );
  const [custom, setCustom] = useState<CustomRange>(
    () => readStoredFilters()?.custom ?? EMPTY_CUSTOM,
  );
  const [sources, setSources] = useState<ReportSourceState>(
    () => normalizeReportSources(readStoredFilters()?.sources ?? DEFAULT_REPORT_SOURCES),
  );

  useEffect(() => {
    writeStoredFilters({ range, custom, sources });
  }, [range, custom, sources]);

  const setRange = useCallback((key: RangeKey, nextCustom?: CustomRange) => {
    setRangeKey(key);
    if (key === "custom" && nextCustom) setCustom(nextCustom);
  }, []);

  const toggleSource = useCallback((key: keyof ReportSourceState) => {
    setSources((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Never allow both sources off — the reports would all go blank.
      if (!next.bwa && !next.bwf) return prev;
      return next;
    });
  }, []);

  const selectSource = useCallback((key: keyof ReportSourceState) => {
    setSources({ bwa: key === "bwa", bwf: key === "bwf" });
  }, []);

  return { range, custom, setRange, sources, toggleSource, selectSource };
}

export function ReportDateRangeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useRangeState();
  return (
    <ReportDateRangeContext.Provider value={value}>
      {children}
    </ReportDateRangeContext.Provider>
  );
}

// Consume the shared range. Falls back to private state if used outside a
// provider, so a report still works when rendered standalone (e.g. on a
// canvas) — it just won't be synced with siblings.
export function useReportRange(): ReportDateRangeValue {
  const ctx = useContext(ReportDateRangeContext);
  const local = useRangeState();
  return ctx ?? local;
}
