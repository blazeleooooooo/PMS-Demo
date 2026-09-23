"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchProjectFilterExtras } from "@/lib/data/project-filter-extras";
import {
  mergeProjectFilterExtra,
  resolveProjectFilterId,
  type ProjectCollectionSiteFields,
  type ProjectFilterExtra,
} from "@/lib/project-collection-site-filter";

const EMPTY_EXTRAS = new Map<string, ProjectFilterExtra>();

export function projectFilterNeedsExtras(filter: {
  collectionStatus?: string;
  siteStatus?: string;
}): boolean {
  return (
    (filter.collectionStatus ?? "all") !== "all" ||
    (filter.siteStatus ?? "all") !== "all"
  );
}

export function useProjectFilterExtras(
  rows: Array<{ id: string; filter_project_id?: string | null }>,
  enabled = true,
): Map<string, ProjectFilterExtra> {
  const ids = useMemo(() => {
    if (!enabled) return [] as string[];
    const set = new Set<string>();
    for (const row of rows) {
      const id = resolveProjectFilterId(row);
      if (id) set.add(id);
    }
    return Array.from(set).sort();
  }, [rows, enabled]);

  const idsKey = ids.join(",");
  const [map, setMap] = useState<Map<string, ProjectFilterExtra>>(EMPTY_EXTRAS);

  useEffect(() => {
    if (!enabled || ids.length === 0) {
      if (!enabled) setMap(EMPTY_EXTRAS);
      return;
    }
    let cancelled = false;
    fetchProjectFilterExtras(ids).then((next) => {
      if (!cancelled) setMap(next);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, idsKey]);

  return map;
}

export function useEnrichedProjectFilterRows<T extends ProjectCollectionSiteFields & { id: string }>(
  rows: T[],
  enabled = true,
): T[] {
  const extras = useProjectFilterExtras(rows, enabled);
  return useMemo(
    () =>
      rows.map((row) => {
        const pid = resolveProjectFilterId(row);
        return mergeProjectFilterExtra(row, pid ? extras.get(pid) : undefined);
      }),
    [rows, extras],
  );
}
