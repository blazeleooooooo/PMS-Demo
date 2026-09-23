import { describe, expect, it } from "vitest";
import {
  hasIncomeBelowEstimatedReason,
  isProjectIncomeBelowEstimated,
  normalizeIncomeBelowEstimatedReason,
  otherProjectIncomeTotal,
} from "@/lib/income-estimated-floor";

describe("otherProjectIncomeTotal", () => {
  const incomes = [
    { id: "a", amount: 40000 },
    { id: "b", amount: 60000 },
  ];

  it("sums all rows when nothing is excluded", () => {
    expect(otherProjectIncomeTotal(incomes)).toBe(100000);
  });

  it("excludes the edited or deleted row", () => {
    expect(otherProjectIncomeTotal(incomes, "a")).toBe(60000);
  });
});

describe("isProjectIncomeBelowEstimated", () => {
  it("ignores null or non-positive estimated income", () => {
    expect(isProjectIncomeBelowEstimated(0, null)).toBe(false);
    expect(isProjectIncomeBelowEstimated(0, 0)).toBe(false);
  });

  it("flags a projected total below estimated income", () => {
    expect(isProjectIncomeBelowEstimated(99999.99, 100000)).toBe(true);
    expect(isProjectIncomeBelowEstimated(100000, 100000)).toBe(false);
  });
});

describe("hasIncomeBelowEstimatedReason", () => {
  it("treats blank or whitespace as empty", () => {
    expect(hasIncomeBelowEstimatedReason(null)).toBe(false);
    expect(hasIncomeBelowEstimatedReason("   ")).toBe(false);
    expect(normalizeIncomeBelowEstimatedReason("  cut scope  ")).toBe("cut scope");
    expect(hasIncomeBelowEstimatedReason("cut scope")).toBe(true);
  });
});
