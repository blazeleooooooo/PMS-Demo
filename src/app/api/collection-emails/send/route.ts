import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidEmailAddress } from "@/lib/collection-email-groups";
import {
  EmailApiError,
  EmailConfigError,
  sendEmail,
} from "@/lib/email";

export const dynamic = "force-dynamic";

function asEmailList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((addr): addr is string => typeof addr === "string" && addr.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

/**
 * POST /api/collection-emails/send
 * Body: { to, bcc?, subject, text, html? }
 */
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

  const { to, bcc, subject, text, html, idempotencyKey } = payload as {
    to?: unknown;
    bcc?: unknown;
    subject?: unknown;
    text?: unknown;
    html?: unknown;
    idempotencyKey?: unknown;
  };

  const recipients = asEmailList(to);
  const bccList = asEmailList(bcc);

  if (!recipients.length || recipients.some((addr) => !isValidEmailAddress(addr))) {
    return NextResponse.json(
      { error: "Missing or invalid `to` email address." },
      { status: 400 }
    );
  }

  if (typeof subject !== "string" || !subject.trim()) {
    return NextResponse.json(
      { error: "Missing or invalid `subject`." },
      { status: 400 }
    );
  }

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: "Missing or invalid `text` body." },
      { status: 400 }
    );
  }

  try {
    const result = await sendEmail({
      to: recipients,
      bcc: bccList,
      subject,
      text,
      html: typeof html === "string" ? html : undefined,
      idempotencyKey:
        typeof idempotencyKey === "string" ? idempotencyKey : undefined,
    });

    return NextResponse.json({
      success: true,
      to: recipients,
      bcc: bccList,
      id: result.id,
    });
  } catch (error: unknown) {
    if (error instanceof EmailConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof EmailApiError) {
      console.error("[api/collection-emails/send]", error.message, error.details);
      return NextResponse.json(
        {
          error: error.message,
          details: error.details ?? null,
        },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to send email";
    console.error("[api/collection-emails/send]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
