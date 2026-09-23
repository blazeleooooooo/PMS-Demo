import { describe, expect, it } from "vitest";
import {
  collectSettledProjectIds,
  laterReceiveDate,
  matchesProjectBvRatioSum,
  moneyAmountsEqual,
  sharedGpFromRatio,
  sumProjectBvRatios,
} from "@/lib/data/annual-bonus-settlement";

describe("annual bonus settlement helpers", () => {
  it("treats matching money amounts as settled", () => {
    expect(moneyAmountsEqual(100, 100)).toBe(true);
    expect(moneyAmountsEqual("250.00", 250)).toBe(true);
    expect(moneyAmountsEqual(10.001, 10)).toBe(true);
  });

  it("rejects null, NaN, or unmatched amounts", () => {
    expect(moneyAmountsEqual(100, null)).toBe(false);
    expect(moneyAmountsEqual(undefined, 0)).toBe(false);
    expect(moneyAmountsEqual(100, 80)).toBe(false);
    expect(moneyAmountsEqual("x", 0)).toBe(false);
  });

  it("keeps projects with no lines (vacuous settle) and drops any unpaid line", () => {
    const candidates = ["a", "b", "c"];
    const settled = collectSettledProjectIds(candidates, [
      { projectId: "a", expected: 100, paid: 100 },
      { projectId: "b", expected: 50, paid: 40 },
      { projectId: "b", expected: 10, paid: 10 },
    ]);
    expect([...settled].sort()).toEqual(["a", "c"]);
  });

  it("does not let overpay on one line hide underpay on another", () => {
    const settled = collectSettledProjectIds(["p"], [
      { projectId: "p", expected: 100, paid: 80 },
      { projectId: "p", expected: 50, paid: 70 },
    ]);
    expect(settled.has("p")).toBe(false);
  });
});

describe("sharedGpFromRatio", () => {
  it("keeps the same sign as project GP", () => {
    expect(sharedGpFromRatio(145736.33, 60)).toBe(87441.8);
    expect(sharedGpFromRatio(-201352, 60)).toBe(-120811.2);
    expect(sharedGpFromRatio(-16470, 60)).toBe(-9882);
  });

  it("returns 0 when ratio is missing or zero", () => {
    expect(sharedGpFromRatio(1000, null)).toBe(0);
    expect(sharedGpFromRatio(1000, 0)).toBe(0);
    expect(sharedGpFromRatio(1000, undefined)).toBe(0);
  });
});

describe("project_bv ratio sum filter (assign-bv)", () => {
  it("sums ratios per project and skips rows without a project", () => {
    const sums = sumProjectBvRatios([
      { project_id: "p1", ratio: 60 },
      { project_id: "p1", ratio: 40 },
      { project_id: "p2", ratio: 110 },
      { project_id: null, ratio: 50 },
      { project_id: "p3", ratio: null },
    ]);
    expect(sums.get("p1")).toBe(100);
    expect(sums.get("p2")).toBe(110);
    expect(sums.get("p3")).toBe(0);
    expect(sums.has("")).toBe(false);
  });

  it("treats ~100% as complete and uses the same under/over bands as assign-bv", () => {
    expect(matchesProjectBvRatioSum(100, "complete")).toBe(true);
    expect(matchesProjectBvRatioSum(99.99, "complete")).toBe(true);
    expect(matchesProjectBvRatioSum(100.01, "complete")).toBe(true);
    expect(matchesProjectBvRatioSum(99.98, "complete")).toBe(false);
    expect(matchesProjectBvRatioSum(100.02, "complete")).toBe(false);

    expect(matchesProjectBvRatioSum(99.98, "under")).toBe(true);
    expect(matchesProjectBvRatioSum(0, "under")).toBe(true);
    expect(matchesProjectBvRatioSum(100, "under")).toBe(false);

    expect(matchesProjectBvRatioSum(100.02, "over")).toBe(true);
    expect(matchesProjectBvRatioSum(100, "over")).toBe(false);

    expect(matchesProjectBvRatioSum(0, "all")).toBe(true);
    expect(matchesProjectBvRatioSum(150, "all")).toBe(true);
  });
});

describe("laterReceiveDate", () => {
  it("keeps the later incomes.receive_date and ignores nulls", () => {
    expect(laterReceiveDate(null, "2025-03-01")).toBe("2025-03-01");
    expect(laterReceiveDate("2025-03-01", null)).toBe("2025-03-01");
    expect(laterReceiveDate("2025-03-01", "2026-01-15")).toBe("2026-01-15");
    expect(laterReceiveDate("2026-01-15", "2025-03-01")).toBe("2026-01-15");
    expect(laterReceiveDate(null, null)).toBe(null);
    expect(laterReceiveDate("2026-01-15", "not-a-date")).toBe("2026-01-15");
  });
});
