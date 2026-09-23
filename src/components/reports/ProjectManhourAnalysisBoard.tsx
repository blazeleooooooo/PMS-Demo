"use client";

// ═══════════════════════════════════════════════════════════════════════════
// AI WARNING — SHARED PROJECT MANHOUR ANALYSIS (DO NOT DUPLICATE)
//   • /design-reports/project-manhour-analysis → <ProjectManhourAnalysisBoard />
//   • /team-reports/project-manhour-analysis   → reportScope="team"
// Edits apply to BOTH pages. reportScope="team" locks Team in StaffFilterBar
// (unless Super Admin); staff hours filtered via staffIdMatchesFilter.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  User,
  ChevronDown,
  ChevronRight,
  Clock,
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
  fetchProjectManhourAnalysis,
  jobTypeToDisplayType,
  jobTypeToRoute,
  type ProjectManhourProjectGroup,
  type DeliverablesData,
  type JobType,
} from "@/lib/man-hour-service";
import { resolveRange, fmtRangeDate } from "@/lib/report-date-range";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";
import ReportFilterStack from "@/components/reports/ReportFilterStack";
import ReportDateRangeNote from "@/components/reports/ReportDateRangeNote";
import {
  applyProjectFilters,
  type ProjectFilterFields,
} from "@/components/reports/ProjectFilterBar";
import { staffIdMatchesFilter } from "@/components/reports/StaffFilterBar";
import { useAlignedReportFilters } from "@/hooks/use-aligned-report-filters";
import {
  projectFilterNeedsExtras,
  useEnrichedProjectFilterRows,
} from "@/hooks/use-project-filter-extras";
import type { ReportStaffScope } from "@/hooks/use-report-staff-lock";
import type { StaffDirectoryRow } from "@/lib/data-service";
import { parseTaskAttachments } from "@/lib/attachment-utils";
import { AttachmentThumbnail } from "@/components/ui/attachment-thumbnail";

export interface ProjectManhourAnalysisBoardProps {
  reportScope?: ReportStaffScope;
}

