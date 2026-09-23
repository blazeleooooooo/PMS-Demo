"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Users,
  LogIn,
  UserX,
  Clock,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  fetchPMSLoginReport,
  type PMSLoginSessionRow,
  type PMSLoginUserRow,
} from "@/lib/data-service";
import {
  resolveRange,
  rangeBounds,
  fmtRangeDate as fmtDate,
} from "@/lib/report-date-range";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";
import ReportDateRangeBar from "@/components/reports/ReportDateRangeBar";

const IDLE_DAYS = 14;
const SESSION_EXPIRY_DAYS = 7;

const TYPE_COLORS = ["#14b8a6", "#ef4444", "#f59e0b", "#6366f1", "#ec4899"];
const OTHERS_COLOR = "#6b7280";
const TOP_TYPE_COUNT = 3;
const CHART_BUCKET_WIDTH = 44;
const CHART_SCROLL_THRESHOLD = 30;
const MONTHLY_GROUP_THRESHOLD_DAYS = 90;

type ViewMode = "users" | "sessions";

type UserSortCol =
  | "email"
  | "member_name"
  | "user_type"
  | "provider_label"
  | "last_sign_in_at"
  | "account_created_at";

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

type SessionSortCol =
  | "login_at"
  | "email"
  | "member_name"
  | "user_type"
  | "ip";

function idleDaysSinceSessionExpiry(lastSignIn: string | null): number | null {
  const days = daysSince(lastSignIn);
  if (days == null) return null;
  return Math.max(0, days - SESSION_EXPIRY_DAYS);
}

