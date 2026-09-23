export const WEEKLY_REPORT_AI_FIELD_KEYS = [
  "za_meeting_team",
  "zb_key_focus",
  "zc_completed_work",
  "zd_next_week_work",
  "ze_additional_items",
  "zf_urgent_client_confirm",
  "zg_site_changes",
  "zh_factors_affecting_handover",
  "zi_overall_site_schedule",
  "zj_payment_schedule",
  "zk_appendix",
] as const;

export type WeeklyReportAiFieldKey = (typeof WEEKLY_REPORT_AI_FIELD_KEYS)[number];

export const WEEKLY_REPORT_AI_FIELD_LABELS: Record<
  WeeklyReportAiFieldKey | "meeting_date",
  string
> = {
  za_meeting_team: "會議參與團隊",
  zb_key_focus: "本期重點關注事項",
  zc_completed_work: "本期已完成工作",
  zd_next_week_work: "下期工作",
  ze_additional_items: "後加項目 (需報價)",
  zf_urgent_client_confirm: "急需客人確定",
  zg_site_changes: "現場更改項目",
  zh_factors_affecting_handover: "影響交場日的因素",
  zi_overall_site_schedule: "整體工地時間表",
  zj_payment_schedule: "付款時間表",
  zk_appendix: "附錄",
  meeting_date: "會議日期",
};

export type WeeklyReportAiFields = Partial<
  Record<WeeklyReportAiFieldKey, string | null>
> & {
  meeting_date?: string | null;
};

export type WeeklyReportAiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type WeeklyReportAiParsed = {
  reply: string;
  fields: WeeklyReportAiFields;
};

const MAX_USER_NOTE_CHARS = 16_000;
const MAX_ASANA_CHARS = 18_000;
const MAX_HISTORY_MESSAGES = 8;

export function isWeeklyReportAiFieldKey(value: string): value is WeeklyReportAiFieldKey {
  return (WEEKLY_REPORT_AI_FIELD_KEYS as readonly string[]).includes(value);
}

export function isBlankRichText(value: string | null | undefined): boolean {
  if (!value) return true;
  const text = value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0;
}

export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("empty model output");
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("model output is not valid JSON");
  }
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseMeetingDate(value: unknown): string | null {
  const text = asNullableString(value);
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseWeeklyReportAiJson(raw: string): WeeklyReportAiParsed {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("model JSON must be an object");
  }

  const record = parsed as Record<string, unknown>;
  const fieldsSource =
    record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)
      ? (record.fields as Record<string, unknown>)
      : record;

  const fields: WeeklyReportAiFields = {};
  for (const key of WEEKLY_REPORT_AI_FIELD_KEYS) {
    const value = asNullableString(fieldsSource[key]);
    if (value) fields[key] = value;
  }

  const meetingDate = parseMeetingDate(fieldsSource.meeting_date ?? record.meeting_date);
  if (meetingDate) fields.meeting_date = meetingDate;

  const reply =
    asNullableString(record.reply) ||
    (Object.keys(fields).length > 0
      ? `已根據提供資料填入 ${Object.keys(fields)
          .map((key) => WEEKLY_REPORT_AI_FIELD_LABELS[key as keyof typeof WEEKLY_REPORT_AI_FIELD_LABELS])
          .join("、")}。`
      : "未能從目前資料判斷可填寫的欄位。請再補充會議筆記或確認 Asana 任務內容。");

  return { reply, fields };
}

export function applyWeeklyReportAiFields(
  current: Record<string, string>,
  incoming: WeeklyReportAiFields
): { next: Record<string, string>; filledKeys: string[] } {
  const next = { ...current };
  const filledKeys: string[] = [];

  for (const key of WEEKLY_REPORT_AI_FIELD_KEYS) {
    const value = incoming[key];
    if (!value || isBlankRichText(value)) continue;
    next[key] = value;
    filledKeys.push(key);
  }

  return { next, filledKeys };
}

