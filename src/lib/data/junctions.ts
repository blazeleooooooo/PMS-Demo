import {
  supabase,
  mapBatchesParallel,
  fetchAllByFk,
  fetchAllByProject,
} from "@/lib/data/_core";

// ═══════════════════════════════════════════════════════════
// ─── JUNCTION TABLE HELPERS (Many-to-Many Project/Service Types) ─────

/**
 * Resolves project type names from the junction table for BWA pitchings.
 */
export async function resolveJunctionProjectTypesForPitchings(
  pitchingIds: string[]
): Promise<Map<string, string>> {
  if (pitchingIds.length === 0) return new Map();

  const BATCH = 200;
  let allJunction: any[] = [];
  for (let i = 0; i < pitchingIds.length; i += BATCH) {
    const batch = pitchingIds.slice(i, i + BATCH);
    const { data } = await supabase
      .from("bwa_pitching_project_types")
      .select("pitching_id, project_type_id")
      .in("pitching_id", batch);
    if (data) allJunction = allJunction.concat(data);
  }
  if (allJunction.length === 0) return new Map();

  // Get unique project_type_ids
  const typeIds = [...new Set(allJunction.map((d: any) => d.project_type_id).filter(Boolean))];
  if (typeIds.length === 0) return new Map();

  const { data: types } = await supabase
    .from("project_types")
    .select("id, display, chin_display")
    .in("id", typeIds);
  const typeMap = new Map((types ?? []).map((t: any) => [t.id, t.chin_display || t.display]));

  // Group by pitching_id
  const result = new Map<string, string>();
  const grouped: Record<string, string[]> = {};
  for (const row of allJunction) {
    if (!row.pitching_id || !row.project_type_id) continue;
    if (!grouped[row.pitching_id]) grouped[row.pitching_id] = [];
    const name = typeMap.get(row.project_type_id);
    if (name && !grouped[row.pitching_id].includes(name as string)) grouped[row.pitching_id].push(name as string);
  }
  for (const [pid, names] of Object.entries(grouped)) {
    result.set(pid, names.join(", "));
  }
  return result;
}

/**
 * Returns all project_type_ids from the junction table for a single pitching.
 * Used when opening the edit dialog to restore the full multi-select state.
 */
export async function fetchPitchingProjectTypeIds(pitchingId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("bwa_pitching_project_types")
    .select("project_type_id")
    .eq("pitching_id", pitchingId);
  if (error || !data) return [];
  return (data as any[]).map((r) => r.project_type_id).filter(Boolean);
}

/**
 * Resolves the SET of project-type IDs per BWA pitching from the junction table.
 */
export async function resolveJunctionProjectTypeIdsForPitchings(
  pitchingIds: string[],
): Promise<Map<string, string[]>> {
  if (pitchingIds.length === 0) return new Map();

  const BATCH = 200;
  let allJunction: any[] = [];
  for (let i = 0; i < pitchingIds.length; i += BATCH) {
    const batch = pitchingIds.slice(i, i + BATCH);
    const { data } = await supabase
      .from("bwa_pitching_project_types")
      .select("pitching_id, project_type_id")
      .in("pitching_id", batch);
    if (data) allJunction = allJunction.concat(data);
  }

  const result = new Map<string, string[]>();
  for (const row of allJunction) {
    if (!row.pitching_id || !row.project_type_id) continue;
    const list = result.get(row.pitching_id) ?? [];
    if (!list.includes(row.project_type_id)) list.push(row.project_type_id);
    result.set(row.pitching_id, list);
  }
  return result;
}

/**
 * Returns all project_type_ids from the junction table for a single project.
 * Used when opening the edit dialog to restore the full multi-select state.
 */
export async function fetchProjectProjectTypeIds(projectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("bwa_project_project_types")
    .select("project_type_id")
    .eq("project_id", projectId);
  if (error || !data) return [];
  return (data as any[]).map((r) => r.project_type_id).filter(Boolean);
}

/**
 * Resolves service type names from the junction table for BWA pitchings.
 */
