import { fetchAllByFk, mapBatchesParallel, safeQuery, supabase } from "@/lib/data/_core";

export interface BWFLatestOutstandingRemark {
  latestRemark: string | null;
  latestCreatedDate: string | null;
  remarkCount: number;
}

export interface BWFOutstandingRemarkCard {
  id: string;
  remarks: string;
  createdDate: string | null;
  creatorName: string | null;
  createdById: string | null;
}

function emptyLatestRemark(): BWFLatestOutstandingRemark {
  return { latestRemark: null, latestCreatedDate: null, remarkCount: 0 };
}

type RemarkRow = {
  id: string;
  bwf_project_id: string | null;
  remarks: string | null;
  created_date: string | null;
  created_by_id: string | null;
};

async function fetchBWFOutstandingRemarkRows(projectIds: string[]): Promise<RemarkRow[]> {
  return mapBatchesParallel<RemarkRow>(
    projectIds,
    200,
    4,
    (batch) =>
      fetchAllByFk(
        "outstanding_remarks",
        "id, bwf_project_id, remarks, created_date, created_by_id",
        "bwf_project_id",
        batch,
        (q) => q.not("remarks", "is", null),
      ),
  );
}

async function resolveCreatorNames(userIds: string[]): Promise<Map<string, string>> {
  const creatorMap = new Map<string, string>();
  if (userIds.length === 0) return creatorMap;

  const { data: usersData } = await supabase
    .from("users")
    .select("id, member_id")
    .in("id", userIds);

  const memberIds = [
    ...new Set((usersData ?? []).map((u: { member_id: string | null }) => u.member_id).filter(Boolean)),
  ] as string[];

  let staffMap = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data: staffRows } = await supabase
      .from("staff")
      .select("id, name, full_name")
      .in("id", memberIds);
    staffMap = new Map(
      (staffRows ?? []).map((s: { id: string; name: string | null; full_name: string | null }) => [
        s.id,
        s.name || s.full_name || "",
      ]),
    );
  }

  for (const u of usersData ?? []) {
    const name = u.member_id ? staffMap.get(u.member_id) : null;
    if (name) creatorMap.set(u.id, name);
  }

  const unresolved = userIds.filter((id) => !creatorMap.has(id));
  if (unresolved.length > 0) {
    const { data: staffDirect } = await supabase
      .from("staff")
      .select("id, name, full_name")
      .in("id", unresolved);
    for (const s of staffDirect ?? []) {
      const name = s.name || s.full_name;
      if (name) creatorMap.set(s.id, name);
    }
  }

  return creatorMap;
}

/** All outstanding_remarks cards per BWF project for /bwf/payment-progress. */
export async function fetchBWFOutstandingRemarkCards(
  projectIds: string[],
): Promise<Record<string, BWFOutstandingRemarkCard[]>> {
  if (projectIds.length === 0) return {};

  return safeQuery(async () => {
    const result: Record<string, BWFOutstandingRemarkCard[]> = {};
    for (const id of projectIds) result[id] = [];

    const rows = await fetchBWFOutstandingRemarkRows(projectIds);
    const creatorIds = [
      ...new Set(rows.map((row) => row.created_by_id).filter((id): id is string => !!id)),
    ];
    const creatorMap = await resolveCreatorNames(creatorIds);

    for (const row of rows) {
      const pid = row.bwf_project_id;
      const text = row.remarks?.trim();
      if (!pid || !text) continue;
      (result[pid] ??= []).push({
        id: row.id,
        remarks: text,
        createdDate: row.created_date,
        creatorName: row.created_by_id ? creatorMap.get(row.created_by_id) ?? null : null,
        createdById: row.created_by_id,
      });
    }

    for (const id of projectIds) {
      result[id].sort((a, b) => {
        const aTime = a.createdDate ? new Date(a.createdDate).getTime() : 0;
        const bTime = b.createdDate ? new Date(b.createdDate).getTime() : 0;
        return bTime - aTime;
      });
    }

    return result;
  }, {}, "fetchBWFOutstandingRemarkCards", 30000);
}

/** Latest outstanding_remarks text per BWF project for /bwf/payment-progress. */
export async function fetchBWFLatestOutstandingRemarks(
  projectIds: string[],
): Promise<Record<string, BWFLatestOutstandingRemark>> {
  if (projectIds.length === 0) return {};

  return safeQuery(async () => {
    const cards = await fetchBWFOutstandingRemarkCards(projectIds);
    const result: Record<string, BWFLatestOutstandingRemark> = {};
    for (const id of projectIds) {
      const list = cards[id] ?? [];
      result[id] = list.length
        ? {
            latestRemark: list[0].remarks,
            latestCreatedDate: list[0].createdDate,
            remarkCount: list.length,
          }
        : emptyLatestRemark();
    }
    return result;
  }, {}, "fetchBWFLatestOutstandingRemarks", 30000);
}
