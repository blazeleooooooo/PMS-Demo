import { fetchAllRows, safeQuery } from "@/lib/data/_core";

export interface SalesByPmBvShare {
  shared_estimated_gp: number;
  shared_actual_gp: number;
  estimated_bv: number;
  actual_bv: number;
}

const ZERO_SHARE: SalesByPmBvShare = {
  shared_estimated_gp: 0,
  shared_actual_gp: 0,
  estimated_bv: 0,
  actual_bv: 0,
};

export function salesByPmBvShareKey(projectId: string, handlerId: string): string {
  return `${projectId}::${handlerId}`;
}

export function emptySalesByPmBvShare(): SalesByPmBvShare {
  return { ...ZERO_SHARE };
}

export function lookupSalesByPmBvShare(
  map: Map<string, SalesByPmBvShare>,
  projectId: string | null | undefined,
  handlerId: string | null | undefined,
): SalesByPmBvShare {
  if (!projectId || !handlerId) return emptySalesByPmBvShare();
  return map.get(salesByPmBvShareKey(projectId, handlerId)) ?? emptySalesByPmBvShare();
}

export function salesByPmShareAmounts(
  share: SalesByPmBvShare,
  moneyBasis: "l2" | "l3",
): { sharedGp: number; bv: number } {
  return moneyBasis === "l2"
    ? { sharedGp: share.shared_estimated_gp, bv: share.estimated_bv }
    : { sharedGp: share.shared_actual_gp, bv: share.actual_bv };
}

export function addSalesByPmBvShare(
  map: Map<string, SalesByPmBvShare>,
  projectId: string | null | undefined,
  handlerId: string | null | undefined,
  share: Partial<SalesByPmBvShare>,
): void {
  if (!projectId || !handlerId) return;
  const key = salesByPmBvShareKey(projectId, handlerId);
  const current = map.get(key) ?? emptySalesByPmBvShare();
  map.set(key, {
    shared_estimated_gp: current.shared_estimated_gp + (Number(share.shared_estimated_gp) || 0),
    shared_actual_gp: current.shared_actual_gp + (Number(share.shared_actual_gp) || 0),
    estimated_bv: current.estimated_bv + (Number(share.estimated_bv) || 0),
    actual_bv: current.actual_bv + (Number(share.actual_bv) || 0),
  });
}

/** Main PM's project_bv share per project (handler_id = main PM). */
export async function fetchSalesByPmBvShares(): Promise<Map<string, SalesByPmBvShare>> {
  return safeQuery(async () => {
    const { data, error } = await fetchAllRows(
      "project_bv",
      "project_id, bwf_project_id, handler_id, shared_estimated_gp, shared_actual_gp, estimated_bv, actual_bv",
      (q) => q.not("handler_id", "is", null),
    );
    if (error) return new Map<string, SalesByPmBvShare>();

    const map = new Map<string, SalesByPmBvShare>();
    for (const row of data) {
      const projectId = (row.project_id || row.bwf_project_id) as string | null;
      addSalesByPmBvShare(map, projectId, row.handler_id, {
        shared_estimated_gp: row.shared_estimated_gp,
        shared_actual_gp: row.shared_actual_gp,
        estimated_bv: row.estimated_bv,
        actual_bv: row.actual_bv,
      });
    }
    return map;
  }, new Map<string, SalesByPmBvShare>(), "fetchSalesByPmBvShares", 30000);
}
