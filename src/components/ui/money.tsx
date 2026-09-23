"use client";

import { cn } from "@/lib/utils";
import { useFinancialFormat } from "@/hooks/use-financial-format";

interface MoneyProps {
  value: number | null | undefined;
  decimals?: 0 | 2;
  compact?: boolean;
  className?: string;
  fallback?: string;
  showZero?: boolean;
}

export function Money({
  value,
  decimals = 0,
  compact = false,
  className,
  fallback,
  showZero,
}: MoneyProps) {
  const { formatMoney, formatMoney2, formatMoneyCompact } = useFinancialFormat();

  const formatted = compact
    ? formatMoneyCompact(value, fallback !== undefined ? { fallback } : undefined)
    : decimals === 2
      ? formatMoney2(value, fallback !== undefined ? { fallback } : undefined)
      : formatMoney(
          value,
          fallback !== undefined || showZero !== undefined
            ? { fallback, showZero }
            : undefined
        );

  return <span className={cn("font-mono", className)}>{formatted}</span>;
}
