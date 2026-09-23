import {
  createBwfAnonServerClient,
  createBwfServerClient,
  isBwfSupabaseConfigured,
  isBwfSupabaseServiceKeyConfigured,
} from "@/lib/supabase/bwf";

/** Prefer service-role for server reads when available (production may omit NEXT_PUBLIC anon). */
function createBwfReadClient() {
  if (isBwfSupabaseServiceKeyConfigured()) {
    return createBwfServerClient();
  }
  return createBwfAnonServerClient();
}

export interface BwfQuoteListRow {
  id: string;
  quote_id: string;
  status: string;
  version: string;
  total_amount: number;
  submitter: string;
  created_at: string | null;
  bwf_pitching_id: string | null;
  bwf_project_id: string | null;
}

const FURNITURE_INDUSTRY_CHIPS = new Set([
  "餐飲",
  "辦公",
  "零售",
  "醫療",
  "教育",
  "酒店",
  "住宅",
  "其他",
]);

const DEFAULT_QUICK_QUOTE_PATH = "/quote/quick";

const QUOTE_SELECT_COLS =
  "id, quote_id, status, version, total_amount, submitter, created_at, bwf_pitching_id, bwf_project_id";

function getQuickQuotePath(): string {
  const raw =
    process.env.NEXT_PUBLIC_FURNITURE_QUICK_QUOTE_PATH ||
    process.env.FURNITURE_QUICK_QUOTE_PATH ||
    DEFAULT_QUICK_QUOTE_PATH;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function mergeQuoteRows(
  map: Map<string, BwfQuoteListRow>,
  rows: BwfQuoteListRow[] | null | undefined
) {
  for (const row of rows ?? []) {
    if (!map.has(row.id)) map.set(row.id, row);
  }
}

function sortQuotesByCreatedDesc(rows: BwfQuoteListRow[]): BwfQuoteListRow[] {
  return [...rows].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });
}

/**
 * Fetch Furniture 1000 quotes linked to a PMS BWF pitching.
 * Server-only: uses session-free BWF anon client (avoids PMS cookie collision).
 */
export async function fetchBwfQuotesForPitching(
  pitchingId: string,
  pitchingCode?: string | null
): Promise<BwfQuoteListRow[]> {
  if (!isBwfSupabaseConfigured()) return [];

  const client = createBwfReadClient();
  const map = new Map<string, BwfQuoteListRow>();

  const byFk = await client
    .from("bwf_quote")
    .select(QUOTE_SELECT_COLS)
    .eq("bwf_pitching_id", pitchingId)
    .order("created_at", { ascending: false });

  if (byFk.error) {
    console.error("[fetchBwfQuotesForPitching] by bwf_pitching_id:", byFk.error.message);
    throw new Error(byFk.error.message);
  }
  mergeQuoteRows(map, byFk.data as BwfQuoteListRow[]);

  // Also match quotes that stored the PMS id inside project_data (Furniture prefill)
  // but never wrote the dedicated FK column.
  const byFormId = await client
    .from("bwf_quote")
    .select(QUOTE_SELECT_COLS)
    .filter("project_data->formData->>pmsPitchingId", "eq", pitchingId)
    .order("created_at", { ascending: false });

  if (byFormId.error) {
    console.error(
      "[fetchBwfQuotesForPitching] by formData.pmsPitchingId:",
      byFormId.error.message
    );
  } else {
    mergeQuoteRows(map, byFormId.data as BwfQuoteListRow[]);
  }

  const code = pitchingCode?.trim();
  if (code) {
    const byCode = await client
      .from("bwf_quote")
      .select(QUOTE_SELECT_COLS)
      .filter("project_data->formData->>projectName", "eq", code)
      .order("created_at", { ascending: false });

    if (byCode.error) {
      console.error(
        "[fetchBwfQuotesForPitching] by projectName:",
        byCode.error.message
      );
    } else {
      mergeQuoteRows(map, byCode.data as BwfQuoteListRow[]);
    }
  }

  return sortQuotesByCreatedDesc([...map.values()]);
}

/**
 * Fetch Furniture 1000 quotes linked to a PMS BWF project via bwf_project_id.
 * Server-only: uses session-free BWF anon client (avoids PMS cookie collision).
 */
export async function fetchBwfQuotesForProject(
  projectId: string,
  _projectCode?: string | null
): Promise<BwfQuoteListRow[]> {
  if (!isBwfSupabaseConfigured()) return [];

  const client = createBwfReadClient();
  const map = new Map<string, BwfQuoteListRow>();

  const byFk = await client
    .from("bwf_quote")
    .select(QUOTE_SELECT_COLS)
    .eq("bwf_project_id", projectId)
    .order("created_at", { ascending: false });

  if (byFk.error) {
    console.error("[fetchBwfQuotesForProject] by bwf_project_id:", byFk.error.message);
    throw new Error(byFk.error.message);
  }
  mergeQuoteRows(map, byFk.data as BwfQuoteListRow[]);

  const byFormId = await client
    .from("bwf_quote")
    .select(QUOTE_SELECT_COLS)
    .filter("project_data->formData->>pmsProjectId", "eq", projectId)
    .order("created_at", { ascending: false });

  if (byFormId.error) {
    console.error(
      "[fetchBwfQuotesForProject] by formData.pmsProjectId:",
      byFormId.error.message
    );
  } else {
    mergeQuoteRows(map, byFormId.data as BwfQuoteListRow[]);
  }

  return sortQuotesByCreatedDesc([...map.values()]);
}