export async function resolveJunctionServiceTypesForPitchings(
  pitchingIds: string[]
): Promise<Map<string, string>> {
  if (pitchingIds.length === 0) return new Map();

  const BATCH = 200;
  let allJunction: any[] = [];
  for (let i = 0; i < pitchingIds.length; i += BATCH) {
    const batch = pitchingIds.slice(i, i + BATCH);
    const { data } = await supabase
      .from("bwa_pitching_service_types")
      .select("pitching_id, service_type_id")
      .in("pitching_id", batch);
    if (data) allJunction = allJunction.concat(data);
  }
  if (allJunction.length === 0) return new Map();

  const typeIds = [...new Set(allJunction.map((d: any) => d.service_type_id).filter(Boolean))];
  if (typeIds.length === 0) return new Map();

  const { data: types } = await supabase
    .from("service_types")
    .select("id, display, chin_display")
    .in("id", typeIds);
  const typeMap = new Map(
    (types ?? []).map((t: any) => [t.id, t.chin_display || t.display]),
  );

  const result = new Map<string, string>();
  const grouped: Record<string, string[]> = {};
  for (const row of allJunction) {
    if (!row.pitching_id || !row.service_type_id) continue;
    if (!grouped[row.pitching_id]) grouped[row.pitching_id] = [];
    const name = typeMap.get(row.service_type_id);
    if (name && !grouped[row.pitching_id].includes(name as string)) grouped[row.pitching_id].push(name as string);
  }
  for (const [pid, names] of Object.entries(grouped)) {
    result.set(pid, names.join(", "));
  }
  return result;
}

/**
 * Resolves project type names from the junction table for BWA projects.
 */
export async function resolveJunctionProjectTypesForProjects(
  projectIds: string[]
): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map();

  // Batch in chunks of 200 — paginate each batch so multi-type projects don't
  // brush the PostgREST 1000-row cap. Run a few batches in parallel.
  const allJunction = await mapBatchesParallel(projectIds, 200, 4, (batch) =>
    fetchAllByProject("bwa_project_project_types", "project_id, project_type_id", batch),
  );
  if (allJunction.length === 0) return new Map();

  const typeIds = [...new Set(allJunction.map((d: any) => d.project_type_id).filter(Boolean))];
  if (typeIds.length === 0) return new Map();

  const { data: types } = await supabase
    .from("project_types")
    .select("id, display, chin_display")
    .in("id", typeIds);
  const typeMap = new Map((types ?? []).map((t: any) => [t.id, t.chin_display || t.display]));

  const result = new Map<string, string>();
  const grouped: Record<string, string[]> = {};
  for (const row of allJunction) {
    if (!row.project_id || !row.project_type_id) continue;
    if (!grouped[row.project_id]) grouped[row.project_id] = [];
    const name = typeMap.get(row.project_type_id);
    if (name && !grouped[row.project_id].includes(name as string)) grouped[row.project_id].push(name as string);
  }
  for (const [pid, names] of Object.entries(grouped)) {
    result.set(pid, names.join(", "));
  }
  return result;
}

/**
 * Resolves the SET of project-type IDs per BWA project from the junction table.
 * Returns a Map<project_id, project_type_id[]>. Used by filters that match on
 * type ID (vs. display name) so multi-type projects are matched correctly.
 */
export async function resolveJunctionProjectTypeIdsForProjects(
  projectIds: string[]
): Promise<Map<string, string[]>> {
  if (projectIds.length === 0) return new Map();

  const BATCH = 200;
  let allJunction: any[] = [];
  for (let i = 0; i < projectIds.length; i += BATCH) {
    const batch = projectIds.slice(i, i + BATCH);
    const rows = await fetchAllByProject("bwa_project_project_types", "project_id, project_type_id", batch);
    allJunction = allJunction.concat(rows);
  }

  const result = new Map<string, string[]>();
  for (const row of allJunction) {
    if (!row.project_id || !row.project_type_id) continue;
    const list = result.get(row.project_id) ?? [];
    if (!list.includes(row.project_type_id)) list.push(row.project_type_id);
    result.set(row.project_id, list);
  }
  return result;
}

/**
 * Resolves service type names from the junction table for BWA projects.
 */
