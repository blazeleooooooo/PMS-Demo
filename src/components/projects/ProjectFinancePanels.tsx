"use client";

import React, { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import { handleNavClick } from "@/lib/nav-click";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  ArrowUpCircle,
  ArrowDownCircle,
  Receipt,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  HardHat,
  Paperclip,
  Upload,
  X,
  ExternalLink,
  ImageIcon,
  FileText,
  ChevronsUpDown,
  Check,
  Search,
  ClipboardCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createIncome,
  updateIncome,
  persistIncomeBelowEstimatedReason,
  deleteIncome,
  setIncomePaymentStatus,
  setExpensePaymentStatus,
  createExpense,
  updateExpense,
  deleteExpense,
  fetchContractTypes,
  fetchSupplierTypes,
  fetchSupplierOptions,
  fetchPaymentMethods,
  fetchFactoryOptions,
  updateBWAProject,
  type BWAProjectIncome,
  type BWAProjectExpense,
  type ContractTypeOption,
  type SupplierTypeOption,
  type LinkOption,
  type IncomeFormData,
  type ExpenseFormData,
  type PaymentMethodOption,
} from "@/lib/data-service";
import { EMPTY_INCOME_AO_FIELDS, incomeAoFieldsFromRow, isAoContractType } from "@/lib/income-ao";
import { incomeNetOutstanding } from "@/lib/income-outstanding";
import { isIncomeDecisionStatus, isIncomeSettled } from "@/lib/income-payment-status";
import {
  hasIncomeBelowEstimatedReason,
  INCOME_BELOW_ESTIMATED_REASON_CLEARED_MESSAGE,
  INCOME_BELOW_ESTIMATED_REASON_REQUIRED_MESSAGE,
  isProjectIncomeBelowEstimated,
  normalizeIncomeBelowEstimatedReason,
  otherProjectIncomeTotal,
} from "@/lib/income-estimated-floor";
import {
  IncomeBelowEstimatedReasonDialog,
  IncomeBelowEstimatedReasonField,
} from "@/components/projects/IncomeBelowEstimatedReasonDialog";
import { IncomeDeleteBlockedDialog } from "@/components/projects/IncomeDeleteBlockedDialog";
import { isExpenseDecisionStatus } from "@/lib/expense-payment-status";
import { IncomeAOFields } from "@/components/projects/IncomeAOFields";
import { IncomeBadDebtsField } from "@/components/projects/IncomeBadDebtsField";
import { IncomeCollectionSituationField } from "@/components/projects/IncomeCollectionSituationField";
import { IncomeExpiryReasonField } from "@/components/projects/IncomeExpiryReasonField";
import { IncomePaymentStatusField } from "@/components/projects/IncomePaymentStatusField";
import { ExpensePaymentStatusField } from "@/components/projects/ExpensePaymentStatusField";
import { createClient } from "@/lib/supabase/client";
import { lazyProxy } from "@/lib/supabase/public-env";
import { buildStorageObjectKeyWithSanitizedName } from "@/lib/storage-utils";
import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { formatDate, isDueDateExpired, isDueDateLocked, isExpectedPaymentDateMissing, isExpectedPaymentDateRequired, isIncomeExpiryReasonMissing, isPastDueUnpaid, toDateInputValue } from "@/lib/date-utils";
import {
  evaluateExpenseGroupRules,
  emptySupplierDocumentEligibility,
  fetchSupplierDocumentEligibility,
  getExpenseSupplierDocumentError,
  groupHasSupplierQuotation,
  isSupplierEligibleForExpenseAmount,
  parseExpenseFileUrls,
  resolveGroupSupplierQuotationFile,
  supplierMeetsDocumentRules,
  type SupplierDocumentEligibility,
} from "@/lib/expense-amount-rules";
import { ExpenseAmountRulesBox } from "@/components/projects/ExpenseAmountRulesBox";
import {
  convertRmbToHkd,
  resolveExpenseRateDate,
  type CnyHkdRateResult,
  type ExpenseAmountCurrency,
} from "@/lib/rmb-hkd-converter";
import SupplierEditDialog from "@/components/suppliers/SupplierEditDialog";
import ExpenseOutstandingSplitDialog from "@/components/projects/ExpenseOutstandingSplitDialog";
import { DisabledSubmitControl } from "@/components/projects/DisabledSubmitControl";
import {
  EXPENSE_CONTROL_LOCKED_MESSAGE,
  getExpenseSubmitBlockers,
  getIncomeSubmitBlockers,
} from "@/lib/finance-form-submit-blockers";
import {
  buildSplitPayloads,
  buildStayAsIsPayload,
  hasPartialOutstanding,
  nextExpenseInstallmentIdentity,
  outstandingAmount,
  paidExceedsInstallment,
} from "@/lib/expense-outstanding-split";

const supabase = lazyProxy(() => createClient());

export type ProjectFinanceView = "overview-income" | "overview-expense" | "income" | "expense";
export type ProjectEntityType = "bwa_project" | "bwf_project";
export type ExpensePayeeMode = "supplier" | "factory";

export interface ProjectFinancePanelsProps {
  projectId: string;
  entityType: ProjectEntityType;
  data: {
    estimated_income: number | null;
    estimated_expense: number | null;
    income_below_estimated_reason?: string | null;
    main_contractor_id?: string | null;
    main_contractor_name?: string | null;
    incomes: BWAProjectIncome[];
    expenses: BWAProjectExpense[];
  };
  view: ProjectFinanceView;
  onReload: () => void;
  onViewAll?: (tab: string) => void;
  onNavigateToExpenseControl?: () => void;
  expenseUnlocked?: boolean;
  onIncomeDialogOpenChange?: (open: boolean) => void;
  onExpenseDialogOpenChange?: (open: boolean) => void;
}

export interface ProjectFinancePanelsHandle {
  openCreateExpense: (
    supplierIdPreset?: string,
    contractTypeIdPreset?: string,
    payeeMode?: ExpensePayeeMode,
  ) => void;
  openCreateIncome: (contractTypeId?: string) => void;
  openEditIncome: (income: BWAProjectIncome) => void;
  openEditExpense: (expense: BWAProjectExpense) => void;
}

