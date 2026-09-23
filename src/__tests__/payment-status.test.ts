import { describe, expect, it } from "vitest";
import {
  INCOME_PENDING_CHECK,
  INCOME_RECEIVED,
  INCOME_ZOHO_COMPLETED,
  canStaffSetIncomePaymentStatus,
  incomePaymentStatusBadgeClass,
  isIncomeDecisionStatus,
  isIncomeReceived,
  isIncomeSettled,
  normalizeIncomePaymentStatus,
} from "@/lib/income-payment-status";
import {
  EXPENSE_APPROVED,
  EXPENSE_PENDING_CHECK,
  EXPENSE_ZOHO_COMPLETED,
  canStaffSetExpensePaymentStatus,
  expensePaymentStatusBadgeClass,
  isExpenseApproved,
  isExpenseDecisionStatus,
  isExpenseSettled,
  normalizeExpensePaymentStatus,
} from "@/lib/expense-payment-status";
import { isIncomeSettledByStatus } from "@/lib/income-outstanding";

describe("income payment status", () => {
  it("normalizes Zoho Completed case-insensitively", () => {
    expect(normalizeIncomePaymentStatus("Zoho Completed")).toBe(INCOME_ZOHO_COMPLETED);
    expect(normalizeIncomePaymentStatus("zoho completed")).toBe(INCOME_ZOHO_COMPLETED);
  });

  it("treats Received and Zoho Completed as settled", () => {
    expect(isIncomeReceived(INCOME_RECEIVED)).toBe(true);
    expect(isIncomeReceived(INCOME_ZOHO_COMPLETED)).toBe(false);
    expect(isIncomeSettled(INCOME_RECEIVED)).toBe(true);
    expect(isIncomeSettled(INCOME_ZOHO_COMPLETED)).toBe(true);
    expect(isIncomeSettled(INCOME_PENDING_CHECK)).toBe(false);
    expect(isIncomeSettledByStatus("Zoho Completed")).toBe(true);
  });

  it("treats Zoho Completed as a decision status", () => {
    expect(isIncomeDecisionStatus(INCOME_ZOHO_COMPLETED)).toBe(true);
  });

  it("uses a dark-green badge for Zoho Completed", () => {
    expect(incomePaymentStatusBadgeClass(INCOME_ZOHO_COMPLETED)).toContain("bg-emerald-800");
  });

  it("lets only admin set Zoho Completed on BWF", () => {
    expect(
      canStaffSetIncomePaymentStatus(true, INCOME_RECEIVED, INCOME_ZOHO_COMPLETED, {
        allowZohoCompleted: true,
      })
    ).toBe(true);
    expect(canStaffSetIncomePaymentStatus(true, INCOME_RECEIVED, INCOME_ZOHO_COMPLETED)).toBe(false);
    expect(
      canStaffSetIncomePaymentStatus(false, INCOME_PENDING_CHECK, INCOME_ZOHO_COMPLETED, {
        allowZohoCompleted: true,
      })
    ).toBe(false);
    expect(canStaffSetIncomePaymentStatus(false, null, INCOME_PENDING_CHECK)).toBe(true);
  });
});

describe("expense payment status", () => {
  it("normalizes Zoho Completed case-insensitively", () => {
    expect(normalizeExpensePaymentStatus("Zoho Completed")).toBe(EXPENSE_ZOHO_COMPLETED);
    expect(normalizeExpensePaymentStatus("zoho completed")).toBe(EXPENSE_ZOHO_COMPLETED);
  });

  it("treats Approved and Zoho Completed as settled", () => {
    expect(isExpenseApproved(EXPENSE_APPROVED)).toBe(true);
    expect(isExpenseApproved(EXPENSE_ZOHO_COMPLETED)).toBe(false);
    expect(isExpenseSettled(EXPENSE_APPROVED)).toBe(true);
    expect(isExpenseSettled(EXPENSE_ZOHO_COMPLETED)).toBe(true);
    expect(isExpenseSettled(EXPENSE_PENDING_CHECK)).toBe(false);
  });

  it("treats Zoho Completed as a decision status", () => {
    expect(isExpenseDecisionStatus(EXPENSE_ZOHO_COMPLETED)).toBe(true);
  });

  it("uses a dark-green badge for Zoho Completed", () => {
    expect(expensePaymentStatusBadgeClass(EXPENSE_ZOHO_COMPLETED)).toContain("bg-emerald-800");
  });

  it("lets only admin set Zoho Completed on BWF", () => {
    expect(
      canStaffSetExpensePaymentStatus(true, EXPENSE_APPROVED, EXPENSE_ZOHO_COMPLETED, {
        allowZohoCompleted: true,
      })
    ).toBe(true);
    expect(canStaffSetExpensePaymentStatus(true, EXPENSE_APPROVED, EXPENSE_ZOHO_COMPLETED)).toBe(false);
    expect(
      canStaffSetExpensePaymentStatus(false, EXPENSE_PENDING_CHECK, EXPENSE_ZOHO_COMPLETED, {
        allowZohoCompleted: true,
      })
    ).toBe(false);
    expect(canStaffSetExpensePaymentStatus(false, null, EXPENSE_PENDING_CHECK)).toBe(true);
  });
});