function manhourGroupProjectFields(
  g: ProjectManhourProjectGroup,
): ProjectFilterFields {
  return {
    id: `${g.job_type}:${g.project_id}`,
    status: g.status_or_stage,
    cost_centre_bu_code: null,
    service_type_name: null,
    project_type_name: null,
    financial_year_name: null,
    n_financial_year_id: null,
    project_size: null,
    est_income: null,
    project_name: g.project_name,
    project_code: g.project_code,
    filter_project_id: g.project_id,
  };
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function fmtHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtDeliverables(d: DeliverablesData | null | undefined): string {
  if (!d?.type) return "";
  const parts = [d.type];
  if (d.count != null && d.count > 0) parts.push(`×${d.count}`);
  if (d.stage) parts.push(d.stage);
  return parts.join(" · ");
}

const JOB_TYPE_META: Record<
  JobType,
  { short: string; badgeClass: string; source: "bwa" | "bwf" }
> = {
  bwa_pitching: {
    short: "BWA 提案",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    source: "bwa",
  },
  bwa_project: {
    short: "BWA 項目",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    source: "bwa",
  },
  bwf_pitching: {
    short: "BWF 提案",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
    source: "bwf",
  },
  bwf_project: {
    short: "BWF 項目",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    source: "bwf",
  },
};

function projectKey(g: ProjectManhourProjectGroup): string {
  return `${g.job_type}:${g.project_id}`;
}

type SortCol =
  | "project_code"
  | "project_name"
  | "enquiry_date"
  | "staff_count"
  | "total_work_hour";

type SortDir = "asc" | "desc";

export default function ProjectManhourAnalysisBoard({
  reportScope = "business",
}: ProjectManhourAnalysisBoardProps) {
  const { range, custom, sources } = useReportRange();
  const {
    projectFilter,
    setProjectFilter,
    staffFilter,
    setStaffFilter,
    staffLocks,
    isSuperAdmin,
  } = useAlignedReportFilters(reportScope);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const dateWindow = useMemo(
    () => resolveRange(range, new Date(), custom),
    [range, custom]
  );
  const dateFrom = dateWindow.from ? toInputDate(dateWindow.from) : null;
  const dateTo = dateWindow.to ? toInputDate(dateWindow.to) : null;
  const customIncomplete = range === "custom" && (!custom.from || !custom.to);

  const [kindFilter, setKindFilter] = useState<"all" | "pitching" | "project">(
    "all"
  );
  const [allGroups, setAllGroups] = useState<ProjectManhourProjectGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortCol, setSortCol] = useState<SortCol>("total_work_hour");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [collapsedProjects, setCollapsedProjects] = useState<
    Record<string, boolean>
  >({});
  const [expandedStaff, setExpandedStaff] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    if (customIncomplete) {
      setAllGroups([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    let cancelled = false;
    const soft = allGroups.length > 0;
    (async () => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const rows = await fetchProjectManhourAnalysis(dateFrom, dateTo);
        if (!cancelled) setAllGroups(rows);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "載入失敗");
          setAllGroups([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on date only
  }, [dateFrom, dateTo, customIncomplete]);

  const projectFilterRows = useMemo(
    () => allGroups.map(manhourGroupProjectFields),
    [allGroups],
  );
  const enrichedProjectFilterRows = useEnrichedProjectFilterRows(
    projectFilterRows,
    projectFilterNeedsExtras(projectFilter),
  );

  const projectFilteredKeys = useMemo(
    () =>
      new Set(
        applyProjectFilters(enrichedProjectFilterRows, projectFilter).map((p) => p.id),
      ),
    [enrichedProjectFilterRows, projectFilter],
  );

  const groups = useMemo(() => {
    let list = allGroups
      .map((g) => {
        const groupKey = projectKey(g);
        if (!projectFilteredKeys.has(groupKey)) return null;

        const sourceOk =
          (sources.bwa && JOB_TYPE_META[g.job_type].source === "bwa") ||
          (sources.bwf && JOB_TYPE_META[g.job_type].source === "bwf");
        if (!sourceOk) return null;

        const kind =
          g.job_type === "bwa_pitching" || g.job_type === "bwf_pitching"
            ? "pitching"
            : "project";
        if (kindFilter !== "all" && kind !== kindFilter) return null;

        const staff = g.staff.filter((s) =>
          staffIdMatchesFilter(s.staff_id, staffFilter, staffDirectory),
        );
        if (staff.length === 0) return null;

        const total_work_hour =
          Math.round(
            staff.reduce((sum, s) => sum + s.total_work_hour, 0) * 100,
          ) / 100;

        return {
          ...g,
          staff,
          staff_count: staff.length,
          total_work_hour,
        };
      })
      .filter(Boolean) as ProjectManhourProjectGroup[];

    list.sort((a, b) => {
      const av =
        sortCol === "project_code" || sortCol === "project_name"
          ? (a[sortCol] || "").toLowerCase()
          : sortCol === "enquiry_date"
            ? a.enquiry_date || ""
            : a[sortCol];
      const bv =
        sortCol === "project_code" || sortCol === "project_name"
          ? (b[sortCol] || "").toLowerCase()
          : sortCol === "enquiry_date"
            ? b.enquiry_date || ""
            : b[sortCol];
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return (b.project_code || "").localeCompare(a.project_code || "");
    });

    return list;
  }, [
    allGroups,
    sources,
    kindFilter,
    sortCol,
    sortDir,
    projectFilteredKeys,
    staffFilter,
    staffDirectory,
  ]);

  const totalHours = useMemo(
    () => groups.reduce((s, g) => s + g.total_work_hour, 0),
    [groups]
  );

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(
        col === "project_code" || col === "project_name" ? "asc" : "desc"
      );
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

  const handleExpandAll = () => setCollapsedProjects({});
  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[projectKey(g)] = true;
    setCollapsedProjects(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          項目工時分析{" "}
          <span className="text-base font-normal text-gray-400">
            Project Manhour Analysis
          </span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          From {fmtRangeDate(dateWindow.from)} to {fmtRangeDate(dateWindow.to)}
          {refreshing && (
            <Loader2 className="w-3.5 h-3.5 ml-2 inline animate-spin text-gray-400" />
          )}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          按關聯提案／項目彙總工時匯報，可展開查看員工與任務明細。
        </p>
      </div>

      <ReportFilterStack
        sourceMode="multi"
        projectRows={enrichedProjectFilterRows}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        staffLocks={staffLocks}
        isSuperAdmin={isSuperAdmin}
        onStaffDirectoryLoaded={setStaffDirectory}
      />

      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500">類型 Kind</label>
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
              <span className="font-semibold text-gray-800">{groups.length}</span>{" "}
              個項目
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-semibold text-gray-800">
                {fmtHours(Math.round(totalHours * 10) / 10)}
              </span>{" "}
              工時
            </span>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
          <span className="ml-3 text-gray-500">載入項目工時資料...</span>
        </div>
      ) : customIncomplete ? (
        <div className="bg-white border border-gray-200 rounded-lg py-20 text-center text-gray-400 shadow-sm">
          請選擇開始及結束日期
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg py-20 text-center text-gray-400 shadow-sm">
          沒有符合日期範圍與篩選的工時匯報
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="table-fixed min-w-[960px]">
              <TableHeader>
                <TableRow className="bg-gray-50/75 hover:bg-gray-50/75 border-b border-gray-200">
                  <TableHead className="w-[40px]" />
                  <TableHead className="w-[100px] font-semibold text-gray-700 text-xs">
                    類型
                  </TableHead>
                  <TableHead
                    className="w-[120px] font-semibold text-gray-700 text-xs cursor-pointer select-none"
                    onClick={() => toggleSort("project_code")}
                  >
                    代號 <SortIcon col="project_code" />
                  </TableHead>
                  <TableHead
                    className="min-w-[200px] font-semibold text-gray-700 text-xs cursor-pointer select-none"
                    onClick={() => toggleSort("project_name")}
                  >
                    名稱 <SortIcon col="project_name" />
                  </TableHead>
                  <TableHead
                    className="w-[100px] font-semibold text-gray-700 text-xs cursor-pointer select-none"
                    onClick={() => toggleSort("enquiry_date")}
                  >
                    查詢日期 <SortIcon col="enquiry_date" />
                  </TableHead>
                  <TableHead className="w-[140px] font-semibold text-gray-700 text-xs">
                    階段 / 狀態
                  </TableHead>
                  <TableHead
                    className="w-[90px] text-right font-semibold text-gray-700 text-xs cursor-pointer select-none"
                    onClick={() => toggleSort("staff_count")}
                  >
                    人數 <SortIcon col="staff_count" />
                  </TableHead>
                  <TableHead
                    className="w-[100px] text-right font-semibold text-gray-700 text-xs cursor-pointer select-none"
                    onClick={() => toggleSort("total_work_hour")}
                  >
                    工時 <SortIcon col="total_work_hour" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => {
                  const key = projectKey(g);
                  const isCollapsed = !!collapsedProjects[key];
                  const meta = JOB_TYPE_META[g.job_type];
                  return (
                    <React.Fragment key={key}>
                      <TableRow
                        className="bg-gray-50/40 hover:bg-gray-50/60 cursor-pointer transition-colors border-b border-gray-100"
                        onClick={() =>
                          setCollapsedProjects((prev) => ({
                            ...prev,
                            [key]: !prev[key],
                          }))
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
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${meta.badgeClass}`}
                          >
                            {meta.short}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-3 text-xs font-mono text-gray-700">
                          <Link
                            href={jobTypeToRoute(g.job_type, g.project_id)}
                            className="text-bw-blue hover:underline"
                            title={jobTypeToDisplayType(g.job_type)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {g.project_code || "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="p-3 text-sm text-gray-800 truncate">
                          {g.project_name || "—"}
                        </TableCell>
                        <TableCell className="p-3 text-xs text-gray-600 tabular-nums">
                          {fmtDate(g.enquiry_date)}
                        </TableCell>
                        <TableCell className="p-3 text-xs text-gray-600">
                          {g.status_or_stage || "—"}
                        </TableCell>
                        <TableCell className="p-3 text-right font-mono text-sm text-gray-700 tabular-nums">
                          {g.staff_count}
                        </TableCell>
                        <TableCell className="p-3 text-right font-mono text-sm font-semibold text-gray-900 tabular-nums">
                          {fmtHours(g.total_work_hour)}
                        </TableCell>
                      </TableRow>

                      {!isCollapsed && (
                        <TableRow className="hover:bg-transparent border-b border-gray-200">
                          <TableCell colSpan={8} className="p-0 bg-slate-50/40">
                            <div className="px-3 py-3 pl-10 space-y-2">
                              {g.staff.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">
                                  沒有符合職位篩選的員工工時
                                </p>
                              ) : (
                                g.staff.map((s) => {
                                  const staffKey = `${key}:${s.staff_id}`;
                                  const staffOpen = !!expandedStaff[staffKey];
                                  return (
                                    <div
                                      key={staffKey}
                                      className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm"
                                    >
                                      <button
                                        type="button"
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                                        onClick={() =>
                                          setExpandedStaff((prev) => ({
                                            ...prev,
                                            [staffKey]: !prev[staffKey],
                                          }))
                                        }
                                      >
                                        {staffOpen ? (
                                          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                        ) : (
                                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                        )}
                                        <User className="w-3.5 h-3.5 text-bw-blue" />
                                        <span className="text-sm font-medium text-gray-800">
                                          {s.staff_name}
                                        </span>
                                        {s.position && (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] bg-white text-gray-500 border-gray-200"
                                          >
                                            {s.position}
                                          </Badge>
                                        )}
                                        <span className="ml-auto text-xs text-gray-500">
                                          {s.tasks.length} 項任務 ·{" "}
                                          <span className="font-semibold text-gray-800 tabular-nums">
                                            {fmtHours(s.total_work_hour)}h
                                          </span>
                                        </span>
                                      </button>

                                      {staffOpen && (
                                        <div className="border-t border-gray-100 overflow-x-auto">
                                          <Table>
                                            <TableHeader>
                                              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
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
                                                <TableHead className="w-[80px] text-[11px]">
                                                  圖片
                                                </TableHead>
                                                <TableHead className="w-[70px] text-right text-[11px]">
                                                  工時
                                                </TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {s.tasks.map((t) => {
                                                const attachments =
                                                  parseTaskAttachments(t.images);
                                                return (
                                                  <TableRow
                                                    key={t.id}
                                                    className="border-b border-gray-50"
                                                  >
                                                    <TableCell className="py-2 text-xs tabular-nums text-gray-600">
                                                      {fmtDate(t.report_date)}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-gray-600">
                                                      {t.task_type || "—"}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-gray-800">
                                                      <div>
                                                        {t.task_name || "—"}
                                                      </div>
                                                      {t.task_description && (
                                                        <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">
                                                          {t.task_description}
                                                        </div>
                                                      )}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-gray-600">
                                                      {fmtDeliverables(
                                                        t.deliverables
                                                      ) || "—"}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                      {attachments.length > 0 ? (
                                                        <div className="flex gap-1">
                                                          {attachments
                                                            .slice(0, 3)
                                                            .map((url, i) => (
                                                              <div
                                                                key={i}
                                                                className="w-8 h-8 rounded border border-gray-200 overflow-hidden bg-gray-50"
                                                              >
                                                                <AttachmentThumbnail
                                                                  url={url}
                                                                  className="w-full h-full"
                                                                />
                                                              </div>
                                                            ))}
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
                                                    <TableCell className="py-2 text-right font-mono text-xs tabular-nums text-gray-800">
                                                      {fmtHours(t.work_hour)}
                                                    </TableCell>
                                                  </TableRow>
                                                );
                                              })}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
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

      <ReportDateRangeNote>
        Note: This summary is based on man-hour records with a report date in
        the selected period.
      </ReportDateRangeNote>
    </div>
  );
}
