/**
 * The Gemini client: plain `fetch` against the REST API, no SDK.
 *
 * The student's own key goes straight from their browser to Google, so this
 * app runs no server and stores no key. Everything here is pure enough to
 * test with a fake `fetch`.
 */

export const GEMINI_ORIGIN = "https://generativelanguage.googleapis.com";
const API = `${GEMINI_ORIGIN}/v1beta`;

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface GenerateOptions {
  model: string;
  systemInstruction?: string;
  /**
   * Tokens the model may spend thinking before answering. Zero for quick
   * answers; a budget for working a problem through.
   */
  thinkingBudget: number;
  maxOutputTokens: number;
}

/** The request body, exactly as the REST API expects it. */
export function buildRequest(messages: readonly ChatMessage[], options: GenerateOptions) {
  return {
    contents: messages.map((message) => ({
      role: message.role,
      parts: [{ text: message.text }],
    })),
    ...(options.systemInstruction
      ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } }
      : {}),
    generationConfig: {
      maxOutputTokens: options.maxOutputTokens,
      thinkingConfig: { thinkingBudget: options.thinkingBudget },
    },
  };
}

export type AiErrorReason =
  "no-key" | "bad-key" | "quota" | "busy" | "blocked" | "offline" | "cancelled" | "failed";

export class AiError extends Error {
  constructor(
    readonly reason: AiErrorReason,
    /** Google's own words, when it gave any, for the details line. */
    readonly detail?: string,
  ) {
    super(reason);
    this.name = "AiError";
  }
}

/**
 * Maps a failed request onto what the student can do about it.
 *
 * A 400 is usually a key Google will not accept, but it is also what comes
 * back when a request is malformed, so the message decides. Telling someone
 * their key is wrong when it is not sends them off to fix the wrong thing.
 */
export function reasonForStatus(status: number, detail?: string): AiErrorReason {
  if (status === 401 || status === 403) return "bad-key";
  if (status === 400)
    return /api[_ ]?key|credential|unauthenticated/i.test(detail ?? "") ? "bad-key" : "failed";
  if (status === 429) return "quota";
  if (status >= 500) return "busy";
  return "failed";
}

function errorDetail(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof parsed.error === "object" &&
      parsed.error !== null &&
      "message" in parsed.error &&
      typeof parsed.error.message === "string"
    ) {
      return parsed.error.message;
    }
  } catch {
    // Not JSON; the status alone will have to do.
  }
  return undefined;
}

export interface SseParser {
  /** The payloads completed by this chunk. */
  push: (chunk: string) => string[];
  /**
   * Whatever is left when the stream closes. The last event does not always
   * end with a blank line, and without this its text — the end of the
   * answer — would be dropped.
   */
  flush: () => string[];
}

function dataLines(block: string): string[] {
  const payloads: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("data:")) payloads.push(line.slice(5).trim());
  }
  return payloads;
}

/**
 * Splits an SSE body into the JSON payload of each `data:` line, across
 * chunk boundaries: one event often arrives in two reads.
 */
export function createSseParser(): SseParser {
  let buffer = "";
  return {
    push(chunk: string) {
      buffer += chunk;
      // Events are separated by a blank line; keep the last, possibly partial, one.
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      return events.flatMap(dataLines);
    },
    flush() {
      const rest = buffer;
      buffer = "";
      return dataLines(rest);
    },
  };
}

/** The text of one streamed chunk, if it carried any. */
export function textFromChunk(payload: string): string {
  if (!payload || payload === "[DONE]") return "";
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== "object" || parsed === null) return "";
    const candidates = (parsed as { candidates?: unknown }).candidates;
    if (!Array.isArray(candidates)) return "";
    let text = "";
    for (const candidate of candidates) {
      const parts = (candidate as { content?: { parts?: unknown } }).content?.parts;
      if (!Array.isArray(parts)) continue;
      for (const part of parts) {
        const value = (part as { text?: unknown }).text;
        if (typeof value === "string") text += value;
      }
    }
    return text;
  } catch {
    return "";
  }
}

