import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeWhatsAppPhone,
  sendWhatsAppTextMessage,
  WhatsAppApiError,
  WhatsAppConfigError,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * POST /api/whatsapp/send
 * Body: { to: string, text: string }
 *
 * Requires a logged-in PMS session. Secrets stay server-side
 * (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, optional
 * WHATSAPP_BUSINESS_ACCOUNT_ID / WHATSAPP_API_VERSION).
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

  const { to, text } = payload as { to?: unknown; text?: unknown };

  if (typeof to !== "string" || !to.trim()) {
    return NextResponse.json(
      { error: "Missing or invalid `to` phone number." },
      { status: 400 }
    );
  }

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: "Missing or invalid `text` message body." },
      { status: 400 }
    );
  }

  const normalizedTo = normalizeWhatsAppPhone(to);
  if (!normalizedTo) {
    return NextResponse.json(
      { error: "Phone number must contain digits (E.164 without +)." },
      { status: 400 }
    );
  }

  try {
    const result = await sendWhatsAppTextMessage({
      to: normalizedTo,
      body: text,
    });

    return NextResponse.json({
      success: true,
      to: normalizedTo,
      messageId: result.messageId,
      contacts: result.contacts ?? null,
    });
  } catch (error: unknown) {
    if (error instanceof WhatsAppConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof WhatsAppApiError) {
      console.error("[api/whatsapp/send]", error.message, error.details);
      return NextResponse.json(
        {
          error: error.message,
          details: error.details ?? null,
        },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to send WhatsApp message";
    console.error("[api/whatsapp/send]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
