import { daysBetween } from "@/lib/date-utils";

export const INCOME_COLLECTION_ON_TIME = "on_time" as const;
export const INCOME_COLLECTION_SLIGHTLY_LATE = "slightly_late" as const;
export const INCOME_COLLECTION_DELAYED = "delayed" as const;

export type IncomeCollectionSituation =
  | typeof INCOME_COLLECTION_ON_TIME
  | typeof INCOME_COLLECTION_SLIGHTLY_LATE
  | typeof INCOME_COLLECTION_DELAYED;

export const INCOME_COLLECTION_SITUATIONS: {
  value: IncomeCollectionSituation;
  label: string;
}[] = [
  { value: INCOME_COLLECTION_ON_TIME, label: "可如期收款" },
  { value: INCOME_COLLECTION_SLIGHTLY_LATE, label: "有少少遲, 但算順利" },
  { value: INCOME_COLLECTION_DELAYED, label: "出現延誤 (+多於14天)" },
];

/**
 * Visual-only default for 收款情況 from expected_payment_date − due_date.
 * Missing dates or a non-positive gap stay on 可如期收款.
 */
export function getIncomeCollectionSituation(
  dueDate: string | null | undefined,
  expectedPaymentDate: string | null | undefined
): IncomeCollectionSituation {
  const days = daysBetween(dueDate, expectedPaymentDate);
  if (days == null || days <= 0) return INCOME_COLLECTION_ON_TIME;
  if (days <= 14) return INCOME_COLLECTION_SLIGHTLY_LATE;
  return INCOME_COLLECTION_DELAYED;
}
