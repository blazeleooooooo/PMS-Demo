import { describe, expect, it } from "vitest";
import { COMPANY_BV_HANDLER_ID } from "@/lib/bwf-initial-project-bv";
import {
  PROJECT_BV_CREATED_TITLE,
  buildProjectBvCreatedMessage,
  formatProjectBvRatioPercent,
  projectBvCreatedProjectLabel,
  shouldNotifyProjectBvHandler,
} from "@/lib/project-bv-notify";

const HANDLER = "aa38bc87-cc80-41b9-ad7f-19c82f50a893";
const ASSIGNER = "870fb3f1-b9e2-413b-9290-932576c28f32";

describe("formatProjectBvRatioPercent", () => {
  it("returns null for missing or non-finite values", () => {
    expect(formatProjectBvRatioPercent(null)).toBeNull();
    expect(formatProjectBvRatioPercent(undefined)).toBeNull();
    expect(formatProjectBvRatioPercent(Number.NaN)).toBeNull();
  });

  it("keeps integers and two-decimal rounding", () => {
    expect(formatProjectBvRatioPercent(20)).toBe("20");
    expect(formatProjectBvRatioPercent(0)).toBe("0");
    expect(formatProjectBvRatioPercent(33.333)).toBe("33.33");
  });
});

describe("buildProjectBvCreatedMessage", () => {
  it("uses assigner, project code, and ratio", () => {
    expect(
      buildProjectBvCreatedMessage({
        assignerName: "陳大文",
        projectCode: "BWA-2026-015",
        projectName: "海港城",
        ratio: 20,
      })
    ).toBe("陳大文 已將你加入項目 BWA-2026-015 的 BV 分配（比例 20%）。");
  });

  it("falls back to 系統 and project name when code is missing", () => {
    expect(
      buildProjectBvCreatedMessage({
        assignerName: "  ",
        projectCode: null,
        projectName: "訂製家具",
        ratio: 33.5,
      })
    ).toBe("系統 已將你加入項目 訂製家具 的 BV 分配（比例 33.5%）。");
  });

  it("omits the ratio clause when ratio is absent", () => {
    expect(
      buildProjectBvCreatedMessage({
        assignerName: "系統",
        projectCode: "BWF-2026-042",
      })
    ).toBe("系統 已將你加入項目 BWF-2026-042 的 BV 分配。");
  });

  it("falls back to 項目 when both labels are empty", () => {
    expect(projectBvCreatedProjectLabel(null, "  ")).toBe("項目");
  });
});

describe("shouldNotifyProjectBvHandler", () => {
  it("skips company BV, empty handler, and self-assign", () => {
    expect(
      shouldNotifyProjectBvHandler({
        handlerId: COMPANY_BV_HANDLER_ID,
        assignerStaffId: ASSIGNER,
      })
    ).toBe(false);
    expect(
      shouldNotifyProjectBvHandler({
        handlerId: null,
        assignerStaffId: ASSIGNER,
      })
    ).toBe(false);
    expect(
      shouldNotifyProjectBvHandler({
        handlerId: HANDLER,
        assignerStaffId: HANDLER,
      })
    ).toBe(false);
  });

  it("notifies another staff handler", () => {
    expect(
      shouldNotifyProjectBvHandler({
        handlerId: HANDLER,
        assignerStaffId: ASSIGNER,
      })
    ).toBe(true);
  });
});

describe("PROJECT_BV_CREATED_TITLE", () => {
  it("keeps the agreed notification-center title", () => {
    expect(PROJECT_BV_CREATED_TITLE).toBe("已獲分配項目 BV");
  });
});
