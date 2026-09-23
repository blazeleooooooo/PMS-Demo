"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Search,
  ListOrdered,
  Clock,
  Layers,
  Gauge,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { AttachmentLightbox, type AttachmentLightboxImage } from "@/components/ui/attachment-lightbox";
import { AttachmentThumbnail } from "@/components/ui/attachment-thumbnail";
import {
  fetchThreeDOutputReport,
  jobTypeToRoute,
  TEAM_TYPE_ID_3D_RENDER,
  type ThreeDOutputReportRow,
} from "@/lib/man-hour-service";
import {
  resolveRange,
  fmtRangeDate as fmtDate,
} from "@/lib/report-date-range";
import { useReportRange, filterBySources } from "@/components/reports/ReportDateRangeContext";
import ReportFilterStack from "@/components/reports/ReportFilterStack";
import {
  EMPTY_STAFF_FILTERS,
  staffIdMatchesFilter,
  type StaffFilterState,
} from "@/components/reports/StaffFilterBar";
import { useAlignedReportFilters } from "@/hooks/use-aligned-report-filters";
import type { StaffDirectoryRow } from "@/lib/data/staff";

/** Page defaults: 團隊 = 3D Render (by id), 職位 unlocked. */
const DEFAULT_STAFF_FILTER: StaffFilterState = {
  ...EMPTY_STAFF_FILTERS,
  team: TEAM_TYPE_ID_3D_RENDER,
  position: "all",
};

type SortCol =
  | "month_key"
  | "project_name"
  | "images"
  | "is_converted"
  | "total_work_hour"
  | "completed_sheets"
  | "hours_per_sheet"
  | "revision_count"
  | "used_ai"
  | "main_3d_tool"
  | "task";

const PREVIEW_THUMB_COUNT = 3;

