"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Plus,
  Minus,
  FileText,
  Info,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Copy,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, addDays, differenceInDays } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialFormat } from "@/hooks/use-financial-format";
import { createClient } from "@/lib/supabase/client";
import {
  type BWFPitchingDetailData,
  type LinkOption,
  updateBWFPitching,
  fetchStaffOptions,
  fetchCostCentres,
  fetchFinancialYearOptions,
  fetchCurrentFinancialYear,
  fetchBWFPitchingServiceTypeIds,
  generateBWFP2Code,
  createBWFProject,
  fetchBWFPitchingServiceItemIds,
  fetchBWFPitchingMajorQuoteIds,
  fetchSupplierTypes,
  fetchActiveBwfTeamLeaderStaffIds,
} from "@/lib/data-service";
import { type BwfQuoteListRow } from "@/lib/bwf-quote-service";
import { buildBwfInitialProjectBvShares } from "@/lib/bwf-initial-project-bv";
import { notifyProjectBvCreated } from "@/lib/project-bv-notify";

function formatFurnitureQuoteOption(q: BwfQuoteListRow): string {
  const amount =
    q.total_amount != null && !Number.isNaN(Number(q.total_amount))
      ? new Intl.NumberFormat("en-HK", {
          style: "currency",
          currency: "HKD",
          maximumFractionDigits: 0,
        }).format(Number(q.total_amount))
      : "—";
  const version = q.version ? ` · ${q.version}` : "";
  const status = q.status ? ` · ${q.status}` : "";
  return `${q.quote_id}${version}${status} · ${amount}`;
}

interface ExpenseTypeOption {
  id: string;
  display: string;
  chinese_display: string | null;
}

interface ExpenseRow {
  id?: string;
  expense_type_id: string;
  amount: string;
}

interface BWFConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: BWFPitchingDetailData;
  pitchingId: string;
  advancingStage: boolean;
  onConfirm: () => void;
  onDataChanged?: () => void;
}

const BWF_CONTRACT_TYPE_ID = "a5de2560-987d-4b25-ba1d-0278ab037143";
const BWF_COST_CENTER_ID = "4e85f232-7308-463b-8b7b-933110cbd301";

