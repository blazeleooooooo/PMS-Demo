import { supabase, logError, safeQuery } from "@/lib/data/_core";

// ─── SEARCHABLE LINK LISTS (for Account Edit dialog) ─────────

export interface LinkOption {
  id: string;
  label: string;
  sublabel?: string;
  searchText?: string; // extra searchable text (phone, email, etc.)
  status?: string; // e.g. "Active" | "Inactive" for styling purposes
}

export async function fetchStaffOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("staff")
      .select("id, name, full_name, email, position, status")
      .order("name");
    if (error) logError("fetchStaffOptions", error);
    // Sort: Active first, then Inactive; within each group sort by name
    const sorted = (data ?? []).sort((a: any, b: any) => {
      const aActive = a.status === "Active" ? 0 : 1;
      const bActive = b.status === "Active" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      const aName = (a.name || a.full_name || "").toLowerCase();
      const bName = (b.name || b.full_name || "").toLowerCase();
      return aName.localeCompare(bName);
    });
    return sorted.map((s: any) => ({
      id: s.id,
      label: s.name || s.full_name,
      sublabel: [s.position, s.email].filter(Boolean).join(" · "),
      status: s.status || "Active",
    }));
  }, [], "fetchStaffOptions");
}

/** Staff options filtered to position = Designer only */
export async function fetchDesignerStaffOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("staff")
      .select("id, name, full_name, email, position, status")
      .eq("position", "Designer")
      .order("name");
    if (error) logError("fetchDesignerStaffOptions", error);
    const sorted = (data ?? []).sort((a: any, b: any) => {
      const aActive = a.status === "Active" ? 0 : 1;
      const bActive = b.status === "Active" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      const aName = (a.name || a.full_name || "").toLowerCase();
      const bName = (b.name || b.full_name || "").toLowerCase();
      return aName.localeCompare(bName);
    });
    return sorted.map((s: any) => ({
      id: s.id,
      label: s.name || s.full_name,
      sublabel: [s.position, s.email].filter(Boolean).join(" · "),
      status: s.status || "Active",
    }));
  }, [], "fetchDesignerStaffOptions");
}

/** Staff options filtered to position != Designer (for PM dropdown) */
export async function fetchPMStaffOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("staff")
      .select("id, name, full_name, email, position, status")
      .neq("position", "Designer")
      .order("name");
    if (error) logError("fetchPMStaffOptions", error);
    const sorted = (data ?? []).sort((a: any, b: any) => {
      const aActive = a.status === "Active" ? 0 : 1;
      const bActive = b.status === "Active" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      const aName = (a.name || a.full_name || "").toLowerCase();
      const bName = (b.name || b.full_name || "").toLowerCase();
      return aName.localeCompare(bName);
    });
    return sorted.map((s: any) => ({
      id: s.id,
      label: s.name || s.full_name,
      sublabel: [s.position, s.email].filter(Boolean).join(" · "),
      status: s.status || "Active",
    }));
  }, [], "fetchPMStaffOptions");
}

// ─── DISTRICT OPTIONS (for Building forms) ─────────────

export async function fetchDistrictOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("districts")
      .select("id, name")
      .order("name");
    if (error) logError("fetchDistrictOptions", error);
    return (data ?? []).map((d: any) => ({
      id: d.id,
      label: d.name || "未命名",
    }));
  }, [], "fetchDistrictOptions");
}

// BWF service-type option carrying the is_fast_build flag (drives which
// service-item groups show in the BWF pitching dialog).
export interface BWFServiceTypeOption extends LinkOption {
  isFastBuild: boolean;
}

export async function fetchBWFServiceTypeOptions(): Promise<BWFServiceTypeOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("nos_service_type_2")
      .select("id, display, code, is_fast_build")
      .order("display");
    if (error) logError("fetchBWFServiceTypeOptions", error);
    return (data ?? []).map((s: any) => ({
      id: s.id,
      label: s.display || s.code || s.id,
      isFastBuild: s.is_fast_build === true,
    }));
  }, [], "fetchBWFServiceTypeOptions");
}

