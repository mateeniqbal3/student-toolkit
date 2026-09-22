"use client";

import { useCallback, useRef, useState } from "react";

import { AiError, streamReply } from "@/lib/ai/gemini";
import { getMode, type AiModeId } from "@/lib/ai/modes";
import { MAX_OUTPUT_TOKENS, thinkingBudgetFor } from "@/lib/ai/models";
import { saveConversation, type AiConversationRecord, type AiMessageRecord } from "@/lib/db/ai";

import { aiErrorDetail, aiErrorMessage } from "./messages";

export interface ChatError {
  message: string;
  detail?: string;
}

export interface Chat {
  /** The row this conversation is saved as, once it has been. */
  id: number | null;
  mode: AiModeId;
  messages: AiMessageRecord[];
}

function empty(mode: AiModeId): Chat {
  return { id: null, mode, messages: [] };
}

/**
 * One conversation: sending, streaming, stopping, and saving to the device
 * once an answer lands.
 *
 * The answer being streamed is held apart from the message list until it is
 * finished. A stopped answer is kept — half an explanation is still worth
 * reading — while a failed one leaves the question in place to try again.
 */
export function useChat(key: string, model: string, initialMode: AiModeId) {
  const [chat, setChat] = useState<Chat>(() => empty(initialMode));
  const [partial, setPartial] = useState<string | null>(null);
  const [error, setError] = useState<ChatError | null>(null);
  const abort = useRef<AbortController | null>(null);

  const finish = useCallback(async (next: Chat) => {
    setChat(next);
    try {
      const id = await saveConversation(next.id, next.mode, next.messages);
      setChat((current) => (current.id === null ? { ...current, id } : current));
    } catch {
      // History is a convenience; failing to save it must not lose the answer.
    }
  }, []);

  const run = useCallback(
    async (chatSoFar: Chat) => {
      const controller = new AbortController();
      abort.current = controller;
      setError(null);
      setPartial("");

      const mode = getMode(chatSoFar.mode);
      let answer = "";

      try {
        await streamReply(
          key,
          chatSoFar.messages.map((message) => ({ role: message.role, text: message.text })),
          {
            model,
            systemInstruction: mode.systemInstruction,
            thinkingBudget: thinkingBudgetFor(model, mode.thinkingBudget),
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
          {
            signal: controller.signal,
            onText: (text) => {
              answer += text;
              setPartial(answer);
            },
          },
        );
      } catch (problem) {
        setPartial(null);
        const stopped = problem instanceof AiError && problem.reason === "cancelled";
        if (!stopped) {
          setError({ message: aiErrorMessage(problem), detail: aiErrorDetail(problem) });
        }
        if (stopped && answer.trim()) {
          await finish({
            ...chatSoFar,
            messages: [...chatSoFar.messages, { role: "model", text: answer, at: Date.now() }],
          });
        } else {
          setChat(chatSoFar);
        }
        return;
      }

      setPartial(null);
      await finish({
        ...chatSoFar,
        messages: [...chatSoFar.messages, { role: "model", text: answer, at: Date.now() }],
      });
    },
    [key, model, finish],
  );

  const send = useCallback(
    async (text: string, mode: AiModeId) => {
      const trimmed = text.trim();
      if (!trimmed || partial !== null) return;
      const next: Chat = {
        ...chat,
        mode,
        messages: [...chat.messages, { role: "user", text: trimmed, at: Date.now() }],
      };
      setChat(next);
      await run(next);
    },
    [chat, partial, run],
  );

  /** Drops the last answer and asks the same question again. */
  const regenerate = useCallback(async () => {
    if (partial !== null) return;
    const messages = [...chat.messages];
    while (messages[messages.length - 1]?.role === "model") messages.pop();
    if (messages.length === 0) return;
    const next = { ...chat, messages };
    setChat(next);
    await run(next);
  }, [chat, partial, run]);

  const stop = useCallback(() => abort.current?.abort(), []);

  const startNew = useCallback((mode: AiModeId) => {
    abort.current?.abort();
    setPartial(null);
    setError(null);
    setChat(empty(mode));
  }, []);

  const open = useCallback((record: AiConversationRecord) => {
    abort.current?.abort();
    setPartial(null);
    setError(null);
    setChat({
      id: record.id,
      mode: getMode(record.mode).id,
      messages: [...record.messages],
    });
  }, []);

  return {
    chat,
    partial,
    error,
    streaming: partial !== null,
    send,
    stop,
    regenerate,
    startNew,
    open,
    dismissError: useCallback(() => setError(null), []),
  };
}