export default function BWFConvertDialog({
  open,
  onOpenChange,
  data,
  pitchingId,
  advancingStage,
  onConfirm,
  onDataChanged,
}: BWFConvertDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { staff, profile } = useAuth();
  const { formatMoney } = useFinancialFormat();

  const isEnquiryToPitching = data.pitching_stages === "Enquiry";
  const isAlreadyConfirmed = data.pitching_stages === "Confirmed Project";
  const isSuperAdmin = (staff as { role?: string })?.role === "Super Admin";
  const conversionReadOnly = isAlreadyConfirmed && !isSuperAdmin;

  // ─── Enquiry → Pitching (mini L1 budget) ───
  const [l1Income, setL1Income] = useState("");
  const [l1ExpenseManual, setL1ExpenseManual] = useState("");
  const [expenseTypeOptions, setExpenseTypeOptions] = useState<ExpenseTypeOption[]>([]);
  const [bwfPresetTypes, setBwfPresetTypes] = useState<ExpenseTypeOption[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
  const [presetAmounts, setPresetAmounts] = useState<Record<string, string>>({});
  const [newExpenseTypeId, setNewExpenseTypeId] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [l1Loading, setL1Loading] = useState(false);
  const [savingConversion, setSavingConversion] = useState(false);
  const [conversionError, setConversionError] = useState("");

  const listTotal = expenseRows.reduce(
    (sum, row) => sum + (parseFloat(row.amount) || 0),
    0,
  );
  const hasExpenseItems = expenseRows.length > 0;
  const l1ExpenseTotal = hasExpenseItems ? listTotal : Number(l1ExpenseManual || 0);

  const savedExpenseTypeIds = useMemo(
    () => new Set(expenseRows.map((r) => r.expense_type_id).filter(Boolean)),
    [expenseRows],
  );
  const presetRows = useMemo(
    () => bwfPresetTypes.filter((t) => !savedExpenseTypeIds.has(t.id)),
    [bwfPresetTypes, savedExpenseTypeIds],
  );

  // ─── Pitching → Project ───
  const [projectForm, setProjectForm] = useState({
    main_pm_id: "",
    cost_center_id: "",
    financial_year_id: "",
    project_name: "",
    project_description: "",
    enquiry_date: "",
    signed_date: "",
    start_date: "",
    handover_date: "",
    project_code: "",
    p2_code: "",
    estimated_income: "",
    estimated_expense: "",
    signed_income: "",
  });
  const [paymentScheduleRows, setPaymentScheduleRows] = useState<
    { ratio: string; amount: string; due_date: string }[]
  >([{ ratio: "100", amount: "", due_date: "" }]);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [signedExpenseRows, setSignedExpenseRows] = useState<ExpenseRow[]>([]);
  const [signedExpenseLoading, setSignedExpenseLoading] = useState(false);
  const [signedExpenseSaving, setSignedExpenseSaving] = useState(false);
  const [signedNewExpenseTypeId, setSignedNewExpenseTypeId] = useState("");
  const [signedNewExpenseAmount, setSignedNewExpenseAmount] = useState("");
  const [signedPresetAmounts, setSignedPresetAmounts] = useState<Record<string, string>>({});
  const [savingSignedPresetId, setSavingSignedPresetId] = useState<string | null>(null);
  const [importingL1, setImportingL1] = useState(false);

  const savedSignedExpenseTypeIds = useMemo(
    () => new Set(signedExpenseRows.map((r) => r.expense_type_id).filter(Boolean)),
    [signedExpenseRows],
  );
  const signedPresetRows = useMemo(
    () => bwfPresetTypes.filter((t) => !savedSignedExpenseTypeIds.has(t.id)),
    [bwfPresetTypes, savedSignedExpenseTypeIds],
  );

  const [expandVerifyInfo, setExpandVerifyInfo] = useState(true);
  const [verifyInfoConfirmed, setVerifyInfoConfirmed] = useState(false);
  const [staffOptions, setStaffOptions] = useState<LinkOption[]>([]);
  const [costCentreOptions, setCostCentreOptions] = useState<
    { id: string; display: string | null; bu_code: string | null }[]
  >([]);
  const [financialYearOptions, setFinancialYearOptions] = useState<
    { id: string; label: string; yy_code: string | null; date_range: string | null }[]
  >([]);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [furnitureQuotes, setFurnitureQuotes] = useState<BwfQuoteListRow[]>([]);
  const [furnitureQuotesLoading, setFurnitureQuotesLoading] = useState(false);
  const [furnitureQuotesError, setFurnitureQuotesError] = useState("");
  const [selectedFurnitureQuoteId, setSelectedFurnitureQuoteId] = useState("");
  /** 0 = closed; 1 = first confirm; 2 = second confirm (no Furniture Quote) */
  const [noQuoteConfirmStep, setNoQuoteConfirmStep] = useState<0 | 1 | 2>(0);
  /** Existing project already linked to this pitching (if any) */
  const [linkedExistingProject, setLinkedExistingProject] = useState<{
    id: string;
    project_code: string | null;
    project_name: string | null;
  } | null>(null);
  /** Create-new vs status-only choice — mutually exclusive with noQuoteConfirmStep */
  const [showLinkedProjectChoice, setShowLinkedProjectChoice] = useState(false);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    if (isEnquiryToPitching) {
      setL1Income(
        data.estimated_income != null ? String(data.estimated_income) : "",
      );
      setL1ExpenseManual(
        data.estimated_expense != null ? String(data.estimated_expense) : "",
      );
      setConversionError("");
      setNewExpenseTypeId("");
      setNewExpenseAmount("");
      setPresetAmounts({});
      setL1Loading(true);

      const supabase = createClient();
      void (async () => {
        const { data: expenseData } = await supabase
          .from("quotation_expenses")
          .select("id, n_expense_type_id, amount")
          .eq("bwf_pitching_id", pitchingId)
          .order("created_date", { ascending: true });
        const rows = (expenseData ?? []).map(
          (row: { id: string; n_expense_type_id: string | null; amount: number | null }) => ({
            id: row.id,
            expense_type_id: row.n_expense_type_id || "",
            amount: row.amount != null ? String(row.amount) : "",
          }),
        );
        const types = await fetchSupplierTypes(rows.map((r: { expense_type_id: string }) => r.expense_type_id));
        setExpenseTypeOptions(types);
        setBwfPresetTypes(types.filter((t) => t.is_bwf === true && t.is_active !== false));
        setExpenseRows(rows);
        setL1Loading(false);
      })();
      return;
    }

    const isFreshOpen = !prevOpenRef.current;
    prevOpenRef.current = open;

    fetchStaffOptions().then(setStaffOptions);
    fetchSupplierTypes().then((types) => {
      setExpenseTypeOptions(types);
      setBwfPresetTypes(types.filter((t) => t.is_bwf === true && t.is_active !== false));
    });

    const supabase = createClient();

    Promise.all([
      fetchCostCentres(),
      fetchFinancialYearOptions(),
      fetchCurrentFinancialYear(),
    ]).then(([centres, fyOpts, currentFy]) => {
      setCostCentreOptions(centres);
      setFinancialYearOptions(fyOpts);

      const defaultFyId = data.n_financial_year_id || currentFy?.id || "";
      const defaultPmId = data.main_pm_id || "";

      if (isFreshOpen) {
        setProjectError("");
        setSignedNewExpenseTypeId("");
        setSignedNewExpenseAmount("");
        setSignedPresetAmounts({});
        setImportingL1(false);
        setExpandVerifyInfo(true);
        setVerifyInfoConfirmed(isAlreadyConfirmed);
        setSelectedFurnitureQuoteId("");
        setFurnitureQuotes([]);
        setFurnitureQuotesError("");
        setNoQuoteConfirmStep(0);
        setShowLinkedProjectChoice(false);
        setLinkedExistingProject(null);
        // Clear stale L2 rows from a previously opened pitching before re-fetch
        setSignedExpenseRows([]);
        setProjectForm({
          main_pm_id: defaultPmId,
          cost_center_id: BWF_COST_CENTER_ID,
          financial_year_id: defaultFyId,
          project_name:
            data.real_customer_display_name ||
            data.description ||
            data.pitching_code ||
            "",
          project_description: data.quote_content || "",
          enquiry_date: data.enquiry_date ? data.enquiry_date.slice(0, 10) : "",
          signed_date: new Date().toISOString().slice(0, 10),
          start_date: "",
          handover_date: "",
          project_code: data.pitching_code || "",
          p2_code: "",
          estimated_income:
            data.estimated_income != null ? String(data.estimated_income) : "",
          estimated_expense:
            data.estimated_expense != null ? String(data.estimated_expense) : "",
          signed_income:
            data.estimated_income != null ? String(data.estimated_income) : "",
        });
        setInstallmentCount(1);
        setPaymentScheduleRows([
          {
            ratio: "100",
            amount: data.estimated_income != null ? String(data.estimated_income) : "",
            due_date: "",
          },
        ]);
      }
    });

    if (isFreshOpen) {
      (async () => {
        const supabase = createClient();
        const { data: linkedProject } = await supabase
          .from("bwf_projects")
          .select(
            "id, project_code, p2_code, project_name, project_content, signed_date, start_date, handover_date, cost_center_id, main_pm_id, n_financial_year_id, enquiry_date, estimated_income, estimated_expense",
          )
          .eq("bwf_pitching_id", pitchingId)
          .limit(1)
          .maybeSingle();

        if (!linkedProject) {
          setLinkedExistingProject(null);
          return;
        }

        setLinkedExistingProject({
          id: linkedProject.id,
          project_code: linkedProject.project_code,
          project_name: linkedProject.project_name,
        });

        const { data: incomeRows } = await supabase
          .from("incomes")
          .select("income_amount, due_date, invoice_number")
          .eq("bwf_project_id", linkedProject.id)
          .order("invoice_number", { ascending: true });

        type IncomeScheduleRow = {
          income_amount: number | null;
          due_date: string | null;
          invoice_number: string | null;
        };
        const incomeList = (incomeRows ?? []) as IncomeScheduleRow[];
        const signedIncomeTotal = incomeList.reduce(
          (sum, row) => sum + (Number(row.income_amount) || 0),
          0,
        );
        const scheduleRows =
          incomeList.length > 0
            ? incomeList.map((row) => {
                const amount = Number(row.income_amount) || 0;
                const ratio =
                  signedIncomeTotal > 0
                    ? ((amount / signedIncomeTotal) * 100).toFixed(2)
                    : "";
                return {
                  ratio,
                  amount: String(amount),
                  due_date: row.due_date ? row.due_date.slice(0, 10) : "",
                };
              })
            : [
                {
                  ratio: "100",
                  amount:
                    linkedProject.estimated_income != null
                      ? String(linkedProject.estimated_income)
                      : "",
                  due_date: "",
                },
              ];

        setProjectForm({
          main_pm_id: linkedProject.main_pm_id || data.main_pm_id || "",
          cost_center_id: linkedProject.cost_center_id || BWF_COST_CENTER_ID,
          financial_year_id:
            linkedProject.n_financial_year_id || data.n_financial_year_id || "",
          project_name: linkedProject.project_name || "",
          project_description: linkedProject.project_content || "",
          enquiry_date: linkedProject.enquiry_date
            ? linkedProject.enquiry_date.slice(0, 10)
            : data.enquiry_date
              ? data.enquiry_date.slice(0, 10)
              : "",
          signed_date: linkedProject.signed_date
            ? linkedProject.signed_date.slice(0, 10)
            : "",
          start_date: linkedProject.start_date
            ? linkedProject.start_date.slice(0, 10)
            : "",
          handover_date: linkedProject.handover_date
            ? linkedProject.handover_date.slice(0, 10)
            : "",
          project_code: linkedProject.project_code || "",
          p2_code: linkedProject.p2_code || "",
          estimated_income:
            linkedProject.estimated_income != null
              ? String(linkedProject.estimated_income)
              : data.estimated_income != null
                ? String(data.estimated_income)
                : "",
          estimated_expense:
            linkedProject.estimated_expense != null
              ? String(linkedProject.estimated_expense)
              : data.estimated_expense != null
                ? String(data.estimated_expense)
                : "",
          signed_income:
            signedIncomeTotal > 0
              ? String(signedIncomeTotal)
              : linkedProject.estimated_income != null
                ? String(linkedProject.estimated_income)
                : "",
        });
        setInstallmentCount(Math.max(scheduleRows.length, 1));
        setPaymentScheduleRows(scheduleRows);
      })();
    }
  }, [open, isEnquiryToPitching, isAlreadyConfirmed, data, pitchingId]);

  useEffect(() => {
    if (!open) prevOpenRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || isEnquiryToPitching) return;

    let cancelled = false;

    const loadFurnitureQuotes = async () => {
      setFurnitureQuotesLoading(true);
      setFurnitureQuotesError("");
      try {
        const params = new URLSearchParams({ pitchingId });
        if (data.pitching_code?.trim()) {
          params.set("pitchingCode", data.pitching_code.trim());
        }
        const res = await fetch(`/api/bwf/quotes?${params.toString()}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const body = (await res.json().catch(() => ({}))) as {
          quotes?: BwfQuoteListRow[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        if (!cancelled) {
          setFurnitureQuotes(body.quotes ?? []);
          setFurnitureQuotesError("");
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "無法載入傢俬報價";
        console.error("[BWFConvertDialog] load furniture quotes:", err);
        if (!cancelled) {
          setFurnitureQuotes([]);
          setFurnitureQuotesError(message);
        }
      } finally {
        if (!cancelled) setFurnitureQuotesLoading(false);
      }
    };

    void loadFurnitureQuotes();
    return () => {
      cancelled = true;
    };
  }, [open, isEnquiryToPitching, pitchingId, data.pitching_code]);

  useEffect(() => {
    if (open && !isEnquiryToPitching && hasExpenseItems) {
      setL1ExpenseManual(String(listTotal));
    }
  }, [open, isEnquiryToPitching, hasExpenseItems, listTotal]);

  useEffect(() => {
    if (!open || isEnquiryToPitching || isAlreadyConfirmed) return;
    if (!projectForm.main_pm_id || !projectForm.financial_year_id) {
      return;
    }

    setGeneratingCode(true);
    generateBWFP2Code({
      financialYearId: projectForm.financial_year_id,
      mainPmId: projectForm.main_pm_id,
    }).then((p2Code) => {
      setProjectForm((f) => ({
        ...f,
        p2_code: p2Code || f.p2_code,
      }));
      setGeneratingCode(false);
    });
  }, [
    open,
    isEnquiryToPitching,
    isAlreadyConfirmed,
    projectForm.main_pm_id,
    projectForm.financial_year_id,
  ]);

  const fetchSignedExpenses = useCallback(async () => {
    setSignedExpenseLoading(true);
    try {
      const supabase = createClient();
      const { data: rows, error } = await supabase
        .from("project_initial_expenses")
        .select("id, n_expense_type_id, amount")
        .eq("bwf_pitching_id", pitchingId)
        .order("created_date", { ascending: true });
      if (error) {
        console.error("[BWFConvertDialog] project_initial_expenses:", error.message);
        setSignedExpenseRows([]);
        return [] as ExpenseRow[];
      }
      const mapped = (rows ?? []).map((row: { id: string; n_expense_type_id: string | null; amount: number | null }) => ({
        id: row.id,
        expense_type_id: row.n_expense_type_id || "",
        amount: row.amount != null ? String(row.amount) : "",
      }));
      setSignedExpenseRows(mapped);
      const types = await fetchSupplierTypes([
        ...mapped.map((r: { expense_type_id: string }) => r.expense_type_id),
        ...expenseRows.map((r: { expense_type_id: string }) => r.expense_type_id),
      ]);
      setExpenseTypeOptions(types);
      setBwfPresetTypes(types.filter((t) => t.is_bwf === true && t.is_active !== false));
      return mapped;
    } finally {
      setSignedExpenseLoading(false);
    }
  }, [pitchingId, expenseRows]);

  useEffect(() => {
    if (open && !isEnquiryToPitching) {
      fetchSignedExpenses();
    }
  }, [open, isEnquiryToPitching, fetchSignedExpenses]);

  const handlePaymentRowChange = (idx: number, field: string, value: string) => {
    setPaymentScheduleRows((rows) => {
      const updated = [...rows];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === "ratio" && projectForm.signed_income) {
        const ratio = parseFloat(value);
        if (!isNaN(ratio)) {
          updated[idx].amount = String(
            (parseFloat(projectForm.signed_income) * ratio) / 100,
          );
        }
      }
      return updated;
    });
  };

  const computeEvenlyDistributedDates = (
    count: number,
    signedDate?: string,
    handoverDate?: string,
  ): string[] => {
    const sd = signedDate || projectForm.signed_date;
    const hd = handoverDate || projectForm.handover_date;
    if (!sd || !hd || count < 1) return Array(count).fill("");
    const start = new Date(sd + "T00:00:00");
    const end = new Date(hd + "T00:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return Array(count).fill("");
    if (count === 1) return [format(start, "yyyy-MM-dd")];
    const totalDays = differenceInDays(end, start);
    return Array.from({ length: count }, (_, i) => {
      if (i === 0) return format(start, "yyyy-MM-dd");
      if (i === count - 1) return format(end, "yyyy-MM-dd");
      const daysOffset = Math.round((totalDays * i) / (count - 1));
      return format(addDays(start, daysOffset), "yyyy-MM-dd");
    });
  };

  const handleInstallmentCountChange = (count: number) => {
    setInstallmentCount(count);
    const baseRatio = Math.floor(100 / count);
    const signedVal = parseFloat(projectForm.signed_income) || 0;
    const dates = computeEvenlyDistributedDates(count);
    const newRows = Array.from({ length: count }, (_, i) => {
      const ratio = i === count - 1 ? 100 - baseRatio * (count - 1) : baseRatio;
      const amount = signedVal > 0 ? (signedVal * ratio / 100).toFixed(2) : "";
      return { ratio: String(ratio), amount, due_date: dates[i] || "" };
    });
    setPaymentScheduleRows(newRows);
  };

  const canAddExpenseRow =
    signedNewExpenseTypeId.trim() !== "" &&
    signedNewExpenseAmount.trim() !== "" &&
    !isNaN(Number(signedNewExpenseAmount)) &&
    Number(signedNewExpenseAmount) >= 0;

  const addSignedExpenseRow = async () => {
    if (conversionReadOnly || !canAddExpenseRow) return;
    setSignedExpenseSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          table: "project_initial_expenses",
          data: {
            bwf_pitching_id: pitchingId,
            n_expense_type_id: signedNewExpenseTypeId,
            amount: parseFloat(signedNewExpenseAmount),
            created_date: new Date().toISOString(),
            modified_date: new Date().toISOString(),
            created_by_id: profile?.id || null,
          },
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "新增失敗");
      setSignedNewExpenseTypeId("");
      setSignedNewExpenseAmount("");
      await fetchSignedExpenses();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "新增支出失敗";
      toast({ title: "錯誤", description: message, variant: "destructive" });
    } finally {
      setSignedExpenseSaving(false);
    }
  };

  const removeSignedExpenseRow = async (idx: number) => {
    if (conversionReadOnly) return;
    const row = signedExpenseRows[idx];
    if (!row?.id) return;
    setSignedExpenseSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          table: "project_initial_expenses",
          id: row.id,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "刪除失敗");
      await fetchSignedExpenses();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "刪除支出失敗";
      toast({ title: "錯誤", description: message, variant: "destructive" });
    } finally {
      setSignedExpenseSaving(false);
    }
  };

  const handleSignedExpenseChange = async (idx: number, field: string, value: string) => {
    if (conversionReadOnly) return;
    const row = signedExpenseRows[idx];
    if (!row?.id || field !== "expense_type_id") return;
    setSignedExpenseRows((rows) => {
      const updated = [...rows];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          table: "project_initial_expenses",
          id: row.id,
          updates: {
            n_expense_type_id: value || null,
            modified_date: new Date().toISOString(),
          },
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "更新失敗");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "更新支出失敗";
      toast({ title: "錯誤", description: message, variant: "destructive" });
      await fetchSignedExpenses();
    }
  };

  const handleSignedExpenseAmountBlur = async (idx: number) => {
    if (conversionReadOnly) return;
    const row = signedExpenseRows[idx];
    if (!row?.id) return;
    const amount = parseFloat(row.amount);
    if (isNaN(amount) || amount < 0) {
      toast({ title: "錯誤", description: "請輸入有效金額（可為 $0）", variant: "destructive" });
      await fetchSignedExpenses();
      return;
    }
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          table: "project_initial_expenses",
          id: row.id,
          updates: { amount, modified_date: new Date().toISOString() },
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "更新失敗");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "更新支出失敗";
      toast({ title: "錯誤", description: message, variant: "destructive" });
      await fetchSignedExpenses();
    }
  };

  const patchSignedExpenseAmount = (idx: number, value: string) => {
    setSignedExpenseRows((rows) => {
      const updated = [...rows];
      updated[idx] = { ...updated[idx], amount: value };
      return updated;
    });
  };

  const commitSignedPresetAmount = async (typeId: string) => {
    if (conversionReadOnly) return;
    const raw = signedPresetAmounts[typeId]?.trim() ?? "";
    if (!raw) return;

    const amount = parseFloat(raw);
    if (isNaN(amount) || amount < 0) {
      setSignedPresetAmounts((prev) => {
        const next = { ...prev };
        delete next[typeId];
        return next;
      });
      return;
    }

    setSavingSignedPresetId(typeId);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          table: "project_initial_expenses",
          data: {
            bwf_pitching_id: pitchingId,
            n_expense_type_id: typeId,
            amount,
            created_date: new Date().toISOString(),
            modified_date: new Date().toISOString(),
            created_by_id: profile?.id || null,
          },
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "新增失敗");
      setSignedPresetAmounts((prev) => {
        const next = { ...prev };
        delete next[typeId];
        return next;
      });
      await fetchSignedExpenses();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "新增支出失敗";
      toast({ title: "錯誤", description: message, variant: "destructive" });
    } finally {
      setSavingSignedPresetId(null);
    }
  };

  const duplicateL1Expenses = async () => {
    if (conversionReadOnly) return;
    setImportingL1(true);
    try {
      const supabase = createClient();
      const { data: qeData, error } = await supabase
        .from("quotation_expenses")
        .select("n_expense_type_id, amount")
        .eq("bwf_pitching_id", pitchingId);
      if (error) throw new Error(error.message);
      if (!qeData?.length) {
        toast({ title: "提示", description: "此提案尚無 L1 報價支出可匯入" });
        return;
      }
      for (const row of signedExpenseRows) {
        if (!row.id) continue;
        await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            table: "project_initial_expenses",
            id: row.id,
          }),
        });
      }
      const nowIso = new Date().toISOString();
      for (const row of qeData) {
        if (!row.n_expense_type_id) continue;
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            table: "project_initial_expenses",
            data: {
              bwf_pitching_id: pitchingId,
              n_expense_type_id: row.n_expense_type_id,
              amount: row.amount ?? 0,
              created_date: nowIso,
              modified_date: nowIso,
              created_by_id: profile?.id || null,
            },
          }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "匯入失敗");
      }
      await fetchSignedExpenses();
      toast({
        title: "已匯入",
        description: `已從 L1 匯入 ${qeData.length} 筆支出至 L2 初始費用`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "匯入 L1 支出失敗";
      toast({ title: "錯誤", description: message, variant: "destructive" });
      await fetchSignedExpenses();
    } finally {
      setImportingL1(false);
    }
  };

  const totalSignedExpense = signedExpenseRows.reduce(
    (sum, r) => sum + (parseFloat(r.amount) || 0),
    0,
  );

  const calcGPRatio =
    data.estimated_income && Number(data.estimated_income) > 0 && data.estimated_expense != null
      ? (
          ((Number(data.estimated_income) - Number(data.estimated_expense)) /
            Number(data.estimated_income)) *
          100
        ).toFixed(1)
      : "0.0";

  const typeLabel = (typeId: string) => {
    const match = expenseTypeOptions.find((t) => t.id === typeId);
    return match?.chinese_display || match?.display || typeId;
  };

  const canAddExpense =
    newExpenseTypeId.trim() !== "" &&
    newExpenseAmount.trim() !== "" &&
    !isNaN(Number(newExpenseAmount)) &&
    Number(newExpenseAmount) >= 0;

  const addExpenseRow = () => {
    if (!canAddExpense) return;
    setExpenseRows((rows) => [
      ...rows,
      { expense_type_id: newExpenseTypeId, amount: newExpenseAmount },
    ]);
    setNewExpenseTypeId("");
    setNewExpenseAmount("");
  };

  const removeExpenseRow = (idx: number) => {
    setExpenseRows((rows) => rows.filter((_, i) => i !== idx));
  };

  const commitPresetAmount = (typeId: string) => {
    const raw = presetAmounts[typeId]?.trim() ?? "";
    if (!raw) return;
    const amount = parseFloat(raw);
    if (isNaN(amount) || amount < 0) return;
    setExpenseRows((rows) => [
      ...rows,
      { expense_type_id: typeId, amount: String(amount) },
    ]);
    setPresetAmounts((prev) => {
      const next = { ...prev };
      delete next[typeId];
      return next;
    });
  };

  const handleEnquiryAdvance = async () => {
    if (conversionReadOnly) return;

    const missing: string[] = [];
    const incomeNum = Number(l1Income);
    if (l1Income.trim() === "" || isNaN(incomeNum) || incomeNum < 0) {
      missing.push("L1 預計收入 Estimated Income");
    }
    if (!hasExpenseItems) {
      missing.push("L1 支出項目 Quotation Expense（至少需要一筆記錄）");
    } else if (isNaN(l1ExpenseTotal) || l1ExpenseTotal < 0) {
      missing.push("L1 預計支出 Estimated Expense");
    }

    if (missing.length > 0) {
      const errorMsg = `以下必填欄位尚未填寫：\n• ${missing.join("\n• ")}`;
      setConversionError(errorMsg);
      toast({
        variant: "destructive",
        title: "⚠️ 必填欄位未完成",
        description: missing.join("、"),
      });
      return;
    }

    setConversionError("");
    setSavingConversion(true);

    try {
      const supabase = createClient();
      await supabase
        .from("quotation_expenses")
        .delete()
        .eq("bwf_pitching_id", pitchingId);

      const nowIso = new Date().toISOString();
      if (expenseRows.length > 0) {
        await supabase.from("quotation_expenses").insert(
          expenseRows.map((row) => ({
            bwf_pitching_id: pitchingId,
            n_expense_type_id: row.expense_type_id || null,
            amount: parseFloat(row.amount) || 0,
            created_date: nowIso,
            modified_date: nowIso,
          })),
        );
      }

      const finalExpense = listTotal;

      const updateResult = await updateBWFPitching(pitchingId, {
        estimated_income: incomeNum,
        estimated_expense: finalExpense,
        modified_date: nowIso,
      });

      if (!updateResult.success) {
        throw new Error(updateResult.error || "更新提案失敗");
      }

      onDataChanged?.();
      onConfirm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知錯誤";
      setConversionError(message);
      toast({ variant: "destructive", title: "轉換失敗", description: message });
    } finally {
      setSavingConversion(false);
    }
  };

  const executeStatusOnly = async () => {
    setShowLinkedProjectChoice(false);
    setNoQuoteConfirmStep(0);
    setProjectError("");
    setCreatingProject(true);
    try {
      onConfirm();
      const code =
        linkedExistingProject?.project_code ||
        linkedExistingProject?.project_name ||
        "現有項目";
      toast({
        title: "✅ 已推進提案階段（未建立新項目）",
        description: `沿用已連結項目：${code}`,
        duration: 6000,
      });
      if (linkedExistingProject?.id) {
        setTimeout(() => {
          router.push(`/bwf/projects/${linkedExistingProject.id}`);
        }, 1500);
      }
    } finally {
      setCreatingProject(false);
    }
  };

  /** Full create-new path: validate → optional no-quote double confirm → create chain */
  const continueCreateNewPath = async () => {
    setShowLinkedProjectChoice(false);

    const missing: string[] = [];
    if (!verifyInfoConfirmed) missing.push("請先勾選「我已確定上述資料正確無誤」");
    if (!projectForm.main_pm_id) missing.push("主要項目經理 Main PM");
    if (!projectForm.cost_center_id) missing.push("公司 Cost Center");
    if (!projectForm.financial_year_id) missing.push("財政年度 Financial Year");
    if (!projectForm.project_name.trim()) missing.push("項目名稱 Project Name");
    if (!projectForm.project_description.trim()) {
      missing.push("項目描述 Project Description");
    }
    if (!projectForm.enquiry_date) missing.push("查詢日期 Enquiry Date");
    if (!projectForm.signed_date) missing.push("簽約日期 Signed Date");
    if (!projectForm.start_date) missing.push("開始日期 Start Date");
    if (!projectForm.handover_date) missing.push("交場日期 Handover Date");
    if (!projectForm.project_code.trim() && !data.pitching_code?.trim()) {
      missing.push("項目編號 Project Code");
    }
    if (!projectForm.p2_code.trim()) missing.push("P2 Code");
    if (
      projectForm.signed_income === "" ||
      projectForm.signed_income === null ||
      projectForm.signed_income === undefined
    ) {
      missing.push("L2 已簽署收入 Signed Income");
    }
    // Re-fetch L2 from DB so stale UI state cannot bypass validation
    const latestSignedExpenses = await fetchSignedExpenses();
    const validExpenseRows = latestSignedExpenses.filter(
      (row: ExpenseRow) => row.expense_type_id && row.amount && row.amount.trim() !== "",
    );
    if (validExpenseRows.length === 0) {
      missing.push("L2 已簽署支出 Signed Expense（至少需要一筆支出記錄）");
    }

    if (missing.length > 0) {
      const errorMsg = `以下必填欄位尚未填寫：\n• ${missing.join("\n• ")}`;
      setProjectError(errorMsg);
      toast({
        variant: "destructive",
        title: "⚠️ 必填欄位未填寫",
        description:
          missing.length <= 3
            ? missing.join("、")
            : `${missing.slice(0, 3).join("、")} 等 ${missing.length} 項`,
      });
      return;
    }

    // No Furniture Quote selected → require double confirmation before create
    if (!selectedFurnitureQuoteId) {
      setProjectError("");
      setShowLinkedProjectChoice(false);
      setNoQuoteConfirmStep(1);
      return;
    }

    await executeCreateProject();
  };

  const handleCreateProject = async () => {
    if (conversionReadOnly) return;

    // Linked project exists → ask create-new vs status-only first (before quote confirm)
    if (linkedExistingProject) {
      setNoQuoteConfirmStep(0);
      setShowLinkedProjectChoice(true);
      return;
    }

    await continueCreateNewPath();
  };

  const executeCreateProject = async () => {
    setNoQuoteConfirmStep(0);
    setShowLinkedProjectChoice(false);
    setProjectError("");
    setCreatingProject(true);

    try {
      const incomeVal = projectForm.estimated_income
        ? parseFloat(projectForm.estimated_income)
        : data.estimated_income ?? null;
      const expenseVal = projectForm.estimated_expense
        ? parseFloat(projectForm.estimated_expense)
        : data.estimated_expense ?? null;
      const profitVal =
        incomeVal != null && expenseVal != null ? incomeVal - expenseVal : null;

      const resolvedCostCentre = costCentreOptions.find(
        (cc) => cc.id === projectForm.cost_center_id,
      )?.display;
      const resolvedSortFinancialYear = financialYearOptions.find(
        (fy) => fy.id === projectForm.financial_year_id,
      )?.label;

      const result = await createBWFProject({
        project_code: data.pitching_code || projectForm.project_code,
        p2_code: projectForm.p2_code,
        project_name: projectForm.project_name,
        project_content: projectForm.project_description,
        status: "Work In Progress",
        customer_id: data.customer_id || null,
        main_pm_id: projectForm.main_pm_id,
        main_designer_id: data.main_designer_id || null,
        other_pm_id: data.other_pm_id || null,
        more_pm_id: data.more_pm_id || null,
        estimated_income: incomeVal,
        estimated_expense: expenseVal,
        estimated_profit: profitVal,
        size: data.actual_size || null,
        os_size: data.size || data.os_size || null,
        site_address: data.site_address || null,
        r_district_id: data.district_id || null,
        r_building_id: data.r_building_id || null,
        n_financial_year_id: projectForm.financial_year_id || null,
        n_team_type_id: data.n_team_type_id || null,
        n_bwf_service_types_id: data.n_service_type_id || null,
        n_source_id: data.n_source_id || null,
        n_customer_type_id: data.n_customer_type_id || null,
        n_major_quotes_id: data.n_major_quotes_id || null,
        n_service_items_id: data.n_service_items_id || null,
        cost_center_id: projectForm.cost_center_id || null,
        enquiry_date: projectForm.enquiry_date || null,
        signed_date: projectForm.signed_date || null,
        start_date: projectForm.start_date || null,
        handover_date: projectForm.handover_date || null,
        asana_link: data.asana_link || null,
        working_folder: data.working_folder || null,
        bwf_pitching_id: pitchingId,
        sort_financial_year: resolvedSortFinancialYear || null,
        real_customer_display_name: data.real_customer_display_name || null,
        real_customer_name: data.real_customer_co_name || null,
        real_building_name: data.real_building_name || null,
        real_cost_centre: resolvedCostCentre || null,
      });

      if (!result.success || !result.id) {
        throw new Error(result.error || "建立項目失敗");
      }

      const newProjectId = result.id;
      const supabase = createClient();

      toast({
        title: "✅ 步驟 2: 項目記錄已建立",
        description: `項目編號: ${projectForm.project_code}`,
        duration: 6000,
      });

      const [stIds, siIds, mqIds] = await Promise.all([
        fetchBWFPitchingServiceTypeIds(pitchingId),
        fetchBWFPitchingServiceItemIds(pitchingId),
        fetchBWFPitchingMajorQuoteIds(pitchingId),
      ]);

      if (stIds.length > 0) {
        await supabase.from("bwf_project_bwf_service_types").insert(
          stIds.map((service_type_id) => ({ project_id: newProjectId, service_type_id })),
        );
      }
      if (siIds.length > 0) {
        await supabase.from("bwf_project_service_items").insert(
          siIds.map((service_item_id) => ({ project_id: newProjectId, service_item_id })),
        );
      }
      if (mqIds.length > 0) {
        await supabase.from("bwf_project_major_quotes").insert(
          mqIds.map((major_quote_id) => ({ project_id: newProjectId, major_quote_id })),
        );
      }

      const validPaymentRows = paymentScheduleRows.filter(
        (row) => row.amount && parseFloat(row.amount) > 0,
      );
      if (validPaymentRows.length > 0) {
        const { data: contractType, error: contractLookupErr } = await supabase
          .from("nos_contracts")
          .select("id, display")
          .eq("id", BWF_CONTRACT_TYPE_ID)
          .single();
        const validContractTypeId = contractLookupErr ? null : contractType?.id ?? null;
        const typeDisplay = contractType?.display ?? null;
        const incomeInserts = validPaymentRows.map((row, idx) => ({
          bwf_project_id: newProjectId,
          income_amount: parseFloat(row.amount) || 0,
          due_date: row.due_date || null,
          expected_payment_date: null,
          invoice_number: String(idx + 1),
          n_contract_type: null,
          outstanding: parseFloat(row.amount) || 0,
          payment_status: null,
          payment_amount: null,
          project: null,
          real_creator_name: (staff as { name?: string })?.name || null,
          receive_date: null,
          status: null,
          type_display: typeDisplay,
          created_by: null,
          created_date: new Date().toISOString(),
          modified_date: new Date().toISOString(),
          n_contract_type_id: validContractTypeId,
          created_by_id: profile?.id || null,
        }));
        const { error: incomeErr } = await supabase.from("incomes").insert(incomeInserts);
        if (incomeErr) {
          toast({
            title: "⚠️ 步驟 3a: 收入記錄建立失敗",
            description: incomeErr.message,
            variant: "destructive",
            duration: 8000,
          });
        } else {
          toast({
            title: "✅ 步驟 3a: 收入記錄已建立",
            description: `已建立 ${incomeInserts.length} 筆付款期記錄`,
            duration: 6000,
          });
        }
      }

      const { data: initExpRows, error: initExpFetchErr } = await supabase
        .from("project_initial_expenses")
        .select("id, n_expense_type_id, amount")
        .eq("bwf_pitching_id", pitchingId);

      if (initExpFetchErr) {
        toast({
          title: "⚠️ 步驟 3b: 無法讀取 L2 初始費用",
          description: initExpFetchErr.message,
          variant: "destructive",
          duration: 8000,
        });
      } else {
        const validInitExp = (initExpRows ?? []).filter(
          (row: { n_expense_type_id: string | null; amount: number | null }) =>
            row.n_expense_type_id && row.amount != null && row.amount >= 0,
        );
        if (validInitExp.length > 0) {
          const expenseInserts = validInitExp.map(
            (row: { n_expense_type_id: string | null; amount: number | null }) => ({
              bwf_project_id: newProjectId,
              installment_amount: row.amount || 0,
              outstanding: row.amount || 0,
              payment_status: null,
              n_supplier_type_id: row.n_expense_type_id || null,
              invoice_number: "1",
              real_creator_name: (staff as { name?: string })?.name || null,
              created_by_id: profile?.id || null,
              created_date: new Date().toISOString(),
              modified_date: new Date().toISOString(),
              paid_amount: null,
              supplier_id: null,
              factory_id: null,
              n_contract_type_id: null,
              project: null,
            }),
          );
          const { error: expenseErr } = await supabase.from("expenses").insert(expenseInserts);
          if (expenseErr) {
            toast({
              title: "⚠️ 步驟 3b: 支出記錄建立失敗",
              description: expenseErr.message,
              variant: "destructive",
              duration: 8000,
            });
          } else {
            // L2 stays linked via bwf_pitching_id only
            toast({
              title: "✅ 步驟 3b: 支出記錄已建立",
              description: `已從 L2 初始費用建立 ${expenseInserts.length} 筆支出記錄`,
              duration: 6000,
            });
          }
        }
      }

      if (projectForm.start_date || projectForm.handover_date) {
        try {
          const { data: startTask } = await supabase
            .from("project_schedule_tasks")
            .select("id")
            .eq("is_start_date", true)
            .limit(1)
            .single();
          const { data: handoverTask } = await supabase
            .from("project_schedule_tasks")
            .select("id")
            .eq("is_handover_date", true)
            .limit(1)
            .single();

          const scheduleRecords: Array<{
            bwf_project_id: string;
            date: string;
            working_schedule_id: string;
            main_pm_id: string | null;
            is_na: boolean;
            created_date: string;
            modified_date: string;
          }> = [];

          if (startTask && projectForm.start_date) {
            scheduleRecords.push({
              bwf_project_id: newProjectId,
              date: projectForm.start_date,
              working_schedule_id: startTask.id,
              main_pm_id: projectForm.main_pm_id || null,
              is_na: false,
              created_date: new Date().toISOString(),
              modified_date: new Date().toISOString(),
            });
          }
          if (handoverTask && projectForm.handover_date) {
            scheduleRecords.push({
              bwf_project_id: newProjectId,
              date: projectForm.handover_date,
              working_schedule_id: handoverTask.id,
              main_pm_id: projectForm.main_pm_id || null,
              is_na: false,
              created_date: new Date().toISOString(),
              modified_date: new Date().toISOString(),
            });
          }
          if (scheduleRecords.length > 0) {
            const { error: schedErr } = await supabase
              .from("project_schedules")
              .insert(scheduleRecords);
            if (schedErr) {
              toast({
                title: "⚠️ 步驟 3d: 排程記錄建立失敗",
                description: schedErr.message,
                variant: "destructive",
                duration: 8000,
              });
            } else {
              toast({
                title: "✅ 步驟 3d: S2 排程已建立",
                description: `已建立 ${scheduleRecords.length} 筆排程記錄`,
                duration: 6000,
              });
            }
          }
        } catch (schedError) {
          console.error("[BWFConvertDialog] schedule error:", schedError);
        }
      }

      try {
        const [{ data: pitchingBVs }, teamLeaderIds] = await Promise.all([
          supabase
            .from("pitching_bv")
            .select("handler_id")
            .eq("bwf_pitching_id", pitchingId),
          fetchActiveBwfTeamLeaderStaffIds(),
        ]);
        const fyId = projectForm.financial_year_id || data.n_financial_year_id || null;
        const teamId = data.n_team_type_id || null;
        const shares = buildBwfInitialProjectBvShares({
          pitchingHandlerIds: (pitchingBVs ?? []).map((pbv) => pbv.handler_id),
          teamLeaderIds,
        });
        const allBVRecords = shares.map((row) => ({
          handler_id: row.handler_id,
          bwf_project_id: newProjectId,
          ratio: row.ratio,
          n_financial_year_id: fyId,
          n_team_type_id: teamId,
        }));
        if (allBVRecords.length > 0) {
          const { error: bvErr } = await supabase.from("project_bv").insert(allBVRecords);
          if (bvErr) {
            toast({
              title: "⚠️ 步驟 4: BV 記錄建立失敗",
              description: bvErr.message,
              variant: "destructive",
              duration: 8000,
            });
          } else {
            toast({
              title: "✅ 步驟 4: BV 記錄已建立",
              description: `已建立 ${allBVRecords.length} 筆 BV 記錄`,
              duration: 6000,
            });
            void notifyProjectBvCreated(supabase, {
              rows: allBVRecords,
              assignerStaffId: staff?.id ?? null,
              assignerName: staff?.name ?? null,
              projectCode: data.pitching_code || projectForm.project_code,
              projectName: projectForm.project_name,
            });
          }
        }
      } catch (bvErr) {
        console.error("[BWFConvertDialog] project_bv error:", bvErr);
      }

      const step5bTables: Array<{
        table: string;
        pitchingCol: string;
        projectCol: string;
      }> = [
        { table: "bwf_orders", pitchingCol: "bwf_pitching_id", projectCol: "bwf_project_id" },
        { table: "internal_comments", pitchingCol: "bwf_pitching_id", projectCol: "bwf_project_id" },
      ];
      const step5bErrors: string[] = [];
      for (const { table, pitchingCol, projectCol } of step5bTables) {
        const { error: updateErr } = await supabase
          .from(table)
          .update({ [projectCol]: newProjectId })
          .eq(pitchingCol, pitchingId);
        if (updateErr) step5bErrors.push(`${table}: ${updateErr.message}`);
      }
      try {
        const { reattachDesignJobsToProject } = await import("@/lib/design-job-service");
        await reattachDesignJobsToProject({
          source: "bwf",
          pitchingId,
          projectId: newProjectId,
          projectJobType: "bwf_project",
        });
      } catch (designJobErr: any) {
        step5bErrors.push(`design_jobs: ${designJobErr?.message || "reattach failed"}`);
      }
      const { count: linkedOrderCount } = await supabase
        .from("bwf_orders")
        .select("id", { count: "exact", head: true })
        .eq("bwf_project_id", newProjectId);
      if (step5bErrors.length > 0) {
        toast({
          title: "⚠️ 步驟 5b: 部分關聯表更新失敗",
          description: step5bErrors.join("; "),
          variant: "destructive",
          duration: 8000,
        });
      } else {
        toast({
          title: "✅ 步驟 5b: 關聯表已更新",
          description:
            linkedOrderCount && linkedOrderCount > 0
              ? `已連結 ${linkedOrderCount} 筆訂單至新項目`
              : "提案關聯資料已連結至新項目",
          duration: 6000,
        });
      }

      // Step 5c: link Furniture 1000 bwf_quote → new bwf_project_id
      // and confirm the selected quote (status → 已確認)
      try {
        const quoteRes = await fetch("/api/bwf/quotes", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pitchingId,
            projectId: newProjectId,
            confirmQuoteId: selectedFurnitureQuoteId,
          }),
        });
        const quoteBody = (await quoteRes.json().catch(() => ({}))) as {
          updated?: number;
          quoteIds?: string[];
          confirmed?: { quote_id?: string; status?: string } | null;
          error?: string;
        };
        if (!quoteRes.ok) {
          toast({
            title: "⚠️ 步驟 5c: Furniture 報價連結失敗",
            description: quoteBody.error || `HTTP ${quoteRes.status}`,
            variant: "destructive",
            duration: 8000,
          });
        } else {
          const n = quoteBody.updated ?? 0;
          const confirmedId = quoteBody.confirmed?.quote_id;
          toast({
            title: "✅ 步驟 5c: Furniture 報價已連結",
            description: confirmedId
              ? `已確認報價 ${confirmedId}（狀態：已確認）${
                  n > 0 ? `；另連結 ${n} 筆至項目` : ""
                }`
              : n > 0
                ? `已將 ${n} 筆 bwf_quote 寫入 bwf_project_id`
                : "此提案尚無 Furniture 報價可連結",
            duration: 6000,
          });
        }
      } catch (quoteErr: unknown) {
        const message =
          quoteErr instanceof Error ? quoteErr.message : "未知錯誤";
        console.error("[BWFConvertDialog] link bwf_quote:", message);
        toast({
          title: "⚠️ 步驟 5c: Furniture 報價連結失敗",
          description: message,
          variant: "destructive",
          duration: 8000,
        });
      }

      onConfirm();
      toast({
        title: "✅ 步驟 5a: 提案階段已推進",
        description: "提案已推進至「Confirmed Project」階段",
        duration: 6000,
      });
      toast({
        title: "🎉 項目轉換完成！",
        description: "正在跳轉至項目詳情頁面...",
        duration: 4000,
      });
      setTimeout(() => {
        router.push(`/bwf/projects/${newProjectId}`);
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知錯誤";
      setProjectError(message);
      toast({ variant: "destructive", title: "❌ 轉換失敗", description: message });
    } finally {
      setCreatingProject(false);
    }
  };

  if (isEnquiryToPitching) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-blue-600 text-lg">
              <Play className="w-5 h-5" /> Enquiry → Pitching 轉換
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              請確認 L1 預算收入及支出均已填寫，且至少有一筆支出項目記錄，確認後將推進至「Pitching」階段
            </p>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-200px)]">
            <div className="px-6 py-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  L1 財務預算  Budget Estimation
                </h3>
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    此預計金額為記錄用途，轉換為項目後將無法更改，請謹慎填寫
                  </p>
                </div>

                <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                  <div className="space-y-1.5 max-w-sm">
                    <Label className="text-xs font-medium text-gray-600">
                      L1 預計收入 Estimated Income (HKD)
                      <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        $
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="pl-6"
                        value={l1Income}
                        onChange={(e) => setL1Income(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                      <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                      L1 預計支出 Estimated Expense (HKD)
                      <span className="text-red-500">*</span>
                    </Label>
                    {!l1Loading && !hasExpenseItems && (
                      <p className="text-xs text-amber-600">
                        至少需要新增一筆支出項目（金額可為 $0）
                      </p>
                    )}

                    {l1Loading ? (
                      <div className="flex items-center justify-center py-6 text-xs text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> 載入 L1 支出...
                      </div>
                    ) : (
                      <>
                        {expenseRows.map((row, idx) => (
                          <div
                            key={`${row.expense_type_id}-${idx}`}
                            className="grid grid-cols-[1fr_120px_36px] gap-2 items-center"
                          >
                            <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-700 truncate">
                              {typeLabel(row.expense_type_id)}
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-xs font-mono text-gray-700 text-right">
                              {formatMoney(parseFloat(row.amount || "0"), { showZero: true })}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0 text-red-400 hover:text-red-600"
                              onClick={() => removeExpenseRow(idx)}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}

                        {presetRows.map((preset) => (
                          <div
                            key={preset.id}
                            className="grid grid-cols-[1fr_120px_auto] gap-2 items-center border border-dashed border-violet-200 rounded-md p-2 bg-violet-50/40"
                          >
                            <span className="text-xs text-gray-700 truncate">
                              {preset.chinese_display || preset.display}
                            </span>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="$0"
                              value={presetAmounts[preset.id] || ""}
                              onChange={(e) =>
                                setPresetAmounts((prev) => ({
                                  ...prev,
                                  [preset.id]: e.target.value,
                                }))
                              }
                              onBlur={() => commitPresetAmount(preset.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitPresetAmount(preset.id);
                              }}
                              className="h-9 text-xs font-mono"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 text-xs"
                              onClick={() => commitPresetAmount(preset.id)}
                            >
                              新增
                            </Button>
                          </div>
                        ))}

                        <div className="border-t pt-3 grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                          <Select
                            value={newExpenseTypeId}
                            onValueChange={setNewExpenseTypeId}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="選擇支出類型..." />
                            </SelectTrigger>
                            <SelectContent>
                              {expenseTypeOptions.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.chinese_display || t.display}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="$0"
                            value={newExpenseAmount}
                            onChange={(e) => setNewExpenseAmount(e.target.value)}
                            className="h-9 text-xs font-mono"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={addExpenseRow}
                            disabled={!canAddExpense}
                          >
                            <Plus className="w-3.5 h-3.5" /> 新增
                          </Button>
                        </div>

                        <div className="border-t pt-3 grid grid-cols-2 gap-4 items-center">
                          <Label className="text-xs font-medium text-gray-600">
                            總計 L1 預計支出 Total Estimated Expense
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                              $
                            </span>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="pl-6 font-mono font-semibold disabled:bg-gray-50"
                              value={
                                hasExpenseItems ? String(listTotal) : ""
                              }
                              disabled
                              placeholder={hasExpenseItems ? undefined : "—"}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {conversionError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600 flex items-start gap-1 whitespace-pre-line">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {conversionError}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t bg-gray-50">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={advancingStage || savingConversion}
            >
              取消
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleEnquiryAdvance}
              disabled={advancingStage || savingConversion}
            >
              {advancingStage || savingConversion ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-1" />
              )}
              確認推進至 Pitching
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-emerald-600 text-lg">
            <CheckCircle2 className="w-5 h-5" /> Pitching → Confirmed Project 轉換
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            {conversionReadOnly
              ? "項目已建立，此頁面僅供查閱（僅 Super Admin 可修改）"
              : "確認後將建立正式項目並推進至「Confirmed Project」階段"}
          </p>
          {conversionReadOnly && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                此提案已完成項目轉換，轉換表單為唯讀模式。如需修改請聯絡 Super Admin。
              </p>
            </div>
          )}
          {!conversionReadOnly && linkedExistingProject && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                此提案已連結項目{" "}
                <span className="font-mono font-medium">
                  {linkedExistingProject.project_code || linkedExistingProject.id}
                </span>
                {linkedExistingProject.project_name
                  ? `（${linkedExistingProject.project_name}）`
                  : ""}
                。提交時可選擇建立新項目，或僅推進提案階段。
              </p>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-140px)]">
          <fieldset
            disabled={conversionReadOnly}
            className="min-w-0 border-0 p-0 m-0 disabled:opacity-100"
          >
            <div className="px-6 py-5 space-y-6">
              <div className="space-y-3">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full text-left"
                  onClick={() => setExpandVerifyInfo(!expandVerifyInfo)}
                >
                  <ClipboardList className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-gray-900">核對提案資訊 Verify Pitching Info</h3>
                  {expandVerifyInfo ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 ml-auto" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                  )}
                </button>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    請核對以下資料正確無誤，如需更改，請先返回上一頁編輯提案資料
                  </p>
                </div>
                {expandVerifyInfo && (
                  <div className="bg-gray-50 rounded-lg p-4 border space-y-4 text-sm">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="text-gray-500 text-xs">主要項目經理 Main PM</span>
                        <p className="font-medium">{data.pm_name || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">主要設計師 Main Designer</span>
                        <p className="font-medium">{data.designer_name || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">其他協助者 Other PM</span>
                        <p className="font-medium">{data.other_pm_name || data.more_pm_name || "N/A"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="text-gray-500 text-xs">服務類型 Service Type</span>
                        <p className="font-medium">{data.service_type_name || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">服務項目 Service Items</span>
                        <p className="font-medium">{data.service_item_name || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">查詢日期 Enquiry Date</span>
                        <p className="font-medium">
                          {data.enquiry_date ? data.enquiry_date.slice(0, 10) : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="text-gray-500 text-xs">主要報價 Major Quotes</span>
                        <p className="font-medium">{data.major_quote_name || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">客戶類型 Customer Type</span>
                        <p className="font-medium">{data.customer_type_name || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">來源 Source</span>
                        <p className="font-medium">{data.source_name || "N/A"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="text-gray-500 text-xs">地區 District</span>
                        <p className="font-medium">{data.district_name || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">工地位置 Site Address</span>
                        <p className="font-medium">{data.site_address || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">工地面積 Size</span>
                        <p className="font-medium">{data.size || data.actual_size || "N/A"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <span className="text-gray-500 text-xs">L1預算收入 Est. Income</span>
                        <p className="font-medium">
                          {data.estimated_income != null
                            ? formatMoney(Number(data.estimated_income))
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">L1預算支出 Est. Expense</span>
                        <p className="font-medium">
                          {data.estimated_expense != null
                            ? formatMoney(Number(data.estimated_expense))
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">預算毛利 Est. GP</span>
                        <p className="font-semibold text-emerald-600">
                          {data.estimated_income != null && data.estimated_expense != null
                            ? formatMoney(
                                Number(data.estimated_income) - Number(data.estimated_expense),
                                { showZero: true },
                              )
                            : formatMoney(0, { fallback: "$0", showZero: true })}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">預算毛利率 Est. GP ratio</span>
                        <p className="font-medium">{calcGPRatio}%</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <span className="text-sm text-gray-700">
                    我已確定上述資料正確無誤<span className="text-red-500">*</span>
                  </span>
                  <Checkbox
                    checked={verifyInfoConfirmed}
                    onCheckedChange={(checked) => setVerifyInfoConfirmed(checked === true)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  基本項目資訊 Basic Project Info
                </h3>
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        主要項目經理 Main PM<span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={projectForm.main_pm_id}
                        onValueChange={(v) =>
                          setProjectForm((f) => ({ ...f, main_pm_id: v }))
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select PM" />
                        </SelectTrigger>
                        <SelectContent>
                          {staffOptions.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        公司 Cost Center<span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={projectForm.cost_center_id}
                        onValueChange={(v) =>
                          setProjectForm((f) => ({ ...f, cost_center_id: v }))
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select Cost Center" />
                        </SelectTrigger>
                        <SelectContent>
                          {costCentreOptions.map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.bu_code ? `${cc.bu_code} - ` : ""}
                              {cc.display || "未命名"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        財政年度 Financial Year<span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={projectForm.financial_year_id}
                        onValueChange={(v) =>
                          setProjectForm((f) => ({ ...f, financial_year_id: v }))
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="選擇財政年度" />
                        </SelectTrigger>
                        <SelectContent>
                          {financialYearOptions.map((fy) => (
                            <SelectItem key={fy.id} value={fy.id}>
                              {fy.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      項目名稱 Project Name<span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={projectForm.project_name}
                      onChange={(e) =>
                        setProjectForm((f) => ({ ...f, project_name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      項目描述 Project Description<span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      rows={3}
                      value={projectForm.project_description}
                      onChange={(e) =>
                        setProjectForm((f) => ({
                          ...f,
                          project_description: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        查詢日期 Enquiry Date<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={projectForm.enquiry_date}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        簽約日期 Signed Date<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={projectForm.signed_date}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProjectForm((f) => ({ ...f, signed_date: val }));
                          const dates = computeEvenlyDistributedDates(
                            installmentCount,
                            val,
                            projectForm.handover_date,
                          );
                          setPaymentScheduleRows((rows) =>
                            rows.map((r, i) => ({ ...r, due_date: dates[i] || r.due_date })),
                          );
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        開始日期 Start Date<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={projectForm.start_date}
                        onChange={(e) =>
                          setProjectForm((f) => ({ ...f, start_date: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        交場日期 Handover Date<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={projectForm.handover_date}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProjectForm((f) => ({ ...f, handover_date: val }));
                          const dates = computeEvenlyDistributedDates(
                            installmentCount,
                            projectForm.signed_date,
                            val,
                          );
                          setPaymentScheduleRows((rows) =>
                            rows.map((r, i) => ({ ...r, due_date: dates[i] || r.due_date })),
                          );
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        項目編號 Project Code<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={projectForm.project_code || data.pitching_code || ""}
                        readOnly
                        className="bg-gray-100 font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">P2 Code</Label>
                      <Input
                        value={projectForm.p2_code}
                        readOnly
                        className="bg-gray-100 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">
                      傢俬報價 Furniture Quote
                    </Label>
                    <Select
                      value={selectedFurnitureQuoteId || undefined}
                      onValueChange={setSelectedFurnitureQuoteId}
                      disabled={
                        furnitureQuotesLoading ||
                        conversionReadOnly ||
                        furnitureQuotes.length === 0
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue
                          placeholder={
                            furnitureQuotesLoading
                              ? "載入報價中..."
                              : furnitureQuotesError
                                ? "傢俬報價載入失敗"
                                : furnitureQuotes.length === 0
                                  ? "尚無關聯報價"
                                  : "選擇關聯 Furniture 報價"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {furnitureQuotes.map((q) => (
                          <SelectItem key={q.id} value={q.id}>
                            {formatFurnitureQuoteOption(q)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!furnitureQuotesLoading && furnitureQuotesError && (
                      <p className="text-[11px] text-amber-600">
                        Furniture 連線失敗：{furnitureQuotesError}
                        （可仍繼續轉換，提交時需二次確認無報價）
                      </p>
                    )}
                    {!furnitureQuotesLoading &&
                      !furnitureQuotesError &&
                      furnitureQuotes.length === 0 && (
                      <p className="text-[11px] text-amber-600">
                        此提案尚無關聯的 Furniture 1000 報價。提交時需二次確認後仍可轉換項目。
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  L2 已簽署收入 Signed Income
                  <span className="text-red-500 text-xs">*必填</span>
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    此簽約金額為記錄用途，轉換為項目後將無法更改，請謹慎填寫
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">
                        輸入已簽署收入 Input Signed Income
                      </Label>
                      <Input
                        type="number"
                        value={projectForm.signed_income}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProjectForm((f) => ({ ...f, signed_income: val }));
                          const signedVal = parseFloat(val) || 0;
                          setPaymentScheduleRows((rows) =>
                            rows.map((r) => {
                              const ratio = parseFloat(r.ratio) || 0;
                              return {
                                ...r,
                                amount:
                                  signedVal > 0
                                    ? (signedVal * ratio / 100).toFixed(2)
                                    : "",
                              };
                            }),
                          );
                        }}
                        className="text-lg font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-gray-600">
                          分期付款期數 Number of Installments
                        </Label>
                        <span className="text-lg font-bold">{installmentCount}</span>
                      </div>
                      <Slider
                        value={[installmentCount]}
                        onValueChange={([val]) => handleInstallmentCountChange(val)}
                        min={1}
                        max={12}
                        step={1}
                        className="mt-3"
                      />
                    </div>
                  </div>
                  {paymentScheduleRows.length > 0 && (
                    <div className="space-y-2">
                      {paymentScheduleRows.map((row, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-[50px_140px_1fr_1fr] gap-2 items-center"
                        >
                          <span className="text-sm text-gray-500 text-center">第{idx + 1}期</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={`h-9 w-full justify-start text-xs font-normal px-2 ${
                                  !row.due_date ? "text-muted-foreground" : ""
                                }`}
                              >
                                <Calendar className="mr-1 h-3 w-3 shrink-0" />
                                {row.due_date || "選擇日期"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarPicker
                                mode="single"
                                selected={
                                  row.due_date
                                    ? new Date(row.due_date + "T00:00:00")
                                    : undefined
                                }
                                onSelect={(date) => {
                                  if (date) {
                                    handlePaymentRowChange(
                                      idx,
                                      "due_date",
                                      format(date, "yyyy-MM-dd"),
                                    );
                                  }
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Input
                            type="number"
                            value={row.ratio}
                            onChange={(e) =>
                              handlePaymentRowChange(idx, "ratio", e.target.value)
                            }
                            className="h-9 text-sm"
                          />
                          <Input
                            readOnly
                            value={row.amount ? formatMoney(parseFloat(row.amount)) : ""}
                            className="h-9 text-sm bg-gray-50 font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  L2 已簽署支出 Signed Expense
                  <span className="text-red-500 text-xs">*必填</span>
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    此簽約金額為記錄用途，轉換為項目後將無法更改，請謹慎填寫
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white"
                      onClick={duplicateL1Expenses}
                      disabled={importingL1}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {importingL1 ? "載入中..." : "匯入 L1 報價支出"}
                    </Button>
                  </div>
                  {signedExpenseLoading ? (
                    <div className="flex items-center justify-center py-4 text-xs text-gray-400 gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> 載入 L2 初始費用...
                    </div>
                  ) : (
                    <>
                      {signedExpenseRows.map((row, idx) => (
                        <div
                          key={row.id || idx}
                          className="grid grid-cols-[1fr_120px_36px] gap-2 items-center"
                        >
                          <Select
                            value={row.expense_type_id}
                            onValueChange={(v) =>
                              handleSignedExpenseChange(idx, "expense_type_id", v)
                            }
                            disabled={signedExpenseSaving || conversionReadOnly}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="選擇支出類型..." />
                            </SelectTrigger>
                            <SelectContent>
                              {expenseTypeOptions.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.chinese_display || t.display}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => patchSignedExpenseAmount(idx, e.target.value)}
                            onBlur={() => handleSignedExpenseAmountBlur(idx)}
                            className="h-9 text-xs font-mono"
                            disabled={signedExpenseSaving || conversionReadOnly}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0 text-red-400 hover:text-red-600"
                            onClick={() => removeSignedExpenseRow(idx)}
                            disabled={signedExpenseSaving || conversionReadOnly}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                      {signedPresetRows.map((preset) => (
                        <div
                          key={`signed-preset-${preset.id}`}
                          className="grid grid-cols-[1fr_120px_auto] gap-2 items-center border border-dashed border-gray-200 rounded-md p-2 bg-gray-50/60"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-gray-500 truncate">
                              {preset.chinese_display || preset.display}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] text-gray-400 border-gray-200 shrink-0"
                            >
                              預設
                            </Badge>
                          </div>
                          {conversionReadOnly ? (
                            <span className="block text-right text-xs text-gray-300">—</span>
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="輸入金額"
                              value={signedPresetAmounts[preset.id] ?? ""}
                              onChange={(e) =>
                                setSignedPresetAmounts((prev) => ({
                                  ...prev,
                                  [preset.id]: e.target.value,
                                }))
                              }
                              onBlur={() => commitSignedPresetAmount(preset.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  commitSignedPresetAmount(preset.id);
                                }
                              }}
                              disabled={
                                savingSignedPresetId === preset.id || signedExpenseSaving
                              }
                              className="h-9 text-xs font-mono border-dashed border-gray-300 bg-white/80 placeholder:text-gray-300"
                            />
                          )}
                          <div className="flex items-center justify-end min-w-[4.5rem]">
                            {savingSignedPresetId === preset.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                            ) : (
                              <span className="text-[10px] text-gray-300 whitespace-nowrap">
                                輸入後保存
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="border-t pt-3 grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                        <Select
                          value={signedNewExpenseTypeId}
                          onValueChange={setSignedNewExpenseTypeId}
                        >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="選擇支出類型..." />
                            </SelectTrigger>
                            <SelectContent>
                              {expenseTypeOptions.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.chinese_display || t.display}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="$0"
                            value={signedNewExpenseAmount}
                            onChange={(e) => setSignedNewExpenseAmount(e.target.value)}
                            className="h-9 text-xs font-mono"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={addSignedExpenseRow}
                            disabled={!canAddExpenseRow || signedExpenseSaving}
                          >
                          <Plus className="w-3.5 h-3.5" /> 新增
                        </Button>
                      </div>
                    </>
                  )}
                  <div className="border-t pt-3">
                    <Label className="text-xs font-medium text-gray-600">
                      總計已簽署支出 Total Signed Expense
                    </Label>
                    <div className="bg-gray-50 border rounded-md px-3 py-2 mt-1">
                      <span className="text-sm font-mono font-semibold">
                        {totalSignedExpense > 0
                          ? formatMoney(totalSignedExpense)
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {projectError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600 flex items-start gap-1 whitespace-pre-line">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {projectError}
                  </p>
                </div>
              )}
            </div>
          </fieldset>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t bg-gray-50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={advancingStage || creatingProject}
          >
            {conversionReadOnly ? "關閉" : "取消"}
          </Button>
          {!conversionReadOnly && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCreateProject}
              disabled={advancingStage || creatingProject || generatingCode}
            >
              {advancingStage || creatingProject ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1" />
              )}
              確認建立項目並推進
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog
      open={showLinkedProjectChoice && noQuoteConfirmStep === 0}
      onOpenChange={(open) => {
        if (!open) setShowLinkedProjectChoice(false);
      }}
    >
      <AlertDialogContent className="z-[100]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            已有連結項目
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                此提案已連結項目{" "}
                <span className="font-mono font-medium text-foreground">
                  {linkedExistingProject?.project_code ||
                    linkedExistingProject?.id}
                </span>
                {linkedExistingProject?.project_name
                  ? `（${linkedExistingProject.project_name}）`
                  : ""}
                。
              </p>
              <p>請選擇本次轉換要執行的操作：</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2 sm:space-x-0">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={creatingProject || advancingStage}
            onClick={() => {
              void continueCreateNewPath();
            }}
          >
            建立新項目（完整轉換流程）
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={creatingProject || advancingStage}
            onClick={() => {
              void executeStatusOnly();
            }}
          >
            {creatingProject || advancingStage ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                處理中…
              </>
            ) : (
              "僅推進階段（不建立新項目）"
            )}
          </Button>
          <AlertDialogCancel
            className="w-full mt-0"
            disabled={creatingProject || advancingStage}
          >
            取消
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      open={noQuoteConfirmStep > 0 && !showLinkedProjectChoice}
      onOpenChange={(open) => {
        if (!open) setNoQuoteConfirmStep(0);
      }}
    >
      <AlertDialogContent className="z-[100]">
        {noQuoteConfirmStep === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                確認：此項目將無傢俬報價
              </AlertDialogTitle>
              <AlertDialogDescription>
                尚未選擇 Furniture Quote。繼續轉換後，此項目將不會有傢俬報價記錄。確定要繼續嗎？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={creatingProject}>取消</AlertDialogCancel>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={creatingProject}
                onClick={() => setNoQuoteConfirmStep(2)}
              >
                我了解，繼續
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                二次確認：仍要建立無報價項目？
              </AlertDialogTitle>
              <AlertDialogDescription>
                請再次確認：此項目將不關聯任何傢俬報價記錄，您仍要繼續建立項目並推進提案階段。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                variant="outline"
                disabled={creatingProject}
                onClick={() => setNoQuoteConfirmStep(1)}
              >
                返回
              </Button>
              <AlertDialogAction
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={creatingProject}
                onClick={() => {
                  void executeCreateProject();
                }}
              >
                {creatingProject ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    建立中…
                  </>
                ) : (
                  "確認建立（無報價）"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
