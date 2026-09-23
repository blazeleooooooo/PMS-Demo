"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  Hash,
  Loader2,
  Pencil,
  Percent,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AsanaLinkButton } from "@/components/ui/asana-link-button";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import {
  fetchApPaymentDatePageData,
  updateExpensePaymentDates,
  type ApPaymentDateExpenseRow,
  type ApPaymentDateProjectRow,
} from "@/lib/data/ap-payment-dates";
import {
  fetchBWAProjectDetail,
  resolveVisibleBwaProjectIds,
  type BWAProjectDetailData,
} from "@/lib/data/bwa-projects";
import {
  fetchBWFProjectDetail,
  resolveVisibleBwfProjectIds,
  type BWFProjectDetailData,
} from "@/lib/data/bwf-projects";
import { outstandingAmount } from "@/lib/expense-outstanding-split";
import ProjectFinancePanels, {
  type ProjectEntityType,
  type ProjectFinancePanelsHandle,
} from "@/components/projects/ProjectFinancePanels";
import { ProjectStatusDot } from "@/components/ui/entity-status-badges";
import {
  resolveRange,
  rangeBounds,
  fmtRangeDate,
} from "@/lib/report-date-range";
import { useReportRange } from "@/components/reports/ReportDateRangeContext";
import ReportFilterStack from "@/components/reports/ReportFilterStack";
import {
  applyProjectFilters,
  type ProjectFilterState,
} from "@/components/reports/ProjectFilterBar";
import {
  staffIdMatchesFilter,
  type StaffFilterState,
} from "@/components/reports/StaffFilterBar";
import { useAlignedReportFilters } from "@/hooks/use-aligned-report-filters";
import type { StaffDirectoryRow } from "@/lib/data-service";
import { isDueDateExpired, overdueDaysHk, remainingDaysHk, toHkYmd } from "@/lib/date-utils";
import { ExpectedPaymentDateHistoryCell } from "@/components/accounting/ExpectedPaymentDateHistoryCell";
import type { ExpectedPaymentDateLogEntry } from "@/lib/expected-payment-date-log";
import {
  AP_URGENCY_FILTER_OPTIONS,
  AP_URGENCY_LARGE_AMOUNT,
  AP_URGENCY_NORMAL,
  AP_URGENCY_URGENT,
  getApUrgencyBadges,
  rowMatchesApUrgencyFilter,
  type ApUrgencyBadge,
  type ApUrgencyFilter,
} from "@/lib/ap-payment-urgency";

const PAGE_SIZE = 50;
const MODULE_KEY = "ap-payment-dates";

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

type DateField = "due_date" | "expected_payment_date" | "payment_date";
type SortField = DateField | "created_date" | "project" | "expense" | "outstanding";
type SortDir = "asc" | "desc";
type DueExpiryFilter = "all" | "expired" | "not_expired";

const DUE_EXPIRY_OPTIONS: { value: DueExpiryFilter; label: string }[] = [
  { value: "all", label: "全部 All" },
  { value: "expired", label: "已逾期 Expired" },
  { value: "not_expired", label: "未逾期 Not expired" },
];

function expenseNetOutstanding(row: ApPaymentDateExpenseRow): number {
  if (row.outstanding != null) return Math.max(0, Number(row.outstanding) || 0);
  return Math.max(0, outstandingAmount(row.installment_amount, row.paid_amount));
}

function hasPayableOutstanding(row: ApPaymentDateExpenseRow): boolean {
  return expenseNetOutstanding(row) > 0;
}

function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtDateYmd(d: string | null): string {
  if (!d) return "未設定";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "未設定";
    return toDateOnly(dt).replace(/-/g, "/");
  } catch {
    return "未設定";
  }
}

function datePickerClass(
  field: DateField,
  hasValue: boolean,
  overdueHighlight = false,
  paid = false
): string {
  if (paid && field === "expected_payment_date") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
  }
  if (overdueHighlight) {
    return "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 font-medium";
  }
  if (!hasValue) return "border-gray-200 text-gray-400 hover:bg-gray-50";
  if (field === "due_date") return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
  if (field === "expected_payment_date") {
    return "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
}

