export class GrokConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrokConfigError";
  }
}

export class GrokApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GrokApiError";
    this.status = status;
  }
}

export type GrokChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function getGrokConfig(): {
  apiKey: string;
  model: string;
  baseUrl: string;
  reasoningEffort: string;
} {
  const apiKey = process.env.XAI_API_KEY?.trim() || "";
  if (!apiKey) {
    throw new GrokConfigError(
      "尚未設定 XAI_API_KEY。請在 .env.local 加入 xAI API key，然後在 IDE 終端重啟 npm run dev。"
    );
  }

  return {
    apiKey,
    model: process.env.GROK_MODEL?.trim() || "grok-4.6",
    baseUrl: (process.env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1").replace(/\/$/, ""),
    reasoningEffort: process.env.GROK_REASONING_EFFORT?.trim() || "low",
  };
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

/**
 * Stateless Grok chat via xAI Chat Completions (OpenAI-compatible).
 * Returns the assistant text. Prefer JSON in the system prompt and parse locally.
 */
export async function grokChatCompletion(
  messages: GrokChatMessage[],
  options?: { timeoutMs?: number; jsonObject?: boolean }
): Promise<string> {
  const { apiKey, model, baseUrl, reasoningEffort } = getGrokConfig();
  const timeoutMs = options?.timeoutMs ?? 150_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const requestOnce = async (jsonObject: boolean, withReasoning: boolean) => {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      temperature: 0.2,
      max_tokens: 2500,
    };
    if (jsonObject) {
      body.response_format = { type: "json_object" };
    }
    if (withReasoning && reasoningEffort) {
      body.reasoning_effort = reasoningEffort;
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await res.text();
    let parsed: ChatCompletionResponse | null = null;
    try {
      parsed = raw ? (JSON.parse(raw) as ChatCompletionResponse) : null;
    } catch {
      parsed = null;
    }
    return { res, raw, parsed };
  };

  try {
    const useJson = options?.jsonObject !== false;
    let { res, raw, parsed } = await requestOnce(useJson, true);
    if (!res.ok && res.status === 400) {
      ({ res, raw, parsed } = await requestOnce(false, false));
    }

    if (!res.ok) {
      const apiMessage = parsed?.error?.message?.trim();
      throw new GrokApiError(
        res.status,
        apiMessage || `Grok 呼叫失敗 (${res.status}): ${raw.slice(0, 240)}`
      );
    }

    const content = parsed?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      throw new GrokApiError(502, "Grok 沒有回傳可用內容。");
    }
    return content;
  } catch (error) {
    if (error instanceof GrokApiError || error instanceof GrokConfigError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new GrokApiError(504, "Grok 回應逾時，請稍後再試。");
    }
    throw new GrokApiError(
      502,
      error instanceof Error ? error.message : "Grok 呼叫失敗"
    );
  } finally {
    clearTimeout(timer);
  }
}
