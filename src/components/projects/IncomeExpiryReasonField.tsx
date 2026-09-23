"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchIncomeExpiryReasonOptions,
  type IncomeExpiryReasonOption,
} from "@/lib/data/lookups";
import { isDueDateExpired } from "@/lib/date-utils";

interface IncomeExpiryReasonFieldProps {
  dueDate: string | null | undefined;
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  required?: boolean;
}

export function IncomeExpiryReasonField({
  dueDate,
  value,
  onChange,
  required = true,
}: IncomeExpiryReasonFieldProps) {
  const expired = isDueDateExpired(dueDate);
  const [reasons, setReasons] = useState<IncomeExpiryReasonOption[]>([]);

  useEffect(() => {
    if (!expired) return;
    let cancelled = false;
    fetchIncomeExpiryReasonOptions(value).then((rows) => {
      if (!cancelled) setReasons(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [expired, value]);

  if (!expired || !required) return null;

  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">
        逾期原因{required ? <span className="text-red-500"> *</span> : null}
      </label>
      <Select
        value={value || ""}
        onValueChange={(val) => onChange(val || null)}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="選擇逾期原因" />
        </SelectTrigger>
        <SelectContent>
          {reasons.map((reason) => (
            <SelectItem key={reason.id} value={reason.id}>
              {reason.label}
              {!reason.is_active ? "（已停用）" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {required && !value && (
        <p className="text-[11px] text-red-500 mt-1">到期日已過，請選擇逾期原因</p>
      )}
    </div>
  );
}
