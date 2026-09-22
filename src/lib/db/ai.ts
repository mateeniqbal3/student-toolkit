/**
 * Typed accessors for the assistant's chat history, which never leaves the
 * device: only the message being sent goes to Google.
 */
import { db, type AiConversationRecord, type AiMessageRecord } from "./schema";

/** The first line of the first question, which is what a student recognises. */
export function conversationTitle(text: string): string {
  const line = text.trim().split("\n").find(Boolean) ?? "";
  return line.length > 60 ? `${line.slice(0, 59).trimEnd()}…` : line || "New chat";
}

export async function saveConversation(
  id: number | null,
  mode: string,
  messages: readonly AiMessageRecord[],
): Promise<number> {
  const now = Date.now();
  const first = messages.find((message) => message.role === "user");
  const record = {
    title: conversationTitle(first?.text ?? ""),
    mode,
    updatedAt: now,
    messages: [...messages],
  };
  if (id === null) return db.aiConversations.add({ ...record, createdAt: now });
  await db.aiConversations.update(id, record);
  return id;
}

export async function deleteConversation(id: number): Promise<void> {
  await db.aiConversations.delete(id);
}

export async function clearConversations(): Promise<void> {
  await db.aiConversations.clear();
}

export type { AiConversationRecord, AiMessageRecord };