/** Why a response stopped, when it was not simply finished. */
export function blockedReason(payload: string): string | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    const feedback = (parsed as { promptFeedback?: { blockReason?: unknown } }).promptFeedback;
    if (feedback && typeof feedback.blockReason === "string") return feedback.blockReason;
    const candidates = (parsed as { candidates?: { finishReason?: unknown }[] }).candidates;
    const finish = candidates?.[0]?.finishReason;
    if (typeof finish === "string" && finish !== "STOP" && finish !== "MAX_TOKENS") return finish;
    return null;
  } catch {
    return null;
  }
}

export interface StreamHandlers {
  onText: (text: string) => void;
  signal?: AbortSignal;
  /** Swapped for a fake in tests. */
  fetchImpl?: typeof fetch;
}

/** Google's servers are sometimes briefly overloaded; a retry usually lands. */
const RETRY_DELAYS_MS = [400, 1200];

async function requestStream(
  url: string,
  key: string,
  body: unknown,
  handlers: StreamHandlers,
): Promise<Response> {
  const doFetch = handlers.fetchImpl ?? fetch;
  let lastError: AiError | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    let response: Response;
    try {
      response = await doFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: handlers.signal,
      });
    } catch (error) {
      if (handlers.signal?.aborted) throw new AiError("cancelled");
      throw new AiError("offline", error instanceof Error ? error.message : undefined);
    }

    if (response.ok) return response;

    const detail = errorDetail(await response.text().catch(() => ""));
    const reason = reasonForStatus(response.status, detail);
    lastError = new AiError(reason, detail);
    if (reason !== "busy") throw lastError;

    const delay = RETRY_DELAYS_MS[attempt];
    if (delay === undefined) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (handlers.signal?.aborted) throw new AiError("cancelled");
  }

  throw lastError ?? new AiError("failed");
}

/**
 * Streams an answer, calling `onText` with each piece as it arrives.
 * Returns the whole answer.
 */
export async function streamReply(
  key: string,
  messages: readonly ChatMessage[],
  options: GenerateOptions,
  handlers: StreamHandlers,
): Promise<string> {
  if (!key.trim()) throw new AiError("no-key");

  const url = `${API}/models/${encodeURIComponent(options.model)}:streamGenerateContent?alt=sse`;
  const response = await requestStream(url, key, buildRequest(messages, options), handlers);

  const body = response.body;
  if (!body) throw new AiError("failed");

  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  const parse = createSseParser();
  let answer = "";
  let blocked: string | null = null;

  const take = (payloads: string[]) => {
    for (const payload of payloads) {
      const text = textFromChunk(payload);
      if (text) {
        answer += text;
        handlers.onText(text);
      }
      blocked ??= blockedReason(payload);
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      take(parse.push(value));
    }
    take(parse.flush());
  } catch (error) {
    if (handlers.signal?.aborted) throw new AiError("cancelled");
    throw new AiError("failed", error instanceof Error ? error.message : undefined);
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  if (!answer.trim() && blocked) throw new AiError("blocked", blocked);
  return answer;
}

/**
 * Checks a key by asking for the model list, which costs no tokens. Used
 * when the key is first entered, so a typo is caught there and then.
 */
export async function checkKey(key: string, fetchImpl?: typeof fetch): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new AiError("no-key");
  let response: Response;
  try {
    response = await (fetchImpl ?? fetch)(`${API}/models?pageSize=1`, {
      headers: { "x-goog-api-key": trimmed },
    });
  } catch (error) {
    throw new AiError("offline", error instanceof Error ? error.message : undefined);
  }
  if (!response.ok) {
    const detail = errorDetail(await response.text().catch(() => ""));
    throw new AiError(reasonForStatus(response.status, detail), detail);
  }
}
