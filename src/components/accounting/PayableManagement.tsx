"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CreditCard,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Truck} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";

// ─── Types ───

interface Supplier {
  id: string;
  name: string | null;
  chinese_name: string | null;
  display_name: string | null;
  n_type: string | null;
  sort_type: string | null;
  status: string | null;
}

interface ExpenseRow {
  id: string;
  installment_amount: number;
  paid_amount: number;
  outstanding: number;
  invoice_number: string | null;
  payment_status: string | null;
  payment_date: string | null;
  created_date: string | null;
  type_display: string | null;
  remark_t: string | null;
  project_id: string | null;
  bwf_project_id: string | null;
  project_name: string | null;
  project_code: string | null;
  financial_year: string | null;
  bw_type: "BWA" | "BWF";
}

interface ProjectGroup {
  project_id: string;
  project_name: string;
  project_code: string | null;
  bw_type: "BWA" | "BWF";
  financial_year: string | null;
  expenses: ExpenseRow[];
  total_installment: number;
  total_paid: number;
  total_outstanding: number;
  paid_percentage: number;
}

interface YearGroup {
  financial_year: string;
  projects: ProjectGroup[];
  total_installment: number;
  total_paid: number;
  total_outstanding: number;
  paid_percentage: number;
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

function pctStr(val: number): string {
  return `${val.toFixed(1)}%`;
}

// ─── Main Component ───

export default function PayableManagement() {
  const { formatMoney2 } = useFinancialFormat();
  const { loading: permLoading } = usePermission();
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // ─── Fetch suppliers on mount ───
  useEffect(() => {
    async function fetchSuppliers() {
      setLoading(true);
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, chinese_name, display_name, n_type, sort_type, status")
        .order("name", { ascending: true });

      if (error) {
        console.error("[Payable] Suppliers fetch error:", error.message);
      } else {
        setSuppliers(data || []);
      }
      setLoading(false);
    }
    fetchSuppliers();
  }, [supabase]);

  // ─── Fetch expenses when supplier is selected ───
  const fetchExpenses = useCallback(async (supplierId: string) => {
    if (!supplierId) {
      setExpenses([]);
      return;
    }
    setRefreshing(true);

    // Fetch expenses for the selected supplier
    const { data: expData, error: expError } = await supabase
      .from("expenses")
      .select("id, installment_amount, paid_amount, outstanding, invoice_number, payment_status, payment_date, created_date, type_display, remark_t, project_id, bwf_project_id")
      .eq("supplier_id", supplierId)
      .order("created_date", { ascending: false });

    if (expError) {
      console.error("[Payable] Expenses fetch error:", expError.message);
      setRefreshing(false);
      return;
    }

    const rawExpenses = expData || [];

    // Get unique project IDs for BWA and BWF
    const bwaProjectIds: string[] = [...new Set<string>(rawExpenses.filter((e: any) => e.project_id).map((e: any) => e.project_id))];
    const bwfProjectIds: string[] = [...new Set<string>(rawExpenses.filter((e: any) => e.bwf_project_id).map((e: any) => e.bwf_project_id))];

    // Separate UUID-format IDs from Bubble string IDs
    const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const bwaUuidIds = bwaProjectIds.filter((id: string) => id && isUUID(id));
    const bwaBubbleIds = bwaProjectIds.filter((id: string) => id && !isUUID(id));
    const bwfUuidIds = bwfProjectIds.filter((id: string) => id && isUUID(id));
    const bwfBubbleIds = bwfProjectIds.filter((id: string) => id && !isUUID(id));

    // Fetch project details — keyed by both id and bubble_id for lookup
    let bwaProjects: Record<string, { project_name: string; project_code: string | null; n_financial_year: string | null }> = {};
    let bwfProjects: Record<string, { project_name: string; project_code: string | null; n_financial_year: string | null }> = {};

    // BWA: lookup by UUID
    if (bwaUuidIds.length > 0) {
      const { data: pData } = await supabase
        .from("bwa_projects")
        .select("id, bubble_id, project_name, project_code, n_financial_year")
        .in("id", bwaUuidIds);
      (pData || []).forEach((p: any) => {
        bwaProjects[p.id] = { project_name: p.project_name || "未命名項目", project_code: p.project_code, n_financial_year: p.n_financial_year };
      });
    }

    // BWA: lookup by bubble_id for non-UUID references
    if (bwaBubbleIds.length > 0) {
      const { data: pData } = await supabase
        .from("bwa_projects")
        .select("id, bubble_id, project_name, project_code, n_financial_year")
        .in("bubble_id", bwaBubbleIds);
      (pData || []).forEach((p: any) => {
        // Key by bubble_id so we can match from expense.project_id
        if (p.bubble_id) {
          bwaProjects[p.bubble_id] = { project_name: p.project_name || "未命名項目", project_code: p.project_code, n_financial_year: p.n_financial_year };
        }
      });
    }

    // BWF: lookup by UUID
    if (bwfUuidIds.length > 0) {
      const { data: pData } = await supabase
        .from("bwf_projects")
        .select("id, bubble_id, project_name, project_code, n_financial_year")
        .in("id", bwfUuidIds);
      (pData || []).forEach((p: any) => {
        bwfProjects[p.id] = { project_name: p.project_name || "未命名項目", project_code: p.project_code, n_financial_year: p.n_financial_year };
      });
    }

    // BWF: lookup by bubble_id for non-UUID references
    if (bwfBubbleIds.length > 0) {
      const { data: pData } = await supabase
        .from("bwf_projects")
        .select("id, bubble_id, project_name, project_code, n_financial_year")
        .in("bubble_id", bwfBubbleIds);
      (pData || []).forEach((p: any) => {
        if (p.bubble_id) {
          bwfProjects[p.bubble_id] = { project_name: p.project_name || "未命名項目", project_code: p.project_code, n_financial_year: p.n_financial_year };
        }
      });
    }

    // Fetch financial_years lookup table to resolve bubble_id → display name
    const allFYRefs = new Set<string>();
    Object.values(bwaProjects).forEach(p => { if (p.n_financial_year) allFYRefs.add(p.n_financial_year); });
    Object.values(bwfProjects).forEach(p => { if (p.n_financial_year) allFYRefs.add(p.n_financial_year); });

    let fyLookup: Record<string, string> = {};
    if (allFYRefs.size > 0) {
      const fyRefArray = [...allFYRefs];
      // Try lookup by both id (UUID) and bubble_id (Bubble string)
      const fyUuids = fyRefArray.filter(isUUID);
      const fyBubbles = fyRefArray.filter(r => !isUUID(r));

      if (fyUuids.length > 0) {
        const { data: fyData } = await supabase
          .from("financial_years")
          .select("id, display")
          .in("id", fyUuids);
        (fyData || []).forEach((fy: any) => {
          if (fy.display) fyLookup[fy.id] = fy.display;
        });
      }
      if (fyBubbles.length > 0) {
        const { data: fyData } = await supabase
          .from("financial_years")
          .select("id, bubble_id, display")
          .in("bubble_id", fyBubbles);
        (fyData || []).forEach((fy: any) => {
          if (fy.bubble_id && fy.display) fyLookup[fy.bubble_id] = fy.display;
        });
      }
    }

    // Helper to resolve financial year reference to display name
    const resolveFY = (ref: string | null): string | null => {
      if (!ref) return null;
      return fyLookup[ref] || (isUUID(ref) ? null : null);
    };

    // Map expenses with project data
    const mapped: ExpenseRow[] = rawExpenses.map((e: any) => {
      let project_name = "未分配項目";
      let project_code: string | null = null;
      let financial_year: string | null = null;
      let bw_type: "BWA" | "BWF" = "BWA";

      if (e.project_id && bwaProjects[e.project_id]) {
        const p = bwaProjects[e.project_id];
        project_name = p.project_name;
        project_code = p.project_code;
        financial_year = resolveFY(p.n_financial_year);
        bw_type = "BWA";
      } else if (e.bwf_project_id && bwfProjects[e.bwf_project_id]) {
        const p = bwfProjects[e.bwf_project_id];
        project_name = p.project_name;
        project_code = p.project_code;
        financial_year = resolveFY(p.n_financial_year);
        bw_type = "BWF";
      }

      return {
        id: e.id,
        installment_amount: e.installment_amount || 0,
        paid_amount: e.paid_amount || 0,
        outstanding: e.outstanding || 0,
        invoice_number: e.invoice_number,
        payment_status: e.payment_status,
        payment_date: e.payment_date,
        created_date: e.created_date,
        type_display: e.type_display,
        remark_t: e.remark_t,
        project_id: e.project_id || e.bwf_project_id || null,
        bwf_project_id: e.bwf_project_id,
        project_name,
        project_code,
        financial_year,
        bw_type};
    });

    setExpenses(mapped);
    // Auto expand only the latest financial year group
    const years = [...new Set(mapped.map(e => e.financial_year || "未分類"))].sort((a, b) => b.localeCompare(a));
    setExpandedYears(new Set(years.length > 0 ? [years[0]] : []));
    setRefreshing(false);
  }, [supabase]);

  useEffect(() => {
    if (selectedSupplierId) {
      fetchExpenses(selectedSupplierId);
    }
  }, [selectedSupplierId, fetchExpenses]);

  // ─── Group expenses by financial year → project ───
  const { yearGroups, grandTotal } = useMemo(() => {
    // Filter by search
    let filtered = expenses;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = expenses.filter(
        e =>
          (e.project_name || "").toLowerCase().includes(q) ||
          (e.project_code || "").toLowerCase().includes(q) ||
          (e.invoice_number || "").toLowerCase().includes(q) ||
          (e.type_display || "").toLowerCase().includes(q)
      );
    }

    // Group by project
    const projectMap = new Map<string, ProjectGroup>();
    filtered.forEach((e) => {
      const key = e.project_id || "unassigned";
      if (!projectMap.has(key)) {
        projectMap.set(key, {
          project_id: key,
          project_name: e.project_name || "未分配項目",
          project_code: e.project_code,
          bw_type: e.bw_type,
          financial_year: e.financial_year,
          expenses: [],
          total_installment: 0,
          total_paid: 0,
          total_outstanding: 0,
          paid_percentage: 0});
      }
      const pg = projectMap.get(key)!;
      pg.expenses.push(e);
      pg.total_installment += e.installment_amount;
      pg.total_paid += e.paid_amount;
      pg.total_outstanding += e.outstanding;
    });

    // Calculate percentages
    projectMap.forEach((pg) => {
      pg.paid_percentage = pg.total_installment > 0 ? (pg.total_paid / pg.total_installment) * 100 : 0;
    });

    // Group by financial year
    const yearMap = new Map<string, YearGroup>();
    projectMap.forEach((pg) => {
      const fy = pg.financial_year || "未分類";
      if (!yearMap.has(fy)) {
        yearMap.set(fy, {
          financial_year: fy,
          projects: [],
          total_installment: 0,
          total_paid: 0,
          total_outstanding: 0,
          paid_percentage: 0});
      }
      const yg = yearMap.get(fy)!;
      yg.projects.push(pg);
      yg.total_installment += pg.total_installment;
      yg.total_paid += pg.total_paid;
      yg.total_outstanding += pg.total_outstanding;
    });

    // Calculate year group percentages
    yearMap.forEach((yg) => {
      yg.paid_percentage = yg.total_installment > 0 ? (yg.total_paid / yg.total_installment) * 100 : 0;
      // Sort projects by outstanding (descending)
      yg.projects.sort((a, b) => b.total_outstanding - a.total_outstanding);
    });

    // Sort years: newest first (natural descending string sort for fiscal year names)
    const sortedYears = [...yearMap.values()].sort((a, b) => b.financial_year.localeCompare(a.financial_year));

    // Grand totals
    const grandTotal = {
      total_installment: filtered.reduce((s, e) => s + e.installment_amount, 0),
      total_paid: filtered.reduce((s, e) => s + e.paid_amount, 0),
      total_outstanding: filtered.reduce((s, e) => s + e.outstanding, 0),
      paid_percentage: 0,
      expense_count: filtered.length,
      project_count: projectMap.size};
    grandTotal.paid_percentage = grandTotal.total_installment > 0 ? (grandTotal.total_paid / grandTotal.total_installment) * 100 : 0;

    return { yearGroups: sortedYears, grandTotal };
  }, [expenses, searchQuery]);

