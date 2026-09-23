import { supabase, logError, safeQuery } from "@/lib/data/_core";

/** All dashboard sentence texts (prefer BWA pool when available). */
export async function fetchDashboardSentences(): Promise<string[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("dashboard_sentences")
      .select("text, is_bwa");

    if (error) {
      logError("fetchDashboardSentences", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Prefer BWA sentences, but fall back to any sentence
    const bwaSentences = data.filter((s: { is_bwa?: boolean }) => s.is_bwa === true);
    const pool = bwaSentences.length > 0 ? bwaSentences : data;

    return pool
      .map((s: { text?: string | null }) => (typeof s.text === "string" ? s.text.trim() : ""))
      .filter((t: string) => t.length > 0);
  }, [], "fetchDashboardSentences");
}