function dateInRange(value: string | null, fromMs: number, toMs: number): boolean {
  if (fromMs === -Infinity && toMs === Infinity) return true;
  if (!value) return false;
  const t = new Date(value).getTime();
  return !isNaN(t) && t >= fromMs && t <= toMs;
}

function rowMatchesDueExpiry(row: ApPaymentDateExpenseRow, filter: DueExpiryFilter): boolean {
  if (filter === "all") return true;
  const expired = isDueDateExpired(row.due_date);
  return filter === "expired" ? expired : !expired;
}

function rowDateForTarget(target: DateTarget, row: ApPaymentDateExpenseRow): string | null {
  switch (target) {
    case "due_date":
      return row.due_date;
    case "expected_payment_date":
      return row.expected_payment_date;
    case "created_date":
      return row.created_date;
    case "enquiry_date":
      return row.enquiry_date;
    case "signed_date":
      return row.signed_date;
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

function StatCard({
  icon: Icon,
  label,
  value,
  subLabel,
  color,
  borderColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subLabel?: string;
  color: string;
  borderColor: string;
}) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 ${borderColor} transition-all hover:shadow-md`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900 font-mono-num">{value}</p>
          {subLabel && <p className="text-[13px] text-gray-400 mt-0.5">{subLabel}</p>}
        </div>
      </div>
    </div>
  );
}

function projectDetailUrl(bwType: "BWA" | "BWF", projectId: string | null): string | null {
  if (!projectId) return null;
  return bwType === "BWF" ? `/bwf/projects/${projectId}` : `/projects/bwa/${projectId}`;
}

type ExpenseEditTarget = {
  projectId: string;
  entityType: ProjectEntityType;
  expenseId: string;
};

function toFinancePanelData(
  entityType: ProjectEntityType,
  detail: BWAProjectDetailData | BWFProjectDetailData
) {
  if (entityType === "bwf_project") {
    const d = detail as BWFProjectDetailData;
    return {
      estimated_income: d.estimated_income,
      estimated_expense: d.estimated_expense,
      income_below_estimated_reason: d.income_below_estimated_reason ?? null,
      main_contractor_id: d.main_contractor_id,
      main_contractor_name: d.main_contractor_name,
      incomes: d.incomes || [],
      expenses: d.expenses || [],
    };
  }
  const d = detail as BWAProjectDetailData;
  return {
    estimated_income: d.estimated_income,
    estimated_expense: d.estimated_expense,
    income_below_estimated_reason: d.income_below_estimated_reason ?? null,
    main_contractor_id: d.main_contractor_id ?? null,
    main_contractor_name: d.main_contractor_name ?? null,
    incomes: d.incomes || [],
    expenses: d.expenses || [],
  };
}

function ApPaymentExpenseEditHost({
  target,
  onClose,
  onSaved,
  onOpened,
}: {
  target: ExpenseEditTarget | null;
  onClose: () => void;
  onSaved: () => void;
  onOpened?: () => void;
}) {
  const panelsRef = useRef<ProjectFinancePanelsHandle>(null);
  const openedForId = useRef<string | null>(null);
  const [financeData, setFinanceData] = useState<ReturnType<typeof toFinancePanelData> | null>(null);

  useEffect(() => {
    if (!target) {
      setFinanceData(null);
      openedForId.current = null;
      return;
    }
    let cancelled = false;
    const load =
      target.entityType === "bwf_project"
        ? fetchBWFProjectDetail(target.projectId)
        : fetchBWAProjectDetail(target.projectId);
    void load.then((detail) => {
      if (cancelled) return;
      if (!detail) {
        onClose();
        return;
      }
      setFinanceData(toFinancePanelData(target.entityType, detail));
    });
    return () => {
      cancelled = true;
    };
  }, [target, onClose]);

  useEffect(() => {
    if (!target || !financeData) return;
    if (openedForId.current === target.expenseId) return;
    const expense = financeData.expenses.find((row) => row.id === target.expenseId);
    if (!expense) {
      onClose();
      return;
    }
    openedForId.current = target.expenseId;
    const tryOpen = () => {
      if (!panelsRef.current) return false;
      panelsRef.current.openEditExpense(expense);
      onOpened?.();
      return true;
    };
    if (tryOpen()) return;
    const timer = window.setTimeout(() => {
      if (!tryOpen()) onClose();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [target, financeData, onClose, onOpened]);

  if (!target || !financeData) return null;

  return (
    <div className="hidden" aria-hidden>
      <ProjectFinancePanels
        ref={panelsRef}
        projectId={target.projectId}
        entityType={target.entityType}
        data={financeData}
        view="expense"
        onReload={onSaved}
        onExpenseDialogOpenChange={(open) => {
          if (!open) onClose();
        }}
      />
    </div>
  );
}

const URGENCY_BADGE_STYLES: Record<ApUrgencyBadge, string> = {
  [AP_URGENCY_URGENT]: "border-red-200 bg-red-50 text-red-700",
  [AP_URGENCY_NORMAL]: "border-amber-200 bg-amber-50 text-amber-700",
  [AP_URGENCY_LARGE_AMOUNT]: "border-violet-200 bg-violet-50 text-violet-700",
};

function urgencyBadgesCell(badges: ApUrgencyBadge[]) {
  if (badges.length === 0) return <span className="text-gray-400">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => {
        const opt = AP_URGENCY_FILTER_OPTIONS.find((o) => o.value === badge);
        return (
          <Badge
            key={badge}
            variant="outline"
            className={`text-[11px] px-1.5 py-0 font-normal rounded-full ${URGENCY_BADGE_STYLES[badge]}`}
          >
            {opt?.shortLabel ?? badge}
          </Badge>
        );
      })}
    </div>
  );
}

function paymentStatusBadge(status: string | null) {
  const value = (status || "").trim();
  if (!value) return <span className="text-gray-400">-</span>;
  const styles: Record<string, string> = {
    "Pending Check": "border-amber-200 bg-amber-50 text-amber-700",
    Approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    "Zoho Completed": "border-emerald-900 bg-emerald-800 text-emerald-50",
    Rejected: "border-red-200 bg-red-50 text-red-700",
  };
  const labels: Record<string, string> = {
    "Pending Check": "待審核",
    Approved: "已批核",
    "Zoho Completed": "Zoho Completed",
    Rejected: "已拒絕",
  };
  const className = styles[value] || "border-gray-200 bg-gray-50 text-gray-600";
  return (
    <Badge variant="outline" className={`text-[11px] px-1.5 py-0 font-normal ${className}`}>
      {labels[value] || value}
    </Badge>
  );
}

function ExpenseDatePicker({
  value,
  field,
  dueDate,
  paid,
  disabled,
  onChange,
}: {
  value: string | null;
  field: DateField;
  dueDate?: string | null;
  paid?: boolean;
  disabled: boolean;
  onChange: (next: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentDate = value ? new Date(value) : undefined;
  const emptyExpected = !paid && field === "expected_payment_date" && !toHkYmd(value);
  const expectedExpired =
    !paid && field === "expected_payment_date" && isDueDateExpired(value);
  const overdueDays = emptyExpected ? overdueDaysHk(dueDate) : null;
  const remainingDays = emptyExpected ? remainingDaysHk(dueDate) : null;
  const overdueUnfilled = overdueDays != null && overdueDays > 0;
  const overdueHighlight = overdueUnfilled || expectedExpired;
  const upcomingUnfilled = remainingDays != null && remainingDays > 0;
  const displayText = overdueUnfilled
    ? `已逾期${overdueDays}天`
    : upcomingUnfilled
      ? `尚餘${remainingDays}天`
      : fmtDateYmd(value);
  const overdueTitle = overdueUnfilled
    ? "到期日已過，請填寫預計付款日期"
    : expectedExpired
      ? "預計付款日期已過期"
      : undefined;

  const persist = async (date: Date | undefined) => {
    setSaving(true);
    try {
      await onChange(date ? toDateOnly(date) : null);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  if (disabled) {
    return (
      <span
        className={`text-[12px] ${
          paid && field === "expected_payment_date"
            ? value
              ? "text-emerald-700"
              : "text-emerald-600"
            : overdueHighlight
              ? "text-red-600 font-medium"
              : value
                ? "text-gray-700"
                : "text-gray-400"
        }`}
        title={overdueTitle}
      >
        {displayText}
      </span>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={overdueTitle}
            className={`flex items-center gap-1 h-7 px-1.5 text-[12px] rounded border whitespace-nowrap transition-colors ${datePickerClass(field, !!currentDate, overdueHighlight, paid)} ${saving ? "opacity-50" : ""}`}
            disabled={saving}
          >
            <CalendarIcon className="w-3 h-3 shrink-0" />
            {displayText}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-2">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={(date) => persist(date)}
              initialFocus
            />
            {currentDate && (
              <div className="flex justify-end px-2 pb-2">
                <button
                  type="button"
                  className="text-[12px] text-red-500 hover:text-red-700 underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    void persist(undefined);
                  }}
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

export default function ApPaymentDatesManagement() {
  const { staff } = useAuth();
  const { canEdit } = usePermission();
  const { formatMoney } = useFinancialFormat();
  const allowEdit = canEdit(MODULE_KEY);
  const canEditProjectExpense = canEdit("projects.expense");
  const { range: selectedPreset, custom, sources } = useReportRange();
  const {
    projectFilter,
    setProjectFilter,
    staffFilter,
    setStaffFilter,
    staffLocks,
    isSuperAdmin,
  } = useAlignedReportFilters("business");

  const [rows, setRows] = useState<ApPaymentDateExpenseRow[]>([]);
  const [projects, setProjects] = useState<ApPaymentDateProjectRow[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateTarget, setDateTarget] = useState<DateTarget>("due_date");
  const [dueExpiryFilter, setDueExpiryFilter] = useState<DueExpiryFilter>("expired");
  const [urgencyFilter, setUrgencyFilter] = useState<ApUrgencyFilter>(null);
  const [showZeroOutstanding, setShowZeroOutstanding] = useState(false);
  const [sortField, setSortField] = useState<SortField>("created_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [expenseEditTarget, setExpenseEditTarget] = useState<ExpenseEditTarget | null>(null);
  const [expenseEditLoadingId, setExpenseEditLoadingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!staff?.id) {
      setRows([]);
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const staffContext = {
      staffId: staff.id,
      role: staff.role || null,
      teamTypeId: staff.n_team_type_id || null,
    };
    const [bwaIds, bwfIds] = await Promise.all([
      resolveVisibleBwaProjectIds(staffContext),
      resolveVisibleBwfProjectIds(staffContext),
    ]);
    const data = await fetchApPaymentDatePageData({ bwaIds, bwfIds });
    setRows(data.expenses);
    setProjects(data.projects);
    setLoading(false);
  }, [staff]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sourceType: "BWA" | "BWF" = sources.bwf && !sources.bwa ? "BWF" : "BWA";
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

  const allowedProjectIds = useMemo(() => {
    const filteredProjects = applyProjectFilters(sourceProjects, projectFilter).filter((p) =>
      staffIdMatchesFilter(p.pm_id, staffFilter, staffDirectory)
    );
    return new Set(filteredProjects.map((p) => p.id));
  }, [sourceProjects, projectFilter, staffFilter, staffDirectory]);

  const filtersIdle =
    isProjectFilterIdle(projectFilter) && isStaffFilterIdle(staffFilter);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "due_date" ? "asc" : "desc");
    }
    setPage(1);
  };

  const matchedRows = useMemo(() => {
    const { fromMs, toMs } = rangeBounds(window);
    return rows.filter((row) => {
      if (row.bw_type !== sourceType) return false;
      if (!dateInRange(rowDateForTarget(dateTarget, row), fromMs, toMs)) return false;
      if (!rowMatchesDueExpiry(row, dueExpiryFilter)) return false;
      if (!rowMatchesApUrgencyFilter(row, urgencyFilter)) return false;
      if (!row.project_id) return false;
      if (allowedProjectIds.has(row.project_id)) return true;
      return filtersIdle;
    });
  }, [rows, sourceType, window, dateTarget, dueExpiryFilter, urgencyFilter, allowedProjectIds, filtersIdle]);

  const hiddenZeroCount = useMemo(
    () =>
      showZeroOutstanding
        ? 0
        : matchedRows.filter((row) => !hasPayableOutstanding(row)).length,
    [matchedRows, showZeroOutstanding]
  );

  const filtered = useMemo(() => {
    const list = showZeroOutstanding
      ? matchedRows
      : matchedRows.filter((row) => hasPayableOutstanding(row));

    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const time = (d: string | null) => {
        if (!d) return Number.POSITIVE_INFINITY * dir;
        const t = new Date(d).getTime();
        return isNaN(t) ? Number.POSITIVE_INFINITY * dir : t;
      };
      if (
        sortField === "created_date" ||
        sortField === "due_date" ||
        sortField === "expected_payment_date" ||
        sortField === "payment_date"
      ) {
        return (time(a[sortField]) - time(b[sortField])) * dir;
      }
      if (sortField === "expense") {
        return ((a.installment_amount || 0) - (b.installment_amount || 0)) * dir;
      }
      if (sortField === "outstanding") {
        return (expenseNetOutstanding(a) - expenseNetOutstanding(b)) * dir;
      }
      const an = `${a.project_code || ""} ${a.project_name || ""}`.trim();
      const bn = `${b.project_code || ""} ${b.project_name || ""}`.trim();
      return an.localeCompare(bn, "zh-Hant") * dir;
    });
  }, [matchedRows, showZeroOutstanding, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [sourceType, selectedPreset, custom, dateTarget, dueExpiryFilter, urgencyFilter, showZeroOutstanding, projectFilter, staffFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const sourceRowCount = useMemo(
    () => rows.filter((row) => row.bw_type === sourceType).length,
    [rows, sourceType]
  );
  const kpiStats = useMemo(() => {
    const count = filtered.length;
    const expenseSum = filtered.reduce((sum, row) => sum + (row.installment_amount || 0), 0);
    const paidSum = filtered.reduce((sum, row) => sum + (row.paid_amount || 0), 0);
    const outstandingSum = filtered.reduce((sum, row) => sum + expenseNetOutstanding(row), 0);
    const paidPct = expenseSum > 0 ? (paidSum / expenseSum) * 100 : 0;
    return { count, expenseSum, paidSum, outstandingSum, paidPct };
  }, [filtered]);

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const person of staffDirectory) {
      if (person.id && person.name) map.set(person.id, person.name);
    }
    return map;
  }, [staffDirectory]);

  const patchRow = (
    id: string,
    field: DateField,
    next: string | null,
    log?: ExpectedPaymentDateLogEntry[]
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: next,
              ...(log ? { expected_payment_date_log: log } : {}),
            }
          : row
      )
    );
  };

  const openExpenseEdit = (row: ApPaymentDateExpenseRow) => {
    if (!row.project_id || !canEditProjectExpense) return;
    setExpenseEditLoadingId(row.id);
    setExpenseEditTarget({
      projectId: row.project_id,
      entityType: row.bw_type === "BWF" ? "bwf_project" : "bwa_project",
      expenseId: row.id,
    });
  };

  const closeExpenseEdit = useCallback(() => {
    setExpenseEditTarget(null);
    setExpenseEditLoadingId(null);
  }, []);

  const handleExpenseEditOpened = useCallback(() => {
    setExpenseEditLoadingId(null);
  }, []);

  const handleDateChange = async (row: ApPaymentDateExpenseRow, field: DateField, next: string | null) => {
    const result = await updateExpensePaymentDates(row.id, { [field]: next }, staff?.id);
    if (!result.success) {
      console.error("Failed to update expense date:", result.error);
      return;
    }
    patchRow(row.id, field, next, result.expected_payment_date_log);
  };

  const sortMark = (field: SortField) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
        <span className="ml-3 text-gray-500">載入 AP 付款日期...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AP大額支出申請</h1>
        <p className="text-sm text-gray-500 mt-1">
          管理支出的到期日、預計付款日期與實際付款日期。篩選與應付未付及應收未收相同。
        </p>
        <p className="text-sm text-gray-400 mt-0.5">{dateRangeLabel}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          icon={Hash}
          label="支出筆數"
          value={kpiStats.count.toLocaleString()}
          subLabel={`篩選中 ${kpiStats.count.toLocaleString()} / 全部 ${sourceRowCount.toLocaleString()}`}
          color="bg-blue-500"
          borderColor="border-l-blue-500"
        />
        <StatCard
          icon={Wallet}
          label="支出金額"
          value={formatMoney(kpiStats.expenseSum)}
          color="bg-indigo-500"
          borderColor="border-l-indigo-500"
        />
        <StatCard
          icon={CheckCircle2}
          label="已付金額"
          value={formatMoney(kpiStats.paidSum)}
          color="bg-teal-500"
          borderColor="border-l-teal-500"
        />
        <StatCard
          icon={CircleDollarSign}
          label="待付金額"
          value={formatMoney(kpiStats.outstandingSum)}
          color="bg-amber-500"
          borderColor="border-l-amber-500"
        />
        <StatCard
          icon={Percent}
          label="付款比率"
          value={`${kpiStats.paidPct.toFixed(1)}%`}
          color="bg-violet-500"
          borderColor="border-l-violet-500"
        />
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
          <div className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] text-gray-400 font-medium">到期日</span>
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                  {DUE_EXPIRY_OPTIONS.map((opt, idx) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDueExpiryFilter(opt.value)}
                      className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
                        idx > 0 ? "border-l border-gray-200" : ""
                      } ${
                        dueExpiryFilter === opt.value
                          ? "bg-bw-blue text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] text-gray-400 font-medium">待付 $0</span>
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setShowZeroOutstanding(false)}
                    className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      !showZeroOutstanding
                        ? "bg-bw-blue text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    隱藏 Hide
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowZeroOutstanding(true)}
                    className={`px-3 py-1.5 text-[13px] font-medium border-l border-gray-200 transition-colors ${
                      showZeroOutstanding
                        ? "bg-bw-blue text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    顯示 Show
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] text-gray-400 font-medium">緊急程度</span>
              <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white flex-wrap">
                {AP_URGENCY_FILTER_OPTIONS.map((opt, idx) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setUrgencyFilter((prev) => (prev === opt.value ? null : opt.value))
                    }
                    className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      idx > 0 ? "border-l border-gray-200" : ""
                    } ${
                      urgencyFilter === opt.value
                        ? "bg-bw-blue text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        }
      />

      <div className="flex justify-end">
        <span className="text-xs text-gray-400">
          {sourceType} · 共 {filtered.length.toLocaleString()} 筆支出
          {!showZeroOutstanding && hiddenZeroCount > 0
            ? ` · 已隱藏 ${hiddenZeroCount.toLocaleString()} 筆待付 $0`
            : ""}
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-[12px] whitespace-nowrap min-w-[100px]">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleSort("created_date")}>
                    建立日期{sortMark("created_date")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] whitespace-nowrap min-w-[132px]">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleSort("due_date")}>
                    到期日{sortMark("due_date")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] whitespace-nowrap min-w-[148px]">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleSort("expected_payment_date")}>
                    預計付款日期{sortMark("expected_payment_date")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] whitespace-nowrap min-w-[132px]">
                  前次日期
                </TableHead>
                <TableHead className="text-[12px] whitespace-nowrap min-w-[120px]">
                  緊急程度
                </TableHead>
                <TableHead className="text-[12px] whitespace-nowrap min-w-[132px]">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleSort("payment_date")}>
                    實際付款日期{sortMark("payment_date")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] min-w-[220px]">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleSort("project")}>
                    項目{sortMark("project")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] whitespace-nowrap">PM</TableHead>
                <TableHead className="text-[12px] min-w-[140px]">供應商</TableHead>
                <TableHead className="text-[12px] min-w-[140px]">款項期數</TableHead>
                <TableHead className="text-[12px] text-right whitespace-nowrap">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleSort("expense")}>
                    支出金額{sortMark("expense")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] text-right whitespace-nowrap">已付金額</TableHead>
                <TableHead className="text-[12px] text-right whitespace-nowrap">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleSort("outstanding")}>
                    待付金額{sortMark("outstanding")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] whitespace-nowrap">付款狀態</TableHead>
                <TableHead className="text-[12px] whitespace-nowrap">付款方式</TableHead>
                <TableHead className="text-[12px] min-w-[160px]">備註</TableHead>
                <TableHead className="text-[12px] w-10 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={17} className="text-center text-sm text-gray-400 py-16">
                    沒有符合的支出記錄
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => {
                  const net = expenseNetOutstanding(row);
                  const paid = net <= 0;
                  const payee = row.factory_name || row.supplier_name;
                  return (
                    <TableRow key={row.id} className="hover:bg-gray-50/60">
                      <TableCell className="text-[13px] text-gray-700 whitespace-nowrap">
                        {row.created_date ? fmtDateYmd(row.created_date) : "-"}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 whitespace-nowrap">
                        {row.due_date ? fmtDateYmd(row.due_date) : "-"}
                      </TableCell>
                      <TableCell>
                        <ExpenseDatePicker
                          value={row.expected_payment_date}
                          field="expected_payment_date"
                          dueDate={row.due_date}
                          paid={paid}
                          disabled={!allowEdit}
                          onChange={(next) => handleDateChange(row, "expected_payment_date", next)}
                        />
                      </TableCell>
                      <TableCell>
                        <ExpectedPaymentDateHistoryCell
                          log={row.expected_payment_date_log}
                          staffNameById={staffNameById}
                        />
                      </TableCell>
                      <TableCell>
                        {urgencyBadgesCell(getApUrgencyBadges(row))}
                      </TableCell>
                      <TableCell>
                        <ExpenseDatePicker
                          value={row.payment_date}
                          field="payment_date"
                          disabled={!allowEdit}
                          onChange={(next) => handleDateChange(row, "payment_date", next)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1.5 min-w-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <ProjectStatusDot status={row.project_status} />
                              {row.project_id ? (
                                <Link
                                  href={projectDetailUrl(row.bw_type, row.project_id) || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[13px] font-medium text-gray-900 hover:text-bw-blue line-clamp-1"
                                >
                                  {row.project_name || row.project_code || "-"}
                                </Link>
                              ) : (
                                <span className="text-[13px] text-gray-700 line-clamp-1">
                                  {row.project_name || row.project_code || "-"}
                                </span>
                              )}
                            </div>
                            {row.project_code && row.project_name && (
                              <div className="text-[11px] text-gray-400 ml-3.5 truncate">
                                {row.project_code}
                              </div>
                            )}
                          </div>
                          <AsanaLinkButton href={row.asana_link} />
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 whitespace-nowrap">
                        {row.pm_name || "-"}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700">
                        <span className="line-clamp-1">{payee || "-"}</span>
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700">
                        <span className="line-clamp-1">
                          {row.contract_type_label || row.type_display || "未分類"}
                          {` #${row.invoice_number || row.rank_report || "-"}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-[13px] text-right font-mono text-gray-800">
                        {formatMoney(row.installment_amount)}
                      </TableCell>
                      <TableCell className="text-[13px] text-right font-mono text-emerald-600">
                        {formatMoney(row.paid_amount)}
                      </TableCell>
                      <TableCell
                        className={`text-[13px] text-right font-mono ${
                          net > 0 ? "text-red-600 font-semibold" : "text-gray-400"
                        }`}
                      >
                        {formatMoney(net)}
                      </TableCell>
                      <TableCell>{paymentStatusBadge(row.payment_status)}</TableCell>
                      <TableCell className="text-[13px] text-gray-700 whitespace-nowrap">
                        {row.payment_method_label || "-"}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-600">
                        <span className="line-clamp-2">{row.remark || "-"}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {canEditProjectExpense && row.project_id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={expenseEditLoadingId === row.id}
                            onClick={() => openExpenseEdit(row)}
                            title="編輯支出"
                          >
                            {expenseEditLoadingId === row.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Pencil className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>
              第 {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filtered.length)} 筆，共 {filtered.length} 筆
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === 1} onClick={() => setPage(1)}>
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage === totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ApPaymentExpenseEditHost
        target={expenseEditTarget}
        onClose={closeExpenseEdit}
        onOpened={handleExpenseEditOpened}
        onSaved={() => {
          void loadData();
        }}
      />
    </div>
  );
}
