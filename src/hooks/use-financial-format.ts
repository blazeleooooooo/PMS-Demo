"use client";

import { useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  canViewBVPercentage,
  canViewFinancialValues,
  FINANCIAL_MASK,
  formatBVRatioDisplay,
  formatBVValue,
  maskIfHidden,
} from "@/lib/financial-visibility";
import {
  formatMoney as formatMoneyBase,
  formatMoney2 as formatMoney2Base,
  formatMoneyCompact as formatMoneyCompactBase,
} from "@/lib/date-utils";

type MoneyOptions = Parameters<typeof formatMoneyBase>[1];
type Money2Options = Parameters<typeof formatMoney2Base>[1];
type MoneyCompactOptions = Parameters<typeof formatMoneyCompactBase>[1];
type BVOptions = Parameters<typeof formatBVValue>[1];

export function useFinancialVisibility() {
  const { staff } = useAuth();
  const canView = canViewFinancialValues(staff?.position);

  return {
    canViewFinancialValues: canView,
  };
}

export function useFinancialFormat() {
  const { staff } = useAuth();
  const canView = canViewFinancialValues(staff?.position);
  const canViewBVRatio = canViewBVPercentage(
    staff?.position,
    staff?.role as string | null | undefined
  );

  const formatMoney = useCallback(
    (val: number | null | undefined, options?: MoneyOptions) =>
      maskIfHidden(canView, () => formatMoneyBase(val, options)),
    [canView]
  );

  const formatMoney2 = useCallback(
    (val: number | null | undefined, options?: Money2Options) =>
      maskIfHidden(canView, () => formatMoney2Base(val, options)),
    [canView]
  );

  const formatMoneyCompact = useCallback(
    (val: number | null | undefined, options?: MoneyCompactOptions) =>
      maskIfHidden(canView, () => formatMoneyCompactBase(val, options)),
    [canView]
  );

  const formatBV = useCallback(
    (val: number | null | undefined, options?: BVOptions) =>
      maskIfHidden(canView, () => formatBVValue(val, options)),
    [canView]
  );

  const formatBVRatio = useCallback(
    (ratio: number | null | undefined) => formatBVRatioDisplay(ratio, canViewBVRatio),
    [canViewBVRatio]
  );

  return useMemo(
    () => ({
      canViewFinancialValues: canView,
      canViewBVPercentage: canViewBVRatio,
      formatMoney,
      formatMoney2,
      formatMoneyCompact,
      formatBV,
      formatBVRatio,
      financialMask: FINANCIAL_MASK,
    }),
    [canView, canViewBVRatio, formatMoney, formatMoney2, formatMoneyCompact, formatBV, formatBVRatio]
  );
}
