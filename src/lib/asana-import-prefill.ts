import { createClient } from "@/lib/supabase/server";
import { AsanaApiError } from "@/lib/asana";
import { ASANA_IMPORT_PROJECTS } from "@/lib/asana-import-projects";
import {
  buildingCandidates,
  buildBwaPitchingImportPrefill,
  uniqueSearchTokens,
  type AsanaImportLookups,
  type AsanaImportTaskDetail,
  type BwaPitchingImportPrefill,
} from "@/lib/asana-import-map";
import { getAsanaPat } from "@/lib/asana-pat";

const ALLOWED_PROJECTS = new Set<string>(ASANA_IMPORT_PROJECTS.map((p) => p.gid));

async function asanaGet<T>(pathAndQuery: string): Promise<T> {
  const token = getAsanaPat();
  const res = await fetch(`https://app.asana.com/api/1.0${pathAndQuery}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const body = await res.text();
  if (!res.ok) {
    throw new AsanaApiError(res.status, body.slice(0, 240));
  }
  return JSON.parse(body) as T;
}

export async function fetchAsanaImportTaskDetail(
  taskGid: string
): Promise<AsanaImportTaskDetail> {
  const fields = [
    "name",
    "notes",
    "assignee.name",
    "created_at",
    "permalink_url",
    "projects.gid",
    "custom_fields.name",
    "custom_fields.resource_subtype",
    "custom_fields.display_value",
  ].join(",");

  const json = await asanaGet<{
    data?: {
      gid?: string;
      name?: string;
      notes?: string;
      created_at?: string;
      permalink_url?: string;
      assignee?: { name?: string } | null;
      projects?: Array<{ gid?: string }>;
      custom_fields?: Array<{
        name?: string;
        resource_subtype?: string;
        display_value?: string | null;
      }>;
    };
  }>(`/tasks/${taskGid}?opt_fields=${encodeURIComponent(fields)}`);

  const task = json.data;
  if (!task?.gid) {
    throw new AsanaApiError(404, "Asana 任務不存在。");
  }

  const projectGids = (task.projects ?? []).map((p) => p.gid).filter(Boolean);
  if (!projectGids.some((gid) => gid && ALLOWED_PROJECTS.has(gid))) {
    throw new AsanaApiError(403, "此任務不在已連接的 BWA Active 專案內。");
  }

  return {
    gid: task.gid,
    name: task.name?.trim() || "（無名稱）",
    notes: task.notes?.trim() || null,
    assigneeName: task.assignee?.name?.trim() || null,
    createdAt: task.created_at || null,
    permalinkUrl: task.permalink_url || null,
    customFields: (task.custom_fields ?? []).map((field) => ({
      name: field.name?.trim() || "",
      type: field.resource_subtype || null,
      displayValue: field.display_value?.trim() || null,
    })),
  };
}

async function loadLookups(searchTitle: string, notes: string | null) {
  const supabase = await createClient();
  const customerTokens = uniqueSearchTokens(searchTitle);
  const buildingTokens = buildingCandidates(searchTitle, notes);

  const [staffRes, districtRes, serviceRes, projectRes, quoteRes] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name, full_name, n_team_type_id, status")
      .order("name"),
    supabase.from("districts").select("id, name").order("name"),
    supabase.from("service_types").select("id, display, chin_display").order("display"),
    supabase.from("project_types").select("id, display, chin_display").order("display"),
    supabase.from("nos_quote_project_types").select("id, name").order("name"),
  ]);

  const customers: AsanaImportLookups["customers"] = [];
  for (const token of customerTokens.slice(0, 4)) {
    const safe = token.replace(/[%_,.()]/g, "").trim();
    if (safe.length < 2) continue;
    const { data } = await supabase
      .from("customers")
      .select("id, customer_name, display_name, company_name")
      .eq("status", "Active")
      .or(
        `customer_name.ilike.%${safe}%,display_name.ilike.%${safe}%,company_name.ilike.%${safe}%`
      )
      .limit(5);
    for (const row of data ?? []) {
      customers.push({
        id: row.id,
        label: row.display_name || row.customer_name || row.company_name || "未命名",
      });
    }
  }

  const buildings: AsanaImportLookups["buildings"] = [];
  for (const token of buildingTokens.slice(0, 4)) {
    const { data } = await supabase
      .from("buildings")
      .select("id, building_name")
      .ilike("building_name", `%${token}%`)
      .limit(5);
    for (const row of data ?? []) {
      buildings.push({
        id: row.id,
        label: row.building_name || "未命名",
      });
    }
  }

  return {
    staff: (staffRes.data ?? []).map((row) => ({
      id: row.id,
      label: row.name || row.full_name || "",
      teamTypeId: row.n_team_type_id || null,
    })),
    districts: (districtRes.data ?? []).map((row) => ({
      id: row.id,
      label: row.name || "未命名",
    })),
    serviceTypes: (serviceRes.data ?? []).map((row) => ({
      id: row.id,
      label: row.display || row.chin_display || "未命名",
      searchText: row.chin_display || "",
    })),
    projectTypes: (projectRes.data ?? []).map((row) => ({
      id: row.id,
      label: row.display || row.chin_display || "未命名",
      searchText: row.chin_display || "",
    })),
    quoteProjectTypes: (quoteRes.data ?? []).map((row) => ({
      id: row.id,
      label: row.name || "未命名",
    })),
    customers,
    buildings,
  } satisfies AsanaImportLookups;
}

export async function resolveAsanaImportPrefill(
  taskGid: string
): Promise<BwaPitchingImportPrefill> {
  const task = await fetchAsanaImportTaskDetail(taskGid);
  const lookups = await loadLookups(task.name, task.notes);
  return buildBwaPitchingImportPrefill(task, lookups);
}
