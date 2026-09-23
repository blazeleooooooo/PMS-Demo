/**
 * Meta WhatsApp Cloud API (server-side only).
 *
 * Required env (set in `.env.local`, never commit / never log values):
 * - WHATSAPP_ACCESS_TOKEN — System User token
 * - WHATSAPP_PHONE_NUMBER_ID — Cloud API phone number id
 * - WHATSAPP_BUSINESS_ACCOUNT_ID — WABA ID (templates)
 * - WHATSAPP_API_VERSION — optional, default `v25.0`
 *
 * `getWhatsAppConfig` reads `process.env[name]` dynamically (avoids Next.js
 * build-time inlining of missing keys) and falls back to `.env.local` on disk.
 */

export interface WhatsAppSendTextInput {
  /** Digits-only E.164 without leading `+` (e.g. `85291234567`) */
  to: string;
  body: string;
}

export interface WhatsAppSendTextResult {
  messageId: string;
  contacts?: Array<{ input?: string; wa_id?: string }>;
}

export class WhatsAppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppConfigError";
  }
}

export class WhatsAppApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "WhatsAppApiError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Digits-only E.164 without `+`. Hong Kong 8-digit local numbers get `852`.
 * Numbers that already include `852` (11+ digits) are left unchanged.
 */
export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("852") && digits.length >= 11) return digits;
  if (digits.length === 8) return `852${digits}`;
  return digits;
}

/** Parse KEY=value lines. Exported for tests — never pass real secret files into tests. */
export function parseDotEnv(contents: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

let envLocalCache: Record<string, string> | null = null;

function readEnvLocalFile(): Record<string, string> {
  if (envLocalCache) return envLocalCache;
  envLocalCache = {};
  if (typeof window !== "undefined") return envLocalCache;
  try {
    // Lazy require so client/test imports of normalizeWhatsAppPhone stay light.
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const file = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(file)) return envLocalCache;
    envLocalCache = parseDotEnv(fs.readFileSync(file, "utf8"));
  } catch {
    envLocalCache = {};
  }
  return envLocalCache;
}

function envVar(name: string): string {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  return readEnvLocalFile()[name]?.trim() || "";
}

function getWhatsAppConfig(): {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
} {
  const accessToken = envVar("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = envVar("WHATSAPP_PHONE_NUMBER_ID");
  const apiVersion = envVar("WHATSAPP_API_VERSION") || "v25.0";

  if (!accessToken || !phoneNumberId) {
    throw new WhatsAppConfigError(
      "WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env.local (or the host env)."
    );
  }

  return { accessToken, phoneNumberId, apiVersion };
}

/**
 * Send a plain text WhatsApp message via Cloud API.
 * In Development mode the recipient must be on the Meta allowlist.
 */
export interface WhatsAppTemplateBodyParam {
  type: "text";
  text: string;
}

export interface WhatsAppSendTemplateInput {
  /** Digits-only E.164 without leading `+` (e.g. `85291234567`) */
  to: string;
  /** Approved template name on the WABA */
  templateName: string;
  /** Language code, e.g. zh_HK or en_US */
  languageCode?: string;
  /** Ordered body parameters matching {{1}}, {{2}}, … */
  bodyParameters?: WhatsAppTemplateBodyParam[];
}

/**
 * Send a Meta-approved WhatsApp message template (required for business-initiated alerts).
 */
export async function sendWhatsAppTemplateMessage(
  input: WhatsAppSendTemplateInput
): Promise<WhatsAppSendTextResult> {
  const to = normalizeWhatsAppPhone(input.to);
  const templateName = input.templateName.trim();
  const languageCode = (input.languageCode || "zh_HK").trim();

  if (!to) {
    throw new Error("Recipient phone number is required.");
  }
  if (!templateName) {
    throw new Error("Template name is required.");
  }

  const { accessToken, phoneNumberId, apiVersion } = getWhatsAppConfig();
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const components: Array<{
    type: string;
    parameters: WhatsAppTemplateBodyParam[];
  }> = [];
  if (input.bodyParameters?.length) {
    components.push({
      type: "body",
      parameters: input.bodyParameters.map((p) => ({
        type: "text",
        text: String(p.text ?? "").slice(0, 1024) || "-",
      })),
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length ? { components } : {}),
      },
    }),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as
    | {
        messages?: Array<{ id?: string }>;
        contacts?: Array<{ input?: string; wa_id?: string }>;
        error?: { message?: string; type?: string; code?: number };
      }
    | null;

  if (!res.ok) {
    const message =
      json?.error?.message ||
      `WhatsApp API request failed (${res.status})`;
    throw new WhatsAppApiError(res.status, message, json?.error ?? json);
  }

  const messageId = json?.messages?.[0]?.id;
  if (!messageId) {
    throw new WhatsAppApiError(
      res.status,
      "WhatsApp API returned no message id",
      json
    );
  }

  return {
    messageId,
    contacts: json?.contacts,
  };
}

export async function sendWhatsAppTextMessage(
  input: WhatsAppSendTextInput
): Promise<WhatsAppSendTextResult> {
  const to = normalizeWhatsAppPhone(input.to);
  const body = input.body.trim();

  if (!to) {
    throw new Error("Recipient phone number is required.");
  }
  if (!body) {
    throw new Error("Message text is required.");
  }

  const { accessToken, phoneNumberId, apiVersion } = getWhatsAppConfig();
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body,
      },
    }),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as
    | {
        messages?: Array<{ id?: string }>;
        contacts?: Array<{ input?: string; wa_id?: string }>;
        error?: { message?: string; type?: string; code?: number };
      }
    | null;

  if (!res.ok) {
    const message =
      json?.error?.message ||
      `WhatsApp API request failed (${res.status})`;
    throw new WhatsAppApiError(res.status, message, json?.error ?? json);
  }

  const messageId = json?.messages?.[0]?.id;
  if (!messageId) {
    throw new WhatsAppApiError(
      res.status,
      "WhatsApp API returned no message id",
      json
    );
  }

  return {
    messageId,
    contacts: json?.contacts,
  };
}
