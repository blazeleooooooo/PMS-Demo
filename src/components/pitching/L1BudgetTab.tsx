"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  DollarSign,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  AlertCircle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { fetchSupplierTypes } from "@/lib/data/finance";
import { useToast } from "@/components/ui/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { useFinancialFormat } from "@/hooks/use-financial-format";
// ─── TYPES ─────────────────────────────────────
interface QuotationExpense {
  id: string;
  amount: number | null;
  n_expense_type_id: string | null;
  expense_type_name: string | null;
  created_by_id: string | null;
  created_by_name: string | null;
  created_date: string | null;
}

interface ExpenseTypeOption {
  id: string;
  display: string;
  chinese_display: string | null;
}

interface L1BudgetTabProps {
  pitchingId: string;
  estimatedIncome: number | null;
  estimatedExpense: number | null;
  onDataChanged?: () => void;
  /** Override the permission module used for CRUD checks. Defaults to "proposals.l1-budget". */
  permissionModule?: string;
  /** BWA uses pitching_id + bwa_pitchings; BWF uses bwf_pitching_id + bwf_pitchings. */
  variant?: "bwa" | "bwf";
}


function formatPercent(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "0%";
  return `${val.toFixed(1)}%`;
}

// ─── MAIN COMPONENT ────────────────────────────
export default function L1BudgetTab({
  pitchingId,
  estimatedIncome: initialIncome,
  estimatedExpense: initialExpense,
  onDataChanged,
  permissionModule = "proposals.l1-budget",
  variant = "bwa",
}: L1BudgetTabProps) {
  const pitchingFkColumn = variant === "bwf" ? "bwf_pitching_id" : "pitching_id";
  const pitchingTable = variant === "bwf" ? "bwf_pitchings" : "bwa_pitchings";
  const supabase = createClient();
  const { toast } = useToast();
  const { canCreate: canCreatePerm, canEdit: canEditPerm, canDelete: canDeletePerm } = usePermission();
  const { formatMoney } = useFinancialFormat();
  const _canCreate = canCreatePerm(permissionModule);
  const _canEdit = canEditPerm(permissionModule);
  const _canDelete = canDeletePerm(permissionModule);

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expenses, setExpenses] = useState<QuotationExpense[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeOption[]>([]);
  const [estimatedIncome, setEstimatedIncome] = useState<number>(initialIncome ?? 0);
  const [incomeEditing, setIncomeEditing] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");

  // Dialog state for add/edit expense
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<QuotationExpense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    n_expense_type_id: "",
  });
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bwfPresetTypes, setBwfPresetTypes] = useState<ExpenseTypeOption[]>([]);
  const [presetAmounts, setPresetAmounts] = useState<Record<string, string>>({});
  const [savingPresetId, setSavingPresetId] = useState<string | null>(null);

  const savedExpenseTypeIds = useMemo(
    () => new Set(expenses.map((e) => e.n_expense_type_id).filter(Boolean)),
    [expenses]
  );
  const bwfPresetRows = useMemo(() => {
    if (variant !== "bwf") return [];
    return bwfPresetTypes.filter((t) => !savedExpenseTypeIds.has(t.id));
  }, [variant, bwfPresetTypes, savedExpenseTypeIds]);
  const showExpenseTable = expenses.length > 0 || bwfPresetRows.length > 0;

  // Computed
  const totalExpense = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const grossProfit = estimatedIncome - totalExpense;
  const marginPercent = estimatedIncome > 0 ? (grossProfit / estimatedIncome) * 100 : 0;

  // ─── FETCH DATA ────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch quotation_expenses for this pitching
      const { data: expData, error: expErr } = await supabase
        .from("quotation_expenses")
        .select("id, amount, n_expense_type_id, created_by_id, created_date")
        .eq(pitchingFkColumn, pitchingId)
        .order("created_date", { ascending: true });

      if (expErr) {
        console.error("[L1BudgetTab] Error fetching expenses:", expErr.message);
      }

      const assignedTypeIds = (expData ?? []).map((e: any) => e.n_expense_type_id);
      const types = await fetchSupplierTypes(assignedTypeIds);
      setExpenseTypes(types);

      if (variant === "bwf") {
        setBwfPresetTypes(types.filter((t) => t.is_bwf === true && t.is_active !== false));
      } else {
        setBwfPresetTypes([]);
      }

      // Build a type name map
      const typeMap: Record<string, string> = {};
      types.forEach((t) => {
        typeMap[t.id] = t.chinese_display || t.display;
      });

      // Resolve creator names
      const creatorIds = [...new Set((expData ?? []).map((e: any) => e.created_by_id).filter(Boolean))];
      let creatorMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: userData } = await supabase
          .from("users")
          .select("id, name")
          .in("id", creatorIds);
        (userData ?? []).forEach((u: any) => {
          creatorMap[u.id] = u.name || "";
        });
      }

      setExpenses(
        (expData ?? []).map((e: any) => ({
          id: e.id,
          amount: e.amount,
          n_expense_type_id: e.n_expense_type_id,
          expense_type_name: e.n_expense_type_id ? typeMap[e.n_expense_type_id] || null : null,
          created_by_id: e.created_by_id,
          created_by_name: e.created_by_id ? creatorMap[e.created_by_id] || null : null,
          created_date: e.created_date,
        }))
      );
    } catch (err) {
      console.error("[L1BudgetTab] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, [pitchingId, pitchingFkColumn, supabase, variant]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync income from props
  useEffect(() => {
    setEstimatedIncome(initialIncome ?? 0);
  }, [initialIncome]);

  // ─── INCOME SAVE ───────────────────────────────
  const handleIncomeSave = async () => {
    const newVal = parseFloat(incomeInput);
    if (isNaN(newVal) || newVal < 0) {
      toast({ title: "錯誤", description: "請輸入有效金額", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          table: pitchingTable,
          id: pitchingId,
          updates: {
            estimated_income: newVal,
            modified_date: new Date().toISOString(),
          },
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("伺服器錯誤");
      }
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "更新失敗");

      setEstimatedIncome(newVal);
      setIncomeEditing(false);
      toast({ title: "已更新", description: "L1 預計收入已保存" });
      onDataChanged?.();
    } catch (err: any) {
      toast({ title: "錯誤", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── SYNC ESTIMATED EXPENSE TO PITCHING ────────
  const syncExpenseToParent = async (newTotal: number) => {
    try {
      await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          table: pitchingTable,
          id: pitchingId,
          updates: {
            estimated_expense: newTotal,
            modified_date: new Date().toISOString(),
          },
        }),
      });
      onDataChanged?.();
    } catch (err) {
      console.error("[L1BudgetTab] Error syncing expense total:", err);
    }
  };

  // ─── SYNC EXPENSE TOTAL AFTER CRUD ─────────────
  const refreshExpenseTotal = async () => {
    const updatedExpenses = await supabase
      .from("quotation_expenses")
      .select("amount")
      .eq(pitchingFkColumn, pitchingId);
    const newTotal = (updatedExpenses.data ?? []).reduce(
      (sum: number, e: any) => sum + (e.amount ?? 0),
      0
    );
    await syncExpenseToParent(newTotal);
  };

  const createExpenseRecord = async (amount: number, nExpenseTypeId: string) => {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        table: "quotation_expenses",
        data: {
          amount,
          n_expense_type_id: nExpenseTypeId,
          [pitchingFkColumn]: pitchingId,
          created_date: new Date().toISOString(),
          modified_date: new Date().toISOString(),
        },
      }),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || "新增失敗");
  };

  // ─── ADD / EDIT EXPENSE ────────────────────────
  const openAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({ amount: "", n_expense_type_id: "" });
    setExpenseDialogOpen(true);
  };

  const openEditExpense = (exp: QuotationExpense) => {
    setEditingExpense(exp);
    setExpenseForm({
      amount: exp.amount?.toString() ?? "",
      n_expense_type_id: exp.n_expense_type_id ?? "",
    });
    setExpenseDialogOpen(true);
  };

  const handleExpenseSave = async () => {
    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "錯誤", description: "請輸入有效金額", variant: "destructive" });
      return;
    }
    if (!expenseForm.n_expense_type_id) {
      toast({ title: "錯誤", description: "請選擇費用類型", variant: "destructive" });
      return;
    }

    setExpenseSaving(true);
    try {
      if (editingExpense) {
        // Update
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            table: "quotation_expenses",
            id: editingExpense.id,
            updates: {
              amount,
              n_expense_type_id: expenseForm.n_expense_type_id,
              modified_date: new Date().toISOString(),
            },
          }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "更新失敗");
        toast({ title: "已更新", description: "費用項目已更新" });
      } else {
        await createExpenseRecord(amount, expenseForm.n_expense_type_id);
        toast({ title: "已新增", description: "費用項目已新增" });
      }

      setExpenseDialogOpen(false);
      await fetchData();
      await refreshExpenseTotal();
    } catch (err: any) {
      toast({ title: "錯誤", description: err.message, variant: "destructive" });
    } finally {
      setExpenseSaving(false);
    }
  };

  // ─── DELETE EXPENSE ────────────────────────────
  const handleDeleteExpense = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          table: "quotation_expenses",
          id,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "刪除失敗");

      toast({ title: "已刪除", description: "費用項目已刪除" });
      await fetchData();
      await refreshExpenseTotal();
    } catch (err: any) {
      toast({ title: "錯誤", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handlePresetAmountCommit = async (typeId: string) => {
    const raw = presetAmounts[typeId]?.trim() ?? "";
    if (!raw) return;

    const amount = parseFloat(raw);
    if (isNaN(amount) || amount <= 0) {
      setPresetAmounts((prev) => {
        const next = { ...prev };
        delete next[typeId];
        return next;
      });
      return;
    }

    setSavingPresetId(typeId);
    try {
      await createExpenseRecord(amount, typeId);
      toast({ title: "已新增", description: "費用項目已新增" });
      setPresetAmounts((prev) => {
        const next = { ...prev };
        delete next[typeId];
        return next;
      });
      await fetchData();
      await refreshExpenseTotal();
    } catch (err: any) {
      toast({ title: "錯誤", description: err.message, variant: "destructive" });
    } finally {
      setSavingPresetId(null);
    }
  };

  // ─── GAUGE HELPERS ─────────────────────────────
  const expenseRatio = estimatedIncome > 0 ? (totalExpense / estimatedIncome) * 100 : 0;
  const isHealthy = marginPercent >= 30;
  const isWarning = marginPercent >= 15 && marginPercent < 30;
  const isDanger = marginPercent < 15;

  // ─── PIE CHART: Income Composition (Expenses + Gross Profit = Income) ───
  const PIE_COLORS = [
    "#3B82F6", "#F59E0B", "#7C3AED", "#10B981",
    "#F43F5E", "#06B6D4", "#F97316", "#6366F1",
    "#14B8A6", "#EC4899", "#84CC16", "#0EA5E9",
  ];
  const incomeCompositionData = useMemo(() => {
    const data: { name: string; value: number; color: string }[] = [];
    // Each expense type as a slice
    expenses.forEach((exp, i) => {
      if ((exp.amount ?? 0) > 0) {
        data.push({
          name: exp.expense_type_name || "未分類",
          value: exp.amount ?? 0,
          color: PIE_COLORS[i % PIE_COLORS.length],
        });
      }
    });
    // Gross profit slice (only if positive)
    if (grossProfit > 0) {
      data.push({
        name: "毛利 Gross Profit",
        value: grossProfit,
        color: "#10B981",
      });
    }
    return data;
  }, [expenses, grossProfit]);

  // ─── LOADING STATE ─────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500 text-sm">載入 L1 預算資料...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── L1 ESTIMATED INCOME ──────────────────── */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-blue-500" />
              </div>
              <CardTitle className="text-base font-semibold text-gray-800">
                L1 預計收入 Estimated Income
              </CardTitle>
            </div>
            {!incomeEditing && _canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500 hover:text-blue-600"
                onClick={() => {
                  setIncomeInput(estimatedIncome.toString());
                  setIncomeEditing(true);
                }}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" /> 編輯
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-4 px-5">
          <Separator className="mb-3" />
          {incomeEditing ? (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-gray-500 mb-1 block">預計收入金額 (HKD)</Label>
                <Input
                  type="number"
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  placeholder="輸入預計收入"
                  className="text-lg font-semibold"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-1.5 mt-5">
                <Button
                  size="sm"
                  onClick={handleIncomeSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span className="ml-1">保存</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIncomeEditing(false)}
                  disabled={saving}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 font-mono-num tracking-tight">
                {formatMoney(estimatedIncome)}
              </span>
              <span className="text-xs text-gray-400">HKD</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── L1 ESTIMATED EXPENSE LIST ────────────── */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-amber-500" />
              </div>
              <CardTitle className="text-base font-semibold text-gray-800">
                L1 預計支出 Estimated Expense
              </CardTitle>
              <Badge variant="outline" className="text-xs ml-1">
                {expenses.length} 項
              </Badge>
            </div>
            {_canCreate && (
              <Button
                size="sm"
                onClick={openAddExpense}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> 新增費用
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-4 px-5">
          <Separator className="mb-3" />
          {!showExpenseTable ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <DollarSign className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">尚無費用項目</p>
              <p className="text-xs text-gray-300 mt-1">點擊「新增費用」添加第一筆預計支出</p>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <div className="col-span-5">費用類型</div>
                <div className="col-span-3 text-right">金額 (HKD)</div>
                <div className="col-span-2 text-right">佔比</div>
                <div className="col-span-2 text-right">操作</div>
              </div>
              <Separator />
              {expenses.map((exp, idx) => {
                const pct = totalExpense > 0 ? ((exp.amount ?? 0) / totalExpense) * 100 : 0;
                return (
                  <div
                    key={exp.id}
                    className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center text-sm hover:bg-gray-50/80 transition-colors ${
                      idx < expenses.length - 1 || bwfPresetRows.length > 0 ? "border-b border-gray-50" : ""
                    }`}
                  >
                    <div className="col-span-5 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span className="font-medium text-gray-700 truncate">
                        {exp.expense_type_name || "未分類"}
                      </span>
                    </div>
                    <div className="col-span-3 text-right font-mono font-semibold text-gray-800">
                      {formatMoney(exp.amount)}
                    </div>
                    <div className="col-span-2 text-right">
                      <Badge variant="outline" className="text-xs font-mono">
                        {pct.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      {_canEdit && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
                              onClick={() => openEditExpense(exp)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><span className="text-xs">編輯</span></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      )}
                      {_canDelete && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                              onClick={() => handleDeleteExpense(exp.id)}
                              disabled={deletingId === exp.id}
                            >
                              {deletingId === exp.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><span className="text-xs">刪除</span></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      )}
                    </div>
                  </div>
                );
              })}
              {bwfPresetRows.map((preset, idx) => (
                <div
                  key={`preset-${preset.id}`}
                  className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center text-sm border border-dashed border-gray-200 bg-gray-50/60 rounded-md my-1.5 ${
                    idx < bwfPresetRows.length - 1 ? "" : ""
                  }`}
                >
                  <div className="col-span-5 flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    <span className="font-medium text-gray-500 truncate">
                      {preset.chinese_display || preset.display}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-200 shrink-0">
                      預設
                    </Badge>
                  </div>
                  <div className="col-span-3">
                    {_canCreate ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="輸入金額"
                        value={presetAmounts[preset.id] ?? ""}
                        onChange={(e) =>
                          setPresetAmounts((prev) => ({
                            ...prev,
                            [preset.id]: e.target.value,
                          }))
                        }
                        onBlur={() => handlePresetAmountCommit(preset.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handlePresetAmountCommit(preset.id);
                          }
                        }}
                        disabled={savingPresetId === preset.id}
                        className="h-8 text-right font-mono text-sm border-dashed border-gray-300 bg-white/80 placeholder:text-gray-300"
                      />
                    ) : (
                      <span className="block text-right text-gray-300">—</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    <Badge variant="outline" className="text-xs font-mono text-gray-300 border-gray-200">
                      —
                    </Badge>
                  </div>
                  <div className="col-span-2 flex items-center justify-end">
                    {savingPresetId === preset.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                    ) : (
                      <span className="text-[11px] text-gray-300">輸入後保存</span>
                    )}
                  </div>
                </div>
              ))}
              {/* Total row */}
              <Separator className="mt-1" />
              <div className="grid grid-cols-12 gap-2 px-3 py-3 items-center">
                <div className="col-span-5 text-sm font-semibold text-gray-600">
                  合計 Total
                </div>
                <div className="col-span-3 text-right font-mono font-bold text-gray-900 text-base">
                  {formatMoney(totalExpense)}
                </div>
                <div className="col-span-2 text-right">
                  <Badge className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50 text-xs font-mono">
                    100%
                  </Badge>
                </div>
                <div className="col-span-2" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── L1 ANALYSIS / INDICATORS ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Merged: Gross Profit + Margin % Card */}
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                grossProfit >= 0 ? "bg-emerald-50" : "bg-red-50"
              }`}>
                {grossProfit >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
              </div>
              <span className="text-xs text-gray-500 font-medium">L1 毛利 Gross Profit & Margin</span>
            </div>
            {/* Gross Profit amount + Margin % side by side */}
            <div className="flex items-baseline gap-3">
              <div className={`text-2xl font-bold font-mono-num ${
                grossProfit >= 0 ? "text-emerald-600" : "text-red-600"
              }`}>
                {formatMoney(grossProfit)}
              </div>
              <div className={`text-lg font-bold font-mono-num ${
                isHealthy ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-600"
              }`}>
                {formatPercent(marginPercent)}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">收入 − 支出 = 毛利</p>
            {/* Visual bar */}
            <div className="mt-2.5 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isHealthy ? "bg-emerald-500" : isWarning ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(Math.max(marginPercent, 0), 100)}%` }}
              />
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              {isDanger && (
                <div className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="w-3 h-3" />
                  <span>毛利率偏低</span>
                </div>
              )}
              {isHealthy && (
                <span className="text-xs text-emerald-500">✓ 健康水平</span>
              )}
              {isWarning && (
                <span className="text-xs text-amber-500">⚠ 注意利潤</span>
              )}
            </div>
            {/* Breakdown mini */}
            <div className="mt-3 space-y-1 border-t pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">收入</span>
                <span className="font-mono text-gray-600">{formatMoney(estimatedIncome)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">支出</span>
                <span className="font-mono text-gray-600">{formatMoney(totalExpense)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-gray-500">淨額</span>
                <span className={`font-mono ${grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatMoney(grossProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Income Composition Pie Chart Card */}
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <PieChartIcon className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-xs text-gray-500 font-medium">收入結構 Income Composition</span>
            </div>
            <p className="text-[12px] text-gray-400 mb-1">整個餅圖 = L1 預計收入 {formatMoney(estimatedIncome)}</p>
            {estimatedIncome > 0 ? (
              <div className="w-full h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomeCompositionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      strokeWidth={1}
                      stroke="#fff"
                    >
                      {incomeCompositionData.map((entry: { color: string }, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => formatMoney(value)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
                    />
                    <Legend
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10, lineHeight: "14px" }}
                      formatter={(value: string) => <span className="text-gray-600">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-xs text-gray-400">
                暫無收入數據
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense Ratio Card */}
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-violet-500" />
              </div>
              <span className="text-xs text-gray-500 font-medium">支出佔收入 Expense Ratio</span>
            </div>
            <div className="text-2xl font-bold font-mono-num text-violet-600">
              {formatPercent(expenseRatio)}
            </div>
            {/* Breakdown mini list */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">收入</span>
                <span className="font-mono text-gray-600">{formatMoney(estimatedIncome)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">支出</span>
                <span className="font-mono text-gray-600">{formatMoney(totalExpense)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-gray-500">淨額</span>
                <span className={`font-mono ${grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatMoney(grossProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense Breakdown Bar (visual) */}
      {expenses.length > 0 && (
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-gray-500" />
              </div>
              <CardTitle className="text-base font-semibold text-gray-800">
                支出分佈 Expense Breakdown
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4 px-5">
            <Separator className="mb-3" />
            {/* Stacked bar */}
            <div className="h-8 rounded-lg overflow-hidden flex bg-gray-100">
              {expenses.map((exp, i) => {
                const pct = totalExpense > 0 ? ((exp.amount ?? 0) / totalExpense) * 100 : 0;
                const colors = [
                  "bg-blue-500", "bg-amber-500", "bg-violet-500", "bg-emerald-500",
                  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
                  "bg-teal-500", "bg-pink-500", "bg-lime-500", "bg-sky-500",
                ];
                return (
                  <TooltipProvider key={exp.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`${colors[i % colors.length]} h-full transition-all duration-300 hover:opacity-80`}
                          style={{ width: `${pct}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs">
                          <div className="font-semibold">{exp.expense_type_name || "未分類"}</div>
                          <div className="font-mono">{formatMoney(exp.amount)} ({pct.toFixed(1)}%)</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3">
              {expenses.map((exp, i) => {
                const colors = [
                  "bg-blue-500", "bg-amber-500", "bg-violet-500", "bg-emerald-500",
                  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
                  "bg-teal-500", "bg-pink-500", "bg-lime-500", "bg-sky-500",
                ];
                return (
                  <div key={exp.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <div className={`w-2.5 h-2.5 rounded-sm ${colors[i % colors.length]}`} />
                    <span>{exp.expense_type_name || "未分類"}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── ADD/EDIT EXPENSE DIALOG ──────────────── */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingExpense ? "編輯費用項目" : "新增費用項目"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">費用類型 Expense Type</Label>
              <Select
                value={expenseForm.n_expense_type_id}
                onValueChange={(val) => setExpenseForm((f) => ({ ...f, n_expense_type_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇費用類型..." />
                </SelectTrigger>
                <SelectContent>
                  {expenseTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.chinese_display || t.display}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">金額 Amount (HKD)</Label>
              <Input
                type="number"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="輸入金額"
                className="font-mono text-lg"
                min={0}
                step={0.01}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setExpenseDialogOpen(false)}
              disabled={expenseSaving}
            >
              取消
            </Button>
            <Button
              onClick={handleExpenseSave}
              disabled={expenseSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {expenseSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" /> 保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" /> {editingExpense ? "更新" : "新增"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
