"use client";

import React from "react";
import {
  type CriteriaValues,
  type RatingCriterionDef,
  type RatingCriterionKey,
} from "@/lib/comment-rating-criteria";
import {
  StarRatingDisplay,
  StarRatingInput,
  StarRatingLegend,
} from "@/components/comments/StarRatingInput";

interface CriteriaRatingFormProps {
  criteria: RatingCriterionDef[];
  values: CriteriaValues;
  overall: number | null;
  onChangeCriterion: (key: RatingCriterionKey, val: number | null) => void;
  onChangeOverall: (val: number | null) => void;
  showLegend?: boolean;
}

/** Multi-row criteria stars + overall rating for create/edit forms. */
export function CriteriaRatingForm({
  criteria,
  values,
  overall,
  onChangeCriterion,
  onChangeOverall,
  showLegend = true,
}: CriteriaRatingFormProps) {
  return (
    <div className="space-y-3">
      {criteria.map((c) => (
        <div
          key={c.key}
          className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3"
        >
          <label className="text-xs font-medium text-gray-500 w-28 shrink-0">
            {c.label}
          </label>
          <StarRatingInput
            value={values[c.key] ?? null}
            onChange={(v) => onChangeCriterion(c.key, v)}
          />
        </div>
      ))}
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 pt-1 border-t border-gray-50">
        <label className="text-xs font-medium text-gray-600 w-28 shrink-0">
          整體評分
        </label>
        <StarRatingInput value={overall} onChange={onChangeOverall} />
      </div>
      {showLegend && <StarRatingLegend />}
    </div>
  );
}

interface CriteriaRatingDisplayProps {
  entries: { key: string; label: string; point: number }[];
  overall: number | null;
}

/** Compact read-only criteria + overall for comment list cards. */
export function CriteriaRatingDisplay({
  entries,
  overall,
}: CriteriaRatingDisplayProps) {
  if (entries.length === 0 && overall == null) return null;

  return (
    <div className="space-y-1">
      {entries.map((e) => (
        <div key={e.key} className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 w-20 shrink-0">
            {e.label}
          </span>
          <StarRatingDisplay point={e.point} />
        </div>
      ))}
      {overall != null && (
        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-[11px] font-medium text-gray-500 w-20 shrink-0">
            整體評分
          </span>
          <StarRatingDisplay point={overall} />
        </div>
      )}
    </div>
  );
}
