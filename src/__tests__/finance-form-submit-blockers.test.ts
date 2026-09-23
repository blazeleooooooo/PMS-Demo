import { describe, expect, it } from "vitest";
import {
  getExpenseSubmitBlockers,
  getIncomeSubmitBlockers,
} from "@/lib/finance-form-submit-blockers";

describe("getIncomeSubmitBlockers", () => {
  it("lists missing required income fields", () => {
    expect(
      getIncomeSubmitBlockers({
        incomeAmount: null,
        dueDate: null,
        expectedPaymentDate: null,
        expiryReasonId: null,
        paymentAmount: null,
        receiveDate: null,
        paymentMethod: null,
      })
    ).toEqual(["請填寫收入金額", "請填寫到期日"]);
  });

  it("requires collection fields after payment amount is entered", () => {
    expect(
      getIncomeSubmitBlockers({
        incomeAmount: 1000,
        dueDate: "2099-01-01",
        expectedPaymentDate: null,
        expiryReasonId: null,
        paymentAmount: 500,
        receiveDate: null,
        paymentMethod: null,
      })
    ).toEqual(["已填寫已收金額時必須填寫收款日期", "已填寫已收金額時必須選擇付款方式"]);
  });

  it("requires overdue expected date and expiry reason", () => {
    const reasons = getIncomeSubmitBlockers({
      incomeAmount: 1000,
      dueDate: "2020-01-01",
      expectedPaymentDate: null,
      expiryReasonId: null,
      paymentAmount: null,
      receiveDate: null,
      paymentMethod: null,
    });
    expect(reasons).toContain("到期日已過，請填寫預計付款日期");
    expect(reasons).toContain("到期日已過，請選擇逾期原因");
  });
});

describe("getExpenseSubmitBlockers", () => {
  it("lists missing supplier expense fields", () => {
    expect(
      getExpenseSubmitBlockers({
        installmentAmount: null,
        rankReport: null,
        contractTypeId: null,
        supplierTypeId: null,
        payeeMode: "supplier",
        supplierId: null,
        factoryId: null,
        dueDate: null,
        expectedPaymentDate: null,
        paidAmount: null,
      })
    ).toEqual([
      "請填寫支出金額",
      "請填寫款項期數",
      "請選擇合約類型",
      "請選擇支出分類",
      "請選擇供應商",
      "請填寫到期日",
    ]);
  });

  it("asks for factory instead of supplier in factory mode", () => {
    const reasons = getExpenseSubmitBlockers({
      installmentAmount: 100,
      rankReport: "1",
      contractTypeId: "ct",
      supplierTypeId: "st",
      payeeMode: "factory",
      supplierId: null,
      factoryId: null,
      dueDate: "2099-01-01",
      expectedPaymentDate: null,
      paidAmount: null,
    });
    expect(reasons).toEqual(["請選擇工廠"]);
  });

  it("blocks RMB expense without amount or rate", () => {
    expect(
      getExpenseSubmitBlockers({
        installmentAmount: null,
        rankReport: "1",
        contractTypeId: "ct",
        supplierTypeId: "st",
        payeeMode: "factory",
        supplierId: null,
        factoryId: "fac",
        dueDate: "2099-01-01",
        expectedPaymentDate: null,
        paidAmount: null,
        isBwfProject: true,
        expenseAmountCurrency: "RMB",
        rmbInputAmount: null,
        hasExchangeRate: false,
      })
    ).toEqual(["請填寫人民幣支出金額", "未能取得匯率，無法換算港幣支出金額"]);
  });

  it("blocks submit when expense control is locked", () => {
    expect(
      getExpenseSubmitBlockers({
        installmentAmount: 100,
        rankReport: "1",
        contractTypeId: "ct",
        supplierTypeId: "st",
        payeeMode: "supplier",
        supplierId: "sup",
        factoryId: null,
        dueDate: "2099-01-01",
        expectedPaymentDate: null,
        paidAmount: null,
        expenseUnlocked: false,
      })
    ).toEqual(["出支票功能受限制：請先完成 Expense Control 清單"]);
  });

  it("blocks paid amount above installment", () => {
    expect(
      getExpenseSubmitBlockers({
        installmentAmount: 100,
        rankReport: "1",
        contractTypeId: "ct",
        supplierTypeId: "st",
        payeeMode: "supplier",
        supplierId: "sup",
        factoryId: null,
        dueDate: "2099-01-01",
        expectedPaymentDate: null,
        paidAmount: 120,
      })
    ).toEqual(["已付金額不可大於支出金額"]);
  });
});
