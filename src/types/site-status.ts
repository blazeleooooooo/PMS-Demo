/**
 * Site Status (工地狀況) — Dynamic Questionnaire Types
 *
 * The questionnaire is fully data-driven (no hardcoded questions/options):
 *   site_status_sections → site_status_questions → site_status_question_options
 *   site_status_question_project_types  (M2M; no rows = applies to all quote-project-types)
 *   site_status_answers  (one jsonb `value` per site_status × question — any answer shape)
 *
 * `site_statuses` remains the parent row (project/pitching link). The legacy typed columns
 * were retired (snapshot in site_statuses_legacy_backup).
 */

// ── Answer types ──────────────────────────────────────────────
// Extensible: adding a type = widen the DB CHECK + add a renderer branch.
export type AnswerType =
  | "text"
  | "textarea"
  | "single_select"
  | "multi_select"
  | "number"
  | "quantity_list"
  | "select_with_area"
  | "date"
  | "yes_no";

// Per-answer value shapes (stored as jsonb in site_status_answers.value):
//   text / textarea / date        → string
//   number                        → number
//   yes_no                        → boolean
//   single_select                 → string (option id)
//   multi_select                  → string[] (option ids)
//   quantity_list                 → QuantityEntry[]
//   select_with_area              → AreaEntry[]
export interface QuantityEntry {
  option_id: string;
  qty: number;
}
export interface AreaEntry {
  option_id: string;
  area: string | null;
}
export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | QuantityEntry[]
  | AreaEntry[]
  | null;

// Per-question config (jsonb). All optional.
export interface QuestionConfig {
  placeholder?: string;
  min?: number;
  max?: number;
  unit?: string;
  /** For select_with_area: the secondary dropdown options (e.g. 全場/大部分/少量). */
  areaOptions?: string[];
}

// ── Table rows ────────────────────────────────────────────────
export interface SiteStatusSection {
  id: string;
  title_zh: string;
  title_en: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface SiteStatusOption {
  id: string;
  question_id: string;
  label_zh: string;
  label_en: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface SiteStatusQuestion {
  id: string;
  section_id: string | null;
  label_zh: string;
  label_en: string | null;
  answer_type: AnswerType;
  config: QuestionConfig;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  /** Hydrated by the service (not a DB column). */
  options?: SiteStatusOption[];
  /** Hydrated: quote-project-type ids this question applies to; [] = all types. */
  projectTypeIds?: string[];
}

export interface SiteStatusAnswer {
  id: string;
  site_status_id: string;
  question_id: string;
  value: AnswerValue;
}

// Parent row (project/pitching link). Legacy typed columns are gone.
export interface SiteStatus {
  id: string;
  bubble_id: string | null;
  slug: string | null;
  project: string | null;
  pitching: string | null;
  project_id: string | null;
  pitching_id: string | null;
  created_by: string | null;
  created_by_id: string | null;
  created_date: string | null;
  modified_date: string | null;
}

// A section with its questions, ready to render.
export interface QuestionnaireSection extends SiteStatusSection {
  questions: SiteStatusQuestion[];
}
