import { describe, expect, it } from "vitest";
import { incomeAoFieldsFromRow, isAoContractType } from "@/lib/income-ao";

describe("isAoContractType", () => {
  const types = [
    { id: "ao-1", is_ao: true },
    { id: "main-1", is_ao: false },
    { id: "unset-1", is_ao: null },
  ];

  it("is true only when the selected contract type has is_ao", () => {
    expect(isAoContractType(types, "ao-1")).toBe(true);
    expect(isAoContractType(types, "main-1")).toBe(false);
    expect(isAoContractType(types, "unset-1")).toBe(false);
    expect(isAoContractType(types, null)).toBe(false);
    expect(isAoContractType(types, "missing")).toBe(false);
  });
});

describe("incomeAoFieldsFromRow", () => {
  it("keeps date-only values and copies the rest of the A.O. fields", () => {
    expect(
      incomeAoFieldsFromRow({
        ao_request_date: "2026-03-15",
        ao_issue_date: "2026-03-16",
        ao_work_days: 12,
        ao_design_firm_status: "未確定",
        ao_quotation_firm_date: null,
        ao_work_status: "未做",
        ao_client_follow_up: "call later",
      })
    ).toEqual({
      ao_request_date: "2026-03-15",
      ao_issue_date: "2026-03-16",
      ao_work_days: 12,
      ao_design_firm_status: "未確定",
      ao_quotation_firm_date: null,
      ao_work_status: "未做",
      ao_client_follow_up: "call later",
    });
  });
});
