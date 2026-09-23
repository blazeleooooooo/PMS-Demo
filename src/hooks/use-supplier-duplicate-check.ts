"use client";

import { useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  checkSupplierPhoneDuplicate,
  type SupplierPhoneDuplicateResult,
} from "@/lib/data/suppliers";

export interface DuplicateMatch {
  id: string;
  display_name: string | null;
  phone: string | null;
  chinese_name: string | null;
  name: string | null;
  contact1_phone?: string | null;
  contact2_phone?: string | null;
}

export interface DuplicateCheckResult {
  exactMatches: DuplicateMatch[];
  similarMatches: DuplicateMatch[];
  isBlocked: boolean; // true if 100% match found → block submit
}

export type SupplierPhoneField = "phone" | "contact1_phone" | "contact2_phone";

interface UseDuplicateCheckOptions {
  /** The current supplier ID (in edit mode) — excluded from results */
  excludeId?: string;
}

const emptyResult: DuplicateCheckResult = {
  exactMatches: [],
  similarMatches: [],
  isBlocked: false,
};

function toPhoneDuplicateResult(
  result: SupplierPhoneDuplicateResult
): DuplicateCheckResult {
  return {
    exactMatches: result.exactMatches.map((m) => ({
      id: m.id,
      display_name: m.display_name,
      phone: m.phone || m.contact1_phone || m.contact2_phone,
      chinese_name: m.chinese_name,
      name: m.name,
      contact1_phone: m.contact1_phone,
      contact2_phone: m.contact2_phone,
    })),
    similarMatches: result.similarMatches.map((m) => ({
      id: m.id,
      display_name: m.display_name,
      phone: m.phone || m.contact1_phone || m.contact2_phone,
      chinese_name: m.chinese_name,
      name: m.name,
      contact1_phone: m.contact1_phone,
      contact2_phone: m.contact2_phone,
    })),
    isBlocked: result.isBlocked,
  };
}

/**
 * Hook to check for duplicate suppliers by display_name and phone fields.
 * - Exact match (100% same value, case-insensitive / digit-normalized) → block submission
 * - Similar match (partial/contains match) → warn but allow submission
 */
export function useSupplierDuplicateCheck(options?: UseDuplicateCheckOptions) {
  const { excludeId } = options || {};

  const [displayNameResult, setDisplayNameResult] =
    useState<DuplicateCheckResult>(emptyResult);
  const [phoneResult, setPhoneResult] =
    useState<DuplicateCheckResult>(emptyResult);
  const [contact1PhoneResult, setContact1PhoneResult] =
    useState<DuplicateCheckResult>(emptyResult);
  const [contact2PhoneResult, setContact2PhoneResult] =
    useState<DuplicateCheckResult>(emptyResult);
  const [isLoading, setIsLoading] = useState(false);

  const debounceTimerName = useRef<NodeJS.Timeout | null>(null);
  const phoneTimers = useRef<Partial<Record<SupplierPhoneField, NodeJS.Timeout>>>(
    {}
  );

  const invokeDisplayNameCheck = useCallback(
    async (displayName: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-supplier-duplicate-check",
        {
          body: { displayName, excludeId },
        }
      );
      if (error) throw error;
      return data as {
        displayNameResult: DuplicateCheckResult;
        phoneResult: DuplicateCheckResult;
      };
    },
    [excludeId]
  );

  const setPhoneResultForField = useCallback(
    (field: SupplierPhoneField, result: DuplicateCheckResult) => {
      if (field === "phone") setPhoneResult(result);
      else if (field === "contact1_phone") setContact1PhoneResult(result);
      else setContact2PhoneResult(result);
    },
    []
  );

  const checkDisplayName = useCallback(
    (value: string) => {
      if (debounceTimerName.current) clearTimeout(debounceTimerName.current);

      const trimmed = value.trim();
      if (!trimmed) {
        setDisplayNameResult(emptyResult);
        return;
      }

      debounceTimerName.current = setTimeout(async () => {
        try {
          setIsLoading(true);
          const result = await invokeDisplayNameCheck(trimmed);
          setDisplayNameResult(result.displayNameResult);
        } catch {
          setDisplayNameResult(emptyResult);
        } finally {
          setIsLoading(false);
        }
      }, 500);
    },
    [invokeDisplayNameCheck]
  );

  /**
   * Check a phone field for duplicates.
   * Overload-friendly: checkPhone(value) checks the main `phone` field;
   * checkPhone(field, value) checks a specific contact phone field.
   */
  const checkPhone = useCallback(
    (fieldOrValue: SupplierPhoneField | string, maybeValue?: string) => {
      const field: SupplierPhoneField =
        maybeValue === undefined ? "phone" : (fieldOrValue as SupplierPhoneField);
      const value = maybeValue === undefined ? fieldOrValue : maybeValue;

      if (phoneTimers.current[field]) clearTimeout(phoneTimers.current[field]);

      const trimmed = value.trim();
      const normalized = trimmed.replace(/[\s\-()+/]/g, "");
      if (!normalized || normalized.length < 4) {
        setPhoneResultForField(field, emptyResult);
        return;
      }

      phoneTimers.current[field] = setTimeout(async () => {
        try {
          setIsLoading(true);
          const result = await checkSupplierPhoneDuplicate(trimmed, excludeId);
          setPhoneResultForField(field, toPhoneDuplicateResult(result));
        } catch {
          setPhoneResultForField(field, emptyResult);
        } finally {
          setIsLoading(false);
        }
      }, 500);
    },
    [excludeId, setPhoneResultForField]
  );

  const reset = useCallback(() => {
    if (debounceTimerName.current) clearTimeout(debounceTimerName.current);
    (Object.keys(phoneTimers.current) as SupplierPhoneField[]).forEach((key) => {
      if (phoneTimers.current[key]) clearTimeout(phoneTimers.current[key]);
    });
    phoneTimers.current = {};
    setDisplayNameResult(emptyResult);
    setPhoneResult(emptyResult);
    setContact1PhoneResult(emptyResult);
    setContact2PhoneResult(emptyResult);
  }, []);

  // Whether ANY field has a blocking exact match
  const isBlocked =
    displayNameResult.isBlocked ||
    phoneResult.isBlocked ||
    contact1PhoneResult.isBlocked ||
    contact2PhoneResult.isBlocked;

  return {
    displayNameResult,
    phoneResult,
    contact1PhoneResult,
    contact2PhoneResult,
    isBlocked,
    isLoading,
    checkDisplayName,
    checkPhone,
    reset,
  };
}
