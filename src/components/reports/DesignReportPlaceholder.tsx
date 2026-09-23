"use client";

import React from "react";

interface DesignReportPlaceholderProps {
  title: string;
  titleEn: string;
  description?: string;
}

/** Placeholder shell for design-management reports not yet implemented. */
export default function DesignReportPlaceholder({
  title,
  titleEn,
  description = "此報表功能即將推出。",
}: DesignReportPlaceholderProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-gray-900">
        {title}{" "}
        <span className="text-base font-normal text-gray-400">{titleEn}</span>
      </h1>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