// ─── BWF pitching lookup options (pill selectors) ──────────────
export async function fetchSourceTypeOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase.from("source_types").select("id, display").order("display");
    if (error) logError("fetchSourceTypeOptions", error);
    return (data ?? []).map((s: any) => ({ id: s.id, label: s.display || s.id }));
  }, [], "fetchSourceTypeOptions");
}

export async function fetchClientTypeOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase.from("client_types").select("id, display, code").order("display");
    if (error) logError("fetchClientTypeOptions", error);
    return (data ?? []).map((s: any) => ({ id: s.id, label: s.display || s.code || s.id }));
  }, [], "fetchClientTypeOptions");
}

export async function fetchBWFMajorQuoteOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase.from("bwf_major_quotes").select("id, display").order("display");
    if (error) logError("fetchBWFMajorQuoteOptions", error);
    return (data ?? []).map((s: any) => ({ id: s.id, label: s.display || s.id }));
  }, [], "fetchBWFMajorQuoteOptions");
}

// Service-item option carrying its category flags so the BWF dialog can
// group/filter items by the selected service types.
export interface ServiceItemOption extends LinkOption {
  isFastBuild: boolean;
  isFurniture: boolean;
  isMaterial: boolean;
  isBranding: boolean;
}

export async function fetchServiceItemOptions(): Promise<ServiceItemOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("service_items")
      .select("id, display, is_fast_build, is_furniture, is_material, is_branding")
      .order("display");
    if (error) logError("fetchServiceItemOptions", error);
    return (data ?? []).map((s: any) => ({
      id: s.id,
      label: s.display || s.id,
      isFastBuild: s.is_fast_build === true,
      isFurniture: s.is_furniture === true,
      isMaterial: s.is_material === true,
      isBranding: s.is_branding === true,
    }));
  }, [], "fetchServiceItemOptions");
}

// ─── BWA PITCHING LOOKUP OPTIONS ────────────────────────

export async function fetchFinancialYearOptions(): Promise<(LinkOption & { yy_code: string | null; date_range: string | null })[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("financial_years")
      .select("id, display, yy_code, date_range")
      .order("display", { ascending: false });
    if (error) logError("fetchFinancialYearOptions", error);
    return (data ?? []).map((d: any) => ({
      id: d.id,
      label: d.display || "未命名",
      yy_code: d.yy_code || null,
      date_range: d.date_range || null,
    }));
  }, [], "fetchFinancialYearOptions");
}

/** Whether a team_types row is a BWF team (`is_bwf`). Null if missing. */
export async function fetchTeamTypeIsBwf(teamId: string): Promise<boolean | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("team_types")
      .select("is_bwf")
      .eq("id", teamId)
      .maybeSingle();
    if (error) logError("fetchTeamTypeIsBwf", error);
    if (!data) return null;
    return data.is_bwf === true;
  }, null, "fetchTeamTypeIsBwf");
}

export async function fetchTeamTypeOptions(
  includeInactive: boolean = false
): Promise<LinkOption[]> {
  return safeQuery(async () => {
    let query = supabase
      .from("team_types")
      .select("id, display, is_active")
      .order("display");
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query;
    if (error) logError("fetchTeamTypeOptions", error);
    const rows = data ?? [];
    // Active first, then Inactive; A→Z by display within each group.
    const sorted = includeInactive
      ? [...rows].sort((a: any, b: any) => {
          const aActive = a.is_active !== false ? 0 : 1;
          const bActive = b.is_active !== false ? 0 : 1;
          if (aActive !== bActive) return aActive - bActive;
          return (a.display || "").localeCompare(b.display || "", "zh-Hant");
        })
      : rows;
    return sorted.map((d: any) => ({
      id: d.id,
      label: d.display || "未命名",
      status: d.is_active !== false ? "Active" : "Inactive",
    }));
  }, [], "fetchTeamTypeOptions");
}

/**
 * Find the financial year whose date range contains the current date.
 * The `date_range` column stores a JSON string from Bubble, e.g.:
 *   '{"start":"2024-04-01T00:00:00.000Z","end":"2025-03-31T23:59:59.999Z"}'
 *   or '{"start":1680307200000,"end":1711843200000}' (unix ms)
 *
 * Fallback strategy:
 *   1. Try to find FY whose date_range contains today
 *   2. If no match (null/unparseable date_range), pick the latest FY by `display` desc
 *
 * Returns { id, display } or null if none found.
 */
