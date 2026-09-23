"use client";

import React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import * as Icons from "lucide-react";
import { getSettingsGroupHeader } from "@/lib/mock-data";

/**
 * Shared settings page header: `{top-nav group}設定` + English subtitle.
 * Icon follows the active settings sub-tab when available.
 */
export default function SettingsGroupHeader({
  icon: iconOverride,
}: {
  /** Optional lucide icon name override (defaults to active settings item). */
  icon?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const header = getSettingsGroupHeader(pathname, searchParams.toString());
  const iconName = iconOverride || header.icon;
  const Icon = ((Icons as Record<string, unknown>)[iconName] ?? Icons.Settings) as React.ElementType;

  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-bw-blue/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-bw-blue" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900">{header.titleZh}</h1>
        <p className="text-sm text-gray-500">{header.titleEn}</p>
      </div>
    </div>
  );
}
