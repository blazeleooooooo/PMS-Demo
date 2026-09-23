import { isBwaMiniProjectSize } from "@/lib/bwa-project-size";

/** BWF `source_types` id for BWA-PP — excluded from ❌ PP columns. */
export const BWF_PP_SOURCE_ID = "7311a299-c9d7-40d0-b415-20ce3a3b7826";

/** BWF-only column labels (BWA reports no longer show Mini/PP splits). */
export const PP_LABEL = "PP";
export const EXCLUDE_PP_LABEL = "❌ PP";

/** @deprecated Use PP_LABEL — kept for call-site migration. */
export const EXCLUDE_MINI_PP_LABEL = EXCLUDE_PP_LABEL;

export type ReportSide = "BWA" | "BWF";

/** PP section label (BWF only). */
export function ppLabel(): string {
  return PP_LABEL;
}

/** ❌ PP section label (BWF only). */
export function excludePPLabel(): string {
  return EXCLUDE_PP_LABEL;
}

/** @deprecated Prefer ppLabel() — BWA/BWF dual mode is no longer used. */
export function miniPPLabel(_bwa?: boolean, _bwf?: boolean): string {
  return PP_LABEL;
}

/** @deprecated Prefer excludePPLabel() — BWA/BWF dual mode is no longer used. */
export function excludeMiniPPLabel(_bwa?: boolean, _bwf?: boolean): string {
  return EXCLUDE_PP_LABEL;
}

/**
 * Counts in the ❌ PP columns (BWF only in UI).
 * BWA: 項目規模 is not Mini (&lt; $250k bands) — kept for data helpers; UI hides these cols for BWA.
 * BWF: n_source_id is not BWA-PP.
 */
export function countsExcludeMiniPP(params: {
  source: ReportSide;
  /** BWA: os_money_size (pitching) or project_size (project). */
  project_size?: string | null;
  estimated_income?: number | null;
  n_source_id?: string | null;
}): boolean {
  if (params.source === "BWF") {
    return params.n_source_id !== BWF_PP_SOURCE_ID;
  }
  return !isBwaMiniProjectSize(params.project_size, params.estimated_income);
}

/** Counts in PP columns (BWF BWA-PP; BWA mini size — UI only shows for BWF). */
export function isMiniOrPP(params: {
  source: ReportSide;
  project_size?: string | null;
  estimated_income?: number | null;
  n_source_id?: string | null;
}): boolean {
  return !countsExcludeMiniPP(params);
}
