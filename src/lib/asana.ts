export interface AsanaComment {
  id: string;
  text: string;
  created_at: string | null;
  author_name: string | null;
}

export class AsanaApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "AsanaApiError";
    this.status = status;
    this.code = code;
  }
}

export const ASANA_MCP_TOKEN_MESSAGE =
  "目前連接的是 Asana MCP 應用，權杖不能呼叫 REST API 讀取評論。請另建「API app」後重新連接。";

export function asanaHttpErrorMessage(
  status: number,
  body: string,
  kind: "task" | "stories"
): string {
  if (status === 401) {
    return "Asana 權杖無法讀取此任務。請重新連接，或確認此 Asana 應用支援 REST API。";
  }
  if (status === 403 || status === 404) {
    return "你的 Asana 帳號沒有此任務的權限，或任務不存在。";
  }
  if (/This endpoint requires an API app/i.test(body)) {
    return ASANA_MCP_TOKEN_MESSAGE;
  }
  return `Asana ${kind} lookup failed (${status}): ${body.slice(0, 200)}`;
}

interface AsanaStory {
  gid: string;
  type?: string;
  resource_subtype?: string;
  text?: string;
  created_at?: string;
  created_by?: { name?: string } | null;
}

export type AsanaLinkParts = {
  taskGid: string | null;
  projectGid: string | null;
};

/**
 * Extract task and/or project GIDs from common Asana URL formats.
 */
export function parseAsanaLink(url: string): AsanaLinkParts {
  try {
    const trimmed = url.trim();
    if (!trimmed) return { taskGid: null, projectGid: null };

    const parsed = new URL(trimmed);
    if (!parsed.hostname.includes("asana.com")) {
      return { taskGid: null, projectGid: null };
    }

    const parts = parsed.pathname.split("/").filter(Boolean);

    const taskIndex = parts.indexOf("task");
    const taskGid =
      taskIndex >= 0 && parts[taskIndex + 1] && /^\d+$/.test(parts[taskIndex + 1])
        ? parts[taskIndex + 1]
        : null;

    const projectIndex = parts.indexOf("project");
    let projectGid =
      projectIndex >= 0 && parts[projectIndex + 1] && /^\d+$/.test(parts[projectIndex + 1])
        ? parts[projectIndex + 1]
        : null;

    // /0/{project_gid}/{task_gid} or /0/{project_gid}
    if (parts[0] === "0" && parts[1] && /^\d+$/.test(parts[1])) {
      projectGid = projectGid ?? parts[1];
      if (!taskGid && parts.length >= 3 && /^\d+$/.test(parts[2]) && parts[2] !== "f") {
        return { taskGid: parts[2], projectGid };
      }
    }

    return { taskGid, projectGid };
  } catch {
    return { taskGid: null, projectGid: null };
  }
}

/**
 * Extract a task GID from common Asana URL formats.
 * Returns null when the URL does not point at a specific task.
 */
export function parseAsanaTaskGid(url: string): string | null {
  return parseAsanaLink(url).taskGid;
}

/** Task GIDs already stored on pitching/project asana_link values. */
export function collectAsanaTaskGidsFromLinks(
  links: Array<string | null | undefined>
): Set<string> {
  const gids = new Set<string>();
  for (const link of links) {
    const trimmed = link?.trim();
    if (!trimmed) continue;
    const fromUrl = parseAsanaTaskGid(trimmed);
    if (fromUrl) {
      gids.add(fromUrl);
      continue;
    }
    if (/^\d+$/.test(trimmed)) gids.add(trimmed);
  }
  return gids;
}

export function parseAsanaProjectGid(url: string): string | null {
  return parseAsanaLink(url).projectGid;
}

export async function fetchAsanaLinkTitle(
  asanaLink: string,
  accessToken: string
): Promise<{ title: string | null; kind: "task" | "project" | null }> {
  const { taskGid, projectGid } = parseAsanaLink(asanaLink);
  if (taskGid) {
    const json = await asanaGet<{ data?: { name?: string } }>(
      `/tasks/${taskGid}?opt_fields=name`,
      accessToken,
      "task"
    );
    return { title: json.data?.name?.trim() || null, kind: "task" };
  }
  if (projectGid) {
    const json = await asanaGet<{ data?: { name?: string } }>(
      `/projects/${projectGid}?opt_fields=name`,
      accessToken,
      "task"
    );
    return { title: json.data?.name?.trim() || null, kind: "project" };
  }
  return { title: null, kind: null };
}