export async function resolveJunctionServiceTypesForProjects(
  projectIds: string[]
): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map();

  // Batch in chunks of 200 — paginate each batch so multi-type projects don't
  // brush the PostgREST 1000-row cap. Run a few batches in parallel.
  const allJunction = await mapBatchesParallel(projectIds, 200, 4, (batch) =>
    fetchAllByProject("bwa_project_service_types", "project_id, service_type_id", batch),
  );
  if (allJunction.length === 0) return new Map();

  const typeIds = [...new Set(allJunction.map((d: any) => d.service_type_id).filter(Boolean))];
  if (typeIds.length === 0) return new Map();

  const { data: types } = await supabase
    .from("service_types")
    .select("id, display, chin_display")
    .in("id", typeIds);
  const typeMap = new Map(
    (types ?? []).map((t: any) => [t.id, t.chin_display || t.display]),
  );

  const result = new Map<string, string>();
  const grouped: Record<string, string[]> = {};
  for (const row of allJunction) {
    if (!row.project_id || !row.service_type_id) continue;
    if (!grouped[row.project_id]) grouped[row.project_id] = [];
    const name = typeMap.get(row.service_type_id);
    if (name && !grouped[row.project_id].includes(name as string)) grouped[row.project_id].push(name as string);
  }
  for (const [pid, names] of Object.entries(grouped)) {
    result.set(pid, names.join(", "));
  }
  return result;
}

// ─── BWF junction resolvers (multi-value legacy TEXT → junction tables) ───

async function fetchAllByPitching(
  junctionTable: string,
  columns: string,
  pitchingIds: string[],
): Promise<any[]> {
  return fetchAllByFk(junctionTable, columns, "pitching_id", pitchingIds);
}

async function fetchAllByBwfProject(
  junctionTable: string,
  columns: string,
  projectIds: string[],
): Promise<any[]> {
  return fetchAllByFk(junctionTable, columns, "project_id", projectIds);
}

async function fetchAllByBwfProduct(
  junctionTable: string,
  columns: string,
  productIds: string[],
): Promise<any[]> {
  return fetchAllByFk(junctionTable, columns, "product_id", productIds);
}

export async function resolveBwfJunctionServiceTypesForPitchings(
  pitchingIds: string[],
): Promise<Map<string, string>> {
  if (pitchingIds.length === 0) return new Map();

  const BATCH = 200;
  let allJunction: any[] = [];
  for (let i = 0; i < pitchingIds.length; i += BATCH) {
    const batch = pitchingIds.slice(i, i + BATCH);
    const rows = await fetchAllByPitching(
      "bwf_pitching_bwf_service_types",
      "pitching_id, service_type_id",
      batch,
    );
    allJunction = allJunction.concat(rows);
  }
  if (allJunction.length === 0) return new Map();

  const typeIds = [...new Set(allJunction.map((d: any) => d.service_type_id).filter(Boolean))];
  if (typeIds.length === 0) return new Map();

  const { data: types } = await supabase
    .from("nos_service_type_2")
    .select("id, display")
    .in("id", typeIds);
  const typeMap = new Map((types ?? []).map((t: any) => [t.id, t.display]));

  const result = new Map<string, string>();
  const grouped: Record<string, string[]> = {};
  for (const row of allJunction) {
    if (!row.pitching_id || !row.service_type_id) continue;
    if (!grouped[row.pitching_id]) grouped[row.pitching_id] = [];
    const name = typeMap.get(row.service_type_id);
    if (name && !grouped[row.pitching_id].includes(name as string)) grouped[row.pitching_id].push(name as string);
  }
  for (const [pid, names] of Object.entries(grouped)) {
    result.set(pid, names.join(", "));
  }
  return result;
}

export async function resolveBwfJunctionServiceItemsForPitchings(
  pitchingIds: string[],
): Promise<Map<string, string>> {
  if (pitchingIds.length === 0) return new Map();

  const BATCH = 200;
  let allJunction: any[] = [];
  for (let i = 0; i < pitchingIds.length; i += BATCH) {
    const batch = pitchingIds.slice(i, i + BATCH);
    const rows = await fetchAllByPitching(
      "bwf_pitching_service_items",
      "pitching_id, service_item_id",
      batch,
    );
    allJunction = allJunction.concat(rows);
  }
  if (allJunction.length === 0) return new Map();

  const itemIds = [...new Set(allJunction.map((d: any) => d.service_item_id).filter(Boolean))];
  if (itemIds.length === 0) return new Map();

  const { data: items } = await supabase
    .from("service_items")
    .select("id, display")
    .in("id", itemIds);
  const itemMap = new Map((items ?? []).map((t: any) => [t.id, t.display]));

  const result = new Map<string, string>();
  const grouped: Record<string, string[]> = {};
  for (const row of allJunction) {
    if (!row.pitching_id || !row.service_item_id) continue;
    if (!grouped[row.pitching_id]) grouped[row.pitching_id] = [];
    const name = itemMap.get(row.service_item_id);
    if (name && !grouped[row.pitching_id].includes(name as string)) grouped[row.pitching_id].push(name as string);
  }
  for (const [pid, names] of Object.entries(grouped)) {
    result.set(pid, names.join(", "));
  }
  return result;
}

