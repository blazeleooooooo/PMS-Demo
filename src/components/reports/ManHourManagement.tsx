"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  Clock,
  Trash2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  OctagonAlert,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar as CalendarIcon,
  Briefcase,
  Megaphone,
  CheckCircle2,
  Eye,
  Plus,
  X,
  CalendarOff} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger} from "@/components/ui/popover";
import { format, addDays, differenceInDays } from "date-fns";
import {
  defaultThisAndPrevWeek,
  startOfWeekSunday,
  useDeferredDateRange,
} from "@/hooks/use-deferred-date-range";
import {
  getManHourDatesForWeek,
  getManHourTasksByDateIds,
  getUnfinishedManHourReportsForStaff,
  deleteManHourDateAndTasks,
  deleteManHourTask as deleteManHourTaskService,
  getStaffIdByAuthUserId,
  createManHourDate,
  type ManHourDate,
  type ManHourTask} from "@/lib/man-hour-service";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { useHolidays, type HolidayInfo } from "@/hooks/use-holidays";
import { isRestDay } from "@/lib/work-report-monthly";

/** Label for /work-report-check「休」days (weekend / region public holiday). */
const NO_WORK_LABEL = "假期 - 不需要上班";
/** Label for recorded leave days (man_hour_dates.total_work_hour = 0, no tasks). */
const LEAVE_LABEL = "請假";

// ─── Helper: Check if user role is admin-level ─────────────────
function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return lower.includes("super") && lower.includes("admin")
    ? true
    : lower === "admin" || (lower.includes("admin") && !lower.includes("non"));
}

