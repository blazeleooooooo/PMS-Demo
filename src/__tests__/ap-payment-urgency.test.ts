import { describe, expect, it } from "vitest";
import {
  AP_URGENCY_LARGE_AMOUNT,
  AP_URGENCY_NORMAL,
  AP_URGENCY_URGENT,
  daysSinceExpectedPayment,
  getApUrgencyBadges,
  isLargeApInstallment,
  rowMatchesApUrgencyFilter,
} from "@/lib/ap-payment-urgency";

const TODAY = "2026-09-02";

describe("daysSinceExpectedPayment", () => {
  it("returns null when expected date is missing", () => {
    expect(daysSinceExpectedPayment(null, TODAY)).toBeNull();
    expect(daysSinceExpectedPayment("", TODAY)).toBeNull();
  });

  it("is 0 on the expected date and positive after it", () => {
    expect(daysSinceExpectedPayment("2026-09-02", TODAY)).toBe(0);
    expect(daysSinceExpectedPayment("2026-09-01", TODAY)).toBe(1);
    expect(daysSinceExpectedPayment("2026-08-31", TODAY)).toBe(2);
    expect(daysSinceExpectedPayment("2026-08-30", TODAY)).toBe(3);
    expect(daysSinceExpectedPayment("2026-08-27", TODAY)).toBe(6);
    expect(daysSinceExpectedPayment("2026-08-26", TODAY)).toBe(7);
  });

  it("is negative when expected date is still in the future", () => {
    expect(daysSinceExpectedPayment("2026-09-03", TODAY)).toBe(-1);
  });
});

describe("getApUrgencyBadges", () => {
  it("marks 緊急 for today through 2 days after expected", () => {
    expect(getApUrgencyBadges({ expected_payment_date: "2026-09-02" }, TODAY)).toEqual([
      AP_URGENCY_URGENT,
    ]);
    expect(getApUrgencyBadges({ expected_payment_date: "2026-09-01" }, TODAY)).toEqual([
      AP_URGENCY_URGENT,
    ]);
    expect(getApUrgencyBadges({ expected_payment_date: "2026-08-31" }, TODAY)).toEqual([
      AP_URGENCY_URGENT,
    ]);
  });

  it("marks 一般 for 3–6 days after expected", () => {
    expect(getApUrgencyBadges({ expected_payment_date: "2026-08-30" }, TODAY)).toEqual([
      AP_URGENCY_NORMAL,
    ]);
    expect(getApUrgencyBadges({ expected_payment_date: "2026-08-27" }, TODAY)).toEqual([
      AP_URGENCY_NORMAL,
    ]);
  });

  it("adds no date badge before expected or from day 7 onward", () => {
    expect(getApUrgencyBadges({ expected_payment_date: "2026-09-03" }, TODAY)).toEqual([]);
    expect(getApUrgencyBadges({ expected_payment_date: "2026-08-26" }, TODAY)).toEqual([]);
    expect(getApUrgencyBadges({ expected_payment_date: null }, TODAY)).toEqual([]);
  });

  it("marks 金額較大 only when installment_amount is above 30,000", () => {
    expect(isLargeApInstallment(30_000)).toBe(false);
    expect(isLargeApInstallment(30_001)).toBe(true);
    expect(
      getApUrgencyBadges({ expected_payment_date: null, installment_amount: 30_000 }, TODAY)
    ).toEqual([]);
    expect(
      getApUrgencyBadges({ expected_payment_date: null, installment_amount: 30_001 }, TODAY)
    ).toEqual([AP_URGENCY_LARGE_AMOUNT]);
  });

  it("can stack a date badge with 金額較大", () => {
    expect(
      getApUrgencyBadges(
        { expected_payment_date: "2026-09-02", installment_amount: 50_000 },
        TODAY
      )
    ).toEqual([AP_URGENCY_URGENT, AP_URGENCY_LARGE_AMOUNT]);
    expect(
      getApUrgencyBadges(
        { expected_payment_date: "2026-08-30", installment_amount: 50_000 },
        TODAY
      )
    ).toEqual([AP_URGENCY_NORMAL, AP_URGENCY_LARGE_AMOUNT]);
  });
});

describe("rowMatchesApUrgencyFilter", () => {
  const urgent = { expected_payment_date: "2026-09-02", installment_amount: 10_000 };
  const normal = { expected_payment_date: "2026-08-30", installment_amount: 10_000 };
  const large = { expected_payment_date: "2026-08-01", installment_amount: 40_000 };

  it("matches every row when the filter is null", () => {
    expect(rowMatchesApUrgencyFilter(urgent, null, TODAY)).toBe(true);
    expect(rowMatchesApUrgencyFilter(normal, null, TODAY)).toBe(true);
    expect(rowMatchesApUrgencyFilter(large, null, TODAY)).toBe(true);
  });

  it("keeps only rows that carry the selected badge", () => {
    expect(rowMatchesApUrgencyFilter(urgent, AP_URGENCY_URGENT, TODAY)).toBe(true);
    expect(rowMatchesApUrgencyFilter(normal, AP_URGENCY_URGENT, TODAY)).toBe(false);
    expect(rowMatchesApUrgencyFilter(normal, AP_URGENCY_NORMAL, TODAY)).toBe(true);
    expect(rowMatchesApUrgencyFilter(large, AP_URGENCY_LARGE_AMOUNT, TODAY)).toBe(true);
    expect(rowMatchesApUrgencyFilter(urgent, AP_URGENCY_LARGE_AMOUNT, TODAY)).toBe(false);
  });
});
