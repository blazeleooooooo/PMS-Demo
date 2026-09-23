import { describe, expect, it } from "vitest";
import {
  TASK_BLOCK_SEP,
  TASK_LINE_SEP,
  WA_BODY_PARAM_MAX,
  formatDistrictLabel,
  formatIncomeDigestTaskDisplay,
  formatProjectLine,
  formatTaskBlock,
  hongKongDayUtcBounds,
  hongKongTodayYmd,
  inAppDigestFromBlocks,
  joinTaskBlocks,
} from "@/lib/daily-project-schedule-digest";

describe("hongKongTodayYmd", () => {
  it("returns the HK calendar date", () => {
    expect(hongKongTodayYmd(new Date("2026-09-03T16:30:00Z"))).toBe("2026-09-04");
    expect(hongKongTodayYmd(new Date("2026-09-04T00:00:00+08:00"))).toBe(
      "2026-09-04"
    );
  });
});

describe("hongKongDayUtcBounds", () => {
  it("covers midnight HKT to next midnight HKT", () => {
    expect(hongKongDayUtcBounds("2026-09-04")).toEqual({
      startIso: "2026-09-04T00:00:00+08:00",
      endIso: "2026-09-05T00:00:00+08:00",
    });
  });
});

describe("formatDistrictLabel", () => {
  it("joins code and Chinese", () => {
    expect(formatDistrictLabel("SM", "沙田石門")).toBe("[SM 沙田石門]");
  });

  it("uses Chinese only when there is no code", () => {
    expect(formatDistrictLabel(null, "紅磡")).toBe("[紅磡]");
  });

  it("falls back to real_district_name", () => {
    expect(formatDistrictLabel(null, null, "紅磡")).toBe("[紅磡]");
  });

  it("ignores real_district_name when lookup is present", () => {
    expect(formatDistrictLabel("SM", "沙田石門", "沙田石門")).toBe("[SM 沙田石門]");
  });
});

describe("formatIncomeDigestTaskDisplay", () => {
  it("prefixes 預計收款 when the chip moved to expected_payment_date", () => {
    expect(
      formatIncomeDigestTaskDisplay({
        usingExpected: true,
        contractTypeName: "訂金",
        invoiceNumber: "2",
      })
    ).toBe("預計收款 · 訂金 · 第2期");
  });

  it("prefixes 待收款 on the original due day", () => {
    expect(
      formatIncomeDigestTaskDisplay({
        usingExpected: false,
        contractTypeName: null,
        invoiceNumber: "1",
      })
    ).toBe("待收款 · 第1期");
  });
});

describe("formatTaskBlock", () => {
  it("builds three \\r-separated lines", () => {
    const block = formatTaskBlock({
      taskDisplay: "Handover Form S3 & Email 交場日已簽名S3表格及電郵",
      districtName: "SM",
      districtChinese: "沙田石門",
      projectName: "路德會梁鉅鏐小學 Leung Kui Kau Lutheran Primary School",
      projectCode: "BWA2627JH-003",
    });
    expect(block.split(TASK_LINE_SEP)).toEqual([
      "Handover Form S3 & Email 交場日已簽名S3表格及電郵",
      "[SM 沙田石門] 路德會梁鉅鏐小學 Leung Kui Kau Lutheran Primary School",
      "BWA2627JH-003",
    ]);
    expect(block.includes("\n")).toBe(false);
  });
});

describe("joinTaskBlocks", () => {
  const blockA = formatTaskBlock({
    taskDisplay: "Handover Form S3 & Email 交場日已簽名S3表格及電郵",
    districtName: "SM",
    districtChinese: "沙田石門",
    projectName: "路德會梁鉅鏐小學 Leung Kui Kau Lutheran Primary School",
    projectCode: "BWA2627JH-003",
  });
  const blockB = formatTaskBlock({
    taskDisplay: "PMS Supplier Comment 輸入「PMS系統」",
    districtName: null,
    districtChinese: "紅磡",
    projectName: "聖公會聖匠中學地庫 wall revamp",
    projectCode: "BWA2627SC-001",
  });

  it("joins tasks with a blank \\r\\r line", () => {
    const { digest, includedCount, omittedCount } = joinTaskBlocks([
      blockA,
      blockB,
    ]);
    expect(includedCount).toBe(2);
    expect(omittedCount).toBe(0);
    expect(digest).toBe(`${blockA}${TASK_BLOCK_SEP}${blockB}`);
    expect(digest.includes("\n")).toBe(false);
  });

  it("truncates and reports omitted tasks", () => {
    const huge = Array.from({ length: 20 }, (_, i) =>
      formatTaskBlock({
        taskDisplay: `Task ${i} ${"很長的任務名稱".repeat(20)}`,
        districtName: "SM",
        districtChinese: "沙田石門",
        projectName: "路德會梁鉅鏐小學 Leung Kui Kau Lutheran Primary School",
        projectCode: `BWA2627JH-${String(i).padStart(3, "0")}`,
      })
    );
    const { digest, includedCount, omittedCount } = joinTaskBlocks(huge);
    expect(digest.length).toBeLessThanOrEqual(WA_BODY_PARAM_MAX);
    expect(includedCount + omittedCount).toBe(20);
    expect(omittedCount).toBeGreaterThan(0);
    expect(digest).toContain("及其他");
  });
});

describe("inAppDigestFromBlocks / formatProjectLine", () => {
  it("uses real newlines for the in-app copy", () => {
    const block = formatTaskBlock({
      taskDisplay: "開工",
      districtName: null,
      districtChinese: "紅磡",
      projectName: "測試項目",
      projectCode: "BWA-1",
    });
    expect(inAppDigestFromBlocks([block])).toBe("開工\n[紅磡] 測試項目\nBWA-1");
  });

  it("omits the district when missing", () => {
    expect(formatProjectLine("", "測試項目")).toBe("測試項目");
  });
});
