import { describe, expect, it } from "vitest";
import {
  countOverdueIncomesMissingExpectedDate,
  incomeBelongsOnDigestDate,
  incomeCalendarDate,
  isDueDateExpired,
  isDueDateLocked,
  isPastDueUnpaid,
  isExpectedPaymentDateMissing,
  isExpectedPaymentDateRequired,
  isIncomeExpiryReasonMissing,
  isIncomeUsingExpectedCalendarDate,
  overdueDaysHk,
  overdueIncomeExpectedDateItemLabel,
  remainingDaysHk,
  toHkYmd,
} from "@/lib/date-utils";

describe("isExpectedPaymentDateRequired", () => {
  it("is optional when due_date is today or in the future", () => {
    expect(isExpectedPaymentDateRequired("2026-08-31", "2026-08-31")).toBe(false);
    expect(isExpectedPaymentDateRequired("2026-09-01", "2026-08-31")).toBe(false);
  });

  it("is required only after due_date has passed", () => {
    expect(isExpectedPaymentDateRequired("2026-08-30", "2026-08-31")).toBe(true);
  });

  it("is not required when payment status is Received", () => {
    expect(isExpectedPaymentDateRequired("2026-08-30", "2026-08-31", "Received")).toBe(false);
    expect(isExpectedPaymentDateRequired("2026-08-30", "2026-08-31", "received")).toBe(false);
  });

  it("is not required when payment status is Zoho Completed", () => {
    expect(isExpectedPaymentDateRequired("2026-08-30", "2026-08-31", "Zoho Completed")).toBe(false);
    expect(isExpectedPaymentDateRequired("2026-08-30", "2026-08-31", "zoho completed")).toBe(false);
  });

  it("stays required for other payment statuses", () => {
    expect(isExpectedPaymentDateRequired("2026-08-30", "2026-08-31", "Pending Check")).toBe(true);
    expect(isExpectedPaymentDateRequired("2026-08-30", "2026-08-31", "Not Received")).toBe(true);
  });

  it("is not required when due_date is missing", () => {
    expect(isExpectedPaymentDateRequired(null, "2026-08-31")).toBe(false);
    expect(isExpectedPaymentDateRequired("", "2026-08-31")).toBe(false);
  });
});

describe("isExpectedPaymentDateMissing", () => {
  it("flags overdue rows that have no secondary date", () => {
    expect(isExpectedPaymentDateMissing("2026-08-30", null, "2026-08-31")).toBe(true);
    expect(isExpectedPaymentDateMissing("2026-08-30", "2026-09-10", "2026-08-31")).toBe(false);
  });

  it("does not flag future due dates even when expected is empty", () => {
    expect(isExpectedPaymentDateMissing("2026-09-15", null, "2026-08-31")).toBe(false);
  });

  it("does not flag overdue Received incomes even when expected is empty", () => {
    expect(isExpectedPaymentDateMissing("2026-08-30", null, "2026-08-31", "Received")).toBe(false);
  });

  it("does not flag overdue Zoho Completed incomes even when expected is empty", () => {
    expect(isExpectedPaymentDateMissing("2026-08-30", null, "2026-08-31", "Zoho Completed")).toBe(false);
  });
});

