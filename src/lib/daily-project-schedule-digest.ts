/** Meta UTILITY template — must be APPROVED on the WABA before production use. */
export const DAILY_PROJECT_SCHEDULE_TEMPLATE = {
  name: "daily_project_schedule",
  language: "zh_HK",
} as const;

/** WhatsApp body parameter cap. */
export const WA_BODY_PARAM_MAX = 1024;

/**
 * Cloud API rejects `\n` / `\t` in template parameters.
 * `\r` is the line break we send inside {{3}} (verify on a test handset).
 */
export const TASK_LINE_SEP = "\r";
export const TASK_BLOCK_SEP = "\r\r";

const OMITTED_SUFFIX = (n: number) => `…及其他 ${n} 項`;

export type DailyScheduleTaskInput = {
  taskDisplay: string | null;
  districtName: string | null;
  districtChinese: string | null;
  realDistrictName?: string | null;
  projectName: string | null;
  projectCode: string | null;
};

export function hongKongTodayYmd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function hongKongDayUtcBounds(ymd: string): { startIso: string; endIso: string } {
  return {
    startIso: `${ymd}T00:00:00+08:00`,
    endIso: `${addOneDayYmd(ymd)}T00:00:00+08:00`,
  };
}

function addOneDayYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const yyyy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** `[SM 沙田石門]` or `[紅磡]` — lookup name + Chinese, else `real_district_name`. */
export function formatDistrictLabel(
  name: string | null | undefined,
  chinese: string | null | undefined,
  realDistrictName?: string | null
): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const raw of [name, chinese]) {
    const value = (raw || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(value);
  }
  if (parts.length > 0) return `[${parts.join(" ")}]`;
  const fallback = (realDistrictName || "").trim();
  return fallback ? `[${fallback}]` : "";
}

export function formatProjectLine(
  districtLabel: string,
  projectName: string | null | undefined
): string {
  const name = (projectName || "").trim();
  if (districtLabel && name) return `${districtLabel} ${name}`;
  return districtLabel || name || "—";
}

export function formatIncomeDigestTaskDisplay(input: {
  usingExpected: boolean;
  contractTypeName?: string | null;
  invoiceNumber?: string | null;
}): string {
  const parts = [input.usingExpected ? "預計收款" : "待收款"];
  const contract = (input.contractTypeName || "").trim();
  if (contract) parts.push(contract);
  const invoice = (input.invoiceNumber || "").trim();
  if (invoice) parts.push(`第${invoice}期`);
  return parts.join(" · ");
}

export function formatTaskBlock(input: DailyScheduleTaskInput): string {
  const task = (input.taskDisplay || "").trim() || "日程";
  const district = formatDistrictLabel(
    input.districtName,
    input.districtChinese,
    input.realDistrictName
  );
  const projectLine = formatProjectLine(district, input.projectName);
  const code = (input.projectCode || "").trim() || "—";
  return [task, projectLine, code].join(TASK_LINE_SEP);
}

function sanitizeParamText(text: string): string {
  return text.replace(/\t/g, " ").replace(/ {5,}/g, "    ");
}

/**
 * Join task blocks with a blank line (`\r\r`). Truncate to 1024 chars,
 * keeping whole blocks and appending “及其他 N 項” when needed.
 */
export function joinTaskBlocks(blocks: string[]): {
  digest: string;
  includedCount: number;
  omittedCount: number;
} {
  const cleaned = blocks
    .map((b) => sanitizeParamText(b.trim()))
    .filter(Boolean);
  if (cleaned.length === 0) {
    return { digest: "—", includedCount: 0, omittedCount: 0 };
  }

  const included: string[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const remaining = cleaned.length - (i + 1);
    const candidate = [...included, cleaned[i]];
    let digest = candidate.join(TASK_BLOCK_SEP);
    if (remaining > 0) {
      const withOmit = digest + TASK_BLOCK_SEP + OMITTED_SUFFIX(remaining);
      if (withOmit.length > WA_BODY_PARAM_MAX) {
        if (included.length === 0) {
          const suffix = TASK_BLOCK_SEP + OMITTED_SUFFIX(cleaned.length - 1);
          const room = WA_BODY_PARAM_MAX - suffix.length;
          digest =
            (room > 8 ? cleaned[0].slice(0, room) : cleaned[0].slice(0, 8)) +
            suffix;
          return {
            digest,
            includedCount: 1,
            omittedCount: cleaned.length - 1,
          };
        }
        const omitted = cleaned.length - included.length;
        return {
          digest: included.join(TASK_BLOCK_SEP) + TASK_BLOCK_SEP + OMITTED_SUFFIX(omitted),
          includedCount: included.length,
          omittedCount: omitted,
        };
      }
    }
    if (digest.length > WA_BODY_PARAM_MAX) {
      if (included.length === 0) {
        return {
          digest: cleaned[0].slice(0, WA_BODY_PARAM_MAX),
          includedCount: 1,
          omittedCount: cleaned.length - 1,
        };
      }
      const omitted = cleaned.length - included.length;
      return {
        digest: included.join(TASK_BLOCK_SEP) + TASK_BLOCK_SEP + OMITTED_SUFFIX(omitted),
        includedCount: included.length,
        omittedCount: omitted,
      };
    }
    included.push(cleaned[i]);
  }

  return {
    digest: included.join(TASK_BLOCK_SEP),
    includedCount: included.length,
    omittedCount: 0,
  };
}

export function inAppDigestFromBlocks(blocks: string[]): string {
  return blocks
    .map((b) => b.split(TASK_LINE_SEP).join("\n"))
    .join("\n\n");
}
