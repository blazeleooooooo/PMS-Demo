"use client";

// ─── REUSABLE STAFF FILTER BAR ────────────────────────────────
// Aligned chrome: 員工BU / 團隊 / 職位 / 員工 (no Status / Role dropdowns).
// Active staff listed first; Inactive at bottom with strikethrough
// (unless activeOnly — then Inactive are omitted from options + resolved IDs).
// Route locks (design→Position, team→Team, individual→Staff) apply unless
// isSuperAdmin. Parents use onResolvedIdsChange for 1A aggregation.

import React, { useEffect, useMemo, useState } from "react";
import { Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchStaffDirectory, type StaffDirectoryRow } from "@/lib/data-service";

const INACTIVE_STRIKE: React.CSSProperties = {
  textDecoration: "line-through",
  color: "#9ca3af",
};

export const POSITION_OPTIONS: {
  value: string;
  label: string;
  match: (p: string | null) => boolean;
}[] = [
  { value: "PM", label: "PM", match: (p) => p === "PM" },
  {
    value: "Designer",
    label: "Designer",
    match: (p) => p === "Designer" || p === "3D Designer",
  },
  {
    value: "PM_or_Designer",
    label: "PM / Designer",
    match: (p) => p === "PM" || p === "Designer" || p === "3D Designer",
  },
  { value: "Company", label: "Company", match: (p) => p === "Company" },
];

export interface StaffFilterState {
  /** Kept for backward compat; aligned UI always treats as "all". */
  status: string;
  bu: string;
  team: string;
  position: string;
  /** Kept for backward compat; aligned UI always treats as "all". */
  role: string;
  staffId: string;
}

export const EMPTY_STAFF_FILTERS: StaffFilterState = {
  status: "all",
  bu: "all",
  team: "all",
  position: "all",
  role: "all",
  staffId: "all",
};

export interface StaffFilterLocks {
  teamId?: string | null;
  position?: string | null;
  staffId?: string | null;
}

function passesAttributes(s: StaffDirectoryRow, f: StaffFilterState): boolean {
  if (f.bu !== "all" && s.bu_id !== f.bu) return false;
  if (f.team !== "all" && s.team_id !== f.team) return false;
  if (f.position !== "all") {
    const opt = POSITION_OPTIONS.find((o) => o.value === f.position);
    if (opt && !opt.match(s.position)) return false;
  }
  return true;
}

export function staffIdMatchesFilter(
  staffId: string | null | undefined,
  f: StaffFilterState,
  directory: StaffDirectoryRow[],
): boolean {
  const filterEmpty =
    f.bu === "all" &&
    f.team === "all" &&
    f.position === "all" &&
    f.staffId === "all";
  if (filterEmpty) return true;
  if (f.staffId !== "all") return staffId === f.staffId;
  if (!staffId) return false;
  const s = directory.find((d) => d.id === staffId);
  if (!s) return false;
  return passesAttributes(s, f);
}

/** Apply route locks into a staff filter state (no-op when Super Admin). */
export function applyStaffLocks(
  base: StaffFilterState,
  locks: StaffFilterLocks | undefined,
  isSuperAdmin: boolean,
): StaffFilterState {
  if (isSuperAdmin || !locks) return base;
  return {
    ...base,
    team: locks.teamId ? locks.teamId : base.team,
    position: locks.position ? locks.position : base.position,
    staffId: locks.staffId ? locks.staffId : base.staffId,
  };
}

interface StaffFilterBarProps {
  value: StaffFilterState;
  onChange: (next: StaffFilterState) => void;
  onDirectoryLoaded?: (rows: StaffDirectoryRow[]) => void;
  onResolvedIdsChange?: (ids: Set<string>) => void;
  clearTo?: StaffFilterState;
  /** When true, omit Inactive staff from dropdown and resolved IDs. */
  activeOnly?: boolean;
  /** Route locks; ignored when isSuperAdmin. */
  locks?: StaffFilterLocks;
  /** @deprecated Use locks.teamId */
  lockTeamId?: string | null;
  isSuperAdmin?: boolean;
  className?: string;
}

