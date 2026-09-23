import { describe, expect, it } from "vitest";
import {
  buildCasePdfMetaRows,
  formatCasePdfDealAmount,
  formatCasePdfPeriodDisplay,
} from "@/lib/case-pdf-meta";

describe("formatCasePdfPeriodDisplay", () => {
  it("merges date range and days onto one line", () => {
    expect(
      formatCasePdfPeriodDisplay("2025年12月 – 2026年5月", "159"),
    ).toBe("2025年12月 – 2026年5月 (159 日)");
  });

  it("returns only the date range when days are blank", () => {
    expect(formatCasePdfPeriodDisplay("2025年1月", "")).toBe("2025年1月");
  });

  it("returns only days when the date range is blank", () => {
    expect(formatCasePdfPeriodDisplay("", "45")).toBe("45 日");
  });
});

describe("formatCasePdfDealAmount", () => {
  it("prefixes a dollar sign", () => {
    expect(formatCasePdfDealAmount("700000")).toBe("$700000");
  });

  it("does not double an existing dollar sign", () => {
    expect(formatCasePdfDealAmount("$700000")).toBe("$700000");
  });

  it("returns empty when the amount is blank", () => {
    expect(formatCasePdfDealAmount("")).toBe("");
  });
});

describe("buildCasePdfMetaRows", () => {
  it("returns one row per present field and merges days into the period", () => {
    const rows = buildCasePdfMetaRows({
      districtName: "中西區",
      buildingName: "IFC",
      actualSize: "1200",
      constructionPeriod: "2025年1月 – 2025年3月",
      constructionDays: "90",
    });
    expect(rows.map((r) => r.key)).toEqual([
      "district",
      "building",
      "size",
      "period",
    ]);
    expect(rows.find((r) => r.key === "size")?.display).toBe("1200 呎");
    expect(rows.find((r) => r.key === "period")?.display).toBe(
      "2025年1月 – 2025年3月 (90 日)",
    );
  });

  it("keeps days as its own row when merge is disabled", () => {
    const rows = buildCasePdfMetaRows(
      {
        districtName: "中西區",
        buildingName: "IFC",
        actualSize: "1200",
        constructionPeriod: "2025年1月 – 2025年3月",
        constructionDays: "90",
      },
      { mergePeriodDays: false },
    );
    expect(rows.map((r) => r.key)).toEqual([
      "district",
      "building",
      "size",
      "period",
      "days",
    ]);
    expect(rows.find((r) => r.key === "days")?.display).toBe("90 日");
  });

  it("omits a row when that field is null, empty, or whitespace", () => {
    const rows = buildCasePdfMetaRows({
      districtName: "  ",
      buildingName: null,
      actualSize: "",
      constructionPeriod: "2025年1月",
      constructionDays: undefined,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("period");
    expect(rows[0].display).toBe("2025年1月");
  });

  it("returns no rows when every field is blank", () => {
    expect(
      buildCasePdfMetaRows({
        districtName: "",
        buildingName: "",
        actualSize: "",
        constructionPeriod: "",
        constructionDays: "",
      }),
    ).toEqual([]);
  });
});
