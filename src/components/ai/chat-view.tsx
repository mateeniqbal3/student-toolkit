"use client";

import { Check, Copy, RefreshCw, Sparkles, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { NotePreview } from "@/components/notes/note-preview";
import { Button } from "@/components/ui/button";
import { parseGeneratedCards } from "@/lib/ai/cards";
import type { AiModeId } from "@/lib/ai/modes";
import type { AiMessageRecord } from "@/lib/db/ai";
import type { CardText } from "@/lib/flashcards/transfer";
import { cn } from "@/lib/utils";

import { AddCardsPanel } from "./add-cards-panel";

/**
 * The conversation. Answers are Markdown with maths, rendered by the same
 * component the notes tool uses, so an explanation full of equations reads
 * properly.
 *
 * Flashcards are the exception: the model is asked for JSON, which is no use
 * to read, so those answers are shown as the cards they describe.
 */
export function ChatView({
  messages,
  mode,
  partial,
  streaming,
  cardsFromLastAnswer,
  onRegenerate,
}: {
  messages: AiMessageRecord[];
  mode: AiModeId;
  partial: string | null;
  streaming: boolean;
  /** Set only in flashcards mode, when the last answer parsed into cards. */
  cardsFromLastAnswer: CardText[];
  onRegenerate: () => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  // Follow the answer as it arrives, unless the student has scrolled up to
  // read something earlier.
  useEffect(() => {
    if (!atBottom.current) return;
    end.current?.scrollIntoView({ block: "end", behavior: streaming ? "auto" : "smooth" });
  }, [messages.length, partial, streaming]);

  useEffect(() => {
    function onScroll() {
      const fromBottom =
        document.documentElement.scrollHeight -
        window.scrollY -
        document.documentElement.clientHeight;
      atBottom.current = fromBottom < 160;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const lastIsAnswer = !streaming && messages[messages.length - 1]?.role === "model";

  return (
    <div className="flex flex-col gap-4">
      {messages.map((message, index) => (
        <Message
          key={`${message.at}-${index}`}
          message={message}
          asCards={mode === "flashcards" && message.role === "model"}
        />
      ))}

      {partial !== null ? (
        // Half-written JSON is worse to watch than words arriving, so a
        // streaming answer is never shown as cards.
        <Message message={{ role: "model", text: partial, at: 0 }} asCards={false} pending />
      ) : null}

      {lastIsAnswer ? (
        <div className="flex flex-wrap gap-2">
          <CopyButton text={messages[messages.length - 1]?.text ?? ""} />
          <Button variant="ghost" size="sm" onClick={onRegenerate}>
            <RefreshCw className="size-3.5" aria-hidden />
            Ask again
          </Button>
        </div>
      ) : null}

      {cardsFromLastAnswer.length > 0 && !streaming ? (
        <AddCardsPanel cards={cardsFromLastAnswer} />
      ) : null}

      <div ref={end} />
    </div>
  );
}

function Message({
  message,
  asCards,
  pending = false,
}: {
  message: AiMessageRecord;
  asCards: boolean;
  pending?: boolean;
}) {
  const isUser = message.role === "user";
  const cards = useMemo(
    () => (asCards ? parseGeneratedCards(message.text) : []),
    [asCards, message.text],
  );

  return (
    <article
      aria-label={isUser ? "Your message" : "Assistant"}
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
        )}
      >
        {isUser ? (
          <User className="size-4" aria-hidden />
        ) : (
          <Sparkles className="size-4" aria-hidden />
        )}
      </span>
      <div
        className={cn(
          "max-w-[min(100%,46rem)] min-w-0 rounded-2xl px-4 py-3",
          isUser ? "bg-muted" : "bg-card ring-foreground/10 ring-1",
        )}
      >
        {isUser ? (
          <p className="text-sm break-words whitespace-pre-wrap">{message.text}</p>
        ) : cards.length > 0 ? (
          <CardsPreview cards={cards} />
        ) : message.text.trim() ? (
          <NotePreview markdown={message.text} />
        ) : (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="bg-primary size-2 animate-pulse rounded-full" aria-hidden />
            Thinking…
          </p>
        )}
        {pending && message.text.trim() ? (
          <span className="sr-only" role="status">
            Writing the answer
          </span>
        ) : null}
      </div>
    </article>
  );
}

/** Generated cards, front and back, as they will be studied. */
function CardsPreview({ cards }: { cards: CardText[] }) {
  return (
    <ol aria-label="Generated flashcards" className="flex flex-col gap-2 text-sm">
      {cards.map((card, index) => (
        <li key={`${card.front}-${index}`} className="border-b pb-2 last:border-b-0 last:pb-0">
          <p className="font-medium break-words">{card.front}</p>
          <p className="text-muted-foreground break-words">{card.back}</p>
        </li>
      ))}
    </ol>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