function toYmd(d: Date | null | undefined): string | null {
  if (!d || isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 時間/成果 = 完成總工時 ÷ 完成張；no sheets → NaN (display —). */
function hoursPerSheet(r: ThreeDOutputReportRow): number {
  if (!r.completed_sheets || r.completed_sheets <= 0) return Number.NaN;
  return r.total_work_hour / r.completed_sheets;
}

function fmtHoursPerSheet(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function fmtHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  borderColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  borderColor: string;
}) {
  return (
    <div
      className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 ${borderColor} transition-all hover:shadow-md`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900 font-mono-num">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function ThreeDOutputReport() {
  const [rows, setRows] = useState<ThreeDOutputReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const [search, setSearch] = useState("");
  const { range, custom, sources, setRange } = useReportRange();
  // business scope: no Designer position lock; we set 3D Render team ourselves.
  const { staffFilter, setStaffFilter, isSuperAdmin } =
    useAlignedReportFilters("business");
  const [sortCol, setSortCol] = useState<SortCol>("month_key");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const didInitDefaults = useRef(false);
  const [defaultsReady, setDefaultsReady] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<AttachmentLightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Default: This Month + 團隊 3D Render + 職位 all.
  useEffect(() => {
    if (!didInitDefaults.current) {
      didInitDefaults.current = true;
      setRange("thisMonth");
      setStaffFilter(DEFAULT_STAFF_FILTER);
    }
    setDefaultsReady(true);
  }, [setRange, setStaffFilter]);

  const window = useMemo(
    () => resolveRange(range, new Date(), custom),
    [range, custom]
  );

  useEffect(() => {
    if (!defaultsReady) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const from = toYmd(window.from);
        const to = toYmd(window.to);
        const data = await fetchThreeDOutputReport(from, to);
        if (!cancelled) setRows(data);
      } catch (err) {
        console.error("[ThreeDOutputReport] load error:", err);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [defaultsReady, window.from, window.to]);

  const sourceRows = useMemo(
    () => filterBySources(rows, sources),
    [rows, sources]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sourceRows.filter((r) => {
      if (q) {
        const hay = `${r.project_name} ${r.task}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (!r.staff_ids.length) {
        return staffIdMatchesFilter(null, staffFilter, staffDirectory);
      }
      return r.staff_ids.some((sid) =>
        staffIdMatchesFilter(sid, staffFilter, staffDirectory)
      );
    });
  }, [sourceRows, search, staffFilter, staffDirectory]);

  const visibleRows = useMemo(() => {
    const valueFor = (r: ThreeDOutputReportRow): number | string => {
      switch (sortCol) {
        case "month_key":
          return r.month_key;
        case "project_name":
          return r.project_name.toLowerCase();
        case "images":
          return r.images.length;
        case "is_converted":
          return r.is_converted ? 1 : 0;
        case "total_work_hour":
          return r.total_work_hour;
        case "completed_sheets":
          return r.completed_sheets;
        case "hours_per_sheet": {
          const v = hoursPerSheet(r);
          return Number.isFinite(v) ? v : Number.POSITIVE_INFINITY;
        }
        case "revision_count":
          return r.revision_count;
        case "used_ai":
          return r.ai_tools_used.length
            ? r.ai_tools_used.join(", ")
            : r.used_ai
              ? "AI"
              : "";
        case "main_3d_tool":
          return r.main_3d_tool;
        case "task":
          return r.task;
      }
    };
    return [...filteredRows].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv, "zh-HK")
          : bv.localeCompare(av, "zh-HK");
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [filteredRows, sortCol, sortDir]);

  function staffNamesFor(r: ThreeDOutputReportRow): string | null {
    const names = r.staff_ids
      .map((id) => staffDirectory.find((s) => s.id === id)?.name)
      .filter((n): n is string => !!n && n.trim().length > 0);
    return names.length ? names.join("、") : null;
  }

  function openRowLightbox(r: ThreeDOutputReportRow, startIndex: number) {
    if (!r.images.length) return;
    const staffName = staffNamesFor(r);
    setLightboxImages(
      r.images.map((url) => ({
        url,
        title: r.project_name,
        taskDescription: r.task,
        staffName,
        taskImageCount: r.images.length,
      }))
    );
    setLightboxIndex(startIndex);
    setLightboxOpen(true);
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(col === "project_name" || col === "task" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline" />;
    }
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1 text-bw-blue inline" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 text-bw-blue inline" />
    );
  }

  function Th({
    col,
    children,
    right,
    className = "",
  }: {
    col: SortCol;
    children: React.ReactNode;
    right?: boolean;
    className?: string;
  }) {
    return (
      <TableHead
        className={`text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap ${right ? "text-right" : ""} ${className}`}
        onClick={() => handleSort(col)}
      >
        <span className={`flex items-center ${right ? "justify-end" : ""}`}>
          {children}
          <SortIcon col={col} />
        </span>
      </TableHead>
    );
  }

  const rangeLabel =
    window.from || window.to
      ? `From ${fmtDate(window.from)} to ${fmtDate(window.to)}`
      : "All Time";

  const metrics = useMemo(() => {
    let totalHour = 0;
    let totalOutput = 0;
    for (const r of filteredRows) {
      totalHour += r.total_work_hour || 0;
      totalOutput += r.completed_sheets || 0;
    }
    totalHour = Math.round(totalHour * 10) / 10;
    const avgHoursPerSheet =
      totalOutput > 0 ? totalHour / totalOutput : Number.NaN;
    return {
      totalCount: filteredRows.length,
      totalHour,
      totalOutput,
      avgHoursPerSheet,
    };
  }, [filteredRows]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">3D數量統計</h2>
        <p className="text-sm text-gray-500 mt-1">
          需提交成果的工時任務彙總（{rangeLabel}）
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={ListOrdered}
          label="總筆數"
          value={loading ? "…" : metrics.totalCount}
          color="bg-blue-500"
          borderColor="border-l-blue-500"
        />
        <StatCard
          icon={Clock}
          label="總工時"
          value={loading ? "…" : fmtHours(metrics.totalHour)}
          color="bg-amber-500"
          borderColor="border-l-amber-500"
        />
        <StatCard
          icon={Layers}
          label="總完成張"
          value={loading ? "…" : metrics.totalOutput}
          color="bg-teal-500"
          borderColor="border-l-teal-500"
        />
        <StatCard
          icon={Gauge}
          label="平均時間/成果"
          value={loading ? "…" : fmtHoursPerSheet(metrics.avgHoursPerSheet)}
          color="bg-violet-500"
          borderColor="border-l-violet-500"
        />
      </div>

      <ReportFilterStack
        showProject={false}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        staffLocks={{}}
        staffClearTo={DEFAULT_STAFF_FILTER}
        isSuperAdmin={isSuperAdmin}
        onStaffDirectoryLoaded={(dir) => {
          setStaffDirectory(dir);
        }}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋項目名稱、任務…"
          className="pl-9 h-9 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-bw-blue" />
          <span className="ml-3 text-gray-500 text-sm">載入報表資料...</span>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="text-xs font-semibold text-gray-600 w-12 text-center">
                    #
                  </TableHead>
                  <Th col="month_key">日期</Th>
                  <Th col="project_name">項目名稱</Th>
                  <Th col="is_converted" className="text-center">
                    是否成交
                  </Th>
                  <Th col="total_work_hour" right>
                    完成總工時
                  </Th>
                  <Th col="completed_sheets" right>
                    完成張
                  </Th>
                  <Th col="images">成果圖</Th>
                  <Th col="hours_per_sheet" right>
                    時間/成果
                  </Th>
                  <Th col="revision_count" right>
                    修改次
                  </Th>
                  <Th col="used_ai" className="text-center">
                    是否使用AI
                  </Th>
                  <Th col="main_3d_tool">主要使用的3D工具</Th>
                  <Th col="task">任務</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={12}
                      className="text-center py-16 text-gray-400"
                    >
                      此期間沒有需提交成果的工時記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row, idx) => {
                    const href =
                      row.project_id && row.job_type
                        ? jobTypeToRoute(row.job_type, row.project_id)
                        : undefined;
                    return (
                      <TableRow
                        key={row.key}
                        className="hover:bg-gray-50/80 border-b border-gray-100"
                      >
                        <TableCell className="text-sm text-center text-gray-500 font-mono">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 whitespace-nowrap font-mono">
                          {row.month_label}
                        </TableCell>
                        <TableCell className="text-sm text-gray-900 max-w-[280px]">
                          {href ? (
                            <Link
                              href={href}
                              className="text-bw-blue hover:underline line-clamp-2"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {row.project_name}
                            </Link>
                          ) : (
                            <span className="line-clamp-2">{row.project_name}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-center whitespace-nowrap">
                          <span
                            className={
                              row.is_converted
                                ? "text-emerald-700"
                                : "text-gray-500"
                            }
                          >
                            {row.is_converted ? "是" : "否"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono text-gray-700 whitespace-nowrap">
                          {fmtHours(row.total_work_hour)}小時
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono text-gray-700 whitespace-nowrap">
                          {row.completed_sheets}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {row.images.length === 0 ? (
                            <span className="text-gray-400 text-sm">—</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              {row.images.slice(0, PREVIEW_THUMB_COUNT).map((url, i) => (
                                <button
                                  key={`${url}-${i}`}
                                  type="button"
                                  className="w-7 h-7 rounded border border-gray-200 overflow-hidden bg-gray-50 shrink-0 hover:ring-1 hover:ring-bw-blue"
                                  title={`${row.images.length} 張成果圖`}
                                  onClick={() => openRowLightbox(row, i)}
                                >
                                  <AttachmentThumbnail
                                    url={url}
                                    alt=""
                                    className="w-7 h-7"
                                    imgClassName="w-7 h-7 object-cover"
                                    previewWidth={56}
                                  />
                                </button>
                              ))}
                              {row.images.length > PREVIEW_THUMB_COUNT && (
                                <button
                                  type="button"
                                  className="text-[11px] font-medium text-gray-500 hover:text-bw-blue whitespace-nowrap"
                                  onClick={() => openRowLightbox(row, PREVIEW_THUMB_COUNT)}
                                >
                                  +{row.images.length - PREVIEW_THUMB_COUNT}
                                </button>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell
                          className="text-sm text-right font-mono text-gray-700 whitespace-nowrap"
                          title="完成總工時 ÷ 完成張"
                        >
                          {Number.isFinite(hoursPerSheet(row))
                            ? `${fmtHoursPerSheet(hoursPerSheet(row))}小時/成果`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono text-gray-700 whitespace-nowrap">
                          {row.revision_count}
                        </TableCell>
                        <TableCell className="text-sm text-center max-w-[220px]">
                          {row.ai_tools_used.length > 0 ? (
                            <span
                              className="text-violet-700"
                              title={row.ai_tools_used.join("、")}
                            >
                              {row.ai_tools_used.join("、")}
                            </span>
                          ) : row.used_ai ? (
                            <span className="text-violet-700">AI</span>
                          ) : (
                            <span className="text-gray-500">否</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 whitespace-nowrap">
                          {row.main_3d_tool}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 whitespace-nowrap">
                          {row.task}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {visibleRows.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">
              共 {visibleRows.length} 列 · 時間/成果 = 完成總工時 ÷ 完成張 · 修改次 = 成果階段為「未完成初稿」的任務數
            </div>
          )}
        </div>
      )}

      <AttachmentLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        images={lightboxImages}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}
