import { describe, expect, it } from "vitest";
import { invoiceNumberPrefixFromDate, nextIssuedInvoiceNumber } from "@/lib/invoice-number";

describe("nextIssuedInvoiceNumber", () => {
  const prefix = "2609";

  it("starts at 00001 when the month has no invoices", () => {
    expect(nextIssuedInvoiceNumber(prefix, [])).toBe("260900001");
  });

  it("uses one above the highest suffix, ignoring duplicates and holes", () => {
    expect(
      nextIssuedInvoiceNumber(prefix, [
        "260901849",
        "260901849",
        "260901866",
        "260901847",
        "not-a-number",
        "260801747",
      ]),
    ).toBe("260901867");
  });
});

describe("invoiceNumberPrefixFromDate", () => {
  it("uses the Hong Kong calendar month", () => {
    expect(invoiceNumberPrefixFromDate(new Date("2026-09-22T16:30:00.000Z"))).toBe("2609");
  });
});
