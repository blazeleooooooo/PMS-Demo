"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchStaffMembers,
  type StaffMember,
} from "@/lib/data-service";

function useSupabaseQuery<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err: unknown) {
      console.error("[useSupabaseQuery]", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useStaffMembers() {
  const fallback: StaffMember[] = [];
  return useSupabaseQuery(fetchStaffMembers, fallback);
}
