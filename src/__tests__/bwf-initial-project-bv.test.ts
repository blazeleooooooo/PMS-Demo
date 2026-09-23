import { describe, expect, it } from "vitest";
import {
  BWF_COMPANY_BV_RATIO,
  BWF_PITCHING_HANDLER_BV_RATIO,
  BWF_TEAM_LEADER_BV_RATIO,
  COMPANY_BV_HANDLER_ID,
  buildBwfInitialProjectBvShares,
  splitRatioEvenly,
  sumBwfInitialBvRatio,
} from "@/lib/bwf-initial-project-bv";

const MARK = "aa38bc87-cc80-41b9-ad7f-19c82f50a893";
const WINNIE = "870fb3f1-b9e2-413b-9290-932576c28f32";
const LUCA = "65ebefe7-793e-401f-9635-d15e1e747dbb";
const CINDY = "1f6c685e-4a8b-4964-b3af-e3ef9b3b7abd";

function byId(shares: ReturnType<typeof buildBwfInitialProjectBvShares>, id: string) {
  return shares.find((s) => s.handler_id === id);
}

describe("splitRatioEvenly", () => {
  it("returns empty when nobody shares the pool", () => {
    expect(splitRatioEvenly(67, 0)).toEqual([]);
  });

  it("keeps a single share equal to the pool", () => {
    expect(splitRatioEvenly(67, 1)).toEqual([67]);
  });

  it("puts rounding remainder on the last share", () => {
    const parts = splitRatioEvenly(67, 3);
    expect(parts).toEqual([22.33, 22.33, 22.34]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(67);
  });
});

describe("buildBwfInitialProjectBvShares", () => {
  it("gives Mark 70% when he is the only leader and the only pitching handler", () => {
    const shares = buildBwfInitialProjectBvShares({
      pitchingHandlerIds: [MARK],
      teamLeaderIds: [MARK],
    });
    expect(sumBwfInitialBvRatio(shares)).toBe(100);
    expect(byId(shares, COMPANY_BV_HANDLER_ID)?.ratio).toBe(30);
    expect(byId(shares, MARK)).toMatchObject({
      ratio: 70,
      leader_ratio: 3,
      handler_ratio: 67,
    });
    expect(shares).toHaveLength(2);
  });

  it("keeps Mark at 3% and the pitching PM at 67% when Mark is not on pitching_bv", () => {
    const shares = buildBwfInitialProjectBvShares({
      pitchingHandlerIds: [WINNIE],
      teamLeaderIds: [MARK],
    });
    expect(sumBwfInitialBvRatio(shares)).toBe(100);
    expect(byId(shares, MARK)).toMatchObject({ ratio: 3, leader_ratio: 3, handler_ratio: 0 });
    expect(byId(shares, WINNIE)).toMatchObject({ ratio: 67, leader_ratio: 0, handler_ratio: 67 });
    expect(shares).toHaveLength(3);
  });

  it("splits 67% across multiple pitching_bv handlers", () => {
    const shares = buildBwfInitialProjectBvShares({
      pitchingHandlerIds: [WINNIE, LUCA],
      teamLeaderIds: [MARK],
    });
    expect(sumBwfInitialBvRatio(shares)).toBe(100);
    expect(byId(shares, MARK)?.ratio).toBe(3);
    expect(byId(shares, WINNIE)?.ratio).toBe(33.5);
    expect(byId(shares, LUCA)?.ratio).toBe(33.5);
  });

  it("adds Mark's 3% onto his pitching share when he is one of several handlers", () => {
    const shares = buildBwfInitialProjectBvShares({
      pitchingHandlerIds: [MARK, WINNIE],
      teamLeaderIds: [MARK],
    });
    expect(sumBwfInitialBvRatio(shares)).toBe(100);
    expect(byId(shares, MARK)).toMatchObject({
      ratio: 36.5,
      leader_ratio: 3,
      handler_ratio: 33.5,
    });
    expect(byId(shares, WINNIE)?.ratio).toBe(33.5);
    expect(shares.filter((s) => s.handler_id === MARK)).toHaveLength(1);
  });

  it("dedupes pitching_bv handler ids and ignores Acme in that pool", () => {
    const shares = buildBwfInitialProjectBvShares({
      pitchingHandlerIds: [WINNIE, WINNIE, COMPANY_BV_HANDLER_ID, null, ""],
      teamLeaderIds: [MARK],
    });
    expect(sumBwfInitialBvRatio(shares)).toBe(100);
    expect(byId(shares, COMPANY_BV_HANDLER_ID)?.ratio).toBe(BWF_COMPANY_BV_RATIO);
    expect(byId(shares, WINNIE)?.ratio).toBe(BWF_PITCHING_HANDLER_BV_RATIO);
    expect(shares).toHaveLength(3);
  });

  it("leaves 67% unallocated when pitching_bv is empty", () => {
    const shares = buildBwfInitialProjectBvShares({
      pitchingHandlerIds: [],
      teamLeaderIds: [MARK],
    });
    expect(sumBwfInitialBvRatio(shares)).toBe(
      BWF_COMPANY_BV_RATIO + BWF_TEAM_LEADER_BV_RATIO
    );
    expect(shares).toHaveLength(2);
  });

  it("splits the 3% when there are two BWF team leaders", () => {
    const shares = buildBwfInitialProjectBvShares({
      pitchingHandlerIds: [CINDY],
      teamLeaderIds: [MARK, LUCA],
    });
    expect(sumBwfInitialBvRatio(shares)).toBe(100);
    expect(byId(shares, MARK)?.leader_ratio).toBe(1.5);
    expect(byId(shares, LUCA)?.leader_ratio).toBe(1.5);
    expect(byId(shares, CINDY)?.ratio).toBe(67);
  });
});
