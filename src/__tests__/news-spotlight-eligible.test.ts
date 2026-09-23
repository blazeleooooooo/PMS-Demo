import { describe, expect, it } from "vitest";
import { isNewsSpotlightEligible } from "@/lib/news-spotlight";

const REQUIRED = new Set(["pt-required"]);
const BRANDS = new Set(["cust-brand"]);

describe("isNewsSpotlightEligible", () => {
  it("excludes projects below $500K-$1M中型 even with required type", () => {
    expect(
      isNewsSpotlightEligible({
        projectSize: "$250-500K中小型",
        projectTypeIds: ["pt-required"],
        requiredProjectTypeIds: REQUIRED,
        customerId: null,
        wellKnownBrandCustomerIds: BRANDS,
      }),
    ).toBe(false);
  });

  it("includes $500K-$1M中型 with site_status_required project type", () => {
    expect(
      isNewsSpotlightEligible({
        projectSize: "$500K-$1M中型",
        projectTypeIds: ["pt-required", "pt-other"],
        requiredProjectTypeIds: REQUIRED,
        customerId: "cust-other",
        wellKnownBrandCustomerIds: BRANDS,
      }),
    ).toBe(true);
  });

  it("includes mid+ brand-customer projects without required type", () => {
    expect(
      isNewsSpotlightEligible({
        projectSize: "$1M-$3M中大型",
        projectTypeIds: ["pt-other"],
        requiredProjectTypeIds: REQUIRED,
        customerId: "cust-brand",
        wellKnownBrandCustomerIds: BRANDS,
      }),
    ).toBe(true);
  });

  it("excludes mid+ projects with neither required type nor brand tag", () => {
    expect(
      isNewsSpotlightEligible({
        projectSize: "$5M以上重點項目",
        projectTypeIds: ["pt-other"],
        requiredProjectTypeIds: REQUIRED,
        customerId: "cust-other",
        wellKnownBrandCustomerIds: BRANDS,
      }),
    ).toBe(false);
  });

  it("resolves size from estimated_income when project_size missing", () => {
    expect(
      isNewsSpotlightEligible({
        projectSize: null,
        estimatedIncome: 600_000,
        projectTypeIds: ["pt-required"],
        requiredProjectTypeIds: REQUIRED,
        customerId: null,
        wellKnownBrandCustomerIds: BRANDS,
      }),
    ).toBe(true);

    expect(
      isNewsSpotlightEligible({
        projectSize: null,
        estimatedIncome: 400_000,
        projectTypeIds: ["pt-required"],
        requiredProjectTypeIds: REQUIRED,
        customerId: null,
        wellKnownBrandCustomerIds: BRANDS,
      }),
    ).toBe(false);
  });
});
