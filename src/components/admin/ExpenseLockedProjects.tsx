"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Lock,
  CalendarClock,
  RefreshCw,
  ExternalLink,
  Eye,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectStatusBadge } from "@/components/ui/entity-status-badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import ProjectFilterBar, {
  applyProjectFilters,
  EMPTY_PROJECT_FILTERS,
  type ProjectFilterState,
} from "@/components/reports/ProjectFilterBar";
import {
  EXPENSE_CONTROL_ITEM_LABELS,
  OVERDUE_INCOME_EXPECTED_DATE_ITEM_KEY,
} from "@/lib/expense-control-waiver-service";

type PmOption = { id: string; name: string };

function normalizeRole(role: string | null | undefined): string {
  return (role || "").trim().toLowerCase();
}

function isSuperAdminRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r.includes("super") && r.includes("admin");
}

function isAdminRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  if (isSuperAdminRole(role)) return true;
  return r === "admin" || (r.includes("admin") && !r.includes("non") && !r.includes("super"));
}

function isSeniorUserRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === "senior user" || (r.includes("senior") && r.includes("user"));
}

/** Who may switch the Aug-14 Site Status list to another staff's Main-PM projects. */
function canSwitchPmViewer(role: string | null | undefined): boolean {
  return isAdminRole(role) || isSeniorUserRole(role);
}

/** Sentinel for Admin / Super Admin: load projects for every Main PM. */
const VIEW_ALL_STAFF_ID = "__all__";

// A restricted project carries the unmet checklist items so the admin can see
// WHY it's locked without opening each project. Shape matches the
// /api/expense-locked response (which mirrors evaluateExpenseControl) plus the
// fields ProjectFilterBar needs (BU, service/project type, size, FY).
interface LockedRow {
  id: string;
  project_code: string | null;
  project_name: string | null;
  status: string | null;
  signed_date: string | null;
  size: string | null;
  project_size: string | null;
  pm_name: string | null;
  customer_name: string | null;
  n_financial_year_id: string | null;
  financial_year_name: string | null;
  cost_centre_bu_code: string | null;
  service_type_name: string | null;
  project_type_name: string | null;
  est_income: number | null;
  expense_count: number;
  tier: "high" | "mid";
  failedItems: string[];
  failedKeys?: string[];
  passedCount: number;
  activeItemCount: number;
}

const UNMET_FILTER_ALL = "all";

function rowHasUnmetKey(row: LockedRow, key: string): boolean {
  if (row.failedKeys?.includes(key)) return true;
  const label = EXPENSE_CONTROL_ITEM_LABELS[key];
  if (!label) return false;
  return row.failedItems.some(
    (item) => item === label || item.startsWith(`${label} `) || item.startsWith(`${label}(`)
  );
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}


type SortField =
  | "project_code"
  | "project_name"
  | "customer_name"
  | "pm_name"
  | "cost_centre_bu_code"
  | "status"
  | "signed_date"
  | "expense_count";

type ExpenseLockedVariant = "admin" | "staff-deadline";

interface ExpenseLockedProjectsProps {
  variant?: ExpenseLockedVariant;
}