  // ─── Toggle helpers ───
  const toggleYear = (fy: string) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(fy)) next.delete(fy); else next.add(fy);
      return next;
    });
  };

  const toggleProject = (pid: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  };

  // ─── Supplier display name helper ───
  function supplierDisplayName(s: Supplier): string {
    return s.display_name || s.chinese_name || s.name || "未命名供應商";
  }

  // ─── Filtered suppliers for search ───
  const [supplierSearch, setSupplierSearch] = useState("");
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const q = supplierSearch.toLowerCase();
    return suppliers.filter(
      s =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.chinese_name || "").toLowerCase().includes(q) ||
        (s.display_name || "").toLowerCase().includes(q) ||
        (s.sort_type || "").toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearch]);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  // ─── Permission gate ───

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-500">載入供應商資料...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            應付未付管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Account Payable — 按供應商查閱所有支出，依項目及財政年度分組
          </p>
        </div>
        {selectedSupplierId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchExpenses(selectedSupplierId)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            重新整理
          </Button>
        )}
      </div>

      {/* Supplier Selector */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-gray-400 shrink-0" />
          <div className="flex-1 max-w-md">
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="選擇供應商..." />
              </SelectTrigger>
              <SelectContent className="max-h-[360px]">
                <div className="p-2 border-b">
                  <Input
                    placeholder="搜尋供應商..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                {filteredSuppliers.map((s) => (
                  <SelectItem
                    key={s.id}
                    value={s.id}
                    dropdownExtra={s.sort_type ? (
                      <Badge variant="outline" className="text-[11px] px-1 py-0 text-gray-400 ml-2">
                        {s.sort_type}
                      </Badge>
                    ) : undefined}
                  >
                    {supplierDisplayName(s)}
                  </SelectItem>
                ))}
                {filteredSuppliers.length === 0 && (
                  <div className="p-3 text-center text-xs text-gray-400">無符合結果</div>
                )}
              </SelectContent>
            </Select>
          </div>
          {selectedSupplierId && (
            <div className="flex-1">
              <Input
                placeholder="搜尋項目名稱 / 編號 / 發票..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 text-sm max-w-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* No Supplier Selected State */}
      {!selectedSupplierId && (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <Truck className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">請先選擇供應商以查閱應付記錄</p>
        </div>
      )}

      {/* Loading expenses */}
      {selectedSupplierId && refreshing && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span className="ml-2 text-xs text-gray-500">載入支出資料...</span>
        </div>
      )}

      {/* Content Area */}
      {selectedSupplierId && !refreshing && (
        <>
          {/* Grand Total KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              icon={<FileText className="w-4 h-4 text-blue-500" />}
              label="總支出筆數"
              value={`${grandTotal.expense_count} 筆`}
              sub={`涉及 ${grandTotal.project_count} 個項目`}
              bgClass="bg-blue-50"
            />
            <KPICard
              icon={<DollarSign className="w-4 h-4 text-indigo-500" />}
              label="合約總額"
              value={formatMoney2(grandTotal.total_installment)}
              sub="Installment Amount"
              bgClass="bg-indigo-50"
            />
            <KPICard
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              label="已付總額"
              value={formatMoney2(grandTotal.total_paid)}
              sub={`已付 ${pctStr(grandTotal.paid_percentage)}`}
              bgClass="bg-emerald-50"
            />
            <KPICard
              icon={<AlertCircle className="w-4 h-4 text-red-500" />}
              label="未付總額"
              value={formatMoney2(grandTotal.total_outstanding)}
              sub={`尚欠 ${pctStr(100 - grandTotal.paid_percentage)}`}
              bgClass="bg-red-50"
            />
          </div>

          {/* Grand Total Progress Bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">
                整體付款進度 — {selectedSupplier ? supplierDisplayName(selectedSupplier) : ""}
              </span>
              <span className="text-sm font-bold text-gray-900 font-mono">
                {pctStr(grandTotal.paid_percentage)}
              </span>
            </div>
            <Progress value={grandTotal.paid_percentage} className="h-3" />
            <div className="flex justify-between mt-1.5 text-[12px] text-gray-400">
              <span>已付 {formatMoney2(grandTotal.total_paid)}</span>
              <span>合約總額 {formatMoney2(grandTotal.total_installment)}</span>
            </div>
          </div>

          {/* Empty State */}
          {yearGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <CreditCard className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">此供應商暫無支出記錄</p>
            </div>
          )}

          {/* Vertical Timeline by Financial Year */}
          <div className="relative">
            {/* Timeline spine */}
            {yearGroups.length > 0 && (
              <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-blue-300 via-gray-200 to-gray-100 rounded-full" />
            )}

            <div className="space-y-6">
              {yearGroups.map((yg, yIdx) => (
                <div key={yg.financial_year} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className={`absolute left-[11px] top-4 w-4 h-4 rounded-full border-2 z-10 ${
                    yIdx === 0
                      ? "bg-blue-500 border-blue-300 shadow-md shadow-blue-200"
                      : "bg-white border-gray-300"
                  }`} />

                  {/* Year Card */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Year Header */}
                    <button
                      onClick={() => toggleYear(yg.financial_year)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-800">
                          {yg.financial_year}
                        </span>
                        <Badge variant="outline" className="text-[12px] px-1.5 text-gray-500">
                          {yg.projects.length} 個項目
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
                          <span>合約 <span className="font-mono font-medium text-gray-700">{formatMoney2(yg.total_installment)}</span></span>
                          <span>已付 <span className="font-mono font-medium text-emerald-600">{formatMoney2(yg.total_paid)}</span></span>
                          <span>未付 <span className="font-mono font-medium text-red-600">{formatMoney2(yg.total_outstanding)}</span></span>
                          <Badge className={`text-[12px] px-1.5 ${
                            yg.paid_percentage >= 80 ? "bg-emerald-100 text-emerald-700" :
                            yg.paid_percentage >= 50 ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {pctStr(yg.paid_percentage)}
                          </Badge>
                        </div>
                        {expandedYears.has(yg.financial_year)
                          ? <ChevronUp className="w-4 h-4 text-gray-400" />
                          : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                      </div>
                    </button>

                    {/* Year body — projects */}
                    {expandedYears.has(yg.financial_year) && (
                      <div className="border-t border-gray-100">
                        {/* Year progress */}
                        <div className="px-5 py-2 bg-gray-50/50">
                          <Progress value={yg.paid_percentage} className="h-1.5" />
                        </div>

                        {/* Project list within year */}
                        <div className="divide-y divide-gray-50">
                          {yg.projects.map((pg) => (
                            <div key={pg.project_id} className="group">
                              {/* Project row */}
                              <button
                                onClick={() => toggleProject(pg.project_id)}
                                className="w-full flex items-center justify-between px-5 py-3 hover:bg-blue-50/30 transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <Badge
                                    className={`text-[11px] px-1.5 py-0.5 font-medium ${
                                      pg.bw_type === "BWA"
                                        ? "bg-blue-100 text-blue-700 border-blue-200"
                                        : "bg-amber-100 text-amber-700 border-amber-200"
                                    }`}
                                    variant="outline"
                                  >
                                    {pg.bw_type}
                                  </Badge>
                                  <div className="text-left">
                                    <span className="text-sm font-medium text-gray-800">
                                      {pg.project_name}
                                    </span>
                                    {pg.project_code && (
                                      <span className="ml-2 text-[12px] text-gray-400 font-mono">
                                        {pg.project_code}
                                      </span>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="text-[11px] px-1 text-gray-400 ml-1">
                                    {pg.expenses.length} 筆
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="hidden md:flex items-center gap-2.5 text-xs">
                                    <span className="text-gray-500">
                                      合約 <span className="font-mono font-medium text-gray-700">{formatMoney2(pg.total_installment)}</span>
                                    </span>
                                    <span className="text-gray-500">
                                      未付 <span className="font-mono font-medium text-red-600">{formatMoney2(pg.total_outstanding)}</span>
                                    </span>
                                  </div>
                                  <div className="w-16">
                                    <div className="flex items-center gap-1">
                                      <Progress value={pg.paid_percentage} className="h-1.5 flex-1" />
                                      <span className="text-[11px] font-mono text-gray-500 w-8 text-right">
                                        {pctStr(pg.paid_percentage)}
                                      </span>
                                    </div>
                                  </div>
                                  {expandedProjects.has(pg.project_id)
                                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                                    : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                  }
                                </div>
                              </button>

                              {/* Expanded expense detail table */}
                              {expandedProjects.has(pg.project_id) && (
                                <div className="px-5 pb-3">
                                  <div className="bg-gray-50/80 rounded-lg border border-gray-100 overflow-hidden">
                                    {/* Project summary mini-bar */}
                                    <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 bg-white/50">
                                      <MiniStat label="合約" value={formatMoney2(pg.total_installment)} color="text-gray-700" />
                                      <MiniStat label="已付" value={formatMoney2(pg.total_paid)} color="text-emerald-600" />
                                      <MiniStat label="未付" value={formatMoney2(pg.total_outstanding)} color="text-red-600" />
                                      <MiniStat label="付款率" value={pctStr(pg.paid_percentage)} color="text-blue-600" />
                                    </div>

                                    {/* Expense rows table */}
                                    <div className="max-h-[320px] overflow-y-auto">
                                      <table className="w-full text-[13px]">
                                        <thead className="sticky top-0 bg-gray-100/90 backdrop-blur-sm">
                                          <tr className="border-b border-gray-200">
                                            <th className="text-left px-3 py-1.5 font-medium text-gray-500">類型 / 發票</th>
                                            <th className="text-right px-3 py-1.5 font-medium text-gray-500">合約額</th>
                                            <th className="text-right px-3 py-1.5 font-medium text-gray-500">已付</th>
                                            <th className="text-right px-3 py-1.5 font-medium text-gray-500">未付</th>
                                            <th className="text-center px-3 py-1.5 font-medium text-gray-500">付款率</th>
                                            <th className="text-center px-3 py-1.5 font-medium text-gray-500">狀態</th>
                                            <th className="text-right px-3 py-1.5 font-medium text-gray-500">日期</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                          {pg.expenses.map((exp) => {
                                            const expPct = exp.installment_amount > 0 ? (exp.paid_amount / exp.installment_amount) * 100 : 0;
                                            return (
                                              <tr key={exp.id} className="hover:bg-white/60">
                                                <td className="px-3 py-1.5">
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    {exp.type_display && (
                                                      <Badge variant="outline" className="text-[11px] px-1 py-0 border-gray-200 text-gray-600">
                                                        {exp.type_display}
                                                      </Badge>
                                                    )}
                                                    {exp.invoice_number && (
                                                      <span className="font-mono text-gray-700">{exp.invoice_number}</span>
                                                    )}
                                                  </div>
                                                  {exp.remark_t && (
                                                    <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]">{exp.remark_t}</p>
                                                  )}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono text-gray-700">
                                                  {formatMoney2(exp.installment_amount)}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono text-emerald-600">
                                                  {formatMoney2(exp.paid_amount)}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono font-medium text-red-600">
                                                  {formatMoney2(exp.outstanding)}
                                                </td>
                                                <td className="px-3 py-1.5 text-center">
                                                  <span className={`text-[12px] font-mono font-medium ${
                                                    expPct >= 100 ? "text-emerald-600" :
                                                    expPct >= 50 ? "text-amber-600" :
                                                    "text-red-600"
                                                  }`}>
                                                    {pctStr(expPct)}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-1.5 text-center">
                                                  <PaymentStatusBadge status={exp.payment_status} />
                                                </td>
                                                <td className="px-3 py-1.5 text-right text-gray-500">
                                                  {fmtDate(exp.payment_date || exp.created_date)}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───

function KPICard({
  icon,
  label,
  value,
  sub,
  bgClass}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  bgClass: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${bgClass}`}>
          {icon}
        </div>
        <span className="text-[13px] text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-lg font-bold text-gray-900 font-mono-num">{value}</div>
      <div className="text-[12px] text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      <span className="text-gray-400">{label}</span>
      <span className={`font-mono font-medium ${color}`}>{value}</span>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[11px] text-gray-300">未申請</span>;

  const styles: Record<string, string> = {
    "Pending Check": "bg-amber-100 text-amber-700",
    Approved: "bg-emerald-100 text-emerald-700",
    Rejected: "bg-red-100 text-red-700"};

  const labels: Record<string, string> = {
    "Pending Check": "待審核",
    Approved: "已批核",
    Rejected: "已拒絕"};

  const style = styles[status] || "bg-gray-100 text-gray-600";
  const label = labels[status] || status;

  return (
    <Badge className={`text-[11px] px-1.5 py-0 ${style}`} variant="outline">
      {label}
    </Badge>
  );
}
