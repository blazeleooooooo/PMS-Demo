/** Acme company handler used on project_bv / pitching convert. */
export const COMPANY_BV_HANDLER_ID = "00000000-0000-4000-8000-000000000001";

export const BWF_COMPANY_BV_RATIO = 30;
export const BWF_TEAM_LEADER_BV_RATIO = 3;
export const BWF_PITCHING_HANDLER_BV_RATIO = 67;

export type BwfInitialBvShare = {
  handler_id: string;
  ratio: number;
  company_ratio: number;
  leader_ratio: number;
  handler_ratio: number;
};

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = typeof id === "string" ? id.trim() : "";
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Split `total` across `n` people; last row absorbs rounding so the sum is exact. */
export function splitRatioEvenly(total: number, n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [round2(total)];
  const raw = total / n;
  const parts: number[] = [];
  let allocated = 0;
  for (let i = 0; i < n - 1; i++) {
    const part = round2(raw);
    parts.push(part);
    allocated += part;
  }
  parts.push(round2(total - allocated));
  return parts;
}

/**
 * Initial BWF project_bv split on convert:
 * - Acme 30% (one row; excluded from the other two pools)
 * - Active BWF Senior User team leaders share 3%
 * - Distinct pitching_bv handlers share 67%
 * - Same person in both pools gets one row with the two shares added
 */
export function buildBwfInitialProjectBvShares(input: {
  pitchingHandlerIds: Array<string | null | undefined>;
  teamLeaderIds: Array<string | null | undefined>;
}): BwfInitialBvShare[] {
  const leaders = uniqueIds(input.teamLeaderIds).filter((id) => id !== COMPANY_BV_HANDLER_ID);
  const handlers = uniqueIds(input.pitchingHandlerIds).filter((id) => id !== COMPANY_BV_HANDLER_ID);

  const company: BwfInitialBvShare = {
    handler_id: COMPANY_BV_HANDLER_ID,
    ratio: BWF_COMPANY_BV_RATIO,
    company_ratio: BWF_COMPANY_BV_RATIO,
    leader_ratio: 0,
    handler_ratio: 0,
  };

  const byId = new Map<string, BwfInitialBvShare>();

  const leaderParts = splitRatioEvenly(BWF_TEAM_LEADER_BV_RATIO, leaders.length);
  leaders.forEach((id, i) => {
    byId.set(id, {
      handler_id: id,
      ratio: leaderParts[i],
      company_ratio: 0,
      leader_ratio: leaderParts[i],
      handler_ratio: 0,
    });
  });

  const handlerParts = splitRatioEvenly(BWF_PITCHING_HANDLER_BV_RATIO, handlers.length);
  handlers.forEach((id, i) => {
    const existing = byId.get(id);
    if (existing) {
      existing.handler_ratio = handlerParts[i];
      existing.ratio = round2(existing.leader_ratio + existing.handler_ratio);
      return;
    }
    byId.set(id, {
      handler_id: id,
      ratio: handlerParts[i],
      company_ratio: 0,
      leader_ratio: 0,
      handler_ratio: handlerParts[i],
    });
  });

  const rest = [
    ...leaders.map((id) => byId.get(id)!),
    ...handlers.filter((id) => !byId.get(id)?.leader_ratio).map((id) => byId.get(id)!),
  ];

  return [company, ...rest];
}

export function sumBwfInitialBvRatio(shares: BwfInitialBvShare[]): number {
  return round2(shares.reduce((sum, row) => sum + row.ratio, 0));
}
