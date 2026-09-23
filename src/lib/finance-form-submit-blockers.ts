import {
  isExpectedPaymentDateMissing,
  isIncomeExpiryReasonMissing,
} from "@/lib/date-utils";
import { paidExceedsInstallment } from "@/lib/expense-outstanding-split";

export type IncomeSubmitBlockerInput = {
  incomeAmount: number | null | undefined;
  dueDate: string | null | undefined;
  expectedPaymentDate: string | null | undefined;
  expiryReasonId: string | null | undefined;
  paymentStatus?: string | null;
  paymentAmount: number | null | undefined;
  receiveDate: string | null | undefined;
  paymentMethod: string | null | undefined;
};

export const EXPENSE_CONTROL_LOCKED_MESSAGE =
  "出支票功能受限制：請先完成 Expense Control 清單";

export type ExpenseSubmitBlockerInput = {
  installmentAmount: number | null | undefined;
  rankReport: string | null | undefined;
  contractTypeId: string | null | undefined;
  supplierTypeId: string | null | undefined;
  payeeMode?: "supplier" | "factory";
  supplierId: string | null | undefined;
  factoryId: string | null | undefined;
  dueDate: string | null | undefined;
  expectedPaymentDate: string | null | undefined;
  paidAmount: number | null | undefined;
  isBwfProject?: boolean;
  expenseAmountCurrency?: "HKD" | "RMB";
  paidAmountCurrency?: "HKD" | "RMB";
  rmbInputAmount?: number | null;
  rmbPaidInputAmount?: number | null;
  exchangeRateLoading?: boolean;
  hasExchangeRate?: boolean;
  expenseUnlocked?: boolean;
};

export function getIncomeSubmitBlockers(input: IncomeSubmitBlockerInput): string[] {
  const reasons: string[] = [];
  if (!input.incomeAmount) reasons.push("請填寫收入金額");
  if (!input.dueDate) reasons.push("請填寫到期日");
  if (
    isExpectedPaymentDateMissing(
      input.dueDate,
      input.expectedPaymentDate,
      undefined,
      input.paymentStatus
    )
  ) {
    reasons.push("到期日已過，請填寫預計付款日期");
  }
  if (
    isIncomeExpiryReasonMissing(
      input.dueDate,
      input.expiryReasonId,
      undefined,
      input.paymentStatus
    )
  ) {
    reasons.push("到期日已過，請選擇逾期原因");
  }
  if (input.paymentAmount != null) {
    if (!input.receiveDate) reasons.push("已填寫已收金額時必須填寫收款日期");
    if (!input.paymentMethod) reasons.push("已填寫已收金額時必須選擇付款方式");
  }
  return reasons;
}

export function getExpenseSubmitBlockers(input: ExpenseSubmitBlockerInput): string[] {
  const reasons: string[] = [];
  const payeeMode = input.payeeMode ?? "supplier";
  const isRmbExpense = Boolean(input.isBwfProject && input.expenseAmountCurrency === "RMB");
  const isRmbPaid = Boolean(input.isBwfProject && input.paidAmountCurrency === "RMB");

  if (input.expenseUnlocked === false) {
    reasons.push(EXPENSE_CONTROL_LOCKED_MESSAGE);
  }

  if (isRmbExpense) {
    if (!input.rmbInputAmount) reasons.push("請填寫人民幣支出金額");
    if (input.exchangeRateLoading) reasons.push("匯率載入中，請稍候再提交");
    else if (!input.hasExchangeRate) reasons.push("未能取得匯率，無法換算港幣支出金額");
    else if (!input.installmentAmount) reasons.push("請填寫支出金額");
  } else if (!input.installmentAmount) {
    reasons.push("請填寫支出金額");
  }

  if (isRmbPaid && input.rmbPaidInputAmount) {
    if (input.exchangeRateLoading) {
      if (!reasons.includes("匯率載入中，請稍候再提交")) {
        reasons.push("匯率載入中，請稍候再提交");
      }
    } else if (!input.hasExchangeRate) {
      reasons.push("未能取得匯率，無法換算港幣已付金額");
    }
  }

  if (!input.rankReport) reasons.push("請填寫款項期數");
  if (!input.contractTypeId) reasons.push("請選擇合約類型");
  if (!input.supplierTypeId) reasons.push("請選擇支出分類");
  if (payeeMode === "factory") {
    if (!input.factoryId) reasons.push("請選擇工廠");
  } else if (!input.supplierId) {
    reasons.push("請選擇供應商");
  }
  if (!input.dueDate) reasons.push("請填寫到期日");
  if (isExpectedPaymentDateMissing(input.dueDate, input.expectedPaymentDate)) {
    reasons.push("到期日已過，請填寫預計付款日期");
  }
  if (paidExceedsInstallment(input.paidAmount, input.installmentAmount)) {
    reasons.push("已付金額不可大於支出金額");
  }
  return reasons;
}
