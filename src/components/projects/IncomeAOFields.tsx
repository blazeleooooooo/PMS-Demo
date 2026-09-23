"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AO_DESIGN_FIRM_STATUSES,
  AO_WORK_STATUSES,
  type IncomeAoFormFields,
} from "@/lib/income-ao";

interface IncomeAOFieldsProps {
  value: Partial<IncomeAoFormFields>;
  onChange: (patch: Partial<IncomeAoFormFields>) => void;
}

function AoPill({
  selected,
  urgent,
  children,
  onClick,
}: {
  selected: boolean;
  urgent?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full px-3 py-1 text-[13px] border transition-all",
        selected && urgent
          ? "border-red-400 bg-red-50 text-red-700 font-medium"
          : selected
            ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
            : urgent
              ? "border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function IncomeAOFields({ value, onChange }: IncomeAOFieldsProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/30 p-4 space-y-3">
      <p className="text-[13px] font-medium text-gray-500 mb-2">A.O.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[13px] text-gray-500 mb-1 block">提出要求日期</label>
          <Input
            type="date"
            value={value.ao_request_date || ""}
            onChange={(e) => onChange({ ao_request_date: e.target.value || null })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-[13px] text-gray-500 mb-1 block">AO發出日期</label>
          <Input
            type="date"
            value={value.ao_issue_date || ""}
            onChange={(e) => onChange({ ao_issue_date: e.target.value || null })}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-[13px] text-gray-500 mb-1 block">預算工程期 (確定付款後)</label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="0"
            value={value.ao_work_days ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (!raw) {
                onChange({ ao_work_days: null });
                return;
              }
              const parsed = parseInt(raw, 10);
              onChange({ ao_work_days: Number.isFinite(parsed) ? parsed : null });
            }}
            className="h-8 text-sm font-mono w-28"
          />
          <span className="text-[13px] text-gray-500">天</span>
        </div>
      </div>
      <div>
        <label className="text-[13px] text-gray-500 mb-1 block">客人設計確定</label>
        <div className="flex flex-wrap gap-2">
          {AO_DESIGN_FIRM_STATUSES.map((option) => (
            <AoPill
              key={option.value}
              selected={value.ao_design_firm_status === option.value}
              urgent={option.urgent}
              onClick={() =>
                onChange({
                  ao_design_firm_status:
                    value.ao_design_firm_status === option.value ? null : option.value,
                })
              }
            >
              {option.label}
            </AoPill>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[13px] text-gray-500 mb-1 block">客人報價確定日期</label>
        <Input
          type="date"
          value={value.ao_quotation_firm_date || ""}
          onChange={(e) => onChange({ ao_quotation_firm_date: e.target.value || null })}
          className="h-8 text-sm"
        />
      </div>
      <div>
        <label className="text-[13px] text-gray-500 mb-1 block">工程進度</label>
        <div className="flex flex-wrap gap-2">
          {AO_WORK_STATUSES.map((option) => (
            <AoPill
              key={option.value}
              selected={value.ao_work_status === option.value}
              onClick={() =>
                onChange({
                  ao_work_status: value.ao_work_status === option.value ? null : option.value,
                })
              }
            >
              {option.label}
            </AoPill>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[13px] text-gray-500 mb-1 block">客人跟進</label>
        <Textarea
          placeholder="輸入跟進內容..."
          value={value.ao_client_follow_up || ""}
          onChange={(e) => onChange({ ao_client_follow_up: e.target.value || null })}
          className="text-sm min-h-[72px] resize-y"
          rows={3}
        />
      </div>
    </div>
  );
}
