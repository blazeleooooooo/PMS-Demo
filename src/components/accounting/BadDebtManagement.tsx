"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  DollarSign,
  TrendingDown} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { isIncomeSettledByStatus } from "@/lib/income-outstanding";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";
import { ReportSourceToggle } from "@/components/reports/ReportDateRangeBar";

// ─── Types ───

interface BadDebtRow {
  id: string;
  project_name: string | null;
  project_code: string | null;
  pm_name: string | null;
  customer_name: string | null;
  invoice_number: string | null;
  contract_type_name: string | null;
  type_display: string | null;
  income_amount: number | null;
  bad_debts: number | null;
  outstanding: number | null;
  payment_amount: number | null;
  due_date: string | null;
  receive_date: string | null;
  payment_status: string | null;
  remark: string | null;
  outstanding_remark: string | null;
  project_id: string | null;
  project_status: string | null;
  bw_type: "BWA" | "BWF";
}

type SortField = "project" | "invoice" | "income" | "bad_debt" | "outstanding" | "due_date" | "status";
type SortDir = "asc" | "desc";

// ─── Helpers ───

function fmtDate(d: string | null): string {
  if (!d) return "-";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  } catch {
    return d;
  }
}

// ─── Component ───

export default function BadDebtManagement() {
  const { formatMoney2 } = useFinancialFormat();
  const { loading: permLoading } = usePermission();
  const supabase = createClient();
  const { sources } = useReportRange();
  const sourceType: "BWA" | "BWF" = sources.bwf && !sources.bwa ? "BWF" : "BWA";

  const [rows, setRows] = useState<BadDebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("bad_debt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ─── Fetch Data ───

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Fetch all incomes with bad_debts > 0, join contract type via n_contract_type_id
      const { data: incomes, error: incomeErr } = await supabase
        .from("incomes")
        .select("id, project_id, bwf_project_id, income_amount, bad_debts, outstanding, payment_amount, invoice_number, n_contract_type_id, type_display, due_date, receive_date, payment_status, remark, outstanding_remark, ct:nos_contracts!fk_incomes_n_contract_type_id(id, display, chinese_display)")
        .gt("bad_debts", 0);

      if (incomeErr) throw new Error(incomeErr.message);
      if (!incomes || incomes.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const bwaIds = [...new Set(incomes.map((inc: any) => inc.project_id).filter(Boolean))];
      const bwfIds = [...new Set(incomes.map((inc: any) => inc.bwf_project_id).filter(Boolean))];

      type ProjInfo = {
        project_name: string | null;
        project_code: string | null;
        pm_name: string | null;
        status: string | null;
        customer_name: string | null;
      };
      const projectSelect =
        "id, project_name, project_code, status, pm:staff!fk_bwa_projects_main_pm_id(name), cust:customers!fk_bwa_projects_customer_id(id, customer_name, company_name)";
      const bwfProjectSelect =
        "id, project_name, project_code, status, pm:staff!fk_bwf_projects_main_pm_id(name), cust:customers!fk_bwf_projects_customer_id(id, customer_name, company_name)";

      const [bwaRes, bwfRes] = await Promise.all([
        bwaIds.length > 0
          ? supabase.from("bwa_projects").select(projectSelect).in("id", bwaIds).neq("status", "Work In Progress")
          : Promise.resolve({ data: [], error: null }),
        bwfIds.length > 0
          ? supabase.from("bwf_projects").select(bwfProjectSelect).in("id", bwfIds).neq("status", "Work In Progress")
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (bwaRes.error) throw new Error(bwaRes.error.message);
      if (bwfRes.error) throw new Error(bwfRes.error.message);

      const toInfo = (p: any): ProjInfo => ({
        project_name: p.project_name,
        project_code: p.project_code,
        pm_name: p.pm?.name || null,
        status: p.status,
        customer_name: p.cust?.company_name || p.cust?.customer_name || null,
      });
      const bwaMap = new Map<string, ProjInfo>();
      (bwaRes.data || []).forEach((p: any) => bwaMap.set(p.id, toInfo(p)));
      const bwfMap = new Map<string, ProjInfo>();
      (bwfRes.data || []).forEach((p: any) => bwfMap.set(p.id, toInfo(p)));

      const result: BadDebtRow[] = [];
      incomes.forEach((inc: any) => {
        const contractTypeName = inc.ct?.chinese_display || inc.ct?.display || null;
        const pushRow = (proj: ProjInfo, pid: string, bwType: "BWA" | "BWF") => {
          result.push({
            id: inc.id,
            project_name: proj.project_name,
            project_code: proj.project_code,
            pm_name: proj.pm_name,
            customer_name: proj.customer_name,
            invoice_number: inc.invoice_number,
            contract_type_name: contractTypeName,
            type_display: inc.type_display,
            income_amount: inc.income_amount,
            bad_debts: inc.bad_debts,
            outstanding: inc.outstanding,
            payment_amount: inc.payment_amount,
            due_date: inc.due_date,
            receive_date: inc.receive_date,
            payment_status: inc.payment_status,
            remark: inc.remark,
            outstanding_remark: inc.outstanding_remark,
            project_id: pid,
            project_status: proj.status,
            bw_type: bwType,
          });
        };

        if (inc.project_id) {
          const proj = bwaMap.get(inc.project_id);
          if (proj) {
            pushRow(proj, inc.project_id, "BWA");
            return;
          }
        }
        if (inc.bwf_project_id) {
          const proj = bwfMap.get(inc.bwf_project_id);
          if (proj) pushRow(proj, inc.bwf_project_id, "BWF");
        }
      });

      setRows(result);
    } catch (err: any) {
      setError(err.message || "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [sourceType]);

  // ─── Filtering ───

  const filtered = useMemo(() => {
    let list = rows.filter((r) => r.bw_type === sourceType);

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter((r) => (r.payment_status || "").toLowerCase() === statusFilter.toLowerCase());
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.project_name || "").toLowerCase().includes(q) ||
          (r.project_code || "").toLowerCase().includes(q) ||
          (r.pm_name || "").toLowerCase().includes(q) ||
          (r.customer_name || "").toLowerCase().includes(q) ||
          (r.invoice_number || "").toLowerCase().includes(q) ||
          (r.invoice_number || "").toLowerCase().includes(q) ||
          (r.contract_type_name || "").toLowerCase().includes(q) ||
          (r.remark || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [rows, search, statusFilter, sourceType]);

  // ─── Sorting ───

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "project":
          cmp = (a.project_name || "").localeCompare(b.project_name || "");
          break;
        case "invoice":
          cmp = (a.invoice_number || "").localeCompare(b.invoice_number || "");
          break;
        case "income":
          cmp = (a.income_amount || 0) - (b.income_amount || 0);
          break;
        case "bad_debt":
          cmp = (a.bad_debts || 0) - (b.bad_debts || 0);
          break;
        case "outstanding":
          cmp = (a.outstanding || 0) - (b.outstanding || 0);
          break;
        case "due_date":
          cmp = (a.due_date || "").localeCompare(b.due_date || "");
          break;
        case "status":
          cmp = (a.payment_status || "").localeCompare(b.payment_status || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortField, sortDir]);

  // ─── Pagination ───

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  // ─── Stats ───

  const totalBadDebt = useMemo(() => filtered.reduce((sum, r) => sum + (r.bad_debts || 0), 0), [filtered]);
  const totalOutstanding = useMemo(() => filtered.reduce((sum, r) => sum + (r.outstanding || 0), 0), [filtered]);
  const totalIncome = useMemo(() => filtered.reduce((sum, r) => sum + (r.income_amount || 0), 0), [filtered]);

  // ─── Sort Toggle ───

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  }

  // ─── Unique payment statuses for filter ───

  const paymentStatuses = useMemo(() => {
    const s = new Set<string>();
    rows.filter((r) => r.bw_type === sourceType).forEach((r) => { if (r.payment_status) s.add(r.payment_status); });
    return Array.from(s).sort();
  }, [rows, sourceType]);

  // ─── Render ───

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            壞帳列表
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Bad Debt Management — 檢視所有未收齊款項的已完成項目
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>

      <ReportSourceToggle />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-xs text-gray-500">壞帳總額</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {formatMoney2(totalBadDebt)}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs text-gray-500">相關收入總額</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {formatMoney2(totalIncome)}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-xs text-gray-500">未收款總額</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {formatMoney2(totalOutstanding)}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">受影響項目數</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {filtered.length}
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜尋項目、客戶、發票號碼..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <SelectValue placeholder="付款狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              {paymentStatuses.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-400 ml-auto">
            共 {filtered.length} 條記錄
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-red-500 mr-2" />
            <span className="text-sm text-gray-500">載入壞帳資料中...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <TrendingDown className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">暫無壞帳記錄</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="text-xs min-w-[80px]">類別</TableHead>
                  <TableHead className="min-w-[180px]">
                    <button onClick={() => toggleSort("project")} className="flex items-center text-xs font-medium">
                      項目 <SortIcon field="project" />
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[120px] text-xs">客戶</TableHead>
                  <TableHead className="min-w-[100px] text-xs">項目經理</TableHead>
                  <TableHead className="min-w-[110px]">
                    <button onClick={() => toggleSort("income")} className="flex items-center text-xs font-medium">
                      應收款項 <SortIcon field="income" />
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[100px] text-xs">已收款項</TableHead>
                  <TableHead className="min-w-[110px]">
                    <button onClick={() => toggleSort("bad_debt")} className="flex items-center text-xs font-medium">
                      壞帳 <SortIcon field="bad_debt" />
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[90px]">
                    <button onClick={() => toggleSort("status")} className="flex items-center text-xs font-medium">
                      狀態 <SortIcon field="status" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs w-[60px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((row) => (
                  <TableRow
                    key={row.id}
                    className="group hover:bg-red-50/30 transition-colors border-l-2 border-l-transparent hover:border-l-red-400"
                  >
                    <TableCell>
                      {row.contract_type_name ? (
                        <Badge variant="outline" className="text-[12px] font-normal">
                          {row.contract_type_name}{row.invoice_number ? ` #${row.invoice_number}` : ''}
                        </Badge>
                      ) : row.type_display ? (
                        <Badge variant="outline" className="text-[12px] font-normal">
                          {row.type_display}{row.invoice_number ? ` #${row.invoice_number}` : ''}
                        </Badge>
                      ) : row.invoice_number ? (
                        <Badge variant="outline" className="text-[12px] font-normal">
                          #{row.invoice_number}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-gray-900 leading-tight">
                          {row.project_name || "-"}
                        </p>
                        {row.project_code && (
                          <p className="text-[12px] text-gray-400 mt-0.5">{row.project_code}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {row.customer_name || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {row.pm_name || "-"}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-gray-700">
                      {formatMoney2(row.income_amount)}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-gray-500">
                      {row.payment_amount ? formatMoney2(row.payment_amount) : "N/A"}
                    </TableCell>
                    <TableCell className="text-sm font-mono font-semibold text-red-600">
                      {formatMoney2(row.bad_debts)}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={row.payment_status} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 opacity-60 hover:opacity-100"
                        onClick={() => {
                          if (row.project_id) {
                            const url =
                              row.bw_type === "BWF"
                                ? `/bwf/projects/${row.project_id}`
                                : `/projects/bwa/${row.project_id}`;
                            window.open(url, "_blank", "noopener");
                          }
                        }}
                      >
                        <Search className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>每頁</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[65px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>筆</span>
            <span className="ml-2 text-gray-400">
              第 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} 筆，共 {sorted.length} 筆
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-7 h-7" disabled={page === 1} onClick={() => setPage(1)}>
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-gray-600 px-2">
              {page} / {totalPages}
            </span>
            <Button variant="ghost" size="icon" className="w-7 h-7" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───

function PaymentStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-gray-300">-</span>;
  const lower = status.toLowerCase();
  let cls = "bg-gray-100 text-gray-600 border-gray-200";
  if (isIncomeSettledByStatus(status) || lower.includes("已收")) {
    cls = "bg-green-50 text-green-700 border-green-200";
  } else if (lower.includes("partial") || lower.includes("部分")) {
    cls = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (lower.includes("unpaid") || lower.includes("未收") || lower.includes("overdue")) {
    cls = "bg-red-50 text-red-700 border-red-200";
  }
  return (
    <Badge variant="outline" className={`text-[12px] font-normal ${cls}`}>
      {status}
    </Badge>
  );
}
