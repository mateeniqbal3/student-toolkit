import { describe, expect, it, vi } from "vitest";

import {
  AiError,
  blockedReason,
  buildRequest,
  checkKey,
  createSseParser,
  reasonForStatus,
  streamReply,
  textFromChunk,
} from "./gemini";

function sse(...chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

function chunk(text: string): string {
  return `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }], role: "model" } }] })}\n\n`;
}

describe("buildRequest", () => {
  it("sends the turns, the system instruction and the limits", () => {
    const body = buildRequest([{ role: "user", text: "hi" }], {
      model: "gemini-3.6-flash",
      systemInstruction: "Be brief.",
      thinkingBudget: 0,
      maxOutputTokens: 4096,
    });
    expect(body).toEqual({
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
      systemInstruction: { parts: [{ text: "Be brief." }] },
      generationConfig: { maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
    });
  });
});

describe("reading the stream", () => {
  it("joins events split across chunk boundaries", () => {
    const parse = createSseParser();
    expect(parse.push('data: {"a":')).toEqual([]);
    expect(parse.push('1}\n\ndata: {"b":2}\n\n')).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("keeps a last event that arrives without a trailing blank line", () => {
    const parse = createSseParser();
    expect(parse.push('data: {"a":1}\n\ndata: {"end":true}')).toEqual(['{"a":1}']);
    expect(parse.flush()).toEqual(['{"end":true}']);
  });

  it("takes the text out of a chunk, and ignores the rest", () => {
    expect(textFromChunk(chunk("hello").slice(6))).toBe("hello");
    expect(textFromChunk("[DONE]")).toBe("");
    expect(textFromChunk("not json")).toBe("");
    expect(textFromChunk(JSON.stringify({ usageMetadata: { totalTokenCount: 3 } }))).toBe("");
  });

  it("notices a blocked prompt or an unusual ending", () => {
    expect(blockedReason(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }))).toBe(
      "SAFETY",
    );
    expect(blockedReason(JSON.stringify({ candidates: [{ finishReason: "SAFETY" }] }))).toBe(
      "SAFETY",
    );
    expect(blockedReason(JSON.stringify({ candidates: [{ finishReason: "STOP" }] }))).toBeNull();
  });
});

const OPTIONS = {
  model: "gemini-3.6-flash",
  thinkingBudget: 0,
  maxOutputTokens: 100,
};

describe("streamReply", () => {
  it("streams the answer piece by piece, including a tail with no blank line after it", async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async () =>
      // The last event ends the body immediately, as Google's does.
      sse(chunk("Photo"), chunk("synthesis").trimEnd()),
    );
    const answer = await streamReply("key", [{ role: "user", text: "q" }], OPTIONS, {
      onText: (text) => seen.push(text),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(seen).toEqual(["Photo", "synthesis"]);
    expect(answer).toBe("Photosynthesis");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("gemini-3.6-flash:streamGenerateContent?alt=sse");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("key");
  });

  it("refuses to send an empty key", async () => {
    await expect(
      streamReply("  ", [{ role: "user", text: "q" }], OPTIONS, { onText: () => {} }),
    ).rejects.toEqual(new AiError("no-key"));
  });

  it("calls a rejected key what it is, and does not retry", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 }),
    );
    await expect(
      streamReply("bad", [{ role: "user", text: "q" }], OPTIONS, {
        onText: () => {},
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ reason: "bad-key", detail: "API key not valid" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries while Google is busy, then gives up", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(async () => new Response("{}", { status: 503 }));
      const attempt = streamReply("key", [{ role: "user", text: "q" }], OPTIONS, {
        onText: () => {},
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      const assertion = expect(attempt).rejects.toMatchObject({ reason: "busy" });
      await vi.runAllTimersAsync();
      await assertion;
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("succeeds on a retry after a busy moment", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 503 }))
        .mockResolvedValueOnce(sse(chunk("ok")));
      const attempt = streamReply("key", [{ role: "user", text: "q" }], OPTIONS, {
        onText: () => {},
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      await vi.runAllTimersAsync();
      await expect(attempt).resolves.toBe("ok");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a lost connection as being offline", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      streamReply("key", [{ role: "user", text: "q" }], OPTIONS, {
        onText: () => {},
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ reason: "offline" });
  });

  it("says when an answer was blocked rather than returning nothing", async () => {
    const fetchImpl = vi.fn(async () =>
      sse(`data: ${JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } })}\n\n`),
    );
    await expect(
      streamReply("key", [{ role: "user", text: "q" }], OPTIONS, {
        onText: () => {},
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ reason: "blocked", detail: "SAFETY" });
  });

  it("treats an aborted request as cancelled, not as an error", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    await expect(
      streamReply("key", [{ role: "user", text: "q" }], OPTIONS, {
        onText: () => {},
        signal: controller.signal,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toEqual(new AiError("cancelled"));
  });
});

describe("reasonForStatus", () => {
  it("maps what Google returns onto what the student can do", () => {
    expect(reasonForStatus(400, "API key not valid. Please pass a valid API key.")).toBe("bad-key");
    expect(reasonForStatus(403, "Permission denied")).toBe("bad-key");
    expect(reasonForStatus(429, "Quota exceeded")).toBe("quota");
    expect(reasonForStatus(503, "overloaded")).toBe("busy");
    expect(reasonForStatus(418, "")).toBe("failed");
  });

  it("does not blame the key for a request Google could not read", () => {
    // What gemini-3.5-flash-lite returns when asked for no thinking at all.
    expect(reasonForStatus(400, "Request contains an invalid argument.")).toBe("failed");
  });
});

describe("checkKey", () => {
  it("asks for the model list, which costs no tokens", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await checkKey("key", fetchImpl as unknown as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/models?pageSize=1");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("key");
  });

  it("rejects an empty or refused key", async () => {
    await expect(checkKey(" ")).rejects.toEqual(new AiError("no-key"));
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 }),
    );
    await expect(checkKey("nope", fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
      reason: "bad-key",
    });
  });
});
