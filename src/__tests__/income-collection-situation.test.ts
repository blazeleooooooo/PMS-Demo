import { describe, expect, it } from "vitest";
import {
  INCOME_COLLECTION_DELAYED,
  INCOME_COLLECTION_ON_TIME,
  INCOME_COLLECTION_SLIGHTLY_LATE,
  getIncomeCollectionSituation,
} from "@/lib/income-collection-situation";

describe("getIncomeCollectionSituation", () => {
  it("defaults to 可如期收款 when either date is missing", () => {
    expect(getIncomeCollectionSituation(null, "2026-09-10")).toBe(INCOME_COLLECTION_ON_TIME);
    expect(getIncomeCollectionSituation("2026-09-01", null)).toBe(INCOME_COLLECTION_ON_TIME);
    expect(getIncomeCollectionSituation(null, null)).toBe(INCOME_COLLECTION_ON_TIME);
  });

  it("defaults to 可如期收款 when expected is on or before due date", () => {
    expect(getIncomeCollectionSituation("2026-09-01", "2026-09-01")).toBe(INCOME_COLLECTION_ON_TIME);
    expect(getIncomeCollectionSituation("2026-09-10", "2026-09-01")).toBe(INCOME_COLLECTION_ON_TIME);
  });

  it("uses 有少少遲 when the gap is 1–14 days", () => {
    expect(getIncomeCollectionSituation("2026-09-01", "2026-09-02")).toBe(INCOME_COLLECTION_SLIGHTLY_LATE);
    expect(getIncomeCollectionSituation("2026-09-01", "2026-09-15")).toBe(INCOME_COLLECTION_SLIGHTLY_LATE);
  });

  it("uses 出現延誤 when the gap is more than 14 days", () => {
    expect(getIncomeCollectionSituation("2026-09-01", "2026-09-16")).toBe(INCOME_COLLECTION_DELAYED);
    expect(getIncomeCollectionSituation("2026-09-01", "2026-10-01")).toBe(INCOME_COLLECTION_DELAYED);
  });
});
