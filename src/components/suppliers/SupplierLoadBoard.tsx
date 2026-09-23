"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2, CalendarDays, Building2, User, Briefcase, LayoutGrid, List, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger} from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell} from "@/components/ui/table";
import {
  fetchSupplierLoadProjects,
  type SupplierLoadProject} from "@/lib/data-service";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";

// ─── HELPERS ────────────────────────────────────────────────
/** Parse an ISO/TZ date string to a local-midnight Date (date-only compare). */
function toDay(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  // Normalise to the calendar day in local time so day-level comparisons are clean.
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

const DAY_MS = 1000 * 60 * 60 * 24;

/** YYYY-MM-DD string for today, for the date input default. */
function todayInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── HANDOVER THRESHOLD FILTER ──────────────────────────────
// "hide" → drop any project whose handover is before the target date.
// number → allow projects handed over up to N days before the target date.
// "all"  → no upper bound (show every past project too).
type HandoverFilter = "hide" | 30 | 60 | 90 | 120 | 150 | 180 | "all";

const HANDOVER_OPTIONS: { value: string; label: string }[] = [
  { value: "hide", label: "隱藏已交場" },
  { value: "30", label: "已交場 30 天內" },
  { value: "60", label: "已交場 60 天內" },
  { value: "90", label: "已交場 90 天內" },
  { value: "120", label: "已交場 120 天內" },
  { value: "150", label: "已交場 150 天內" },
  { value: "180", label: "已交場 180 天內" },
  { value: "all", label: "所有過往項目" },
];

// ─── PROGRESS COMPUTATION ───────────────────────────────────
interface LoadRow extends SupplierLoadProject {
  progress: number;          // 0–100 (time elapsed start→handover at target date)
  daysAfterHandover: number; // >0 means target date is past handover by N days
  isHandedOver: boolean;
}

function computeRow(p: SupplierLoadProject, target: Date): LoadRow | null {
  const start = toDay(p.start_date);
  const handover = toDay(p.handover_date);
  if (!start || !handover) return null;

  const span = handover.getTime() - start.getTime();
  let progress: number;
  if (span <= 0) {
    progress = target.getTime() >= handover.getTime() ? 100 : 0;
  } else {
    progress = ((target.getTime() - start.getTime()) / span) * 100;
    progress = Math.max(0, Math.min(100, progress));
  }

  const daysAfterHandover = Math.floor((target.getTime() - handover.getTime()) / DAY_MS);

  return {
    ...p,
    progress: Math.round(progress),
    daysAfterHandover,
    isHandedOver: daysAfterHandover > 0};
}

// ─── PROGRESS BAR COLOR ─────────────────────────────────────
function progressColor(row: LoadRow): string {
  if (row.isHandedOver) return "bg-gray-400";
  if (row.progress >= 90) return "bg-red-500";
  if (row.progress >= 60) return "bg-amber-500";
  return "bg-emerald-500";
}

// ─── SUPPLIER GROUP ─────────────────────────────────────────
interface SupplierGroup {
  supplier_id: string;
  supplier_name: string | null;
  rows: LoadRow[];
  avgProgress: number;
  totalIncome: number;
}

export default function SupplierLoadBoard() {
  const { formatMoney } = useFinancialFormat();
  const { loading: permLoading } = usePermission();

  const [projects, setProjects] = useState<SupplierLoadProject[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [targetDateStr, setTargetDateStr] = useState<string>(todayInputValue());
  const [handoverFilter, setHandoverFilter] = useState<string>("60");

  // View Mode: 'table' or 'kanban'. Default is table.
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Collapsed suppliers state
  const [collapsedSuppliers, setCollapsedSuppliers] = useState<Record<string, boolean>>({});

  const handleExpandAll = () => {
    setCollapsedSuppliers({});
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    groups.forEach((g) => {
      next[g.supplier_id] = true;
    });
    setCollapsedSuppliers(next);
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      const rows = await fetchSupplierLoadProjects();
      setProjects(rows);
      setLoading(false);
    }
    load();
  }, []);

  const targetDate = useMemo(() => {
    const d = toDay(targetDateStr);
    return d ?? new Date();
  }, [targetDateStr]);

  // ─── FILTER + GROUP ───────────────────────────────────────
  const groups = useMemo(() => {
    const target = targetDate;
    const filter: HandoverFilter =
      handoverFilter === "hide" || handoverFilter === "all"
        ? (handoverFilter as HandoverFilter)
        : (Number(handoverFilter) as HandoverFilter);

    const matched: LoadRow[] = [];
    for (const p of projects) {
      const row = computeRow(p, target);
      if (!row) continue;

      const start = toDay(p.start_date)!;
      const handover = toDay(p.handover_date)!;

      // The target date must fall within the project window [start, handover]
      // OR be after handover (subject to the handover threshold filter below).
      // Projects that haven't started yet (target < start) are always excluded.
      if (target.getTime() < start.getTime()) continue;

      if (target.getTime() <= handover.getTime()) {
        // Active: target is inside the start→handover window. Always shown.
        matched.push(row);
        continue;
      }

      // Past handover — apply the handover threshold filter.
      if (filter === "hide") continue;
      if (filter === "all") {
        matched.push(row);
        continue;
      }
      // Numeric threshold: keep if handed over within `filter` days of target.
      if (row.daysAfterHandover <= filter) {
        matched.push(row);
      }
    }

    // Group by supplier.
    const map = new Map<string, SupplierGroup>();
    for (const row of matched) {
      let g = map.get(row.supplier_id);
      if (!g) {
        g = {
          supplier_id: row.supplier_id,
          supplier_name: row.supplier_name,
          rows: [],
          avgProgress: 0,
          totalIncome: 0};
        map.set(row.supplier_id, g);
      }
      g.rows.push(row);
    }

    const result = Array.from(map.values());
    for (const g of result) {
      g.rows.sort((a, b) => b.progress - a.progress);
      g.avgProgress = Math.round(
        g.rows.reduce((s, r) => s + r.progress, 0) / g.rows.length
      );
      g.totalIncome = g.rows.reduce((s, r) => s + (r.estimated_income || 0), 0);
    }
    // Busiest suppliers first (most active projects).
    result.sort((a, b) => b.rows.length - a.rows.length);
    return result;
  }, [projects, targetDate, handoverFilter]);

  const totalProjects = useMemo(
    () => groups.reduce((s, g) => s + g.rows.length, 0),
    [groups]
  );

  // ─── PERMISSION / LOADING ─────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
        <span className="ml-3 text-gray-500">載入供應商負載資料...</span>
      </div>
    );
  }

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">供應商負載 Supplier Load</h1>
          <p className="text-sm text-gray-500 mt-1">
            按主要承辦商檢視項目工作負載，完成度依開工日期至交場日期計算。
          </p>
        </div>

        {/* View Switch Tabs */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as "table" | "kanban")}
          className="self-start sm:self-auto"
        >
          <TabsList className="bg-white border border-gray-200 shadow-sm">
            <TabsTrigger
              value="table"
              className="data-[state=active]:bg-bw-blue data-[state=active]:text-white text-xs gap-1.5 px-3 py-1.5"
            >
              <List className="w-3.5 h-3.5" />
              表格檢視
            </TabsTrigger>
            <TabsTrigger
              value="kanban"
              className="data-[state=active]:bg-bw-blue data-[state=active]:text-white text-xs gap-1.5 px-3 py-1.5"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              看板檢視
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-5">
          {/* Target date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              目標日期 Target date
            </label>
            <Input
              type="date"
              value={targetDateStr}
              onChange={(e) => setTargetDateStr(e.target.value)}
              className="h-9 text-sm w-44"
            />
          </div>

          {/* Handover threshold */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">交場後篩選 Handover filter</label>
            <Select value={handoverFilter} onValueChange={setHandoverFilter}>
              <SelectTrigger className="h-9 text-sm w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HANDOVER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary & Table actions */}
          <div className="ml-auto flex items-center gap-4 text-sm text-gray-500">
            {viewMode === "table" && groups.length > 0 && (
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
              <span className="font-semibold text-gray-800">{groups.length}</span> 個供應商
            </span>
            <span>
              <span className="font-semibold text-gray-800">{totalProjects}</span> 個項目
            </span>
          </div>
        </div>
      </div>

      {/* View Switch Container */}
      {groups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg py-20 text-center text-gray-400 shadow-sm">
          沒有符合條件的供應商項目
        </div>
      ) : viewMode === "table" ? (
        /* Table View */
        <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/75 hover:bg-gray-50/75 border-b border-gray-200">
                  <TableHead className="w-[48px]"></TableHead>
                  <TableHead className="w-[130px] font-semibold text-gray-700 text-xs">項目代號</TableHead>
                  <TableHead className="min-w-[200px] font-semibold text-gray-700 text-xs">項目名稱</TableHead>
                  <TableHead className="w-[180px] font-semibold text-gray-700 text-xs">客戶</TableHead>
                  <TableHead className="w-[100px] font-semibold text-gray-700 text-xs">專案經理</TableHead>
                  <TableHead className="w-[200px] font-semibold text-gray-700 text-xs">工期</TableHead>
                  <TableHead className="w-[220px] font-semibold text-gray-700 text-xs">工作進度 (當前/交場)</TableHead>
                  <TableHead className="w-[130px] text-right font-semibold text-gray-700 text-xs">預估金額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => {
                  const isCollapsed = collapsedSuppliers[g.supplier_id];
                  return (
                    <React.Fragment key={g.supplier_id}>
                      {/* Supplier Group Header Row */}
                      <TableRow
                        className="bg-gray-50/40 hover:bg-gray-50/60 cursor-pointer transition-colors border-b border-gray-100 group/supplier"
                        onClick={() =>
                          window.open(`/suppliers/${g.supplier_id}`, "_blank", "noopener")
                        }
                      >
                        <TableCell
                          className="p-3.5 text-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCollapsedSuppliers((prev) => ({
                              ...prev,
                              [g.supplier_id]: !prev[g.supplier_id],
                            }));
                          }}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-gray-400 mx-auto transition-transform hover:text-bw-blue" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 mx-auto transition-transform hover:text-bw-blue" />
                          )}
                        </TableCell>
                        <TableCell colSpan={7} className="p-3.5">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <Building2 className="w-4 h-4 text-bw-blue" />
                              <span className="font-semibold text-gray-800 text-sm group-hover/supplier:text-bw-blue transition-colors">
                                {g.supplier_name || "未命名供應商"}
                              </span>
                              <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-600 border-blue-200 font-medium">
                                {g.rows.length} 項目
                              </Badge>
                              <span className="text-[11px] text-gray-500 font-normal">
                                平均進度: <span className="text-gray-700 font-semibold">{g.avgProgress}%</span>
                              </span>
                            </div>
                            {g.totalIncome > 0 && (
                              <div className="text-xs font-semibold text-gray-700 bg-gray-100/80 px-2.5 py-1 rounded border border-gray-200">
                                總額: {formatMoney(g.totalIncome)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Project Rows under this supplier group */}
                      {!isCollapsed &&
                        g.rows.map((row) => (
                          <TableRow
                            key={`${row.source}-${row.id}`}
                            className="hover:bg-slate-50/40 transition-colors group cursor-pointer border-b border-gray-100"
                            onClick={() =>
                              window.open(
                                `/projects/${row.source === "bwf" ? "bwf" : "bwa"}/${row.id}`,
                                "_blank",
                                "noopener"
                              )
                            }
                          >
                            <TableCell className="p-3"></TableCell>
                            <TableCell className="p-3 font-mono text-xs text-gray-500">
                              {row.project_code || "—"}
                            </TableCell>
                            <TableCell className="p-3">
                              <div className="flex items-center gap-2 max-w-md">
                                <span className="text-sm font-medium text-gray-900 group-hover:text-bw-blue transition-colors line-clamp-1">
                                  {row.project_name || "—"}
                                </span>
                                {row.source === "bwf" ? (
                                  <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-600 border-purple-200 flex-shrink-0 scale-90">
                                    傢俬
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 flex-shrink-0 scale-90">
                                    裝修
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="p-3 text-xs text-gray-600 truncate max-w-[180px]">
                              {row.customer_name || "—"}
                            </TableCell>
                            <TableCell className="p-3 text-xs text-gray-600 truncate">
                              {row.pm_name || "—"}
                            </TableCell>
                            <TableCell className="p-3 text-xs text-gray-500">
                              <div className="flex items-center gap-1.5 font-mono">
                                <span>{fmtDate(row.start_date)}</span>
                                <span className="text-gray-300">→</span>
                                <span>{fmtDate(row.handover_date)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="p-3">
                              <div className="w-full">
                                <div className="flex items-center justify-between text-[11px] mb-1">
                                  <span className="text-gray-500">
                                    {row.isHandedOver ? `已交場 ${row.daysAfterHandover} 天` : "當前進度"}
                                  </span>
                                  <span className="font-semibold text-gray-700">{row.progress}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${progressColor(row)}`}
                                    style={{ width: `${row.progress}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="p-3 text-right font-mono text-xs text-gray-700 font-medium">
                              {formatMoney(row.estimated_income)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        /* Kanban View */
        <div className="flex gap-4 overflow-x-auto pb-4 animate-in fade-in duration-300">
          {groups.map((g) => (
            <div
              key={g.supplier_id}
              className="flex-shrink-0 w-[320px] bg-gray-50/70 border border-gray-200 rounded-xl flex flex-col max-h-[calc(100vh-280px)] shadow-sm"
            >
              {/* Column header */}
              <div
                className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-xl sticky top-0 cursor-pointer hover:bg-gray-50/80 transition-colors group/supplier"
                onClick={() =>
                  window.open(`/suppliers/${g.supplier_id}`, "_blank", "noopener")
                }
                title="開啟供應商詳情"
              >
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-bw-blue mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm font-semibold text-gray-800 truncate group-hover/supplier:text-bw-blue transition-colors"
                      title={g.supplier_name || ""}
                    >
                      {g.supplier_name || "未命名供應商"}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-600 border-blue-200">
                        {g.rows.length} 項目
                      </Badge>
                      <span className="text-[11px] text-gray-400">
                        平均 {g.avgProgress}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-3 overflow-y-auto">
                {g.rows.map((row) => (
                  <div
                    key={`${row.source}-${row.id}`}
                    className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-gray-300"
                    onClick={() =>
                      window.open(
                        `/projects/${row.source === "bwf" ? "bwf" : "bwa"}/${row.id}`,
                        "_blank",
                        "noopener"
                      )
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] font-medium text-gray-900 line-clamp-2 flex-1">
                        {row.project_name || "—"}
                      </div>
                      {row.source === "bwf" && (
                        <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-600 border-purple-200 flex-shrink-0">
                          傢俬
                        </Badge>
                      )}
                    </div>
                    {row.project_code && (
                      <div className="text-[11px] text-gray-400 font-mono mt-0.5">{row.project_code}</div>
                    )}

                    {/* Progress bar */}
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-gray-500">
                          {row.isHandedOver ? `已交場 ${row.daysAfterHandover} 天` : "進度"}
                        </span>
                        <span className="font-semibold text-gray-700">{row.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${progressColor(row)}`}
                          style={{ width: `${row.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="mt-2.5 space-y-1 text-[11px] text-gray-500">
                      <div className="flex items-center gap-1.5 font-mono">
                        <CalendarDays className="w-3 h-3 flex-shrink-0" />
                        <span>{fmtDate(row.start_date)} → {fmtDate(row.handover_date)}</span>
                      </div>
                      {row.customer_name && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Briefcase className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{row.customer_name}</span>
                        </div>
                      )}
                      {row.pm_name && (
                        <div className="flex items-center gap-1.5 truncate">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{row.pm_name}</span>
                        </div>
                      )}
                      {row.estimated_income != null && row.estimated_income > 0 && (
                        <div className="text-gray-600 font-medium font-mono">{formatMoney(row.estimated_income)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
