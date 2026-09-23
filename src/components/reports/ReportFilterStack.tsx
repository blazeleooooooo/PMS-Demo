"use client";

// ─── REPORT FILTER STACK ──────────────────────────────────────
// Date + BWA/BWF → (optional L2/L3) → Project filters → Staff filters.
// Used by /business-reports, /design-reports, /team-reports.
// Staff locks come from useReportStaffLock(scope); Super Admin bypasses them.

import React from "react";
import ReportDateRangeBar, {
  ReportSourceToggle,
} from "@/components/reports/ReportDateRangeBar";
import ProjectFilterBar, {
  type ProjectFilterFields,
  type ProjectFilterState,
} from "@/components/reports/ProjectFilterBar";
import StaffFilterBar, {
  type StaffFilterLocks,
  type StaffFilterState,
} from "@/components/reports/StaffFilterBar";
import MoneyBasisToggle, {
  type MoneyBasis,
} from "@/components/reports/MoneyBasisToggle";
import type { StaffDirectoryRow } from "@/lib/data-service";

export interface ReportFilterStackProps {
  showDate?: boolean;
  sourceMode?: "single" | "multi";
  showSourceToggle?: boolean;

  showL2L3?: boolean;
  moneyBasis?: MoneyBasis;
  onMoneyBasisChange?: (next: MoneyBasis) => void;

  showProject?: boolean;
  projectRows?: ProjectFilterFields[];
  projectFilter?: ProjectFilterState;
  onProjectFilterChange?: (next: ProjectFilterState) => void;

  showStaff?: boolean;
  staffFilter?: StaffFilterState;
  onStaffFilterChange?: (next: StaffFilterState) => void;
  staffLocks?: StaffFilterLocks;
  staffClearTo?: StaffFilterState;
  isSuperAdmin?: boolean;
  onStaffDirectoryLoaded?: (rows: StaffDirectoryRow[]) => void;
  onStaffResolvedIdsChange?: (ids: Set<string>) => void;

  /** Extra row under the date bar (e.g. AP-RP date-target pills). */
  afterDate?: React.ReactNode;

  className?: string;
}

export default function ReportFilterStack({
  showDate = true,
  sourceMode = "single",
  showSourceToggle = true,
  showL2L3 = false,
  moneyBasis = "l2",
  onMoneyBasisChange,
  showProject = true,
  projectRows = [],
  projectFilter,
  onProjectFilterChange,
  showStaff = true,
  staffFilter,
  onStaffFilterChange,
  staffLocks,
  staffClearTo,
  isSuperAdmin = false,
  onStaffDirectoryLoaded,
  onStaffResolvedIdsChange,
  afterDate,
  className,
}: ReportFilterStackProps) {
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {showDate ? (
        <ReportDateRangeBar
          sourceMode={sourceMode}
          showSourceToggle={showSourceToggle}
        />
      ) : (
        showSourceToggle && (
          <div className="flex items-center gap-2">
            <ReportSourceToggle mode={sourceMode} />
          </div>
        )
      )}

      {afterDate}

      {showL2L3 && onMoneyBasisChange && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-gray-400 font-medium">金額基準</span>
          <MoneyBasisToggle value={moneyBasis} onChange={onMoneyBasisChange} />
        </div>
      )}

      {showProject && projectFilter && onProjectFilterChange && (
        <ProjectFilterBar
          projects={projectRows}
          value={projectFilter}
          onChange={onProjectFilterChange}
        />
      )}

      {showStaff && staffFilter && onStaffFilterChange && (
        <StaffFilterBar
          value={staffFilter}
          onChange={onStaffFilterChange}
          locks={staffLocks}
          clearTo={staffClearTo}
          isSuperAdmin={isSuperAdmin}
          onDirectoryLoaded={onStaffDirectoryLoaded}
          onResolvedIdsChange={onStaffResolvedIdsChange}
        />
      )}
    </div>
  );
}
