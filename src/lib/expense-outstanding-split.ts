import type { ExpenseFormData } from "@/lib/data/finance";

export interface ExpenseInstallmentIdentityRow {
  supplier_id: string | null;
  factory_id?: string | null;
  n_contract_type_id: string | null;
  rank_report: string | null;
  invoice_number: string | null;
}

export interface ExpenseInstallmentIdentity {
  rank_report: string;
  invoice_number: string;
  invoice_hash: string;
}

export interface SplitRmbContext {
  expenseAmountCurrency: "HKD" | "RMB";
  paidAmountCurrency: "HKD" | "RMB";
  rmbInputAmount: number | null;
  rmbPaidInputAmount: number | null;
}

export function moneyAmount(n: number): number {
  return Math.round(n * 100) / 100;
}

export function toMoneyCents(n: number | null | undefined): number {
  return Math.round((n || 0) * 100);
}

export function paidExceedsInstallment(
  paidAmount: number | null | undefined,
  installmentAmount: number | null | undefined
): boolean {
  return toMoneyCents(paidAmount) > toMoneyCents(installmentAmount);
}

export function hasPartialOutstanding(
  paidAmount: number | null | undefined,
  installmentAmount: number | null | undefined
): boolean {
  const paid = toMoneyCents(paidAmount);
  const installment = toMoneyCents(installmentAmount);
  return paid > 0 && paid < installment;
}

export function outstandingAmount(
  installmentAmount: number | null | undefined,
  paidAmount: number | null | undefined
): number {
  return moneyAmount((installmentAmount || 0) - (paidAmount || 0));
}

function parseInstallmentNumber(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

export function nextExpenseInstallmentIdentity(
  existing: ExpenseInstallmentIdentityRow[],
  payee: { supplier_id?: string | null; factory_id?: string | null },
  contractTypeId: string | null | undefined,
  currentRank: string | null | undefined
): ExpenseInstallmentIdentity {
  const factoryId = payee.factory_id || null;
  const supplierId = payee.supplier_id || null;
  const matching = existing.filter((row) => {
    const contractMatch = contractTypeId
      ? row.n_contract_type_id === contractTypeId
      : !row.n_contract_type_id;
    if (!contractMatch) return false;
    if (factoryId) return row.factory_id === factoryId;
    if (supplierId) return row.supplier_id === supplierId;
    return !row.supplier_id && !row.factory_id;
  });

  const numbers = [
    ...matching.map((row) => parseInstallmentNumber(row.rank_report)),
    ...matching.map((row) => parseInstallmentNumber(row.invoice_number)),
    parseInstallmentNumber(currentRank),
  ].filter((n): n is number => n != null);

  const next = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
  const nextText = String(next);
  return {
    rank_report: nextText,
    invoice_number: nextText,
    invoice_hash: `#${nextText}`,
  };
}

function scaleRmb(
  rmb: number | null,
  portionHkd: number,
  totalHkd: number
): number | null {
  if (rmb == null || totalHkd === 0) return null;
  return moneyAmount(rmb * (portionHkd / totalHkd));
}

export function buildStayAsIsPayload(form: ExpenseFormData): ExpenseFormData {
  return {
    ...form,
    paid_amount: form.paid_amount ?? 0,
    outstanding: outstandingAmount(form.installment_amount, form.paid_amount),
  };
}

export function buildSplitPayloads(args: {
  form: ExpenseFormData;
  childExpectedPaymentDate: string;
  nextIdentity: ExpenseInstallmentIdentity;
  rmb?: SplitRmbContext | null;
}): { original: ExpenseFormData; child: ExpenseFormData } {
  const { form, childExpectedPaymentDate, nextIdentity, rmb } = args;
  const paid = moneyAmount(form.paid_amount || 0);
  const installment = moneyAmount(form.installment_amount || 0);
  const childAmount = outstandingAmount(installment, paid);

  let originalConverter: number | null = null;
  let childConverter: number | null = null;
  if (rmb?.expenseAmountCurrency === "RMB") {
    if (rmb.paidAmountCurrency === "RMB" && rmb.rmbPaidInputAmount != null) {
      originalConverter = rmb.rmbPaidInputAmount;
      childConverter =
        rmb.rmbInputAmount != null
          ? moneyAmount(rmb.rmbInputAmount - rmb.rmbPaidInputAmount)
          : scaleRmb(rmb.rmbInputAmount, childAmount, installment);
    } else {
      originalConverter = scaleRmb(rmb.rmbInputAmount, paid, installment);
      childConverter = scaleRmb(rmb.rmbInputAmount, childAmount, installment);
    }
  }

  const original: ExpenseFormData = {
    ...form,
    installment_amount: paid,
    paid_amount: paid,
    outstanding: 0,
    converter_input_amount: originalConverter,
  };

  const child: ExpenseFormData = {
    ...form,
    installment_amount: childAmount,
    paid_amount: null,
    outstanding: childAmount,
    payment_date: null,
    payment_method_id: null,
    cheque_no: null,
    payment_status: null,
    due_date: childExpectedPaymentDate,
    expected_payment_date: null,
    rank_report: nextIdentity.rank_report,
    invoice_number: nextIdentity.invoice_number,
    invoice_hash: nextIdentity.invoice_hash,
    pdf_file: null,
    converter_input_amount: childConverter,
  };

  return { original, child };
}
