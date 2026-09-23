"use client";

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  fetchProjectTypeOptions,
  type CasePdfFilters,
  type LinkOption,
} from "@/lib/data-service";
import { defaultPastYearRange } from "@/lib/case-pdf-storage";

export interface CasePdfFilterValues {
  projectTypeIds: string[];
  dateRange: DateRange | undefined;
  minDealAmount: string;
}

export { defaultPastYearRange };

export const EMPTY_CASE_PDF_FILTERS: CasePdfFilterValues = {
  projectTypeIds: [],
  dateRange: defaultPastYearRange(),
  minDealAmount: "",
};

export function toCasePdfFilters(values: CasePdfFilterValues): CasePdfFilters {
  const raw = values.minDealAmount.replace(/,/g, "").trim();
  const parsed = raw === "" ? null : Number(raw);
  return {
    projectTypeIds: values.projectTypeIds,
    periodFrom: values.dateRange?.from
      ? format(values.dateRange.from, "yyyy-MM-dd")
      : null,
    periodTo: values.dateRange?.to
      ? format(values.dateRange.to, "yyyy-MM-dd")
      : values.dateRange?.from
        ? format(values.dateRange.from, "yyyy-MM-dd")
        : null,
    minDealAmount:
      parsed != null && Number.isFinite(parsed) ? parsed : null,
  };
}

interface CasePdfFiltersProps {
  value: CasePdfFilterValues;
  onChange: (next: CasePdfFilterValues) => void;
  onApply: () => void;
  loading?: boolean;
}

export default function CasePdfFiltersBar({
  value,
  onChange,
  onApply,
  loading,
}: CasePdfFiltersProps) {
  const [typeOptions, setTypeOptions] = useState<LinkOption[]>([]);
  const [typeSearch, setTypeSearch] = useState("");

  useEffect(() => {
    fetchProjectTypeOptions().then(setTypeOptions);
  }, []);

  const toggleType = (id: string) => {
    const next = value.projectTypeIds.includes(id)
      ? value.projectTypeIds.filter((x) => x !== id)
      : [...value.projectTypeIds, id];
    onChange({ ...value, projectTypeIds: next });
  };

  const filteredTypes = typeOptions.filter(
    (t) =>
      !typeSearch ||
      t.label.toLowerCase().includes(typeSearch.toLowerCase()),
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        {/* Construction period */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">施工時段</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[260px] justify-start text-left font-normal h-9",
                  !value.dateRange && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value.dateRange?.from ? (
                  value.dateRange.to ? (
                    <>
                      {format(value.dateRange.from, "yyyy-MM-dd")} –{" "}
                      {format(value.dateRange.to, "yyyy-MM-dd")}
                    </>
                  ) : (
                    format(value.dateRange.from, "yyyy-MM-dd")
                  )
                ) : (
                  <span>選擇日期範圍</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={value.dateRange?.from}
                selected={value.dateRange}
                onSelect={(range) =>
                  onChange({ ...value, dateRange: range })
                }
                numberOfMonths={2}
              />
              {value.dateRange && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      onChange({
                        ...value,
                        dateRange: defaultPastYearRange(),
                      })
                    }
                  >
                    重設為去年全年
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Min deal amount */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">最少成交金額</Label>
          <Input
            type="number"
            min={0}
            step={100000}
            placeholder="例如 500000"
            className="h-9 w-[180px]"
            value={value.minDealAmount}
            onChange={(e) =>
              onChange({ ...value, minDealAmount: e.target.value })
            }
          />
        </div>

        <Button
          className="h-9 bg-bw-blue hover:bg-bw-blue/90"
          onClick={onApply}
          disabled={loading}
        >
          {loading ? "載入中…" : "套用篩選"}
        </Button>

        {(value.projectTypeIds.length > 0 ||
          value.dateRange ||
          value.minDealAmount) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-gray-500"
            onClick={() => onChange(EMPTY_CASE_PDF_FILTERS)}
          >
            <X className="h-4 w-4 mr-1" />
            清除篩選
          </Button>
        )}
      </div>

      {/* Project types multi-select */}
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">
          項目類型（可多選）
          {value.projectTypeIds.length > 0 && (
            <span className="ml-2 text-bw-blue">
              已選 {value.projectTypeIds.length}
            </span>
          )}
        </Label>
        <Input
          placeholder="搜尋類型…"
          value={typeSearch}
          onChange={(e) => setTypeSearch(e.target.value)}
          className="h-8 max-w-xs text-sm mb-2"
        />
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {filteredTypes.map((t) => {
            const selected = value.projectTypeIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleType(t.id)}
                className={cn(
                  "px-2.5 py-1 rounded border text-xs transition-colors",
                  selected
                    ? "bg-bw-blue text-white border-bw-blue"
                    : "bg-white text-gray-700 border-gray-200 hover:border-bw-blue hover:text-bw-blue",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
