"use client";

// Footer line under reports that use the shared date-range pills.
// States which date field the selected period is applied to.

import React from "react";

export default function ReportDateRangeNote({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="text-sm text-gray-400 text-center">
      {children}
    </p>
  );
}
