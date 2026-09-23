"use client";

import { useCallback, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";

function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function rangeKey(range: DateRange | undefined): string {
  if (!range?.from) return "";
  const from = toDayKey(range.from);
  const to = range.to ? toDayKey(range.to) : from;
  return `${from}|${to}`;
}

export function normalizeRange(
  range: DateRange | undefined
): DateRange | undefined {
  if (!range?.from) return undefined;
  return { from: range.from, to: range.to ?? range.from };
}

/** Calendar day at local midnight. */
function atLocalMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Sunday (weekStartsOn=0) for the week containing `date`. */
export function startOfWeekSunday(date: Date): Date {
  const d = atLocalMidnight(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Saturday for the week containing `date`. */
export function endOfWeekSaturday(date: Date): Date {
  const start = startOfWeekSunday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

/** Snap a day range to full Sun–Sat weeks covering both ends. */
export function snapRangeToWeeks(
  range: DateRange | undefined
): DateRange | undefined {
  if (!range?.from) return undefined;
  const from = startOfWeekSunday(range.from);
  const to = endOfWeekSaturday(range.to ?? range.from);
  return { from, to };
}

/** Previous calendar week (Sun) through this week (Sat). */
export function defaultThisAndPrevWeek(): DateRange {
  const thisWeekStart = startOfWeekSunday(new Date());
  const prevWeekStart = new Date(thisWeekStart);
  prevWeekStart.setDate(thisWeekStart.getDate() - 7);
  return {
    from: prevWeekStart,
    to: endOfWeekSaturday(thisWeekStart),
  };
}

/** @deprecated Prefer defaultThisAndPrevWeek for /reports. */
export function defaultPast14Days(): DateRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 13);
  return { from, to };
}

type Options = {
  /**
   * When true, `applyRange(undefined)` is allowed (e.g. /reports Mon–Fri week mode).
   * When false, undefined is ignored and applied always keeps a concrete range.
   */
  allowUndefinedApplied?: boolean;
  /**
   * When "week", day clicks snap to Sun–Sat weeks.
   * First click selects one week; second click extends to a multi-week range.
   */
  snapUnit?: "day" | "week";
};

/**
 * Deferred date-range picker state:
 * - First calendar click always starts a fresh `from` (no extend of prior range)
 * - Second click sets `to`, applies, and closes
 * - Outside close / Escape applies draft if it differs from applied
 * - Optional week snap: selection is always full Sun–Sat weeks
 */
export function useDeferredDateRange(
  initial: DateRange | undefined,
  options: Options = {}
) {
  const { allowUndefinedApplied = false, snapUnit = "day" } = options;

  const seeded =
    snapUnit === "week" ? snapRangeToWeeks(initial) ?? initial : initial;

  const [appliedRange, setAppliedRange] = useState<DateRange | undefined>(
    seeded
  );
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(seeded);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeClickCount, setRangeClickCount] = useState(0);
  const rangeAnchorRef = useRef<Date | null>(null);

  const applyRange = useCallback(
    (range: DateRange | undefined, close = false) => {
      if (range === undefined) {
        if (!allowUndefinedApplied) return;
        setAppliedRange(undefined);
        setDraftRange(undefined);
      } else {
        const next =
          snapUnit === "week"
            ? snapRangeToWeeks(range)
            : normalizeRange(range);
        if (!next?.from) return;
        if (rangeKey(next) !== rangeKey(appliedRange)) {
          setAppliedRange(next);
        }
        setDraftRange(next);
      }
      if (close) {
        setRangeClickCount(0);
        rangeAnchorRef.current = null;
        setRangeOpen(false);
      }
    },
    [allowUndefinedApplied, appliedRange, snapUnit]
  );

  const handleRangeOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setDraftRange(appliedRange);
        setRangeClickCount(0);
        rangeAnchorRef.current = null;
        setRangeOpen(true);
        return;
      }
      if (rangeKey(draftRange) !== rangeKey(appliedRange)) {
        applyRange(draftRange, false);
      } else {
        setDraftRange(appliedRange);
      }
      setRangeClickCount(0);
      rangeAnchorRef.current = null;
      setRangeOpen(false);
    },
    [appliedRange, applyRange, draftRange]
  );

  const handleCalendarDaySelect = useCallback(
    (_range: DateRange | undefined, selectedDay: Date) => {
      const nextCount = rangeClickCount + 1;
      setRangeClickCount(nextCount);

      if (snapUnit === "week") {
        const weekStart = startOfWeekSunday(selectedDay);
        const weekEnd = endOfWeekSaturday(selectedDay);

        if (nextCount === 1) {
          rangeAnchorRef.current = weekStart;
          setDraftRange({ from: weekStart, to: weekEnd });
          return;
        }

        const anchor = rangeAnchorRef.current ?? weekStart;
        const from =
          anchor.getTime() <= weekStart.getTime() ? anchor : weekStart;
        const to =
          anchor.getTime() <= weekStart.getTime()
            ? weekEnd
            : endOfWeekSaturday(anchor);
        rangeAnchorRef.current = null;
        applyRange({ from, to }, true);
        return;
      }

      if (nextCount === 1) {
        rangeAnchorRef.current = selectedDay;
        setDraftRange({ from: selectedDay, to: undefined });
        return;
      }

      const start = rangeAnchorRef.current ?? selectedDay;
      const from =
        start.getTime() <= selectedDay.getTime() ? start : selectedDay;
      const to =
        start.getTime() <= selectedDay.getTime() ? selectedDay : start;
      rangeAnchorRef.current = null;
      applyRange({ from, to }, true);
    },
    [applyRange, rangeClickCount, snapUnit]
  );

  return {
    appliedRange,
    setAppliedRange,
    draftRange,
    setDraftRange,
    rangeOpen,
    applyRange,
    handleRangeOpenChange,
    handleCalendarDaySelect,
  };
}