function MetricCard({
  label,
  value,
  subtext,
  accentColor,
  icon: Icon,
}: {
  label: string;
  value: string;
  subtext?: string;
  accentColor: string;
  icon: React.ElementType;
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    "bg-blue-500": { bg: "bg-blue-50", text: "text-blue-500" },
    "bg-red-500": { bg: "bg-red-50", text: "text-red-500" },
    "bg-emerald-500": { bg: "bg-emerald-50", text: "text-emerald-500" },
    "bg-violet-500": { bg: "bg-violet-50", text: "text-violet-500" },
    "bg-amber-500": { bg: "bg-amber-50", text: "text-amber-500" },
  };
  const bgLight = colorMap[accentColor]?.bg || "bg-gray-50";
  const textColor = colorMap[accentColor]?.text || "text-gray-500";

  return (
    <div className="relative overflow-hidden rounded-xl border bg-white p-5 transition-all hover:shadow-md">
      <div className={`absolute top-0 left-0 w-1 h-full ${accentColor}`} />
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 font-mono-num tracking-tight">{value}</p>
          {subtext && <span className="text-xs text-gray-400">{subtext}</span>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgLight}`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  iconColor = "text-blue-500",
  children,
}: {
  title: string;
  icon: React.ElementType;
  iconColor?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="pb-1 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
          <div className="w-6 h-6 rounded-md flex items-center justify-center bg-gray-50">
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-1">
        <Separator className="mb-2" />
        {children}
      </CardContent>
    </Card>
  );
}

function paidStatusBadge(income: BWAProjectIncome) {
  const amt = income.amount || 0;
  const paid = income.payment_amount || 0;
  if (amt <= 0) return <Badge variant="outline" className="text-[12px] text-gray-400">-</Badge>;
  const pct = Math.round((paid / amt) * 100);
  const color =
    pct >= 100
      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
      : pct > 0
        ? "bg-amber-50 text-amber-600 border-amber-200"
        : "bg-blue-50 text-blue-600 border-blue-200";
  return (
    <Badge variant="outline" className={`text-[12px] font-mono ${color}`}>
      {pct.toFixed(1)}%
    </Badge>
  );
}

function incomeCollectionBadge(income: BWAProjectIncome) {
  const amt = income.amount || 0;
  const paid = income.payment_amount || 0;
  if (amt <= 0) return <span className="text-gray-300">-</span>;
  const pct = Math.round((paid / amt) * 100);
  const dueDateStr = income.due_date;
  const now = new Date();
  const isOverdue = dueDateStr ? new Date(dueDateStr) < now : false;
  const isDueSoon = dueDateStr
    ? (() => {
        const due = new Date(dueDateStr);
        const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 14;
      })()
    : false;
  let colorClass = "bg-blue-50 text-blue-600 border-blue-200";
  if (pct >= 100) {
    colorClass = "bg-emerald-50 text-emerald-600 border-emerald-200";
  } else if (isOverdue && pct < 100) {
    colorClass = "bg-red-50 text-red-600 border-red-200";
  } else if (isDueSoon && pct < 100) {
    colorClass = "bg-amber-50 text-amber-600 border-amber-200";
  }
  return (
    <Badge variant="outline" className={`text-[12px] font-mono ${colorClass}`}>
      {pct}%
    </Badge>
  );
}

function expensePaidBadge(expense: { amount?: number | null; paid_amount?: number | null }) {
  const amt = expense.amount || 0;
  const paid = expense.paid_amount || 0;
  if (amt <= 0) return <span className="text-gray-300">-</span>;
  const pct = Math.round((paid / amt) * 100);
  let colorClass = "bg-blue-50 text-blue-600 border-blue-200";
  if (pct >= 100) {
    colorClass = "bg-emerald-50 text-emerald-600 border-emerald-200";
  } else if (pct === 0) {
    colorClass = "bg-red-50 text-red-600 border-red-200";
  } else if (pct < 100) {
    colorClass = "bg-amber-50 text-amber-600 border-amber-200";
  }
  return (
    <Badge variant="outline" className={`text-[12px] font-mono ${colorClass}`}>
      {pct}%
    </Badge>
  );
}

function expensePayeeLabel(expense: BWAProjectExpense): string {
  if (expense.factory_id) return expense.factory_name || "未分類工廠";
  return expense.supplier_name || "未分類供應商";
}

const ProjectFinancePanels = forwardRef<ProjectFinancePanelsHandle, ProjectFinancePanelsProps>(function ProjectFinancePanels({
  projectId,
  entityType,
  data,
  view,
  onReload,
  onViewAll,
  onNavigateToExpenseControl,
  expenseUnlocked = true,
  onIncomeDialogOpenChange,
  onExpenseDialogOpenChange,
}, ref) {
  const router = useRouter();
  const { formatMoney, formatMoney2 } = useFinancialFormat();
  const { canCreate, canEdit, canDelete } = usePermission();
  const { staff } = useAuth();
  const canCreateIncome = canCreate("projects.income");
  const canEditIncome = canEdit("projects.income");
  const canDeleteIncome = canDelete("projects.income");
  const canCreateExpense = canCreate("projects.expense");
  const canEditExpense = canEdit("projects.expense");
  const canDeleteExpense = canDelete("projects.expense");

  const isSuperAdmin = (staff as { role?: string } | null)?.role === "Super Admin";
  const isAdminOrAbove = isSuperAdmin || (staff as { role?: string } | null)?.role === "Admin";
  const canEditInstallmentNumber = isAdminOrAbove;

  const incomes = data.incomes || [];
  const expenses = data.expenses || [];
  const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);
  const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const [contractTypes, setContractTypes] = useState<ContractTypeOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [supplierTypes, setSupplierTypes] = useState<SupplierTypeOption[]>([]);
  const [supplierOptionsList, setSupplierOptionsList] = useState<LinkOption[]>([]);
  const [factoryOptionsList, setFactoryOptionsList] = useState<LinkOption[]>([]);
  const [expandedContractType, setExpandedContractType] = useState<string | null>(null);
  const [expandedExpenseGroup, setExpandedExpenseGroup] = useState<string | null>(null);

  const [incomeIdsWithInvoice, setIncomeIdsWithInvoice] = useState<Set<string>>(new Set());
  const [incomeIdsWithReceipt, setIncomeIdsWithReceipt] = useState<Set<string>>(new Set());

  const [showIncomeDialog, setShowIncomeDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editingIncome, setEditingIncome] = useState<BWAProjectIncome | null>(null);
  const [editingExpense, setEditingExpense] = useState<BWAProjectExpense | null>(null);
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [deletingIncomeId, setDeletingIncomeId] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [confirmDeleteIncomeId, setConfirmDeleteIncomeId] = useState<string | null>(null);
  const [deleteIncomeBlockedOpen, setDeleteIncomeBlockedOpen] = useState(false);
  const [confirmDeleteExpenseId, setConfirmDeleteExpenseId] = useState<string | null>(null);
  const [showExpenseOutstandingSplit, setShowExpenseOutstandingSplit] = useState(false);
  const [expensePayeeMode, setExpensePayeeMode] = useState<ExpensePayeeMode>("supplier");
  const [showAllExpenseCategories, setShowAllExpenseCategories] = useState(false);
  const isBwfProject = entityType === "bwf_project";
  const projectRoutePrefix = isBwfProject
    ? `/bwf/projects/${projectId}`
    : `/projects/bwa/${projectId}`;

  const [incomeForm, setIncomeForm] = useState<IncomeFormData>({
    income_amount: null,
    payment_amount: null,
    outstanding: null,
    receive_date: null,
    due_date: null,
    expected_payment_date: null,
    invoice_number: null,
    n_contract_type_id: null,
    payment_status: null,
    payment_method: null,
    payment_method_id: null,
    remark: null,
    type_display: null,
    pdf_file: null,
    expiry_reason_id: null,
    bad_debts: null,
    ...EMPTY_INCOME_AO_FIELDS,
  });
  const incomeFormRef = useRef(incomeForm);
  useEffect(() => { incomeFormRef.current = incomeForm; }, [incomeForm]);

  const [expenseForm, setExpenseForm] = useState<ExpenseFormData>({
    installment_amount: null,
    paid_amount: null,
    outstanding: null,
    payment_date: null,
    due_date: null,
    expected_payment_date: null,
    supplier_id: null,
    factory_id: null,
    n_contract_type_id: null,
    n_supplier_type_id: null,
    payment_method_id: null,
    cheque_no: null,
    rank_report: null,
    payment_status: null,
    remark_t: null,
    type_display: null,
    invoice_number: null,
    pdf_file: null,
    supplier_quotation_file: null,
  });
  const expenseFormRef = useRef(expenseForm);
  useEffect(() => { expenseFormRef.current = expenseForm; }, [expenseForm]);
  const exchangeRateRequestIdRef = useRef(0);

  const [expenseAmountCurrency, setExpenseAmountCurrency] = useState<ExpenseAmountCurrency>("HKD");
  const [rmbInputAmount, setRmbInputAmount] = useState<number | null>(null);
  const [paidAmountCurrency, setPaidAmountCurrency] = useState<ExpenseAmountCurrency>("HKD");
  const [rmbPaidInputAmount, setRmbPaidInputAmount] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<CnyHkdRateResult | null>(null);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState<string | null>(null);

  const [incomeFileUploading, setIncomeFileUploading] = useState(false);
  const [incomeBelowReason, setIncomeBelowReason] = useState("");
  const [incomeBelowReasonError, setIncomeBelowReasonError] = useState<string | null>(null);
  const [showBelowReasonDialog, setShowBelowReasonDialog] = useState(false);
  const [belowReasonDraft, setBelowReasonDraft] = useState("");
  const [belowReasonDialogError, setBelowReasonDialogError] = useState<string | null>(null);
  const [incomeFileError, setIncomeFileError] = useState<string | null>(null);
  const [incomeStatusError, setIncomeStatusError] = useState<string | null>(null);
  const [expenseStatusError, setExpenseStatusError] = useState<string | null>(null);
  const [expenseFileUploading, setExpenseFileUploading] = useState(false);
  const [expenseFileError, setExpenseFileError] = useState<string | null>(null);
  const [expenseQuotationUploading, setExpenseQuotationUploading] = useState(false);
  const [expenseQuotationError, setExpenseQuotationError] = useState<string | null>(null);
  const [expenseSupplierDocError, setExpenseSupplierDocError] = useState<string | null>(null);
  const [supplierDocEligibility, setSupplierDocEligibility] = useState<SupplierDocumentEligibility | null>(null);
  const [supplierDocEligibilityLoading, setSupplierDocEligibilityLoading] = useState(false);
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [supplierTypeSearchQuery, setSupplierTypeSearchQuery] = useState("");
  const [quickAddSupplierOpen, setQuickAddSupplierOpen] = useState(false);
  const [factorySearchOpen, setFactorySearchOpen] = useState(false);
  const [factorySearchQuery, setFactorySearchQuery] = useState("");
  const supplierPanelRef = useRef<HTMLDivElement>(null);
  const supplierTypePanelRef = useRef<HTMLDivElement>(null);
  const factoryPanelRef = useRef<HTMLDivElement>(null);

  const [mcSearchOpen, setMcSearchOpen] = useState(false);
  const [mcSearchQuery, setMcSearchQuery] = useState("");
  const [mcSaving, setMcSaving] = useState(false);
  const [mcError, setMcError] = useState<string | null>(null);
  const mcPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchContractTypes().then(setContractTypes);
    fetchPaymentMethods().then(setPaymentMethods);
    fetchSupplierTypes().then(setSupplierTypes);
    fetchSupplierOptions().then(setSupplierOptionsList);
    if (entityType === "bwf_project") {
      fetchFactoryOptions().then(setFactoryOptionsList);
    }
  }, [entityType]);

  useEffect(() => {
    const assigned = (data.expenses ?? []).map((e) => e.n_supplier_type_id);
    if (!assigned.some((id) => !!id)) return;
    fetchSupplierTypes(assigned).then(setSupplierTypes);
  }, [data.expenses]);

  useEffect(() => {
    if (!incomes.length) {
      setIncomeIdsWithInvoice(new Set());
      setIncomeIdsWithReceipt(new Set());
      return;
    }
    const incomeIds = incomes.map((inc) => inc.id);
    Promise.all([
      supabase.from("income_invoices").select("income_id").in("income_id", incomeIds),
      supabase.from("receipts").select("income_id").in("income_id", incomeIds),
    ]).then(([invoiceRes, receiptRes]) => {
      setIncomeIdsWithInvoice(new Set((invoiceRes.data || []).map((r: { income_id: string }) => r.income_id)));
      setIncomeIdsWithReceipt(new Set((receiptRes.data || []).map((r: { income_id: string }) => r.income_id)));
    });
  }, [entityType, incomes]);

  // BWA Expense Control group rules (quotation / BR / insurance) — not applied to BWF.
  const expenseGroupRulesEnabled = !isBwfProject;

  useEffect(() => {
    if (!showExpenseDialog || expensePayeeMode !== "supplier" || !expenseGroupRulesEnabled) return;
    let cancelled = false;
    setSupplierDocEligibilityLoading(true);
    fetchSupplierDocumentEligibility()
      .then((result) => { if (!cancelled) setSupplierDocEligibility(result); })
      .catch(() => { if (!cancelled) setSupplierDocEligibility(emptySupplierDocumentEligibility()); })
      .finally(() => { if (!cancelled) setSupplierDocEligibilityLoading(false); });
    return () => { cancelled = true; };
  }, [showExpenseDialog, expensePayeeMode, expenseGroupRulesEnabled]);

  const needsExchangeRate =
    isBwfProject && (expenseAmountCurrency === "RMB" || paidAmountCurrency === "RMB");

  useEffect(() => {
    if (!showExpenseDialog || !needsExchangeRate) {
      setExchangeRate(null);
      setExchangeRateError(null);
      setExchangeRateLoading(false);
      return;
    }

    const requestId = ++exchangeRateRequestIdRef.current;
    const rateDate = resolveExpenseRateDate(expenseForm.payment_date);
    setExchangeRateLoading(true);
    setExchangeRateError(null);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    fetch(`/api/exchange-rate/cny-hkd?date=${encodeURIComponent(rateDate)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `匯率查詢失敗 (${res.status})`);
        }
        return res.json() as Promise<CnyHkdRateResult>;
      })
      .then((result) => {
        if (requestId === exchangeRateRequestIdRef.current) {
          setExchangeRate(result);
        }
      })
      .catch((err: unknown) => {
        if (requestId !== exchangeRateRequestIdRef.current) return;
        setExchangeRate(null);
        if (err instanceof DOMException && err.name === "AbortError") {
          setExchangeRateError("匯率查詢逾時，請稍後再試");
        } else {
          setExchangeRateError(err instanceof Error ? err.message : "無法取得匯率");
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (requestId === exchangeRateRequestIdRef.current) {
          setExchangeRateLoading(false);
        }
      });

    return () => {
      controller.abort();
      exchangeRateRequestIdRef.current += 1;
    };
  }, [showExpenseDialog, needsExchangeRate, expenseForm.payment_date]);

  useEffect(() => {
    if (!showExpenseDialog || !isBwfProject || expenseAmountCurrency !== "RMB") return;
    if (rmbInputAmount == null || !exchangeRate) return;

    const hkdAmount = convertRmbToHkd(rmbInputAmount, exchangeRate.rate);
    setExpenseForm((prev) => {
      if (prev.installment_amount === hkdAmount) return prev;
      return { ...prev, installment_amount: hkdAmount };
    });
  }, [showExpenseDialog, isBwfProject, expenseAmountCurrency, rmbInputAmount, exchangeRate]);

  useEffect(() => {
    if (!showExpenseDialog || !isBwfProject || paidAmountCurrency !== "RMB") return;
    if (rmbPaidInputAmount == null || !exchangeRate) return;

    const hkdAmount = convertRmbToHkd(rmbPaidInputAmount, exchangeRate.rate);
    setExpenseForm((prev) => {
      if (prev.paid_amount === hkdAmount) return prev;
      return { ...prev, paid_amount: hkdAmount };
    });
  }, [showExpenseDialog, isBwfProject, paidAmountCurrency, rmbPaidInputAmount, exchangeRate]);

  useEffect(() => {
    if (!supplierSearchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (supplierPanelRef.current && !supplierPanelRef.current.contains(e.target as Node)) {
        setSupplierSearchOpen(false);
        setSupplierSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [supplierSearchOpen]);

  useEffect(() => {
    if (!factorySearchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (factoryPanelRef.current && !factoryPanelRef.current.contains(e.target as Node)) {
        setFactorySearchOpen(false);
        setFactorySearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [factorySearchOpen]);

  useEffect(() => {
    if (!mcSearchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (mcPanelRef.current && !mcPanelRef.current.contains(e.target as Node)) {
        setMcSearchOpen(false);
        setMcSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mcSearchOpen]);

  const normalizeFileUrl = (url: string): string => {
    let normalized = url.trim();
    if (normalized.startsWith("//")) normalized = `https:${normalized}`;
    return normalized;
  };

  const parseFileUrls = (pdfFile: string | null): string[] => {
    if (!pdfFile) return [];
    return pdfFile.split(",").map((u) => u.trim()).filter(Boolean).map(normalizeFileUrl);
  };

  const getFileName = (url: string): string => {
    try {
      const decoded = decodeURIComponent(normalizeFileUrl(url).split("/").pop()?.split("?")[0] || "file");
      return decoded.length > 30 ? decoded.slice(0, 27) + "..." : decoded;
    } catch {
      return "file";
    }
  };

  const getFileExtension = (url: string): string => {
    const name = normalizeFileUrl(url).split("/").pop()?.split("?")[0] || "";
    return name.split(".").pop()?.toLowerCase() || "";
  };

  const ensureIncomeBucket = async (): Promise<boolean> => {
    try {
      const { error: listError } = await supabase.storage.from("income-files").list("", { limit: 1 });
      if (listError) {
        const { error: createError } = await supabase.storage.createBucket("income-files", {
          public: true,
          fileSizeLimit: 52428800,
        });
        if (createError && !createError.message?.includes("already exists")) return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const getNextInstallmentNumber = (contractTypeId?: string | null): string => {
    const matching = incomes.filter((inc) => {
      if (contractTypeId) return inc.n_contract_type_id === contractTypeId;
      return !inc.n_contract_type_id;
    });
    return String(matching.length + 1);
  };

  const resetIncomeForm = () => {
    setIncomeForm({
      income_amount: null,
      payment_amount: null,
      outstanding: null,
      receive_date: null,
      due_date: null,
      expected_payment_date: null,
      invoice_number: null,
      n_contract_type_id: null,
      payment_status: null,
      payment_method: null,
      payment_method_id: null,
      remark: null,
      type_display: null,
      pdf_file: null,
      expiry_reason_id: null,
      bad_debts: null,
      ...EMPTY_INCOME_AO_FIELDS,
    });
    setEditingIncome(null);
    setIncomeFileError(null);
    setIncomeStatusError(null);
    setIncomeBelowReason(data.income_below_estimated_reason ?? "");
    setIncomeBelowReasonError(null);
    setShowBelowReasonDialog(false);
    setBelowReasonDraft("");
    setBelowReasonDialogError(null);
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      installment_amount: null,
      paid_amount: null,
      outstanding: null,
      payment_date: null,
      due_date: null,
      expected_payment_date: null,
      supplier_id: null,
      factory_id: null,
      n_contract_type_id: null,
      n_supplier_type_id: null,
      payment_method_id: null,
      cheque_no: null,
      rank_report: null,
      payment_status: null,
      remark_t: null,
      type_display: null,
      invoice_number: null,
      pdf_file: null,
      supplier_quotation_file: null,
    });
    setEditingExpense(null);
    setExpensePayeeMode("supplier");
    setShowAllExpenseCategories(false);
    setExpenseFileError(null);
    setExpenseQuotationError(null);
    setExpenseSupplierDocError(null);
    setExpenseStatusError(null);
    setSupplierSearchOpen(false);
    setSupplierSearchQuery("");
    setFactorySearchOpen(false);
    setFactorySearchQuery("");
    setExpenseAmountCurrency("HKD");
    setRmbInputAmount(null);
    setPaidAmountCurrency("HKD");
    setRmbPaidInputAmount(null);
    setExchangeRate(null);
    setExchangeRateError(null);
    setExchangeRateLoading(false);
    setShowExpenseOutstandingSplit(false);
  };

  const openCreateIncome = (contractTypeId?: string) => {
    resetIncomeForm();
    const nextNum = getNextInstallmentNumber(contractTypeId);
    if (contractTypeId) {
      setIncomeForm((prev) => ({ ...prev, n_contract_type_id: contractTypeId, invoice_number: nextNum }));
    } else {
      setIncomeForm((prev) => ({ ...prev, invoice_number: nextNum }));
    }
    setShowIncomeDialog(true);
    onIncomeDialogOpenChange?.(true);
  };

  const closeIncomeDialog = () => {
    setShowIncomeDialog(false);
    resetIncomeForm();
    onIncomeDialogOpenChange?.(false);
  };

  const openEditIncome = (income: BWAProjectIncome) => {
    setEditingIncome(income);
    setIncomeForm({
      income_amount: income.amount,
      payment_amount: income.payment_amount,
      outstanding: income.outstanding,
      receive_date: toDateInputValue(income.payment_date) || null,
      due_date: toDateInputValue(income.due_date) || null,
      expected_payment_date: toDateInputValue(income.expected_payment_date) || null,
      invoice_number: income.invoice_number,
      n_contract_type_id: income.n_contract_type_id,
      payment_status: income.payment_status,
      payment_method: income.payment_method,
      payment_method_id: null,
      remark: income.remark,
      type_display: income.type_display,
      pdf_file: income.pdf_file,
      expiry_reason_id: isIncomeSettled(income.payment_status) ? null : income.expiry_reason_id,
      bad_debts: income.bad_debts ?? null,
      ...incomeAoFieldsFromRow(income),
    });
    setIncomeBelowReason(data.income_below_estimated_reason ?? "");
    setIncomeBelowReasonError(null);
    setShowIncomeDialog(true);
    onIncomeDialogOpenChange?.(true);
  };

  const incomeAmountBelowEstimated = useMemo(() => {
    if (incomeForm.income_amount == null) return false;
    const projected =
      otherProjectIncomeTotal(incomes, editingIncome?.id) +
      (Number(incomeForm.income_amount) || 0);
    return isProjectIncomeBelowEstimated(projected, data.estimated_income);
  }, [incomes, data.estimated_income, editingIncome?.id, incomeForm.income_amount]);

  const persistedIncomeBelowReason = data.income_below_estimated_reason ?? null;
  const hasPersistedIncomeBelowReason = hasIncomeBelowEstimatedReason(persistedIncomeBelowReason);

  const persistIncomeAndSave = async (reasonToSave: string | null) => {
    setIncomeSaving(true);
    const raw = incomeFormRef.current;
    const reasonResult = await persistIncomeBelowEstimatedReason(
      projectId,
      entityType,
      reasonToSave,
      persistedIncomeBelowReason
    );
    if (!reasonResult.success) {
      setIncomeSaving(false);
      setIncomeBelowReasonError(reasonResult.error || INCOME_BELOW_ESTIMATED_REASON_CLEARED_MESSAGE);
      return;
    }

    const received = isIncomeSettled(raw.payment_status);
    const latestForm = {
      ...raw,
      expiry_reason_id:
        received || !isDueDateExpired(raw.due_date) ? null : raw.expiry_reason_id,
      ...(isAdminOrAbove ? {} : { bad_debts: undefined }),
    };
    let result;
    if (editingIncome) {
      result = await updateIncome(editingIncome.id, latestForm, staff?.id);
      if (
        result.success &&
        latestForm.payment_status !== editingIncome.payment_status
      ) {
        const statusResult = await setIncomePaymentStatus(
          editingIncome.id,
          latestForm.payment_status,
          staff?.id
        );
        if (!statusResult.success) result = statusResult;
      }
    } else {
      result = await createIncome(projectId, latestForm, entityType);
      if (
        result.success &&
        result.id &&
        isIncomeDecisionStatus(latestForm.payment_status)
      ) {
        const statusResult = await setIncomePaymentStatus(
          result.id,
          latestForm.payment_status,
          staff?.id
        );
        if (!statusResult.success) result = statusResult;
      }
    }
    setIncomeSaving(false);
    if (result.success) {
      setShowBelowReasonDialog(false);
      closeIncomeDialog();
      onReload();
    } else if (result.error) {
      setIncomeStatusError(result.error);
    }
  };

  const handleSaveIncome = async () => {
    setIncomeSaving(true);
    const raw = incomeFormRef.current;
    const projected =
      otherProjectIncomeTotal(incomes, editingIncome?.id) +
      (Number(raw.income_amount) || 0);
    const belowEstimated = isProjectIncomeBelowEstimated(projected, data.estimated_income);
    const nextReason = normalizeIncomeBelowEstimatedReason(incomeBelowReason);

    if (raw.payment_amount != null && !raw.payment_status) {
      setIncomeStatusError("已填寫已收金額時必須選擇收款狀態");
      setIncomeSaving(false);
      return;
    }
    setIncomeStatusError(null);
    if (!raw.due_date) {
      setIncomeSaving(false);
      return;
    }
    if (isExpectedPaymentDateMissing(raw.due_date, raw.expected_payment_date, undefined, raw.payment_status)) {
      setIncomeSaving(false);
      return;
    }
    if (isIncomeExpiryReasonMissing(raw.due_date, raw.expiry_reason_id, undefined, raw.payment_status)) {
      setIncomeSaving(false);
      return;
    }
    if (raw.payment_amount != null && (!raw.receive_date || !raw.payment_method)) {
      setIncomeSaving(false);
      return;
    }
    if (hasPersistedIncomeBelowReason && !nextReason) {
      setIncomeBelowReasonError(INCOME_BELOW_ESTIMATED_REASON_CLEARED_MESSAGE);
      setIncomeSaving(false);
      return;
    }
    if (belowEstimated && !nextReason) {
      setBelowReasonDraft("");
      setBelowReasonDialogError(null);
      setShowBelowReasonDialog(true);
      setIncomeSaving(false);
      return;
    }
    await persistIncomeAndSave(nextReason);
  };

  const handleConfirmBelowReason = async () => {
    const nextReason = normalizeIncomeBelowEstimatedReason(belowReasonDraft);
    if (!nextReason) {
      setBelowReasonDialogError(INCOME_BELOW_ESTIMATED_REASON_REQUIRED_MESSAGE);
      return;
    }
    setIncomeBelowReason(nextReason);
    setIncomeBelowReasonError(null);
    await persistIncomeAndSave(nextReason);
  };

  const handleDeleteIncome = (incomeId: string) => {
    const remaining = otherProjectIncomeTotal(incomes, incomeId);
    if (
      !hasPersistedIncomeBelowReason &&
      isProjectIncomeBelowEstimated(remaining, data.estimated_income)
    ) {
      setDeleteIncomeBlockedOpen(true);
      return;
    }
    setConfirmDeleteIncomeId(incomeId);
  };

  const confirmDeleteIncome = async () => {
    if (!confirmDeleteIncomeId) return;
    setDeletingIncomeId(confirmDeleteIncomeId);
    setConfirmDeleteIncomeId(null);
    const result = await deleteIncome(confirmDeleteIncomeId);
    setDeletingIncomeId(null);
    if (result.success) onReload();
  };

  const openCreateExpense = (
    supplierIdPreset?: string,
    contractTypeIdPreset?: string,
    payeeMode: ExpensePayeeMode = "supplier",
  ) => {
    resetExpenseForm();
    setExpensePayeeMode(payeeMode);
    const matching = expenses.filter((e) => {
      if (payeeMode === "factory") {
        return (
          (supplierIdPreset ? e.factory_id === supplierIdPreset : !e.factory_id && !e.supplier_id) &&
          (contractTypeIdPreset ? e.n_contract_type_id === contractTypeIdPreset : !e.n_contract_type_id)
        );
      }
      return (
        (supplierIdPreset ? e.supplier_id === supplierIdPreset : !e.supplier_id) &&
        (contractTypeIdPreset ? e.n_contract_type_id === contractTypeIdPreset : !e.n_contract_type_id)
      );
    });
    const nextRank = String(matching.length + 1);
    setExpenseForm((prev) => ({
      ...prev,
      supplier_id: payeeMode === "supplier" ? (supplierIdPreset || null) : null,
      factory_id: payeeMode === "factory" ? (supplierIdPreset || null) : null,
      n_contract_type_id: contractTypeIdPreset || null,
      rank_report: nextRank,
    }));
    setShowExpenseDialog(true);
    onExpenseDialogOpenChange?.(true);
  };

  const handleExpensePayeeModeChange = (mode: ExpensePayeeMode) => {
    if (mode === expensePayeeMode) return;
    setExpensePayeeMode(mode);
    setExpenseForm((prev) => ({
      ...prev,
      supplier_id: mode === "supplier" ? prev.supplier_id : null,
      factory_id: mode === "factory" ? prev.factory_id : null,
    }));
    if (mode === "factory") {
      setExpenseSupplierDocError(null);
      setExpenseQuotationError(null);
    }
  };

  const expenseCategoryOptions = useMemo(() => {
    if (!isBwfProject || showAllExpenseCategories) return supplierTypes;
    const bwfTypes = supplierTypes.filter((st) => st.is_bwf === true);
    const selectedId = expenseForm.n_supplier_type_id;
    if (selectedId && !bwfTypes.some((st) => st.id === selectedId)) {
      const selected = supplierTypes.find((st) => st.id === selectedId);
      if (selected) return [...bwfTypes, selected];
    }
    return bwfTypes;
  }, [isBwfProject, showAllExpenseCategories, supplierTypes, expenseForm.n_supplier_type_id]);

  const openEditExpense = (expense: BWAProjectExpense) => {
    setEditingExpense(expense);
    setExpensePayeeMode(expense.factory_id ? "factory" : "supplier");
    setShowAllExpenseCategories(false);
    const hasRmbReference =
      isBwfProject &&
      expense.converter_input_amount != null &&
      expense.converter_input_amount > 0;
    setExpenseAmountCurrency(hasRmbReference ? "RMB" : "HKD");
    setRmbInputAmount(hasRmbReference ? expense.converter_input_amount : null);
    // Paid amount has no stored RMB reference — always open in HKD.
    setPaidAmountCurrency("HKD");
    setRmbPaidInputAmount(null);
    setExchangeRate(null);
    setExchangeRateError(null);
    const quotationFile =
      (expense.supplier_quotation_file && expense.supplier_quotation_file.trim()) ||
      resolveGroupSupplierQuotationFile(
        expense.supplier_id,
        expense.n_contract_type_id,
        expenses,
        expense.id
      ) ||
      null;
    setExpenseForm({
      installment_amount: expense.amount,
      converter_input_amount: expense.converter_input_amount ?? null,
      paid_amount: expense.paid_amount,
      outstanding: expense.outstanding,
      payment_date: toDateInputValue(expense.payment_date) || null,
      due_date: toDateInputValue(expense.due_date) || null,
      expected_payment_date: toDateInputValue(expense.expected_payment_date) || null,
      supplier_id: expense.supplier_id,
      factory_id: expense.factory_id,
      n_contract_type_id: expense.n_contract_type_id,
      n_supplier_type_id: expense.n_supplier_type_id,
      payment_method_id: expense.payment_method_id,
      cheque_no: expense.cheque_no,
      rank_report: expense.rank_report,
      payment_status: expense.payment_status,
      remark_t: expense.remark,
      type_display: expense.type_display,
      invoice_number: expense.invoice_number,
      pdf_file: expense.pdf_file,
      supplier_quotation_file: quotationFile,
    });
    setExpenseQuotationError(null);
    setShowExpenseDialog(true);
    onExpenseDialogOpenChange?.(true);
  };

  const closeExpenseDialog = () => {
    setShowExpenseDialog(false);
    resetExpenseForm();
    onExpenseDialogOpenChange?.(false);
  };

  useImperativeHandle(ref, () => ({
    openCreateExpense,
    openCreateIncome,
    openEditIncome,
    openEditExpense,
  }));

  const expenseCriteriaExpenses = useMemo(
    () =>
      expenses.map((expense) => ({
        id: expense.id,
        supplier_id: expense.supplier_id,
        n_contract_type_id: expense.n_contract_type_id,
        amount: expense.amount,
        supplier_quotation_file: expense.supplier_quotation_file,
      })),
    [expenses],
  );

  const expenseGroupRules = useMemo(
    () =>
      evaluateExpenseGroupRules(
        expenseForm.installment_amount,
        expenseForm.supplier_id,
        expenseForm.n_contract_type_id,
        expenseCriteriaExpenses,
        editingExpense?.id,
        expenseGroupRulesEnabled,
      ),
    [
      expenseForm.installment_amount,
      expenseForm.supplier_id,
      expenseForm.n_contract_type_id,
      expenseCriteriaExpenses,
      editingExpense?.id,
      expenseGroupRulesEnabled,
    ],
  );

  const expenseAmountRules = expenseGroupRules.rules;

  const expenseGroupHasQuotation = useMemo(
    () =>
      groupHasSupplierQuotation(
        expenseForm.supplier_id,
        expenseForm.n_contract_type_id,
        expenseCriteriaExpenses,
        expenseForm.supplier_quotation_file,
        editingExpense?.id,
      ),
    [
      expenseForm.supplier_id,
      expenseForm.n_contract_type_id,
      expenseForm.supplier_quotation_file,
      expenseCriteriaExpenses,
      editingExpense?.id,
    ],
  );

  const expenseSupplierOptionsFiltered = useMemo(() => {
    if (!expenseGroupRulesEnabled || !expenseForm.n_contract_type_id || !supplierDocEligibility) {
      return supplierOptionsList;
    }
    return supplierOptionsList.filter((supplier) => {
      const supplierGroupRules = evaluateExpenseGroupRules(
        expenseForm.installment_amount,
        supplier.id,
        expenseForm.n_contract_type_id,
        expenseCriteriaExpenses,
        editingExpense?.id,
        expenseGroupRulesEnabled,
      );
      return isSupplierEligibleForExpenseAmount(supplier.id, supplierGroupRules.rules, supplierDocEligibility);
    });
  }, [
    supplierOptionsList,
    expenseForm.installment_amount,
    expenseForm.n_contract_type_id,
    expenseCriteriaExpenses,
    editingExpense?.id,
    supplierDocEligibility,
    expenseGroupRulesEnabled,
  ]);

  const expenseSupplierOptionsForDropdown = useMemo(() => {
    if (!expenseForm.supplier_id) return expenseSupplierOptionsFiltered;
    if (expenseSupplierOptionsFiltered.some((supplier) => supplier.id === expenseForm.supplier_id)) {
      return expenseSupplierOptionsFiltered;
    }
    const selected = supplierOptionsList.find((supplier) => supplier.id === expenseForm.supplier_id);
    return selected ? [selected, ...expenseSupplierOptionsFiltered] : expenseSupplierOptionsFiltered;
  }, [expenseForm.supplier_id, expenseSupplierOptionsFiltered, supplierOptionsList]);

  const handleSaveExpense = async () => {
    const current = expenseFormRef.current;
    const isFactoryPayee = expensePayeeMode === "factory";

    if (!isFactoryPayee && expenseGroupRulesEnabled) {
      const groupRules = evaluateExpenseGroupRules(
        current.installment_amount,
        current.supplier_id,
        current.n_contract_type_id,
        expenseCriteriaExpenses,
        editingExpense?.id,
        expenseGroupRulesEnabled,
      );

      if (!groupRules.expenseControlApplicable) {
        setExpenseSupplierDocError(null);
      } else if (!current.supplier_id || !current.n_contract_type_id) {
        setExpenseSupplierDocError(null);
      } else if (supplierDocEligibilityLoading || !supplierDocEligibility) {
        setExpenseSupplierDocError("正在核對供應商文件，請稍後再試。");
        return;
      } else if (!supplierMeetsDocumentRules(current.supplier_id, groupRules.rules, supplierDocEligibility)) {
        setExpenseSupplierDocError(
          getExpenseSupplierDocumentError(current.supplier_id, groupRules.rules, supplierDocEligibility),
        );
        return;
      } else {
        setExpenseSupplierDocError(null);
      }

      const hasQuotation = groupHasSupplierQuotation(
        current.supplier_id,
        current.n_contract_type_id,
        expenseCriteriaExpenses,
        current.supplier_quotation_file,
        editingExpense?.id,
      );

      if (groupRules.rules.quotationRequired && !hasQuotation) {
        setExpenseQuotationError("群組支出金額達 $3,000 或以上，必須上傳供應商報價單（全組只需一份）。");
        return;
      }
    }
    setExpenseQuotationError(null);
    setExpenseSupplierDocError(null);

    if (!current.due_date) {
      return;
    }
    if (isExpectedPaymentDateMissing(current.due_date, current.expected_payment_date)) {
      return;
    }
    if (current.paid_amount != null && !current.payment_status) {
      setExpenseStatusError("已填寫已付金額時必須選擇審批狀態");
      return;
    }
    setExpenseStatusError(null);
    if (paidExceedsInstallment(current.paid_amount, current.installment_amount)) {
      return;
    }
    if (hasPartialOutstanding(current.paid_amount, current.installment_amount)) {
      setShowExpenseOutstandingSplit(true);
      return;
    }
    await persistExpense("stay");
  };

  const persistExpense = async (
    mode: "stay" | "split",
    childExpectedPaymentDate?: string
  ) => {
    const raw = expenseFormRef.current;
    const current = raw;
    const isFactoryPayee = expensePayeeMode === "factory";
    const normalizedForm: ExpenseFormData = {
      ...current,
      supplier_id: isFactoryPayee ? null : current.supplier_id,
      factory_id: isFactoryPayee ? current.factory_id : null,
      converter_input_amount:
        isBwfProject && expenseAmountCurrency === "RMB"
          ? rmbInputAmount
          : null,
    };

    setExpenseSaving(true);
    let result;
    if (mode === "split" && childExpectedPaymentDate) {
      const nextIdentity = nextExpenseInstallmentIdentity(
        expenses,
        { supplier_id: normalizedForm.supplier_id, factory_id: normalizedForm.factory_id },
        normalizedForm.n_contract_type_id,
        normalizedForm.rank_report
      );
      const { original, child } = buildSplitPayloads({
        form: normalizedForm,
        childExpectedPaymentDate,
        nextIdentity,
        rmb: isBwfProject
          ? {
              expenseAmountCurrency,
              paidAmountCurrency,
              rmbInputAmount,
              rmbPaidInputAmount,
            }
          : null,
      });
      const childResult = await createExpense(projectId, child, entityType);
      if (!childResult.success) {
        setExpenseSaving(false);
        return;
      }
      result = editingExpense
        ? await updateExpense(editingExpense.id, original, staff?.id)
        : await createExpense(projectId, original, entityType);
    } else {
      const latestForm = buildStayAsIsPayload(normalizedForm);
      result = editingExpense
        ? await updateExpense(editingExpense.id, latestForm, staff?.id)
        : await createExpense(projectId, latestForm, entityType);
    }
    if (result.success) {
      const statusTargetId = editingExpense?.id ?? result.id;
      if (statusTargetId) {
        const prevStatus = editingExpense?.payment_status ?? null;
        if (editingExpense && normalizedForm.payment_status !== prevStatus) {
          const statusResult = await setExpensePaymentStatus(
            statusTargetId,
            normalizedForm.payment_status,
            staff?.id
          );
          if (!statusResult.success) result = statusResult;
        } else if (!editingExpense && isExpenseDecisionStatus(normalizedForm.payment_status)) {
          const statusResult = await setExpensePaymentStatus(
            statusTargetId,
            normalizedForm.payment_status,
            staff?.id
          );
          if (!statusResult.success) result = statusResult;
        }
      }
    }
    setExpenseSaving(false);
    if (result.success) {
      setShowExpenseOutstandingSplit(false);
      closeExpenseDialog();
      onReload();
    }
  };

  const handleDeleteExpense = (expenseId: string) => setConfirmDeleteExpenseId(expenseId);

  const confirmDeleteExpense = async () => {
    if (!confirmDeleteExpenseId) return;
    setDeletingExpenseId(confirmDeleteExpenseId);
    setConfirmDeleteExpenseId(null);
    const result = await deleteExpense(confirmDeleteExpenseId);
    setDeletingExpenseId(null);
    if (result.success) onReload();
  };

  const handleSetMainContractor = async (supplierId: string) => {
    if (entityType !== "bwa_project") return;
    setMcSaving(true);
    setMcError(null);
    const result = await updateBWAProject(projectId, { main_contractor_id: supplierId });
    setMcSaving(false);
    setMcSearchOpen(false);
    setMcSearchQuery("");
    if (!result.success) {
      setMcError(result.error || "設定主要承辦商失敗");
      return;
    }
    onReload();
  };

  const handleRemoveMainContractor = async () => {
    if (entityType !== "bwa_project") return;
    setMcSaving(true);
    setMcError(null);
    const result = await updateBWAProject(projectId, { main_contractor_id: null });
    setMcSaving(false);
    if (!result.success) {
      setMcError(result.error || "移除主要承辦商失敗");
      return;
    }
    onReload();
  };

  const handleIncomeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIncomeFileUploading(true);
    setIncomeFileError(null);
    try {
      const bucketReady = await ensureIncomeBucket();
      if (!bucketReady) {
        setIncomeFileError("無法連接儲存服務，請稍後再試。");
        setIncomeFileUploading(false);
        e.target.value = "";
        return;
      }
      const newUrls: string[] = [];
      const failedFiles: string[] = [];
      for (const file of Array.from(files)) {
        const path = buildStorageObjectKeyWithSanitizedName(`incomes/${projectId}`, file.name);
        const { error } = await supabase.storage.from("income-files").upload(path, file, { upsert: true });
        if (error) {
          failedFiles.push(file.name);
          continue;
        }
        const { data: urlData } = supabase.storage.from("income-files").getPublicUrl(path);
        if (urlData?.publicUrl) newUrls.push(urlData.publicUrl);
      }
      if (failedFiles.length > 0) setIncomeFileError(`以下檔案上傳失敗: ${failedFiles.join(", ")}`);
      if (newUrls.length > 0) {
        setIncomeForm((prev) => {
          const currentUrls = parseFileUrls(prev.pdf_file);
          const finalValue = [...currentUrls, ...newUrls].join(",") || null;
          const next = { ...prev, pdf_file: finalValue };
          incomeFormRef.current = next;
          return next;
        });
      }
    } catch {
      setIncomeFileError("檔案上傳時發生錯誤，請重試。");
    }
    setIncomeFileUploading(false);
    e.target.value = "";
  };

  const removeIncomeFileUrl = (indexToRemove: number) => {
    setIncomeForm((prev) => {
      const urls = parseFileUrls(prev.pdf_file);
      const updated = urls.filter((_, i) => i !== indexToRemove);
      const next = { ...prev, pdf_file: updated.length > 0 ? updated.join(",") : null };
      incomeFormRef.current = next;
      return next;
    });
  };

  const handleExpenseFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setExpenseFileUploading(true);
    setExpenseFileError(null);
    try {
      const bucketReady = await ensureIncomeBucket();
      if (!bucketReady) {
        setExpenseFileError("無法連接儲存服務，請稍後再試。");
        setExpenseFileUploading(false);
        return;
      }
      const uploadedUrls: string[] = [];
      const failedFiles: string[] = [];
      for (const file of Array.from(files)) {
        const filePath = buildStorageObjectKeyWithSanitizedName("expenses", file.name);
        const { error: uploadError } = await supabase.storage.from("income-files").upload(filePath, file, { upsert: true });
        if (uploadError) {
          failedFiles.push(file.name);
          continue;
        }
        const { data: publicUrlData } = supabase.storage.from("income-files").getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) uploadedUrls.push(publicUrlData.publicUrl);
      }
      if (uploadedUrls.length > 0) {
        setExpenseForm((prev) => {
          const existing = prev.pdf_file ? prev.pdf_file.split(",").map((u) => u.trim()).filter(Boolean) : [];
          return { ...prev, pdf_file: [...existing, ...uploadedUrls].join(",") };
        });
      }
      if (failedFiles.length > 0) setExpenseFileError(`以下檔案上傳失敗: ${failedFiles.join(", ")}`);
    } catch (err: unknown) {
      setExpenseFileError(err instanceof Error ? err.message : "上傳失敗");
    }
    setExpenseFileUploading(false);
  };

  const handleExpenseQuotationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setExpenseQuotationUploading(true);
    setExpenseQuotationError(null);
    try {
      const bucketReady = await ensureIncomeBucket();
      if (!bucketReady) {
        setExpenseQuotationError("無法連接儲存服務，請稍後再試。");
        setExpenseQuotationUploading(false);
        return;
      }
      const uploadedUrls: string[] = [];
      const failedFiles: string[] = [];
      for (const file of Array.from(files)) {
        const filePath = buildStorageObjectKeyWithSanitizedName("expenses", file.name);
        const { error: uploadError } = await supabase.storage.from("income-files").upload(filePath, file, { upsert: true });
        if (uploadError) {
          failedFiles.push(file.name);
          continue;
        }
        const { data: publicUrlData } = supabase.storage.from("income-files").getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) uploadedUrls.push(publicUrlData.publicUrl);
      }
      if (uploadedUrls.length > 0) {
        const currentForm = expenseFormRef.current;
        const existing = currentForm.supplier_quotation_file
          ? currentForm.supplier_quotation_file.split(",").map((u) => u.trim()).filter(Boolean)
          : [];
        const combined = [...existing, ...uploadedUrls].join(",");
        setExpenseForm((prev) => ({ ...prev, supplier_quotation_file: combined }));
        if (editingExpense?.id) {
          const persistResult = await updateExpense(
            editingExpense.id,
            { supplier_quotation_file: combined },
            staff?.id
          );
          if (!persistResult.success) {
            setExpenseQuotationError(persistResult.error || "報價單已上傳，但未能寫入支出記錄，請再按更新。");
          }
        }
      }
      if (failedFiles.length > 0) setExpenseQuotationError(`以下檔案上傳失敗: ${failedFiles.join(", ")}`);
    } catch (err: unknown) {
      setExpenseQuotationError(err instanceof Error ? err.message : "上傳失敗");
    }
    setExpenseQuotationUploading(false);
    e.target.value = "";
  };

  const formatShortDate = formatDate;

  const incomeSubmitBlockers = useMemo(
    () =>
      getIncomeSubmitBlockers({
        incomeAmount: incomeForm.income_amount,
        dueDate: incomeForm.due_date,
        expectedPaymentDate: incomeForm.expected_payment_date,
        expiryReasonId: incomeForm.expiry_reason_id,
        paymentStatus: incomeForm.payment_status,
        paymentAmount: incomeForm.payment_amount,
        receiveDate: incomeForm.receive_date,
        paymentMethod: incomeForm.payment_method,
      }),
    [
      incomeForm.income_amount,
      incomeForm.due_date,
      incomeForm.expected_payment_date,
      incomeForm.expiry_reason_id,
      incomeForm.payment_status,
      incomeForm.payment_amount,
      incomeForm.receive_date,
      incomeForm.payment_method,
    ]
  );
  const incomeSaveDisabled =
    incomeSaving || incomeFileUploading || incomeSubmitBlockers.length > 0;

  const expenseSubmitBlockers = useMemo(
    () =>
      getExpenseSubmitBlockers({
        installmentAmount: expenseForm.installment_amount,
        rankReport: expenseForm.rank_report,
        contractTypeId: expenseForm.n_contract_type_id,
        supplierTypeId: expenseForm.n_supplier_type_id,
        payeeMode: expensePayeeMode,
        supplierId: expenseForm.supplier_id,
        factoryId: expenseForm.factory_id,
        dueDate: expenseForm.due_date,
        expectedPaymentDate: expenseForm.expected_payment_date,
        paidAmount: expenseForm.paid_amount,
        isBwfProject,
        expenseAmountCurrency,
        paidAmountCurrency,
        rmbInputAmount,
        rmbPaidInputAmount,
        exchangeRateLoading,
        hasExchangeRate: Boolean(exchangeRate),
        expenseUnlocked,
      }),
    [
      expenseForm.installment_amount,
      expenseForm.rank_report,
      expenseForm.n_contract_type_id,
      expenseForm.n_supplier_type_id,
      expensePayeeMode,
      expenseForm.supplier_id,
      expenseForm.factory_id,
      expenseForm.due_date,
      expenseForm.expected_payment_date,
      expenseForm.paid_amount,
      isBwfProject,
      expenseAmountCurrency,
      paidAmountCurrency,
      rmbInputAmount,
      rmbPaidInputAmount,
      exchangeRateLoading,
      exchangeRate,
      expenseUnlocked,
    ]
  );
  const expenseSaveDisabled =
    expenseSaving || expenseFileUploading || expenseSubmitBlockers.length > 0;

  const incomeGrouped = useMemo(() => {
    const grouped = new Map<string, { name: string; incomes: BWAProjectIncome[]; total: number; paid: number; outstanding: number }>();
    const UNCATEGORIZED_KEY = "__uncategorized__";
    incomes.forEach((inc) => {
      const key = inc.n_contract_type_id || UNCATEGORIZED_KEY;
      if (!grouped.has(key)) {
        grouped.set(key, { name: inc.contract_type_name || "未分類", incomes: [], total: 0, paid: 0, outstanding: 0 });
      }
      const g = grouped.get(key)!;
      g.incomes.push(inc);
      g.total += inc.amount || 0;
      g.paid += inc.payment_amount || 0;
      g.outstanding += incomeNetOutstanding(inc);
    });
    // Expanded list: 到期日 newest → oldest; null/invalid dates last
    for (const g of grouped.values()) {
      g.incomes.sort((a, b) => {
        const aTime = a.due_date ? new Date(a.due_date).getTime() : -Infinity;
        const bTime = b.due_date ? new Date(b.due_date).getTime() : -Infinity;
        const aValid = !isNaN(aTime) ? aTime : -Infinity;
        const bValid = !isNaN(bTime) ? bTime : -Infinity;
        return bValid - aValid;
      });
    }
    return { entries: Array.from(grouped.entries()), uncategorizedKey: UNCATEGORIZED_KEY };
  }, [incomes]);

  const expenseGrouped = useMemo(() => {
    const UNCATEGORIZED_SUPPLIER = "__no_supplier__";
    const UNCATEGORIZED_FACTORY = "__no_factory__";
    const UNCATEGORIZED_CT = "__no_ct__";
    const grouped = new Map<string, {
      payeeName: string;
      contractTypeName: string;
      expenses: BWAProjectExpense[];
      total: number;
      paid: number;
      outstanding: number;
      isFactory: boolean;
      payeeId?: string;
      contractTypeId?: string;
    }>();
    expenses.forEach((exp) => {
      const isFactory = !!exp.factory_id;
      const payeeKey = isFactory ? (exp.factory_id || UNCATEGORIZED_FACTORY) : (exp.supplier_id || UNCATEGORIZED_SUPPLIER);
      const ctKey = exp.n_contract_type_id || UNCATEGORIZED_CT;
      const groupKey = `${isFactory ? "f" : "s"}::${payeeKey}::${ctKey}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          payeeName: isFactory ? (exp.factory_name || "未分類工廠") : (exp.supplier_name || "未分類供應商"),
          contractTypeName: exp.contract_type_name || "未分類合約",
          expenses: [],
          total: 0,
          paid: 0,
          outstanding: 0,
          isFactory,
          payeeId: isFactory ? (exp.factory_id || undefined) : (exp.supplier_id || undefined),
          contractTypeId: exp.n_contract_type_id || undefined,
        });
      }
      const g = grouped.get(groupKey)!;
      g.expenses.push(exp);
      g.total += exp.amount || 0;
      g.paid += exp.paid_amount || 0;
      g.outstanding += exp.outstanding || 0;
    });
    return { entries: Array.from(grouped.entries()), uncategorizedSupplier: UNCATEGORIZED_SUPPLIER, uncategorizedCt: UNCATEGORIZED_CT };
  }, [expenses]);

  const financeDialogs = (
    <>
      <Dialog open={showIncomeDialog} onOpenChange={(open) => { if (!open) closeIncomeDialog(); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>{editingIncome ? "編輯收入" : "新增收入"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">合約類型</label>
                <Select
                  value={incomeForm.n_contract_type_id || ""}
                  onValueChange={(val) => {
                    const newCtId = val || null;
                    setIncomeForm((prev) => !editingIncome ? { ...prev, n_contract_type_id: newCtId, invoice_number: getNextInstallmentNumber(newCtId) } : { ...prev, n_contract_type_id: newCtId });
                  }}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="選擇合約類型" /></SelectTrigger>
                  <SelectContent>{contractTypes.map((ct) => (<SelectItem key={ct.id} value={ct.id}>{ct.chinese_display || ct.display}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">款項期數</label>
                <Input value={incomeForm.invoice_number || ""} onChange={(e) => setIncomeForm((prev) => ({ ...prev, invoice_number: e.target.value || null }))} className="h-9 text-sm" disabled={!canEditInstallmentNumber} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">收入金額 <span className="text-red-500">*</span></label>
                <Input
                  type="number"
                  value={incomeForm.income_amount ?? ""}
                  onChange={(e) => {
                    const val = e.target.value ? parseFloat(e.target.value) : null;
                    setIncomeForm((prev) => ({ ...prev, income_amount: val, outstanding: val != null ? val - (prev.payment_amount || 0) : null }));
                  }}
                  className={cn(
                    "h-9 text-sm",
                    incomeAmountBelowEstimated && !hasPersistedIncomeBelowReason && "border-amber-500 focus-visible:ring-amber-500"
                  )}
                />
                {incomeAmountBelowEstimated && !hasPersistedIncomeBelowReason && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    項目收入總額少於預計收入 {formatMoney(data.estimated_income)}，提交時需填寫原因
                  </p>
                )}
              </div>
              <IncomePaymentStatusField
                value={incomeForm.payment_status}
                isAdmin={isAdminOrAbove}
                showZohoCompleted={isBwfProject}
                required={incomeForm.payment_amount != null}
                error={incomeStatusError}
                onChange={(val) => {
                  setIncomeStatusError(null);
                  setIncomeForm((prev) => ({
                    ...prev,
                    payment_status: val,
                    ...(isIncomeSettled(val)
                      ? { expected_payment_date: null, expiry_reason_id: null }
                      : {}),
                  }));
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">到期日 <span className="text-red-500">*</span></label>
                <Input
                  type="date"
                  value={incomeForm.due_date || ""}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    setIncomeForm((prev) => ({
                      ...prev,
                      due_date: val,
                      expiry_reason_id: isDueDateExpired(val) ? prev.expiry_reason_id : null,
                    }));
                  }}
                  className="h-9 text-sm"
                  disabled={isDueDateLocked(editingIncome?.due_date)}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  {isDueDateLocked(editingIncome?.due_date)
                    ? "建立記錄後將無法變更"
                    : "空白記錄可補填，填寫後將無法變更"}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">
                  預計付款日期
                  {isExpectedPaymentDateRequired(incomeForm.due_date, undefined, incomeForm.payment_status) && <span className="text-red-500"> *</span>}
                </label>
                <Input
                  type="date"
                  value={incomeForm.expected_payment_date || ""}
                  onChange={(e) => setIncomeForm((prev) => ({ ...prev, expected_payment_date: e.target.value || null }))}
                  className="h-9 text-sm"
                />
                {isExpectedPaymentDateRequired(incomeForm.due_date, undefined, incomeForm.payment_status) && !incomeForm.expected_payment_date && (
                  <p className="text-[11px] text-red-500 mt-1">到期日已過，請填寫預計付款日期</p>
                )}
              </div>
            </div>
            <IncomeCollectionSituationField
              key={`${showIncomeDialog}-${editingIncome?.id ?? "new"}`}
              dueDate={incomeForm.due_date}
              expectedPaymentDate={incomeForm.expected_payment_date}
            />
            <IncomeExpiryReasonField
              dueDate={incomeForm.due_date}
              value={incomeForm.expiry_reason_id}
              required={!isIncomeSettled(incomeForm.payment_status)}
              onChange={(id) => setIncomeForm((prev) => ({ ...prev, expiry_reason_id: id }))}
            />
            {isAoContractType(contractTypes, incomeForm.n_contract_type_id) && (
              <IncomeAOFields
                value={incomeForm}
                onChange={(patch) => setIncomeForm((prev) => ({ ...prev, ...patch }))}
              />
            )}
            <div className="rounded-lg border border-gray-200 bg-gray-50/30 p-4 space-y-3">
              <p className="text-[13px] font-medium text-gray-500 mb-2">完成收款時填寫</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] text-gray-500 mb-1 block">已收金額</label>
                  <Input type="number" placeholder="0.00" value={incomeForm.payment_amount ?? ""} onChange={(e) => { const val = e.target.value ? parseFloat(e.target.value) : null; setIncomeForm((prev) => ({ ...prev, payment_amount: val, outstanding: (prev.income_amount || 0) - (val || 0) })); }} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-[13px] text-gray-500 mb-1 block">
                    收款日期
                    {incomeForm.payment_amount != null && <span className="text-red-500"> *</span>}
                  </label>
                  <Input type="date" value={incomeForm.receive_date || ""} onChange={(e) => setIncomeForm((prev) => ({ ...prev, receive_date: e.target.value || null }))} className="h-8 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[13px] text-gray-500 mb-1 block">
                  付款方式
                  {incomeForm.payment_amount != null && <span className="text-red-500"> *</span>}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(
                      "rounded-full px-3 py-1 text-[13px] border transition-all",
                      !incomeForm.payment_method
                        ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    )}
                    onClick={() => setIncomeForm((prev) => ({ ...prev, payment_method: null }))}
                  >
                    未選擇
                  </button>
                  {paymentMethods.map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      className={cn(
                        "rounded-full px-3 py-1 text-[13px] border transition-all",
                        incomeForm.payment_method === pm.display
                          ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      )}
                      onClick={() => setIncomeForm((prev) => ({ ...prev, payment_method: pm.display }))}
                    >
                      {pm.display}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {isAdminOrAbove && (
              <IncomeBadDebtsField
                value={incomeForm.bad_debts}
                onChange={(val) => setIncomeForm((prev) => ({ ...prev, bad_debts: val }))}
              />
            )}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">備註</label>
              <Textarea
                placeholder="輸入備註..."
                value={incomeForm.remark || ""}
                onChange={(e) => setIncomeForm((prev) => ({ ...prev, remark: e.target.value || null }))}
                className="text-sm min-h-[72px] resize-y"
                rows={3}
              />
            </div>
            {hasPersistedIncomeBelowReason && (
              <IncomeBelowEstimatedReasonField
                value={incomeBelowReason}
                onChange={(val) => {
                  setIncomeBelowReason(val);
                  setIncomeBelowReasonError(null);
                }}
                error={incomeBelowReasonError}
                required
              />
            )}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">附件</label>
              {incomeFileError && <p className="text-red-500 text-sm mb-1">{incomeFileError}</p>}
              {parseFileUrls(incomeForm.pdf_file).map((url, fi) => (
                <div key={fi} className="flex gap-2 items-center mb-1">
                  <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm truncate">{getFileName(url)}</a>
                  <button type="button" onClick={() => removeIncomeFileUrl(fi)}><X className="w-3 h-3" /></button>
                </div>
              ))}
              <label className="block border border-dashed rounded p-3 text-center cursor-pointer text-sm text-gray-500">
                {incomeFileUploading ? "上傳中..." : "點擊上傳檔案"}
                <input type="file" multiple className="hidden" onChange={handleIncomeFileUpload} disabled={incomeFileUploading} />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeIncomeDialog}>取消</Button>
            <DisabledSubmitControl
              key={`${showIncomeDialog}-${editingIncome?.id ?? "new"}`}
              blocked={incomeSaveDisabled}
              busy={incomeSaving || incomeFileUploading}
              reasons={incomeSubmitBlockers}
            >
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600"
                disabled={incomeSaveDisabled}
                onClick={handleSaveIncome}
              >
                {editingIncome ? "更新" : "新增"}
              </Button>
            </DisabledSubmitControl>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExpenseDialog} onOpenChange={(open) => { if (!open) closeExpenseDialog(); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader><DialogTitle>{editingExpense ? "編輯支出" : expensePayeeMode === "factory" ? "新增工廠支出" : "新增支出"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            {isBwfProject && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={expensePayeeMode === "supplier" ? "default" : "outline"}
                  className={cn(expensePayeeMode === "supplier" && "bg-red-500 hover:bg-red-600")}
                  onClick={() => handleExpensePayeeModeChange("supplier")}
                >
                  供應商
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={expensePayeeMode === "factory" ? "default" : "outline"}
                  onClick={() => handleExpensePayeeModeChange("factory")}
                >
                  工廠
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs mb-1 block">款項期數 <span className="text-red-500">*</span></label><Input value={expenseForm.rank_report ?? ""} onChange={(e) => setExpenseForm((prev) => ({ ...prev, rank_report: e.target.value || null }))} disabled={!editingExpense && !canEditInstallmentNumber} className="h-8 text-sm" /></div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs block">支出金額 <span className="text-red-500">*</span></label>
                  {isBwfProject && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] border",
                          expenseAmountCurrency === "HKD"
                            ? "border-blue-400 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-500",
                        )}
                        onClick={() => {
                          setExpenseAmountCurrency("HKD");
                          setRmbInputAmount(null);
                          if (paidAmountCurrency !== "RMB") setExchangeRateError(null);
                        }}
                      >
                        HKD$
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] border",
                          expenseAmountCurrency === "RMB"
                            ? "border-blue-400 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-500",
                        )}
                        onClick={() => {
                          setExpenseAmountCurrency("RMB");
                          setExpenseForm((prev) => ({ ...prev, installment_amount: null }));
                        }}
                      >
                        RMB¥
                      </button>
                    </div>
                  )}
                </div>
                {isBwfProject && expenseAmountCurrency === "RMB" ? (
                  <div className="space-y-1">
                    <Input
                      type="number"
                      value={rmbInputAmount ?? ""}
                      onChange={(e) => {
                        const val = e.target.value ? parseFloat(e.target.value) : null;
                        setRmbInputAmount(val);
                        setExpenseSupplierDocError(null);
                      }}
                      className="h-8 text-sm"
                      placeholder="人民幣金額"
                    />
                    {exchangeRateLoading ? (
                      <p className="text-[11px] text-gray-500">匯率載入中…</p>
                    ) : exchangeRateError ? (
                      <p className="text-[11px] text-red-500">{exchangeRateError}</p>
                    ) : exchangeRate && rmbInputAmount ? (
                      <p className="text-[11px] text-gray-600">
                        ≈ {formatMoney2(expenseForm.installment_amount)}（匯率 {exchangeRate.rate.toFixed(4)}，{exchangeRate.rateDate}）
                      </p>
                    ) : exchangeRate ? (
                      <p className="text-[11px] text-gray-500">
                        匯率 {exchangeRate.rate.toFixed(4)}（{exchangeRate.rateDate}）
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <Input
                    type="number"
                    value={expenseForm.installment_amount ?? ""}
                    onChange={(e) => {
                      setExpenseForm((prev) => ({
                        ...prev,
                        installment_amount: e.target.value ? parseFloat(e.target.value) : null,
                      }));
                      setExpenseSupplierDocError(null);
                    }}
                    className="h-8 text-sm"
                  />
                )}
              </div>
            </div>
            <ExpensePaymentStatusField
              value={expenseForm.payment_status}
              isAdmin={isAdminOrAbove}
              showZohoCompleted={isBwfProject}
              required={expenseForm.paid_amount != null}
              error={expenseStatusError}
              onChange={(val) => {
                setExpenseStatusError(null);
                setExpenseForm((prev) => ({ ...prev, payment_status: val }));
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1 block">到期日 <span className="text-red-500">*</span></label>
                <Input
                  type="date"
                  value={expenseForm.due_date ?? ""}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    setExpenseForm((prev) => ({
                      ...prev,
                      due_date: val,
                    }));
                  }}
                  className="h-8 text-sm"
                  disabled={isDueDateLocked(editingExpense?.due_date)}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  {isDueDateLocked(editingExpense?.due_date)
                    ? "建立記錄後將無法變更"
                    : "空白記錄可補填，填寫後將無法變更"}
                </p>
              </div>
              <div>
                <label className="text-xs mb-1 block">
                  預計付款日期
                  {isExpectedPaymentDateRequired(expenseForm.due_date) && <span className="text-red-500"> *</span>}
                </label>
                <Input
                  type="date"
                  value={expenseForm.expected_payment_date ?? ""}
                  onChange={(e) =>
                    setExpenseForm((prev) => ({ ...prev, expected_payment_date: e.target.value || null }))
                  }
                  className="h-8 text-sm"
                />
                {isExpectedPaymentDateRequired(expenseForm.due_date) && !expenseForm.expected_payment_date && (
                  <p className="text-[11px] text-red-500 mt-1">到期日已過，請填寫預計付款日期</p>
                )}
              </div>
            </div>
            {expensePayeeMode === "supplier" && expenseGroupRulesEnabled && (
              <ExpenseAmountRulesBox
                evaluation={expenseGroupRules}
                hasQuotation={expenseGroupHasQuotation}
                supplierId={expenseForm.supplier_id}
                eligibility={supplierDocEligibility}
                eligibilityLoading={supplierDocEligibilityLoading}
                formatMoney={(amount) => formatMoney(amount)}
                contractTypeLabel={
                  contractTypes.find((ct) => ct.id === expenseForm.n_contract_type_id)
                    ?.chinese_display ||
                  contractTypes.find((ct) => ct.id === expenseForm.n_contract_type_id)?.display
                }
              />
            )}
            <div><label className="text-xs mb-1 block">合約類型 <span className="text-red-500">*</span></label><Select value={expenseForm.n_contract_type_id || "__none__"} onValueChange={(val) => { const newCtId = val === "__none__" ? null : val; setExpenseForm((prev) => { if (!editingExpense) { const matching = expenses.filter((e) => (expensePayeeMode === "factory" ? (prev.factory_id ? e.factory_id === prev.factory_id : !e.factory_id) : (prev.supplier_id ? e.supplier_id === prev.supplier_id : !e.supplier_id)) && (newCtId ? e.n_contract_type_id === newCtId : !e.n_contract_type_id)); return { ...prev, n_contract_type_id: newCtId, rank_report: String(matching.length + 1) }; } return { ...prev, n_contract_type_id: newCtId }; }); }}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="選擇合約類型" /></SelectTrigger><SelectContent><SelectItem value="__none__">未選擇</SelectItem>{contractTypes.map((ct) => (<SelectItem key={ct.id} value={ct.id}>{ct.chinese_display || ct.display}</SelectItem>))}</SelectContent></Select></div>
            {expensePayeeMode === "factory" ? (
              <div ref={factoryPanelRef}>
                <label className="text-xs mb-1 block">工廠 <span className="text-red-500">*</span></label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-8 justify-between text-sm font-normal px-3 overflow-hidden"
                  onClick={() => {
                    setFactorySearchOpen((prev) => !prev);
                    if (!factorySearchOpen) setFactorySearchQuery("");
                  }}
                >
                  {expenseForm.factory_id
                    ? (() => {
                        const found = factoryOptionsList.find((f) => f.id === expenseForm.factory_id);
                        return found ? (
                          <span className="truncate">
                            {found.label}
                            {found.sublabel ? (
                              <span className="text-[12px] text-gray-400 ml-1">({found.sublabel})</span>
                            ) : null}
                          </span>
                        ) : (
                          "選擇工廠"
                        );
                      })()
                    : (
                      <span className="text-muted-foreground">選擇工廠</span>
                    )}
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
                {factorySearchOpen && (
                  <div className="mt-1 border rounded-md bg-white shadow-md w-full overflow-hidden max-w-full">
                    <div className="flex items-center border-b px-3 min-w-0">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <input
                        className="flex h-9 w-full min-w-0 rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="搜尋工廠名稱..."
                        value={factorySearchQuery}
                        onChange={(e) => {
                          e.stopPropagation();
                          setFactorySearchQuery(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      {factorySearchQuery && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFactorySearchQuery("");
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="max-h-52 overflow-y-auto overflow-x-hidden overscroll-contain p-1">
                      <div
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setExpenseForm((prev) => ({ ...prev, factory_id: null }));
                          setFactorySearchOpen(false);
                          setFactorySearchQuery("");
                        }}
                      >
                        <Check className={cn("mr-2 h-3.5 w-3.5", !expenseForm.factory_id ? "opacity-100" : "opacity-0")} />
                        未選擇
                      </div>
                      {factoryOptionsList
                        .filter((f) => {
                          if (!factorySearchQuery) return true;
                          const q = factorySearchQuery.toLowerCase();
                          return (
                            (f.label || "").toLowerCase().includes(q) ||
                            (f.sublabel || "").toLowerCase().includes(q) ||
                            (f.searchText || "").toLowerCase().includes(q)
                          );
                        })
                        .map((f) => (
                          <div
                            key={f.id}
                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground overflow-hidden min-w-0"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpenseForm((prev) => {
                                if (!editingExpense) {
                                  const matching = expenses.filter(
                                    (ex) =>
                                      ex.factory_id === f.id &&
                                      (prev.n_contract_type_id
                                        ? ex.n_contract_type_id === prev.n_contract_type_id
                                        : !ex.n_contract_type_id),
                                  );
                                  return {
                                    ...prev,
                                    factory_id: f.id,
                                    rank_report: String(matching.length + 1),
                                  };
                                }
                                return { ...prev, factory_id: f.id };
                              });
                              setFactorySearchOpen(false);
                              setFactorySearchQuery("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5 shrink-0",
                                expenseForm.factory_id === f.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate min-w-0">{f.label}</span>
                            {f.sublabel && (
                              <span className="text-[12px] text-gray-400 ml-1 truncate min-w-0 max-w-[40%]">
                                ({f.sublabel})
                              </span>
                            )}
                          </div>
                        ))}
                      {factoryOptionsList.filter((f) => {
                        if (!factorySearchQuery) return true;
                        const q = factorySearchQuery.toLowerCase();
                        return (
                          (f.label || "").toLowerCase().includes(q) ||
                          (f.sublabel || "").toLowerCase().includes(q) ||
                          (f.searchText || "").toLowerCase().includes(q)
                        );
                      }).length === 0 &&
                        factorySearchQuery && (
                          <div className="py-4 text-center text-sm text-muted-foreground">
                            找不到「{factorySearchQuery}」的工廠
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div ref={supplierPanelRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs block">供應商 <span className="text-red-500">*</span></label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors"
                    onClick={() => setQuickAddSupplierOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    快速新增
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-8 justify-between text-sm font-normal px-3 overflow-hidden"
                  onClick={() => {
                    setSupplierSearchOpen((prev) => !prev);
                    if (!supplierSearchOpen) setSupplierSearchQuery("");
                  }}
                >
                  {expenseForm.supplier_id
                    ? (() => {
                        const found = supplierOptionsList.find((s) => s.id === expenseForm.supplier_id);
                        return found ? (
                          <span className="truncate">
                            {found.label}
                            {found.sublabel ? (
                              <span className="text-[12px] text-gray-400 ml-1">({found.sublabel})</span>
                            ) : null}
                          </span>
                        ) : (
                          "選擇供應商"
                        );
                      })()
                    : (
                      <span className="text-muted-foreground">選擇供應商</span>
                    )}
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
                {supplierSearchOpen && (
                  <div className="mt-1 border rounded-md bg-white shadow-md w-full overflow-hidden max-w-full">
                    <div className="flex items-center border-b px-3 min-w-0">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <input
                        className="flex h-9 w-full min-w-0 rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="搜尋名稱/電話/Email/專業技能..."
                        value={supplierSearchQuery}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSupplierSearchQuery(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      {supplierSearchQuery && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSupplierSearchQuery("");
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="max-h-52 overflow-y-auto overflow-x-hidden overscroll-contain p-1">
                      <div
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setExpenseForm((prev) => ({ ...prev, supplier_id: null }));
                          setSupplierSearchOpen(false);
                          setSupplierSearchQuery("");
                        }}
                      >
                        <Check className={cn("mr-2 h-3.5 w-3.5", !expenseForm.supplier_id ? "opacity-100" : "opacity-0")} />
                        未選擇
                      </div>
                      {expenseSupplierOptionsForDropdown
                        .filter((s) => {
                          if (!supplierSearchQuery) return true;
                          const q = supplierSearchQuery.toLowerCase();
                          return (
                            (s.label || "").toLowerCase().includes(q) ||
                            (s.sublabel || "").toLowerCase().includes(q) ||
                            (s.searchText || "").toLowerCase().includes(q)
                          );
                        })
                        .map((s) => (
                          <div
                            key={s.id}
                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground overflow-hidden min-w-0"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpenseForm((prev) => {
                                if (!editingExpense) {
                                  const matching = expenses.filter(
                                    (ex) =>
                                      ex.supplier_id === s.id &&
                                      (prev.n_contract_type_id
                                        ? ex.n_contract_type_id === prev.n_contract_type_id
                                        : !ex.n_contract_type_id),
                                  );
                                  return {
                                    ...prev,
                                    supplier_id: s.id,
                                    rank_report: String(matching.length + 1),
                                  };
                                }
                                return { ...prev, supplier_id: s.id };
                              });
                              setSupplierSearchOpen(false);
                              setSupplierSearchQuery("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5 shrink-0",
                                expenseForm.supplier_id === s.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate min-w-0">{s.label}</span>
                            {s.sublabel && (
                              <span className="text-[12px] text-gray-400 ml-1 truncate min-w-0 max-w-[40%]">
                                ({s.sublabel})
                              </span>
                            )}
                          </div>
                        ))}
                      {expenseSupplierOptionsForDropdown.filter((s) => {
                        if (!supplierSearchQuery) return true;
                        const q = supplierSearchQuery.toLowerCase();
                        return (
                          (s.label || "").toLowerCase().includes(q) ||
                          (s.sublabel || "").toLowerCase().includes(q) ||
                          (s.searchText || "").toLowerCase().includes(q)
                        );
                      }).length === 0 &&
                        supplierSearchQuery && (
                          <div className="py-4 text-center text-sm text-muted-foreground">
                            找不到「{supplierSearchQuery}」的供應商
                          </div>
                        )}
                    </div>
                  </div>
                )}
                {expenseSupplierDocError && (
                  <p className="text-red-500 text-xs mt-1">{expenseSupplierDocError}</p>
                )}
                <SupplierEditDialog
                  open={quickAddSupplierOpen}
                  onOpenChange={setQuickAddSupplierOpen}
                  supplier={null}
                  onSaved={(_id, created) => {
                    if (!created) return;
                    setSupplierOptionsList((prev) => {
                      if (prev.some((s) => s.id === created.id)) return prev;
                      return [{ id: created.id, label: created.label }, ...prev];
                    });
                    setExpenseForm((prev) => {
                      if (!editingExpense) {
                        const matching = expenses.filter(
                          (ex) =>
                            ex.supplier_id === created.id &&
                            (prev.n_contract_type_id
                              ? ex.n_contract_type_id === prev.n_contract_type_id
                              : !ex.n_contract_type_id),
                        );
                        return {
                          ...prev,
                          supplier_id: created.id,
                          factory_id: null,
                          rank_report: String(matching.length + 1),
                        };
                      }
                      return { ...prev, supplier_id: created.id, factory_id: null };
                    });
                    setExpensePayeeMode("supplier");
                    setSupplierSearchOpen(false);
                    setSupplierSearchQuery("");
                  }}
                />
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs block">支出分類 <span className="text-red-500">*</span></label>
                {isBwfProject && (
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setShowAllExpenseCategories((prev) => !prev)}
                  >
                    {showAllExpenseCategories ? "只顯示 BWF" : "顯示全部"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {expenseCategoryOptions.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className={cn(
                      "rounded border px-2 py-1 text-xs truncate",
                      expenseForm.n_supplier_type_id === st.id
                        ? "border-blue-400 bg-blue-50 text-blue-700"
                        : "border-gray-200",
                    )}
                    onClick={() =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        n_supplier_type_id: prev.n_supplier_type_id === st.id ? null : st.id,
                      }))
                    }
                  >
                    {st.chinese_display || st.display}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs block">已付金額</label>
                  {isBwfProject && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] border",
                          paidAmountCurrency === "HKD"
                            ? "border-blue-400 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-500",
                        )}
                        onClick={() => {
                          setPaidAmountCurrency("HKD");
                          setRmbPaidInputAmount(null);
                          if (expenseAmountCurrency !== "RMB") setExchangeRateError(null);
                        }}
                      >
                        HKD$
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] border",
                          paidAmountCurrency === "RMB"
                            ? "border-blue-400 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-500",
                        )}
                        onClick={() => {
                          setPaidAmountCurrency("RMB");
                          setExpenseForm((prev) => ({ ...prev, paid_amount: null }));
                        }}
                      >
                        RMB¥
                      </button>
                    </div>
                  )}
                </div>
                {isBwfProject && paidAmountCurrency === "RMB" ? (
                  <div className="space-y-1">
                    <Input
                      type="number"
                      value={rmbPaidInputAmount ?? ""}
                      onChange={(e) => {
                        const val = e.target.value ? parseFloat(e.target.value) : null;
                        setRmbPaidInputAmount(val);
                        if (val == null) {
                          setExpenseForm((prev) => ({ ...prev, paid_amount: null }));
                        }
                      }}
                      className={cn(
                        "h-8 text-sm",
                        paidExceedsInstallment(expenseForm.paid_amount, expenseForm.installment_amount) &&
                          "border-red-500 focus-visible:ring-red-500"
                      )}
                      aria-invalid={paidExceedsInstallment(expenseForm.paid_amount, expenseForm.installment_amount)}
                      placeholder="人民幣金額"
                    />
                    {exchangeRateLoading ? (
                      <p className="text-[11px] text-gray-500">匯率載入中…</p>
                    ) : exchangeRateError ? (
                      <p className="text-[11px] text-red-500">{exchangeRateError}</p>
                    ) : exchangeRate && rmbPaidInputAmount ? (
                      <p className="text-[11px] text-gray-600">
                        ≈ {formatMoney2(expenseForm.paid_amount)}（匯率 {exchangeRate.rate.toFixed(4)}，{exchangeRate.rateDate}）
                      </p>
                    ) : exchangeRate ? (
                      <p className="text-[11px] text-gray-500">
                        匯率 {exchangeRate.rate.toFixed(4)}（{exchangeRate.rateDate}）
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <Input
                    type="number"
                    value={expenseForm.paid_amount ?? ""}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        paid_amount: e.target.value ? parseFloat(e.target.value) : null,
                      }))
                    }
                    className={cn(
                      "h-8 text-sm",
                      paidExceedsInstallment(expenseForm.paid_amount, expenseForm.installment_amount) &&
                        "border-red-500 focus-visible:ring-red-500"
                    )}
                    aria-invalid={paidExceedsInstallment(expenseForm.paid_amount, expenseForm.installment_amount)}
                  />
                )}
                {paidExceedsInstallment(expenseForm.paid_amount, expenseForm.installment_amount) && (
                  <p className="text-[11px] text-red-500 mt-1">已付金額不可大於支出金額</p>
                )}
              </div>
              <div>
                <label className="text-xs mb-1 block">付款日期</label>
                <Input
                  type="date"
                  value={expenseForm.payment_date ?? ""}
                  onChange={(e) =>
                    setExpenseForm((prev) => ({ ...prev, payment_date: e.target.value || null }))
                  }
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div><label className="text-xs mb-1 block">付款方式</label><div className="flex flex-wrap gap-2"><button type="button" className={cn("rounded-full px-3 py-1 text-xs border", !expenseForm.payment_method_id ? "border-blue-400 bg-blue-50" : "border-gray-200")} onClick={() => setExpenseForm((prev) => ({ ...prev, payment_method_id: null }))}>未選擇</button>{paymentMethods.map((pm) => (<button key={pm.id} type="button" className={cn("rounded-full px-3 py-1 text-xs border", expenseForm.payment_method_id === pm.id ? "border-blue-400 bg-blue-50" : "border-gray-200")} onClick={() => setExpenseForm((prev) => ({ ...prev, payment_method_id: pm.id }))}>{pm.display}</button>))}</div></div>
            {expensePayeeMode === "supplier" && (
              <div>
                <label className="text-xs mb-1 block">
                  供應商報價單
                  {expenseAmountRules.quotationRequired && !expenseGroupHasQuotation ? (
                    <span className="text-red-500"> *</span>
                  ) : (
                    ""
                  )}
                </label>
                {expenseForm.supplier_quotation_file && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {parseExpenseFileUrls(expenseForm.supplier_quotation_file).map((url, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-[12px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600"
                      >
                        <Paperclip className="w-3 h-3" />
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline max-w-[180px] truncate"
                          title={getFileName(url)}
                        >
                          {getFileName(url)}
                        </a>
                        <button
                          type="button"
                          className="text-red-400 hover:text-red-600 ml-0.5"
                          onClick={() => {
                            const urls = parseExpenseFileUrls(expenseForm.supplier_quotation_file);
                            urls.splice(i, 1);
                            setExpenseForm((prev) => ({
                              ...prev,
                              supplier_quotation_file: urls.length > 0 ? urls.join(",") : null,
                            }));
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {!expenseForm.supplier_quotation_file && expenseGroupHasQuotation && (
                  <p className="text-[12px] text-emerald-600 mb-1">
                    此群組其他支出已有供應商報價單（全組只需一份）
                  </p>
                )}
                <label className="inline-flex border border-dashed rounded px-3 py-1.5 text-xs cursor-pointer">
                  {expenseQuotationUploading ? "上傳中..." : "選擇檔案"}
                  <input type="file" multiple className="hidden" onChange={handleExpenseQuotationUpload} />
                </label>
                {expenseQuotationError && <p className="text-red-500 text-xs">{expenseQuotationError}</p>}
              </div>
            )}
            <div>
              <label className="text-xs mb-1 block">附件</label>
              {expenseForm.pdf_file && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {parseFileUrls(expenseForm.pdf_file).map((url, fi) => (
                    <div key={fi} className="flex gap-2 items-center">
                      <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs truncate max-w-[180px]">
                        {getFileName(url)}
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          const urls = parseFileUrls(expenseForm.pdf_file);
                          urls.splice(fi, 1);
                          setExpenseForm((prev) => ({
                            ...prev,
                            pdf_file: urls.length > 0 ? urls.join(",") : null,
                          }));
                        }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="inline-flex border border-dashed rounded px-3 py-1.5 text-xs cursor-pointer">
                {expenseFileUploading ? "上傳中..." : "選擇檔案"}
                <input type="file" multiple className="hidden" onChange={handleExpenseFileUpload} />
              </label>
              {expenseFileError && <p className="text-red-500 text-xs">{expenseFileError}</p>}
            </div>
            <div><label className="text-xs mb-1 block">備註</label><Textarea value={expenseForm.remark_t ?? ""} onChange={(e) => setExpenseForm((prev) => ({ ...prev, remark_t: e.target.value || null }))} className="text-sm min-h-[60px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeExpenseDialog}>取消</Button>
            <DisabledSubmitControl
              key={`${showExpenseDialog}-${editingExpense?.id ?? "new"}-${expensePayeeMode}`}
              blocked={expenseSaveDisabled}
              busy={expenseSaving || expenseFileUploading}
              reasons={expenseSubmitBlockers}
            >
              <Button size="sm" className="bg-red-500 hover:bg-red-600" disabled={expenseSaveDisabled} onClick={handleSaveExpense}>{editingExpense ? "更新" : "新增"}</Button>
            </DisabledSubmitControl>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <IncomeBelowEstimatedReasonDialog
        open={showBelowReasonDialog}
        onOpenChange={setShowBelowReasonDialog}
        estimatedLabel={formatMoney(data.estimated_income)}
        value={belowReasonDraft}
        error={belowReasonDialogError}
        onChange={(val) => {
          setBelowReasonDraft(val);
          setBelowReasonDialogError(null);
        }}
        onConfirm={handleConfirmBelowReason}
      />
      <IncomeDeleteBlockedDialog
        open={deleteIncomeBlockedOpen}
        onOpenChange={setDeleteIncomeBlockedOpen}
        estimatedLabel={formatMoney(data.estimated_income)}
      />
      <AlertDialog open={!!confirmDeleteIncomeId} onOpenChange={() => setConfirmDeleteIncomeId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>確認刪除收入</AlertDialogTitle><AlertDialogDescription>確定要刪除此收入記錄嗎？此操作無法復原。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteIncome}>刪除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <ExpenseOutstandingSplitDialog
        open={showExpenseOutstandingSplit}
        outstandingAmount={outstandingAmount(expenseForm.installment_amount, expenseForm.paid_amount)}
        defaultExpectedPaymentDate={expenseForm.expected_payment_date}
        saving={expenseSaving}
        onOpenChange={setShowExpenseOutstandingSplit}
        onStay={() => { void persistExpense("stay"); }}
        onSplit={(childExpectedPaymentDate) => { void persistExpense("split", childExpectedPaymentDate); }}
      />
      <AlertDialog open={!!confirmDeleteExpenseId} onOpenChange={() => setConfirmDeleteExpenseId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>確認刪除支出</AlertDialogTitle><AlertDialogDescription>確定要刪除此支出記錄嗎？此操作無法復原。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteExpense}>刪除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );

  if (view === "overview-income") {
    return (<>{incomes.length === 0 ? <p className="text-gray-400 text-center py-4">暫無記錄</p> : <div className="max-h-[320px] overflow-auto"><Table><TableHeader className="sticky top-0 bg-white z-10"><TableRow><TableHead>類型</TableHead><TableHead>收入金額</TableHead><TableHead className="text-right">已收金額</TableHead><TableHead className="text-center">收款狀態</TableHead><TableHead className="text-center">操作</TableHead></TableRow></TableHeader><TableBody>{incomes.map((income) => {
      const ctName = income.contract_type_name || income.type_display || "-";
      const hash = income.invoice_number || "-";
      return (
        <TableRow key={income.id}>
          <TableCell className="whitespace-nowrap">{`${ctName} #${hash}`}</TableCell>
          <TableCell className="font-mono">{formatMoney(income.amount)}</TableCell>
          <TableCell className="text-right font-mono">{formatMoney(income.payment_amount)}</TableCell>
          <TableCell className="text-center">{paidStatusBadge(income)}</TableCell>
          <TableCell className="text-center">{canEditIncome && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditIncome(income)}><Pencil className="w-3.5 h-3.5" /></Button>}</TableCell>
        </TableRow>
      );
    })}</TableBody></Table></div>}{incomes.length > 0 && onViewAll && <button className="text-blue-600 text-sm mt-2" onClick={() => onViewAll("income")}>查看全部 {incomes.length} 筆</button>}{financeDialogs}</>);
  }

  if (view === "overview-expense") {
    const groupedEntries = expenseGrouped.entries;
    return (<>{groupedEntries.length === 0 ? <p className="text-gray-400 text-center py-4">暫無記錄</p> : <div className="max-h-[320px] overflow-auto"><Table><TableHeader className="sticky top-0 bg-white z-10"><TableRow><TableHead>類型</TableHead><TableHead>供應商/工廠</TableHead><TableHead>支出金額</TableHead><TableHead className="text-right">已付金額</TableHead><TableHead className="text-center">付款狀態</TableHead><TableHead className="text-center">操作</TableHead></TableRow></TableHeader><TableBody>{groupedEntries.map(([groupKey, group]) => {
      const representative = group.expenses[0];
      return (
        <TableRow key={groupKey}>
          <TableCell>{group.contractTypeName}</TableCell>
          <TableCell>{group.payeeName}</TableCell>
          <TableCell className="font-mono">{formatMoney(group.total)}</TableCell>
          <TableCell className="text-right font-mono">{formatMoney(group.paid)}</TableCell>
          <TableCell className="text-center">{expensePaidBadge({ amount: group.total, paid_amount: group.paid })}</TableCell>
          <TableCell className="text-center">{canEditExpense && representative && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditExpense(representative)}><Pencil className="w-3.5 h-3.5" /></Button>}</TableCell>
        </TableRow>
      );
    })}</TableBody></Table></div>}{expenses.length > 0 && onViewAll && <button className="text-blue-600 text-sm mt-2" onClick={() => onViewAll("expense")}>查看全部 {expenses.length} 筆</button>}{financeDialogs}</>);
  }

  if (view === "income") {
    const { entries: groupEntries, uncategorizedKey } = incomeGrouped;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="預計收入 Estimated" value={formatMoney(data.estimated_income)} icon={TrendingUp} accentColor="bg-blue-500" />
          <MetricCard label="實際收入 Actual" value={formatMoney(totalIncome)} subtext={`${incomes.length} 筆收入`} icon={ArrowDownCircle} accentColor="bg-emerald-500" />
          <MetricCard label="已收款 Paid" value={formatMoney(incomes.reduce((s, i) => s + (i.payment_amount || 0), 0))} icon={CheckCircle2} accentColor="bg-violet-500" />
          <MetricCard label="待收款 Outstanding" value={formatMoney(incomes.reduce((s, i) => s + incomeNetOutstanding(i), 0))} icon={AlertTriangle} accentColor="bg-red-500" />
        </div>

        <SectionCard title={`合約類型分組 (${groupEntries.length} 類)`} icon={Receipt} iconColor="text-emerald-500">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400">按合約類型分組顯示收入，點擊展開查看明細</p>
            {canCreateIncome && (
              <Button size="sm" className="h-8 gap-1.5 text-[14px] bg-emerald-500 hover:bg-emerald-600" onClick={() => openCreateIncome()}>
                <Plus className="w-3.5 h-3.5" /> 新增收入
              </Button>
            )}
          </div>

          {groupEntries.length > 0 ? (
            <div className="space-y-2">
              {groupEntries.map(([ctId, group]) => {
                const isExpanded = expandedContractType === ctId;
                const collectionRatio = group.total > 0 ? Math.round((group.paid / group.total) * 100) : 0;
                const barColor =
                  collectionRatio >= 100
                    ? "bg-emerald-500"
                    : collectionRatio >= 50
                      ? "bg-blue-500"
                      : collectionRatio > 0
                        ? "bg-amber-500"
                        : "bg-gray-200";
                const textColor =
                  collectionRatio >= 100
                    ? "text-emerald-600"
                    : collectionRatio >= 50
                      ? "text-blue-600"
                      : collectionRatio > 0
                        ? "text-amber-600"
                        : "text-gray-400";

                return (
                  <div key={ctId} className="border border-gray-100 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedContractType(isExpanded ? null : ctId)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/80 hover:bg-gray-100/80 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                        <div>
                          <p className="text-[15px] font-semibold text-gray-800">{group.name}</p>
                          <p className="text-[13px] text-gray-400 mt-0.5">{group.incomes.length} 筆收入</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 text-right">
                        <div className="min-w-[100px]">
                          <p className="text-[12px] text-gray-400 mb-0.5">總金額</p>
                          <p className="text-[15px] font-bold font-mono text-emerald-600">{formatMoney(group.total)}</p>
                        </div>
                        <div className="min-w-[90px]">
                          <p className="text-[12px] text-gray-400 mb-0.5">已收</p>
                          <p className="text-[15px] font-mono text-blue-600">{formatMoney(group.paid)}</p>
                        </div>
                        <div className="min-w-[90px]">
                          <p className="text-[12px] text-gray-400 mb-0.5">待收</p>
                          <p className={`text-[15px] font-mono ${group.outstanding > 0 ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                            {formatMoney(group.outstanding)}
                          </p>
                        </div>
                        <div className="min-w-[120px] pl-4 border-l border-gray-200">
                          <p className="text-[12px] text-gray-400 mb-1">收款比率</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-[6px] bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                style={{ width: `${Math.min(collectionRatio, 100)}%` }}
                              />
                            </div>
                            <span className={`text-[15px] font-bold font-mono ${textColor}`}>{collectionRatio}%</span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        <div className="px-4 py-2 flex justify-end">
                          {canCreateIncome && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-[13px]"
                              onClick={() => openCreateIncome(ctId === uncategorizedKey ? undefined : ctId)}
                            >
                              <Plus className="w-3 h-3" /> 新增此類收入
                            </Button>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-white">
                                <TableHead className="text-[13px]">到期日</TableHead>
                                <TableHead className="text-[13px]">預計收款日期</TableHead>
                                <TableHead className="text-[13px]">收款日期</TableHead>
                                <TableHead className="text-[13px]">款項期數</TableHead>
                                <TableHead className="text-[13px] text-right">收入金額</TableHead>
                                <TableHead className="text-[13px] text-right">已收金額</TableHead>
                                <TableHead className="text-[13px] text-right">待收金額</TableHead>
                                <TableHead className="text-[13px] text-center">收款狀態</TableHead>
                                <TableHead className="text-[13px]">備註</TableHead>
                                <TableHead className="text-[13px] text-center">附件</TableHead>
                                <TableHead className="text-[13px] text-center w-[100px]">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.incomes.map((income) => {
                                const fileUrls = parseFileUrls(income.pdf_file);
                                const ctName = income.contract_type_name || "未分類";
                                const hash = income.invoice_number || "-";

                                return (
                                  <TableRow key={income.id} className="hover:bg-gray-50/50 group/row">
                                    <TableCell className={`text-[14px] ${isPastDueUnpaid(income.due_date, income.amount, income.payment_amount) ? "text-red-500" : "text-gray-600"}`}>{formatShortDate(income.due_date)}</TableCell>
                                    <TableCell className="text-[14px] text-gray-600">{formatShortDate(income.expected_payment_date)}</TableCell>
                                    <TableCell className="text-[14px] text-gray-600">{formatShortDate(income.payment_date)}</TableCell>
                                    <TableCell className="text-[14px] text-gray-700 font-medium whitespace-nowrap">
                                      {`${ctName} #${hash}`}
                                    </TableCell>
                                    <TableCell className="text-[14px] text-right font-mono text-emerald-600 font-medium">
                                      {formatMoney(income.amount)}
                                    </TableCell>
                                    <TableCell className="text-[14px] text-right font-mono text-blue-600">
                                      {formatMoney(income.payment_amount)}
                                    </TableCell>
                                    <TableCell
                                      className={`text-[14px] text-right font-mono ${incomeNetOutstanding(income) > 0 ? "text-red-500 font-semibold" : "text-gray-400"}`}
                                    >
                                      {formatMoney(incomeNetOutstanding(income))}
                                    </TableCell>
                                    <TableCell className="text-[14px] text-center">{incomeCollectionBadge(income)}</TableCell>
                                    <TableCell className="text-[14px] text-gray-600 max-w-[200px] truncate" title={income.remark || ""}>
                                      {income.remark || <span className="text-gray-300">-</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {fileUrls.length === 0 ? (
                                        <span className="text-gray-300">-</span>
                                      ) : (
                                        <div className="flex items-center justify-center gap-1">
                                          {fileUrls.map((url, fi) => (
                                            <a
                                              key={fi}
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-0.5 text-[12px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                              title={decodeURIComponent(url.split("/").pop()?.split("?")[0] || "file")}
                                            >
                                              <Paperclip className="w-3 h-3" />
                                              {fileUrls.length === 1 ? getFileName(url) : fi + 1}
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0"
                                          title={incomeIdsWithInvoice.has(income.id) ? "查看發票 View Invoice" : "建立發票 Create Invoice"}
                                          onClick={(e) => handleNavClick(`${projectRoutePrefix}/invoice/${income.id}`, e, (href) => router.push(href))}
                                        >
                                          <Receipt
                                            className={`w-3.5 h-3.5 ${incomeIdsWithInvoice.has(income.id) ? "text-emerald-500" : "text-gray-400"}`}
                                          />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0"
                                          title={incomeIdsWithReceipt.has(income.id) ? "查看收據 View Receipt" : "建立收據 Create Receipt"}
                                          onClick={(e) => handleNavClick(`${projectRoutePrefix}/receipt/${income.id}`, e, (href) => router.push(href))}
                                        >
                                          <ClipboardCheck
                                            className={`w-3.5 h-3.5 ${incomeIdsWithReceipt.has(income.id) ? "text-teal-500" : "text-gray-400"}`}
                                          />
                                        </Button>
                                        {canEditIncome && (
                                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditIncome(income)}>
                                            <Pencil className="w-3.5 h-3.5 text-blue-500" />
                                          </Button>
                                        )}
                                        {canDeleteIncome && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            disabled={deletingIncomeId === income.id}
                                            onClick={() => handleDeleteIncome(income.id)}
                                          >
                                            {deletingIncomeId === income.id ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                                            ) : (
                                              <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[15px] text-gray-400 py-6 text-center">暫無收入記錄</p>
          )}
        </SectionCard>
        {financeDialogs}
      </div>
    );
  }

  const totalPaid = expenses.reduce((s, e) => s + (e.paid_amount || 0), 0);
  const totalOutstanding = expenses.reduce((s, e) => s + (e.outstanding || 0), 0);
  const mcId = data.main_contractor_id;

  return (
    <div className="space-y-6">
      {!expenseUnlocked && onNavigateToExpenseControl && (
        <button
          type="button"
          onClick={() => onNavigateToExpenseControl()}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-left hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-[13px]">
            出支票功能受限制：尚有必填資料未完成。請前往「Expense Control」分頁查看清單。Expense is restricted — complete the Expense Control checklist first.
          </p>
        </button>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="預計支出 Estimated" value={formatMoney(data.estimated_expense)} icon={TrendingDown} accentColor="bg-blue-500" />
        <MetricCard label="實際支出 Actual" value={formatMoney(totalExpense)} subtext={`${expenses.length} 筆支出`} icon={ArrowUpCircle} accentColor="bg-red-500" />
        <MetricCard label="已付款 Paid" value={formatMoney(totalPaid)} icon={CheckCircle2} accentColor="bg-violet-500" />
        <MetricCard label="待付款 Outstanding" value={formatMoney(totalOutstanding)} icon={AlertTriangle} accentColor="bg-amber-500" />
      </div>
      {entityType === "bwa_project" && (
        <SectionCard title="主要承辦商 Main Contractor" icon={HardHat} iconColor="text-orange-500">
          {mcId ? (
            <div className="space-y-2">
              <p className="font-semibold">{data.main_contractor_name || "-"}</p>
              {canCreateExpense && (
                <Button size="sm" variant="outline" onClick={() => openCreateExpense(mcId || undefined)} disabled={!expenseUnlocked}>
                  新增承辦商支出
                </Button>
              )}
              {canEditExpense && !expenses.some((e) => e.supplier_id === mcId) && (
                <Button size="sm" variant="ghost" onClick={handleRemoveMainContractor} disabled={mcSaving}>
                  移除
                </Button>
              )}
            </div>
          ) : (
            <div ref={mcPanelRef} className="relative max-w-md">
              <p className="text-sm text-gray-500 mb-2">尚未設定主要承辦商。請先選擇一個供應商作為主要承辦商。</p>
              <Button variant="outline" className="w-full justify-between" onClick={() => setMcSearchOpen((p) => !p)}>
                選擇供應商
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </Button>
              {mcSearchOpen && (
                <div className="absolute z-20 mt-1 border rounded bg-white shadow w-full max-h-48 overflow-y-auto">
                  {supplierOptionsList
                    .filter((s) => !mcSearchQuery || s.label.toLowerCase().includes(mcSearchQuery.toLowerCase()))
                    .map((s) => (
                      <div
                        key={s.id}
                        className="px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSetMainContractor(s.id);
                        }}
                      >
                        {s.label}
                      </div>
                    ))}
                </div>
              )}
              {mcError && <p className="text-red-500 text-sm">{mcError}</p>}
            </div>
          )}
        </SectionCard>
      )}
      <SectionCard title={`供應商 × 合約類型分組 (${expenseGrouped.entries.length} 組)`} icon={Receipt} iconColor="text-red-500">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-400">按供應商及合約類型分組顯示支出，點擊展開查看明細</p>
          {canCreateExpense && (
            entityType === "bwf_project" ? (
              <div className="flex gap-2">
                <DisabledSubmitControl
                  blocked={!expenseUnlocked}
                  reasons={!expenseUnlocked ? [EXPENSE_CONTROL_LOCKED_MESSAGE] : []}
                >
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-[14px] bg-red-500 hover:bg-red-600 text-white"
                    onClick={() => openCreateExpense(undefined, undefined, "supplier")}
                    disabled={!expenseUnlocked}
                  >
                    <Plus className="w-3.5 h-3.5" /> 新增支出
                  </Button>
                </DisabledSubmitControl>
                <DisabledSubmitControl
                  blocked={!expenseUnlocked}
                  reasons={!expenseUnlocked ? [EXPENSE_CONTROL_LOCKED_MESSAGE] : []}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-[14px]"
                    onClick={() => openCreateExpense(undefined, undefined, "factory")}
                    disabled={!expenseUnlocked}
                  >
                    <Plus className="w-3.5 h-3.5" /> 工廠支出
                  </Button>
                </DisabledSubmitControl>
              </div>
            ) : (
              <DisabledSubmitControl
                blocked={!expenseUnlocked}
                reasons={!expenseUnlocked ? [EXPENSE_CONTROL_LOCKED_MESSAGE] : []}
              >
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-[14px] bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => openCreateExpense()}
                  disabled={!expenseUnlocked}
                >
                  <Plus className="w-3.5 h-3.5" /> 新增支出
                </Button>
              </DisabledSubmitControl>
            )
          )}
        </div>

        {expenseGrouped.entries.length > 0 ? (
          <div className="space-y-2">
            {expenseGrouped.entries.map(([groupKey, group]) => {
              const isExpanded = expandedExpenseGroup === groupKey;
              const paymentRatio = group.total > 0 ? Math.round((group.paid / group.total) * 100) : 0;
              const barColor =
                paymentRatio >= 100
                  ? "bg-emerald-500"
                  : paymentRatio >= 50
                    ? "bg-violet-500"
                    : paymentRatio > 0
                      ? "bg-orange-500"
                      : "bg-gray-200";
              const textColor =
                paymentRatio >= 100
                  ? "text-emerald-600"
                  : paymentRatio >= 50
                    ? "text-violet-600"
                    : paymentRatio > 0
                      ? "text-orange-600"
                      : "text-gray-400";

              return (
                <div key={groupKey} className="border border-gray-100 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedExpenseGroup(isExpanded ? null : groupKey)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/80 hover:bg-gray-100/80 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                      <div>
                        <p className="text-[15px] font-semibold text-gray-800">{group.payeeName}</p>
                        <div className="text-[13px] text-gray-400 mt-0.5">
                          <span className="inline-flex items-center gap-1">
                            {group.isFactory && (
                              <Badge variant="outline" className="text-[12px] px-1.5 py-0 border-blue-200 text-blue-600 bg-blue-50">
                                工廠
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[12px] px-1.5 py-0 border-amber-200 text-amber-600 bg-amber-50">
                              {group.contractTypeName}
                            </Badge>
                            <span className="text-gray-300">·</span>
                            {group.expenses.length} 筆支出
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8 text-right">
                      <div className="min-w-[100px]">
                        <p className="text-[12px] text-gray-400 mb-0.5">總金額</p>
                        <p className="text-[15px] font-bold font-mono text-red-600">{formatMoney(group.total)}</p>
                      </div>
                      <div className="min-w-[90px]">
                        <p className="text-[12px] text-gray-400 mb-0.5">已付</p>
                        <p className="text-[15px] font-mono text-blue-600">{formatMoney(group.paid)}</p>
                      </div>
                      <div className="min-w-[90px]">
                        <p className="text-[12px] text-gray-400 mb-0.5">待付</p>
                        <p className={`text-[15px] font-mono ${group.outstanding > 0 ? "text-amber-500 font-semibold" : "text-gray-400"}`}>
                          {formatMoney(group.outstanding)}
                        </p>
                      </div>
                      <div className="min-w-[120px] pl-4 border-l border-gray-200">
                        <p className="text-[12px] text-gray-400 mb-1">付款比率</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-[6px] bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                              style={{ width: `${Math.min(paymentRatio, 100)}%` }}
                            />
                          </div>
                          <span className={`text-[15px] font-bold font-mono ${textColor}`}>{paymentRatio}%</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      <div className="flex items-center justify-end px-4 py-2 bg-gray-50/50">
                        {canCreateExpense && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 h-6 text-[12px] border-red-200 text-red-500 hover:bg-red-50"
                            onClick={() =>
                              openCreateExpense(
                                group.payeeId,
                                group.contractTypeId,
                                group.isFactory ? "factory" : "supplier",
                              )
                            }
                            disabled={!expenseUnlocked}
                            title={!expenseUnlocked ? "出支票功能受限制：請先完成 Expense Control 清單" : undefined}
                          >
                            <Plus className="w-3 h-3" /> 新增此組支出
                          </Button>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-white">
                              <TableHead className="text-[13px]">到期日</TableHead>
                              <TableHead className="text-[13px]">預計付款日期</TableHead>
                              <TableHead className="text-[13px]">實際付款日期</TableHead>
                              <TableHead className="text-[13px]">款項期數</TableHead>
                              <TableHead className="text-[13px]">支出分類</TableHead>
                              <TableHead className="text-[13px]">付款方式</TableHead>
                              <TableHead className="text-[13px] text-right">支出金額</TableHead>
                              <TableHead className="text-[13px] text-right">已付金額</TableHead>
                              <TableHead className="text-[13px] text-right">待付金額</TableHead>
                              <TableHead className="text-[13px] text-center">收款狀態</TableHead>
                              <TableHead className="text-[13px]">備註</TableHead>
                              <TableHead className="text-[13px] text-center">附件</TableHead>
                              <TableHead className="text-[13px] text-center">操作</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.expenses.map((expense) => {
                              const attachmentUrls = parseFileUrls(expense.pdf_file);
                              const quotationUrls = parseExpenseFileUrls(expense.supplier_quotation_file);
                              const fileEntries = [
                                ...quotationUrls.map((url) => ({ url, kind: "quotation" as const })),
                                ...attachmentUrls.map((url) => ({ url, kind: "attachment" as const })),
                              ];
                              return (
                                <TableRow key={expense.id} className="hover:bg-gray-50/50 group/row">
                                  <TableCell className={`text-[14px] ${isPastDueUnpaid(expense.due_date, expense.amount, expense.paid_amount) ? "text-red-500" : "text-gray-600"}`}>{formatShortDate(expense.due_date)}</TableCell>
                                  <TableCell className="text-[14px] text-gray-600">{formatShortDate(expense.expected_payment_date)}</TableCell>
                                  <TableCell className="text-[14px] text-gray-600">{formatShortDate(expense.payment_date)}</TableCell>
                                  <TableCell className="text-[14px] text-gray-600">
                                    {expense.rank_report || <span className="text-gray-300">-</span>}
                                  </TableCell>
                                  <TableCell className="text-[14px] text-gray-700">
                                    {expense.supplier_type_name ? (
                                      <Badge variant="outline" className="text-[12px] px-1.5 py-0 border-gray-200 text-gray-600 bg-gray-50">
                                        {expense.supplier_type_name}
                                      </Badge>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-[14px] text-gray-700">
                                    <div>
                                      {expense.payment_method_name || <span className="text-gray-300">-</span>}
                                      {expense.cheque_no && (
                                        <p className="text-[12px] text-gray-400 mt-0.5 font-mono">支票: {expense.cheque_no}</p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-[14px] text-right font-mono text-red-600 font-medium">
                                    {formatMoney(expense.amount)}
                                  </TableCell>
                                  <TableCell className="text-[14px] text-right font-mono text-blue-600">
                                    {formatMoney(expense.paid_amount)}
                                  </TableCell>
                                  <TableCell
                                    className={`text-[14px] text-right font-mono ${(expense.outstanding || 0) > 0 ? "text-amber-500 font-semibold" : "text-gray-400"}`}
                                  >
                                    {formatMoney(expense.outstanding)}
                                  </TableCell>
                                  <TableCell className="text-[14px] text-center">{expensePaidBadge(expense)}</TableCell>
                                  <TableCell className="text-[14px] text-gray-600 max-w-[200px] truncate" title={expense.remark || ""}>
                                    {expense.remark || <span className="text-gray-300">-</span>}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {fileEntries.length === 0 ? (
                                      <span className="text-gray-300">-</span>
                                    ) : (
                                      <div className="flex items-center justify-center gap-1 flex-wrap">
                                        {fileEntries.map((entry, fi) => (
                                          <a
                                            key={`${entry.kind}-${fi}`}
                                            href={entry.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={cn(
                                              "inline-flex items-center gap-0.5 text-[12px] px-1.5 py-0.5 rounded transition-colors",
                                              entry.kind === "quotation"
                                                ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                                : "bg-blue-50 text-blue-600 hover:bg-blue-100",
                                            )}
                                            title={
                                              entry.kind === "quotation"
                                                ? `供應商報價單: ${decodeURIComponent(entry.url.split("/").pop()?.split("?")[0] || "file")}`
                                                : decodeURIComponent(entry.url.split("/").pop()?.split("?")[0] || "file")
                                            }
                                          >
                                            <Paperclip className="w-3 h-3" />
                                            {fileEntries.length === 1 ? getFileName(entry.url) : fi + 1}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                      {canEditExpense && (
                                        <button
                                          className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-50 disabled:hover:text-gray-500"
                                          title={!expenseUnlocked ? "請先填寫工地狀況 (Site Status) 才可編輯支出" : "編輯支出"}
                                          onClick={() => openEditExpense(expense)}
                                          disabled={!expenseUnlocked}
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                      )}
                                      {canDeleteExpense && (
                                        <button
                                          className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                          title="刪除支出"
                                          disabled={deletingExpenseId === expense.id}
                                          onClick={() => handleDeleteExpense(expense.id)}
                                        >
                                          {deletingExpenseId === expense.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <Trash2 className="w-3 h-3" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[15px] text-gray-400 py-6 text-center">暫無支出記錄</p>
        )}
      </SectionCard>
      {financeDialogs}
    </div>
  );
});

export default ProjectFinancePanels;
