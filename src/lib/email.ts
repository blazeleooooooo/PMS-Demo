/**
 * Resend transactional email (server-side only).
 *
 * Required env (set in `.env.local`, never commit):
 * - RESEND_API_KEY — API key from https://resend.com/api-keys
 *
 * Optional:
 * - RESEND_FROM_EMAIL — default From, e.g. `PMS <noreply@example.com>`
 * - RESEND_REPLY_TO — reply address if From cannot receive mail
 */

import { Resend } from "resend";

const DEFAULT_FROM = "PMS <noreply@example.com>";

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

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  /** Format: `<event-type>/<entity-id>` — prevents duplicate sends on retry. */
  idempotencyKey?: string;
}

export interface SendEmailResult {
  id: string;
}

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigError";
  }
}

export class EmailApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "EmailApiError";
    this.status = status;
    this.details = details;
  }
}

function getResendClient(): Resend {
  const apiKey = envVar("RESEND_API_KEY");
  if (!apiKey) {
    throw new EmailConfigError(
      "Email is not configured. Set RESEND_API_KEY in .env.local."
    );
  }
  return new Resend(apiKey);
}

export function getDefaultFromAddress(): string {
  return envVar("RESEND_FROM_EMAIL") || DEFAULT_FROM;
}

function getDefaultReplyTo(): string[] | undefined {
  const replyTo = envVar("RESEND_REPLY_TO");
  return replyTo ? [replyTo] : undefined;
}

function normalizeAddressList(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value])
    .map((addr) => addr.trim())
    .filter(Boolean);
}

function normalizeRecipients(to: string | string[]): string[] {
  const list = normalizeAddressList(to);
  if (!list.length) {
    throw new Error("At least one recipient is required.");
  }
  return list;
}

function uniqueExtraRecipients(to: string[], extra: string[]): string[] {
  const toSet = new Set(to.map((addr) => addr.toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const addr of extra) {
    const key = addr.toLowerCase();
    if (toSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}

/**
 * Send one transactional email via Resend.
 * Always check `error` from the SDK — it does not throw on API failures.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = normalizeRecipients(input.to);
  const cc = uniqueExtraRecipients(to, normalizeAddressList(input.cc));
  const bcc = uniqueExtraRecipients(to, normalizeAddressList(input.bcc));
  const subject = input.subject.trim();
  const text = input.text.trim();
  const from = (input.from || getDefaultFromAddress()).trim();
  const replyTo = input.replyTo
    ? normalizeRecipients(input.replyTo)
    : getDefaultReplyTo();

  if (!subject) {
    throw new Error("Email subject is required.");
  }
  if (!text) {
    throw new Error("Email text body is required.");
  }
  if (!from) {
    throw new Error("From address is required.");
  }

  const resend = getResendClient();
  const { data, error } = await resend.emails.send(
    {
      from,
      to,
      subject,
      text,
      ...(input.html?.trim() ? { html: input.html } : {}),
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      ...(replyTo?.length ? { replyTo } : {}),
    },
    input.idempotencyKey
      ? { idempotencyKey: input.idempotencyKey.slice(0, 256) }
      : undefined
  );

  if (error) {
    throw new EmailApiError(error.statusCode ?? 502, error.message, error);
  }

  if (!data?.id) {
    throw new EmailApiError(502, "Resend returned no email id", data);
  }

  return { id: data.id };
}
