"use client";

import React from "react";
import { AlertTriangle, XCircle } from "lucide-react";
import type { DuplicateCheckResult, DuplicateMatch } from "@/hooks/use-supplier-duplicate-check";

interface DuplicateWarningProps {
  result: DuplicateCheckResult;
  fieldLabel: string;
  /**
   * Entity noun for blocked-message copy, e.g. "客戶" / "供應商".
   * When set for phone fields: "此電話號碼已被其他{entityLabel}使用，無法提交"
   */
  entityLabel?: string;
  /** When true, use the phone-specific blocked message. */
  isPhoneField?: boolean;
}

function MatchRow({ match }: { match: DuplicateMatch }) {
  const displayLabel = match.display_name || match.chinese_name || match.name || "未命名";
  return (
    <div className="flex items-center gap-2 text-xs px-2 py-1 bg-white/60 rounded">
      <span className="font-medium text-gray-700 truncate max-w-[140px]">{displayLabel}</span>
      {match.phone && <span className="text-gray-400">📞 {match.phone}</span>}
    </div>
  );
}

export function DuplicateWarning({
  result,
  fieldLabel,
  entityLabel,
  isPhoneField,
}: DuplicateWarningProps) {
  const { exactMatches, similarMatches, isBlocked } = result;

  if (exactMatches.length === 0 && similarMatches.length === 0) return null;

  const blockedMessage =
    isPhoneField && entityLabel
      ? `此電話號碼已被其他${entityLabel}使用，無法提交`
      : `${fieldLabel}已存在完全相同的記錄，無法提交`;

  // Exact match → red error block
  if (isBlocked && exactMatches.length > 0) {
    return (
      <div className="mt-1.5 rounded-md border border-red-200 bg-red-50 p-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-red-700">
            {blockedMessage}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {exactMatches.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </div>
      </div>
    );
  }

  // Similar matches → amber warning
  if (similarMatches.length > 0) {
    return (
      <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 p-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-700">
            發現相似的{fieldLabel}記錄（仍可提交）
          </span>
        </div>
        <div className="flex flex-col gap-1 max-h-[80px] overflow-y-auto">
          {similarMatches.slice(0, 5).map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
          {similarMatches.length > 5 && (
            <span className="text-[12px] text-amber-500">...及其餘 {similarMatches.length - 5} 筆</span>
          )}
        </div>
      </div>
    );
  }

  return null;
}
