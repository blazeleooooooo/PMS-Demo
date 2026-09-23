import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AsanaApiError, fetchAsanaReportContext } from "@/lib/asana";
import {
  AsanaNotConnectedError,
  AsanaOAuthConfigError,
  getValidAsanaAccessToken,
} from "@/lib/asana-oauth";
import { GrokApiError, GrokConfigError, grokChatCompletion } from "@/lib/grok";
import {
  applyWeeklyReportAiFields,
  buildGrokMessages,
  buildWeeklyReportAiUserPayload,
  parseWeeklyReportAiJson,
  WEEKLY_REPORT_AI_FIELD_KEYS,
  type WeeklyReportAiChatMessage,
} from "@/lib/weekly-report-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asHistory(value: unknown): WeeklyReportAiChatMessage[] {
  if (!Array.isArray(value)) return [];
  const messages: WeeklyReportAiChatMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const content = asString(record.content).trim();
    if (!content) continue;
    messages.push({
      role: record.role === "assistant" ? "assistant" : "user",
      content,
    });
  }
  return messages.slice(-12);
}

function asCurrentFields(value: unknown): Record<string, string> {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const fields: Record<string, string> = {};
  for (const key of WEEKLY_REPORT_AI_FIELD_KEYS) {
    fields[key] = asString(source[key]);
  }
  return fields;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const projectId = asString(body.projectId).trim();
  const weekNumber = Number(body.weekNumber);
  const userNote = asString(body.userNote);
  const history = asHistory(body.history);
  const currentFields = asCurrentFields(body.currentFields);

  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }
  if (!Number.isFinite(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "Invalid weekNumber" }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabase
    .from("bwa_projects")
    .select("id, project_name, project_code, asana_link")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "找不到此 BWA 項目" }, { status: 404 });
  }

  let asanaText: string | null = null;
  let asanaWarning: string | null = null;
  let asanaTitle: string | null = null;
  let asanaUsed = false;

  const asanaLink = typeof project.asana_link === "string" ? project.asana_link.trim() : "";
  if (!asanaLink) {
    asanaWarning = "此項目尚未設定 Asana 連結，只會分析聊天內容。";
  } else {
    try {
      const accessToken = await getValidAsanaAccessToken(user.id);
      const context = await Promise.race([
        fetchAsanaReportContext(asanaLink, accessToken),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("讀取 Asana 逾時，改為只分析聊天內容。")), 12_000);
        }),
      ]);
      asanaText = context.text;
      asanaTitle = context.title;
      asanaUsed = true;
    } catch (error) {
      if (error instanceof AsanaNotConnectedError) {
        asanaWarning = "尚未連接 Asana 帳號，只會分析聊天內容。可先連接 Asana 以讀取任務。";
      } else if (error instanceof AsanaOAuthConfigError) {
        asanaWarning = error.message;
      } else if (error instanceof AsanaApiError) {
        asanaWarning = error.message;
      } else {
        asanaWarning =
          error instanceof Error ? error.message : "讀取 Asana 失敗，只會分析聊天內容。";
      }
    }
  }

  if (!userNote.trim() && !asanaUsed && history.length === 0) {
    return NextResponse.json(
      {
        error: asanaWarning || "請先貼上會議筆記，或連接 Asana 後再分析。",
        code: "empty_context",
        asana: { used: false, title: null, warning: asanaWarning },
      },
      { status: 400 }
    );
  }

  const contextPayload = buildWeeklyReportAiUserPayload({
    projectName: asString(body.projectName) || project.project_name,
    projectCode: asString(body.projectCode) || project.project_code,
    pmName: asString(body.pmName) || null,
    designerName: asString(body.designerName) || null,
    weekNumber,
    weekStart: asString(body.weekStart),
    weekEnd: asString(body.weekEnd),
    meetingDate: asString(body.meetingDate) || null,
    currentFields,
    asanaText,
    asanaWarning,
  });

  try {
    const raw = await grokChatCompletion(
      buildGrokMessages({
        history,
        userNote,
        contextPayload,
      }),
      { timeoutMs: 150_000 }
    );
    const parsed = parseWeeklyReportAiJson(raw);
    const applied = applyWeeklyReportAiFields(currentFields, parsed.fields);

    return NextResponse.json({
      success: true,
      reply: parsed.reply,
      fields: parsed.fields,
      filledKeys: applied.filledKeys,
      asana: {
        used: asanaUsed,
        title: asanaTitle,
        warning: asanaWarning,
      },
    });
  } catch (error) {
    if (error instanceof GrokConfigError) {
      return NextResponse.json({ error: error.message, code: "grok_not_configured" }, { status: 503 });
    }
    if (error instanceof GrokApiError) {
      return NextResponse.json(
        { error: error.message, code: "grok_failed" },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      );
    }
    console.error("[api/weekly-reports/ai-fill]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI 分析失敗" },
      { status: 502 }
    );
  }
}
