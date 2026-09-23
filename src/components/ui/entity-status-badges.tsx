"use client";

// Shared BWA/BWF project-status and pitching-stage badges.
// Project status uses Chinese-only labels and the same hues as ProjectStatusDot.

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  projectStatusBadgeClass,
  projectStatusDisplayLabel,
  projectStatusDotClass,
  projectStatusShortLabel,
} from "@/lib/project-status-rules";

/** Colored status dot shown next to a BWA/BWF project name. */
export function ProjectStatusDot({
  status,
  className = "",
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const label = projectStatusDisplayLabel(status);
  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ${projectStatusDotClass(status)} ${className}`}
      title={label}
      aria-label={label}
    />
  );
}

/** Project status badge — same hues as ProjectStatusDot, Chinese label. */
export function ProjectStatusBadge({
  status,
  className = "",
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status || status === "—") {
    return (
      <Badge variant="outline" className={`text-gray-400 text-[11px] font-medium ${className}`}>
        未知
      </Badge>
    );
  }
  const base = `text-[11px] font-medium ${className}`;
  const canonicalClass = projectStatusBadgeClass(status);
  const canonicalLabel = projectStatusShortLabel(status);
  if (canonicalClass && canonicalLabel) {
    return (
      <Badge className={`${canonicalClass} ${base}`}>
        {canonicalLabel}
      </Badge>
    );
  }

  const s = status.toLowerCase();
  if (
    s.includes("progress") ||
    s.includes("work in progress") ||
    s.includes("active") ||
    s.includes("進行") ||
    s.includes("work_in_progress")
  )
    return (
      <Badge className={`bg-yellow-100 text-yellow-700 hover:bg-yellow-100 ${base}`}>
        進行中
      </Badge>
    );
  if (s.includes("pending") || s.includes("等待") || s.includes("wait"))
    return (
      <Badge className={`bg-yellow-100 text-yellow-700 hover:bg-yellow-100 ${base}`}>
        等待中
      </Badge>
    );
  if (s.includes("cancelled") || s.includes("取消"))
    return (
      <Badge className={`bg-red-100 text-red-700 hover:bg-red-100 ${base}`}>
        已取消
      </Badge>
    );
  if (s.includes("hold") || s.includes("暫停"))
    return (
      <Badge className={`bg-orange-100 text-orange-700 hover:bg-orange-100 ${base}`}>
        暫停
      </Badge>
    );
  if (s.includes("dispute"))
    return (
      <Badge className={`bg-blue-100 text-blue-700 hover:bg-blue-100 ${base}`}>
        爭議
      </Badge>
    );
  return (
    <Badge variant="outline" className={base}>
      {status}
    </Badge>
  );
}

/** Pitching stage badge — same colors as /proposals list, Chinese label. */
export function PitchingStageBadge({
  stage,
  className = "",
}: {
  stage: string | null | undefined;
  className?: string;
}) {
  if (!stage || stage === "—") {
    return (
      <Badge variant="outline" className={`text-gray-400 text-[11px] font-medium rounded-full px-2.5 py-0.5 ${className}`}>
        未知
      </Badge>
    );
  }
  const s = stage.toLowerCase();
  const base = `text-[11px] font-medium border rounded-full px-2.5 py-0.5 ${className}`;

  if (s.includes("confirmed") || s.includes("won") || s.includes("成功") || s.includes("confirm"))
    return (
      <Badge className={`bg-green-100 text-green-700 hover:bg-green-100 border-green-200 ${base}`}>
        確認項目
      </Badge>
    );
  if (s.includes("lost") || s.includes("失敗") || s.includes("close") || s.includes("結案"))
    return (
      <Badge className={`bg-red-100 text-red-700 hover:bg-red-100 border-red-200 ${base}`}>
        結案
      </Badge>
    );
  if (s.includes("pitching") || s.includes("競標") || s.includes("提案"))
    return (
      <Badge className={`bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 ${base}`}>
        提案中
      </Badge>
    );
  if (
    s.includes("enquiry") ||
    s.includes("pending") ||
    s.includes("等待") ||
    s.includes("wait") ||
    s.includes("查詢")
  )
    return (
      <Badge className={`bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200 ${base}`}>
        查詢
      </Badge>
    );
  if (s.includes("active") || s.includes("進行") || s.includes("progress"))
    return (
      <Badge className={`bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 ${base}`}>
        進行中
      </Badge>
    );
  if (s.includes("quotation") || s.includes("報價"))
    return (
      <Badge className={`bg-violet-100 text-violet-700 hover:bg-violet-100 border-violet-200 ${base}`}>
        報價中
      </Badge>
    );
  return (
    <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 ${base}`}>
      {stage}
    </Badge>
  );
}