interface StaffOption {
  id: string;
  name: string;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Chinese weekday labels indexed by Date#getDay() (0=Sun … 6=Sat). */
const DAY_NAMES_ZH = ["日", "一", "二", "三", "四", "五", "六"] as const;

function getDateRange(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  const numDays = differenceInDays(end, start) + 1;
  for (let i = 0; i < numDays; i++) {
    dates.push(addDays(start, i));
  }
  return dates;
}

/** Group a date list into Sun–Sat week rows (pads edges to full weeks). */
function groupDatesByWeek(dates: Date[]): Date[][] {
  if (dates.length === 0) return [];
  const start = startOfWeekSunday(dates[0]);
  const last = dates[dates.length - 1];
  const end = new Date(startOfWeekSunday(last));
  end.setDate(end.getDate() + 6);

  const weeks: Date[][] = [];
  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(addDays(cursor, i));
    }
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function formatDateForAPI(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Extract YYYY-MM-DD from a timestamptz string using browser local timezone */
function extractLocalDate(timestamptz: string): string {
  const d = new Date(timestamptz);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local calendar Date from man_hour_dates.report_date (avoids UTC day shift). */
function dateFromReportDate(timestamptz: string): Date {
  const [y, m, d] = extractLocalDate(timestamptz).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateDisplay(date: Date): string {
  const day = DAY_NAMES_ZH[date.getDay()];
  const d = date.getDate();
  const m = date.getMonth() + 1;
  return `${day} ${d}/${m}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

// ─── Main Component ─────────────────────────────────────────

interface ManHourManagementProps {
  /** Base path for list/detail navigation (default live `/reports`). */
  basePath?: string;
}

export default function ManHourManagement({
  basePath = "/reports",
}: ManHourManagementProps) {
  const router = useRouter();
  const { user, profile, staff, displayName } = useAuth();
  const { loading: permLoading } = usePermission();

  // ─── Determine admin status ─────────────────────────────────
  const userIsAdmin = useMemo(() => isAdminRole(staff?.role), [staff]);

  // ─── State ─────────────────────────────────────────────────
  const {
    appliedRange: dateRange,
    draftRange,
    rangeOpen,
    applyRange,
    handleRangeOpenChange,
    handleCalendarDaySelect,
  } = useDeferredDateRange(defaultThisAndPrevWeek(), {
    snapUnit: "week",
  });
  const [manHourDates, setManHourDates] = useState<ManHourDate[]>([]);
  const [manHourTasks, setManHourTasks] = useState<ManHourTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>("current");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [currentUserStaffId, setCurrentUserStaffId] = useState<string | null>(null);
  /** Selected staff BU — same HK vs China「休」rules as /work-report-check. */
  const [staffBuId, setStaffBuId] = useState<string | null>(null);
  const [allStaffOptions, setAllStaffOptions] = useState<StaffOption[]>([]);
  const [enrichedJobMap, setEnrichedJobMap] = useState<Record<string, string>>({});

  // ─── Unfinished reports (all dates; ignores week filter) ───
  const [unfinishedDates, setUnfinishedDates] = useState<ManHourDate[]>([]);
  const [unfinishedTasks, setUnfinishedTasks] = useState<ManHourTask[]>([]);
  const [unfinishedJobMap, setUnfinishedJobMap] = useState<Record<string, string>>({});
  const [unfinishedLoading, setUnfinishedLoading] = useState(false);
  const [unfinishedOpen, setUnfinishedOpen] = useState(false);

  // ─── KPI Stats (Yearly & Assigned Projects/Pitchings) ───────
  const [totalYearHours, setTotalYearHours] = useState<number>(0);
  const [proposalCount, setProposalCount] = useState<number>(0);
  const [projectCount, setProjectCount] = useState<number>(0);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);

  // ─── Delete state ──────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "date" | "task";
    id: string;
    name: string;
    /** Zero-hour leave day with no tasks — cancel leave instead of generic delete. */
    isLeave?: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Computed dates (Sun–Sat weeks; default = prev + this week) ─
  // Only the applied range drives the grid — draft picks do not refetch mid-click.
  const weekDates = useMemo(() => {
    const range = dateRange?.from
      ? { from: dateRange.from, to: dateRange.to ?? dateRange.from }
      : defaultThisAndPrevWeek();
    return getDateRange(range.from!, range.to!);
  }, [dateRange]);

  // ─── Public holidays (HK + China) for the visible weeks + unfinished popup ─
  const unfinishedYears = useMemo(
    () => [...new Set(unfinishedDates.map((d) => dateFromReportDate(d.report_date).getFullYear()))],
    [unfinishedDates]
  );
  const visibleYears = useMemo(
    () => [...new Set([...weekDates.map((d) => d.getFullYear()), ...unfinishedYears])],
    [weekDates, unfinishedYears]
  );
  const { holidayMap } = useHolidays(visibleYears);

  // ─── Resolve staff UUID from auth ──────────────────────────
  // man_hour_dates.staff_id stores the staff table UUID (member_id on users table)
  // So we need profile.member_id which links users → staff
  useEffect(() => {
    async function resolveStaff() {
      let resolvedId: string | null = null;
      if (profile?.member_id) {
        // profile.member_id is the staff table UUID — matches man_hour_dates.staff_id
        resolvedId = profile.member_id;
      } else if (user?.id) {
        resolvedId = await getStaffIdByAuthUserId(user.id);
      }
      setStaffId(resolvedId);
      setCurrentUserStaffId(resolvedId);
    }
    resolveStaff();
  }, [profile, user]);

  // Resolve BU for rest-day rules (mainland → China Holiday API; else HK)
  useEffect(() => {
    if (!staffId) {
      setStaffBuId(null);
      return;
    }
    if (staff?.id === staffId && staff.bu_id != null) {
      setStaffBuId(String(staff.bu_id));
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("staff")
        .select("bu_id")
        .eq("id", staffId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("[ManHourManagement] Failed to load staff bu_id:", error.message);
        setStaffBuId(null);
        return;
      }
      setStaffBuId(data?.bu_id ? String(data.bu_id) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [staffId, staff]);

  // ─── Fetch all staff for admin dropdown ────────────────────
  useEffect(() => {
    if (!userIsAdmin) return;
    async function fetchAllStaff() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("staff")
        .select("id, name")
        .eq("status", "Active")
        .order("name", { ascending: true });
      if (data && !error) {
        setAllStaffOptions(data.filter((s: { name: string | null }) => s.name).map((s: { id: string; name: string | null }) => ({ id: s.id, name: s.name! })));
      }
    }
    fetchAllStaff();
  }, [userIsAdmin]);

  // ─── Handle staff dropdown change ──────────────────────────
  const handleStaffChange = useCallback((value: string) => {
    setSelectedStaff(value);
    if (value === "current") {
      setStaffId(currentUserStaffId);
    } else {
      setStaffId(value);
    }
  }, [currentUserStaffId]);

  // ─── Sync selectedStaff with resolved currentUserStaffId for admins ──
  useEffect(() => {
    if (userIsAdmin && currentUserStaffId && selectedStaff === "current") {
      setSelectedStaff(currentUserStaffId);
    }
  }, [userIsAdmin, currentUserStaffId, selectedStaff]);

  // ─── Fetch Yearly & Assigned Statistics ────────────────────
  const loadYearlyStats = useCallback(async () => {
    if (!staffId) return;
    setStatsLoading(true);
    const supabase = createClient();
    try {
      const currentYear = new Date().getFullYear();
      const startOfYear = `${currentYear}-01-01T00:00:00+08:00`;
      const endOfYear = `${currentYear}-12-31T23:59:59+08:00`;

      // 1. Fetch total work hours of current year
      const { data: datesData, error: datesError } = await supabase
        .from("man_hour_dates")
        .select("total_work_hour")
        .eq("staff_id", staffId)
        .gte("report_date", startOfYear)
        .lte("report_date", endOfYear);

      if (datesError) {
        console.error("[ManHour] Fetch yearly dates error:", datesError.message);
      }
      const yearHoursSum = datesData?.reduce((sum: number, item: any) => sum + (item.total_work_hour || 0), 0) || 0;
      setTotalYearHours(yearHoursSum);

      // 2. Fetch assigned proposals count from pitching_bv
      const { data: pitchingData, error: pitchingError } = await supabase
        .from("pitching_bv")
        .select("pitching_id, bwf_pitching_id")
        .eq("handler_id", staffId);

      if (pitchingError) {
        console.error("[ManHour] Fetch assigned pitchings error:", pitchingError.message);
      }
      const pitchingSet = new Set<string>();
      pitchingData?.forEach((row: any) => {
        if (row.pitching_id) pitchingSet.add(`bwa_${row.pitching_id}`);
        if (row.bwf_pitching_id) pitchingSet.add(`bwf_${row.bwf_pitching_id}`);
      });
      setProposalCount(pitchingSet.size);

      // 3. Fetch assigned projects count from project_bv
      const { data: projectData, error: projectError } = await supabase
        .from("project_bv")
        .select("project_id, bwf_project_id")
        .eq("handler_id", staffId);

      if (projectError) {
        console.error("[ManHour] Fetch assigned projects error:", projectError.message);
      }
      const projectSet = new Set<string>();
      projectData?.forEach((row: any) => {
        if (row.project_id) projectSet.add(`bwa_${row.project_id}`);
        if (row.bwf_project_id) projectSet.add(`bwf_${row.bwf_project_id}`);
      });
      setProjectCount(projectSet.size);

    } catch (err) {
      console.error("[ManHour] Fetch yearly stats unexpected error:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    loadYearlyStats();
  }, [loadYearlyStats]);

  // ─── Load data for the week ────────────────────────────────
  const loadWeekData = useCallback(async () => {
    if (!staffId) return;
    setLoading(true);
    setError(null);

    try {
      const weekDateStrings = weekDates.map((d) => formatDateForAPI(d));
      console.log("[ManHour] Fetching dates for staff:", staffId, "week:", weekDateStrings);

      // Fetch man hour dates for the week (direct Supabase query)
      const dates = await getManHourDatesForWeek(staffId, weekDateStrings);
      console.log("[ManHour] Dates result:", dates.length, "records");
      setManHourDates(dates);

      // Fetch tasks for all date IDs in one batch call
      if (dates.length > 0) {
        const dateIds = dates.map((d) => d.id);
        const tasks = await getManHourTasksByDateIds(dateIds);
        console.log("[ManHour] Tasks result:", tasks.length, "tasks");
        setManHourTasks(tasks);

        // Enrich tasks with related project/pitching names
        setEnrichedJobMap(await enrichTasksWithJobNames(tasks));
      } else {
        setManHourTasks([]);
        setEnrichedJobMap({});
      }
    } catch (err: any) {
      console.error("[ManHourManagement] Load error:", err);
      setError(err?.message || "Failed to load man hour data");
    } finally {
      setLoading(false);
    }
  }, [weekDates, staffId]);

  useEffect(() => {
    if (staffId) {
      loadWeekData();
    }
  }, [loadWeekData, staffId]);

  // ─── Enrich tasks with related project/pitching names ──────
  const enrichTasksWithJobNames = async (tasks: ManHourTask[]): Promise<Record<string, string>> => {
    const supabase = createClient();
    const jobMap: Record<string, string> = {};

    // Group tasks by job_type
    const bwaProjectIds = tasks.filter(t => t.project_id && t.job_type === "bwa_project").map(t => t.project_id!);
    const bwfProjectIds = tasks.filter(t => t.project_id && t.job_type === "bwf_project").map(t => t.project_id!);
    const bwaPitchingIds = tasks.filter(t => t.project_id && t.job_type === "bwa_pitching").map(t => t.project_id!);
    const bwfPitchingIds = tasks.filter(t => t.project_id && t.job_type === "bwf_pitching").map(t => t.project_id!);

    // Fetch BWA projects
    if (bwaProjectIds.length > 0) {
      const { data: bwaProjects } = await supabase
        .from("bwa_projects")
        .select("id, project_name")
        .in("id", [...new Set(bwaProjectIds)]);
      if (bwaProjects) {
        bwaProjects.forEach((p: { id: string; project_name?: string | null }) => {
          if (p.project_name) jobMap[`bwa_project_${p.id}`] = p.project_name;
        });
      }
    }

    // Fetch BWF projects
    if (bwfProjectIds.length > 0) {
      const { data: bwfProjects } = await supabase
        .from("bwf_projects")
        .select("id, project_name")
        .in("id", [...new Set(bwfProjectIds)]);
      if (bwfProjects) {
        bwfProjects.forEach((p: { id: string; project_name?: string | null }) => {
          if (p.project_name) jobMap[`bwf_project_${p.id}`] = p.project_name;
        });
      }
    }

    // Fetch BWA pitchings
    if (bwaPitchingIds.length > 0) {
      const { data: bwaPitchings } = await supabase
        .from("bwa_pitchings")
        .select("id, real_customer_display_name")
        .in("id", [...new Set(bwaPitchingIds)]);
      if (bwaPitchings) {
        bwaPitchings.forEach((p: { id: string; real_customer_display_name?: string | null }) => {
          if (p.real_customer_display_name) jobMap[`bwa_pitching_${p.id}`] = p.real_customer_display_name;
        });
      }
    }

    // Fetch BWF pitchings
    if (bwfPitchingIds.length > 0) {
      const { data: bwfPitchings } = await supabase
        .from("bwf_pitchings")
        .select("id, real_customer_display_name")
        .in("id", [...new Set(bwfPitchingIds)]);
      if (bwfPitchings) {
        bwfPitchings.forEach((p: { id: string; real_customer_display_name?: string | null }) => {
          if (p.real_customer_display_name) jobMap[`bwf_pitching_${p.id}`] = p.real_customer_display_name;
        });
      }
    }

    return jobMap;
  };

  // ─── Unfinished reports (ignore week date range) ───────────
  const loadUnfinishedReports = useCallback(async () => {
    if (!staffId) return;
    setUnfinishedLoading(true);
    try {
      const { dates, tasks } = await getUnfinishedManHourReportsForStaff(staffId);
      setUnfinishedDates(dates);
      setUnfinishedTasks(tasks);
      setUnfinishedJobMap(dates.length > 0 ? await enrichTasksWithJobNames(tasks) : {});
    } catch (err) {
      console.error("[ManHourManagement] Unfinished reports error:", err);
      setUnfinishedDates([]);
      setUnfinishedTasks([]);
      setUnfinishedJobMap({});
    } finally {
      setUnfinishedLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    if (staffId) {
      loadUnfinishedReports();
    } else {
      setUnfinishedDates([]);
      setUnfinishedTasks([]);
      setUnfinishedJobMap({});
    }
  }, [staffId, loadUnfinishedReports]);

  // ─── Navigation (shift selected week range by ±1 week) ─────
  const shiftRangeByWeeks = (weeks: number) => {
    const base = dateRange?.from
      ? { from: dateRange.from, to: dateRange.to ?? dateRange.from }
      : defaultThisAndPrevWeek();
    applyRange(
      {
        from: addDays(base.from!, weeks * 7),
        to: addDays(base.to!, weeks * 7),
      },
      false
    );
  };

  const goToPrevWeek = () => shiftRangeByWeeks(-1);
  const goToNextWeek = () => shiftRangeByWeeks(1);

  // ─── Group data by day ─────────────────────────────────────
  const dayData = useMemo(() => {
    // Ensure Sun–Sat alignment even if range edges drift.
    const alignedDates = groupDatesByWeek(weekDates).flat();
    return alignedDates.map((date) => {
      const dateStr = formatDateForAPI(date);
      const matchingDates = manHourDates.filter((mhd) => {
        return extractLocalDate(mhd.report_date) === dateStr;
      });

      const dayTasks: ManHourTask[] = [];
      for (const mhd of matchingDates) {
        const tasks = manHourTasks.filter(
          (t) => t.man_hour_date_id === mhd.id
        );
        dayTasks.push(...tasks);
      }

      const totalHours = matchingDates.reduce(
        (sum, d) => sum + (d.total_work_hour || 0),
        0
      );

      return {
        date,
        manHourDates: matchingDates,
        tasks: dayTasks,
        totalHours};
    });
  }, [weekDates, manHourDates, manHourTasks]);

  /** Rows of 7 days, Sunday first → Saturday. */
  const weekRows = useMemo(() => {
    const rows: typeof dayData[] = [];
    for (let i = 0; i < dayData.length; i += 7) {
      rows.push(dayData.slice(i, i + 7));
    }
    return rows;
  }, [dayData]);

  // ─── KPI Stats ─────────────────────────────────────────────
  const totalWeekHours = useMemo(
    () => dayData.reduce((sum, d) => sum + d.totalHours, 0),
    [dayData]
  );

  const totalOTCProjects = useMemo(() => {
    const projectSet = new Set<string>();
    manHourTasks.forEach((t) => {
      if (t.project_id) projectSet.add(t.project_id);
      else if (t.project_name) projectSet.add(t.project_name);
    });
    return projectSet.size;
  }, [manHourTasks]);

  // ─── Delete ────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "date") {
        await deleteManHourDateAndTasks(deleteTarget.id);
      } else {
        await deleteManHourTaskService(deleteTarget.id);
      }
      setDeleteTarget(null);
      await loadWeekData();
      await loadYearlyStats();
      await loadUnfinishedReports();
    } catch (err: any) {
      console.error("[ManHourManagement] Delete error:", err);
      alert(`刪除失敗: ${err?.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render: Loading ───────────────────────────────────────
  if (loading && manHourDates.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">載入工時資料中...</span>
      </div>
    );
  }

  if (error && manHourDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-500" />
        <p className="text-gray-600 text-sm">{error}</p>
        <Button onClick={loadWeekData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          重試
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Page Title ───────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">每日工作匯報</h1>
        <p className="text-sm text-gray-500 mt-1">
          匯報及管理項目的工作時數。Report and manage project&apos;s man hour usage.
        </p>
      </div>

      {/* ─── BV / Reporting Policy Warning ────────────────── */}
      <div
        role="alert"
        className="rounded-lg border-2 border-red-600 bg-gradient-to-br from-red-50 via-red-100 to-orange-50 shadow-md ring-1 ring-red-500/30"
      >
        <div className="flex gap-4 p-5">
          <div className="shrink-0 pt-0.5">
            <OctagonAlert className="w-9 h-9 text-red-600" aria-hidden />
          </div>
          <div className="min-w-0 space-y-3">
            <h2 className="text-base sm:text-lg font-black text-red-900 leading-snug">
              嚴重警告 — 未做工作匯報 = 永久損失 BV 業績，後果自負
            </h2>
            <ul className="space-y-2.5 text-sm text-red-900/95">
              <li className="flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" aria-hidden />
                <span>
                  <strong className="text-red-800">有做工作匯報才有業績 BV。</strong>
                  新制度按 FY 年度計算；匯報工時不足，<strong className="text-red-800 underline decoration-red-600/60">最高可扣 50% 業績</strong>。
                  例：年度工時 1,800 小時，只匯報 1,200 小時 → BV 成績<strong className="text-red-800">只計 66%</strong>，其餘全部作廢。
                </span>
              </li>
              <li className="flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" aria-hidden />
                <span>
                  <strong className="text-red-800">超過 14 日未做工作匯報，該日匯報入口永久關閉。</strong>
                  屆時<strong className="text-red-800 underline decoration-red-600/60">不得再補報、不得申請特批、不得追回已損失的 BV</strong>——系統自動結算，管理層一律不受理。
                </span>
              </li>
            </ul>
            <p className="text-xs font-semibold text-red-800 border-t border-red-300/60 pt-2.5">
              每一日未填匯報，都在永久扣除你的 BV。請立即補齊所有缺漏日期，否則年度業績評核將以實際匯報工時為準，無任何例外。
            </p>
          </div>
        </div>
      </div>

      {/* ─── KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Year Hours */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">本年度總工作時數</p>
                <p className="text-2xl font-bold text-gray-900">1,800 小時</p>
                <p className="text-[10px] text-gray-400 mt-0.5">年度評核標準時數</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reported Hours / Percentage */}
        <Card className="border-l-4 border-l-indigo-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-100 rounded-full">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium">你已經匯報的時數 / %</p>
                {statsLoading ? (
                  <div className="h-8 flex items-center">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  </div>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-900">
                      {totalYearHours} 小時
                    </p>
                    <p className="text-[10px] font-semibold text-indigo-600 mt-0.5">
                      佔比: {((totalYearHours / 1800) * 100).toFixed(1)}%
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pitching Count */}
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-full">
                <Megaphone className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">提案數量</p>
                {statsLoading ? (
                  <div className="h-8 flex items-center">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  </div>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-900">{proposalCount} 個</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">負責之提案/Pitching總數</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Count */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">項目數量</p>
                {statsLoading ? (
                  <div className="h-8 flex items-center">
                    <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                  </div>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-900">{projectCount} 個</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">負責之項目/Project總數</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Filter Bar ───────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">項目經理</span>
          <Select value={selectedStaff} onValueChange={handleStaffChange}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue placeholder="Staff" />
            </SelectTrigger>
            <SelectContent>
              {userIsAdmin ? (
                <>
                  {allStaffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </>
              ) : (
                <SelectItem value="current">{displayName || "Current"}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">時間段</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Popover open={rangeOpen} onOpenChange={handleRangeOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3 font-mono"
                >
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                    : weekDates.length > 0
                      ? `${format(weekDates[0], "dd/MM/yyyy")} - ${format(weekDates[weekDates.length - 1], "dd/MM/yyyy")}`
                      : "選擇週"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="px-3 pt-3 pb-1 text-xs text-gray-500">
                  以週為單位選擇（可選一週或多週）。第一次點選起始週，第二次點選結束週。
                </div>
                <Calendar
                  initialFocus
                  mode="range"
                  weekStartsOn={0}
                  defaultMonth={
                    draftRange?.from || dateRange?.from || weekDates[0]
                  }
                  selected={
                    draftRange ||
                    dateRange || {
                      from: weekDates[0],
                      to: weekDates[weekDates.length - 1],
                    }
                  }
                  onSelect={handleCalendarDaySelect}
                  numberOfMonths={2}
                />
                <div className="flex items-center justify-between gap-2 p-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => applyRange(defaultThisAndPrevWeek(), true)}
                  >
                    重置為本週及上週
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const sunday = startOfWeekSunday(new Date());
                      applyRange(
                        { from: sunday, to: addDays(sunday, 6) },
                        true
                      );
                    }}
                  >
                    本週
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className={`h-8 text-xs px-3 ${
              unfinishedDates.length > 0
                ? "text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:text-amber-900"
                : "text-gray-600"
            }`}
            onClick={() => {
              setUnfinishedOpen(true);
              loadUnfinishedReports();
            }}
            disabled={!staffId}
          >
            {unfinishedLoading ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            )}
            未完成匯報({unfinishedDates.length})
          </Button>
          <div className="text-right">
            <p className="text-xs text-gray-500">已選時段總工時</p>
            <p className="text-sm font-bold text-gray-900">{totalWeekHours} 小時</p>
          </div>
          {loading && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          )}
        </div>
      </div>

      {/* ─── Weekly Grid (each row: 日 → 六) ──────────────── */}
      <div className="space-y-4">
        {weekRows.map((week) => (
          <div
            key={formatDateForAPI(week[0].date)}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 items-stretch"
          >
            {week.map((day) => {
              const dateStr = formatDateForAPI(day.date);
              return (
                <DayColumn
                  key={dateStr}
                  date={day.date}
                  totalHours={day.totalHours}
                  tasks={day.tasks}
                  manHourDates={day.manHourDates}
                  loading={loading}
                  enrichedJobMap={enrichedJobMap}
                  staffId={staffId}
                  holiday={holidayMap.get(dateStr)}
                  isNoWorkDay={isRestDay(
                    dateStr,
                    day.date,
                    holidayMap,
                    staffBuId
                  )}
                  onDeleteDate={(id, name, opts) =>
                    setDeleteTarget({
                      type: "date",
                      id,
                      name,
                      isLeave: opts?.isLeave,
                    })
                  }
                  onViewDetail={(dateId, e) =>
                    handleNavClick(`${basePath}/${dateId}`, e, (href) => router.push(href))
                  }
                  onCreated={() => {
                    loadWeekData();
                    loadUnfinishedReports();
                  }}
                  basePath={basePath}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* ─── Unfinished reports popup ─────────────────────── */}
      <Dialog open={unfinishedOpen} onOpenChange={setUnfinishedOpen}>
        <DialogContent className="max-w-[1100px] w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>未完成匯報({unfinishedDates.length})</DialogTitle>
            <DialogDescription>
              總工時大於 0，但任務工時尚未填滿的匯報（不受時間段篩選）。
            </DialogDescription>
          </DialogHeader>
          {unfinishedLoading && unfinishedDates.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              載入未完成匯報...
            </div>
          ) : unfinishedDates.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">沒有未完成匯報</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
              {unfinishedDates.map((mhd) => {
                const date = dateFromReportDate(mhd.report_date);
                const dateStr = formatDateForAPI(date);
                const dayTasks = unfinishedTasks.filter(
                  (t) => t.man_hour_date_id === mhd.id
                );
                return (
                  <DayColumn
                    key={mhd.id}
                    date={date}
                    totalHours={mhd.total_work_hour || 0}
                    tasks={dayTasks}
                    manHourDates={[mhd]}
                    loading={unfinishedLoading}
                    enrichedJobMap={unfinishedJobMap}
                    staffId={staffId}
                    holiday={holidayMap.get(dateStr)}
                    isNoWorkDay={isRestDay(dateStr, date, holidayMap, staffBuId)}
                    onDeleteDate={(id, name, opts) =>
                      setDeleteTarget({
                        type: "date",
                        id,
                        name,
                        isLeave: opts?.isLeave,
                      })
                    }
                    onViewDetail={(dateId, e) => {
                      handleNavClick(`${basePath}/${dateId}`, e, (href) => {
                        setUnfinishedOpen(false);
                        router.push(href);
                      });
                    }}
                    onCreated={() => {
                      loadWeekData();
                      loadUnfinishedReports();
                    }}
                    basePath={basePath}
                  />
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Dialog ────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent className="z-[70]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.isLeave ? "確認取消休假" : "確認刪除"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.isLeave
                ? <>確定要取消 &quot;{deleteTarget?.name}&quot; 的休假嗎？此操作無法復原。</>
                : <>確定要刪除{deleteTarget?.type === "date" ? "工時日期" : "工時任務"}{" "}
                  &quot;{deleteTarget?.name}&quot; 嗎？此操作無法復原。</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : deleteTarget?.isLeave ? (
                <X className="w-4 h-4 mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {deleteTarget?.isLeave ? "取消休假" : "刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Day Column Component ────────────────────────────────────

interface DayColumnProps {
  date: Date;
  totalHours: number;
  tasks: ManHourTask[];
  manHourDates: ManHourDate[];
  loading: boolean;
  enrichedJobMap: Record<string, string>;
  staffId: string | null;
  holiday?: HolidayInfo;
  /** Same「休」rule as /work-report-check (weekend + region public holiday). */
  isNoWorkDay?: boolean;
  onDeleteDate: (id: string, name: string, opts?: { isLeave?: boolean }) => void;
  onViewDetail: (dateId: string, event?: React.MouseEvent) => void;
  onCreated: () => void;
  basePath: string;
}

function DayColumn({ date, totalHours, tasks, manHourDates, loading, enrichedJobMap, staffId, holiday, isNoWorkDay, onDeleteDate, onViewDetail, onCreated, basePath }: DayColumnProps) {
  const router = useRouter();
  const isToday = isSameDay(date, new Date());
  const hasData = manHourDates.length > 0;
  /** Recorded leave: total hours 0 and no related man_hour_task rows. */
  const isLeaveOnly = hasData && totalHours === 0 && tasks.length === 0;
  const [creating, setCreating] = React.useState(false);
  const [creatingLeave, setCreatingLeave] = React.useState(false);
  const createBusy = creating || creatingLeave;

  const hkHoliday = holiday?.hk;
  // For China, isOffDay=false marks a makeup working day (調休上班) rather than a holiday.
  const cnHoliday = holiday?.cn?.isOffDay ? holiday.cn : undefined;
  const cnWorkday = holiday?.cn && !holiday.cn.isOffDay ? holiday.cn : undefined;
  // Highlight card when it matches work-report-check「休」.
  const isHolidayOff = Boolean(isNoWorkDay);

  const buildReportDateIso = () => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}T00:00:00+08:00`;
  };

  const handleCreate = async () => {
    if (!staffId) return;
    setCreating(true);
    try {
      const created = await createManHourDate({
        staff_id: staffId,
        report_date: buildReportDateIso(),
        total_work_hour: 8,
      });

      // Navigate to the newly created date detail
      router.push(`${basePath}/${created.id}`);
    } catch (err: any) {
      console.error("[DayColumn] Create error:", err);
      alert(`建立失敗: ${err?.message}`);
    } finally {
      setCreating(false);
    }
  };

  /** Quick-create a leave / off day: man_hour_dates.total_work_hour = 0 */
  const handleCreateLeave = async () => {
    if (!staffId) return;
    setCreatingLeave(true);
    try {
      await createManHourDate({
        staff_id: staffId,
        report_date: buildReportDateIso(),
        total_work_hour: 0,
      });
      onCreated();
    } catch (err: any) {
      console.error("[DayColumn] Create leave error:", err);
      alert(`建立失敗: ${err?.message}`);
    } finally {
      setCreatingLeave(false);
    }
  };

  const createActionButtons = staffId ? (
    <div className="flex flex-col items-stretch gap-2 w-full max-w-[160px]">
      <Button
        variant="outline"
        size="sm"
        className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        onClick={handleCreate}
        disabled={createBusy}
      >
        {creating ? (
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ) : (
          <Plus className="w-3 h-3 mr-1" />
        )}
        建立工作匯報
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800"
        onClick={handleCreateLeave}
        disabled={createBusy}
      >
        {creatingLeave ? (
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ) : null}
        已申請請假
      </Button>
    </div>
  ) : null;

  return (
    <Card className={`${isToday ? "ring-2 ring-blue-400 shadow-md" : ""} ${isLeaveOnly ? "bg-amber-50" : isHolidayOff ? "bg-rose-50/60" : ""} h-full min-h-[200px] flex flex-col`}>
      <CardContent className="pt-4 pb-4 px-4 flex-1 flex flex-col">
        {/* Day Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className={`text-sm font-semibold ${isLeaveOnly ? "text-amber-700" : isHolidayOff ? "text-rose-700" : "text-gray-900"}`}>
            {formatDateDisplay(date)}
          </h3>
          <span className="text-sm font-bold text-gray-700">
            {loading ? (
              <span className="inline-block h-4 w-10 bg-gray-200 rounded animate-pulse"></span>
            ) : totalHours > 0 ? `${totalHours} Hr` : "—"}
          </span>
        </div>

        {/* Holiday badges */}
        {(hkHoliday || cnHoliday || cnWorkday) && (
          <div className="flex flex-col gap-1 mb-3">
            {hkHoliday && (
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-rose-100 text-rose-700 w-fit max-w-full"
                title={`香港公眾假期：${hkHoliday.name}`}
              >
                <span aria-hidden>🇭🇰</span>
                <span className="truncate">{hkHoliday.name}</span>
              </span>
            )}
            {cnHoliday && (
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 w-fit max-w-full"
                title={`中國法定假期：${cnHoliday.name}`}
              >
                <span aria-hidden>🇨🇳</span>
                <span className="truncate">{cnHoliday.name}</span>
              </span>
            )}
            {cnWorkday && (
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 w-fit max-w-full"
                title={`中國調休上班：${cnWorkday.name}`}
              >
                <span aria-hidden>🇨🇳</span>
                <span className="truncate">調休上班 · {cnWorkday.name}</span>
              </span>
            )}
          </div>
        )}

        {/* Tasks List */}
        {loading ? (
          <div className="space-y-3 mb-4 flex-1 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-3 bg-gray-200 rounded w-3/5"></div>
              <div className="h-3 bg-gray-200 rounded w-10"></div>
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 bg-gray-200 rounded w-2/5"></div>
              <div className="h-3 bg-gray-200 rounded w-10"></div>
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 bg-gray-200 rounded w-4/5"></div>
              <div className="h-3 bg-gray-200 rounded w-10"></div>
            </div>
          </div>
        ) : tasks.length > 0 ? (
          <div className="space-y-2 mb-4 flex-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between text-sm py-1"
              >
                <span className="text-gray-700 truncate flex-1 pr-2 text-xs flex items-center gap-1">
                  {task.job_type && (
                    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                      task.job_type === 'bwa_project' ? 'bg-blue-500' :
                      task.job_type === 'bwa_pitching' ? 'bg-indigo-500' :
                      task.job_type === 'bwf_project' ? 'bg-amber-500' :
                      task.job_type === 'bwf_pitching' ? 'bg-orange-500' : 'bg-gray-400'
                    }`} />
                  )}
                  {(task.job_type && task.project_id && enrichedJobMap[`${task.job_type}_${task.project_id}`]) || task.task_name || task.task_description || "未命名任務"}
                </span>
                <span className="text-gray-500 whitespace-nowrap text-xs font-medium">
                  {task.work_hour || 0} Hr
                </span>
              </div>
            ))}
          </div>
        ) : isLeaveOnly ? (
          // Recorded leave (total_work_hour = 0, no tasks) — amber to distinguish from rose「休」.
          <div className="flex flex-col items-center justify-center flex-1 py-6 text-amber-600 text-xs gap-1">
            <CalendarOff className="w-5 h-5" aria-hidden />
            <span className="font-medium text-center px-1">{LEAVE_LABEL}</span>
          </div>
        ) : isNoWorkDay ? (
          // Matches /work-report-check「休」: weekend or region public holiday
          // (mainland BU → China Holiday API; others → HK holidays).
          <div className="flex flex-col items-center justify-center flex-1 py-6 text-violet-500 text-xs gap-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg">😴</span>
              <span className="font-medium text-center px-1">{NO_WORK_LABEL}</span>
            </div>
            {createActionButtons}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 py-6 text-gray-300 text-xs gap-3">
            <span>暫無記錄</span>
            {!hasData && createActionButtons}
          </div>
        )}

        {/* Action Buttons */}
        {hasData && (
          <div className="flex gap-2 mt-auto pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
              onClick={() => {
                const firstDate = manHourDates[0];
                onDeleteDate(firstDate.id, formatDateDisplay(date), {
                  isLeave: isLeaveOnly,
                });
              }}
            >
              {isLeaveOnly ? (
                <X className="w-3 h-3 mr-1" />
              ) : (
                <Trash2 className="w-3 h-3 mr-1" />
              )}
              {isLeaveOnly ? "取消休假" : "刪除"}
            </Button>
            {!isLeaveOnly && (
              <Button
                variant="default"
                size="sm"
                className="flex-1 text-xs"
                onClick={(e) => {
                  const firstDate = manHourDates[0];
                  onViewDetail(firstDate.id, e);
                }}
              >
                <Eye className="w-3 h-3 mr-1" />
                檢視
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