describe("countOverdueIncomesMissingExpectedDate", () => {
  it("counts only overdue incomes with an empty expected_payment_date", () => {
    expect(
      countOverdueIncomesMissingExpectedDate(
        [
          { due_date: "2026-08-30", expected_payment_date: null },
          { due_date: "2026-08-29", expected_payment_date: "" },
          { due_date: "2026-08-30", expected_payment_date: "2026-09-10" },
          { due_date: "2026-09-01", expected_payment_date: null },
          { due_date: null, expected_payment_date: null },
        ],
        "2026-08-31"
      )
    ).toBe(2);
  });

  it("returns 0 when no income is overdue without an expected date", () => {
    expect(
      countOverdueIncomesMissingExpectedDate(
        [{ due_date: "2026-08-30", expected_payment_date: "2026-09-01" }],
        "2026-08-31"
      )
    ).toBe(0);
  });

  it("excludes Received incomes from the overdue missing-date count", () => {
    expect(
      countOverdueIncomesMissingExpectedDate(
        [
          { due_date: "2026-08-30", expected_payment_date: null, payment_status: "Received" },
          { due_date: "2026-08-29", expected_payment_date: null, payment_status: "Pending Check" },
          { due_date: "2026-08-28", expected_payment_date: null },
        ],
        "2026-08-31"
      )
    ).toBe(2);
  });

  it("excludes Zoho Completed incomes from the overdue missing-date count", () => {
    expect(
      countOverdueIncomesMissingExpectedDate(
        [
          { due_date: "2026-08-30", expected_payment_date: null, payment_status: "Zoho Completed" },
          { due_date: "2026-08-29", expected_payment_date: null, payment_status: "Pending Check" },
        ],
        "2026-08-31"
      )
    ).toBe(1);
  });
});

describe("overdueIncomeExpectedDateItemLabel", () => {
  it("matches the expense-locked unmet-item chip", () => {
    expect(overdueIncomeExpectedDateItemLabel(0)).toBe("逾期收入已填寫預計收款日期");
    expect(overdueIncomeExpectedDateItemLabel(3)).toBe("逾期收入已填寫預計收款日期 (缺 3 筆)");
  });
});

describe("incomeCalendarDate", () => {
  it("uses expected_payment_date for unsettled rows when it is set", () => {
    expect(
      incomeCalendarDate({
        due_date: "2026-09-01",
        expected_payment_date: "2026-09-20",
        payment_status: "Pending Check",
      })
    ).toBe("2026-09-20");
  });

  it("stays on due_date when expected is empty or the row is settled", () => {
    expect(
      incomeCalendarDate({
        due_date: "2026-09-01",
        expected_payment_date: null,
      })
    ).toBe("2026-09-01");
    expect(
      incomeCalendarDate({
        due_date: "2026-09-01",
        expected_payment_date: "2026-09-20",
        payment_status: "Received",
      })
    ).toBe("2026-09-01");
    expect(
      incomeCalendarDate({
        due_date: "2026-09-01",
        expected_payment_date: "2026-09-20",
        payment_status: "Zoho Completed",
      })
    ).toBe("2026-09-01");
  });
});

describe("isIncomeUsingExpectedCalendarDate / incomeBelongsOnDigestDate", () => {
  it("flags unsettled rows that have a revised expected date", () => {
    expect(
      isIncomeUsingExpectedCalendarDate({
        due_date: "2026-09-01",
        expected_payment_date: "2026-09-20",
      })
    ).toBe(true);
    expect(
      isIncomeUsingExpectedCalendarDate({
        due_date: "2026-09-01",
        expected_payment_date: "2026-09-20",
        payment_status: "Received",
      })
    ).toBe(false);
  });

  it("includes unsettled incomes only on the effective day", () => {
    const overdueWithExpected = {
      due_date: "2026-09-01",
      expected_payment_date: "2026-09-20",
      payment_status: "Pending Check",
    };
    expect(incomeBelongsOnDigestDate(overdueWithExpected, "2026-09-01")).toBe(false);
    expect(incomeBelongsOnDigestDate(overdueWithExpected, "2026-09-20")).toBe(true);
    expect(
      incomeBelongsOnDigestDate(
        { due_date: "2026-09-16", expected_payment_date: null },
        "2026-09-16"
      )
    ).toBe(true);
    expect(
      incomeBelongsOnDigestDate(
        {
          due_date: "2026-09-16",
          expected_payment_date: null,
          payment_status: "Received",
        },
        "2026-09-16"
      )
    ).toBe(false);
  });
});

describe("isDueDateExpired", () => {
  it("is false when due_date is today, future, or missing", () => {
    expect(isDueDateExpired("2026-08-31", "2026-08-31")).toBe(false);
    expect(isDueDateExpired("2026-09-01", "2026-08-31")).toBe(false);
    expect(isDueDateExpired(null, "2026-08-31")).toBe(false);
  });

  it("is true after due_date has passed", () => {
    expect(isDueDateExpired("2026-08-30", "2026-08-31")).toBe(true);
  });
});