export default function ExpenseLockedProjects({
  variant = "admin",
}: ExpenseLockedProjectsProps) {
  const { staff, isLoading: authLoading } = useAuth();
  const isStaffDeadline = variant === "staff-deadline";
  const staffRole = (staff as { role?: string } | null)?.role ?? null;
  const staffTeamId = (staff as { n_team_type_id?: string | null } | null)?.n_team_type_id ?? null;
  const showPmViewer = isStaffDeadline && canSwitchPmViewer(staffRole);

  const [rows, setRows] = useState<LockedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ProjectFilterState>(EMPTY_PROJECT_FILTERS);
  const [unmetKey, setUnmetKey] = useState<string>(UNMET_FILTER_ALL);
  const [sortField, setSortField] = useState<SortField>("signed_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // Role-scoped "view as Main PM" — defaults to the logged-in staff.
  const [viewPmId, setViewPmId] = useState<string>("");
  const [pmOptions, setPmOptions] = useState<PmOption[]>([]);
  const [pmOptionsLoading, setPmOptionsLoading] = useState(false);

  const isAdminViewer = isAdminRole(staffRole);

  // Keep viewPmId aligned when auth resolves: Admin defaults to all staff;
  // Senior User / User defaults to self.
  useEffect(() => {
    if (!staff?.id) return;
    if (!showPmViewer) {
      setViewPmId(staff.id);
      return;
    }
    setViewPmId((prev) => {
      if (prev) return prev;
      return isAdminViewer ? VIEW_ALL_STAFF_ID : staff.id;
    });
  }, [staff?.id, showPmViewer, isAdminViewer]);

  // Load selectable Active staff for Senior User (same team) / Admin / Super Admin.
  useEffect(() => {
    if (!isStaffDeadline || !showPmViewer || !staff?.id) {
      setPmOptions([]);
      return;
    }

    let cancelled = false;
    async function loadPmOptions() {
      setPmOptionsLoading(true);
      const supabase = createClient();
      let query = supabase
        .from("staff")
        .select("id, name")
        .eq("status", "Active")
        .order("name", { ascending: true });

      if (isSeniorUserRole(staffRole) && !isAdminRole(staffRole)) {
        if (!staffTeamId) {
          // No team → only self is selectable.
          if (!cancelled) {
            setPmOptions([
              {
                id: staff!.id,
                name: staff!.name || staff!.full_name || "我",
              },
            ]);
            setPmOptionsLoading(false);
          }
          return;
        }
        query = query.eq("n_team_type_id", staffTeamId);
      }

      const { data, error } = await query;
      if (cancelled) return;
      if (error || !data) {
        const fallback: PmOption[] = [
          { id: staff!.id, name: staff!.name || staff!.full_name || "我" },
        ];
        setPmOptions(
          isAdminRole(staffRole)
            ? [{ id: VIEW_ALL_STAFF_ID, name: "全部職員" }, ...fallback]
            : fallback
        );
      } else {
        const opts: PmOption[] = data
          .filter((s: { id: string; name: string | null }) => !!s.name)
          .map((s: { id: string; name: string | null }) => ({
            id: s.id,
            name: s.name!,
          }));
        // Ensure current user is always in the list.
        if (!opts.some((o: PmOption) => o.id === staff!.id)) {
          opts.unshift({
            id: staff!.id,
            name: staff!.name || staff!.full_name || "我",
          });
        }
        if (isAdminRole(staffRole)) {
          opts.unshift({ id: VIEW_ALL_STAFF_ID, name: "全部職員" });
        }
        setPmOptions(opts);
      }
      setPmOptionsLoading(false);
    }

    loadPmOptions();
    return () => {
      cancelled = true;
    };
  }, [isStaffDeadline, showPmViewer, staff?.id, staff?.name, staff?.full_name, staffRole, staffTeamId]);

  async function load() {
    if (isStaffDeadline && !staff?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    const targetId = isStaffDeadline
      ? viewPmId || (isAdminViewer ? VIEW_ALL_STAFF_ID : staff!.id)
      : null;
    if (isStaffDeadline && !targetId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // The heavy checklist evaluation runs server-side (one bulk pass) so the
    // page no longer fires thousands of per-project queries from the browser.
    try {
      const url = isStaffDeadline
        ? `/api/expense-locked/staff-deadline?staffId=${encodeURIComponent(targetId!)}`
        : "/api/expense-locked";
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      setRows(json.success ? (json.projects as LockedRow[]) : []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;
    // Staff-deadline can load as soon as auth resolves; viewPmId falls back to staff.id.
    if (isStaffDeadline && !staff?.id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, staff?.id, authLoading, viewPmId]);

  const visibleRows = useMemo(() => {
    // Apply the shared /projects/bwa filter set (status, PM, BU, service/project
    // type, size, financial year, B2B/B2C, search). Filter by id so the result
    // keeps the ExpenseLockedProject subtype (customer_name / expense_count).
    const keepIds = new Set(applyProjectFilters(rows, filters).map((p) => p.id));
    const result = rows.filter((r) => {
      if (!keepIds.has(r.id)) return false;
      if (!isStaffDeadline && unmetKey !== UNMET_FILTER_ALL) {
        return rowHasUnmetKey(r, unmetKey);
      }
      return true;
    });
    const valueFor = (r: LockedRow): number | string => {
      switch (sortField) {
        case "project_code":
          return (r.project_code || "").toLowerCase();
        case "project_name":
          return (r.project_name || "").toLowerCase();
        case "customer_name":
          return (r.customer_name || "").toLowerCase();
        case "pm_name":
          return (r.pm_name || "").toLowerCase();
        case "cost_centre_bu_code":
          return (r.cost_centre_bu_code || "").toLowerCase();
        case "status":
          return (r.status || "").toLowerCase();
        case "signed_date":
          return r.signed_date ? new Date(r.signed_date).getTime() : 0;
        case "expense_count":
          return r.expense_count;
      }
    };
    return [...result].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [rows, filters, sortField, sortDir, unmetKey, isStaffDeadline]);

  const unmetOptions = useMemo(() => {
    const present = new Set<string>();
    for (const row of rows) {
      for (const key of row.failedKeys ?? []) present.add(key);
    }
    const known = Object.keys(EXPENSE_CONTROL_ITEM_LABELS).filter((key) =>
      present.has(key)
    );
    if (present.has(OVERDUE_INCOME_EXPECTED_DATE_ITEM_KEY)
      && !known.includes(OVERDUE_INCOME_EXPECTED_DATE_ITEM_KEY)) {
      known.unshift(OVERDUE_INCOME_EXPECTED_DATE_ITEM_KEY);
    }
    return known;
  }, [rows]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(
        field === "signed_date" || field === "expense_count" ? "desc" : "asc"
      );
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1 text-bw-blue inline" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 text-bw-blue inline" />
    );
  }

  function Th({
    field,
    children,
    right}: {
    field: SortField;
    children: React.ReactNode;
    right?: boolean;
  }) {
    return (
      <TableHead
        className={`text-xs font-semibold text-gray-600 cursor-pointer hover:text-bw-blue whitespace-nowrap ${right ? "text-right" : ""}`}
        onClick={() => handleSort(field)}
      >
        <span className={`flex items-center gap-0.5 ${right ? "justify-end" : ""}`}>
          {children}
          <SortIcon field={field} />
        </span>
      </TableHead>
    );
  }

  const viewingAllStaff = viewPmId === VIEW_ALL_STAFF_ID;
  const viewingSelf = !viewingAllStaff && (!viewPmId || viewPmId === staff?.id);
  const viewingPmName = viewingAllStaff
    ? "全部職員"
    : pmOptions.find((o) => o.id === viewPmId)?.name ||
      (viewingSelf ? staff?.name || staff?.full_name || null : null);

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {isStaffDeadline ? (
              <CalendarClock className="w-6 h-6 text-amber-500" />
            ) : (
              <Lock className="w-6 h-6 text-amber-500" />
            )}
            {isStaffDeadline
              ? "14/8前必須完成 — 工地狀況 Site Status"
              : "支出鎖定項目 Expense-Locked Projects"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isStaffDeadline ? (
              <>
                {viewingAllStaff ? (
                  <>
                    顯示全部主要 PM、項目規模 ≥ $250-500K中小型、服務類型與項目類型均標記「需填工地狀況」，
                    且工地狀況填寫未達 90% 的項目（適用條件與完成度計算均與項目詳情 Expense Control 一致）。
                  </>
                ) : viewingSelf ? (
                  <>
                    顯示你作為主要 PM、項目規模 ≥ $250-500K中小型、服務類型與項目類型均標記「需填工地狀況」，
                    且工地狀況填寫未達 90% 的項目（適用條件與完成度計算均與項目詳情 Expense Control 一致）。
                  </>
                ) : (
                  <>
                    顯示{" "}
                    <span className="font-medium text-amber-800">
                      {viewingPmName || "所選職員"}
                    </span>{" "}
                    作為主要 PM、項目規模 ≥ $250-500K中小型、服務類型與項目類型均標記「需填工地狀況」，
                    且工地狀況填寫未達 90% 的項目。
                  </>
                )}
                {!loading && (
                  <span className="ml-1 text-gray-400">共 {rows.length} 個項目待完成。</span>
                )}
              </>
            ) : (
              <>
                未完成「Expense Control」清單的項目，其支出 (Expense) 新增及編輯被鎖定（與項目詳情的
                Expense Control 分頁邏輯一致）。已於成本中心設定為不適用的 BU 不會出現在此清單。
                「逾期收入已填寫預計收款日期」不計收款狀態為 Received 的收入。
                {!loading && (
                  <span className="ml-1 text-gray-400">
                    {unmetKey !== UNMET_FILTER_ALL
                      ? `顯示 ${visibleRows.length} / ${rows.length} 個項目。`
                      : `共 ${rows.length} 個項目被鎖定。`}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9 gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 重新整理
        </Button>
      </div>

      {/* ─── ROLE-SCOPED PM VIEWER (staff-deadline only; replaces ProjectFilterBar PM) ── */}
      {showPmViewer && (
        <div className="rounded-lg border border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50/40 to-white px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 border border-amber-200">
              <Eye className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-950 leading-tight flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                切換查看職員
              </p>
              <p className="text-[12px] text-amber-800/70 mt-0.5">
                {isAdminViewer
                  ? "Admin / Super Admin：預設全部職員，亦可選個別 Active 職員"
                  : "Senior User：僅可選擇同團隊 Active 職員"}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px] text-amber-700/80 whitespace-nowrap hidden sm:inline">
              主要 PM
            </span>
            <Select
              value={viewPmId || (isAdminViewer ? VIEW_ALL_STAFF_ID : staff?.id || "")}
              onValueChange={(v) => {
                setViewPmId(v);
                setFilters(EMPTY_PROJECT_FILTERS);
              }}
              disabled={pmOptionsLoading || pmOptions.length === 0}
            >
              <SelectTrigger className="w-[220px] h-9 text-sm bg-white border-amber-300 focus:ring-amber-400/40 shadow-none">
                <SelectValue placeholder={pmOptionsLoading ? "載入中…" : "選擇職員"} />
              </SelectTrigger>
              <SelectContent>
                {pmOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.id === staff?.id ? "（我）" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* ─── ULTIMATE PROJECT FILTER (same as /business-reports & /projects/bwa) ── */}
      <ProjectFilterBar
        projects={rows}
        value={filters}
        onChange={setFilters}
        hidePmFilter={isStaffDeadline}
      />

      {!isStaffDeadline && unmetOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-gray-500">未完成項目</span>
          <Select value={unmetKey} onValueChange={setUnmetKey}>
            <SelectTrigger className="w-[320px] h-9 text-sm bg-white">
              <SelectValue placeholder="全部未完成項目" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNMET_FILTER_ALL}>全部未完成項目</SelectItem>
              {unmetOptions.map((key) => (
                <SelectItem key={key} value={key}>
                  {EXPENSE_CONTROL_ITEM_LABELS[key] || key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ─── TABLE ──────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-bw-blue" />
          <span className="ml-3 text-gray-500 text-sm">載入項目資料...</span>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <Th field="project_code">項目編號 Code</Th>
                  <Th field="project_name">項目名稱 Name</Th>
                  <Th field="customer_name">客戶 Customer</Th>
                  <Th field="pm_name">主要PM Main PM</Th>
                  <Th field="cost_centre_bu_code">BU</Th>
                  <Th field="signed_date">簽約日期 Signed</Th>
                  <Th field="status">狀態 Status</Th>
                  <TableHead className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                    {isStaffDeadline ? "待辦 Pending" : "未完成項目 Unmet Items"}
                  </TableHead>
                  {!isStaffDeadline && (
                    <Th field="expense_count" right>現有支出 Expenses</Th>
                  )}
                  <TableHead className="text-xs font-semibold text-gray-600 text-right whitespace-nowrap">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isStaffDeadline ? 9 : 10}
                      className="text-center py-16 text-gray-400"
                    >
                      {rows.length === 0
                        ? isStaffDeadline
                          ? viewingAllStaff
                            ? "所有符合條件的項目工地狀況均已達 90% 🎉"
                            : viewingSelf
                              ? "你名下符合條件的項目工地狀況均已達 90% 🎉"
                              : `${viewingPmName || "該職員"}名下符合條件的項目工地狀況均已達 90% 🎉`
                          : "所有項目都已完成 Expense Control 清單 🎉"
                        : "沒有找到符合條件的項目"}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-gray-50/80 border-b border-gray-100"
                    >
                      <TableCell className="text-sm font-medium text-gray-900 whitespace-nowrap">
                        {row.project_code || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 max-w-[260px] truncate">
                        {row.project_name || "(未命名)"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                        {row.customer_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                        {row.pm_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                        {row.cost_centre_bu_code || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 font-mono whitespace-nowrap">
                        {fmtDate(row.signed_date)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <ProjectStatusBadge status={row.status} className="text-[11px]" />
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="flex flex-wrap gap-1">
                          {row.failedItems.length === 0 ? (
                            <span className="text-gray-300 text-sm">—</span>
                          ) : (
                            row.failedItems.map((item, i) => (
                              <span
                                key={i}
                                className="inline-block text-[11px] leading-tight px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-600"
                              >
                                {item}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                      {!isStaffDeadline && (
                        <TableCell
                          className={`text-sm text-right font-mono whitespace-nowrap ${
                            row.expense_count > 0 ? "text-amber-600 font-semibold" : "text-gray-300"
                          }`}
                        >
                          {row.expense_count}
                        </TableCell>
                      )}
                      <TableCell className="text-right whitespace-nowrap">
                        <button
                          onClick={() =>
                            window.open(`/projects/bwa/${row.id}`, "_blank", "noopener")
                          }
                          className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title={
                            isStaffDeadline
                              ? "開啟項目以完成工地狀況至 90%"
                              : "開啟項目以完成 Expense Control 清單"
                          }
                        >
                          開啟項目 <ExternalLink className="w-3 h-3" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