export async function resolveBwfJunctionMajorQuotesForPitchings(
  pitchingIds: string[],
): Promise<Map<string, string>> {
  if (pitchingIds.length === 0) return new Map();

  const BATCH = 200;
  let allJunction: any[] = [];
  for (let i = 0; i < pitchingIds.length; i += BATCH) {
    const batch = pitchingIds.slice(i, i + BATCH);
    const rows = await fetchAllByPitching(
      "bwf_pitching_major_quotes",
      "pitching_id, major_quote_id",
      batch,
    );
    allJunction = allJunction.concat(rows);
  }
  if (allJunction.length === 0) return new Map();

  const quoteIds = [...new Set(allJunction.map((d: any) => d.major_quote_id).filter(Boolean))];
  if (quoteIds.length === 0) return new Map();

  const { data: quotes } = await supabase
    .from("bwf_major_quotes")
    .select("id, display")
    .in("id", quoteIds);
  const quoteMap = new Map((quotes ?? []).map((t: any) => [t.id, t.display]));

  const result = new Map<string, string>();
  const grouped: Record<string, string[]> = {};
  for (const row of allJunction) {
    if (!row.pitching_id || !row.major_quote_id) continue;
    if (!grouped[row.pitching_id]) grouped[row.pitching_id] = [];
    const name = quoteMap.get(row.major_quote_id);
    if (name && !grouped[row.pitching_id].includes(name as string)) grouped[row.pitching_id].push(name as string);
  }
  for (const [pid, names] of Object.entries(grouped)) {
    result.set(pid, names.join(", "));
  }
  return result;
}

export async function resolveBwfJunctionServiceItemsForProjects(
  projectIds: string[],
): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map();

  const BATCH = 200;
  let allJunction: any[] = [];
  for (let i = 0; i < projectIds.length; i += BATCH) {
    const batch = projectIds.slice(i, i + BATCH);
    const rows = await fetchAllByBwfProject(
      "bwf_project_service_items",
      "project_id, service_item_id",
      batch,
    );
    allJunction = allJunction.concat(rows);
  }
  if (allJunction.length === 0) return new Map();

  const itemIds = [...new Set(allJunction.map((d: any) => d.service_item_id).filter(Boolean))];
  if (itemIds.length === 0) return new Map();

  const { data: items } = await supabase
    .from("service_items")
    .select("id, display")
    .in("id", itemIds);
  const itemMap = new Map((items ?? []).map((t: any) => [t.id, t.display]));

  const result = new Map<string, string>();
  const grouped: Record<string, string[]> = {};
  for (const row of allJunction) {
    if (!row.project_id || !row.service_item_id) continue;
    if (!grouped[row.project_id]) grouped[row.project_id] = [];
    const name = itemMap.get(row.service_item_id);
    if (name && !grouped[row.project_id].includes(name as string)) grouped[row.project_id].push(name as string);
  }
  for (const [pid, names] of Object.entries(grouped)) {
    result.set(pid, names.join(", "));
  }
  return result;
}

