import { describe, it, expect } from "vitest";
import {
  canViewBVPercentage,
  canViewFinancialValues,
  FINANCIAL_MASK,
  formatBVRatioDisplay,
  formatBVValue,
  maskIfHidden,
} from "@/lib/financial-visibility";
import {
  formatMoney,
  formatMoney2,
  formatMoneyCompact,
} from "@/lib/date-utils";

describe("canViewBVPercentage", () => {
  it("denies Designer regardless of role", () => {
    expect(canViewBVPercentage("Designer", "Admin")).toBe(false);
    expect(canViewBVPercentage("Designer", "User")).toBe(false);
  });

  it("denies User role regardless of position", () => {
    expect(canViewBVPercentage("PM", "User")).toBe(false);
    expect(canViewBVPercentage("Company", "User")).toBe(false);
  });

  it("allows PM with Senior User or Admin role", () => {
    expect(canViewBVPercentage("PM", "Senior User")).toBe(true);
    expect(canViewBVPercentage("PM", "Admin")).toBe(true);
  });
});

describe("formatBVRatioDisplay", () => {
  it("masks ratio for hidden viewers", () => {
    expect(formatBVRatioDisplay(30, false)).toBe(FINANCIAL_MASK);
  });

  it("shows ratio with percent sign when visible", () => {
    expect(formatBVRatioDisplay(30, true)).toBe("30%");
  });
});

describe("canViewFinancialValues", () => {
  it("denies Designer", () => {
    expect(canViewFinancialValues("Designer")).toBe(false);
  });

  it("allows PM", () => {
    expect(canViewFinancialValues("PM")).toBe(true);
  });

  it("allows Company", () => {
    expect(canViewFinancialValues("Company")).toBe(true);
  });

  it("allows 3D Designer (exact match only)", () => {
    expect(canViewFinancialValues("3D Designer")).toBe(true);
  });

  it("allows null/undefined position", () => {
    expect(canViewFinancialValues(null)).toBe(true);
    expect(canViewFinancialValues(undefined)).toBe(true);
  });
});

describe("maskIfHidden", () => {
  it("returns mask when hidden", () => {
    expect(maskIfHidden(false, () => formatMoney(12345))).toBe(FINANCIAL_MASK);
  });

  it("returns formatted value when visible", () => {
    expect(maskIfHidden(true, () => formatMoney(12345))).toBe("$12,345");
  });
});

describe("formatBVValue", () => {
  it("formats BV with two decimals", () => {
    expect(formatBVValue(12.5)).toBe("12.50");
  });

  it("returns fallback for null", () => {
    expect(formatBVValue(null)).toBe("-");
  });
});

describe("masked formatter integration", () => {
  function maskedFormatMoney(
    canView: boolean,
    val: number | null | undefined
  ): string {
    return maskIfHidden(canView, () => formatMoney(val));
  }

  it("masks money for Designer", () => {
    expect(maskedFormatMoney(false, 50000)).toBe(FINANCIAL_MASK);
  });

  it("shows money for non-Designer", () => {
    expect(maskedFormatMoney(true, 50000)).toBe("$50,000");
  });

  it("masks compact money for Designer", () => {
    expect(
      maskIfHidden(false, () => formatMoneyCompact(1_500_000))
    ).toBe(FINANCIAL_MASK);
  });

  it("shows compact money for non-Designer", () => {
    expect(
      maskIfHidden(true, () => formatMoneyCompact(1_500_000))
    ).toBe("$1.5M");
  });

  it("masks formatMoney2 for Designer", () => {
    expect(maskIfHidden(false, () => formatMoney2(99.5))).toBe(FINANCIAL_MASK);
  });
});
