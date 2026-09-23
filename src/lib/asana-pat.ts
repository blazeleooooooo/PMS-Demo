/**
 * Server-side Asana Personal Access Token (fixed account).
 * Used by /asana-import. Staff OAuth in asana-oauth.ts is unchanged.
 *
 * Required env (never NEXT_PUBLIC_, never log the value):
 * - ASANA_PAT — PAT for presenter@example.com
 */

import { AsanaApiError, asanaHttpErrorMessage } from "@/lib/asana";
import {
  ASANA_IMPORT_PROJECTS,
  getAsanaImportProject,
  type AsanaImportProject,
  type AsanaImportProjectKey,
  type AsanaImportTask,
} from "@/lib/asana-import-projects";

export {
  ASANA_IMPORT_PROJECTS,
  ASANA_IMPORT_WORKSPACE_GID,
  getAsanaImportProject,
  isAsanaImportProjectKey,
  listAsanaImportProjects,
  type AsanaImportProject,
  type AsanaImportProjectKey,
  type AsanaImportTask,
} from "@/lib/asana-import-projects";

export class AsanaPatConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsanaPatConfigError";
  }
}

/** Prefer process.env; fall back to `.env.local` on disk (same pattern as WhatsApp). */
function envVar(name: string): string {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  if (typeof window !== "undefined") return "";
  try {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const file = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(file)) return "";
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key !== name) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return value;
    }
  } catch {
    return "";
  }
  return "";
}

export function getAsanaPat(): string {
  const token = envVar("ASANA_PAT");
  if (!token) {
    throw new AsanaPatConfigError(
      "Asana PAT is not configured. Set ASANA_PAT in .env.local (or the host env)."
    );
  }
  return token;
}

type AsanaTaskRow = {
  gid?: string;
  name?: string;
  completed?: boolean;
  created_at?: string | null;
  due_on?: string | null;
  permalink_url?: string | null;
  assignee?: { name?: string } | null;
};

type AsanaListResponse = {
  data?: AsanaTaskRow[];
  next_page?: { offset?: string } | null;
  errors?: Array<{ message?: string }>;
};

const TASK_FIELDS = [
  "name",
  "completed",
  "created_at",
  "due_on",
  "permalink_url",
  "assignee.name",
].join(",");

async function asanaGet(pathAndQuery: string, token: string): Promise<AsanaListResponse> {
  const res = await fetch(`https://app.asana.com/api/1.0${pathAndQuery}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const body = await res.text();
  if (!res.ok) {
    throw new AsanaApiError(
      res.status,
      asanaHttpErrorMessage(res.status, body, "task"),
      /This endpoint requires an API app/i.test(body) ? "asana_mcp_token" : undefined
    );
  }
  return JSON.parse(body) as AsanaListResponse;
}

function mapTask(row: AsanaTaskRow, project: AsanaImportProject): AsanaImportTask | null {
  if (!row.gid) return null;
  return {
    gid: row.gid,
    name: row.name?.trim() || "（無名稱）",
    completed: Boolean(row.completed),
    assigneeName: row.assignee?.name?.trim() || null,
    createdAt: row.created_at || null,
    dueOn: row.due_on || null,
    permalinkUrl: row.permalink_url || null,
    projectKey: project.key,
    projectName: project.name,
    projectShortName: project.shortName,
  };
}

async function fetchProjectTasks(
  project: AsanaImportProject,
  token: string,
  includeCompleted: boolean
): Promise<AsanaImportTask[]> {
  const params = new URLSearchParams({
    limit: "100",
    opt_fields: TASK_FIELDS,
  });
  if (!includeCompleted) {
    params.set("completed_since", new Date().toISOString());
  }

  const tasks: AsanaImportTask[] = [];
  let path = `/projects/${project.gid}/tasks?${params.toString()}`;
  let pages = 0;

  while (path && pages < 20) {
    pages += 1;
    const json = await asanaGet(path, token);
    for (const row of json.data ?? []) {
      const mapped = mapTask(row, project);
      if (mapped) tasks.push(mapped);
    }
    const offset = json.next_page?.offset;
    if (!offset) break;
    const next = new URLSearchParams(params);
    next.set("offset", offset);
    path = `/projects/${project.gid}/tasks?${next.toString()}`;
  }

  return tasks;
}

export async function fetchAsanaImportTasks(input?: {
  projectKeys?: AsanaImportProjectKey[];
  includeCompleted?: boolean;
}): Promise<{ tasks: AsanaImportTask[]; projects: AsanaImportProject[] }> {
  const token = getAsanaPat();
  const includeCompleted = Boolean(input?.includeCompleted);
  const keys = input?.projectKeys?.length
    ? input.projectKeys
    : ASANA_IMPORT_PROJECTS.map((p) => p.key);
  const projects = keys.map(getAsanaImportProject);

  const batches = await Promise.all(
    projects.map((project) => fetchProjectTasks(project, token, includeCompleted))
  );

  const tasks = batches.flat().sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.dueOn && !b.dueOn) return -1;
    if (!a.dueOn && b.dueOn) return 1;
    return a.name.localeCompare(b.name, "zh-HK");
  });

  return { tasks, projects };
}