export async function resolveBwfJunctionMajorQuotesForProjects(
  projectIds: string[],
): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map();

  const BATCH = 200;
  let allJunction: any[] = [];
  for (let i = 0; i < projectIds.length; i += BATCH) {
    const batch = projectIds.slice(i, i + BATCH);
    const rows = await fetchAllByBwfProject(
      "bwf_project_major_quotes",
      "project_id, major_quote_id",
      batch,
    );
    allJunction = allJunction.concat(rows);
  }
  if (allJunction.length === 0) return new Map();

  const quoteIds = [...new Set(allJunction.map((d: any) => d.major_quote_id).filter(Boolean))];
  if (quoteIds.length === 0) return new Map();

  const { data: quotes } = await supabase
    .from("bwf_major_quotes")
    .select("id, display")
    .in("id", quoteIds);
  const quoteMap = new Map((quotes ?? []).map((t: any) => [t.id, t.display]));

  const result = new Map<string, string>();
  const grouped: Record<string, string[]> = {};
  for (const row of allJunction) {
    if (!row.project_id || !row.major_quote_id) continue;
    if (!grouped[row.project_id]) grouped[row.project_id] = [];
    const name = quoteMap.get(row.major_quote_id);
    if (name && !grouped[row.project_id].includes(name as string)) grouped[row.project_id].push(name as string);
  }
  for (const [pid, names] of Object.entries(grouped)) {
    result.set(pid, names.join(", "));
  }
  return result;
}

export async function resolveBwfJunctionServiceTypesForProjects(
  projectIds: string[],
): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map();

  const allJunction = await mapBatchesParallel(projectIds, 200, 4, (batch) =>
    fetchAllByBwfProject(
      "bwf_project_bwf_service_types",
      "project_id, service_type_id",
      batch,
    ),
  );
  if (allJunction.length === 0) return new Map();

  const typeIds = [...new Set(allJunction.map((d: any) => d.service_type_id).filter(Boolean))];
  if (typeIds.length === 0) return new Map();

  const { data: types } = await supabase
    .from("nos_service_type_2")
    .select("id, display")
    .in("id", typeIds);
  const typeMap = new Map((types ?? []).map((t: any) => [t.id, t.display]));

  const result = new Map<string, string>();
  const grouped: Record<string, string[]> = {};
  for (const row of allJunction) {
    if (!row.project_id || !row.service_type_id) continue;
    if (!grouped[row.project_id]) grouped[row.project_id] = [];
    const name = typeMap.get(row.service_type_id);
    if (name && !grouped[row.project_id].includes(name as string)) grouped[row.project_id].push(name as string);
  }
  for (const [pid, names] of Object.entries(grouped)) {
    result.set(pid, names.join(", "));
  }
  return result;
}

export async function resolveBwfJunctionProductTypesForProducts(
  productIds: string[],
): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();

  const BATCH = 200;
  let allJunction: any[] = [];
  for (let i = 0; i < productIds.length; i += BATCH) {
    const batch = productIds.slice(i, i + BATCH);
    const rows = await fetchAllByBwfProduct(
      "bwf_product_product_types",
      "product_id, product_type_id",
      batch,
    );
    allJunction = allJunction.concat(rows);
  }
  if (allJunction.length === 0) return new Map();

  const typeIds = [...new Set(allJunction.map((d: any) => d.product_type_id).filter(Boolean))];
  if (typeIds.length === 0) return new Map();

  const { data: types } = await supabase
    .from("product_types")
    .select("id, display")
    .in("id", typeIds);
  const typeMap = new Map((types ?? []).map((t: any) => [t.id, t.display]));

  const result = new Map<string, string>();
  const grouped: Record<string, string[]> = {};
  for (const row of allJunction) {
    if (!row.product_id || !row.product_type_id) continue;
    if (!grouped[row.product_id]) grouped[row.product_id] = [];
    const name = typeMap.get(row.product_type_id);
    if (name && !grouped[row.product_id].includes(name as string)) grouped[row.product_id].push(name as string);
  }
  for (const [pid, names] of Object.entries(grouped)) {
    result.set(pid, names.join(", "));
  }
  return result;
}

/** Pitching IDs linked to a BWF service type via junction (plus legacy single FK). */
export async function fetchBwfPitchingIdsForServiceType(serviceTypeId: string): Promise<string[]> {
  const [{ data: junction }, { data: direct }] = await Promise.all([
    supabase
      .from("bwf_pitching_bwf_service_types")
      .select("pitching_id")
      .eq("service_type_id", serviceTypeId),
    supabase
      .from("bwf_pitchings")
      .select("id")
      .eq("n_bwf_service_types_id", serviceTypeId),
  ]);
  const ids = new Set<string>();
  for (const row of junction ?? []) {
    if (row.pitching_id) ids.add(row.pitching_id);
  }
  for (const row of direct ?? []) {
    if (row.id) ids.add(row.id);
  }
  return [...ids];
}
