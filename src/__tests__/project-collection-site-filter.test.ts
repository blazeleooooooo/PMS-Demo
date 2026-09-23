import { describe, expect, it } from "vitest";
import {
  isFullyCollected,
  matchesCollectionStatus,
  matchesSiteStatus,
} from "@/lib/project-collection-site-filter";

describe("isFullyCollected", () => {
  it("treats equal income and payment sums as fully collected", () => {
    expect(isFullyCollected(1000, 1000)).toBe(true);
    expect(isFullyCollected(0, 0)).toBe(true);
  });

  it("treats overpay as fully collected and underpay as incomplete", () => {
    expect(isFullyCollected(1000, 1000.02)).toBe(true);
    expect(isFullyCollected(1000, 999)).toBe(false);
  });
});

describe("matchesCollectionStatus", () => {
  it("keeps every row when filter is all or sums are still unknown", () => {
    expect(matchesCollectionStatus(100, 50, "all")).toBe(true);
    expect(matchesCollectionStatus(null, null, "incomplete")).toBe(true);
  });

  it("uses amount sums only — 全部收款 vs 未完成收款", () => {
    expect(matchesCollectionStatus(800, 800, "fully_paid")).toBe(true);
    expect(matchesCollectionStatus(800, 800, "incomplete")).toBe(false);
    expect(matchesCollectionStatus(800, 200, "incomplete")).toBe(true);
    expect(matchesCollectionStatus(800, 200, "fully_paid")).toBe(false);
  });
});

describe("matchesSiteStatus", () => {
  const today = "2026-09-16";

  it("已開工 requires start_date on or before today", () => {
    expect(matchesSiteStatus("2026-09-01", null, "started", today)).toBe(true);
    expect(matchesSiteStatus("2026-09-20", null, "started", today)).toBe(false);
    expect(matchesSiteStatus(null, "2026-09-01", "started", today)).toBe(false);
  });

  it("已開工 N天 is days since start_date", () => {
    expect(matchesSiteStatus("2026-08-17", null, "started_30", today)).toBe(true);
    expect(matchesSiteStatus("2026-08-18", null, "started_30", today)).toBe(false);
    expect(matchesSiteStatus("2026-07-18", null, "started_60", today)).toBe(true);
    expect(matchesSiteStatus("2026-06-18", null, "started_90", today)).toBe(true);
  });

  it("正在進行中 is started and not handed over", () => {
    expect(matchesSiteStatus("2026-08-01", null, "in_progress", today)).toBe(true);
    expect(matchesSiteStatus("2026-08-01", "2026-09-20", "in_progress", today)).toBe(
      true,
    );
    expect(matchesSiteStatus("2026-08-01", "2026-09-10", "in_progress", today)).toBe(
      false,
    );
  });

  it("已經交場 uses handover_date on or before today", () => {
    expect(matchesSiteStatus("2026-08-01", "2026-09-10", "handed_over", today)).toBe(
      true,
    );
    expect(matchesSiteStatus(null, "2026-09-16", "handed_over", today)).toBe(true);
    expect(matchesSiteStatus("2026-08-01", "2026-09-20", "handed_over", today)).toBe(
      false,
    );
    expect(matchesSiteStatus("2026-08-01", null, "handed_over", today)).toBe(false);
  });
});
