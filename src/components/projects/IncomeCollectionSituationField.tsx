"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  INCOME_COLLECTION_SITUATIONS,
  getIncomeCollectionSituation,
  type IncomeCollectionSituation,
} from "@/lib/income-collection-situation";

interface IncomeCollectionSituationFieldProps {
  dueDate: string | null | undefined;
  expectedPaymentDate: string | null | undefined;
}

export function IncomeCollectionSituationField({
  dueDate,
  expectedPaymentDate,
}: IncomeCollectionSituationFieldProps) {
  const suggested = getIncomeCollectionSituation(dueDate, expectedPaymentDate);
  const [selected, setSelected] = useState<IncomeCollectionSituation>(suggested);

  useEffect(() => {
    setSelected(suggested);
  }, [suggested]);

  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">收款情況</label>
      <div className="flex flex-wrap gap-2">
        {INCOME_COLLECTION_SITUATIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              "rounded-full px-3 py-1 text-[13px] border transition-all",
              selected === option.value
                ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            )}
            onClick={() => setSelected(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
