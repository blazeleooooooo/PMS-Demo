"use client";

import { useEffect, useMemo, useState } from "react";

export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  isOffDay: boolean;
}

export interface HolidayInfo {
  /** Hong Kong public holiday on this date, if any. */
  hk?: Holiday;
  /** Mainland China holiday / makeup-workday on this date, if any. */
  cn?: Holiday;
}

interface HolidaysResponse {
  hk: Holiday[];
  cn: Holiday[];
}

// Simple in-memory cache keyed by the requested year set so navigating
// between weeks doesn't refetch the same data repeatedly.
const cache = new Map<string, HolidaysResponse>();

/**
 * Fetches Hong Kong and Mainland China public holidays for the given years
 * via the /api/holidays proxy and returns a date → holiday lookup map.
 */
export function useHolidays(years: number[]) {
  const yearKey = useMemo(
    () => [...new Set(years)].sort().join(","),
    [years]
  );

  const [data, setData] = useState<HolidaysResponse | null>(
    () => cache.get(yearKey) ?? null
  );
  const [loading, setLoading] = useState(!cache.has(yearKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!yearKey) return;

    const cached = cache.get(yearKey);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/holidays?years=${yearKey}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Holiday request failed (${res.status})`);
        return res.json();
      })
      .then((json: HolidaysResponse) => {
        if (cancelled) return;
        cache.set(yearKey, json);
        setData(json);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[useHolidays]", err);
        setError(err?.message || "Failed to load holidays");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [yearKey]);

  // Build a date → { hk, cn } lookup map.
  const holidayMap = useMemo(() => {
    const map = new Map<string, HolidayInfo>();
    if (!data) return map;

    for (const h of data.hk) {
      const entry = map.get(h.date) ?? {};
      entry.hk = h;
      map.set(h.date, entry);
    }
    for (const h of data.cn) {
      const entry = map.get(h.date) ?? {};
      entry.cn = h;
      map.set(h.date, entry);
    }
    return map;
  }, [data]);

  return { holidayMap, loading, error };
}
