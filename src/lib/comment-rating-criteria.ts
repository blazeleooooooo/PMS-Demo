/** Shared star meanings and role-based rating criteria for comments. */

export const STAR_LABELS: Record<number, string> = {
  1: "不好",
  2: "不理想",
  3: "一般",
  4: "良好",
  5: "非常好",
};

export function starLabel(point: number | null | undefined): string | null {
  if (point == null) return null;
  const n = Math.min(Math.max(Math.round(point), 1), 5);
  return STAR_LABELS[n] ?? null;
}

export type InternalRatingRole = "designer" | "pm" | "overall";

export type RatingCriterionKey =
  | "rating_design_creativity"
  | "rating_drawing_accuracy"
  | "rating_professional_briefing"
  | "rating_client_relation"
  | "rating_document_logic"
  | "rating_supplier_relation"
  | "rating_time_management"
  | "rating_professional_skill"
  | "rating_service_attitude";

export interface RatingCriterionDef {
  key: RatingCriterionKey;
  label: string;
}

export const DESIGNER_CRITERIA: RatingCriterionDef[] = [
  { key: "rating_design_creativity", label: "設計創意" },
  { key: "rating_drawing_accuracy", label: "圖紙精準" },
  { key: "rating_professional_briefing", label: "專業說明" },
  { key: "rating_client_relation", label: "客戶關係" },
];

export const PM_CRITERIA: RatingCriterionDef[] = [
  { key: "rating_professional_briefing", label: "專業說明" },
  { key: "rating_document_logic", label: "文件邏輯" },
  { key: "rating_supplier_relation", label: "供應相關係" },
  { key: "rating_client_relation", label: "客戶關係" },
];

export const SUPPLIER_CRITERIA: RatingCriterionDef[] = [
  { key: "rating_time_management", label: "時間管理" },
  { key: "rating_professional_skill", label: "專業技能" },
  { key: "rating_service_attitude", label: "服務態度" },
];

export const ALL_INTERNAL_CRITERION_KEYS: RatingCriterionKey[] = [
  "rating_design_creativity",
  "rating_drawing_accuracy",
  "rating_professional_briefing",
  "rating_client_relation",
  "rating_document_logic",
  "rating_supplier_relation",
];

export const ALL_SUPPLIER_CRITERION_KEYS: RatingCriterionKey[] = [
  "rating_time_management",
  "rating_professional_skill",
  "rating_service_attitude",
];

export const CRITERION_LABEL_BY_KEY: Record<RatingCriterionKey, string> = {
  rating_design_creativity: "設計創意",
  rating_drawing_accuracy: "圖紙精準",
  rating_professional_briefing: "專業說明",
  rating_client_relation: "客戶關係",
  rating_document_logic: "文件邏輯",
  rating_supplier_relation: "供應相關係",
  rating_time_management: "時間管理",
  rating_professional_skill: "專業技能",
  rating_service_attitude: "服務態度",
};

/** Map staff.position → which internal rating form to show. */
export function resolveInternalRatingRole(
  position: string | null | undefined
): InternalRatingRole {
  const p = (position || "").trim().toLowerCase();
  if (!p) return "overall";
  if (p.includes("designer")) return "designer";
  if (p === "pm" || p.includes("項目經理") || p.includes("project manager")) {
    return "pm";
  }
  return "overall";
}

export function criteriaForInternalRole(
  role: InternalRatingRole
): RatingCriterionDef[] {
  if (role === "designer") return DESIGNER_CRITERIA;
  if (role === "pm") return PM_CRITERIA;
  return [];
}

export type CriteriaValues = Partial<Record<RatingCriterionKey, number | null>>;

/** Empty criteria bag for form state. */
export function emptyCriteriaValues(
  keys: RatingCriterionKey[]
): CriteriaValues {
  const out: CriteriaValues = {};
  for (const k of keys) out[k] = null;
  return out;
}

/** Pick only the keys belonging to a role; clear others for DB write. */
export function buildInternalRatingsPayload(
  role: InternalRatingRole,
  values: CriteriaValues
): Record<RatingCriterionKey, number | null> {
  const allowed = new Set(criteriaForInternalRole(role).map((c) => c.key));
  const payload = {} as Record<RatingCriterionKey, number | null>;
  for (const key of ALL_INTERNAL_CRITERION_KEYS) {
    payload[key] = allowed.has(key) ? values[key] ?? null : null;
  }
  return payload;
}

export function buildSupplierRatingsPayload(
  values: CriteriaValues
): Record<RatingCriterionKey, number | null> {
  const payload = {} as Record<RatingCriterionKey, number | null>;
  for (const key of ALL_SUPPLIER_CRITERION_KEYS) {
    payload[key] = values[key] ?? null;
  }
  return payload;
}

export function extractCriteriaFromRow(
  row: Record<string, unknown>,
  keys: RatingCriterionKey[]
): CriteriaValues {
  const out: CriteriaValues = {};
  for (const key of keys) {
    const v = row[key];
    out[key] =
      v == null || v === ""
        ? null
        : typeof v === "number"
          ? v
          : Number(v);
    if (out[key] != null && Number.isNaN(out[key] as number)) out[key] = null;
  }
  return out;
}

/** Criteria that have a value, for display. */
export function filledCriteriaEntries(
  values: CriteriaValues,
  preferredOrder?: RatingCriterionDef[]
): { key: RatingCriterionKey; label: string; point: number }[] {
  const order =
    preferredOrder ??
    Object.keys(values).map((key) => ({
      key: key as RatingCriterionKey,
      label: CRITERION_LABEL_BY_KEY[key as RatingCriterionKey] || key,
    }));

  const seen = new Set<string>();
  const result: { key: RatingCriterionKey; label: string; point: number }[] =
    [];

  for (const def of order) {
    const point = values[def.key];
    if (point == null) continue;
    seen.add(def.key);
    result.push({ key: def.key, label: def.label, point });
  }

  // Any extra filled keys not in preferred order
  for (const key of Object.keys(values) as RatingCriterionKey[]) {
    if (seen.has(key)) continue;
    const point = values[key];
    if (point == null) continue;
    result.push({
      key,
      label: CRITERION_LABEL_BY_KEY[key] || key,
      point,
    });
  }

  return result;
}
