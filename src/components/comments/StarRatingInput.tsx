"use client";

import React, { useState } from "react";
import { Star } from "lucide-react";
import { STAR_LABELS, starLabel } from "@/lib/comment-rating-criteria";

interface StarRatingInputProps {
  value: number | null;
  onChange: (val: number | null) => void;
  /** Show the Chinese meaning next to stars (default true). */
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function StarRatingInput({
  value,
  onChange,
  showLabel = true,
  size = "md",
}: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value ?? 0;
  const labelPoint = hovered ?? value;
  const iconClass = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          title={`${i + 1} — ${STAR_LABELS[i + 1]}`}
          className="p-0.5 hover:scale-110 transition-transform"
          onMouseEnter={() => setHovered(i + 1)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onChange(value === i + 1 ? null : i + 1)}
        >
          <Star
            className={`${iconClass} cursor-pointer ${
              i < active
                ? "fill-amber-400 text-amber-400"
                : "text-gray-200 hover:text-amber-300"
            }`}
          />
        </button>
      ))}
      {showLabel && labelPoint != null && (
        <span className="text-xs text-amber-700 ml-1">
          {starLabel(labelPoint)}
        </span>
      )}
      {value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 text-xs text-gray-400 hover:text-gray-600"
        >
          清除
        </button>
      )}
    </div>
  );
}

/** Read-only stars with optional meaning label. */
export function StarRatingDisplay({
  point,
  showLabel = true,
}: {
  point: number | null;
  showLabel?: boolean;
}) {
  if (point == null) return null;
  const stars = Math.min(Math.max(Math.round(point), 0), 5);
  const label = starLabel(point);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < stars ? "fill-amber-400 text-amber-400" : "text-gray-200"
          }`}
        />
      ))}
      {showLabel && label && (
        <span className="text-xs text-gray-500 ml-1">
          {label} ({point})
        </span>
      )}
      {!showLabel && (
        <span className="text-xs text-gray-400 ml-1">({point})</span>
      )}
    </div>
  );
}

export function StarRatingLegend() {
  return (
    <p className="text-[11px] text-gray-400 leading-relaxed">
      評分標準：
      {Object.entries(STAR_LABELS)
        .map(([n, label]) => `${n} ${label}`)
        .join(" · ")}
    </p>
  );
}
