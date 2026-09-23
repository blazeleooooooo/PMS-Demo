"use client";

import { Input } from "@/components/ui/input";

interface IncomeBadDebtsFieldProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
}

export function IncomeBadDebtsField({ value, onChange }: IncomeBadDebtsFieldProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/30 p-4 space-y-3">
      <p className="text-[13px] font-medium text-gray-500 mb-2">只限主管及會計填寫</p>
      <div>
        <label className="text-[13px] text-gray-500 mb-1 block">壞帳金額</label>
        <Input
          type="number"
          placeholder="0.00"
          value={value ?? ""}
          onChange={(e) => {
            const val = e.target.value ? parseFloat(e.target.value) : null;
            onChange(val != null && Number.isFinite(val) ? val : null);
          }}
          className="h-8 text-sm font-mono"
        />
      </div>
    </div>
  );
}