export default function StaffFilterBar({
  value,
  onChange,
  onDirectoryLoaded,
  onResolvedIdsChange,
  clearTo,
  activeOnly = false,
  locks,
  lockTeamId,
  isSuperAdmin = false,
  className,
}: StaffFilterBarProps) {
  const [directory, setDirectory] = useState<StaffDirectoryRow[]>([]);

  const effectiveLocks: StaffFilterLocks = {
    teamId: locks?.teamId ?? lockTeamId ?? null,
    position: locks?.position ?? null,
    staffId: locks?.staffId ?? null,
  };
  const enforceLocks = !isSuperAdmin;
  const lockedTeam = enforceLocks ? effectiveLocks.teamId : null;
  const lockedPosition = enforceLocks ? effectiveLocks.position : null;
  const lockedStaffId = enforceLocks ? effectiveLocks.staffId : null;

  useEffect(() => {
    let cancelled = false;
    fetchStaffDirectory().then((rows) => {
      if (cancelled) return;
      setDirectory(rows);
      onDirectoryLoaded?.(rows);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enforce locks whenever they change.
  useEffect(() => {
    if (!enforceLocks) return;
    const patch: Partial<StaffFilterState> = {};
    if (lockedTeam && value.team !== lockedTeam) patch.team = lockedTeam;
    if (lockedPosition && value.position !== lockedPosition) {
      patch.position = lockedPosition;
    }
    if (lockedStaffId && value.staffId !== lockedStaffId) {
      patch.staffId = lockedStaffId;
    }
    if (Object.keys(patch).length > 0) {
      onChange({ ...value, ...patch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enforceLocks, lockedTeam, lockedPosition, lockedStaffId]);

  const set = (patch: Partial<StaffFilterState>) => {
    const next = { ...value, ...patch, status: "all" as const, role: "all" as const };
    onChange(
      applyStaffLocks(next, effectiveLocks, isSuperAdmin),
    );
  };

  const options = useMemo(() => {
    const bu = new Map<string, string>();
    const team = new Map<string, string>();
    for (const s of directory) {
      if (s.bu_id) bu.set(s.bu_id, s.bu_name || s.bu_id);
      if (s.team_id) team.set(s.team_id, s.team_name || s.team_id);
    }
    // Keep a locked team visible in the select even before directory resolves.
    if (lockedTeam && !team.has(lockedTeam)) {
      const fromDir = directory.find((s) => s.team_id === lockedTeam);
      team.set(lockedTeam, fromDir?.team_name || lockedTeam);
    }
    const byName = (a: [string, string], b: [string, string]) =>
      a[1].localeCompare(b[1]);
    return {
      bus: Array.from(bu.entries()).sort(byName),
      teams: Array.from(team.entries()).sort(byName),
    };
  }, [directory, lockedTeam]);

  const staffOptions = useMemo(() => {
    const filtered = directory.filter((s) => passesAttributes(s, value));
    const active = filtered.filter((s) => s.status === "Active");
    const byName = (a: StaffDirectoryRow, b: StaffDirectoryRow) =>
      (a.name || "").localeCompare(b.name || "");
    if (activeOnly) return active.sort(byName);
    const inactive = filtered.filter((s) => s.status !== "Active");
    return [...active.sort(byName), ...inactive.sort(byName)];
  }, [directory, value, activeOnly]);

  useEffect(() => {
    if (lockedStaffId) return;
    if (value.staffId !== "all" && !staffOptions.some((s) => s.id === value.staffId)) {
      set({ staffId: "all" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffOptions, lockedStaffId]);

  useEffect(() => {
    if (!onResolvedIdsChange) return;
    const ids =
      value.staffId !== "all"
        ? new Set([value.staffId])
        : new Set(staffOptions.map((s) => s.id));
    onResolvedIdsChange(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffOptions, value.staffId]);

  const hasActive =
    value.bu !== "all" ||
    (!lockedTeam && value.team !== "all") ||
    (!lockedPosition && value.position !== "all") ||
    (!lockedStaffId && value.staffId !== "all");

  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 ${className ?? ""}`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-gray-500 mr-1">
          <Users className="w-4 h-4" />
          <span className="text-[13px] font-medium">員工篩選</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-medium">員工BU</span>
          <Select value={value.bu} onValueChange={(v) => set({ bu: v })}>
            <SelectTrigger className="w-[150px] h-9 text-[14px] bg-white">
              <SelectValue placeholder="員工BU" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有BU</SelectItem>
              {options.bus.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Always shown. /team-reports locks this to the user's team (disabled
            unless Super Admin). */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-medium">
            團隊
            {lockedTeam ? (
              <span className="ml-1 text-amber-500 font-normal">（已鎖定）</span>
            ) : null}
          </span>
          <Select
            value={value.team}
            onValueChange={(v) => set({ team: v })}
            disabled={!!lockedTeam}
          >
            <SelectTrigger
              className={`w-[150px] h-9 text-[14px] bg-white ${
                lockedTeam ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              <SelectValue placeholder="團隊" />
            </SelectTrigger>
            <SelectContent>
              {!lockedTeam && <SelectItem value="all">所有團隊</SelectItem>}
              {options.teams.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Always shown. /design-reports locks Position → Designer (unless Super Admin). */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-medium">
            職位
            {lockedPosition ? (
              <span className="ml-1 text-amber-500 font-normal">（已鎖定）</span>
            ) : null}
          </span>
          <Select
            value={value.position}
            onValueChange={(v) => set({ position: v })}
            disabled={!!lockedPosition}
          >
            <SelectTrigger
              className={`w-[130px] h-9 text-[14px] bg-white ${
                lockedPosition ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              <SelectValue placeholder="職位" />
            </SelectTrigger>
            <SelectContent>
              {!lockedPosition && (
                <SelectItem value="all">所有職位</SelectItem>
              )}
              {POSITION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Always shown. Future /individual-reports locks to current staff. */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] text-gray-400 font-medium">
            員工 <span className="text-gray-300">({staffOptions.length})</span>
            {lockedStaffId ? (
              <span className="ml-1 text-amber-500 font-normal">（已鎖定）</span>
            ) : null}
          </span>
          <Select
            value={value.staffId}
            onValueChange={(v) => set({ staffId: v })}
            disabled={!!lockedStaffId}
          >
            <SelectTrigger
              className={`w-[170px] h-9 text-[14px] bg-white ${
                lockedStaffId ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              <SelectValue placeholder="員工" />
            </SelectTrigger>
            <SelectContent>
              {!lockedStaffId && (
                <SelectItem value="all">所有員工</SelectItem>
              )}
              {staffOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span
                    style={
                      s.status !== "Active" ? INACTIVE_STRIKE : undefined
                    }
                  >
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const base = clearTo ?? EMPTY_STAFF_FILTERS;
              onChange(applyStaffLocks(base, effectiveLocks, isSuperAdmin));
            }}
            className="h-9 gap-1 text-[14px] text-red-500 hover:text-red-600 hover:bg-red-50 self-end"
          >
            <X className="w-3.5 h-3.5" /> 清除
          </Button>
        )}
      </div>
    </div>
  );
}
