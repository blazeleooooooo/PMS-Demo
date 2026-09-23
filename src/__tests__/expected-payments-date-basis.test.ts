import { describe, expect, it } from "vitest";
import {
  applyDateBasis,
  dateForBasis,
  type ExpectedPaymentLine,
} from "@/lib/data/expected-payments";

function line(
  overrides: Partial<ExpectedPaymentLine> & { id: string }
): ExpectedPaymentLine {
  return {
    source: "BWA",
    kind: "income",
    projectId: "p1",
    amount: 100,
    counterpart: 0,
    outstanding: 100,
    dueDate: "2026-09-10",
    expectedPaymentDate: "2026-08-20",
    effectiveDate: "2026-08-20",
    ...overrides,
  };
}

describe("dateForBasis", () => {
  it("uses expected_payment_date then due_date for mixed", () => {
    expect(dateForBasis("2026-08-20", "2026-09-10", "mixed")).toBe("2026-08-20");
    expect(dateForBasis(null, "2026-09-10", "mixed")).toBe("2026-09-10");
    expect(dateForBasis(null, null, "mixed")).toBe(null);
  });

  it("uses only due_date when basis is due_date", () => {
    expect(dateForBasis("2026-08-20", "2026-09-10", "due_date")).toBe("2026-09-10");
    expect(dateForBasis("2026-08-20", null, "due_date")).toBe(null);
  });

  it("uses only expected_payment_date when basis is expected_payment_date", () => {
    expect(dateForBasis("2026-08-20", "2026-09-10", "expected_payment_date")).toBe(
      "2026-08-20"
    );
    expect(dateForBasis(null, "2026-09-10", "expected_payment_date")).toBe(null);
  });
});

describe("applyDateBasis", () => {
  const lines = [
    line({ id: "both", expectedPaymentDate: "2026-08-20", dueDate: "2026-09-10" }),
    line({ id: "due-only", expectedPaymentDate: null, dueDate: "2026-09-15", effectiveDate: "2026-09-15" }),
    line({ id: "expected-only", expectedPaymentDate: "2026-08-25", dueDate: null }),
  ];

  it("keeps fallback dates for mixed", () => {
    const next = applyDateBasis(lines, "mixed");
    expect(next.map((l) => [l.id, l.effectiveDate])).toEqual([
      ["both", "2026-08-20"],
      ["due-only", "2026-09-15"],
      ["expected-only", "2026-08-25"],
    ]);
  });

  it("drops rows without due_date when basis is due_date", () => {
    const next = applyDateBasis(lines, "due_date");
    expect(next.map((l) => [l.id, l.effectiveDate])).toEqual([
      ["both", "2026-09-10"],
      ["due-only", "2026-09-15"],
    ]);
  });

  it("drops rows without expected_payment_date when basis is expected_payment_date", () => {
    const next = applyDateBasis(lines, "expected_payment_date");
    expect(next.map((l) => [l.id, l.effectiveDate])).toEqual([
      ["both", "2026-08-20"],
      ["expected-only", "2026-08-25"],
    ]);
  });
});
