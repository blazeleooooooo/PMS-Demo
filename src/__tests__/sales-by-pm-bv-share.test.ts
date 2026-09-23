import { describe, expect, it } from "vitest";
import {
  addSalesByPmBvShare,
  lookupSalesByPmBvShare,
  salesByPmShareAmounts,
} from "@/lib/data/sales-by-pm";

describe("sales-by-pm BV share map", () => {
  it("sums multiple project_bv rows for the same project + handler", () => {
    const map = new Map();
    addSalesByPmBvShare(map, "proj-1", "pm-1", {
      shared_estimated_gp: 100,
      shared_actual_gp: 80,
      estimated_bv: 0.25,
      actual_bv: 0.2,
    });
    addSalesByPmBvShare(map, "proj-1", "pm-1", {
      shared_estimated_gp: 50,
      shared_actual_gp: 40,
      estimated_bv: 0.1,
      actual_bv: 0.08,
    });

    expect(lookupSalesByPmBvShare(map, "proj-1", "pm-1")).toEqual({
      shared_estimated_gp: 150,
      shared_actual_gp: 120,
      estimated_bv: 0.35,
      actual_bv: 0.28,
    });
  });

  it("keeps other handlers on the same project separate", () => {
    const map = new Map();
    addSalesByPmBvShare(map, "proj-1", "pm-1", { shared_estimated_gp: 100, estimated_bv: 0.2 });
    addSalesByPmBvShare(map, "proj-1", "designer-1", { shared_estimated_gp: 60, estimated_bv: 0.15 });

    expect(lookupSalesByPmBvShare(map, "proj-1", "pm-1").shared_estimated_gp).toBe(100);
    expect(lookupSalesByPmBvShare(map, "proj-1", "designer-1").shared_estimated_gp).toBe(60);
  });

  it("returns zeros when the main PM has no BV row", () => {
    const map = new Map();
    addSalesByPmBvShare(map, "proj-1", "other", { shared_estimated_gp: 90 });
    expect(lookupSalesByPmBvShare(map, "proj-1", "pm-1")).toEqual({
      shared_estimated_gp: 0,
      shared_actual_gp: 0,
      estimated_bv: 0,
      actual_bv: 0,
    });
  });

  it("picks L2 vs L3 amounts from the money basis", () => {
    const share = {
      shared_estimated_gp: 200,
      shared_actual_gp: 150,
      estimated_bv: 0.5,
      actual_bv: 0.3,
    };
    expect(salesByPmShareAmounts(share, "l2")).toEqual({ sharedGp: 200, bv: 0.5 });
    expect(salesByPmShareAmounts(share, "l3")).toEqual({ sharedGp: 150, bv: 0.3 });
  });
});