export interface LinkBwfQuotesToProjectResult {
  updated: number;
  quoteIds: string[];
}

export const BWF_QUOTE_STATUS_CONFIRMED = "已確認";

/**
 * On pitching → project convert: set bwf_project_id on Furniture quotes
 * that already link to the pitching (bwf_pitching_id).
 * Uses service-role client when available so RLS cannot block the write.
 */
export async function linkBwfQuotesToProject(
  pitchingId: string,
  projectId: string
): Promise<LinkBwfQuotesToProjectResult> {
  if (!isBwfSupabaseConfigured()) {
    return { updated: 0, quoteIds: [] };
  }

  const client = createBwfServerClient();

  const { data, error } = await client
    .from("bwf_quote")
    .update({
      bwf_project_id: projectId,
    })
    .eq("bwf_pitching_id", pitchingId)
    .select("id, quote_id");

  if (error) {
    console.error("[linkBwfQuotesToProject]", error.message);
    throw new Error(error.message);
  }

  const rows = data ?? [];
  return {
    updated: rows.length,
    quoteIds: rows.map((r) => r.quote_id),
  };
}

export interface ConfirmBwfQuoteResult {
  id: string;
  quote_id: string;
  status: string;
}

/**
 * Mark a Furniture quote as confirmed and attach the new PMS project id.
 * Uses service-role client when available so RLS cannot block the write.
 */
export async function confirmBwfQuoteStatus(
  quoteId: string,
  projectId: string
): Promise<ConfirmBwfQuoteResult> {
  if (!isBwfSupabaseConfigured()) {
    throw new Error("bwf_not_configured");
  }

  const client = createBwfServerClient();
  const { data, error } = await client
    .from("bwf_quote")
    .update({
      status: BWF_QUOTE_STATUS_CONFIRMED,
      bwf_project_id: projectId,
    })
    .eq("id", quoteId)
    .select("id, quote_id, status")
    .single();

  if (error) {
    console.error("[confirmBwfQuoteStatus]", error.message);
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Quote not found");
  }

  return data as ConfirmBwfQuoteResult;
}

export interface BwfQuotePrefillInput {
  pitchingId?: string;
  projectId?: string;
  entityCode: string | null;
  pmName: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  customerTypeName: string | null;
}

/** @deprecated Prefer BwfQuotePrefillInput with entityCode */
export interface BwfQuotePitchingPrefillInput {
  pitchingId: string;
  pitchingCode: string | null;
  pmName: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  customerTypeName: string | null;
}

/** Relative Furniture path + query for 快速報價 prefill (passed as SSO redirect_to). */
export function buildFurnitureQuickQuoteRedirectPath(
  input: BwfQuotePrefillInput | BwfQuotePitchingPrefillInput
): string {
  const params = new URLSearchParams();

  const pitchingId =
    "pitchingId" in input ? input.pitchingId : undefined;
  const projectId = "projectId" in input ? input.projectId : undefined;
  const entityCode =
    "entityCode" in input
      ? input.entityCode
      : "pitchingCode" in input
        ? input.pitchingCode
        : null;

  if (projectId) {
    params.set("pmsProjectId", projectId);
  }
  if (pitchingId) {
    params.set("pmsPitchingId", pitchingId);
  }
  if (entityCode) params.set("projectName", entityCode);
  if (input.pmName) params.set("projectManager", input.pmName);
  if (input.clientName) params.set("clientName", input.clientName);
  if (input.clientPhone) params.set("clientPhone", input.clientPhone);
  if (input.clientEmail) params.set("clientEmail", input.clientEmail);
  if (
    input.customerTypeName &&
    FURNITURE_INDUSTRY_CHIPS.has(input.customerTypeName)
  ) {
    params.set("clientIndustry", input.customerTypeName);
  }
  params.set("quotationType", "傢俬採購");

  const path = getQuickQuotePath();
  return `${path}?${params.toString()}`;
}

/** PMS SSO start URL that lands on Furniture 快速報價 with pitching/project prefill. */
export function buildFurnitureQuoteCreateSsoUrl(
  input: BwfQuotePrefillInput | BwfQuotePitchingPrefillInput
): string {
  const redirectTo = buildFurnitureQuickQuoteRedirectPath(input);
  return `/api/bwf/sso/start?redirect_to=${encodeURIComponent(redirectTo)}`;
}
