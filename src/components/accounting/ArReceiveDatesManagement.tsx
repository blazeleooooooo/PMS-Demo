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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  fetchArReceiveDatePageData,
  updateIncomeCollectionDates,
  updateIncomeExpiryReason,
  type ArReceiveDateIncomeRow,
  type ArReceiveDateProjectRow,
} from "@/lib/data/ar-receive-dates";
import {
  fetchIncomeExpiryReasonOptions,
  type IncomeExpiryReasonOption,
} from "@/lib/data/lookups";
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
import { isIncomeSettled } from "@/lib/income-payment-status";
import ProjectFinancePanels, {
  type ProjectEntityType,
  type ProjectFinancePanelsHandle,
} from "@/components/projects/ProjectFinancePanels";
import { hasReceivableOutstanding, incomeNetOutstanding } from "@/lib/income-outstanding";
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

const PAGE_SIZE = 50;
const MODULE_KEY = "ar-receive-dates";

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

type DateField = "due_date" | "expected_payment_date" | "receive_date";
type SortField = DateField | "created_date" | "project" | "income" | "outstanding" | "expiry_reason";
type SortDir = "asc" | "desc";
type DueExpiryFilter = "all" | "expired" | "not_expired";

const DUE_EXPIRY_OPTIONS: { value: DueExpiryFilter; label: string }[] = [
  { value: "all", label: "全部 All" },
  { value: "expired", label: "已逾期 Expired" },
  { value: "not_expired", label: "未逾期 Not expired" },
];

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
  received = false
): string {
  if (received && field === "expected_payment_date") {
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

function rowMatchesDueExpiry(row: ArReceiveDateIncomeRow, filter: DueExpiryFilter): boolean {
  if (filter === "all") return true;
  const expired = isDueDateExpired(row.due_date);
  return filter === "expired" ? expired : !expired;
}

function rowDateForTarget(target: DateTarget, row: ArReceiveDateIncomeRow): string | null {
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

type IncomeEditTarget = {
  projectId: string;
  entityType: ProjectEntityType;
  incomeId: string;
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

function ArReceiveIncomeEditHost({
  target,
  onClose,
  onSaved,
  onOpened,
}: {
  target: IncomeEditTarget | null;
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
    if (openedForId.current === target.incomeId) return;
    const income = financeData.incomes.find((row) => row.id === target.incomeId);
    if (!income) {
      onClose();
      return;
    }
    openedForId.current = target.incomeId;
    const tryOpen = () => {
      if (!panelsRef.current) return false;
      panelsRef.current.openEditIncome(income);
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
        view="income"
        onReload={onSaved}
        onIncomeDialogOpenChange={(open) => {
          if (!open) onClose();
        }}
      />
    </div>
  );
}

function paymentStatusBadge(status: string | null) {
  const value = (status || "").trim();
  if (!value) return <span className="text-gray-400">-</span>;
  const lower = value.toLowerCase();
  let className = "border-gray-200 bg-gray-50 text-gray-600";
  if (lower === "zoho completed") className = "border-emerald-900 bg-emerald-800 text-emerald-50";
  else if (lower === "received") className = "border-emerald-200 bg-emerald-50 text-emerald-700";
  else if (lower === "pending check") className = "border-amber-200 bg-amber-50 text-amber-700";
  else if (lower === "not received") className = "border-red-200 bg-red-50 text-red-700";
  else if (lower === "bounced payment") className = "border-rose-200 bg-rose-50 text-rose-700";
  return (
    <Badge variant="outline" className={`text-[11px] px-1.5 py-0 font-normal ${className}`}>
      {value}
    </Badge>
  );
}

function IncomeExpiryReasonSelect({
  value,
  label,
  reasons,
  disabled,
  expired,
  onChange,
}: {
  value: string | null;
  label: string | null;
  reasons: IncomeExpiryReasonOption[];
  disabled: boolean;
  expired: boolean;
  onChange: (next: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const options = useMemo(() => {
    if (value && !reasons.some((reason) => reason.id === value)) {
      return [...reasons, { id: value, label: label || "未命名", is_active: false }];
    }
    return reasons;
  }, [reasons, value, label]);

  if (disabled) {
    return (
      <span className={`text-[12px] ${value ? "text-gray-700" : expired ? "text-red-600" : "text-gray-400"}`}>
        {label || (expired ? "未設定" : "-")}
      </span>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={value || undefined}
        onValueChange={(next) => {
          if (!next || next === value) return;
          void (async () => {
            setSaving(true);
            try {
              await onChange(next);
            } finally {
              setSaving(false);
            }
          })();
        }}
        disabled={saving}
      >
        <SelectTrigger
          className={`h-7 min-w-[168px] max-w-[240px] text-[12px] ${
            !value && expired
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-gray-200"
          } ${saving ? "opacity-50" : ""}`}
        >
          <SelectValue placeholder="選擇逾期原因" />
        </SelectTrigger>
        <SelectContent>
          {options.map((reason) => (
            <SelectItem key={reason.id} value={reason.id}>
              {reason.label}
              {!reason.is_active ? "（已停用）" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function IncomeDatePicker({
  value,
  field,
  dueDate,
  paymentStatus,
  disabled,
  onChange,
}: {
  value: string | null;
  field: DateField;
  dueDate?: string | null;
  paymentStatus?: string | null;
  disabled: boolean;
  onChange: (next: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentDate = value ? new Date(value) : undefined;
  const received = field === "expected_payment_date" && isIncomeSettled(paymentStatus);
  const emptyExpected =
    !received && field === "expected_payment_date" && !toHkYmd(value);
  const expectedExpired =
    !received && field === "expected_payment_date" && isDueDateExpired(value);
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
    ? "到期日已過，請填寫預計收款日期"
    : expectedExpired
      ? "預計收款日期已過期"
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
          received
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
            className={`flex items-center gap-1 h-7 px-1.5 text-[12px] rounded border whitespace-nowrap transition-colors ${datePickerClass(field, !!currentDate, overdueHighlight, received)} ${saving ? "opacity-50" : ""}`}
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

export default function ArReceiveDatesManagement() {
  const { staff } = useAuth();
  const { canEdit } = usePermission();
  const { formatMoney } = useFinancialFormat();
  const allowEdit = canEdit(MODULE_KEY);
  const canEditProjectIncome = canEdit("projects.income");
  const { range: selectedPreset, custom, sources } = useReportRange();
  const {
    projectFilter,
    setProjectFilter,
    staffFilter,
    setStaffFilter,
    staffLocks,
    isSuperAdmin,
  } = useAlignedReportFilters("business");

  const [rows, setRows] = useState<ArReceiveDateIncomeRow[]>([]);
  const [projects, setProjects] = useState<ArReceiveDateProjectRow[]>([]);
  const [expiryReasons, setExpiryReasons] = useState<IncomeExpiryReasonOption[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateTarget, setDateTarget] = useState<DateTarget>("due_date");
  const [dueExpiryFilter, setDueExpiryFilter] = useState<DueExpiryFilter>("expired");
  const [showZeroOutstanding, setShowZeroOutstanding] = useState(false);
  const [sortField, setSortField] = useState<SortField>("created_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [incomeEditTarget, setIncomeEditTarget] = useState<IncomeEditTarget | null>(null);
  const [incomeEditLoadingId, setIncomeEditLoadingId] = useState<string | null>(null);

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
    const [bwaIds, bwfIds, reasons] = await Promise.all([
      resolveVisibleBwaProjectIds(staffContext),
      resolveVisibleBwfProjectIds(staffContext),
      fetchIncomeExpiryReasonOptions(),
    ]);
    const data = await fetchArReceiveDatePageData({ bwaIds, bwfIds });
    setRows(data.incomes);
    setProjects(data.projects);
    setExpiryReasons(reasons);
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
      if (!row.project_id) return false;
      if (allowedProjectIds.has(row.project_id)) return true;
      return filtersIdle;
    });
  }, [rows, sourceType, window, dateTarget, dueExpiryFilter, allowedProjectIds, filtersIdle]);

  const hiddenZeroCount = useMemo(
    () =>
      showZeroOutstanding
        ? 0
        : matchedRows.filter((row) => !hasReceivableOutstanding(row)).length,
    [matchedRows, showZeroOutstanding]
  );

  const filtered = useMemo(() => {
    const list = showZeroOutstanding
      ? matchedRows
      : matchedRows.filter((row) => hasReceivableOutstanding(row));

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
        sortField === "receive_date"
      ) {
        return (time(a[sortField]) - time(b[sortField])) * dir;
      }
      if (sortField === "income") {
        return ((a.income_amount || 0) - (b.income_amount || 0)) * dir;
      }
      if (sortField === "outstanding") {
        return (incomeNetOutstanding(a) - incomeNetOutstanding(b)) * dir;
      }
      if (sortField === "expiry_reason") {
        return (a.expiry_reason_label || "").localeCompare(b.expiry_reason_label || "", "zh-Hant") * dir;
      }
      const an = `${a.project_code || ""} ${a.project_name || ""}`.trim();
      const bn = `${b.project_code || ""} ${b.project_name || ""}`.trim();
      return an.localeCompare(bn, "zh-Hant") * dir;
    });
  }, [matchedRows, showZeroOutstanding, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [sourceType, selectedPreset, custom, dateTarget, dueExpiryFilter, showZeroOutstanding, projectFilter, staffFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const sourceRowCount = useMemo(
    () => rows.filter((row) => row.bw_type === sourceType).length,
    [rows, sourceType]
  );
  const kpiStats = useMemo(() => {
    const count = filtered.length;
    const incomeSum = filtered.reduce((sum, row) => sum + (row.income_amount || 0), 0);
    const receivedSum = filtered.reduce((sum, row) => sum + (row.payment_amount || 0), 0);
    const outstandingSum = filtered.reduce((sum, row) => sum + incomeNetOutstanding(row), 0);
    const receivedPct = incomeSum > 0 ? (receivedSum / incomeSum) * 100 : 0;
    return { count, incomeSum, receivedSum, outstandingSum, receivedPct };
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

  const openIncomeEdit = (row: ArReceiveDateIncomeRow) => {
    if (!row.project_id || !canEditProjectIncome) return;
    setIncomeEditLoadingId(row.id);
    setIncomeEditTarget({
      projectId: row.project_id,
      entityType: row.bw_type === "BWF" ? "bwf_project" : "bwa_project",
      incomeId: row.id,
    });
  };

  const closeIncomeEdit = useCallback(() => {
    setIncomeEditTarget(null);
    setIncomeEditLoadingId(null);
  }, []);

  const handleIncomeEditOpened = useCallback(() => {
    setIncomeEditLoadingId(null);
  }, []);

  const handleDateChange = async (row: ArReceiveDateIncomeRow, field: DateField, next: string | null) => {
    const result = await updateIncomeCollectionDates(row.id, { [field]: next }, staff?.id);
    if (!result.success) {
      console.error("Failed to update income date:", result.error);
      return;
    }
    patchRow(row.id, field, next, result.expected_payment_date_log);
  };

  const handleExpiryReasonChange = async (row: ArReceiveDateIncomeRow, nextId: string) => {
    const result = await updateIncomeExpiryReason(row.id, nextId);
    if (!result.success) {
      console.error("Failed to update income expiry reason:", result.error);
      return;
    }
    const reason = expiryReasons.find((item) => item.id === nextId);
    setRows((prev) =>
      prev.map((item) =>
        item.id === row.id
          ? {
              ...item,
              expiry_reason_id: nextId,
              expiry_reason_label: reason?.label ?? item.expiry_reason_label,
            }
          : item
      )
    );
  };

  const sortMark = (field: SortField) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-bw-blue" />
        <span className="ml-3 text-gray-500">載入 AR 收款日期...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AR收款申報</h1>
        <p className="text-sm text-gray-500 mt-1">
          管理收入的到期日、預計收款日期與實際收款日期。篩選與應付未付及應收未收相同。
        </p>
        <p className="text-sm text-gray-400 mt-0.5">{dateRangeLabel}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          icon={Hash}
          label="收入筆數"
          value={kpiStats.count.toLocaleString()}
          subLabel={`篩選中 ${kpiStats.count.toLocaleString()} / 全部 ${sourceRowCount.toLocaleString()}`}
          color="bg-blue-500"
          borderColor="border-l-blue-500"
        />
        <StatCard
          icon={Wallet}
          label="收入金額"
          value={formatMoney(kpiStats.incomeSum)}
          color="bg-indigo-500"
          borderColor="border-l-indigo-500"
        />
        <StatCard
          icon={CheckCircle2}
          label="已收金額"
          value={formatMoney(kpiStats.receivedSum)}
          color="bg-teal-500"
          borderColor="border-l-teal-500"
        />
        <StatCard
          icon={CircleDollarSign}
          label="待收金額"
          value={formatMoney(kpiStats.outstandingSum)}
          color="bg-amber-500"
          borderColor="border-l-amber-500"
        />
        <StatCard
          icon={Percent}
          label="收款比率"
          value={`${kpiStats.receivedPct.toFixed(1)}%`}
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
              <span className="text-[12px] text-gray-400 font-medium">待收 $0</span>
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
        }
      />

      <div className="flex justify-end">
        <span className="text-xs text-gray-400">
          {sourceType} · 共 {filtered.length.toLocaleString()} 筆收入
          {!showZeroOutstanding && hiddenZeroCount > 0
            ? ` · 已隱藏 ${hiddenZeroCount.toLocaleString()} 筆待收 $0`
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
                    預計收款日期{sortMark("expected_payment_date")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] whitespace-nowrap min-w-[132px]">
                  前次日期
                </TableHead>
                <TableHead className="text-[12px] whitespace-nowrap min-w-[176px]">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleSort("expiry_reason")}>
                    逾期原因{sortMark("expiry_reason")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] whitespace-nowrap min-w-[132px]">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleSort("receive_date")}>
                    實際收款日期{sortMark("receive_date")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] min-w-[220px]">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleSort("project")}>
                    項目{sortMark("project")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] whitespace-nowrap">PM</TableHead>
                <TableHead className="text-[12px] min-w-[140px]">款項期數</TableHead>
                <TableHead className="text-[12px] text-right whitespace-nowrap">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleSort("income")}>
                    收入金額{sortMark("income")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] text-right whitespace-nowrap">已收金額</TableHead>
                <TableHead className="text-[12px] text-right whitespace-nowrap">
                  <button type="button" className="hover:text-gray-900" onClick={() => toggleSort("outstanding")}>
                    待收金額{sortMark("outstanding")}
                  </button>
                </TableHead>
                <TableHead className="text-[12px] whitespace-nowrap">收款狀態</TableHead>
                <TableHead className="text-[12px] whitespace-nowrap">付款方式</TableHead>
                <TableHead className="text-[12px] min-w-[160px]">備註</TableHead>
                <TableHead className="text-[12px] w-10 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} className="text-center text-sm text-gray-400 py-16">
                    沒有符合的收入記錄
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => {
                  const net = incomeNetOutstanding(row);
                  return (
                    <TableRow key={row.id} className="hover:bg-gray-50/60">
                      <TableCell className="text-[13px] text-gray-700 whitespace-nowrap">
                        {row.created_date ? fmtDateYmd(row.created_date) : "-"}
                      </TableCell>
                      <TableCell className="text-[13px] text-gray-700 whitespace-nowrap">
                        {row.due_date ? fmtDateYmd(row.due_date) : "-"}
                      </TableCell>
                      <TableCell>
                        <IncomeDatePicker
                          value={row.expected_payment_date}
                          field="expected_payment_date"
                          dueDate={row.due_date}
                          paymentStatus={row.payment_status}
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
                        <IncomeExpiryReasonSelect
                          value={row.expiry_reason_id}
                          label={row.expiry_reason_label}
                          reasons={expiryReasons}
                          disabled={!allowEdit}
                          expired={isDueDateExpired(row.due_date)}
                          onChange={(next) => handleExpiryReasonChange(row, next)}
                        />
                      </TableCell>
                      <TableCell>
                        <IncomeDatePicker
                          value={row.receive_date}
                          field="receive_date"
                          disabled={!allowEdit}
                          onChange={(next) => handleDateChange(row, "receive_date", next)}
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
                        <span className="line-clamp-1">
                          {row.contract_type_label || row.type_display || "未分類"}
                          {` #${row.invoice_number || "-"}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-[13px] text-right font-mono text-gray-800">
                        {formatMoney(row.income_amount)}
                      </TableCell>
                      <TableCell className="text-[13px] text-right font-mono text-emerald-600">
                        {formatMoney(row.payment_amount)}
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
                        {canEditProjectIncome && row.project_id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={incomeEditLoadingId === row.id}
                            onClick={() => openIncomeEdit(row)}
                            title="編輯收入"
                          >
                            {incomeEditLoadingId === row.id ? (
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

      <ArReceiveIncomeEditHost
        target={incomeEditTarget}
        onClose={closeIncomeEdit}
        onOpened={handleIncomeEditOpened}
        onSaved={() => {
          void loadData();
        }}
      />
    </div>
  );
}
