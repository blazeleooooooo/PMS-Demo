import { describe, expect, it } from "vitest";
import {
  attachExpectedPaymentDateLogHint,
  expectedPaymentDateChangeCount,
  expectedPaymentDateLogStaffHint,
  formatExpectedPaymentLogDate,
  latestPreviousExpectedPaymentDate,
  parseExpectedPaymentDateLog,
} from "@/lib/expected-payment-date-log";
import { setActingStaffId } from "@/lib/acting-staff";

describe("expectedPaymentDateLogStaffHint", () => {
  it("returns a 1-element hint without previous_date", () => {
    expect(expectedPaymentDateLogStaffHint("11111111-1111-1111-1111-111111111111")).toEqual([
      { staff_id: "11111111-1111-1111-1111-111111111111" },
    ]);
  });

  it("returns undefined for empty staff id", () => {
    expect(expectedPaymentDateLogStaffHint(null)).toBeUndefined();
    expect(expectedPaymentDateLogStaffHint("")).toBeUndefined();
    expect(expectedPaymentDateLogStaffHint("   ")).toBeUndefined();
  });
});

describe("attachExpectedPaymentDateLogHint", () => {
  it("attaches the explicit staff id over the acting-staff fallback", () => {
    setActingStaffId("22222222-2222-2222-2222-222222222222");
    const payload: Record<string, unknown> = {};
    attachExpectedPaymentDateLogHint(payload, "11111111-1111-1111-1111-111111111111");
    expect(payload.expected_payment_date_log).toEqual([
      { staff_id: "11111111-1111-1111-1111-111111111111" },
    ]);
    setActingStaffId(null);
  });

  it("uses acting staff when no explicit id is passed", () => {
    setActingStaffId("22222222-2222-2222-2222-222222222222");
    const payload: Record<string, unknown> = {};
    attachExpectedPaymentDateLogHint(payload);
    expect(payload.expected_payment_date_log).toEqual([
      { staff_id: "22222222-2222-2222-2222-222222222222" },
    ]);
    setActingStaffId(null);
  });

  it("leaves the payload unchanged when no staff id is available", () => {
    setActingStaffId(null);
    const payload: Record<string, unknown> = { expected_payment_date: "2026-09-01" };
    attachExpectedPaymentDateLogHint(payload);
    expect(payload).toEqual({ expected_payment_date: "2026-09-01" });
  });
});

describe("parseExpectedPaymentDateLog", () => {
  it("reads an array and keeps only object entries", () => {
    expect(
      parseExpectedPaymentDateLog([
        { previous_date: null, staff_id: null, changed_at: "2026-09-01T10:00:00+08:00" },
        { previous_date: "2026-09-10", staff_id: "abc", changed_at: "2026-09-02T11:00:00+08:00" },
        "skip",
      ])
    ).toEqual([
      { previous_date: null, staff_id: null, changed_at: "2026-09-01T10:00:00+08:00" },
      { previous_date: "2026-09-10", staff_id: "abc", changed_at: "2026-09-02T11:00:00+08:00" },
    ]);
  });

  it("returns [] for invalid input", () => {
    expect(parseExpectedPaymentDateLog(null)).toEqual([]);
    expect(parseExpectedPaymentDateLog("{}")).toEqual([]);
    expect(parseExpectedPaymentDateLog("not-json")).toEqual([]);
  });
});

describe("latestPreviousExpectedPaymentDate", () => {
  it("returns the last entry previous_date, not the current expected date", () => {
    expect(latestPreviousExpectedPaymentDate([])).toBeNull();
    expect(
      latestPreviousExpectedPaymentDate([
        { previous_date: null, staff_id: null, changed_at: "a" },
        { previous_date: "2026-08-15", staff_id: "s", changed_at: "b" },
      ])
    ).toBe("2026-08-15");
  });

  it("counts every logged change including first fill", () => {
    expect(expectedPaymentDateChangeCount([])).toBe(0);
    expect(
      expectedPaymentDateChangeCount([
        { previous_date: null, staff_id: null, changed_at: "a" },
      ])
    ).toBe(1);
  });

  it("formats empty previous dates as an em dash", () => {
    expect(formatExpectedPaymentLogDate(null)).toBe("—");
    expect(formatExpectedPaymentLogDate("2026-08-15")).toBe("2026/08/15");
  });
});
