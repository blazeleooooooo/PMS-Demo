import { describe, expect, it } from "vitest";
import {
  emptySupplierDocumentEligibility,
  evaluateExpenseGroupRules,
  EXPENSE_RULES_EXEMPT_CONTRACT_TYPE_ID,
  getExpenseAmountRuleCompliances,
  groupHasSupplierQuotation,
  isSupplierFileNotExpired,
  supplierMeetsDocumentRules,
} from "@/lib/expense-amount-rules";

const FURNITURE_ID = "babeefec-49b5-430b-a186-7d12be824e89";
const CONTRACT_ID = "a5de2560-987d-4b25-ba1d-0278ab037143";

describe("isSupplierFileNotExpired", () => {
  it("accepts ISO timestamps and space-separated Postgres timestamps", () => {
    expect(isSupplierFileNotExpired("2027-07-29T00:00:00+00:00")).toBe(true);
    expect(isSupplierFileNotExpired("2027-07-29 00:00:00+00")).toBe(true);
    expect(isSupplierFileNotExpired("2030-12-31 00:00:00+00")).toBe(true);
  });

  it("accepts Date objects", () => {
    expect(isSupplierFileNotExpired(new Date("2027-07-29T00:00:00.000Z"))).toBe(true);
  });

  it("rejects missing, invalid, or past dates", () => {
    expect(isSupplierFileNotExpired(null)).toBe(false);
    expect(isSupplierFileNotExpired("")).toBe(false);
    expect(isSupplierFileNotExpired("not-a-date")).toBe(false);
    expect(isSupplierFileNotExpired("2020-01-01")).toBe(false);
  });
});

describe("group expense rule compliance", () => {
  const group = evaluateExpenseGroupRules(
    44250,
    FURNITURE_ID,
    CONTRACT_ID,
    [],
    undefined,
    true
  );

  it("marks quotation unmet until a file is present, then met", () => {
    const unmet = getExpenseAmountRuleCompliances(group.ruleStatuses, {
      hasQuotation: false,
      supplierId: FURNITURE_ID,
      eligibility: emptySupplierDocumentEligibility(),
    });
    expect(unmet.find((r) => r.key === "quotation")?.compliance).toBe("unmet");

    const met = getExpenseAmountRuleCompliances(group.ruleStatuses, {
      hasQuotation: true,
      supplierId: FURNITURE_ID,
      eligibility: emptySupplierDocumentEligibility(),
    });
    expect(met.find((r) => r.key === "quotation")?.compliance).toBe("met");
  });

  it("marks BR met when the supplier has a valid BR file", () => {
    const eligibility = emptySupplierDocumentEligibility();
    eligibility.withValidBr.add(FURNITURE_ID);
    eligibility.withAnyBr.add(FURNITURE_ID);

    const rows = getExpenseAmountRuleCompliances(group.ruleStatuses, {
      hasQuotation: true,
      supplierId: FURNITURE_ID,
      eligibility,
    });
    expect(rows.find((r) => r.key === "br")?.compliance).toBe("met");
    expect(rows.find((r) => r.key === "insurance")?.compliance).toBe("inactive");
    expect(supplierMeetsDocumentRules(FURNITURE_ID, group.rules, eligibility)).toBe(true);
  });

  it("treats a form-state quotation as satisfying the group rule", () => {
    expect(
      groupHasSupplierQuotation(
        FURNITURE_ID,
        CONTRACT_ID,
        [{ id: "exp-1", supplier_id: FURNITURE_ID, n_contract_type_id: CONTRACT_ID, supplier_quotation_file: null }],
        "https://example.com/quote.pdf",
        "exp-1"
      )
    ).toBe(true);
  });
});

describe("refundable contract type skips group expense rules", () => {
  it("does not activate quotation, BR, or Insurance for 可退還", () => {
    const group = evaluateExpenseGroupRules(
      300_000,
      FURNITURE_ID,
      EXPENSE_RULES_EXEMPT_CONTRACT_TYPE_ID,
      [],
      undefined,
      true
    );

    expect(group.expenseControlApplicable).toBe(false);
    expect(group.skipReason).toBe("contract_type");
    expect(group.canEvaluate).toBe(false);
    expect(group.rules).toEqual({
      quotationRequired: false,
      brRequired: false,
      insuranceRequired: false,
    });
    expect(group.ruleStatuses.every((rule) => !rule.active)).toBe(true);
  });
});