function isUserComment(story: AsanaStory): boolean {
  if (story.resource_subtype === "comment_added") return true;
  if (story.type === "comment" && story.text?.trim()) return true;
  return false;
}

export async function fetchAsanaTaskComments(
  taskGid: string,
  accessToken: string
): Promise<{ taskGid: string; taskName: string | null; comments: AsanaComment[] }> {
  const optFields = [
    "name",
    "created_at",
    "text",
    "type",
    "resource_subtype",
    "created_by.name",
  ].join(",");

  const [taskRes, storiesRes] = await Promise.all([
    fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}?opt_fields=name`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }),
    fetch(
      `https://app.asana.com/api/1.0/tasks/${taskGid}/stories?opt_fields=${encodeURIComponent(optFields)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    ),
  ]);

  if (!taskRes.ok) {
    const body = await taskRes.text();
    const message = asanaHttpErrorMessage(taskRes.status, body, "task");
    throw new AsanaApiError(
      taskRes.status,
      message,
      /This endpoint requires an API app/i.test(body) ? "asana_mcp_token" : undefined
    );
  }

  if (!storiesRes.ok) {
    const body = await storiesRes.text();
    const message = asanaHttpErrorMessage(storiesRes.status, body, "stories");
    throw new AsanaApiError(
      storiesRes.status,
      message,
      /This endpoint requires an API app/i.test(body) ? "asana_mcp_token" : undefined
    );
  }

  const taskJson = (await taskRes.json()) as { data?: { name?: string } };
  const storiesJson = (await storiesRes.json()) as { data?: AsanaStory[] };

  const comments = (storiesJson.data ?? [])
    .filter(isUserComment)
    .map((story) => ({
      id: story.gid,
      text: story.text?.trim() ?? "",
      created_at: story.created_at ?? null,
      author_name: story.created_by?.name ?? null,
    }))
    .filter((comment) => comment.text.length > 0)
    .sort((a, b) => {
      const aTime = a.created_at ? Date.parse(a.created_at) : 0;
      const bTime = b.created_at ? Date.parse(b.created_at) : 0;
      return bTime - aTime;
    });

  return {
    taskGid,
    taskName: taskJson.data?.name ?? null,
    comments,
  };
}

export type AsanaReportContext = {
  asanaLink: string;
  taskGid: string | null;
  projectGid: string | null;
  title: string | null;
  text: string;
  commentCount: number;
  taskCount: number;
};

type AsanaCustomField = {
  name?: string;
  display_value?: string | null;
};

type AsanaTaskDetail = {
  gid?: string;
  name?: string;
  notes?: string;
  due_on?: string | null;
  start_on?: string | null;
  completed?: boolean;
  assignee?: { name?: string } | null;
  custom_fields?: AsanaCustomField[];
  projects?: Array<{ name?: string }>;
};

type AsanaProjectDetail = {
  gid?: string;
  name?: string;
  notes?: string;
};

async function asanaGet<T>(
  path: string,
  accessToken: string,
  kind: "task" | "stories"
): Promise<T> {
  const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    const message = asanaHttpErrorMessage(res.status, body, kind);
    throw new AsanaApiError(
      res.status,
      message,
      /This endpoint requires an API app/i.test(body) ? "asana_mcp_token" : undefined
    );
  }

  return (await res.json()) as T;
}

