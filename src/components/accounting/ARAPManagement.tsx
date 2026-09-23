"use client";

/* AR/AP Management — BWA/BWF toggle, team pills, linked project detail */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  ArrowUpDown,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { AsanaLinkButton } from "@/components/ui/asana-link-button";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import ProjectFinanceHistoryDialog, {
  type FinanceHistoryTab,
} from "@/components/projects/ProjectFinanceHistoryDialog";
import type { ProjectEntityType } from "@/components/projects/ProjectFinancePanels";
import {
  hasReceivableOutstanding,
  incomeNetOutstanding,
} from "@/lib/income-outstanding";
import {
  resolveRange,
  rangeBounds,
  fmtRangeDate,
} from "@/lib/report-date-range";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";
import ReportFilterStack from "@/components/reports/ReportFilterStack";
import {
  applyProjectFilters,
  type ProjectFilterFields,
  type ProjectFilterState,
} from "@/components/reports/ProjectFilterBar";
import {
  staffIdMatchesFilter,
  type StaffFilterState,
} from "@/components/reports/StaffFilterBar";
import { useAlignedReportFilters } from "@/hooks/use-aligned-report-filters";
import type { StaffDirectoryRow } from "@/lib/data-service";
import {
  resolveJunctionProjectTypesForProjects,
  resolveBwfJunctionServiceTypesForProjects,
} from "@/lib/data/junctions";
import { toHkYmd } from "@/lib/date-utils";

// ─── Types ───

type DateTarget =
  | "due_date"
  | "expected_payment_date"
  | "created_date"
  | "enquiry_date"
  | "signed_date";

const DATE_TARGET_OPTIONS: { value: DateTarget; label: string }[] = [
  { value: "due_date", label: "到期日 Due Date" },
  { value: "expected_payment_date", label: "預計付款日期 Expected Payment" },
  { value: "created_date", label: "款項建立日期 Creation Date" },
  { value: "enquiry_date", label: "查詢日期 Enquiry Date" },
  { value: "signed_date", label: "簽約日期 Signed Date" },
];

interface IncomeRow {
  id: string;
  type_display: string | null;
  project_name: string | null;
  project_code: string | null;
  project_id: string | null;
  due_date: string | null;
  expected_payment_date: string | null;
  created_date: string | null;
  income_amount: number | null;
  payment_amount: number | null;
  /** Net receivable after bad debts (outstanding - bad_debts) */
  outstanding: number | null;
  bw_type: "BWA" | "BWF";
  pm_name: string | null;
  asana_link: string | null;
}

interface ExpenseRow {
  id: string;
  type_display: string | null;
  project_name: string | null;
  project_code: string | null;
  project_id: string | null;
  due_date: string | null;
  expected_payment_date: string | null;
  created_date: string | null;
  installment_amount: number | null;
  paid_amount: number | null;
  outstanding: number | null;
  bw_type: "BWA" | "BWF";
  vendor_name: string | null;
  asana_link: string | null;
}

type SortField = "outstanding" | "amount" | "due_date" | "expected_payment_date" | "project";
type SortDir = "asc" | "desc";

type ArapProject = ProjectFilterFields & {
  bw_type: "BWA" | "BWF";
  pm_id: string | null;
  enquiry_date: string | null;
  signed_date: string | null;
  asana_link: string | null;
};

// ─── Helpers ───

function fmtDate(d: string | null): string {
  const ymd = toHkYmd(d);
  return ymd ? ymd.replace(/-/g, "/") : "-";
}

function isOverdue(d: string | null): boolean {
  if (!d) return false;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return false;
    return date.getTime() < Date.now();
  } catch {
    return false;
  }
}

function relOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function dateInRange(value: string | null, fromMs: number, toMs: number): boolean {
  if (fromMs === -Infinity && toMs === Infinity) return true;
  if (!value) return false;
  const t = new Date(value).getTime();
  return !isNaN(t) && t >= fromMs && t <= toMs;
}

