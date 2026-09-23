/** BWA 項目規模 labels stored on `bwa_projects.project_size`. */
export const BWA_PROJECT_SIZE_LABELS = [
  "小於$30K",
  "$30-100K微型",
  "$100-250K小型",
  "$250-500K中小型",
  "$500K-$1M中型",
  "$1M-$3M中大型",
  "$3M-$5M主要型",
  "$5M以上重點項目",
] as const;

export type BwaProjectSizeLabel = (typeof BWA_PROJECT_SIZE_LABELS)[number];

/** Dropdown / filter options — value equals the DB label string. */
export const BWA_PROJECT_SIZE_OPTIONS: { value: BwaProjectSizeLabel; label: string }[] =
  BWA_PROJECT_SIZE_LABELS.map((label) => ({ value: label, label }));

/** Filter bar options including "all". */
export const BWA_PROJECT_SIZE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "所有項目規模" },
  ...BWA_PROJECT_SIZE_OPTIONS,
];

/**
 * Map estimated / signed income (HKD) to a BWA 項目規模 label.
 * Boundaries are half-open: lower inclusive, upper exclusive (except top band).
 */
export function getBwaProjectSize(
  income: number | null | undefined,
): BwaProjectSizeLabel | null {
  if (income == null || !Number.isFinite(income)) return null;
  if (income < 30_000) return "小於$30K";
  if (income < 100_000) return "$30-100K微型";
  if (income < 250_000) return "$100-250K小型";
  if (income < 500_000) return "$250-500K中小型";
  if (income < 1_000_000) return "$500K-$1M中型";
  if (income < 3_000_000) return "$1M-$3M中大型";
  if (income < 5_000_000) return "$3M-$5M主要型";
  return "$5M以上重點項目";
}

/** True when income falls in the band identified by filter value (label or "all"). */
export function matchesBwaProjectSize(
  income: number | null | undefined,
  filterValue: string,
): boolean {
  if (!filterValue || filterValue === "all") return true;
  const amount = income == null || !Number.isFinite(income) ? 0 : income;
  return getBwaProjectSize(amount) === filterValue;
}

/** Prefer stored `project_size`; fall back to income-derived band. */
export function resolveBwaProjectSize(
  projectSize: string | null | undefined,
  estimatedIncome?: number | null,
): BwaProjectSizeLabel | null {
  if (projectSize && (BWA_PROJECT_SIZE_LABELS as readonly string[]).includes(projectSize)) {
    return projectSize as BwaProjectSizeLabel;
  }
  return getBwaProjectSize(estimatedIncome);
}

/** True when `size` is `minimum` or any larger band (by BWA_PROJECT_SIZE_LABELS order). */
export function isBwaProjectSizeAtLeast(
  size: string | null | undefined,
  minimum: BwaProjectSizeLabel,
): boolean {
  if (!size) return false;
  const idx = (BWA_PROJECT_SIZE_LABELS as readonly string[]).indexOf(size);
  const minIdx = BWA_PROJECT_SIZE_LABELS.indexOf(minimum);
  if (idx < 0 || minIdx < 0) return false;
  return idx >= minIdx;
}

/** Former B2C / Mini bands — income conceptually &lt; $250k. */
export const BWA_MINI_PROJECT_SIZE_LABELS: readonly BwaProjectSizeLabel[] = [
  "小於$30K",
  "$30-100K微型",
  "$100-250K小型",
];

/**
 * True when size is a Mini band (ex-B2C). Null / unknown → false (ex-B2B default).
 * Accepts a stored label or resolves from income when the second arg is provided.
 */
export function isBwaMiniProjectSize(
  size: string | null | undefined,
  estimatedIncome?: number | null,
): boolean {
  const resolved = resolveBwaProjectSize(size, estimatedIncome);
  if (!resolved) return false;
  return (BWA_MINI_PROJECT_SIZE_LABELS as readonly string[]).includes(resolved);
}
