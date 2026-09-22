"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, ArrowUp, Plus, Square, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";

import { ChoiceGroup } from "@/components/choice-group";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { parseGeneratedCards } from "@/lib/ai/cards";
import { AI_MODES, MODES, getMode, type AiModeId } from "@/lib/ai/modes";
import { resolveModel } from "@/lib/ai/models";
import { db } from "@/lib/db/schema";

import { ChatView } from "./chat-view";
import { HistoryPanel } from "./history-panel";
import { KeyGate } from "./key-gate";
import { SettingsPanel } from "./settings-panel";
import { useChat } from "./use-chat";

export const KEY_STORAGE = "toolkit:ai:key";
export const MODEL_STORAGE = "toolkit:ai:model";
const MODE_STORAGE = "toolkit:ai:mode";

const MODE_OPTIONS = AI_MODES.map((id) => ({ value: id, label: MODES[id].label }));

export function AiAssistant() {
  const [key, setKey] = useLocalStorage(KEY_STORAGE, "");
  const [storedModel, setModel] = useLocalStorage(MODEL_STORAGE, "");
  const [storedMode, setMode] = useLocalStorage(MODE_STORAGE, "explain");
  const model = resolveModel(storedModel);
  const mode = getMode(storedMode).id;

  const [draft, setDraft] = useState("");
  const chat = useChat(key, model, mode);
  const conversations = useLiveQuery(
    () => db.aiConversations.orderBy("updatedAt").reverse().limit(30).toArray(),
    [],
  );

  // Cards are only offered in the mode that asks for them, and only when the
  // last answer really parsed as cards.
  const cards = useMemo(() => {
    if (chat.chat.mode !== "flashcards" || chat.streaming) return [];
    const last = chat.chat.messages[chat.chat.messages.length - 1];
    return last?.role === "model" ? parseGeneratedCards(last.text) : [];
  }, [chat.chat.messages, chat.chat.mode, chat.streaming]);

  if (!key) {
    return <KeyGate onSaved={setKey} />;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft;
    setDraft("");
    void chat.send(text, mode);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, as in every other chat; Shift+Enter starts a new line.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (draft.trim() && !chat.streaming) submit(event as unknown as FormEvent);
    }
  }

  const empty = chat.chat.messages.length === 0 && !chat.streaming;
  const current = getMode(mode);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <ChoiceGroup
            label="What do you need?"
            options={MODE_OPTIONS}
            value={mode}
            onChange={(next: AiModeId) => {
              setMode(next);
              if (chat.chat.messages.length > 0) chat.startNew(next);
            }}
          />
          <p className="text-muted-foreground mt-1.5 text-sm">{current.hint}</p>
        </div>
        {!empty ? (
          <Button variant="outline" size="sm" onClick={() => chat.startNew(mode)}>
            <Plus className="size-3.5" aria-hidden />
            New chat
          </Button>
        ) : null}
      </div>

      {empty ? (
        <p className="text-muted-foreground bg-muted rounded-xl px-4 py-3 text-sm text-pretty">
          Your messages and your key go straight from this device to Google, which answers them.
          Nothing goes to us: this app has no server and no account. Everything else in the toolkit
          stays on your device entirely.
        </p>
      ) : (
        <ChatView
          messages={chat.chat.messages}
          mode={chat.chat.mode}
          partial={chat.partial}
          streaming={chat.streaming}
          cardsFromLastAnswer={cards}
          onRegenerate={() => void chat.regenerate()}
        />
      )}

      {chat.error ? (
        <div
          role="alert"
          className="border-destructive/40 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 text-pretty">
            {chat.error.message}
            {chat.error.detail ? (
              <span className="text-muted-foreground block text-xs">{chat.error.detail}</span>
            ) : null}
          </span>
          <Button variant="ghost" size="sm" onClick={chat.dismissError}>
            Dismiss
          </Button>
        </div>
      ) : null}

      {/* In the flow rather than pinned: the panels below it would slide
          under a sticky composer, and the answer is what should be readable. */}
      <form className="flex flex-col gap-2" onSubmit={submit}>
        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Message to the assistant"
            className="max-h-48 min-h-12 flex-1 resize-y"
            rows={2}
            placeholder={current.placeholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
          {chat.streaming ? (
            <Button type="button" variant="outline" className="h-12 shrink-0" onClick={chat.stop}>
              <Square className="size-4" aria-hidden />
              Stop
            </Button>
          ) : (
            <Button type="submit" className="h-12 shrink-0" disabled={!draft.trim()}>
              <ArrowUp className="size-4" aria-hidden />
              Send
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          Answers can be wrong. Check anything you are handing in.
        </p>
      </form>

      <OfflineNotice />

      <div className="flex flex-col gap-2">
        <HistoryPanel
          conversations={conversations ?? []}
          currentId={chat.chat.id}
          onOpen={chat.open}
        />
        <SettingsPanel
          model={model}
          onModelChange={setModel}
          onKeyCleared={() => {
            setKey("");
            chat.startNew(mode);
          }}
        />
      </div>
    </div>
  );
}

/** The assistant is the one tool here that cannot work without a connection. */
function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <p className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      You are offline. The assistant needs a connection; every other tool here does not.
    </p>
  );
}
