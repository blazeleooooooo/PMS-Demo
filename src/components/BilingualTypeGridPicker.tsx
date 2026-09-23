"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { LinkOption } from "@/lib/data/lookups";

function matchesLinkOptionSearch(opt: LinkOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    opt.label.toLowerCase().includes(q) ||
    (opt.searchText?.toLowerCase().includes(q) ?? false)
  );
}

const ACCENT_SELECTED = {
  blue: "border-blue-500 bg-blue-50 text-blue-700 font-medium ring-1 ring-blue-500",
  amber: "border-amber-500 bg-amber-50 text-amber-700 font-medium ring-1 ring-amber-500",
} as const;

export function BilingualTypeGridPicker({
  label,
  options,
  searchPlaceholder,
  mode,
  value,
  onChange,
  accent,
  resetKey,
}: {
  label: ReactNode;
  options: LinkOption[];
  searchPlaceholder: string;
  mode: "single" | "multi";
  value: string;
  onChange: (value: string) => void;
  accent: "blue" | "amber";
  resetKey?: string | number | boolean;
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch("");
  }, [resetKey]);

  const filtered = useMemo(
    () => options.filter((opt) => matchesLinkOptionSearch(opt, search)),
    [options, search],
  );

  const selectedIds =
    mode === "multi"
      ? value.split(",").filter(Boolean)
      : value
        ? [value]
        : [];

  const handleClick = (id: string) => {
    if (mode === "single") {
      onChange(id);
      return;
    }
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onChange(next.join(","));
  };

  return (
    <div className="space-y-1.5">
      {label}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>
      <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[300px]">
        {filtered.map((opt) => {
          const isSelected = selectedIds.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleClick(opt.id)}
              className={`px-3 py-2 text-sm rounded-md border transition-all text-center ${
                isSelected
                  ? ACCENT_SELECTED[accent]
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {opt.label}
              {opt.searchText && opt.searchText !== opt.label ? (
                <span className="block text-[11px] font-normal opacity-70 leading-tight mt-0.5">
                  {opt.searchText}
                </span>
              ) : null}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-3 text-xs text-gray-400 text-center py-2">
            無匹配結果
          </p>
        )}
      </div>
    </div>
  );
}
