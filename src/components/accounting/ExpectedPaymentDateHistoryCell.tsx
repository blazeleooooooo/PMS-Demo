"use client";

import { History } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  expectedPaymentDateChangeCount,
  formatExpectedPaymentLogChangedAt,
  formatExpectedPaymentLogDate,
  latestPreviousExpectedPaymentDate,
  type ExpectedPaymentDateLogEntry,
} from "@/lib/expected-payment-date-log";

function staffLabel(
  staffId: string | null,
  staffNameById: Map<string, string> | undefined
): string {
  if (!staffId) return "—";
  return staffNameById?.get(staffId) || "—";
}

export function ExpectedPaymentDateHistoryCell({
  log,
  staffNameById,
}: {
  log: ExpectedPaymentDateLogEntry[];
  staffNameById?: Map<string, string>;
}) {
  const previousDate = latestPreviousExpectedPaymentDate(log);
  const changeCount = expectedPaymentDateChangeCount(log);
  const history = [...log].reverse();

  if (changeCount === 0) {
    return <span className="text-[13px] text-gray-400">—</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-gray-100"
          title="查看預計日期更改紀錄"
        >
          <History className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="text-[13px] text-gray-700 whitespace-nowrap">
            {formatExpectedPaymentLogDate(previousDate)}
          </span>
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-100 px-1 text-[10px] font-medium text-gray-600">
            {changeCount}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <p className="text-[12px] font-medium text-gray-900 mb-2">
          更改紀錄
          <span className="ml-1 font-normal text-gray-400">({changeCount})</span>
        </p>
        <ol className="space-y-2 max-h-64 overflow-y-auto">
          {history.map((entry, index) => (
            <li
              key={`${entry.changed_at}-${entry.previous_date ?? "empty"}-${index}`}
              className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-gray-800">
                  {entry.previous_date
                    ? `前次 ${formatExpectedPaymentLogDate(entry.previous_date)}`
                    : "首次填寫"}
                </span>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  {formatExpectedPaymentLogChangedAt(entry.changed_at)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {staffLabel(entry.staff_id, staffNameById)}
              </p>
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  );
}