function rowDateForTarget(
  target: DateTarget,
  row: {
    due_date: string | null;
    expected_payment_date: string | null;
    created_date: string | null;
    project_id: string | null;
  },
  proj: ArapProject | undefined,
): string | null {
  switch (target) {
    case "due_date":
      return row.due_date;
    case "expected_payment_date":
      return row.expected_payment_date;
    case "created_date":
      return row.created_date;
    case "enquiry_date":
      return proj?.enquiry_date ?? null;
    case "signed_date":
      return proj?.signed_date ?? null;
  }
}

function isProjectFilterIdle(f: ProjectFilterState): boolean {
  return (
    !f.search.trim() &&
    f.status === "all" &&
    f.bu === "all" &&
    f.serviceType === "all" &&
    f.projectType === "all" &&
    f.size === "all" &&
    f.financialYear === "all"
  );
}

function isStaffFilterIdle(f: StaffFilterState): boolean {
  return f.bu === "all" && f.team === "all" && f.position === "all" && f.staffId === "all";
}

function projectDetailUrl(bwType: "BWA" | "BWF", projectId: string | null): string | null {
  if (!projectId) return null;
  return bwType === "BWF" ? `/bwf/projects/${projectId}` : `/projects/bwa/${projectId}`;
}

function openProjectDetail(bwType: "BWA" | "BWF", projectId: string | null) {
  const url = projectDetailUrl(bwType, projectId);
  if (!url) return;
  window.open(url, "_blank", "noopener");
}

// ─── Main Component ───

const BWA_PROJECT_SELECT = `
  id, project_name, project_code, status, project_size, estimated_income,
  enquiry_date, signed_date, asana_link,
  main_pm_id, n_team_type_id, n_financial_year_id, n_service_type_id,
  pm:staff!fk_bwa_projects_main_pm_id(id, name),
  fy:financial_years!fk_bwa_projects_n_financial_year_id(id, display),
  cc:cost_centres!fk_bwa_projects_cost_centre_id(id, bu_code),
  st:service_types!fk_bwa_projects_n_service_type_id(id, display)
`;

const BWF_PROJECT_SELECT = `
  id, project_name, project_code, status, estimated_income,
  enquiry_date, signed_date, asana_link,
  main_pm_id, n_team_type_id, n_financial_year_id, n_customer_type_id,
  pm:staff!fk_bwf_projects_main_pm_id(id, name),
  fy:financial_years!fk_bwf_projects_n_financial_year_id(id, display),
  cc:cost_centres!fk_bwf_projects_cost_center_id(id, bu_code),
  ctype:client_types!fk_bwf_projects_n_customer_type_id(id, display)
`;