function loginStatus(
  lastSignIn: string | null,
  accountCreatedAt: string,
  staffStatus: string | null,
): {
  label: string;
  className: string;
} {
  const daysSinceRef = lastSignIn
    ? daysSince(lastSignIn)!
    : (daysSince(accountCreatedAt) ?? 0);
  const idleDays = Math.max(0, daysSinceRef - SESSION_EXPIRY_DAYS);

  if (daysSinceRef < SESSION_EXPIRY_DAYS) {
    if (!lastSignIn) {
      return {
        label: "從未登入 Never",
        className: "bg-gray-100 text-gray-600",
      };
    }
    return {
      label: "近期活躍 Active",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (idleDays >= IDLE_DAYS) {
    if (staffStatus === "Inactive") {
      return {
        label: `已停用，閒置 ${idleDays} 天`,
        className: "bg-gray-100 text-gray-600",
      };
    }
    return {
      label: `已登出，閒置 ${idleDays} 天`,
      className: "bg-yellow-50 text-yellow-700",
    };
  }

  return {
    label: `已登出，閒置 ${idleDays} 天`,
    className: "bg-yellow-50 text-yellow-700",
  };
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg shadow-sm px-5 py-4 border-l-4"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Icon className="w-4 h-4" style={{ color: accent }} />
        {label}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

interface LoginTrendTypeSeries {
  key: string;
  name: string;
  color: string;
}

function LoginTrendChart({
  data,
  typeSeries,
  width,
  chartGranularity,
  scrollable,
}: {
  data: Record<string, number | string>[];
  typeSeries: LoginTrendTypeSeries[];
  width?: number;
  chartGranularity: "month" | "day";
  scrollable: boolean;
}) {
  const tiltLabels = chartGranularity === "day" && data.length > 14;

  return (
    <ComposedChart
      width={width}
      height={380}
      data={data}
      margin={{ top: 10, right: 16, bottom: 4, left: 0 }}
      barCategoryGap={scrollable ? undefined : "20%"}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
      <XAxis
        dataKey="month"
        interval={0}
        angle={tiltLabels ? -45 : 0}
        textAnchor={tiltLabels ? "end" : "middle"}
        height={tiltLabels ? 56 : 30}
        tick={{ fontSize: 11, fill: "#94a3b8" }}
        axisLine={{ stroke: "#e2e8f0" }}
        tickLine={false}
      />
      <YAxis
        allowDecimals={false}
        tick={{ fontSize: 12, fill: "#94a3b8" }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        contentStyle={{
          fontSize: 12,
          borderRadius: 8,
          border: "1px solid #e2e8f0",
        }}
      />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      <Bar
        dataKey="all"
        name="登入用戶數 Users Logged In"
        fill="#cbd5e1"
        radius={[3, 3, 0, 0]}
        barSize={scrollable ? 22 : undefined}
        maxBarSize={scrollable ? 22 : 56}
      />
      {typeSeries.map((s) => (
        <Line
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.name}
          stroke={s.color}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      ))}
    </ComposedChart>
  );
}

export default function PMSLoginReport() {
  const [users, setUsers] = useState<PMSLoginUserRow[]>([]);
  const [sessions, setSessions] = useState<PMSLoginSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("users");
  const [search, setSearch] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
  const { range, custom } = useReportRange();
  const [userSortCol, setUserSortCol] = useState<UserSortCol>("last_sign_in_at");
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("desc");
  const [sessionSortCol, setSessionSortCol] = useState<SessionSortCol>("login_at");
  const [sessionSortDir, setSessionSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const result = await fetchPMSLoginReport();
      if (!result.success) {
        setError(result.error || "載入失敗");
        setUsers([]);
        setSessions([]);
      } else {
        setUsers(result.users);
        setSessions(result.sessions);
      }
      setLoading(false);
    }
    load();
  }, []);

  const window = useMemo(() => resolveRange(range, new Date(), custom), [range, custom]);
  const { fromMs, toMs } = useMemo(() => rangeBounds(window), [window]);

  const inWindow = (iso: string | null | undefined) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !isNaN(t) && t >= fromMs && t <= toMs;
  };

  const searchLower = search.trim().toLowerCase();
  const matchesSearch = (email: string | null, name: string | null) => {
    if (!searchLower) return true;
    return (
      (email?.toLowerCase().includes(searchLower) ?? false) ||
      (name?.toLowerCase().includes(searchLower) ?? false)
    );
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userTypeFilter !== "all" && u.user_type !== userTypeFilter) return false;
      if (!matchesSearch(u.email, u.member_name)) return false;
      // Date window: show users who signed in during the period, or never logged in when searching all
      if (u.last_sign_in_at) return inWindow(u.last_sign_in_at);
      return searchLower.length > 0 || userTypeFilter !== "all";
    });
  }, [users, userTypeFilter, searchLower, fromMs, toMs]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (userTypeFilter !== "all" && s.user_type !== userTypeFilter) return false;
      if (!matchesSearch(s.email, s.member_name)) return false;
      return inWindow(s.login_at);
    });
  }, [sessions, userTypeFilter, searchLower, fromMs, toMs]);

  const summary = useMemo(() => {
    const periodUsers = users.filter((u) => inWindow(u.last_sign_in_at));
    const neverLoggedIn = users.filter((u) => !u.last_sign_in_at);
    const idleUsers = users.filter((u) => {
      if (!u.last_sign_in_at) return false;
      const idle = idleDaysSinceSessionExpiry(u.last_sign_in_at);
      return idle != null && idle >= IDLE_DAYS;
    });
    return {
      totalAccounts: users.length,
      loggedInPeriod: periodUsers.length,
      sessionCount: sessions.filter((s) => inWindow(s.login_at)).length,
      neverLoggedIn: neverLoggedIn.length,
      idleUsers: idleUsers.length,
    };
  }, [users, sessions, fromMs, toMs]);

  const userTypes = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) {
      if (u.user_type) set.add(u.user_type);
    }
    return Array.from(set).sort();
  }, [users]);

  const chartUsers = useMemo(() => {
    return users.filter((u) => {
      if (userTypeFilter !== "all" && u.user_type !== userTypeFilter) return false;
      if (!matchesSearch(u.email, u.member_name)) return false;
      return u.last_sign_in_at && inWindow(u.last_sign_in_at);
    });
  }, [users, userTypeFilter, searchLower, fromMs, toMs]);

  const { chartData, typeSeries, chartWidth, chartScrollable, chartGranularity } = useMemo(() => {
    const countByType = new Map<string, { name: string; count: number }>();
    for (const u of chartUsers) {
      const key = u.user_type || "unknown";
      const name = u.user_type || "未知 Unknown";
      const entry = countByType.get(key) || { name, count: 0 };
      entry.count += 1;
      countByType.set(key, entry);
    }
    const ranked = Array.from(countByType.entries()).sort(
      (a, b) => b[1].count - a[1].count,
    );
    const topKeys = ranked.slice(0, TOP_TYPE_COUNT).map(([k]) => k);
    const topKeySet = new Set(topKeys);
    const hasOthers = ranked.length > TOP_TYPE_COUNT;

    const typeSeries = topKeys.map((k, i) => ({
      key: k,
      name: countByType.get(k)!.name,
      color: TYPE_COLORS[i % TYPE_COLORS.length],
    }));
    if (hasOthers) {
      typeSeries.push({ key: "__others__", name: "Others", color: OTHERS_COLOR });
    }

    const DAY_MS = 86_400_000;
    const now = new Date();
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    // Always bucket the full selected window — never shrink to data-only span.
    let fromBound = window.from;
    let toBound = window.to ?? endOfToday;
    if (!fromBound) {
      let minT = Infinity;
      for (const u of users) {
        for (const iso of [u.last_sign_in_at, u.account_created_at]) {
          if (!iso) continue;
          const t = new Date(iso).getTime();
          if (!isNaN(t) && t < minT) minT = t;
        }
      }
      fromBound = isFinite(minT)
        ? new Date(minT)
        : new Date(endOfToday.getTime() - (MONTHLY_GROUP_THRESHOLD_DAYS - 1) * DAY_MS);
    }

    const startDay = new Date(fromBound.getFullYear(), fromBound.getMonth(), fromBound.getDate());
    const endDay = new Date(toBound.getFullYear(), toBound.getMonth(), toBound.getDate());
    const dayCount = Math.round((endDay.getTime() - startDay.getTime()) / DAY_MS) + 1;
    const granularity: "month" | "day" =
      dayCount > MONTHLY_GROUP_THRESHOLD_DAYS ? "month" : "day";

    const buckets: { key: string; label: string }[] = [];
    let keyOf: (d: Date) => string;

    if (granularity === "month") {
      const cursor = new Date(startDay.getFullYear(), startDay.getMonth(), 1);
      const lastM = new Date(endDay.getFullYear(), endDay.getMonth(), 1);
      while (cursor <= lastM) {
        buckets.push({
          key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
          label: `${cursor.getFullYear()}/${String(cursor.getMonth() + 1).padStart(2, "0")}`,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}`;
    } else {
      const cursor = new Date(startDay);
      while (cursor <= endDay) {
        buckets.push({
          key: `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
          label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }

    const rowByKey = new Map<string, Record<string, number | string>>();
    const chartData = buckets.map((b) => {
      const row: Record<string, number | string> = { month: b.label, all: 0 };
      for (const s of typeSeries) row[s.key] = 0;
      rowByKey.set(b.key, row);
      return row;
    });

    for (const u of chartUsers) {
      if (!u.last_sign_in_at) continue;
      const d = new Date(u.last_sign_in_at);
      if (isNaN(d.getTime())) continue;
      const row = rowByKey.get(keyOf(d));
      if (!row) continue;
      row.all = (row.all as number) + 1;
      const key = u.user_type || "unknown";
      if (topKeySet.has(key)) row[key] = (row[key] as number) + 1;
      else if (hasOthers) row.__others__ = (row.__others__ as number) + 1;
    }

    const bucketCount = buckets.length;
    const chartScrollable = bucketCount > CHART_SCROLL_THRESHOLD;
    const chartWidth = bucketCount * CHART_BUCKET_WIDTH;

    return { chartData, typeSeries, chartWidth, chartScrollable, chartGranularity: granularity };
  }, [chartUsers, window, users]);

  const sortedUsers = useMemo(() => {
    const rows = [...filteredUsers];
    const dir = userSortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (userSortCol) {
        case "email":
          av = (a.email || "").toLowerCase();
          bv = (b.email || "").toLowerCase();
          break;
        case "member_name":
          av = (a.member_name || "").toLowerCase();
          bv = (b.member_name || "").toLowerCase();
          break;
        case "user_type":
          av = (a.user_type || "").toLowerCase();
          bv = (b.user_type || "").toLowerCase();
          break;
        case "provider_label":
          av = a.provider_label.toLowerCase();
          bv = b.provider_label.toLowerCase();
          break;
        case "last_sign_in_at":
          av = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
          bv = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
          break;
        case "account_created_at":
          av = a.account_created_at ? new Date(a.account_created_at).getTime() : 0;
          bv = b.account_created_at ? new Date(b.account_created_at).getTime() : 0;
          break;
      }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
    return rows;
  }, [filteredUsers, userSortCol, userSortDir]);

  const sortedSessions = useMemo(() => {
    const rows = [...filteredSessions];
    const dir = sessionSortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sessionSortCol) {
        case "login_at":
          av = new Date(a.login_at).getTime();
          bv = new Date(b.login_at).getTime();
          break;
        case "email":
          av = (a.email || "").toLowerCase();
          bv = (b.email || "").toLowerCase();
          break;
        case "member_name":
          av = (a.member_name || "").toLowerCase();
          bv = (b.member_name || "").toLowerCase();
          break;
        case "user_type":
          av = (a.user_type || "").toLowerCase();
          bv = (b.user_type || "").toLowerCase();
          break;
        case "ip":
          av = a.ip || "";
          bv = b.ip || "";
          break;
      }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
    return rows;
  }, [filteredSessions, sessionSortCol, sessionSortDir]);

  function toggleUserSort(col: UserSortCol) {
    if (userSortCol === col) setUserSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setUserSortCol(col);
      setUserSortDir(col === "last_sign_in_at" ? "desc" : "asc");
    }
  }

  function toggleSessionSort(col: SessionSortCol) {
    if (sessionSortCol === col) setSessionSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSessionSortCol(col);
      setSessionSortDir(col === "login_at" ? "desc" : "asc");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">PMS登入報告</h1>
        <p className="text-sm text-gray-500 mt-1">
          PMS Login Report — 資料來自 Supabase Auth（auth.users / auth.sessions），非舊版 login_logs
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {fmtDate(window.from)} — {fmtDate(window.to)}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <SummaryCard label="Auth 帳戶總數" value={summary.totalAccounts} icon={Users} accent="#3b82f6" />
        <SummaryCard label="期內登入用戶" value={summary.loggedInPeriod} icon={LogIn} accent="#10b981" />
        <SummaryCard label="期內 Session 數" value={summary.sessionCount} icon={LogIn} accent="#6366f1" />
        <SummaryCard label="從未登入" value={summary.neverLoggedIn} icon={UserX} accent="#9ca3af" />
        <SummaryCard
          label={`已登出閒置 ≥${IDLE_DAYS} 天`}
          value={summary.idleUsers}
          icon={Clock}
          accent="#f59e0b"
        />
      </div>

      {/* Login data has no BWA/BWF dimension — hide the source toggle. */}
      <ReportDateRangeBar showSourceToggle={false} />

      {!loading && !error && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 underline underline-offset-4 decoration-gray-300 mb-3">
            登入趨勢 Login Trend
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            {chartScrollable ? (
              <div className="overflow-x-auto">
                <div style={{ width: chartWidth, height: 380 }}>
                  <LoginTrendChart
                    data={chartData}
                    typeSeries={typeSeries}
                    width={chartWidth}
                    chartGranularity={chartGranularity}
                    scrollable
                  />
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={380}>
                <LoginTrendChart
                  data={chartData}
                  typeSeries={typeSeries}
                  chartGranularity={chartGranularity}
                  scrollable={false}
                />
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            以所選期間內各用戶最後登入日期（last_sign_in_at）統計；無登入的
            {chartGranularity === "month" ? "月份" : "日期"}顯示為 0。
            {chartGranularity === "month"
              ? " 超過 90 天按月份分組。"
              : " 90 天或以內按日期分組。"}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode("users")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === "users"
                ? "bg-bw-blue text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            用戶摘要 Users
          </button>
          <button
            type="button"
            onClick={() => setViewMode("sessions")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === "sessions"
                ? "bg-bw-blue text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            登入 Session Sessions
          </button>
        </div>

        <Input
          placeholder="搜尋電郵 / 名稱..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />

        <select
          value={userTypeFilter}
          onChange={(e) => setUserTypeFilter(e.target.value)}
          className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm"
        >
          <option value="all">所有類型 All Types</option>
          {userTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-bw-blue" />
          <span className="ml-3 text-gray-500 text-sm">載入 Auth 登入資料...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700 text-sm">
          {error}
        </div>
      ) : viewMode === "users" ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <UserTh col="email" label="電郵 Email" onSort={toggleUserSort} active={userSortCol} dir={userSortDir} />
                  <UserTh col="member_name" label="名稱 Name" onSort={toggleUserSort} active={userSortCol} dir={userSortDir} />
                  <UserTh col="user_type" label="類型 Type" onSort={toggleUserSort} active={userSortCol} dir={userSortDir} />
                  <UserTh col="provider_label" label="登入方式 Provider" onSort={toggleUserSort} active={userSortCol} dir={userSortDir} />
                  <UserTh col="last_sign_in_at" label="最後登入 Last Sign In" onSort={toggleUserSort} active={userSortCol} dir={userSortDir} />
                  <UserTh col="account_created_at" label="帳戶建立 Created" onSort={toggleUserSort} active={userSortCol} dir={userSortDir} />
                  <TableHead className="text-xs font-semibold text-gray-600">狀態 Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-gray-400">
                      此期間沒有登入記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedUsers.map((row) => {
                    const status = loginStatus(
                      row.last_sign_in_at,
                      row.account_created_at,
                      row.staff_status,
                    );
                    return (
                      <TableRow key={row.auth_user_id} className="hover:bg-gray-50/80 border-b border-gray-100">
                        <TableCell className="text-sm text-gray-900">{row.email || "—"}</TableCell>
                        <TableCell className="text-sm text-gray-700 whitespace-nowrap">
                          {row.member_name || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{row.user_type || "—"}</TableCell>
                        <TableCell className="text-sm text-gray-600">{row.provider_label}</TableCell>
                        <TableCell className="text-sm font-mono text-gray-700 whitespace-nowrap">
                          {fmtDateTime(row.last_sign_in_at)}
                        </TableCell>
                        <TableCell className="text-sm font-mono text-gray-500 whitespace-nowrap">
                          {fmtDateTime(row.account_created_at)}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                            {status.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            顯示 {sortedUsers.length} 個在 {fmtDate(window.from)} — {fmtDate(window.to)} 期間有登入的帳戶
            · 閒置天數 = 距上次登入 − {SESSION_EXPIRY_DAYS} 天（Session 有效期）
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <SessionTh col="login_at" label="登入時間 Login Time" onSort={toggleSessionSort} active={sessionSortCol} dir={sessionSortDir} />
                  <SessionTh col="email" label="電郵 Email" onSort={toggleSessionSort} active={sessionSortCol} dir={sessionSortDir} />
                  <SessionTh col="member_name" label="名稱 Name" onSort={toggleSessionSort} active={sessionSortCol} dir={sessionSortDir} />
                  <SessionTh col="user_type" label="類型 Type" onSort={toggleSessionSort} active={sessionSortCol} dir={sessionSortDir} />
                  <SessionTh col="ip" label="IP" onSort={toggleSessionSort} active={sessionSortCol} dir={sessionSortDir} />
                  <TableHead className="text-xs font-semibold text-gray-600">User Agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16 text-gray-400">
                      此期間沒有 Session 記錄（Supabase 僅保留現有 Session，非完整歷史）
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedSessions.map((row) => (
                    <TableRow key={row.session_id} className="hover:bg-gray-50/80 border-b border-gray-100">
                      <TableCell className="text-sm font-mono text-gray-800 whitespace-nowrap">
                        {fmtDateTime(row.login_at)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-900">{row.email || "—"}</TableCell>
                      <TableCell className="text-sm text-gray-700 whitespace-nowrap">
                        {row.member_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{row.user_type || "—"}</TableCell>
                      <TableCell className="text-sm font-mono text-gray-600">{row.ip || "—"}</TableCell>
                      <TableCell className="text-xs text-gray-500 max-w-[280px] truncate" title={row.user_agent || undefined}>
                        {row.user_agent || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            顯示 {sortedSessions.length} 個 Session · auth.sessions 僅含 Supabase 現存 Session（非完整登入歷史）
            · PMS Session 有效期 {SESSION_EXPIRY_DAYS} 天；過期 Session 由每日 02:30 HKT cron 自動清除
          </div>
        </div>
      )}
    </div>
  );
}

function UserTh({
  col,
  label,
  onSort,
  active,
  dir,
}: {
  col: UserSortCol;
  label: string;
  onSort: (col: UserSortCol) => void;
  active: UserSortCol;
  dir: "asc" | "desc";
}) {
  return (
    <TableHead
      className="text-xs font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap"
      onClick={() => onSort(col)}
    >
      {label}
      <SortIcon col={col} active={active === col} dir={dir} />
    </TableHead>
  );
}

function SessionTh({
  col,
  label,
  onSort,
  active,
  dir,
}: {
  col: SessionSortCol;
  label: string;
  onSort: (col: SessionSortCol) => void;
  active: SessionSortCol;
  dir: "asc" | "desc";
}) {
  return (
    <TableHead
      className="text-xs font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap"
      onClick={() => onSort(col)}
    >
      {label}
      <SortIcon col={col} active={active === col} dir={dir} />
    </TableHead>
  );
}

function SortIcon({ active, dir }: { col: string; active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 inline opacity-40" />;
  return dir === "asc" ? (
    <ChevronUp className="w-3.5 h-3.5 ml-1 inline" />
  ) : (
    <ChevronDown className="w-3.5 h-3.5 ml-1 inline" />
  );
}