describe("isPastDueUnpaid", () => {
  it("is true only when due_date has passed and paid percent is under 100", () => {
    expect(isPastDueUnpaid("2026-08-30", 10000, 0, "2026-08-31")).toBe(true);
    expect(isPastDueUnpaid("2026-08-30", 10000, 5000, "2026-08-31")).toBe(true);
    expect(isPastDueUnpaid("2026-08-30", 10000, 9999, "2026-08-31")).toBe(true);
  });

  it("is false when fully paid, due is not past, amount is zero, or due is missing", () => {
    expect(isPastDueUnpaid("2026-08-30", 10000, 10000, "2026-08-31")).toBe(false);
    expect(isPastDueUnpaid("2026-08-31", 10000, 0, "2026-08-31")).toBe(false);
    expect(isPastDueUnpaid("2026-09-01", 10000, 0, "2026-08-31")).toBe(false);
    expect(isPastDueUnpaid("2026-08-30", 0, 0, "2026-08-31")).toBe(false);
    expect(isPastDueUnpaid(null, 10000, 0, "2026-08-31")).toBe(false);
  });
});

describe("isIncomeExpiryReasonMissing", () => {
  it("is required only when due_date has passed and no reason is set", () => {
    expect(isIncomeExpiryReasonMissing("2026-08-30", null, "2026-08-31")).toBe(true);
    expect(isIncomeExpiryReasonMissing("2026-08-30", "reason-id", "2026-08-31")).toBe(false);
    expect(isIncomeExpiryReasonMissing("2026-09-01", null, "2026-08-31")).toBe(false);
  });

  it("is not required when payment status is Received", () => {
    expect(isIncomeExpiryReasonMissing("2026-08-30", null, "2026-08-31", "Received")).toBe(false);
  });

  it("is not required when payment status is Zoho Completed", () => {
    expect(isIncomeExpiryReasonMissing("2026-08-30", null, "2026-08-31", "Zoho Completed")).toBe(false);
  });
});

describe("isDueDateLocked", () => {
  it("is unlocked when the persisted due_date is empty", () => {
    expect(isDueDateLocked(null)).toBe(false);
    expect(isDueDateLocked("")).toBe(false);
    expect(isDueDateLocked("   ")).toBe(false);
  });

  it("is locked after a due_date has been filled", () => {
    expect(isDueDateLocked("2026-08-31")).toBe(true);
  });
});

describe("toHkYmd", () => {
  it("keeps date-only strings and reads HK calendar from timestamps", () => {
    expect(toHkYmd("2026-08-31")).toBe("2026-08-31");
    expect(toHkYmd("2026-08-30T16:00:00.000Z")).toBe("2026-08-31");
  });
});

describe("overdueDaysHk", () => {
  it("returns null when due_date is today, future, or missing", () => {
    expect(overdueDaysHk("2026-08-31", "2026-08-31")).toBeNull();
    expect(overdueDaysHk("2026-09-01", "2026-08-31")).toBeNull();
    expect(overdueDaysHk(null, "2026-08-31")).toBeNull();
  });

  it("counts whole HK calendar days past due_date", () => {
    expect(overdueDaysHk("2026-08-30", "2026-08-31")).toBe(1);
    expect(overdueDaysHk("2026-08-01", "2026-08-31")).toBe(30);
  });
});

describe("remainingDaysHk", () => {
  it("returns null when due_date is today, past, or missing", () => {
    expect(remainingDaysHk("2026-08-31", "2026-08-31")).toBeNull();
    expect(remainingDaysHk("2026-08-30", "2026-08-31")).toBeNull();
    expect(remainingDaysHk(null, "2026-08-31")).toBeNull();
  });

  it("counts whole HK calendar days until due_date", () => {
    expect(remainingDaysHk("2026-09-01", "2026-08-31")).toBe(1);
    expect(remainingDaysHk("2026-09-30", "2026-08-31")).toBe(30);
  });
});