export function buildWeeklyReportAiSystemPrompt(): string {
  return [
    "你是 Acme PMS 的工地會議報告助理，使用 xAI Grok。",
    "任務：閱讀用戶貼上的筆記／聊天紀錄，以及相關 Asana 任務內容，為「每10天工地會議報告」填寫欄位。",
    "只根據提供的資料歸納，不要虛構人名、日期、金額或未提及的工程進度。",
    "資料不足的欄位請省略（不要回空字串）。已有內容且你有新資料時，請合併保留原有事實。",
    "寫作：繁體中文、簡潔條列、香港工地會議語氣。人名保持原寫法。",
    "za_meeting_team：逗號分隔的人名純文字，不要 HTML。",
    "其餘 zb_ 至 zk_ 欄位：簡單 HTML，只用 <p>、<ul>、<ol>、<li>、<strong>、<br>、<em>。",
    "meeting_date：YYYY-MM-DD；無法判斷則省略。",
    "只回一個 JSON 物件，不要 markdown 圍欄，格式：",
    '{ "reply": "繁中短摘要，說明填了哪些欄位或為何沒填", "fields": { "za_meeting_team": "...", "zb_key_focus": "<p>...</p>", "meeting_date": "YYYY-MM-DD" } }',
    "fields 只包含有把握填寫的 key。",
  ].join("\n");
}

export function clipText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n…(已截斷)`;
}

export function buildWeeklyReportAiUserPayload(input: {
  projectName?: string | null;
  projectCode?: string | null;
  pmName?: string | null;
  designerName?: string | null;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  meetingDate?: string | null;
  currentFields: Record<string, string>;
  asanaText?: string | null;
  asanaWarning?: string | null;
}): string {
  const currentEntries = WEEKLY_REPORT_AI_FIELD_KEYS.map((key) => {
    const value = input.currentFields[key] ?? "";
    return `- ${WEEKLY_REPORT_AI_FIELD_LABELS[key]} (${key}): ${
      isBlankRichText(value) ? "（空白）" : clipText(value, 2_000)
    }`;
  }).join("\n");

  const asanaBlock = input.asanaText?.trim()
    ? clipText(input.asanaText.trim(), MAX_ASANA_CHARS)
    : "（沒有 Asana 任務內容）";

  return [
    "報告背景：",
    `- 項目：${input.projectName || "（未提供）"}`,
    `- 編號：${input.projectCode || "（未提供）"}`,
    `- PM：${input.pmName || "（未提供）"}`,
    `- 設計師：${input.designerName || "（未提供）"}`,
    `- 期數：第 ${input.weekNumber} 期（每期約 10 天）`,
    `- 本期日期：${input.weekStart} 至 ${input.weekEnd}`,
    `- 會議日期：${input.meetingDate || "（未填）"}`,
    "",
    "目前編輯器欄位：",
    currentEntries,
    "",
    input.asanaWarning ? `Asana 狀態：${input.asanaWarning}` : "",
    "Asana 相關內容：",
    asanaBlock,
    "",
    "請分析用戶訊息與以上資料，填寫適用欄位。",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildGrokMessages(input: {
  history: WeeklyReportAiChatMessage[];
  userNote: string;
  contextPayload: string;
}): { role: "system" | "user" | "assistant"; content: string }[] {
  const history = input.history.slice(-MAX_HISTORY_MESSAGES);
  const note = clipText(input.userNote.trim(), MAX_USER_NOTE_CHARS);
  const userContent = [
    input.contextPayload,
    "",
    "用戶提供的資料：",
    note || "（用戶今次沒有貼新內容，請只根據 Asana 與現有欄位分析。）",
  ].join("\n");

  return [
    { role: "system", content: buildWeeklyReportAiSystemPrompt() },
    ...history.map((message) => ({
      role: message.role,
      content: clipText(message.content, 8_000),
    })),
    { role: "user", content: userContent },
  ];
}

export function summarizeFilledFields(filledKeys: string[]): string {
  if (filledKeys.length === 0) return "沒有更新欄位";
  return filledKeys
    .map((key) => WEEKLY_REPORT_AI_FIELD_LABELS[key as keyof typeof WEEKLY_REPORT_AI_FIELD_LABELS] || key)
    .join("、");
}
