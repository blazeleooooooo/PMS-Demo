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
  X,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Shield,
  CalendarIcon,
  Building2,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Construction,
  ExternalLink} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import {
  resolveBwfJunctionServiceTypesForProjects,
  resolveJunctionProjectTypesForProjects,
} from "@/lib/data/junctions";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";
import { ReportSourceToggle } from "@/components/reports/ReportDateRangeBar";

// ─── Types ───

interface ProjectWIP {
  id: string;
  project_name: string | null;
  project_code: string | null;
  project_id: string;
  pm_name: string | null;
  customer_name: string | null;
  service_type: string | null;
  bw_type: string;
  source: "BWA" | "BWF";
  status: string | null;
  signed_date: string | null;
  financial_year: string | null;
  project_type: string | null;
  income_outstanding: number;
  expense_outstanding: number;
  total_outstanding: number;
  income_count: number;
  expense_count: number;
  e_outstanding_date: string | null;
  crm_status: string | null;
  remark_count: number;
}

type SortField = "pm" | "project" | "customer" | "income_os" | "expense_os" | "total_os" | "signed_date" | "status";
type SortDir = "asc" | "desc";
type OutstandingTab = "all" | "income" | "expense" | "none";

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

// ─── CRM Status Badge Component ───

function CRMStatusBadge({ project, supabase }: { project: ProjectWIP; supabase: any }) {
  const [status, setStatus] = useState<string | null>(project.crm_status);
  const [loading, setLoading] = useState(false);

  const handleChange = async (newStatus: string) => {
    setLoading(true);
    const val = newStatus === "none" ? null : newStatus;
    setStatus(val);
    try {
      // Update all outstanding incomes for this project (BWA only)
      let query = supabase.from("incomes").update({ crm_status: val }).gt("outstanding", 0);
      query = query.or(`project_id.eq.${project.project_id},project.eq.${project.project_id}`);
      await query;
    } catch (err) {
      console.error("Failed to update CRM status:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={status || "none"} onValueChange={handleChange} disabled={loading}>
        <SelectTrigger className={`h-6 w-[100px] text-[12px] px-1.5 border ${
          status === "Normal" ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
          status === "In Risk" ? "border-amber-300 text-amber-700 bg-amber-50" :
          status === "Danger" ? "border-red-300 text-red-700 bg-red-50" :
          "border-gray-200 text-gray-400"
        }`}>
          <SelectValue placeholder="-" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none"><span className="text-xs text-gray-400">未設定</span></SelectItem>
          <SelectItem value="Normal">
            <span className="flex items-center gap-1 text-xs text-emerald-700"><ShieldCheck className="w-3 h-3" /> Normal</span>
          </SelectItem>
          <SelectItem value="In Risk">
            <span className="flex items-center gap-1 text-xs text-amber-700"><Shield className="w-3 h-3" /> In Risk</span>
          </SelectItem>
          <SelectItem value="Danger">
            <span className="flex items-center gap-1 text-xs text-red-700"><ShieldAlert className="w-3 h-3" /> Danger</span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Expected Date Picker ───

function ExpectedDatePicker({
  project,
  supabase,
  onUpdate}: {
  project: ProjectWIP;
  supabase: any;
  onUpdate: (newDate: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentDate = project.e_outstanding_date ? new Date(project.e_outstanding_date) : undefined;

  const handleDateSelect = async (date: Date | undefined) => {
    setSaving(true);
    const newDateStr = date ? date.toISOString().split("T")[0] : null;

    try {
      await supabase.from("bwa_projects").update({ e_outstanding_date: newDateStr }).eq("id", project.project_id);
      onUpdate(newDateStr);
    } catch (err) {
      console.error("Failed to update e_outstanding_date:", err);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`flex items-center gap-1 h-6 px-1.5 text-[12px] rounded border transition-colors ${
              currentDate
                ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                : "border-gray-200 text-gray-400 hover:bg-gray-50"
            } ${saving ? "opacity-50" : ""}`}
            disabled={saving}
          >
            <CalendarIcon className="w-3 h-3" />
            {currentDate ? project.e_outstanding_date?.split("T")[0] : "未設定"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-2">
            <Calendar mode="single" selected={currentDate} onSelect={handleDateSelect} initialFocus />
            {currentDate && (
              <div className="flex justify-end px-2 pb-2">
                <button
                  className="text-[12px] text-red-500 hover:text-red-700 underline"
                  onClick={(e) => { e.stopPropagation(); handleDateSelect(undefined); }}
                >
                  清除日期
                </button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Outstanding Breakdown Panel ───

interface OutstandingRecord {
  id: string;
  type: "income" | "expense";
  amount: number;
  payment_amount: number;
  outstanding: number;
  invoice_number: string | null;
  type_display: string | null;
  due_date: string | null;
  created_date: string | null;
  remark: string | null;
  status: string | null;
}

function OutstandingBreakdownPanel({ project, supabase }: { project: ProjectWIP; supabase: any }) {
  const { formatMoney2 } = useFinancialFormat();
  const [records, setRecords] = useState<OutstandingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchRecords() {
      setLoading(true);
      try {
        const projectId = project.project_id;
        const projectFk = project.source === "BWF" ? "bwf_project_id" : "project_id";

        const [incomesRes, expensesRes] = await Promise.all([
          supabase
            .from("incomes")
            .select("id, income_amount, payment_amount, outstanding, bad_debts, invoice_number, type_display, due_date, created_date, remark, status")
            .eq(projectFk, projectId)
            .gt("outstanding", 0)
            .order("created_date", { ascending: false }),
          supabase
            .from("expenses")
            .select("id, installment_amount, paid_amount, outstanding, invoice_number, payment_status, payment_date, created_date, type_display, remark_t")
            .eq(projectFk, projectId)
            .gt("outstanding", 0)
            .order("created_date", { ascending: false }),
        ]);

        if (incomesRes.error) console.error("[WIP Breakdown] Incomes error:", incomesRes.error.message);
        if (expensesRes.error) console.error("[WIP Breakdown] Expenses error:", expensesRes.error.message);

        const incomeRecords: OutstandingRecord[] = (incomesRes.data || [])
          .map((i: any) => {
            const net = Math.max(0, (Number(i.outstanding) || 0) - (Number(i.bad_debts) || 0));
            return {
              id: i.id,
              type: "income" as const,
              amount: i.income_amount || 0,
              payment_amount: i.payment_amount || 0,
              outstanding: net,
              invoice_number: i.invoice_number || null,
              type_display: i.type_display || null,
              due_date: i.due_date || null,
              created_date: i.created_date || null,
              remark: i.remark || null,
              status: i.status || null,
            };
          })
          .filter((r: OutstandingRecord) => r.outstanding > 0);

        const expenseRecords: OutstandingRecord[] = (expensesRes.data || []).map((e: any) => ({
          id: e.id,
          type: "expense" as const,
          amount: e.installment_amount || 0,
          payment_amount: e.paid_amount || 0,
          outstanding: e.outstanding || 0,
          invoice_number: e.invoice_number || null,
          type_display: e.type_display || null,
          due_date: e.payment_date || null,
          created_date: e.created_date || null,
          remark: e.remark_t || null,
          status: e.payment_status || null}));

        setRecords([...incomeRecords, ...expenseRecords]);
      } catch (err) {
        console.error("[WIP Breakdown] Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, [project.project_id, project.source, supabase]);

  const incomeRecords = records.filter((r) => r.type === "income");
  const expenseRecords = records.filter((r) => r.type === "expense");

  const goToProject = () => {
    const url =
      project.source === "BWF"
        ? `/bwf/projects/${project.project_id}`
        : `/projects/bwa/${project.project_id}`;
    window.open(url, "_blank", "noopener");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        <span className="ml-2 text-xs text-gray-500">載入明細...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with navigate button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] text-gray-500">
          <span>項目編號: {project.project_code || "-"}</span>
          <span>·</span>
          <span>客戶: {project.customer_name || "-"}</span>
          <span>·</span>
          <span>PM: {project.pm_name || "-"}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
          onClick={(e) => { e.stopPropagation(); goToProject(); }}
        >
          <ExternalLink className="w-3 h-3" />
          查看項目詳情
        </Button>
      </div>

      {/* Side-by-side panels: Income (left) + Expense (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Income Outstanding Panel - always visible */}
        <div className="bg-white rounded-lg border border-red-100">
          <div className="px-3 py-2 border-b border-red-50 bg-red-50/50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-red-700 flex items-center gap-1.5">
                <TrendingDown className="w-3 h-3" />
                應收未收明細 ({incomeRecords.length} 筆)
              </span>
              <span className="text-xs font-mono font-bold text-red-600">
                {formatMoney2(incomeRecords.reduce((s, r) => s + r.outstanding, 0))}
              </span>
            </div>
          </div>
          {incomeRecords.length > 0 ? (
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-gray-50/80 backdrop-blur-sm">
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-2 py-1.5 font-medium text-gray-500 w-[120px]">類型 / 編號</th>
                    <th className="text-right px-2 py-1.5 font-medium text-gray-500">金額</th>
                    <th className="text-right px-2 py-1.5 font-medium text-gray-500">已收</th>
                    <th className="text-right px-2 py-1.5 font-medium text-gray-500">欠款</th>
                    <th className="text-center px-2 py-1.5 font-medium text-gray-500 w-[70px]">收款率</th>
                    <th className="text-right px-2 py-1.5 font-medium text-gray-500 w-[80px]">日期</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {incomeRecords.map((rec) => {
                    const pct = rec.amount > 0 ? Math.round((rec.payment_amount / rec.amount) * 100) : 0;
                    return (
                      <tr key={rec.id} className="hover:bg-gray-50/50">
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            {rec.type_display && (
                              <Badge variant="outline" className="text-[11px] px-1 py-0 border-gray-200 text-gray-600">{rec.type_display}</Badge>
                            )}
                            {rec.invoice_number && (
                              <span className="text-gray-600 font-mono text-[12px]">#{rec.invoice_number}</span>
                            )}
                          </div>
                        </td>

                        <td className="px-2 py-1.5 text-right font-mono text-gray-700">{formatMoney2(rec.amount)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-green-600">{formatMoney2(rec.payment_amount)}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-red-600">{formatMoney2(rec.outstanding)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <div className="w-[32px] h-[4px] bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className={`text-[12px] font-mono ${pct >= 100 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-[12px] text-gray-400">
                          {rec.due_date ? fmtDate(rec.due_date) : rec.created_date ? fmtDate(rec.created_date) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-6 text-center text-gray-400 text-[13px]">暫無應收未收記錄</div>
          )}
        </div>

        {/* Expense Outstanding Panel - always visible */}
        <div className="bg-white rounded-lg border border-amber-100">
          <div className="px-3 py-2 border-b border-amber-50 bg-amber-50/50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-amber-700 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" />
                應付未付明細 ({expenseRecords.length} 筆)
              </span>
              <span className="text-xs font-mono font-bold text-amber-600">
                {formatMoney2(expenseRecords.reduce((s, r) => s + r.outstanding, 0))}
              </span>
            </div>
          </div>
          {expenseRecords.length > 0 ? (
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-gray-50/80 backdrop-blur-sm">
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-2 py-1.5 font-medium text-gray-500 w-[120px]">類型 / 編號</th>
                    <th className="text-right px-2 py-1.5 font-medium text-gray-500">金額</th>
                    <th className="text-right px-2 py-1.5 font-medium text-gray-500">已付</th>
                    <th className="text-right px-2 py-1.5 font-medium text-gray-500">欠款</th>
                    <th className="text-center px-2 py-1.5 font-medium text-gray-500 w-[70px]">付款率</th>
                    <th className="text-right px-2 py-1.5 font-medium text-gray-500 w-[80px]">日期</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expenseRecords.map((rec) => {
                    const pct = rec.amount > 0 ? Math.round((rec.payment_amount / rec.amount) * 100) : 0;
                    return (
                      <tr key={rec.id} className="hover:bg-gray-50/50">
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            {rec.type_display && (
                              <Badge variant="outline" className="text-[11px] px-1 py-0 border-gray-200 text-gray-600">{rec.type_display}</Badge>
                            )}
                            {rec.invoice_number && (
                              <span className="text-gray-600 font-mono text-[12px]">#{rec.invoice_number}</span>
                            )}
                          </div>
                        </td>

                        <td className="px-2 py-1.5 text-right font-mono text-gray-700">{formatMoney2(rec.amount)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-green-600">{formatMoney2(rec.payment_amount)}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-amber-600">{formatMoney2(rec.outstanding)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <div className="w-[32px] h-[4px] bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-amber-400'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className={`text-[12px] font-mono ${pct >= 100 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-amber-500'}`}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-[12px] text-gray-400">
                          {rec.due_date ? fmtDate(rec.due_date) : rec.created_date ? fmtDate(rec.created_date) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-6 text-center text-gray-400 text-[13px]">暫無應付未付記錄</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───

export default function WIPDebtManagement() {
  const { formatMoney2 } = useFinancialFormat();
  const { loading: permLoading } = usePermission();
  const supabase = useMemo(() => createClient(), []);
  const { sources } = useReportRange();
  const sourceType: "BWA" | "BWF" = sources.bwf && !sources.bwa ? "BWF" : "BWA";

  // Data
  const [projects, setProjects] = useState<ProjectWIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [pmFilter, setPmFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fyFilter, setFyFilter] = useState<string>("all");
  const [outstandingTab, setOutstandingTab] = useState<OutstandingTab>("all");

  // Sort
  const [sortField, setSortField] = useState<SortField>("total_os");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Filter lists
  // Expanded row
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // ─── Fetch Data ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bwaRes, bwfRes, staffRes, incomesRes, expensesRes, remarksRes, fyRes] = await Promise.all([
        supabase.from("bwa_projects").select("id, project_code, project_name, status, n_financial_year, signed_date, e_outstanding_date, real_customer_name, customer, main_pm, pm:staff!fk_bwa_projects_main_pm_id(name), cc:cost_centres!fk_bwa_projects_cost_centre_id(bu_code), st:service_types!fk_bwa_projects_n_service_type_id(display)").eq("status", "Work In Progress"),
        supabase.from("bwf_projects").select("id, project_code, project_name, status, n_financial_year, signed_date, e_outstanding_date, real_customer_name, real_customer_display_name, main_pm, main_pm_id, pm:staff!fk_bwf_projects_main_pm_id(name), cc:cost_centres!fk_bwf_projects_cost_center_id(bu_code), ctype:client_types!fk_bwf_projects_n_customer_type_id(display)").eq("status", "Work In Progress"),
        supabase.from("staff").select("id, name"),
        supabase.from("incomes").select("id, project_id, bwf_project_id, outstanding, bad_debts, crm_status").gt("outstanding", 0),
        supabase.from("expenses").select("id, project_id, bwf_project_id, outstanding").gt("outstanding", 0),
        supabase.from("outstanding_remarks").select("id, project_id, bwf_project_id, remarks").not("remarks", "is", null),
        supabase.from("financial_years").select("id, bubble_id, display"),
      ]);

      // Build financial year lookup: resolve bubble_id or UUID → display name
      const fyLookup = new Map<string, string>();
      (fyRes.data || []).forEach((fy: any) => {
        if (fy.display) {
          fyLookup.set(fy.id, fy.display);
          if (fy.bubble_id) fyLookup.set(fy.bubble_id, fy.display);
        }
      });
      const resolveFY = (ref: string | null): string | null => {
        if (!ref) return null;
        return fyLookup.get(ref) || null;
      };

      // Junction has no PostgREST FK, so an embed (`pt:project_types`) fails
      // silently. Resolve names the same way as /ap-rp and BWA project list.
      const bwfIds = (bwfRes.data || []).map((p: { id: string }) => p.id).filter(Boolean);
      const [projectTypeNames, bwfServiceTypeNames] = await Promise.all([
        resolveJunctionProjectTypesForProjects(
          (bwaRes.data || []).map((p: { id: string }) => p.id).filter(Boolean),
        ),
        resolveBwfJunctionServiceTypesForProjects(bwfIds),
      ]);

      // Build staff map
      const sMap = new Map<string, string>();
      (staffRes.data || []).forEach((s: any) => {
        sMap.set(s.id, s.name);
      });

      const addIncomeOs = (
        map: Map<string, { total: number; count: number; crm_status: string | null }>,
        projId: string | null,
        row: any,
      ) => {
        if (!projId) return;
        const net = Math.max(0, (Number(row.outstanding) || 0) - (Number(row.bad_debts) || 0));
        if (net <= 0) return;
        const existing = map.get(projId) || { total: 0, count: 0, crm_status: null };
        existing.total += net;
        existing.count += 1;
        if (row.crm_status) existing.crm_status = row.crm_status;
        map.set(projId, existing);
      };
      const addExpenseOs = (
        map: Map<string, { total: number; count: number }>,
        projId: string | null,
        row: any,
      ) => {
        if (!projId) return;
        const existing = map.get(projId) || { total: 0, count: 0 };
        existing.total += row.outstanding || 0;
        existing.count += 1;
        map.set(projId, existing);
      };

      const incomeOsMap = new Map<string, { total: number; count: number; crm_status: string | null }>();
      (incomesRes.data || []).forEach((i: any) => {
        addIncomeOs(incomeOsMap, i.project_id, i);
        addIncomeOs(incomeOsMap, i.bwf_project_id, i);
      });

      const expenseOsMap = new Map<string, { total: number; count: number }>();
      (expensesRes.data || []).forEach((e: any) => {
        addExpenseOs(expenseOsMap, e.project_id, e);
        addExpenseOs(expenseOsMap, e.bwf_project_id, e);
      });

      const remarkCountMap = new Map<string, number>();
      (remarksRes.data || []).forEach((r: any) => {
        if (!r.remarks?.trim()) return;
        if (r.project_id) remarkCountMap.set(r.project_id, (remarkCountMap.get(r.project_id) || 0) + 1);
        if (r.bwf_project_id) remarkCountMap.set(r.bwf_project_id, (remarkCountMap.get(r.bwf_project_id) || 0) + 1);
      });

      const wipProjects: ProjectWIP[] = [];

      // Process BWA projects — only show Work In Progress status
      (bwaRes.data || []).forEach((p: any) => {
        // Only include projects with "Work In Progress" status
        if (p.status !== "Work In Progress") return;

        const hasIncome = incomeOsMap.has(p.id);
        const hasExpense = expenseOsMap.has(p.id);

        const projId = p.id;
        const incomeData = incomeOsMap.get(projId) || { total: 0, count: 0, crm_status: null };
        const expenseData = expenseOsMap.get(projId) || { total: 0, count: 0 };

        const pmName = p.pm?.name || (p.main_pm ? sMap.get(p.main_pm) : null) || null;
        const serviceType = p.st?.display || null;

        const resolvedFY = resolveFY(p.n_financial_year);

        wipProjects.push({
          id: projId,
          project_name: p.project_name,
          project_code: p.project_code,
          project_id: projId,
          pm_name: pmName,
          customer_name: p.real_customer_name || null,
          service_type: serviceType,
          bw_type: p.cc?.bu_code || "BWA",
          source: "BWA",
          status: p.status,
          signed_date: p.signed_date,
          financial_year: resolvedFY,
          project_type: projectTypeNames.get(projId) || null,
          income_outstanding: incomeData.total,
          expense_outstanding: expenseData.total,
          total_outstanding: incomeData.total + expenseData.total,
          income_count: incomeData.count,
          expense_count: expenseData.count,
          e_outstanding_date: p.e_outstanding_date,
          crm_status: incomeData.crm_status,
          remark_count: remarkCountMap.get(projId) || 0});
      });

      (bwfRes.data || []).forEach((p: any) => {
        if (p.status !== "Work In Progress") return;

        const projId = p.id;
        const incomeData = incomeOsMap.get(projId) || { total: 0, count: 0, crm_status: null };
        const expenseData = expenseOsMap.get(projId) || { total: 0, count: 0 };
        const pmName = p.pm?.name || (p.main_pm_id ? sMap.get(p.main_pm_id) : null) || (p.main_pm ? sMap.get(p.main_pm) : null) || null;
        const serviceType = bwfServiceTypeNames.get(projId) || null;
        const resolvedFY = resolveFY(p.n_financial_year);

        wipProjects.push({
          id: projId,
          project_name: p.project_name,
          project_code: p.project_code,
          project_id: projId,
          pm_name: pmName,
          customer_name: p.real_customer_display_name || p.real_customer_name || null,
          service_type: serviceType,
          bw_type: p.cc?.bu_code || "BWF",
          source: "BWF",
          status: p.status,
          signed_date: p.signed_date,
          financial_year: resolvedFY,
          project_type: p.ctype?.display || null,
          income_outstanding: incomeData.total,
          expense_outstanding: expenseData.total,
          total_outstanding: incomeData.total + expenseData.total,
          income_count: incomeData.count,
          expense_count: expenseData.count,
          e_outstanding_date: p.e_outstanding_date,
          crm_status: incomeData.crm_status,
          remark_count: remarkCountMap.get(projId) || 0});
      });


      setProjects(wipProjects);
    } catch (err) {
      console.error("[WIP Debt] Fetch error:", err);
      setError("載入資料失敗");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Filter & Sort ───
  const sourceProjects = useMemo(
    () => projects.filter((p) => p.source === sourceType),
    [projects, sourceType]
  );

  const sourcePmList = useMemo(
    () => [...new Set(sourceProjects.map((p) => p.pm_name).filter(Boolean) as string[])].sort(),
    [sourceProjects]
  );
  const sourceFyList = useMemo(
    () => [...new Set(sourceProjects.map((p) => p.financial_year).filter(Boolean) as string[])].sort(),
    [sourceProjects]
  );

  const filteredData = useMemo(() => {
    let filtered = [...sourceProjects];

    // Outstanding tab filter
    if (outstandingTab === "all") {
      filtered = filtered.filter((p) => p.income_outstanding > 0 || p.expense_outstanding > 0);
    } else if (outstandingTab === "income") {
      filtered = filtered.filter((p) => p.income_outstanding > 0);
    } else if (outstandingTab === "expense") {
      filtered = filtered.filter((p) => p.expense_outstanding > 0);
    } else if (outstandingTab === "none") {
      filtered = filtered.filter((p) => p.income_outstanding === 0 && p.expense_outstanding === 0);
    }

    // PM
    if (pmFilter !== "all") {
      filtered = filtered.filter((p) => p.pm_name === pmFilter);
    }
    // Status
    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }
    // Financial year
    if (fyFilter !== "all") {
      filtered = filtered.filter((p) => p.financial_year === fyFilter);
    }
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.project_name || "").toLowerCase().includes(q) ||
          (p.project_code || "").toLowerCase().includes(q) ||
          (p.pm_name || "").toLowerCase().includes(q) ||
          (p.customer_name || "").toLowerCase().includes(q)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "pm": cmp = (a.pm_name || "").localeCompare(b.pm_name || ""); break;
        case "project": cmp = (a.project_name || "").localeCompare(b.project_name || ""); break;
        case "customer": cmp = (a.customer_name || "").localeCompare(b.customer_name || ""); break;
        case "income_os": cmp = (a.income_outstanding || 0) - (b.income_outstanding || 0); break;
        case "expense_os": cmp = (a.expense_outstanding || 0) - (b.expense_outstanding || 0); break;
        case "total_os": cmp = (a.total_outstanding || 0) - (b.total_outstanding || 0); break;
        case "signed_date":
          cmp = new Date(a.signed_date || 0).getTime() - new Date(b.signed_date || 0).getTime();
          break;
        case "status": cmp = (a.status || "").localeCompare(b.status || ""); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return filtered;
  }, [sourceProjects, outstandingTab, pmFilter, statusFilter, fyFilter, search, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

  // KPI totals
  const kpis = useMemo(() => {
    const totalIncomeOs = filteredData.reduce((s, p) => s + p.income_outstanding, 0);
    const totalExpenseOs = filteredData.reduce((s, p) => s + p.expense_outstanding, 0);
    return {
      projectCount: filteredData.length,
      totalIncomeOs,
      totalExpenseOs,
      totalOs: totalIncomeOs + totalExpenseOs};
  }, [filteredData]);

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={`w-3 h-3 inline ml-0.5 ${sortField === field ? "text-blue-600" : "text-gray-400"}`} />
  );

  // Reset page on filter changes
  useEffect(() => { setPage(1); }, [pmFilter, statusFilter, fyFilter, outstandingTab, search]);
  useEffect(() => {
    setPage(1);
    setPmFilter("all");
    setFyFilter("all");
    setExpandedProjectId(null);
  }, [sourceType]);

  // Permission gate

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            進行中工程欠款
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Work in Progress Outstanding — 檢視所有正在進行中的工程欠款
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">進行中項目</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {kpis.projectCount}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-xs text-gray-500">應收未收 總額</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {formatMoney2(kpis.totalIncomeOs)}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs text-gray-500">應付未付 總額</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {formatMoney2(kpis.totalExpenseOs)}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-violet-600" />
            </div>
            <span className="text-xs text-gray-500">合計欠款</span>
          </div>
          <div className="text-xl font-bold text-bw-navy font-mono-num">
            {formatMoney2(kpis.totalOs)}
          </div>
        </div>
      </div>

      <ReportSourceToggle />

      {/* ─── Outstanding Tabs ─── */}
      <Tabs value={outstandingTab} onValueChange={(val) => setOutstandingTab(val as OutstandingTab)} className="w-fit">
        <TabsList className="bg-gray-100/80">
          <TabsTrigger value="all" className="text-sm">All Outstanding</TabsTrigger>
          <TabsTrigger value="income" className="text-sm">Income Outstanding</TabsTrigger>
          <TabsTrigger value="expense" className="text-sm">Expense Outstanding</TabsTrigger>
          <TabsTrigger value="none" className="text-sm">No Outstanding</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ─── Search & Filter Bar ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="搜尋項目名稱、編號、客戶..."
              className="pl-9 h-9 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>



          {/* Advanced filter toggle */}
          <Button
            variant={filterOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterOpen(!filterOpen)}
            className="h-9"
          >
            <Filter className="w-4 h-4 mr-1" />
            高級篩選
            {filterOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </Button>

          {/* Active filter indicators */}
          {(pmFilter !== "all" || fyFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-red-500 hover:text-red-700"
              onClick={() => { setPmFilter("all"); setFyFilter("all"); setPage(1); }}
            >
              <X className="w-3 h-3 mr-1" />
              清除篩選
            </Button>
          )}

          {/* Record count */}
          <span className="text-xs text-gray-400 ml-auto">
            共 {filteredData.length} 條記錄
          </span>
        </div>

        {/* Advanced Filters */}
        {filterOpen && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
            {/* PM filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">項目經理</span>
              <Select value={pmFilter} onValueChange={(v) => { setPmFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {sourcePmList.map((pm) => <SelectItem key={pm} value={pm}>{pm}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Financial Year filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">財政年度</span>
              <Select value={fyFilter} onValueChange={(v) => { setFyFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {sourceFyList.map((fy) => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* ─── Table ─── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-500">載入中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-40 text-red-500 gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
            <Button variant="outline" size="sm" onClick={fetchData}>重試</Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="text-[12px] cursor-pointer" onClick={() => handleSort("signed_date")}>
                    簽約日期 <SortIcon field="signed_date" />
                  </TableHead>
                  <TableHead className="text-[12px]">BU</TableHead>
                  <TableHead className="text-[12px]">項目類型</TableHead>
                  <TableHead className="text-[12px]">服務類型</TableHead>
                  <TableHead className="text-[12px] cursor-pointer" onClick={() => handleSort("project")}>
                    項目 <SortIcon field="project" />
                  </TableHead>
                  <TableHead className="text-[12px] cursor-pointer" onClick={() => handleSort("customer")}>
                    客戶 <SortIcon field="customer" />
                  </TableHead>
                  <TableHead className="text-[12px] cursor-pointer" onClick={() => handleSort("pm")}>
                    項目經理 <SortIcon field="pm" />
                  </TableHead>

                  <TableHead className="text-[12px] text-right cursor-pointer" onClick={() => handleSort("income_os")}>
                    應收未收 <SortIcon field="income_os" />
                  </TableHead>
                  <TableHead className="text-[12px] text-right cursor-pointer" onClick={() => handleSort("expense_os")}>
                    應付未付 <SortIcon field="expense_os" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-sm text-gray-400 py-16">
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      暫無符合篩選條件的工程欠款資料
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((proj) => (
                    <React.Fragment key={proj.id}>
                      <TableRow
                        className={`cursor-pointer transition-all hover:bg-blue-50/40 hover:shadow-sm border-l-2 border-l-blue-400 ${
                          expandedProjectId === proj.id ? "bg-blue-50/60 border-l-blue-500" : ""
                        }`}
                        onClick={() => setExpandedProjectId(expandedProjectId === proj.id ? null : proj.id)}
                      >
                        <TableCell className="py-2 text-xs text-gray-500">{fmtDate(proj.signed_date)}</TableCell>
                        <TableCell className="py-2">
                          <span className={`text-xs font-medium ${proj.bw_type === "BWA" ? "text-blue-600" : proj.bw_type === "BWF" ? "text-amber-600" : "text-gray-600"}`}>
                            {proj.bw_type || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-gray-600">{proj.project_type || "-"}</TableCell>
                        <TableCell className="py-2 text-xs text-gray-600">{proj.service_type || "-"}</TableCell>
                        <TableCell className="py-2">
                          <div className="text-xs font-medium text-gray-800">{proj.project_name || "-"}</div>
                          <div className="text-[12px] text-gray-400">{proj.project_code || ""}</div>
                        </TableCell>
                        <TableCell className="py-2 text-xs text-gray-600">{proj.customer_name || "-"}</TableCell>
                        <TableCell className="py-2 text-xs text-gray-700">{proj.pm_name || "-"}</TableCell>

                        <TableCell className="py-2 text-right">
                          <span className={`text-xs font-mono font-medium ${proj.income_outstanding > 0 ? "text-gray-800" : "text-gray-400"}`}>
                            {formatMoney2(proj.income_outstanding)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <span className={`text-xs font-mono font-medium ${proj.expense_outstanding > 0 ? "text-gray-800" : "text-gray-400"}`}>
                            {formatMoney2(proj.expense_outstanding)}
                          </span>
                        </TableCell>
                      </TableRow>

                      {/* Expanded row: outstanding breakdown */}
                      {expandedProjectId === proj.id && (
                        <TableRow className="bg-gray-50/50">
                          <TableCell colSpan={10} className="p-4">
                            <OutstandingBreakdownPanel project={proj} supabase={supabase} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {filteredData.length > pageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-[13px] text-gray-500">
                  顯示 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredData.length)} / 共 {filteredData.length} 筆
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => setPage(1)}>
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-xs text-gray-600 px-2">{page} / {totalPages}</span>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
