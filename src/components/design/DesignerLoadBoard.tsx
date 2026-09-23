"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  User,
  Users,
  ChevronDown,
  ChevronRight,
  Briefcase,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  fetchDesignerLoadBoard,
  designerLoadJobHref,
  DESIGNER_LOAD_DEFAULT_TEAM_DISPLAYS,
  DESIGNER_LOAD_TEAM_FILTER_DESIGN_3D,
  type DesignerLoadJob,
  type DesignerLoadStaff,
  type DesignerLoadTeamOption,
} from "@/lib/data-service";
import {
  fetchDesignerLoadJobTasks,
  fetchDesignerLoadStaffJobTasks,
  type DesignerLoadJobTaskRow,
  type DeliverablesData,
} from "@/lib/man-hour-service";
import { parseTaskAttachments } from "@/lib/attachment-utils";
import { AttachmentThumbnail } from "@/components/ui/attachment-thumbnail";

/** Same position matching rules as StaffFilterBar / project-manhour-analysis. */
const POSITION_OPTIONS: {
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

// ─── HELPERS ────────────────────────────────────────────────

function toDay(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function todayLocal(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fmtDate(v: string | null): string {
  const d = toDay(v);
  if (!d) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function fmtHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtDeliverables(d: DeliverablesData | null | undefined): string {
  if (!d?.type && (d?.count == null || d.count <= 0)) return "—";
  const parts: string[] = [];
  if (d.type) parts.push(d.type);
  if (d.count != null && d.count > 0) parts.push(`×${d.count}`);
  if (d.stage) parts.push(d.stage);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function deliverablesCount(d: DeliverablesData | null | undefined): number {
  return d?.count != null && d.count > 0 ? d.count : 0;
}

function jobExpandKey(staffId: string, job: DesignerLoadJob): string {
  return `${staffId}:${job.job_type}:${job.id}`;
}

const DAY_MS = 1000 * 60 * 60 * 24;

// Start-date threshold for project design load (enquiry → start window).
// "hide" → drop projects whose start_date is before today.
// number → allow projects started up to N days before today.
// "all"  → keep already-started WIP projects too.
type StartFilter = "hide" | 30 | 60 | 90 | 120 | 150 | 180 | "all";

const START_OPTIONS: { value: string; label: string }[] = [
  { value: "hide", label: "隱藏已開工" },
  { value: "30", label: "已開工 30 天內" },
  { value: "60", label: "已開工 60 天內" },
  { value: "90", label: "已開工 90 天內" },
  { value: "120", label: "已開工 120 天內" },
  { value: "150", label: "已開工 150 天內" },
  { value: "180", label: "已開工 180 天內" },
  { value: "all", label: "所有 WIP（含已開工）" },
];

function parseStartFilter(value: string): StartFilter {
  if (value === "hide" || value === "all") return value;
  return Number(value) as StartFilter;
}

/** Pitchings always count; projects apply start_date threshold vs today. */
function passesStartFilter(
  job: DesignerLoadJob,
  filter: StartFilter,
  today: Date
): boolean {
  if (job.kind !== "project") return true;
  const start = toDay(job.start_date);
  if (!start) return true; // no start date → still treat as pre-start design load
  const daysAfterStart = Math.floor(
    (today.getTime() - start.getTime()) / DAY_MS
  );
  if (daysAfterStart <= 0) return true; // not yet started (or starts today)
  if (filter === "hide") return false;
  if (filter === "all") return true;
  return daysAfterStart <= filter;
}

const JOB_TYPE_META: Record<
  DesignerLoadJob["job_type"],
  { short: string; badgeClass: string }
> = {
  bwa_pitching: {
    short: "BWA 提案",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  bwa_project: {
    short: "BWA 項目",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  bwf_pitching: {
    short: "BWF 提案",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
  },
  bwf_project: {
    short: "BWF 項目",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

type LoadBand = "idle" | "light" | "busy" | "heavy";

/** Load bands: 空閒 0 · 輕鬆 1–15 · 繁忙 16–24 · 過載 ≥25 (15/25 boundaries non-overlapping). */
function loadBand(total: number): LoadBand {
  if (total <= 0) return "idle";
  if (total <= 15) return "light";
  if (total < 25) return "busy";
  return "heavy";
}

function loadBandMeta(band: LoadBand): {
  label: string;
  className: string;
  barClass: string;
} {
  switch (band) {
    case "idle":
      return {
        label: "空閒",
        className: "bg-gray-50 text-gray-600 border-gray-200",
        barClass: "bg-gray-300",
      };
    case "light":
      return {
        label: "輕鬆",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        barClass: "bg-emerald-500",
      };
    case "busy":
      return {
        label: "繁忙",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        barClass: "bg-amber-500",
      };
    case "heavy":
      return {
        label: "過載",
        className: "bg-red-50 text-red-700 border-red-200",
        barClass: "bg-red-500",
      };
  }
}

/** Timeline progress for projects with enquiry→start; null for pitchings / missing dates. */
function projectProgress(
  job: DesignerLoadJob,
  today: Date
): { progress: number; daysAfterStart: number } | null {
  if (job.kind !== "project") return null;
  const enquiry = toDay(job.enquiry_date);
  const start = toDay(job.start_date);
  if (!enquiry || !start) return null;
  const span = start.getTime() - enquiry.getTime();
  let progress: number;
  if (span <= 0) {
    progress = today.getTime() >= start.getTime() ? 100 : 0;
  } else {
    progress = ((today.getTime() - enquiry.getTime()) / span) * 100;
    progress = Math.max(0, Math.min(100, progress));
  }
  const daysAfterStart = Math.floor(
    (today.getTime() - start.getTime()) / DAY_MS
  );
  return { progress: Math.round(progress), daysAfterStart };
}

type SortCol =
  | "staff_name"
  | "pitching_count"
  | "project_count"
  | "total_count"
  | "bwa_count"
  | "bwf_count";

type SortDir = "asc" | "desc";

interface DesignerGroup {
  staff: DesignerLoadStaff;
  jobs: DesignerLoadJob[];
  pitching_count: number;
  project_count: number;
  bwa_count: number;
  bwf_count: number;
  total_count: number;
  band: LoadBand;
}

// ─── COMPONENT ──────────────────────────────────────────────

export default function DesignerLoadBoard() {
  const [staff, setStaff] = useState<DesignerLoadStaff[]>([]);
  const [jobs, setJobs] = useState<DesignerLoadJob[]>([]);
  const [teams, setTeams] = useState<DesignerLoadTeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Default: hide WIP projects already past start_date. */
  const [startFilter, setStartFilter] = useState<string>("hide");
  /** Default Designer (includes 3D Designer). */
  const [positionFilter, setPositionFilter] = useState("Designer");
  /** Default: Design + 3D Render teams. */
  const [teamFilter, setTeamFilter] = useState<string>(
    DESIGNER_LOAD_TEAM_FILTER_DESIGN_3D
  );
  const [sourceFilter, setSourceFilter] = useState<"all" | "bwa" | "bwf">("all");
  const [kindFilter, setKindFilter] = useState<"all" | "pitching" | "project">(
    "all"
  );

  const [sortCol, setSortCol] = useState<SortCol>("total_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  /** Explicit true = job task list expanded. */
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
  const [jobTasks, setJobTasks] = useState<
    Record<string, DesignerLoadJobTaskRow[]>
  >({});
  const [jobTasksLoading, setJobTasksLoading] = useState<
    Record<string, boolean>
  >({});
  const [jobTasksError, setJobTasksError] = useState<Record<string, string>>(
    {}
  );
  /** Staff-level batch load for job-row 成果數 / 工時 sums. */
  const [staffTasksLoading, setStaffTasksLoading] = useState<
    Record<string, boolean>
  >({});
  const staffTasksInFlight = useRef<Set<string>>(new Set());

  async function ensureStaffJobTasks(
    staffId: string,
    staffJobs: DesignerLoadJob[]
  ) {
    if (staffJobs.length === 0) return;
    if (staffTasksInFlight.current.has(staffId)) return;

    let missing: DesignerLoadJob[] = [];
    setJobTasks((current) => {
      missing = staffJobs.filter(
        (j) => current[jobExpandKey(staffId, j)] === undefined
      );
      return current;
    });
    if (missing.length === 0) return;

    staffTasksInFlight.current.add(staffId);
    setStaffTasksLoading((prev) => ({ ...prev, [staffId]: true }));
    for (const j of missing) {
      const key = jobExpandKey(staffId, j);
      setJobTasksLoading((prev) => ({ ...prev, [key]: true }));
    }

    try {
      const byJob = await fetchDesignerLoadStaffJobTasks(
        staffId,
        missing.map((j) => ({ id: j.id, job_type: j.job_type }))
      );
      setJobTasks((prev) => {
        const next = { ...prev };
        for (const j of missing) {
          const shortKey = `${j.job_type}:${j.id}`;
          next[jobExpandKey(staffId, j)] = byJob[shortKey] || [];
        }
        return next;
      });
      setJobTasksError((prev) => {
        const next = { ...prev };
        for (const j of missing) {
          delete next[jobExpandKey(staffId, j)];
        }
        return next;
      });
    } catch (e: any) {
      const msg = e?.message || "載入工時失敗";
      setJobTasks((prev) => {
        const next = { ...prev };
        for (const j of missing) {
          const key = jobExpandKey(staffId, j);
          if (next[key] === undefined) next[key] = [];
        }
        return next;
      });
      setJobTasksError((prev) => {
        const next = { ...prev };
        for (const j of missing) {
          next[jobExpandKey(staffId, j)] = msg;
        }
        return next;
      });
    } finally {
      staffTasksInFlight.current.delete(staffId);
      setStaffTasksLoading((prev) => ({ ...prev, [staffId]: false }));
      setJobTasksLoading((prev) => {
        const next = { ...prev };
        for (const j of missing) {
          next[jobExpandKey(staffId, j)] = false;
        }
        return next;
      });
    }
  }

  async function toggleJobTasks(staffId: string, job: DesignerLoadJob) {
    const key = jobExpandKey(staffId, job);
    const willOpen = !expandedJobs[key];
    setExpandedJobs((prev) => ({ ...prev, [key]: willOpen }));
    if (!willOpen) return;
    if (jobTasks[key] !== undefined || jobTasksLoading[key]) return;

    setJobTasksLoading((prev) => ({ ...prev, [key]: true }));
    setJobTasksError((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      const rows = await fetchDesignerLoadJobTasks(
        staffId,
        job.id,
        job.job_type
      );
      setJobTasks((prev) => ({ ...prev, [key]: rows }));
    } catch (e: any) {
      setJobTasksError((prev) => ({
        ...prev,
        [key]: e?.message || "載入工時失敗",
      }));
      setJobTasks((prev) => ({ ...prev, [key]: [] }));
    } finally {
      setJobTasksLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  function toggleStaffCollapsed(staffId: string, staffJobs: DesignerLoadJob[]) {
    setCollapsed((prev) => {
      const currentlyExpanded = prev[staffId] === false;
      const nextCollapsed = currentlyExpanded ? true : false;
      if (!currentlyExpanded) {
        void ensureStaffJobTasks(staffId, staffJobs);
      }
      return { ...prev, [staffId]: nextCollapsed };
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDesignerLoadBoard();
        if (cancelled) return;
        setStaff(data.staff);
        setJobs(data.jobs);
        setTeams(data.teams);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "載入失敗");
          setStaff([]);
          setJobs([]);
          setTeams([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = useMemo(() => todayLocal(), []);
  const startThreshold = useMemo(
    () => parseStartFilter(startFilter),
    [startFilter]
  );

  const defaultTeamIds = useMemo(() => {
    const wanted = new Set<string>(DESIGNER_LOAD_DEFAULT_TEAM_DISPLAYS);
    return new Set(
      teams.filter((t) => wanted.has(t.display)).map((t) => t.id)
    );
  }, [teams]);

  const groups = useMemo(() => {
    const posOpt = POSITION_OPTIONS.find((o) => o.value === positionFilter);
    const filteredStaff = staff.filter((s) => {
      if (s.status !== "Active") return false;
      if (positionFilter !== "all" && posOpt && !posOpt.match(s.position)) {
        return false;
      }
      if (teamFilter === "all") {
        // keep
      } else if (teamFilter === DESIGNER_LOAD_TEAM_FILTER_DESIGN_3D) {
        if (!s.team_id || !defaultTeamIds.has(s.team_id)) return false;
      } else if (s.team_id !== teamFilter) {
        return false;
      }
      return true;
    });

    const filteredJobs = jobs.filter((j) => {
      if (sourceFilter !== "all" && j.source !== sourceFilter) return false;
      if (kindFilter !== "all" && j.kind !== kindFilter) return false;
      if (!passesStartFilter(j, startThreshold, today)) return false;
      return true;
    });

    const byStaff = new Map<string, DesignerLoadJob[]>();
    for (const j of filteredJobs) {
      const list = byStaff.get(j.designer_id) || [];
      list.push(j);
      byStaff.set(j.designer_id, list);
    }

    const result: DesignerGroup[] = filteredStaff.map((s) => {
      const list = byStaff.get(s.staff_id) || [];
      list.sort((a, b) => {
        const ta = toDay(a.enquiry_date || a.start_date)?.getTime() || 0;
        const tb = toDay(b.enquiry_date || b.start_date)?.getTime() || 0;
        return tb - ta;
      });
      const pitching_count = list.filter((j) => j.kind === "pitching").length;
      const project_count = list.filter((j) => j.kind === "project").length;
      const bwa_count = list.filter((j) => j.source === "bwa").length;
      const bwf_count = list.filter((j) => j.source === "bwf").length;
      const total_count = list.length;
      return {
        staff: s,
        jobs: list,
        pitching_count,
        project_count,
        bwa_count,
        bwf_count,
        total_count,
        band: loadBand(total_count),
      };
    });

    const visible = result;

    visible.sort((a, b) => {
      const av =
        sortCol === "staff_name"
          ? a.staff.staff_name.toLowerCase()
          : a[sortCol];
      const bv =
        sortCol === "staff_name"
          ? b.staff.staff_name.toLowerCase()
          : b[sortCol];
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return a.staff.staff_name.localeCompare(b.staff.staff_name);
    });

    return visible;
  }, [
    staff,
    jobs,
    positionFilter,
    teamFilter,
    defaultTeamIds,
    sourceFilter,
    kindFilter,
    startThreshold,
    today,
    sortCol,
    sortDir,
  ]);

  const summary = useMemo(() => {
    const totalJobs = groups.reduce((s, g) => s + g.total_count, 0);
    const overloaded = groups.filter((g) => g.band === "heavy").length;
    const idle = groups.filter((g) => g.band === "idle").length;
    const pitchings = groups.reduce((s, g) => s + g.pitching_count, 0);
    const projects = groups.reduce((s, g) => s + g.project_count, 0);
    return { totalJobs, overloaded, idle, pitchings, projects };
  }, [groups]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "staff_name" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) {
      return <ArrowUpDown className="w-3 h-3 ml-1 inline text-gray-300" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1 inline text-bw-blue" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 inline text-bw-blue" />
    );
  }

  // Prefetch man-hour sums for any expanded staff (incl. after filter changes).
  useEffect(() => {
    for (const g of groups) {
      if (collapsed[g.staff.staff_id] === false) {
        void ensureStaffJobTasks(g.staff.staff_id, g.jobs);
      }
    }
    // ensureStaffJobTasks is stable enough via refs; omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, collapsed]);

  // Default: collapsed (missing key). Explicit false = expanded.
  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of groups) {
      next[g.staff.staff_id] = false;
      void ensureStaffJobTasks(g.staff.staff_id, g.jobs);
    }
    setCollapsed(next);
  };
  const handleCollapseAll = () => setCollapsed({});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
        <span className="ml-3 text-gray-500">載入設計師負載資料...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          設計師負載 Designer Load
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-4xl">
          以提案／項目的 <span className="font-medium text-gray-700">BV Handler（協作者）</span>
          計算當前工作負載——同一工作可計入多名協作者；不是 Main Designer
          單欄，也不是工時匯報。提案僅計階段 Enquiry / Pitching（不含 Case
          Closed、Confirmed Project）；項目僅計狀態 Work In
          Progress，進度以查詢日期→開工日期計算，可再以開工篩選排除已開工。Company
          BV 列不計入。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="text-gray-400">負載標籤：</span>
          {(
            [
              ["idle", "空閒 = 0 件"],
              ["light", "輕鬆 = 1–15 件"],
              ["busy", "繁忙 = 15–25 件"],
              ["heavy", "過載 = ≥25 件"],
            ] as const
          ).map(([band, text]) => {
            const meta = loadBandMeta(band);
            return (
              <Badge
                key={band}
                variant="outline"
                className={`text-[10px] font-normal ${meta.className}`}
              >
                {text}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "設計師", value: groups.length },
          { label: "進行中提案", value: summary.pitchings },
          { label: "進行中項目", value: summary.projects },
          { label: "過載 (≥25)", value: summary.overloaded },
          { label: "空閒", value: summary.idle },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm"
          >
            <div className="text-xs text-gray-500">{card.label}</div>
            <div className="text-xl font-semibold text-gray-900 mt-0.5 tabular-nums">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              團隊 Team
            </label>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-9 text-sm w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DESIGNER_LOAD_TEAM_FILTER_DESIGN_3D}>
                  3D Render + Design
                </SelectItem>
                <SelectItem value="all">所有團隊</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              職位 Position
            </label>
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="h-9 text-sm w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有職位</SelectItem>
                {POSITION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">
              開工後篩選 Start filter
            </label>
            <Select value={startFilter} onValueChange={setStartFilter}>
              <SelectTrigger className="h-9 text-sm w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {START_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">來源 Source</label>
            <Select
              value={sourceFilter}
              onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}
            >
              <SelectTrigger className="h-9 text-sm w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="bwa">BWA</SelectItem>
                <SelectItem value="bwf">BWF</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              類型 Kind
            </label>
            <Select
              value={kindFilter}
              onValueChange={(v) => setKindFilter(v as typeof kindFilter)}
            >
              <SelectTrigger className="h-9 text-sm w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">提案 + 項目</SelectItem>
                <SelectItem value="pitching">僅提案</SelectItem>
                <SelectItem value="project">僅項目</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-4 text-sm text-gray-500">
            {groups.length > 0 && (
              <div className="flex items-center gap-2 border-r border-gray-200 pr-4 mr-2">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="text-xs font-medium text-gray-600 hover:text-bw-blue transition-colors px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 shadow-sm"
                >
                  全部展開
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="text-xs font-medium text-gray-600 hover:text-bw-blue transition-colors px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 shadow-sm"
                >
                  全部摺疊
                </button>
              </div>
            )}
            <span>
              <span className="font-semibold text-gray-800">
                {summary.totalJobs}
              </span>{" "}
              個進行中工作
            </span>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {groups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg py-20 text-center text-gray-400 shadow-sm">
          沒有符合條件的設計師負載資料
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="table-fixed min-w-[900px] w-full">
              <TableHeader>
                <TableRow className="bg-gray-50/75 hover:bg-gray-50/75 border-b border-gray-200">
                  <TableHead className="w-[36px]" />
                  <TableHead
                    className="w-[200px] font-semibold text-gray-700 text-xs cursor-pointer select-none"
                    onClick={() => toggleSort("staff_name")}
                  >
                    設計師 <SortIcon col="staff_name" />
                  </TableHead>
                  <TableHead className="w-[110px] font-semibold text-gray-700 text-xs">
                    職位
                  </TableHead>
                  <TableHead className="w-[72px] font-semibold text-gray-700 text-xs">
                    負載
                  </TableHead>
                  <TableHead
                    className="w-[72px] text-right font-semibold text-sky-700 text-xs cursor-pointer select-none"
                    onClick={() => toggleSort("pitching_count")}
                  >
                    提案 <SortIcon col="pitching_count" />
                  </TableHead>
                  <TableHead
                    className="w-[72px] text-right font-semibold text-blue-700 text-xs cursor-pointer select-none"
                    onClick={() => toggleSort("project_count")}
                  >
                    項目 <SortIcon col="project_count" />
                  </TableHead>
                  <TableHead
                    className="w-[64px] text-right font-semibold text-gray-600 text-xs cursor-pointer select-none"
                    onClick={() => toggleSort("bwa_count")}
                  >
                    BWA <SortIcon col="bwa_count" />
                  </TableHead>
                  <TableHead
                    className="w-[64px] text-right font-semibold text-gray-600 text-xs cursor-pointer select-none"
                    onClick={() => toggleSort("bwf_count")}
                  >
                    BWF <SortIcon col="bwf_count" />
                  </TableHead>
                  <TableHead
                    className="w-[72px] text-right font-semibold text-gray-800 text-xs cursor-pointer select-none"
                    onClick={() => toggleSort("total_count")}
                  >
                    合計 <SortIcon col="total_count" />
                  </TableHead>
                  <TableHead className="w-[160px] font-semibold text-gray-700 text-xs">
                    負載條
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => {
                  const isCollapsed = collapsed[g.staff.staff_id] !== false;
                  const band = loadBandMeta(g.band);
                  const barWidth = Math.min(100, (g.total_count / 25) * 100);
                  return (
                    <React.Fragment key={g.staff.staff_id}>
                      <TableRow
                        className="bg-gray-50/40 hover:bg-gray-50/60 cursor-pointer transition-colors border-b border-gray-100"
                        onClick={() =>
                          toggleStaffCollapsed(g.staff.staff_id, g.jobs)
                        }
                      >
                        <TableCell className="p-3 text-center">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-gray-400 mx-auto" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="p-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <User className="w-4 h-4 text-bw-blue flex-shrink-0" />
                            <span
                              className="font-semibold text-gray-800 text-sm truncate"
                              title={g.staff.staff_name}
                            >
                              {g.staff.staff_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="p-3 text-xs text-gray-600 truncate">
                          {g.staff.position || "—"}
                        </TableCell>
                        <TableCell className="p-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${band.className}`}
                          >
                            {band.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-3 text-right font-mono text-sm text-sky-700 tabular-nums">
                          {g.pitching_count}
                        </TableCell>
                        <TableCell className="p-3 text-right font-mono text-sm text-blue-700 tabular-nums">
                          {g.project_count}
                        </TableCell>
                        <TableCell className="p-3 text-right font-mono text-sm text-gray-700 tabular-nums">
                          {g.bwa_count}
                        </TableCell>
                        <TableCell className="p-3 text-right font-mono text-sm text-gray-700 tabular-nums">
                          {g.bwf_count}
                        </TableCell>
                        <TableCell className="p-3 text-right font-mono text-sm font-semibold text-gray-900 tabular-nums">
                          {g.total_count}
                        </TableCell>
                        <TableCell className="p-3">
                          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${band.barClass}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>

                      {!isCollapsed && (
                        <TableRow className="hover:bg-transparent border-b border-gray-200">
                          <TableCell colSpan={10} className="p-0 bg-slate-50/40">
                            <div className="px-3 py-3 pl-10">
                              {g.jobs.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">
                                  目前沒有進行中的提案或項目
                                </p>
                              ) : (
                                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-gray-200">
                                        <TableHead className="w-[36px]" />
                                        <TableHead className="w-[100px] font-semibold text-gray-600 text-[11px]">
                                          類型
                                        </TableHead>
                                        <TableHead className="w-[120px] font-semibold text-gray-600 text-[11px]">
                                          代號
                                        </TableHead>
                                        <TableHead className="min-w-[180px] font-semibold text-gray-600 text-[11px]">
                                          名稱
                                        </TableHead>
                                        <TableHead className="w-[140px] font-semibold text-gray-600 text-[11px]">
                                          階段 / 狀態
                                        </TableHead>
                                        <TableHead className="w-[100px] font-semibold text-gray-600 text-[11px]">
                                          查詢日期
                                        </TableHead>
                                        <TableHead className="w-[100px] font-semibold text-gray-600 text-[11px]">
                                          開工
                                        </TableHead>
                                        <TableHead className="w-[120px] font-semibold text-gray-600 text-[11px]">
                                          PM
                                        </TableHead>
                                        <TableHead className="w-[72px] text-right font-semibold text-gray-600 text-[11px]">
                                          成果數
                                        </TableHead>
                                        <TableHead className="w-[72px] text-right font-semibold text-gray-600 text-[11px]">
                                          工時
                                        </TableHead>
                                        <TableHead className="min-w-[120px] font-semibold text-gray-600 text-[11px]">
                                          進度
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {g.jobs.map((job) => {
                                        const meta = JOB_TYPE_META[job.job_type];
                                        const prog = projectProgress(job, today);
                                        const jKey = jobExpandKey(
                                          g.staff.staff_id,
                                          job
                                        );
                                        const jobOpen = !!expandedJobs[jKey];
                                        const tasks = jobTasks[jKey];
                                        const tasksLoading =
                                          !!jobTasksLoading[jKey] ||
                                          !!staffTasksLoading[g.staff.staff_id];
                                        const tasksErr = jobTasksError[jKey];
                                        const tasksReady = tasks !== undefined;
                                        const taskHours =
                                          tasks?.reduce(
                                            (sum, t) => sum + t.work_hour,
                                            0
                                          ) ?? 0;
                                        const taskDeliverables =
                                          tasks?.reduce(
                                            (sum, t) =>
                                              sum +
                                              deliverablesCount(t.deliverables),
                                            0
                                          ) ?? 0;
                                        return (
                                          <React.Fragment key={jKey}>
                                            <TableRow
                                              className="border-b border-gray-100 cursor-pointer hover:bg-slate-50/80"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void toggleJobTasks(
                                                  g.staff.staff_id,
                                                  job
                                                );
                                              }}
                                            >
                                              <TableCell className="py-2 text-center">
                                                {jobOpen ? (
                                                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 mx-auto" />
                                                ) : (
                                                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 mx-auto" />
                                                )}
                                              </TableCell>
                                              <TableCell className="py-2">
                                                <Badge
                                                  variant="outline"
                                                  className={`text-[10px] ${meta.badgeClass}`}
                                                >
                                                  {meta.short}
                                                </Badge>
                                              </TableCell>
                                              <TableCell className="py-2 text-xs font-mono text-gray-700">
                                                <Link
                                                  href={designerLoadJobHref(job)}
                                                  className="text-bw-blue hover:underline"
                                                  onClick={(e) =>
                                                    e.stopPropagation()
                                                  }
                                                >
                                                  {job.code || "—"}
                                                </Link>
                                              </TableCell>
                                              <TableCell className="py-2 text-xs text-gray-800">
                                                <div
                                                  className="truncate max-w-[280px]"
                                                  title={job.name || ""}
                                                >
                                                  {job.name || "—"}
                                                </div>
                                                {job.customer_name && (
                                                  <div className="text-[10px] text-gray-400 truncate">
                                                    {job.customer_name}
                                                  </div>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-2 text-xs text-gray-600">
                                                {job.status_or_stage || "—"}
                                              </TableCell>
                                              <TableCell className="py-2 text-xs text-gray-600 tabular-nums">
                                                {fmtDate(job.enquiry_date)}
                                              </TableCell>
                                              <TableCell className="py-2 text-xs text-gray-600 tabular-nums">
                                                {fmtDate(job.start_date)}
                                              </TableCell>
                                              <TableCell className="py-2 text-xs text-gray-600">
                                                {job.pm_name || "—"}
                                              </TableCell>
                                              <TableCell className="py-2 text-right font-mono text-xs tabular-nums text-gray-800">
                                                {!tasksReady ? (
                                                  <Loader2 className="w-3 h-3 animate-spin text-gray-400 ml-auto" />
                                                ) : taskDeliverables > 0 ? (
                                                  taskDeliverables
                                                ) : (
                                                  <span className="text-gray-300">
                                                    —
                                                  </span>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-2 text-right font-mono text-xs tabular-nums text-gray-800">
                                                {!tasksReady ? (
                                                  <Loader2 className="w-3 h-3 animate-spin text-gray-400 ml-auto" />
                                                ) : taskHours > 0 ? (
                                                  `${fmtHours(
                                                    Math.round(taskHours * 10) /
                                                      10
                                                  )}h`
                                                ) : (
                                                  <span className="text-gray-300">
                                                    —
                                                  </span>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-2">
                                                {prog ? (
                                                  <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                      <div
                                                        className={`h-full rounded-full ${
                                                          prog.daysAfterStart > 0
                                                            ? "bg-gray-400"
                                                            : prog.progress >= 90
                                                              ? "bg-red-500"
                                                              : prog.progress >=
                                                                  60
                                                                ? "bg-amber-500"
                                                                : "bg-emerald-500"
                                                        }`}
                                                        style={{
                                                          width: `${prog.progress}%`,
                                                        }}
                                                      />
                                                    </div>
                                                    <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right">
                                                      {prog.progress}%
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <span className="text-[10px] text-gray-300">
                                                    —
                                                  </span>
                                                )}
                                              </TableCell>
                                            </TableRow>

                                            {jobOpen && (
                                              <TableRow className="hover:bg-transparent border-b border-gray-100">
                                                <TableCell
                                                  colSpan={11}
                                                  className="p-0 bg-slate-50/60"
                                                >
                                                  <div className="px-3 py-2.5 pl-12">
                                                    {tasksLoading ? (
                                                      <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        載入工時匯報...
                                                      </div>
                                                    ) : tasksErr ? (
                                                      <p className="text-xs text-red-600 py-2">
                                                        {tasksErr}
                                                      </p>
                                                    ) : !tasks ||
                                                      tasks.length === 0 ? (
                                                      <p className="text-xs text-gray-400 py-2">
                                                        此員工尚未匯報此提案／項目的工時
                                                      </p>
                                                    ) : (
                                                      <div className="space-y-2">
                                                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                                                          <span>
                                                            {tasks.length}{" "}
                                                            筆匯報
                                                          </span>
                                                          <span>
                                                            工時合計{" "}
                                                            <span className="font-semibold text-gray-800 tabular-nums">
                                                              {fmtHours(
                                                                Math.round(
                                                                  taskHours * 10
                                                                ) / 10
                                                              )}
                                                              h
                                                            </span>
                                                          </span>
                                                          <span>
                                                            成果合計{" "}
                                                            <span className="font-semibold text-gray-800 tabular-nums">
                                                              {taskDeliverables}
                                                            </span>
                                                          </span>
                                                        </div>
                                                        <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
                                                          <Table>
                                                            <TableHeader>
                                                              <TableRow className="bg-white hover:bg-white">
                                                                <TableHead className="w-[100px] text-[11px]">
                                                                  日期
                                                                </TableHead>
                                                                <TableHead className="w-[120px] text-[11px]">
                                                                  任務類型
                                                                </TableHead>
                                                                <TableHead className="min-w-[160px] text-[11px]">
                                                                  任務名稱
                                                                </TableHead>
                                                                <TableHead className="min-w-[140px] text-[11px]">
                                                                  成果
                                                                </TableHead>
                                                                <TableHead className="w-[80px] text-right text-[11px]">
                                                                  成果數
                                                                </TableHead>
                                                                <TableHead className="w-[80px] text-[11px]">
                                                                  圖片
                                                                </TableHead>
                                                                <TableHead className="w-[70px] text-right text-[11px]">
                                                                  工時
                                                                </TableHead>
                                                              </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                              {tasks.map(
                                                                (t) => {
                                                                  const attachments =
                                                                    parseTaskAttachments(
                                                                      t.images
                                                                    );
                                                                  return (
                                                                  <TableRow
                                                                    key={t.id}
                                                                    className="border-b border-gray-50"
                                                                  >
                                                                    <TableCell className="py-1.5 text-xs tabular-nums text-gray-600">
                                                                      {fmtDate(
                                                                        t.report_date
                                                                      )}
                                                                    </TableCell>
                                                                    <TableCell className="py-1.5 text-xs text-gray-600">
                                                                      {t.task_type ||
                                                                        "—"}
                                                                    </TableCell>
                                                                    <TableCell className="py-1.5 text-xs text-gray-800">
                                                                      {t.task_name ||
                                                                        "—"}
                                                                    </TableCell>
                                                                    <TableCell className="py-1.5 text-xs text-gray-600">
                                                                      {fmtDeliverables(
                                                                        t.deliverables
                                                                      )}
                                                                    </TableCell>
                                                                    <TableCell className="py-1.5 text-right font-mono text-xs tabular-nums text-gray-800">
                                                                      {deliverablesCount(
                                                                        t.deliverables
                                                                      ) || "—"}
                                                                    </TableCell>
                                                                    <TableCell className="py-1.5">
                                                                      {attachments.length >
                                                                      0 ? (
                                                                        <div className="flex gap-1">
                                                                          {attachments
                                                                            .slice(
                                                                              0,
                                                                              3
                                                                            )
                                                                            .map(
                                                                              (
                                                                                url,
                                                                                i
                                                                              ) => (
                                                                                <div
                                                                                  key={
                                                                                    i
                                                                                  }
                                                                                  className="w-8 h-8 rounded border border-gray-200 overflow-hidden bg-gray-50"
                                                                                >
                                                                                  <AttachmentThumbnail
                                                                                    url={
                                                                                      url
                                                                                    }
                                                                                    className="w-full h-full"
                                                                                  />
                                                                                </div>
                                                                              )
                                                                            )}
                                                                          {attachments.length >
                                                                            3 && (
                                                                            <span className="text-[10px] text-gray-400 self-center">
                                                                              +
                                                                              {attachments.length -
                                                                                3}
                                                                            </span>
                                                                          )}
                                                                        </div>
                                                                      ) : (
                                                                        <ImageIcon className="w-3.5 h-3.5 text-gray-200" />
                                                                      )}
                                                                    </TableCell>
                                                                    <TableCell className="py-1.5 text-right font-mono text-xs tabular-nums text-gray-800">
                                                                      {fmtHours(
                                                                        t.work_hour
                                                                      )}
                                                                    </TableCell>
                                                                  </TableRow>
                                                                  );
                                                                }
                                                              )}
                                                            </TableBody>
                                                          </Table>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                </TableCell>
                                              </TableRow>
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