async function fetchAllTableRows(
  client: ReturnType<typeof createClient>,
  table: string,
  select: string,
): Promise<any[]> {
  const PAGE = 1000;
  const rows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await client.from(table).select(select).range(from, from + PAGE - 1);
    if (error) {
      console.error(`[ARAP] ${table} fetch error:`, error.message);
      break;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

export default function ARAPManagement() {
  const { formatMoney2 } = useFinancialFormat();
  const { loading: permLoading } = usePermission();
  const supabase = createClient();
  const { range: selectedPreset, custom, sources } = useReportRange();
  const {
    projectFilter,
    setProjectFilter,
    staffFilter,
    setStaffFilter,
    staffLocks,
    isSuperAdmin,
  } = useAlignedReportFilters("business");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [incomes, setIncomes] = useState<IncomeRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [projects, setProjects] = useState<ArapProject[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const [sortAR, setSortAR] = useState<{ field: SortField; dir: SortDir }>({
    field: "outstanding",
    dir: "desc",
  });
  const [sortAP, setSortAP] = useState<{ field: SortField; dir: SortDir }>({
    field: "outstanding",
    dir: "desc",
  });
  const [dateTarget, setDateTarget] = useState<DateTarget>("due_date");

  const [financeDialog, setFinanceDialog] = useState<{
    projectId: string;
    entityType: ProjectEntityType;
    projectCode: string | null;
    projectName: string | null;
    initialTab: FinanceHistoryTab;
  } | null>(null);

  const openFinanceDialog = (
    row: Pick<IncomeRow, "project_id" | "bw_type" | "project_code" | "project_name">,
    initialTab: FinanceHistoryTab
  ) => {
    if (!row.project_id) return;
    setFinanceDialog({
      projectId: row.project_id,
      entityType: row.bw_type === "BWF" ? "bwf_project" : "bwa_project",
      projectCode: row.project_code,
      projectName: row.project_name,
      initialTab,
    });
  };

  const fetchData = useCallback(async () => {
    setRefreshing(true);

    try {
      const [bwaRows, bwfRows] = await Promise.all([
        fetchAllTableRows(supabase, "bwa_projects", BWA_PROJECT_SELECT),
        fetchAllTableRows(supabase, "bwf_projects", BWF_PROJECT_SELECT),
      ]);

      const bwaIds = bwaRows.map((p: any) => p.id).filter(Boolean);
      const bwfIds = bwfRows.map((p: any) => p.id).filter(Boolean);
      const [bwaPtNames, bwfStNames] = await Promise.all([
        resolveJunctionProjectTypesForProjects(bwaIds),
        resolveBwfJunctionServiceTypesForProjects(bwfIds),
      ]);

      const mapBwa = (p: any): ArapProject => {
        const pm = relOne<{ id: string; name: string }>(p.pm);
        const fy = relOne<{ id: string; display: string }>(p.fy);
        const cc = relOne<{ bu_code: string }>(p.cc);
        const st = relOne<{ id: string; display: string }>(p.st);
        return {
          id: p.id,
          status: p.status ?? null,
          cost_centre_bu_code: cc?.bu_code ?? null,
          service_type_name: st?.display ?? null,
          service_type_id: st?.id ?? p.n_service_type_id ?? null,
          project_type_name: bwaPtNames.get(p.id) ?? null,
          project_type_id: null,
          financial_year_name: fy?.display ?? null,
          n_financial_year_id: fy?.id ?? p.n_financial_year_id ?? null,
          est_income: p.estimated_income ?? null,
          project_size: p.project_size ?? null,
          project_name: p.project_name ?? null,
          project_code: p.project_code ?? null,
          pm_name: pm?.name ?? null,
          pm_id: pm?.id ?? p.main_pm_id ?? null,
          enquiry_date: p.enquiry_date ?? null,
          signed_date: p.signed_date ?? null,
          asana_link: p.asana_link ?? null,
          bw_type: "BWA",
        };
      };

      const mapBwf = (p: any): ArapProject => {
        const pm = relOne<{ id: string; name: string }>(p.pm);
        const fy = relOne<{ id: string; display: string }>(p.fy);
        const cc = relOne<{ bu_code: string }>(p.cc);
        const ctype = relOne<{ id: string; display: string }>(p.ctype);
        return {
          id: p.id,
          status: p.status ?? null,
          cost_centre_bu_code: cc?.bu_code ?? null,
          service_type_name: bwfStNames.get(p.id) ?? null,
          service_type_id: null,
          project_type_name: ctype?.display ?? null,
          project_type_id: ctype?.id ?? p.n_customer_type_id ?? null,
          financial_year_name: fy?.display ?? null,
          n_financial_year_id: fy?.id ?? p.n_financial_year_id ?? null,
          est_income: p.estimated_income ?? null,
          project_size: null,
          project_name: p.project_name ?? null,
          project_code: p.project_code ?? null,
          pm_name: pm?.name ?? null,
          pm_id: pm?.id ?? p.main_pm_id ?? null,
          enquiry_date: p.enquiry_date ?? null,
          signed_date: p.signed_date ?? null,
          asana_link: p.asana_link ?? null,
          bw_type: "BWF",
        };
      };

      const mappedProjects = [
        ...bwaRows.map(mapBwa),
        ...bwfRows.map(mapBwf),
      ];
      setProjects(mappedProjects);

      const bwaMap = new Map(mappedProjects.filter((p) => p.bw_type === "BWA").map((p) => [p.id, p]));
      const bwfMap = new Map(mappedProjects.filter((p) => p.bw_type === "BWF").map((p) => [p.id, p]));

      const [incomeBwaRes, incomeBwfRes, expenseBwaRes, expenseBwfRes] = await Promise.all([
        supabase
          .from("incomes")
          .select("id, type_display, income_amount, payment_amount, outstanding, bad_debts, due_date, expected_payment_date, created_date, project_id")
          .gt("outstanding", 0)
          .not("project_id", "is", null)
          .order("outstanding", { ascending: false })
          .limit(3000),
        supabase
          .from("incomes")
          .select("id, type_display, income_amount, payment_amount, outstanding, bad_debts, due_date, expected_payment_date, created_date, bwf_project_id")
          .gt("outstanding", 0)
          .not("bwf_project_id", "is", null)
          .order("outstanding", { ascending: false })
          .limit(3000),
        supabase
          .from("expenses")
          .select("id, type_display, installment_amount, paid_amount, outstanding, due_date, expected_payment_date, created_date, project_id, supplier_id")
          .gt("outstanding", 0)
          .not("project_id", "is", null)
          .order("outstanding", { ascending: false })
          .limit(3000),
        supabase
          .from("expenses")
          .select("id, type_display, installment_amount, paid_amount, outstanding, due_date, expected_payment_date, created_date, bwf_project_id, supplier_id")
          .gt("outstanding", 0)
          .not("bwf_project_id", "is", null)
          .order("outstanding", { ascending: false })
          .limit(3000),
      ]);

      if (incomeBwaRes.error) console.error("[ARAP] BWA income fetch error:", incomeBwaRes.error.message);
      if (incomeBwfRes.error) console.error("[ARAP] BWF income fetch error:", incomeBwfRes.error.message);
      if (expenseBwaRes.error) console.error("[ARAP] BWA expense fetch error:", expenseBwaRes.error.message);
      if (expenseBwfRes.error) console.error("[ARAP] BWF expense fetch error:", expenseBwfRes.error.message);

      const allExpenses = [...(expenseBwaRes.data || []), ...(expenseBwfRes.data || [])];
      const supplierIds = [
        ...new Set(allExpenses.filter((e: any) => e.supplier_id).map((e: any) => e.supplier_id)),
      ];
      const supplierMap = new Map<string, string>();
      if (supplierIds.length > 0) {
        const { data: suppData } = await supabase
          .from("suppliers")
          .select("id, name, chinese_name, display_name")
          .in("id", supplierIds.slice(0, 500));
        (suppData || []).forEach((s: any) => {
          supplierMap.set(s.id, s.display_name || s.chinese_name || s.name || "未命名");
        });
      }

      const mapIncome = (
        rows: any[] | null,
        bwType: "BWA" | "BWF",
        projectKey: "project_id" | "bwf_project_id",
        projMap: Map<string, ArapProject>
      ): IncomeRow[] =>
        (rows || [])
          .filter((i: any) => hasReceivableOutstanding(i))
          .map((i: any) => {
            const projectId = i[projectKey] as string | null;
            const proj = projectId ? projMap.get(projectId) || null : null;
            return {
              id: i.id,
              type_display: i.type_display,
              project_name: proj?.project_name || null,
              project_code: proj?.project_code || null,
              project_id: projectId,
              due_date: i.due_date,
              expected_payment_date: i.expected_payment_date,
              created_date: i.created_date ?? null,
              income_amount: i.income_amount,
              payment_amount: i.payment_amount,
              outstanding: incomeNetOutstanding(i),
              bw_type: bwType,
              pm_name: proj?.pm_name || null,
              asana_link: proj?.asana_link || null,
            };
          });

      const mapExpense = (
        rows: any[] | null,
        bwType: "BWA" | "BWF",
        projectKey: "project_id" | "bwf_project_id",
        projMap: Map<string, ArapProject>
      ): ExpenseRow[] =>
        (rows || []).map((e: any) => {
          const projectId = e[projectKey] as string | null;
          const proj = projectId ? projMap.get(projectId) || null : null;
          return {
            id: e.id,
            type_display: e.type_display,
            project_name: proj?.project_name || null,
            project_code: proj?.project_code || null,
            project_id: projectId,
            due_date: e.due_date,
            expected_payment_date: e.expected_payment_date,
            created_date: e.created_date ?? null,
            installment_amount: e.installment_amount,
            paid_amount: e.paid_amount,
            outstanding: e.outstanding,
            bw_type: bwType,
            vendor_name: e.supplier_id ? supplierMap.get(e.supplier_id) || null : null,
            asana_link: proj?.asana_link || null,
          };
        });

      setIncomes([
        ...mapIncome(incomeBwaRes.data, "BWA", "project_id", bwaMap),
        ...mapIncome(incomeBwfRes.data, "BWF", "bwf_project_id", bwfMap),
      ]);
      setExpenses([
        ...mapExpense(expenseBwaRes.data, "BWA", "project_id", bwaMap),
        ...mapExpense(expenseBwfRes.data, "BWF", "bwf_project_id", bwfMap),
      ]);
    } catch (err) {
      console.error("[ARAP] Unexpected error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sourceType: "BWA" | "BWF" = sources.bwf && !sources.bwa ? "BWF" : "BWA";
  const sourceLabel = sourceType;

  const window = useMemo(
    () => resolveRange(selectedPreset, new Date(), custom),
    [selectedPreset, custom]
  );
  const dateTargetLabel =
    DATE_TARGET_OPTIONS.find((o) => o.value === dateTarget)?.label ?? "到期日 Due Date";
  const dateRangeLabel = useMemo(
    () => `From ${fmtRangeDate(window.from)} to ${fmtRangeDate(window.to)} · ${dateTargetLabel}`,
    [window, dateTargetLabel]
  );

  const sourceProjects = useMemo(
    () => projects.filter((p) => p.bw_type === sourceType),
    [projects, sourceType]
  );

  const projectById = useMemo(
    () => new Map(sourceProjects.map((p) => [p.id, p])),
    [sourceProjects]
  );

  const allowedProjectIds = useMemo(() => {
    const filtered = applyProjectFilters(sourceProjects, projectFilter).filter((p) =>
      staffIdMatchesFilter(p.pm_id, staffFilter, staffDirectory)
    );
    return new Set(filtered.map((p) => p.id));
  }, [sourceProjects, projectFilter, staffFilter, staffDirectory]);

  const filtersIdle =
    isProjectFilterIdle(projectFilter) && isStaffFilterIdle(staffFilter);

  const filteredIncomes = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    let data = incomes.filter((i) => {
      if (i.bw_type !== sourceType) return false;
      const proj = i.project_id ? projectById.get(i.project_id) : undefined;
      if (!dateInRange(rowDateForTarget(dateTarget, i, proj), fromMs, toMs)) return false;
      if (!i.project_id) return false;
      if (allowedProjectIds.has(i.project_id)) return true;
      return filtersIdle;
    });
    data = [...data].sort((a, b) => {
      const dir = sortAR.dir === "asc" ? 1 : -1;
      switch (sortAR.field) {
        case "outstanding":
          return ((a.outstanding || 0) - (b.outstanding || 0)) * dir;
        case "amount":
          return ((a.income_amount || 0) - (b.income_amount || 0)) * dir;
        case "due_date":
          return (a.due_date || "").localeCompare(b.due_date || "") * dir;
        case "expected_payment_date":
          return (a.expected_payment_date || "").localeCompare(b.expected_payment_date || "") * dir;
        case "project":
          return (a.project_name || "").localeCompare(b.project_name || "") * dir;
        default:
          return 0;
      }
    });
    return data;
  }, [incomes, sourceType, window, allowedProjectIds, filtersIdle, sortAR, dateTarget, projectById]);

  const filteredExpenses = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    let data = expenses.filter((e) => {
      if (e.bw_type !== sourceType) return false;
      const proj = e.project_id ? projectById.get(e.project_id) : undefined;
      if (!dateInRange(rowDateForTarget(dateTarget, e, proj), fromMs, toMs)) return false;
      if (!e.project_id) return false;
      if (allowedProjectIds.has(e.project_id)) return true;
      return filtersIdle;
    });
    data = [...data].sort((a, b) => {
      const dir = sortAP.dir === "asc" ? 1 : -1;
      switch (sortAP.field) {
        case "outstanding":
          return ((a.outstanding || 0) - (b.outstanding || 0)) * dir;
        case "amount":
          return ((a.installment_amount || 0) - (b.installment_amount || 0)) * dir;
        case "due_date":
          return (a.due_date || "").localeCompare(b.due_date || "") * dir;
        case "expected_payment_date":
          return (a.expected_payment_date || "").localeCompare(b.expected_payment_date || "") * dir;
        case "project":
          return (a.project_name || "").localeCompare(b.project_name || "") * dir;
        default:
          return 0;
      }
    });
    return data;
  }, [expenses, sourceType, window, allowedProjectIds, filtersIdle, sortAP, dateTarget, projectById]);

  const arTotals = useMemo(() => {
    const totalContract = filteredIncomes.reduce((s, i) => s + (i.income_amount || 0), 0);
    const totalPaid = filteredIncomes.reduce((s, i) => s + (i.payment_amount || 0), 0);
    const totalOutstanding = filteredIncomes.reduce((s, i) => s + (i.outstanding || 0), 0);
    return { totalContract, totalPaid, totalOutstanding };
  }, [filteredIncomes]);

  const apTotals = useMemo(() => {
    const totalContract = filteredExpenses.reduce((s, e) => s + (e.installment_amount || 0), 0);
    const totalPaid = filteredExpenses.reduce((s, e) => s + (e.paid_amount || 0), 0);
    const totalOutstanding = filteredExpenses.reduce((s, e) => s + (e.outstanding || 0), 0);
    return { totalContract, totalPaid, totalOutstanding };
  }, [filteredExpenses]);

  const toggleSortAR = (field: SortField) => {
    setSortAR((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "desc" ? "asc" : "desc",
    }));
  };

  const toggleSortAP = (field: SortField) => {
    setSortAP((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "desc" ? "asc" : "desc",
    }));
  };

  if (loading || permLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
        <span className="ml-3 text-gray-500 text-sm">載入數據中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bw-navy" style={{ fontFamily: "Syne, sans-serif" }}>
            應付未付及應收未收
          </h1>
          <p className="text-sm text-gray-500 mt-1 inline-flex items-center gap-1">
            Account Receivable & Payable — 管理所有未收費/未付清款項的進行中項目
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex text-gray-400 hover:text-gray-600"
                    aria-label="顯示條件說明"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[320px] bg-gray-900 text-white text-xs leading-relaxed font-normal"
                >
                  Show a row if it is a project-linked income or expense with outstanding &gt; 0; for income, outstanding − bad_debts must also be &gt; 0.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </p>
          <p className="text-sm text-gray-400 mt-0.5">{dateRangeLabel}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData()}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>

      <ReportFilterStack
        showL2L3={false}
        projectRows={sourceProjects}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        staffLocks={staffLocks}
        isSuperAdmin={isSuperAdmin}
        onStaffDirectoryLoaded={setStaffDirectory}
        afterDate={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-gray-400 font-medium">日期基準</span>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white flex-wrap">
              {DATE_TARGET_OPTIONS.map((opt, idx) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDateTarget(opt.value)}
                  className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    idx > 0 ? "border-l border-gray-200" : ""
                  } ${
                    dateTarget === opt.value
                      ? "bg-bw-blue text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="flex justify-end">
        <span className="text-xs text-gray-400">
          {sourceLabel} · AR: {filteredIncomes.length} 筆 | AP: {filteredExpenses.length} 筆
        </span>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ─── LEFT: Accounts Receivable (AR) ─── */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gradient-to-r from-blue-50/80 to-white">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                Accounts Receivable (Sales Revenue)
              </h2>
              <Badge variant="outline" className="text-bw-blue border-bw-blue/30 bg-blue-50/50 text-xs">
                {filteredIncomes.length} 筆
              </Badge>
            </div>
          </div>

          <div className="px-5 py-3 border-b bg-gray-50/50 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Account Receivable Contract Sum</span>
              <span className="font-semibold text-gray-900 font-mono-num">
                {formatMoney2(arTotals.totalContract)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Customer Paid</span>
              <span className="font-semibold text-gray-900 font-mono-num">
                {formatMoney2(arTotals.totalPaid)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-red-600">Total Outstanding</span>
              <span className="text-red-600 font-mono-num">
                {formatMoney2(arTotals.totalOutstanding)}
              </span>
            </div>
          </div>

          <div className="h-[calc(100vh-420px)] min-h-[400px] overflow-y-auto">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[60px] text-xs bg-white">Type</TableHead>
                  <TableHead className="text-xs bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSortAR("project")}
                      className="flex items-center gap-1 hover:text-bw-blue transition-colors"
                    >
                      Project Name <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSortAR("due_date")}
                      className="flex items-center gap-1 hover:text-bw-blue transition-colors"
                    >
                      Due Date <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSortAR("expected_payment_date")}
                      className="flex items-center gap-1 hover:text-bw-blue transition-colors"
                    >
                      Expected Payment Date <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs text-right bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSortAR("amount")}
                      className="flex items-center gap-1 justify-end hover:text-bw-blue transition-colors ml-auto"
                    >
                      Invoice Amount <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs text-right bg-white">Paid Amount</TableHead>
                  <TableHead className="text-xs text-right bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSortAR("outstanding")}
                      className="flex items-center gap-1 justify-end hover:text-bw-blue transition-colors ml-auto"
                    >
                      Outstanding <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[44px] text-center text-xs bg-white">Asana</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncomes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-sm text-gray-400">
                      無符合條件的應收記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIncomes.map((row) => {
                    const canOpen = Boolean(row.project_id);
                    return (
                      <TableRow
                        key={row.id}
                        className={`hover:bg-blue-50/30 group ${canOpen ? "cursor-pointer" : ""}`}
                        onClick={() => openFinanceDialog(row, "income")}
                      >
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className="text-[12px] px-1.5 py-0 font-medium border-bw-blue/40 text-bw-blue bg-blue-50/50"
                          >
                            {row.type_display || "Main"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5">
                            <div>
                              <button
                                type="button"
                                disabled={!canOpen}
                                className="text-left text-xs font-medium text-gray-900 truncate max-w-[180px] hover:text-bw-blue hover:underline transition-colors disabled:hover:no-underline disabled:hover:text-gray-900"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openProjectDetail(row.bw_type, row.project_id);
                                }}
                              >
                                {row.project_name || row.project_code || "-"}
                              </button>
                              {row.pm_name && (
                                <p className="text-[12px] text-gray-400">{row.pm_name}</p>
                              )}
                            </div>
                            {canOpen && (
                              <ArrowRight className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <span
                            className={`text-xs whitespace-nowrap ${
                              isOverdue(row.due_date) ? "text-red-500 font-medium" : "text-gray-600"
                            }`}
                          >
                            {fmtDate(row.due_date)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-xs whitespace-nowrap text-gray-600">
                            {fmtDate(row.expected_payment_date)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <span className="text-xs font-mono-num text-gray-700">
                            {formatMoney2(row.income_amount)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <span className="text-xs font-mono-num text-gray-500">
                            {formatMoney2(row.payment_amount)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <span className="text-xs font-mono-num font-semibold text-red-600">
                            {formatMoney2(row.outstanding)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <AsanaLinkButton href={row.asana_link} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </table>
          </div>
        </div>

        {/* ─── RIGHT: Accounts Payable (AP) ─── */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gradient-to-r from-amber-50/80 to-white">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                Accounts Payable (COGS)
              </h2>
              <Badge
                variant="outline"
                className="text-bw-amber border-bw-amber/30 bg-amber-50/50 text-xs"
              >
                {filteredExpenses.length} 筆
              </Badge>
            </div>
          </div>

          <div className="px-5 py-3 border-b bg-gray-50/50 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Account Payable Contract Sum</span>
              <span className="font-semibold text-gray-900 font-mono-num">
                {formatMoney2(apTotals.totalContract)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{sourceLabel} Paid</span>
              <span className="font-semibold text-gray-900 font-mono-num">
                {formatMoney2(apTotals.totalPaid)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-red-600">
                Payable as at{" "}
                {new Date().toLocaleDateString("en-US", {
                  timeZone: "Asia/Hong_Kong",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="text-red-600 font-mono-num">
                {formatMoney2(apTotals.totalOutstanding)}
              </span>
            </div>
          </div>

          <div className="h-[calc(100vh-420px)] min-h-[400px] overflow-y-auto">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[60px] text-xs bg-white">Type</TableHead>
                  <TableHead className="text-xs bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSortAP("project")}
                      className="flex items-center gap-1 hover:text-bw-amber transition-colors"
                    >
                      Project Name <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs bg-white">Vendor</TableHead>
                  <TableHead className="text-xs bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSortAP("due_date")}
                      className="flex items-center gap-1 hover:text-bw-amber transition-colors"
                    >
                      Due Date <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSortAP("expected_payment_date")}
                      className="flex items-center gap-1 hover:text-bw-amber transition-colors"
                    >
                      Expected Payment Date <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs text-right bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSortAP("amount")}
                      className="flex items-center gap-1 justify-end hover:text-bw-amber transition-colors ml-auto"
                    >
                      Invoice Amount <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs text-right bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSortAP("outstanding")}
                      className="flex items-center gap-1 justify-end hover:text-bw-amber transition-colors ml-auto"
                    >
                      Outstanding <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[44px] text-center text-xs bg-white">Asana</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-sm text-gray-400">
                      無符合條件的應付記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((row) => {
                    const canOpen = Boolean(row.project_id);
                    return (
                      <TableRow
                        key={row.id}
                        className={`hover:bg-amber-50/30 group ${canOpen ? "cursor-pointer" : ""}`}
                        onClick={() => openFinanceDialog(row, "expense")}
                      >
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className="text-[12px] px-1.5 py-0 font-medium border-bw-blue/40 text-bw-blue bg-blue-50/50"
                          >
                            {row.type_display || "Main"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={!canOpen}
                              className="text-left text-xs font-medium text-gray-900 truncate max-w-[160px] hover:text-bw-amber hover:underline transition-colors disabled:hover:no-underline disabled:hover:text-gray-900"
                              onClick={(e) => {
                                e.stopPropagation();
                                openProjectDetail(row.bw_type, row.project_id);
                              }}
                            >
                              {row.project_name || row.project_code || "-"}
                            </button>
                            {canOpen && (
                              <ArrowRight className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-xs text-gray-600 truncate block max-w-[150px]">
                            {row.vendor_name || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <span
                            className={`text-xs whitespace-nowrap ${
                              isOverdue(row.due_date) ? "text-red-500 font-medium" : "text-gray-600"
                            }`}
                          >
                            {fmtDate(row.due_date)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-xs whitespace-nowrap text-gray-600">
                            {fmtDate(row.expected_payment_date)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <span className="text-xs font-mono-num text-gray-700">
                            {formatMoney2(row.installment_amount)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <span className="text-xs font-mono-num font-semibold text-red-600">
                            {formatMoney2(row.outstanding)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <AsanaLinkButton href={row.asana_link} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </table>
          </div>
        </div>
      </div>

      <ProjectFinanceHistoryDialog
        open={!!financeDialog}
        onOpenChange={(open) => {
          if (!open) setFinanceDialog(null);
        }}
        projectId={financeDialog?.projectId ?? null}
        entityType={financeDialog?.entityType ?? "bwa_project"}
        projectCode={financeDialog?.projectCode}
        projectName={financeDialog?.projectName}
        initialTab={financeDialog?.initialTab ?? "income"}
        onDataChanged={fetchData}
      />
    </div>
  );
}