export async function fetchCurrentFinancialYear(): Promise<{ id: string; display: string } | null> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("financial_years")
      .select("id, display, date_range")
      .order("display", { ascending: false });
    if (error) logError("fetchCurrentFinancialYear", error);
    if (!data || data.length === 0) return null;

    const today = new Date();

    // Attempt 1: find FY whose date_range contains today
    for (const fy of data) {
      if (!fy.date_range) continue;
      try {
        let range: any;
        if (typeof fy.date_range === "string") {
          const trimmed = fy.date_range.trim();
          if (trimmed.startsWith("{")) {
            range = JSON.parse(trimmed);
          } else {
            // Maybe it's a pipe-separated or plain text format — skip
            continue;
          }
        } else if (typeof fy.date_range === "object") {
          range = fy.date_range;
        } else {
          continue;
        }

        // Bubble date range keys can vary: start/end, start_date/end_date, Start/End
        const startRaw = range.start ?? range.start_date ?? range.Start ?? range.startDate;
        const endRaw = range.end ?? range.end_date ?? range.End ?? range.endDate;

        if (startRaw == null || endRaw == null) continue;

        const start = new Date(startRaw);
        const end = new Date(endRaw);

        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          if (today >= start && today <= end) {
            return { id: fy.id, display: fy.display || "" };
          }
        }
      } catch {
        continue;
      }
    }

    // Fallback: pick the most recent FY by display (already sorted desc)
    // This ensures we always return a value even when date_range is null/unparseable
    console.warn("[fetchCurrentFinancialYear] No FY matched by date_range, using latest by display");
    const latestFY = data[0];
    return { id: latestFY.id, display: latestFY.display || "" };
  }, null, "fetchCurrentFinancialYear");
}

export async function fetchServiceTypeOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("service_types")
      .select("id, display, chin_display")
      .order("display");
    if (error) logError("fetchServiceTypeOptions", error);
    return (data ?? []).map((d: any) => ({
      id: d.id,
      label: d.chin_display || d.display || "未命名",
      searchText: d.display || "",
    }));
  }, [], "fetchServiceTypeOptions");
}

export async function fetchProjectTypeOptions(): Promise<LinkOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("project_types")
      .select("id, display, chin_display")
      .order("display");
    if (error) logError("fetchProjectTypeOptions", error);
    return (data ?? []).map((d: any) => ({
      id: d.id,
      label: d.chin_display || d.display || "未命名",
      searchText: d.display || "",
    }));
  }, [], "fetchProjectTypeOptions");
}

// ─── DEFECT CAUSE OPTIONS (completion defect dialogs) ─────────────

export interface DefectCauseOption {
  id: string;
  label: string;
}

export async function fetchDefectCauseOptions(): Promise<DefectCauseOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("nos_defect_causes")
      .select("id, display, chin_display, is_active")
      .eq("is_active", true)
      .order("display");
    if (error) {
      logError("fetchDefectCauseOptions", error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      label: r.chin_display || r.display || "未命名",
    }));
  }, [], "fetchDefectCauseOptions");
}

export interface IncomeExpiryReasonOption extends LinkOption {
  is_active: boolean;
}

/** Active expiry reasons, plus a currently selected inactive row so edits stay valid. */
export async function fetchIncomeExpiryReasonOptions(
  includeId?: string | null
): Promise<IncomeExpiryReasonOption[]> {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from("income_expiry_reasons")
      .select("id, display, is_active, sort")
      .order("sort", { ascending: true });
    if (error) {
      logError("fetchIncomeExpiryReasonOptions", error);
      return [];
    }
    return (data ?? [])
      .filter((r: any) => r.is_active !== false || (includeId && r.id === includeId))
      .map((r: any) => ({
        id: r.id,
        label: r.display || "未命名",
        is_active: r.is_active !== false,
      }));
  }, [], "fetchIncomeExpiryReasonOptions");
}
