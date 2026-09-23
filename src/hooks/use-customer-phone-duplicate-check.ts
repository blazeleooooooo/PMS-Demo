"use client";

import { useState, useCallback, useRef } from "react";
import {
  checkCustomerPhoneDuplicate,
  type CustomerPhoneDuplicateResult,
} from "@/lib/data/customers";
import type { DuplicateCheckResult, DuplicateMatch } from "@/hooks/use-supplier-duplicate-check";

export type CustomerPhoneField = "phone_display" | "phone_number_a" | "phone_number_b";

interface UseCustomerPhoneDuplicateCheckOptions {
  /** Current customer ID in edit mode — excluded from matches */
  excludeId?: string;
}

const emptyResult: DuplicateCheckResult = {
  exactMatches: [],
  similarMatches: [],
  isBlocked: false,
};

function toDuplicateResult(result: CustomerPhoneDuplicateResult): DuplicateCheckResult {
  const mapMatch = (m: CustomerPhoneDuplicateResult["exactMatches"][number]): DuplicateMatch => ({
    id: m.id,
    display_name: m.display_name || m.customer_name || m.company_name,
    phone: m.phone_display || m.phone_number_a || m.phone_number_b,
    chinese_name: m.company_name,
    name: m.customer_name,
  });

  return {
    exactMatches: result.exactMatches.map(mapMatch),
    similarMatches: result.similarMatches.map(mapMatch),
    isBlocked: result.isBlocked,
  };
}

/**
 * Debounced phone duplicate check for customer dialog fields.
 * Exact match across phone_display / phone_number_a / phone_number_b → block submit.
 */
export function useCustomerPhoneDuplicateCheck(
  options?: UseCustomerPhoneDuplicateCheckOptions
) {
  const { excludeId } = options || {};

  const [phoneDisplayResult, setPhoneDisplayResult] =
    useState<DuplicateCheckResult>(emptyResult);
  const [phoneNumberAResult, setPhoneNumberAResult] =
    useState<DuplicateCheckResult>(emptyResult);
  const [phoneNumberBResult, setPhoneNumberBResult] =
    useState<DuplicateCheckResult>(emptyResult);
  const [isLoading, setIsLoading] = useState(false);

  const timers = useRef<Partial<Record<CustomerPhoneField, NodeJS.Timeout>>>({});

  const setResultForField = useCallback(
    (field: CustomerPhoneField, result: DuplicateCheckResult) => {
      if (field === "phone_display") setPhoneDisplayResult(result);
      else if (field === "phone_number_a") setPhoneNumberAResult(result);
      else setPhoneNumberBResult(result);
    },
    []
  );

  const checkPhone = useCallback(
    (field: CustomerPhoneField, value: string) => {
      if (timers.current[field]) clearTimeout(timers.current[field]);

      const trimmed = value.trim();
      const normalized = trimmed.replace(/[\s\-()+/]/g, "");
      if (!normalized || normalized.length < 4) {
        setResultForField(field, emptyResult);
        return;
      }

      timers.current[field] = setTimeout(async () => {
        try {
          setIsLoading(true);
          const result = await checkCustomerPhoneDuplicate(trimmed, excludeId);
          setResultForField(field, toDuplicateResult(result));
        } catch {
          setResultForField(field, emptyResult);
        } finally {
          setIsLoading(false);
        }
      }, 500);
    },
    [excludeId, setResultForField]
  );

  const reset = useCallback(() => {
    (Object.keys(timers.current) as CustomerPhoneField[]).forEach((key) => {
      if (timers.current[key]) clearTimeout(timers.current[key]);
    });
    timers.current = {};
    setPhoneDisplayResult(emptyResult);
    setPhoneNumberAResult(emptyResult);
    setPhoneNumberBResult(emptyResult);
  }, []);

  const isBlocked =
    phoneDisplayResult.isBlocked ||
    phoneNumberAResult.isBlocked ||
    phoneNumberBResult.isBlocked;

  return {
    phoneDisplayResult,
    phoneNumberAResult,
    phoneNumberBResult,
    isBlocked,
    isLoading,
    checkPhone,
    reset,
  };
}
