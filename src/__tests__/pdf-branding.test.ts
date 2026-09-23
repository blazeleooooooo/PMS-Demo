import { describe, expect, it } from "vitest";
import {
  applyPrimaryCostCentreChange,
  applySlotSourceChange,
  applySlotVisibility,
  brandingFromCostCentre,
  parsePdfBranding,
  resolvePdfBranding,
  type CostCentreBrandingSource,
  type PdfBranding,
} from "@/lib/pdf-branding";

const bwa: CostCentreBrandingSource = {
  id: "cc-bwa",
  bu_code: "BWA",
  display: "Acme Design Limited",
  chinese_display: "Acme 設計有限公司",
  business_logo: "https://logo/bwa.png",
  company_chop: "https://chop/bwa.png",
  bank_notes: "BWA bank",
};

const bwl: CostCentreBrandingSource = {
  id: "cc-bwl",
  bu_code: "BWL",
  display: "Acme Limited",
  chinese_display: "Acme 有限公司",
  business_logo: "https://logo/bwl.png",
  company_chop: "https://chop/bwl.png",
  bank_notes: "BWL bank",
};

const bwf: CostCentreBrandingSource = {
  id: "cc-bwf",
  bu_code: "BWF",
  display: "BWF Limited",
  chinese_display: "BWF 中文",
  business_logo: "https://logo/bwf.png",
  company_chop: "https://chop/bwf.png",
  bank_notes: "BWF bank",
};

describe("brandingFromCostCentre", () => {
  it("copies every slot from the primary cost centre", () => {
    const branding = brandingFromCostCentre(bwa);
    expect(branding.version).toBe(1);
    expect(branding.companyName).toEqual({
      visible: true,
      sourceId: "cc-bwa",
      value: { display: bwa.display, chineseDisplay: bwa.chinese_display },
    });
    expect(branding.companyLogo.value.url).toBe(bwa.business_logo);
    expect(branding.companyChop.value.url).toBe(bwa.company_chop);
    expect(branding.paymentInfo.value.bankNotes).toBe(bwa.bank_notes);
  });
});

describe("parsePdfBranding", () => {
  it("returns null for missing or unknown versions", () => {
    expect(parsePdfBranding(null)).toBeNull();
    expect(parsePdfBranding({ version: 2 })).toBeNull();
  });

  it("keeps snapshot values and visibility from stored JSON", () => {
    const stored: PdfBranding = {
      version: 1,
      companyName: {
        visible: true,
        sourceId: "cc-bwa",
        value: { display: "Custom Name", chineseDisplay: "自訂" },
      },
      companyLogo: { visible: false, sourceId: "cc-bwl", value: { url: "https://logo/bwl.png" } },
      companyChop: { visible: true, sourceId: "cc-bwa", value: { url: "https://chop/bwa.png" } },
      paymentInfo: { visible: true, sourceId: "cc-bwf", value: { bankNotes: "BWF bank" } },
    };
    expect(parsePdfBranding(stored)).toEqual(stored);
  });
});

describe("applyPrimaryCostCentreChange", () => {
  it("resets inherited slots and keeps explicit mix-and-match slots", () => {
    const prev = applySlotSourceChange(brandingFromCostCentre(bwa), "companyLogo", "cc-bwl", [bwa, bwl, bwf]);
    const next = applyPrimaryCostCentreChange(prev, "cc-bwa", bwf);

    expect(next.companyName.sourceId).toBe("cc-bwf");
    expect(next.companyName.value.display).toBe(bwf.display);
    expect(next.companyLogo.sourceId).toBe("cc-bwl");
    expect(next.companyLogo.value.url).toBe(bwl.business_logo);
    expect(next.paymentInfo.sourceId).toBe("cc-bwf");
    expect(next.paymentInfo.value.bankNotes).toBe(bwf.bank_notes);
  });

  it("preserves visibility when resetting inherited slots", () => {
    const hidden = applySlotVisibility(brandingFromCostCentre(bwa), "companyChop", false);
    const next = applyPrimaryCostCentreChange(hidden, "cc-bwa", bwl);
    expect(next.companyChop.visible).toBe(false);
    expect(next.companyChop.sourceId).toBe("cc-bwl");
    expect(next.companyChop.value.url).toBe(bwl.company_chop);
  });
});

describe("resolvePdfBranding", () => {
  it("uses the stored snapshot instead of live cost-centre values", () => {
    const stored = applySlotSourceChange(brandingFromCostCentre(bwa), "paymentInfo", "cc-bwf", [bwa, bwl, bwf]);
    stored.paymentInfo.value.bankNotes = "Frozen BWF bank";

    const resolved = resolvePdfBranding(bwa, stored);
    expect(resolved.paymentInfo.value.bankNotes).toBe("Frozen BWF bank");
    expect(resolved.paymentInfo.sourceId).toBe("cc-bwf");
  });

  it("falls back to the primary cost centre when nothing is stored", () => {
    expect(resolvePdfBranding(bwa, null)).toEqual(brandingFromCostCentre(bwa));
  });
});
