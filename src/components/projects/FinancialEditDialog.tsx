"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Minus, Save, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchSupplierTypes,
  fetchContractTypes,
  updateBWAProject,
  updateBWAPitching,
  updateBWFProject,
  updateBWFPitching,
  type SupplierTypeOption,
  type ContractTypeOption,
} from "@/lib/data-service";
import { useFinancialFormat } from "@/hooks/use-financial-format";

type FinancialEntityType = "bwa_project" | "bwf_project";

// ─── A single editable list row (type + amount) ──────────────
interface Row {
  id?: string;        // existing DB row id (undefined = new)
  type_id: string;    // supplier_types.id (expense) or nos_contracts.id (income)
  amount: string;     // text input value
}

interface TypeOption {
  id: string;
  display: string;
  chinese_display: string | null;
}

const sumRows = (rows: Row[]) =>
  rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

// ─── Reusable list editor (TOP-LEVEL so it doesn't remount on
// every keystroke — that remount was stealing input focus). ───
function ListEditor({
  rows,
  options,
  label,
  accent,
  accentIcon,
  typePlaceholder,
  onChangeRow,
  onAddRow,
  onRemoveRow,
  formatMoney,
  canViewFinancialValues,
  financialMask,
}: {
  rows: Row[];
  options: TypeOption[];
  label: string;
  accent: string;
  accentIcon: "up" | "down";
  typePlaceholder: string;
  onChangeRow: (idx: number, patch: Partial<Row>) => void;
  onAddRow: () => void;
  onRemoveRow: (idx: number) => void;
  formatMoney: (val: number | null | undefined) => string;
  canViewFinancialValues: boolean;
  financialMask: string;
}) {
  const Icon = accentIcon === "up" ? TrendingUp : TrendingDown;
  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${accent}`} /> {label}
          <span className="text-gray-400 font-normal">({rows.length})</span>
        </span>
        <span className="text-xs font-mono font-semibold text-gray-800">{formatMoney(sumRows(rows))}</span>
      </div>
      <Separator />
      {rows.map((r, idx) => (
        <div key={r.id || `new-${idx}`} className="grid grid-cols-[1fr_120px_32px] gap-2 items-center">
          <Select value={r.type_id} onValueChange={(v) => onChangeRow(idx, { type_id: v })} disabled={!canViewFinancialValues}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={typePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.chinese_display || t.display}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type={canViewFinancialValues ? "number" : "text"}
            min={0}
            step="0.01"
            value={canViewFinancialValues ? r.amount : financialMask}
            onChange={(e) => onChangeRow(idx, { amount: e.target.value })}
            placeholder="$0"
            className="h-8 text-xs font-mono"
            disabled={!canViewFinancialValues}
            readOnly={!canViewFinancialValues}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
            onClick={() => onRemoveRow(idx)}
            disabled={!canViewFinancialValues}
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs w-full border-dashed"
        onClick={onAddRow}
        disabled={!canViewFinancialValues}
      >
        <Plus className="w-3.5 h-3.5 mr-1" /> 新增項目
      </Button>
    </div>
  );
}

// Read-only computed figure box.
function CalcBox({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "profit" | "loss" | "default" }) {
  const color =
    tone === "profit" ? "text-emerald-600" : tone === "loss" ? "text-red-600" : "text-gray-700";
  return (
    <div>
      <Label className="text-xs text-gray-500 mb-1 block">{label}</Label>
      <div className={`h-9 flex items-center px-3 bg-gray-50 border border-gray-200 rounded-md text-sm font-mono ${color}`}>
        {value}
      </div>
    </div>
  );
}

interface FinancialEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  pitchingId: string | null;
  /** Current project manual income, to seed the form. */
  projectEstIncome: number | null;
  onSaved: () => void;
  /** BWA uses project_id / pitching_id; BWF uses bwf_project_id / bwf_pitching_id. */
  entityType?: FinancialEntityType;
}

export default function FinancialEditDialog({
  open,
  onOpenChange,
  projectId,
  pitchingId,
  projectEstIncome,
  onSaved,
  entityType = "bwa_project",
}: FinancialEditDialogProps) {
  const { toast } = useToast();
  const supabase = createClient();
  const { formatMoney, canViewFinancialValues, financialMask } = useFinancialFormat();
  const listEditorFinancialProps = {
    formatMoney: (val: number | null | undefined) => formatMoney(val, { showZero: true }),
    canViewFinancialValues,
    financialMask,
  };

  const isBwf = entityType === "bwf_project";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expenseTypes, setExpenseTypes] = useState<SupplierTypeOption[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractTypeOption[]>([]);

  // Manual income inputs.
  const [pitchIncome, setPitchIncome] = useState("");
  const [projIncome, setProjIncome] = useState("");

  // Editable lists.
  const [l1Rows, setL1Rows] = useState<Row[]>([]);     // quotation_expenses (pitching L1)
  const [l2Rows, setL2Rows] = useState<Row[]>([]);     // project_initial_expenses (project L2)
  const [l3ExpRows, setL3ExpRows] = useState<Row[]>([]); // expenses (project L3 actual)
  const [l3IncRows, setL3IncRows] = useState<Row[]>([]); // incomes (project L3 actual)
  // Track ids removed during editing so we can delete on save.
  const [removed, setRemoved] = useState<{ l1: string[]; l2: string[]; l3e: string[]; l3i: string[] }>(
    { l1: [], l2: [], l3e: [], l3i: [] },
  );

  // ─── LOAD ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pitchingTable = isBwf ? "bwf_pitchings" : "bwa_pitchings";
      const pitchingFk = isBwf ? "bwf_pitching_id" : "pitching_id";
      const projectFk = isBwf ? "bwf_project_id" : "project_id";

      const [types, contracts, pitchRes, l1Res, l2Res, l3eRes, l3iRes] = await Promise.all([
        fetchSupplierTypes(),
        fetchContractTypes(),
        pitchingId
          ? supabase.from(pitchingTable).select("estimated_income").eq("id", pitchingId).maybeSingle()
          : Promise.resolve({ data: null as any }),
        pitchingId
          ? supabase.from("quotation_expenses").select("id, n_expense_type_id, amount").eq(pitchingFk, pitchingId).order("created_date", { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        pitchingId
          ? supabase.from("project_initial_expenses").select("id, n_expense_type_id, amount").eq(pitchingFk, pitchingId).order("created_date", { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("expenses").select("id, n_supplier_type_id, installment_amount").eq(projectFk, projectId).order("created_date", { ascending: true }),
        supabase.from("incomes").select("id, n_contract_type_id, income_amount").eq(projectFk, projectId).order("created_date", { ascending: true }),
      ]);

      const assignedTypeIds = [
        ...(l1Res.data ?? []).map((r: any) => r.n_expense_type_id),
        ...(l2Res.data ?? []).map((r: any) => r.n_expense_type_id),
        ...(l3eRes.data ?? []).map((r: any) => r.n_supplier_type_id),
      ];
      const missingTypeIds = assignedTypeIds.filter(
        (id) => id && !types.some((t) => t.id === id),
      );
      setExpenseTypes(missingTypeIds.length ? await fetchSupplierTypes(assignedTypeIds) : types);
      setContractTypes(contracts);
      setPitchIncome(pitchRes.data?.estimated_income != null ? String(pitchRes.data.estimated_income) : "");
      setProjIncome(projectEstIncome != null ? String(projectEstIncome) : "");
      setL1Rows((l1Res.data ?? []).map((r: any) => ({ id: r.id, type_id: r.n_expense_type_id || "", amount: r.amount != null ? String(r.amount) : "" })));
      setL2Rows((l2Res.data ?? []).map((r: any) => ({ id: r.id, type_id: r.n_expense_type_id || "", amount: r.amount != null ? String(r.amount) : "" })));
      setL3ExpRows((l3eRes.data ?? []).map((r: any) => ({ id: r.id, type_id: r.n_supplier_type_id || "", amount: r.installment_amount != null ? String(r.installment_amount) : "" })));
      setL3IncRows((l3iRes.data ?? []).map((r: any) => ({ id: r.id, type_id: r.n_contract_type_id || "", amount: r.income_amount != null ? String(r.income_amount) : "" })));
      setRemoved({ l1: [], l2: [], l3e: [], l3i: [] });
    } catch (err: any) {
      toast({ title: "載入失敗", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [projectId, pitchingId, projectEstIncome, isBwf, supabase, toast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // ─── Live computed totals ──────────────────────────────────
  const pitchExpense = sumRows(l1Rows);
  const pitchIncomeNum = parseFloat(pitchIncome) || 0;
  const pitchProfit = pitchIncomeNum - pitchExpense;
  const pitchMargin = pitchIncomeNum > 0 ? (pitchProfit / pitchIncomeNum) * 100 : 0;

  const projExpense = sumRows(l2Rows);
  const projIncomeNum = parseFloat(projIncome) || 0;
  const projProfit = projIncomeNum - projExpense;
  const projMargin = projIncomeNum > 0 ? (projProfit / projIncomeNum) * 100 : 0;

  const l3Income = sumRows(l3IncRows);
  const l3Expense = sumRows(l3ExpRows);
  const l3Profit = l3Income - l3Expense;
  const l3Margin = l3Income > 0 ? (l3Profit / l3Income) * 100 : 0;

  // ─── Row mutators (stable updaters keep ListEditor cheap) ───
  const makeRowHandlers = (
    setter: React.Dispatch<React.SetStateAction<Row[]>>,
    list: keyof typeof removed,
  ) => ({
    onChangeRow: (idx: number, patch: Partial<Row>) =>
      setter((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r))),
    onAddRow: () => setter((rows) => [...rows, { type_id: "", amount: "" }]),
    onRemoveRow: (idx: number) =>
      setter((rows) => {
        const row = rows[idx];
        if (row?.id) setRemoved((prev) => ({ ...prev, [list]: [...prev[list], row.id!] }));
        return rows.filter((_, i) => i !== idx);
      }),
  });
  const l1H = makeRowHandlers(setL1Rows, "l1");
  const l2H = makeRowHandlers(setL2Rows, "l2");
  const l3eH = makeRowHandlers(setL3ExpRows, "l3e");
  const l3iH = makeRowHandlers(setL3IncRows, "l3i");

  // ─── SAVE ──────────────────────────────────────────────────
  const admin = async (body: Record<string, any>) => {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "操作失敗");
    return json;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const pitchingFk = isBwf ? "bwf_pitching_id" : "pitching_id";

      if (pitchingId) {
        // L1 quotation_expenses
        for (const id of removed.l1) await admin({ action: "delete", table: "quotation_expenses", id });
        for (const r of l1Rows) {
          const payload = { n_expense_type_id: r.type_id || null, amount: parseFloat(r.amount) || 0, modified_date: nowIso };
          if (r.id) await admin({ action: "update", table: "quotation_expenses", id: r.id, updates: payload });
          else await admin({ action: "create", table: "quotation_expenses", data: { ...payload, [pitchingFk]: pitchingId, created_date: nowIso } });
        }
        // L2 project_initial_expenses
        for (const id of removed.l2) await admin({ action: "delete", table: "project_initial_expenses", id });
        for (const r of l2Rows) {
          const payload = { n_expense_type_id: r.type_id || null, amount: parseFloat(r.amount) || 0, modified_date: nowIso };
          if (r.id) await admin({ action: "update", table: "project_initial_expenses", id: r.id, updates: payload });
          else await admin({ action: "create", table: "project_initial_expenses", data: { ...payload, [pitchingFk]: pitchingId, created_date: nowIso } });
        }
      }

      // L3 expenses (only touch type + amount)
      for (const id of removed.l3e) await admin({ action: "delete", table: "expenses", id });
      for (const r of l3ExpRows) {
        const amt = parseFloat(r.amount) || 0;
        if (r.id) {
          await admin({ action: "update", table: "expenses", id: r.id, updates: { n_supplier_type_id: r.type_id || null, installment_amount: amt, modified_date: nowIso } });
        } else if (isBwf) {
          await admin({
            action: "create",
            table: "expenses",
            data: {
              bwf_project_id: projectId,
              n_supplier_type_id: r.type_id || null,
              installment_amount: amt,
              paid_amount: 0,
              outstanding: amt,
              payment_status: null,
              created_date: nowIso,
              modified_date: nowIso,
            },
          });
        } else {
          await admin({ action: "create", table: "expenses", data: { project: projectId, project_id: projectId, n_supplier_type_id: r.type_id || null, installment_amount: amt, paid_amount: 0, outstanding: amt, payment_status: null, created_date: nowIso, modified_date: nowIso } });
        }
      }

      // L3 incomes (only touch contract type + amount)
      for (const id of removed.l3i) await admin({ action: "delete", table: "incomes", id });
      for (const r of l3IncRows) {
        const amt = parseFloat(r.amount) || 0;
        if (r.id) {
          await admin({ action: "update", table: "incomes", id: r.id, updates: { n_contract_type_id: r.type_id || null, income_amount: amt, modified_date: nowIso } });
        } else if (isBwf) {
          await admin({
            action: "create",
            table: "incomes",
            data: {
              bwf_project_id: projectId,
              n_contract_type_id: r.type_id || null,
              income_amount: amt,
              payment_amount: 0,
              outstanding: amt,
              payment_status: null,
              created_date: nowIso,
              modified_date: nowIso,
            },
          });
        } else {
          await admin({ action: "create", table: "incomes", data: { project: projectId, project_id: projectId, n_contract_type_id: r.type_id || null, income_amount: amt, payment_amount: 0, outstanding: amt, payment_status: null, created_date: nowIso, modified_date: nowIso } });
        }
      }

      // Header figures.
      if (pitchingId) {
        if (isBwf) {
          await updateBWFPitching(pitchingId, {
            estimated_income: pitchIncomeNum,
            estimated_expense: pitchExpense,
            modified_date: nowIso,
          });
        } else {
          await updateBWAPitching(pitchingId, {
            estimated_income: pitchIncomeNum,
            estimated_expense: pitchExpense,
            modified_date: nowIso,
          });
        }
      }
      if (isBwf) {
        await updateBWFProject(projectId, {
          estimated_income: projIncomeNum,
          estimated_expense: projExpense,
          estimated_profit: projProfit,
          modified_date: nowIso,
        });
      } else {
        await updateBWAProject(projectId, {
          estimated_income: projIncomeNum,
          estimated_expense: projExpense,
          estimated_profit: projProfit,
          modified_date: nowIso,
        } as any);
      }

      toast({ title: "已儲存", description: "財務資料已更新" });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "儲存失敗", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" /> 編輯財務 Edit Financials
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 flex-1">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> 載入中...
          </div>
        ) : (
          <div className="space-y-6 py-1 flex-1 overflow-y-auto -mx-1 px-1">
            {/* ─── PITCHING (L1) ─── */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-indigo-500 rounded-full" /> 提案 L1 (Pitching)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">L1 預計收入 Est. Income（手動）</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <Input type={canViewFinancialValues ? "number" : "text"} min={0} step="0.01" className="pl-6 font-mono"
                      value={canViewFinancialValues ? pitchIncome : financialMask}
                      onChange={(e) => setPitchIncome(e.target.value)} disabled={!canViewFinancialValues || !pitchingId} readOnly={!canViewFinancialValues} placeholder="0" />
                  </div>
                </div>
                <CalcBox label="L1 預計支出 Est. Expense（= 報價支出總和）" value={formatMoney(pitchExpense, { showZero: true })} />
                <CalcBox label="L1 預計毛利 Est. GP（= 收入 − 支出）"
                  tone={pitchProfit >= 0 ? "profit" : "loss"}
                  value={<>{formatMoney(pitchProfit, { showZero: true })} <span className="text-gray-400 ml-1.5">({canViewFinancialValues ? `${pitchMargin.toFixed(1)}%` : financialMask})</span></>} />
              </div>
              {pitchingId ? (
                <ListEditor rows={l1Rows} options={expenseTypes} label="L1 報價支出 Quotation Expenses"
                  accent="text-indigo-500" accentIcon="down" typePlaceholder="選擇支出類型..." {...l1H} {...listEditorFinancialProps} />
              ) : (
                <p className="text-xs text-gray-400">此項目沒有連結提案，無法編輯 L1 收支。</p>
              )}
            </section>

            <Separator />

            {/* ─── PROJECT (L2) ─── */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full" /> 項目 L2 (Project)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">預計收入 Est. Income（手動）</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <Input type={canViewFinancialValues ? "number" : "text"} min={0} step="0.01" className="pl-6 font-mono"
                      value={canViewFinancialValues ? projIncome : financialMask}
                      onChange={(e) => setProjIncome(e.target.value)} disabled={!canViewFinancialValues} readOnly={!canViewFinancialValues} placeholder="0" />
                  </div>
                </div>
                <CalcBox label="預計支出 Est. Expense（= 初始支出總和）" value={formatMoney(projExpense, { showZero: true })} />
                <CalcBox label="預計毛利 Est. GP（= 收入 − 支出）"
                  tone={projProfit >= 0 ? "profit" : "loss"}
                  value={<>{formatMoney(projProfit, { showZero: true })} <span className="text-gray-400 ml-1.5">({canViewFinancialValues ? `${projMargin.toFixed(1)}%` : financialMask})</span></>} />
              </div>
              <ListEditor rows={l2Rows} options={expenseTypes} label="L2 初始支出 Initial Expenses"
                accent="text-blue-500" accentIcon="down" typePlaceholder="選擇支出類型..." {...l2H} {...listEditorFinancialProps} />
            </section>

            <Separator />

            {/* ─── PROJECT (L3 actuals) ─── */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-red-500 rounded-full" /> 項目 L3 實際 (Actual)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <CalcBox label="實際收入 Actual Income（= 收入總和）" value={formatMoney(l3Income, { showZero: true })} />
                <CalcBox label="實際支出 Actual Expense（= 支出總和）" value={formatMoney(l3Expense, { showZero: true })} />
                <CalcBox label="實際毛利 Actual GP（= 收入 − 支出）"
                  tone={l3Profit >= 0 ? "profit" : "loss"}
                  value={<>{formatMoney(l3Profit, { showZero: true })} <span className="text-gray-400 ml-1.5">({canViewFinancialValues ? `${l3Margin.toFixed(1)}%` : financialMask})</span></>} />
              </div>
              <p className="text-[11px] text-gray-400">
                只編輯類型與金額；其他付款欄位請於「收入 / 支出」分頁處理。
              </p>
              <ListEditor rows={l3IncRows} options={contractTypes} label="L3 實際收入 Incomes"
                accent="text-emerald-500" accentIcon="up" typePlaceholder="選擇合約類型..." {...l3iH} {...listEditorFinancialProps} />
              <ListEditor rows={l3ExpRows} options={expenseTypes} label="L3 實際支出 Expenses"
                accent="text-red-500" accentIcon="down" typePlaceholder="選擇支出類型..." {...l3eH} {...listEditorFinancialProps} />
            </section>
          </div>
        )}

        <DialogFooter className="flex-shrink-0 border-t border-gray-100 pt-3 mt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
          <Button onClick={handleSave} disabled={saving || loading || !canViewFinancialValues} className="bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
