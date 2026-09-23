"use client";
// Build fix: ensured all type annotations are present for strict mode
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Banknote,
  DollarSign,
  CalendarDays} from "lucide-react";
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
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";
import { ReportSourceToggle } from "@/components/reports/ReportDateRangeBar";

// ─── Types ───

interface ChequeRow {
  id: string;
  payment_date: string | null;
  cheque_no: string | null;
  supplier_name: string | null;
  project_name: string | null;
  project_code: string | null;
  pm_name: string | null;
  invoice_number: string | null;
  installment_amount: number | null;
  payment_status: string | null;
  project_id: string | null;
  bwf_project_id: string | null;
}

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

function getStatusColor(status: string | null): string {
  if (!status) return "bg-gray-50 text-gray-600 border-gray-200";
  if (status === "Zoho Completed") return "bg-emerald-800 text-emerald-50 border-emerald-900";
  if (status === "Approved") return "bg-green-50 text-green-700 border-green-200";
  if (status === "Rejected") return "bg-red-50 text-red-700 border-red-200";
  if (status === "Pending Check") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

// Cheque payment method UUID
const CHEQUE_PAYMENT_METHOD_ID = "c78ef0a1-46d9-41b6-a61e-f0eda646be3b";

// ─── Component ───

export default function ChequeExpenseManagement() {
  const { formatMoney2 } = useFinancialFormat();
  const { loading: permLoading } = usePermission();
  const supabase = createClient();
  const { sources } = useReportRange();
  const sourceType: "BWA" | "BWF" = sources.bwf && !sources.bwa ? "BWF" : "BWA";

  const [rows, setRows] = useState<ChequeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Month filter - default to current month (format: "YYYY-MM")
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [monthFilter, setMonthFilter] = useState<string>(currentMonth);

  // Generate month options (last 24 months + current)
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
      options.push({ value: val, label });
    }
    return options;
  }, []);

  // ─── Fetch Data ───

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Fetch all expenses with payment_method_id = cheque
      // Include legacy 'supplier' TEXT column as fallback (stores UUID as text)
      const { data: expenses, error: expErr } = await supabase
        .from("expenses")
        .select("id, payment_date, cheque_no, supplier_id, supplier, project_id, bwf_project_id, invoice_number, installment_amount, payment_status")
        .eq("payment_method_id", CHEQUE_PAYMENT_METHOD_ID)
        .order("payment_date", { ascending: false });

      if (expErr) throw new Error(expErr.message);
      if (!expenses || expenses.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Step 2: Collect unique supplier IDs and project IDs
      // Use supplier_id (UUID FK) or fallback to supplier (legacy TEXT column storing UUID)
      const supplierIds = [...new Set(
        expenses
          .map((e: any) => e.supplier_id || e.supplier)
          .filter(Boolean) as string[]
      )];
      const bwaProjectIds = [...new Set(expenses.filter((e: any) => e.project_id).map((e: any) => e.project_id!))];
      const bwfProjectIds = [...new Set(expenses.filter((e: any) => e.bwf_project_id).map((e: any) => e.bwf_project_id!))];

      // Step 3: Fetch supplier names
      let supplierMap: Record<string, string> = {};
      if (supplierIds.length > 0) {
        const { data: suppliers } = await supabase
          .from("suppliers")
          .select("id, name, chinese_name, display_name")
          .in("id", supplierIds);
        (suppliers || []).forEach((s: any) => {
          supplierMap[s.id] = s.display_name || s.chinese_name || s.name || "未知供應商";
        });
      }

      // Step 4: Fetch BWA project details (name, code, PM)
      let bwaProjectMap: Record<string, { project_name: string | null; project_code: string | null; pm_name: string | null }> = {};
      if (bwaProjectIds.length > 0) {
        const { data: projects } = await supabase
          .from("bwa_projects")
          .select("id, project_name, project_code, pm:staff!fk_bwa_projects_main_pm_id(name)")
          .in("id", bwaProjectIds);
        (projects || []).forEach((p: any) => {
          bwaProjectMap[p.id] = {
            project_name: p.project_name || "未命名項目",
            project_code: p.project_code,
            pm_name: p.pm?.name || null};
        });
      }

      // Step 5: Fetch BWF project details
      let bwfProjectMap: Record<string, { project_name: string | null; project_code: string | null; pm_name: string | null }> = {};
      if (bwfProjectIds.length > 0) {
        const { data: projects } = await supabase
          .from("bwf_projects")
          .select("id, project_name, project_code, main_pm")
          .in("id", bwfProjectIds);
        (projects || []).forEach((p: any) => {
          bwfProjectMap[p.id] = {
            project_name: p.project_name || "未命名項目",
            project_code: p.project_code,
            pm_name: p.main_pm || null};
        });
      }

      // Step 6: Combine data
      const result: ChequeRow[] = expenses.map((exp: any) => {
        // Try supplier_id (UUID FK) first, fallback to legacy supplier (TEXT) column
        const effectiveSupplierId = exp.supplier_id || exp.supplier;
        const supplierName = effectiveSupplierId ? supplierMap[effectiveSupplierId] || null : null;

        let projectName: string | null = null;
        let projectCode: string | null = null;
        let pmName: string | null = null;

        if (exp.project_id && bwaProjectMap[exp.project_id]) {
          const proj = bwaProjectMap[exp.project_id];
          projectName = proj.project_name;
          projectCode = proj.project_code;
          pmName = proj.pm_name;
        } else if (exp.bwf_project_id && bwfProjectMap[exp.bwf_project_id]) {
          const proj = bwfProjectMap[exp.bwf_project_id];
          projectName = proj.project_name;
          projectCode = proj.project_code;
          pmName = proj.pm_name;
        }

        return {
          id: exp.id,
          payment_date: exp.payment_date,
          cheque_no: exp.cheque_no,
          supplier_name: supplierName,
          project_name: projectName,
          project_code: projectCode,
          pm_name: pmName,
          invoice_number: exp.invoice_number,
          installment_amount: exp.installment_amount,
          payment_status: exp.payment_status,
          project_id: exp.project_id,
          bwf_project_id: exp.bwf_project_id};
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
    if (sourceType === "BWA" && statusFilter === "zoho_completed") {
      setStatusFilter("all");
    }
  }, [sourceType, statusFilter]);

  // ─── Filtering ───

  const filtered = useMemo(() => {
    // Exclude rows with empty payment_date
    let list = rows.filter((r) => {
      if (!r.payment_date) return false;
      return sourceType === "BWF" ? !!r.bwf_project_id : !r.bwf_project_id;
    });

    // Month filter
    if (monthFilter) {
      list = list.filter((r) => {
        if (!r.payment_date) return false;
        try {
          const d = new Date(r.payment_date);
          if (isNaN(d.getTime())) return false;
          const rowMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          return rowMonth === monthFilter;
        } catch {
          return false;
        }
      });
    }

    // Status filter
    if (statusFilter === "unapplied") list = list.filter((r) => !r.payment_status);
    else if (statusFilter === "pending") list = list.filter((r) => r.payment_status === "Pending Check");
    else if (statusFilter === "approved") list = list.filter((r) => r.payment_status === "Approved");
    else if (statusFilter === "zoho_completed") list = list.filter((r) => r.payment_status === "Zoho Completed");
    else if (statusFilter === "rejected") list = list.filter((r) => r.payment_status === "Rejected");

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.cheque_no || "").toLowerCase().includes(q) ||
          (r.supplier_name || "").toLowerCase().includes(q) ||
          (r.project_name || "").toLowerCase().includes(q) ||
          (r.project_code || "").toLowerCase().includes(q) ||
          (r.pm_name || "").toLowerCase().includes(q) ||
          (r.invoice_number || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [rows, statusFilter, search, monthFilter, sourceType]);

  // ─── Pagination ───

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Reset page on filter changes
  useEffect(() => { setPage(1); }, [search, statusFilter, monthFilter, sourceType]);

  // ─── Total ───

  const totalAmount = useMemo(() => {
    return filtered.reduce((sum, r) => sum + (r.installment_amount || 0), 0);
  }, [filtered]);

  // ─── Render ───

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-500">載入支票支出...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 text-sm mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" /> 重試
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            支票支出
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Cheque Expense — 管理所有支票支付的費用記錄
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          重新整理
        </Button>
      </div>

      <ReportSourceToggle />

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">支票總數</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {filtered.length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs text-gray-500">支票總額</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {formatMoney2(filtered.reduce((sum, r) => sum + (r.installment_amount || 0), 0))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs text-gray-500">當前月份</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {monthFilter.replace("-", "/")}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-violet-600" />
            </div>
            <span className="text-xs text-gray-500">本月筆數</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {paginatedRows.length}
          </div>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜尋支票號碼、供應商、項目..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="選擇月份" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <SelectValue placeholder="狀態篩選" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="unapplied">未申請</SelectItem>
              <SelectItem value="pending">待審核</SelectItem>
              <SelectItem value="approved">已批核</SelectItem>
              {sourceType === "BWF" && (
                <SelectItem value="zoho_completed">Zoho Completed</SelectItem>
              )}
              <SelectItem value="rejected">已拒絕</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-400 ml-auto">
            共 {filtered.length} 條記錄
          </span>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead className="text-xs font-medium text-gray-600 w-[110px]">付款日期</TableHead>
              <TableHead className="text-xs font-medium text-gray-600 w-[100px]">支票號碼</TableHead>
              <TableHead className="text-xs font-medium text-gray-600">受款供應商</TableHead>
              <TableHead className="text-xs font-medium text-gray-600">項目</TableHead>
              <TableHead className="text-xs font-medium text-gray-600 w-[100px]">項目經理</TableHead>
              <TableHead className="text-xs font-medium text-gray-600 w-[90px]">類別</TableHead>
              <TableHead className="text-xs font-medium text-gray-600 text-right w-[120px]">支付金額</TableHead>
              <TableHead className="text-xs font-medium text-gray-600 w-[110px]">狀態</TableHead>
              <TableHead className="text-xs font-medium text-gray-600 w-[60px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-gray-400 text-sm">
                  沒有找到支票支出記錄
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row) => (
                <TableRow key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                  <TableCell className="text-[14px] text-gray-700 font-mono">
                    {fmtDate(row.payment_date)}
                  </TableCell>
                  <TableCell className="text-[14px] text-gray-900 font-mono font-medium">
                    {row.cheque_no || <span className="text-gray-300">-</span>}
                  </TableCell>
                  <TableCell className="text-[14px] text-gray-700 max-w-[200px]">
                    <span className="truncate block">{row.supplier_name || <span className="text-gray-300">-</span>}</span>
                  </TableCell>
                  <TableCell className="text-[14px] text-gray-700">
                    <div>
                      <span className="block truncate max-w-[220px] font-medium">
                        {row.project_name || <span className="text-gray-300">-</span>}
                      </span>
                      {row.project_code && (
                        <span className="text-[12px] text-gray-400 font-mono">{row.project_code}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[14px] text-gray-700">
                    {row.pm_name || <span className="text-gray-300">-</span>}
                  </TableCell>
                  <TableCell className="text-[14px] text-gray-700">
                    {row.invoice_number ? `#${row.invoice_number}` : <span className="text-gray-300">-</span>}
                  </TableCell>
                  <TableCell className="text-[14px] text-gray-900 text-right font-mono font-medium">
                    {formatMoney2(row.installment_amount)}
                  </TableCell>
                  <TableCell>
                    {row.payment_status ? (
                      <Badge variant="outline" className={`text-[12px] font-normal ${getStatusColor(row.payment_status)}`}>
                        {row.payment_status === "Pending Check" ? "待審核" : row.payment_status === "Approved" ? "已批核" : row.payment_status === "Zoho Completed" ? "Zoho Completed" : row.payment_status === "Rejected" ? "已拒絕" : row.payment_status}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-xs">未申請</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-50 group-hover:opacity-100"
                      title="查看詳情"
                    >
                      <Search className="w-3.5 h-3.5 text-gray-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* ─── Total Row ─── */}
        {filtered.length > 0 && (
          <div className="border-t px-4 py-3 flex items-center justify-end gap-3 bg-gray-50/50">
            <span className="text-xs text-gray-500">Total:</span>
            <span className="text-sm font-bold text-gray-900 font-mono">{formatMoney2(totalAmount)}</span>
          </div>
        )}
      </div>

      {/* ─── Pagination ─── */}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">每頁顯示</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-2">
              第 {page}/{totalPages} 頁 (共 {filtered.length} 筆)
            </span>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(1)}>
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
