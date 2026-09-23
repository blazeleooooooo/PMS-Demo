import { supabase } from "@/lib/supabase";
import type {
  SiteStatus,
  SiteStatusSection,
  SiteStatusQuestion,
  SiteStatusOption,
  QuestionnaireSection,
  AnswerType,
  AnswerValue,
  QuestionConfig,
} from "@/types/site-status";

// ============================================================
// Site Status Data Service — dynamic questionnaire model.
//   site_status_sections → site_status_questions → site_status_question_options
//   site_status_question_project_types (M2M; no rows = all types)
//   site_status_answers (one jsonb value per site_status × question)
// ============================================================

function logError(context: string, error: any) {
  console.error(`[site-status-service] ${context}:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

async function safeQuery<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err?.message?.includes("Failed to fetch") || err?.name === "TypeError") {
      console.warn(`[site-status-service] ${context}: Supabase unreachable, using fallback.`);
    } else {
      logError(context, err);
    }
    return fallback;
  }
}

// Push helper: append to a Map<key, T[]> bucket, creating it on first use.
function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}

// ─── PARENT ROW (site_statuses) ───────────────────────────────

export async function fetchSiteStatus(projectId: string): Promise<SiteStatus | null> {
  return safeQuery(
    async () => {
      const { data, error } = await supabase
        .from("site_statuses")
        .select("*")
        .or(`project_id.eq.${projectId},project.eq.${projectId}`)
        .maybeSingle();
      if (error) {
        logError("fetchSiteStatus", error);
        return null;
      }
      return (data as SiteStatus) ?? null;
    },
    null,
    "fetchSiteStatus"
  );
}

export async function fetchSiteStatusByPitching(pitchingId: string): Promise<SiteStatus | null> {
  return safeQuery(
    async () => {
      const { data, error } = await supabase
        .from("site_statuses")
        .select("*")
        .or(`pitching_id.eq.${pitchingId},pitching.eq.${pitchingId}`)
        .maybeSingle();
      if (error) {
        logError("fetchSiteStatusByPitching", error);
        return null;
      }
      return (data as SiteStatus) ?? null;
    },
    null,
    "fetchSiteStatusByPitching"
  );
}

/** Get-or-create the parent site_statuses row for a project / pitching. */
export async function upsertSiteStatus(
  entityId: string,
  entityType: "project" | "pitching" = "project"
): Promise<SiteStatus | null> {
  return safeQuery(
    async () => {
      const existing =
        entityType === "pitching"
          ? await fetchSiteStatusByPitching(entityId)
          : await fetchSiteStatus(entityId);
      if (existing) return existing;

      const row =
        entityType === "pitching"
          ? { pitching: entityId, pitching_id: entityId }
          : { project: entityId, project_id: entityId };
      const { data, error } = await supabase
        .from("site_statuses")
        .insert({
          ...row,
          created_date: new Date().toISOString(),
          modified_date: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) {
        logError("upsertSiteStatus", error);
        return null;
      }
      return data as SiteStatus;
    },
    null,
    "upsertSiteStatus"
  );
}

/** Read the quote-project-type id stored on a project / pitching (null if unset). */
export async function fetchEntityQuoteProjectTypeId(
  entityId: string,
  entityType: "project" | "pitching" = "project"
): Promise<string | null> {
  return safeQuery(
    async () => {
      const table = entityType === "pitching" ? "bwa_pitchings" : "bwa_projects";
      const { data, error } = await supabase
        .from(table)
        .select("quote_project_type_id")
        .eq("id", entityId)
        .maybeSingle();
      if (error) {
        logError("fetchEntityQuoteProjectTypeId", error);
        return null;
      }
      return (data?.quote_project_type_id as string) ?? null;
    },
    null,
    "fetchEntityQuoteProjectTypeId"
  );
}

// ─── QUESTIONNAIRE (sections + questions + options) ───────────

/**
 * Fetch the active questionnaire for a given quote-project-type. Questions with NO
 * project-type mapping rows are global (shown for every type). When
 * `quoteProjectTypeId` is null, only global questions are returned.
 */
export async function fetchQuestionnaire(
  quoteProjectTypeId: string | null
): Promise<QuestionnaireSection[]> {
  return safeQuery(
    async () => {
      const [secRes, qRes, optRes, mapRes] = await Promise.all([
        supabase.from("site_status_sections").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("site_status_questions").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("site_status_question_options").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("site_status_question_project_types").select("question_id, quote_project_type_id"),
      ]);
      if (secRes.error) logError("fetchQuestionnaire/sections", secRes.error);
      if (qRes.error) logError("fetchQuestionnaire/questions", qRes.error);
      if (optRes.error) logError("fetchQuestionnaire/options", optRes.error);
      if (mapRes.error) logError("fetchQuestionnaire/map", mapRes.error);

      const sections = (secRes.data ?? []) as SiteStatusSection[];

      const optionsByQ = new Map<string, SiteStatusOption[]>();
      for (const o of (optRes.data ?? []) as SiteStatusOption[]) pushTo(optionsByQ, o.question_id, o);

      const typesByQ = new Map<string, string[]>();
      for (const m of (mapRes.data ?? []) as { question_id: string; quote_project_type_id: string }[]) {
        pushTo(typesByQ, m.question_id, m.quote_project_type_id);
      }

      const questions = ((qRes.data ?? []) as any[])
        .map((q): SiteStatusQuestion => ({
          ...q,
          config: (q.config ?? {}) as QuestionConfig,
          options: optionsByQ.get(q.id) ?? [],
          projectTypeIds: typesByQ.get(q.id) ?? [],
        }))
        // Branch filter: global (no mapping) ∪ mapped to this type.
        .filter(
          (q) =>
            (q.projectTypeIds?.length ?? 0) === 0 ||
            (quoteProjectTypeId != null && q.projectTypeIds!.includes(quoteProjectTypeId))
        );

      const bySection = new Map<string, SiteStatusQuestion[]>();
      for (const q of questions) {
        if (q.section_id) pushTo(bySection, q.section_id, q);
      }

      return sections
        .map((s): QuestionnaireSection => ({ ...s, questions: bySection.get(s.id) ?? [] }))
        .filter((s) => s.questions.length > 0);
    },
    [],
    "fetchQuestionnaire"
  );
}

// ─── ANSWERS ──────────────────────────────────────────────────

/** Returns a map questionId → value for one site_status row. */
export async function fetchAnswers(siteStatusId: string): Promise<Record<string, AnswerValue>> {
  return safeQuery(
    async () => {
      const { data, error } = await supabase
        .from("site_status_answers")
        .select("question_id, value")
        .eq("site_status_id", siteStatusId);
      if (error) {
        logError("fetchAnswers", error);
        return {};
      }
      const out: Record<string, AnswerValue> = {};
      for (const r of (data ?? []) as { question_id: string; value: AnswerValue }[]) {
        out[r.question_id] = r.value;
      }
      return out;
    },
    {},
    "fetchAnswers"
  );
}

/** True when a value is "empty" for storage (so we delete rather than store it). */
function isEmptyValue(v: AnswerValue): boolean {
  if (v == null || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

/**
 * Upsert the given answers for a site_status, deleting answers whose value became empty.
 * `answers` is the full current map (questionId → value).
 */
export async function saveAnswers(
  siteStatusId: string,
  answers: Record<string, AnswerValue>
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(
    async () => {
      const now = new Date().toISOString();
      const toUpsert: any[] = [];
      const toDeleteQids: string[] = [];
      for (const [questionId, value] of Object.entries(answers)) {
        if (isEmptyValue(value)) toDeleteQids.push(questionId);
        else toUpsert.push({ site_status_id: siteStatusId, question_id: questionId, value, modified_date: now });
      }

      if (toUpsert.length) {
        const { error } = await supabase
          .from("site_status_answers")
          .upsert(toUpsert, { onConflict: "site_status_id,question_id" });
        if (error) {
          logError("saveAnswers/upsert", error);
          return { success: false, error: error.message };
        }
      }
      if (toDeleteQids.length) {
        const { error } = await supabase
          .from("site_status_answers")
          .delete()
          .eq("site_status_id", siteStatusId)
          .in("question_id", toDeleteQids);
        if (error) {
          logError("saveAnswers/delete", error);
          return { success: false, error: error.message };
        }
      }
      await supabase.from("site_statuses").update({ modified_date: now }).eq("id", siteStatusId);
      return { success: true };
    },
    { success: false, error: "unreachable" },
    "saveAnswers"
  );
}

// ============================================================
// ADMIN — question-builder CRUD (used by the settings screen)
// ============================================================

/** Full questionnaire (all sections/questions/options, incl. inactive) for the builder. */
export async function fetchQuestionnaireAdmin(): Promise<{
  sections: SiteStatusSection[];
  questions: SiteStatusQuestion[];
}> {
  return safeQuery(
    async () => {
      const [secRes, qRes, optRes, mapRes] = await Promise.all([
        supabase.from("site_status_sections").select("*").order("sort_order"),
        supabase.from("site_status_questions").select("*").order("sort_order"),
        supabase.from("site_status_question_options").select("*").order("sort_order"),
        supabase.from("site_status_question_project_types").select("question_id, quote_project_type_id"),
      ]);
      const optionsByQ = new Map<string, SiteStatusOption[]>();
      for (const o of (optRes.data ?? []) as SiteStatusOption[]) pushTo(optionsByQ, o.question_id, o);
      const typesByQ = new Map<string, string[]>();
      for (const m of (mapRes.data ?? []) as { question_id: string; quote_project_type_id: string }[]) {
        pushTo(typesByQ, m.question_id, m.quote_project_type_id);
      }
      const questions = ((qRes.data ?? []) as any[]).map((q): SiteStatusQuestion => ({
        ...q,
        config: (q.config ?? {}) as QuestionConfig,
        options: optionsByQ.get(q.id) ?? [],
        projectTypeIds: typesByQ.get(q.id) ?? [],
      }));
      return { sections: (secRes.data ?? []) as SiteStatusSection[], questions };
    },
    { sections: [], questions: [] },
    "fetchQuestionnaireAdmin"
  );
}

// ── Sections ──
export async function createSection(input: Partial<SiteStatusSection>) {
  return supabase
    .from("site_status_sections")
    .insert({ ...input, created_date: new Date().toISOString(), modified_date: new Date().toISOString() })
    .select()
    .single();
}
export async function updateSection(id: string, patch: Partial<SiteStatusSection>) {
  return supabase
    .from("site_status_sections")
    .update({ ...patch, modified_date: new Date().toISOString() })
    .eq("id", id);
}
export async function deleteSection(id: string) {
  return supabase.from("site_status_sections").delete().eq("id", id);
}

// ── Questions ──
export async function createQuestion(input: {
  section_id: string | null;
  label_zh: string;
  label_en?: string | null;
  answer_type: AnswerType;
  config?: QuestionConfig;
  sort_order?: number;
  is_required?: boolean;
}) {
  return supabase
    .from("site_status_questions")
    .insert({
      ...input,
      config: input.config ?? {},
      created_date: new Date().toISOString(),
      modified_date: new Date().toISOString(),
    })
    .select()
    .single();
}
export async function updateQuestion(id: string, patch: Partial<SiteStatusQuestion>) {
  // Strip hydrated, non-column fields.
  const { options, projectTypeIds, id: _ignored, ...cols } = patch as any;
  return supabase
    .from("site_status_questions")
    .update({ ...cols, modified_date: new Date().toISOString() })
    .eq("id", id);
}
export async function deleteQuestion(id: string) {
  return supabase.from("site_status_questions").delete().eq("id", id);
}

// ── Options ──
export async function createOption(input: {
  question_id: string;
  label_zh: string;
  label_en?: string | null;
  sort_order?: number;
}) {
  return supabase
    .from("site_status_question_options")
    .insert({ ...input, created_date: new Date().toISOString(), modified_date: new Date().toISOString() })
    .select()
    .single();
}
export async function updateOption(id: string, patch: Partial<SiteStatusOption>) {
  return supabase
    .from("site_status_question_options")
    .update({ ...patch, modified_date: new Date().toISOString() })
    .eq("id", id);
}
export async function deleteOption(id: string) {
  return supabase.from("site_status_question_options").delete().eq("id", id);
}

// ── Question ↔ project-type mapping ──
/** Replace the full set of quote-project-type ids for a question (empty = applies to all). */
export async function setQuestionProjectTypes(
  questionId: string,
  typeIds: string[]
): Promise<{ success: boolean; error?: string }> {
  return safeQuery(
    async () => {
      const { error: delErr } = await supabase
        .from("site_status_question_project_types")
        .delete()
        .eq("question_id", questionId);
      if (delErr) {
        logError("setQuestionProjectTypes/delete", delErr);
        return { success: false, error: delErr.message };
      }
      if (typeIds.length) {
        const rows = typeIds.map((t) => ({ question_id: questionId, quote_project_type_id: t }));
        const { error } = await supabase.from("site_status_question_project_types").insert(rows);
        if (error) {
          logError("setQuestionProjectTypes/insert", error);
          return { success: false, error: error.message };
        }
      }
      return { success: true };
    },
    { success: false, error: "unreachable" },
    "setQuestionProjectTypes"
  );
}

// ── Quote project types (for the branch picker) ──
export async function fetchQuoteProjectTypes(): Promise<{ id: string; name: string }[]> {
  return safeQuery(
    async () => {
      const { data, error } = await supabase.from("nos_quote_project_types").select("id, name").order("name");
      if (error) {
        logError("fetchQuoteProjectTypes", error);
        return [];
      }
      return (data ?? []) as { id: string; name: string }[];
    },
    [],
    "fetchQuoteProjectTypes"
  );
}