function clipAsana(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n…(已截斷)`;
}

function formatTaskBlock(task: AsanaTaskDetail, comments: AsanaComment[] = []): string {
  const lines: string[] = [];
  lines.push(`任務：${task.name || task.gid || "（無名稱）"}`);
  if (task.completed != null) lines.push(`狀態：${task.completed ? "已完成" : "未完成"}`);
  if (task.assignee?.name) lines.push(`負責人：${task.assignee.name}`);
  if (task.start_on || task.due_on) {
    lines.push(`日期：${task.start_on || "?"} → ${task.due_on || "?"}`);
  }
  const custom = (task.custom_fields ?? [])
    .map((field) => {
      const name = field.name?.trim();
      const value = field.display_value?.trim();
      if (!name || !value) return null;
      return `${name}=${value}`;
    })
    .filter((item): item is string => !!item);
  if (custom.length) lines.push(`自訂欄位：${custom.join("；")}`);
  if (task.notes?.trim()) {
    lines.push("說明：");
    lines.push(clipAsana(task.notes.trim(), 4_000));
  }
  if (comments.length) {
    lines.push("評論：");
    for (const comment of comments.slice(0, 40)) {
      const when = comment.created_at ? comment.created_at.slice(0, 10) : "";
      const author = comment.author_name || "Asana 用戶";
      lines.push(`- [${when} ${author}] ${clipAsana(comment.text, 1_200)}`);
    }
  }
  return lines.join("\n");
}

/**
 * Load the project's Asana task or project contents for the 10-day report AI.
 * Prefers a linked task (notes + comments + subtasks); falls back to project tasks.
 */
export async function fetchAsanaReportContext(
  asanaLink: string,
  accessToken: string
): Promise<AsanaReportContext> {
  const { taskGid, projectGid } = parseAsanaLink(asanaLink);
  if (!taskGid && !projectGid) {
    throw new AsanaApiError(
      422,
      "Asana 連結無法解析為任務或專案。請在項目資料填入 Asana 任務或專案連結。"
    );
  }

  if (taskGid) {
    const taskFields = [
      "name",
      "notes",
      "due_on",
      "start_on",
      "completed",
      "assignee.name",
      "custom_fields.name",
      "custom_fields.display_value",
      "projects.name",
    ].join(",");

    const storyFields = [
      "name",
      "created_at",
      "text",
      "type",
      "resource_subtype",
      "created_by.name",
    ].join(",");

    const [taskJson, storiesJson, subtasksJson] = await Promise.all([
      asanaGet<{ data?: AsanaTaskDetail }>(
        `/tasks/${taskGid}?opt_fields=${encodeURIComponent(taskFields)}`,
        accessToken,
        "task"
      ),
      asanaGet<{ data?: AsanaStory[] }>(
        `/tasks/${taskGid}/stories?opt_fields=${encodeURIComponent(storyFields)}`,
        accessToken,
        "stories"
      ),
      asanaGet<{ data?: AsanaTaskDetail[] }>(
        `/tasks/${taskGid}/subtasks?opt_fields=${encodeURIComponent(
          "name,notes,completed,due_on,assignee.name"
        )}`,
        accessToken,
        "task"
      ),
    ]);

    const task = taskJson.data ?? {};
    const comments = (storiesJson.data ?? [])
      .filter(isUserComment)
      .map((story) => ({
        id: story.gid,
        text: story.text?.trim() ?? "",
        created_at: story.created_at ?? null,
        author_name: story.created_by?.name ?? null,
      }))
      .filter((comment) => comment.text.length > 0)
      .slice(0, 20);
    const subtasks = (subtasksJson.data ?? []).slice(0, 20);
    const parts = [formatTaskBlock(task, comments)];
    if (subtasks.length) {
      parts.push("子任務：");
      for (const sub of subtasks) {
        const mark = sub.completed ? "[x]" : "[ ]";
        const due = sub.due_on ? ` (到期 ${sub.due_on})` : "";
        const notes = sub.notes?.trim() ? ` — ${clipAsana(sub.notes.trim(), 400)}` : "";
        parts.push(`${mark} ${sub.name || "（無名稱）"}${due}${notes}`);
      }
    }

    return {
      asanaLink,
      taskGid,
      projectGid,
      title: task.name ?? null,
      text: clipAsana(parts.join("\n"), 18_000),
      commentCount: comments.length,
      taskCount: 1 + subtasks.length,
    };
  }

  const since = new Date();
  since.setDate(since.getDate() - 90);
  const completedSince = since.toISOString();
  const projectFields = "name,notes";
  const taskFields = "name,notes,due_on,completed,assignee.name,modified_at";

  const [projectJson, tasksJson] = await Promise.all([
    asanaGet<{ data?: AsanaProjectDetail }>(
      `/projects/${projectGid}?opt_fields=${encodeURIComponent(projectFields)}`,
      accessToken,
      "task"
    ),
    asanaGet<{ data?: AsanaTaskDetail[] }>(
      `/projects/${projectGid}/tasks?completed_since=${encodeURIComponent(completedSince)}&opt_fields=${encodeURIComponent(taskFields)}&limit=25`,
      accessToken,
      "task"
    ),
  ]);

  const project = projectJson.data ?? {};
  const tasks = tasksJson.data ?? [];
  const parts = [`專案：${project.name || projectGid}`];
  if (project.notes?.trim()) {
    parts.push("專案說明：");
    parts.push(clipAsana(project.notes.trim(), 3_000));
  }
  parts.push(`任務（最近 90 天內未完成或已完成，最多 50 項）：`);
  for (const task of tasks) {
    parts.push("");
    parts.push(formatTaskBlock(task));
  }

  return {
    asanaLink,
    taskGid: null,
    projectGid,
    title: project.name ?? null,
    text: clipAsana(parts.join("\n"), 18_000),
    commentCount: 0,
    taskCount: tasks.length,
  };
}
