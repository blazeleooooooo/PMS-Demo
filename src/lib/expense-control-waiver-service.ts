import { supabase } from "@/lib/supabase";

/**
 * 初步檢查: expense installment sum must not exceed income amount sum.
 * Waivers for this key are reviewed on /admin/expense-installment-waivers only.
 */
export const INSTALLMENT_VS_INCOME_ITEM_KEY = "installment-vs-income";

/** 初步檢查: overdue incomes must have expected_payment_date. */
export const OVERDUE_INCOME_EXPECTED_DATE_ITEM_KEY =
  "overdue-income-expected-date";

/** Permission module / route for the special installment-vs-income waiver queue. */
export const INSTALLMENT_WAIVER_PERMISSION_MODULE =
  "admin.expense-installment-waivers";
export const INSTALLMENT_WAIVER_QUEUE_PATH =
  "/admin/expense-installment-waivers";

export function isInstallmentVsIncomeItemKey(key: string): boolean {
  return key === INSTALLMENT_VS_INCOME_ITEM_KEY;
}

export function waiverHasInstallmentVsIncomeItem(
  itemKeys: string[] | null | undefined
): boolean {
  return (itemKeys ?? []).some(isInstallmentVsIncomeItemKey);
}

/** Checklist item keys that can be waived (mirrors expense-control-service). */
export const EXPENSE_CONTROL_ITEM_LABELS: Record<string, string> = {
  dates: "已填寫開工日及交場日",
  [INSTALLMENT_VS_INCOME_ITEM_KEY]: "支出總額不大於收入總額",
  [OVERDUE_INCOME_EXPECTED_DATE_ITEM_KEY]: "逾期收入已填寫預計收款日期",
  "customer-br": "已上載「BR 商業登記證」",
  "customer-form-s1": "已上載「Form S1 - BW Start Project Form」",
  insurance: "已上載「Site Work Insurance 工地保險」",
  "main-contractor": "已填寫主要承包商 Main Contractor",
  "site-status": "工地狀況 Site Status 最少填寫 90%",
  "ten-day-reports": "每10天工地報告無逾期（項目無需每10天報告）",
  schedule: "時間表最少填寫 70%",
  plan: "已上載最新「平面圖 8 Plan」",
  "detailed-drawing": "已上載「施工圖紙 Detailed Drawing」",
  rendering: "已上載「效果圖 3D Rendering」",
  "project-ppt": "已上載「項目ppt」",
  "internal-comment": "已填寫「內部評論」",
  "supplier-comment": "已填寫「供應商評論」",
  "completion-photos": "已上載「完工相片」",
  "form-s3": "已上載「Form S3 Handover Report」",
  "customer-testimonial": "已上載「Testimonial Letter 推薦信」",
};

export type WaiverStatus = "pending" | "approved" | "rejected" | "revoked";

export interface ExpenseControlWaiver {
  id: string;
  bwa_project_id: string;
  item_keys: string[];
  reason: string;
  status: WaiverStatus;
  applicant_id: string;
  reviewer_id: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  applicant_name?: string | null;
  reviewer_name?: string | null;
  project_code?: string | null;
  project_name?: string | null;
  project_team_id?: string | null;
}

export function labelForWaiverItems(keys: string[]): string {
  return keys.map((k) => EXPENSE_CONTROL_ITEM_LABELS[k] ?? k).join("、");
}

/** Approved item keys for a single project (unlocks those checklist items). */
export async function fetchApprovedWaiverKeys(
  projectId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("expense_control_waivers")
    .select("item_keys")
    .eq("bwa_project_id", projectId)
    .eq("status", "approved");

  if (error) {
    console.error("[fetchApprovedWaiverKeys]", error);
    return [];
  }

  const keys = new Set<string>();
  for (const row of data ?? []) {
    for (const k of row.item_keys ?? []) {
      if (k) keys.add(k);
    }
  }
  return [...keys];
}

/** Map projectId → approved item key set (bulk evaluator). */
export async function fetchApprovedWaiverKeysByProject(
  projectIds: string[],
  client: { from: typeof supabase.from } = supabase
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (projectIds.length === 0) return map;

  const CHUNK = 200;
  for (let i = 0; i < projectIds.length; i += CHUNK) {
    const chunk = projectIds.slice(i, i + CHUNK);
    const { data, error } = await client
      .from("expense_control_waivers")
      .select("bwa_project_id, item_keys")
      .in("bwa_project_id", chunk)
      .eq("status", "approved");

    if (error) {
      console.error("[fetchApprovedWaiverKeysByProject]", error);
      continue;
    }
    for (const row of data ?? []) {
      const pid = row.bwa_project_id as string;
      let set = map.get(pid);
      if (!set) {
        set = new Set();
        map.set(pid, set);
      }
      for (const k of (row.item_keys as string[]) ?? []) {
        if (k) set.add(k);
      }
    }
  }
  return map;
}

export async function fetchWaiversForProject(
  projectId: string
): Promise<ExpenseControlWaiver[]> {
  const { data, error } = await supabase
    .from("expense_control_waivers")
    .select(
      `id, bwa_project_id, item_keys, reason, status, applicant_id, reviewer_id, reviewer_note, reviewed_at, created_at, updated_at,
       applicant:staff!expense_control_waivers_applicant_id_fkey(id, name),
       reviewer:staff!expense_control_waivers_reviewer_id_fkey(id, name)`
    )
    .eq("bwa_project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fetchWaiversForProject]", error);
    return [];
  }

  type StaffEmbed = { id: string; name: string | null } | null;
  return (data ?? []).map((row) => {
    const r = row as typeof row & {
      applicant?: StaffEmbed | StaffEmbed[];
      reviewer?: StaffEmbed | StaffEmbed[];
    };
    const applicant = Array.isArray(r.applicant) ? r.applicant[0] : r.applicant;
    const reviewer = Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer;
    return {
      id: r.id,
      bwa_project_id: r.bwa_project_id,
      item_keys: (r.item_keys as string[]) ?? [],
      reason: r.reason,
      status: r.status as WaiverStatus,
      applicant_id: r.applicant_id,
      reviewer_id: r.reviewer_id,
      reviewer_note: r.reviewer_note,
      reviewed_at: r.reviewed_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      applicant_name: applicant?.name ?? null,
      reviewer_name: reviewer?.name ?? null,
    } satisfies ExpenseControlWaiver;
  });
}

/** Latest status per item key for UI badges. */
export function waiverStatusByItemKey(
  waivers: ExpenseControlWaiver[]
): Map<string, WaiverStatus> {
  const map = new Map<string, WaiverStatus>();
  // Prefer approved > pending > rejected/revoked; process oldest→newest so newer wins
  const ordered = [...waivers].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const w of ordered) {
    for (const k of w.item_keys) {
      const prev = map.get(k);
      if (prev === "approved" && w.status !== "approved" && w.status !== "revoked") {
        continue;
      }
      map.set(k, w.status);
    }
  }
  return map;
}
