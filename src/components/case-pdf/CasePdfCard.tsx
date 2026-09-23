"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ImageOff,
  Eye,
  EyeOff,
  MapPin,
  Building2,
  Ruler,
  CalendarRange,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CasePdfProjectRow } from "@/lib/data-service";
import {
  buildCasePdfMetaRows,
  type CasePdfMetaKey,
} from "@/lib/case-pdf-meta";

interface CasePdfCardProps {
  row: CasePdfProjectRow;
  index: number;
  total: number;
  hidden?: boolean;
  onChange: (next: CasePdfProjectRow) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleHidden: () => void;
}

function patchField(
  row: CasePdfProjectRow,
  field: keyof CasePdfProjectRow,
  value: string,
): CasePdfProjectRow {
  const next = { ...row, [field]: value };
  if (field === "dealAmountDisplay") {
    const n = Number(String(value).replace(/,/g, ""));
    if (Number.isFinite(n)) {
      next.dealAmountRounded = n;
    }
  }
  return next;
}

export default function CasePdfCard({
  row,
  index,
  total,
  hidden = false,
  onChange,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
}: CasePdfCardProps) {
  const images = row.images;
  const selectedIdx = Math.max(
    0,
    images.findIndex((img) => img.id === row.selectedImageId),
  );
  const currentImage =
    images.length > 0
      ? images[selectedIdx >= 0 ? selectedIdx : 0]
      : null;

  const cycleImage = (dir: -1 | 1) => {
    if (images.length === 0) return;
    const next = (selectedIdx + dir + images.length) % images.length;
    onChange({ ...row, selectedImageId: images[next].id });
  };

  return (
    <div
      className={cn(
        "bg-white border rounded-lg overflow-hidden flex flex-col sm:flex-row group transition-opacity",
        hidden
          ? "border-dashed border-gray-300 opacity-50"
          : "border-gray-200",
      )}
    >
      <div className="flex-1 p-4 space-y-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={row.projectTypeName}
                onChange={(e) =>
                  onChange(patchField(row, "projectTypeName", e.target.value))
                }
                placeholder="項目類型"
                disabled={hidden}
                className="h-7 text-xs w-auto max-w-[200px] border-dashed text-bw-blue font-medium"
              />
              {hidden && (
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  已隱藏
                </span>
              )}
            </div>
            <Input
              value={row.projectName}
              onChange={(e) =>
                onChange(patchField(row, "projectName", e.target.value))
              }
              placeholder="項目名稱"
              disabled={hidden}
              className="h-9 text-base font-semibold border-0 border-b border-transparent hover:border-gray-200 focus-visible:ring-0 focus-visible:border-bw-blue rounded-none px-0"
            />
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={index === 0 || hidden}
              onClick={onMoveUp}
              title="上移"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={index >= total - 1 || hidden}
              onClick={onMoveDown}
              title="下移"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                hidden ? "text-bw-blue hover:text-bw-blue" : "text-gray-500",
              )}
              onClick={onToggleHidden}
              title={hidden ? "顯示於 PDF" : "隱藏（不輸出 PDF）"}
            >
              {hidden ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {!hidden && (
          <>
            <div className="space-y-1.5">
              {buildCasePdfMetaRows(row, { mergePeriodDays: false })
                .filter((item) => item.key !== "period" && item.key !== "days")
                .map((item) => (
                  <MetaField
                    key={item.key}
                    icon={META_ICONS[item.key]}
                    label={item.label}
                    value={item.raw}
                    onChange={(v) => onChange(patchField(row, item.field, v))}
                  />
                ))}
              <PeriodDaysField
                period={row.constructionPeriod}
                days={row.constructionDays}
                onPeriodChange={(v) =>
                  onChange(patchField(row, "constructionPeriod", v))
                }
                onDaysChange={(v) =>
                  onChange(patchField(row, "constructionDays", v))
                }
              />
              <Field
                label="成交金額"
                value={row.dealAmountDisplay}
                prefix="$"
                onChange={(v) =>
                  onChange(patchField(row, "dealAmountDisplay", v))
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-gray-400">
                牽涉工程
              </label>
              <Textarea
                value={row.involvedWorks}
                onChange={(e) =>
                  onChange(patchField(row, "involvedWorks", e.target.value))
                }
                placeholder="服務類型…"
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </>
        )}
      </div>

      <div className="relative w-full sm:w-[400px] shrink-0 bg-gray-100 aspect-[4/3] sm:aspect-auto sm:min-h-[300px] order-first sm:order-last">
        {currentImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentImage.image}
            alt={row.projectName || "個案圖片"}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">無 3D 效果圖</span>
          </div>
        )}

        {hidden && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-sm font-medium px-2 py-1 rounded bg-black/50">
              已隱藏（不會輸出）
            </span>
          </div>
        )}

        {images.length > 1 && !hidden && (
          <>
            <button
              type="button"
              aria-label="上一張"
              onClick={() => cycleImage(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="下一張"
              onClick={() => cycleImage(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/50 text-white text-[10px]">
              {selectedIdx + 1} / {images.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const META_ICONS: Record<
  CasePdfMetaKey,
  React.ComponentType<{ className?: string }>
> = {
  district: MapPin,
  building: Building2,
  size: Ruler,
  period: CalendarRange,
  days: Clock,
};

function MetaField({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="h-8 text-sm"
      />
    </div>
  );
}

function PeriodDaysField({
  period,
  days,
  onPeriodChange,
  onDaysChange,
}: {
  period: string;
  days: string;
  onPeriodChange: (v: string) => void;
  onDaysChange: (v: string) => void;
}) {
  const hasPeriod = Boolean(period && period.trim());
  const hasDays = Boolean(days && days.trim());
  if (!hasPeriod && !hasDays) return null;
  const Icon = hasPeriod ? CalendarRange : Clock;

  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      {hasPeriod && (
        <Input
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          placeholder="施工時段"
          aria-label="施工時段"
          className="h-8 text-sm min-w-0 flex-1"
        />
      )}
      {hasDays && (
        <>
          {hasPeriod ? (
            <span className="text-sm text-gray-500 shrink-0">(</span>
          ) : null}
          <Input
            value={days}
            onChange={(e) => onDaysChange(e.target.value)}
            placeholder="日數"
            aria-label="施工日數"
            className="h-8 text-sm w-[72px] shrink-0"
          />
          <span className="text-sm text-gray-500 shrink-0">
            {hasPeriod ? "日)" : "日"}
          </span>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  prefix,
  onChange,
}: {
  label: string;
  value: string;
  prefix?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      <label className="text-[10px] uppercase tracking-wide text-gray-400">
        {label}
      </label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">
            {prefix}
          </span>
        ) : null}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("h-8 text-sm", prefix && "pl-6")}
        />
      </div>
    </div>
  );
}
