import { describe, expect, it } from "vitest";
import { invoiceHeaderDiscount } from "@/lib/data/finance";

describe("invoiceHeaderDiscount", () => {
  it("ignores invoices when discount is off or zero", () => {
    expect(
      invoiceHeaderDiscount({
        enable_discount: false,
        discount_amount: 500,
        total_amount: 4500,
        main_item_amount: 5000,
      }),
    ).toBeNull();
    expect(
      invoiceHeaderDiscount({
        enable_discount: true,
        discount_amount: 0,
        total_amount: 5000,
        main_item_amount: 5000,
      }),
    ).toBeNull();
  });

  it("uses generator net + discount as pre-discount gross", () => {
    // InvoiceEditor: gross 5000, discount 500 → total_amount 4500
    expect(
      invoiceHeaderDiscount({
        enable_discount: true,
        discount_amount: 500,
        total_amount: 4500,
        main_item_amount: 4000,
      }),
    ).toEqual({ discount: -500, gross: 5000 });
  });

  it("treats a leftover negative header amount as the same discount", () => {
    expect(
      invoiceHeaderDiscount({
        enable_discount: true,
        discount_amount: -200,
        total_amount: 1800,
        main_item_amount: 2000,
      }),
    ).toEqual({ discount: -200, gross: 2000 });
  });

  it("falls back to main_item_amount when net total is missing", () => {
    expect(
      invoiceHeaderDiscount({
        enable_discount: true,
        discount_amount: 100,
        total_amount: null,
        main_item_amount: 900,
      }),
    ).toEqual({ discount: -100, gross: 900 });
  });
});
