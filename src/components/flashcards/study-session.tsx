"use client";

import { ArrowLeft, PartyPopper, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { answerCard, restoreCard, type CardRecord, type DeckRecord } from "@/lib/db/flashcards";
import { dayCounts, nextCard, nextWaitingDue, type DayCounts } from "@/lib/flashcards/queue";
import {
  GRADES,
  formatInterval,
  previewIntervals,
  type Grade,
  type SrsState,
} from "@/lib/flashcards/scheduler";

import { CountPills } from "./count-pills";
import { useNow } from "./use-now";

const GRADE_LABELS: Record<Grade, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

function countKind(srs: SrsState): keyof DayCounts {
  if (srs.state === "new") return "newCards";
  return srs.state === "review" ? "review" : "learning";
}

/**
 * One card at a time: read the front, recall, reveal, then say how well it
 * went. The keyboard works throughout (space to reveal, 1–4 to answer, Z to
 * undo), and on a phone the answer buttons sit at thumb height.
 */
export function StudySession({
  deck,
  cards,
  onExit,
}: {
  deck: DeckRecord;
  cards: CardRecord[];
  onExit: () => void;
}) {
  const [now, refreshNow] = useNow();
  const [answered, setAnswered] = useState(0);
  const [previous, setPrevious] = useState<CardRecord | null>(null);

  const next = nextCard(cards, now, deck.newPerDay);
  const current = next ? cards.find((card) => card.id === next.id) : undefined;
  const counts = dayCounts(cards, now, deck.newPerDay);

  async function grade(card: CardRecord, value: Grade) {
    const before = await answerCard(card.id, value, Date.now());
    if (before) setPrevious(before);
    setAnswered((count) => count + 1);
    refreshNow();
  }

  async function undo() {
    if (!previous) return;
    await restoreCard(previous);
    setPrevious(null);
    setAnswered((count) => Math.max(0, count - 1));
    refreshNow();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="size-4" aria-hidden />
          {deck.name}
        </Button>
        <div className="ms-auto flex items-center gap-2">
          <CountPills counts={counts} current={current ? countKind(current.srs) : undefined} />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Undo last answer"
            title="Undo last answer (Z)"
            disabled={!previous}
            onClick={() => void undo()}
          >
            <Undo2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {current ? (
        <CardFace
          key={`${current.id}-${current.srs.reps}`}
          card={current}
          now={now}
          onGrade={(value) => void grade(current, value)}
          onUndo={() => void undo()}
        />
      ) : (
        <Finished
          answered={answered}
          waitingDue={nextWaitingDue(cards)}
          now={now}
          onExit={onExit}
        />
      )}
    </div>
  );
}

function CardFace({
  card,
  now,
  onGrade,
  onUndo,
}: {
  card: CardRecord;
  now: number;
  onGrade: (grade: Grade) => void;
  onUndo: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const intervals = previewIntervals(card.srs, now);
  // A second key press before the answer is saved must not answer twice.
  // The face remounts for every card, so this resets with it.
  const answeredRef = useRef(false);

  function answer(grade: Grade) {
    if (answeredRef.current) return;
    answeredRef.current = true;
    onGrade(grade);
  }

  // Re-bound every render so the handler always sees the current card and
  // reveal state; adding and removing one listener is cheap.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "z" || event.key === "Z") {
        onUndo();
        return;
      }
      if (!revealed) {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          setRevealed(true);
        }
        return;
      }
      const index = ["1", "2", "3", "4"].indexOf(event.key);
      if (index !== -1) answer(GRADES[index]);
      else if (event.key === " " || event.key === "Enter") {
        // Space after revealing means "Good", the most common answer.
        event.preventDefault();
        answer("good");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <section aria-label="Flashcard" className="flex flex-col gap-4">
      <div className="bg-card ring-foreground/10 flex min-h-64 flex-col rounded-2xl p-5 ring-1 sm:p-8">
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Front
        </p>
        <p className="font-display text-xl leading-snug font-medium break-words whitespace-pre-wrap sm:text-2xl">
          {card.front}
        </p>

        {revealed ? (
          <>
            <hr className="my-5" />
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Back
            </p>
            <p
              className="text-lg leading-relaxed break-words whitespace-pre-wrap"
              aria-live="polite"
            >
              {card.back}
            </p>
          </>
        ) : null}
      </div>

      {/* Sticky at the bottom so the answer buttons stay under the thumb on a phone. */}
      <div className="bg-background/95 sticky bottom-0 -mx-4 px-4 py-3 backdrop-blur-sm sm:static sm:m-0 sm:p-0">
        {revealed ? (
          <div
            className="grid grid-cols-4 gap-2"
            role="group"
            aria-label="How well did you remember it?"
          >
            {GRADES.map((grade, index) => (
              <Button
                key={grade}
                variant={
                  grade === "again" ? "destructive" : grade === "good" ? "default" : "outline"
                }
                className="h-14 flex-col gap-0.5"
                aria-keyshortcuts={String(index + 1)}
                onClick={() => answer(grade)}
              >
                <span className="font-semibold">{GRADE_LABELS[grade]}</span>
                <span className="text-xs font-normal opacity-80">
                  {formatInterval(intervals[grade])}
                </span>
              </Button>
            ))}
          </div>
        ) : (
          <Button
            className="h-14 w-full text-base"
            aria-keyshortcuts="Space"
            onClick={() => setRevealed(true)}
          >
            Show answer
          </Button>
        )}
      </div>
    </section>
  );
}

function Finished({
  answered,
  waitingDue,
  now,
  onExit,
}: {
  answered: number;
  waitingDue: number | null;
  now: number;
  onExit: () => void;
}) {
  const reviewed = answered === 1 ? "1 card" : `${answered} cards`;

  return (
    <section
      aria-label="Session finished"
      className="bg-card ring-foreground/10 flex flex-col items-start gap-3 rounded-2xl p-6 ring-1"
    >
      <PartyPopper className="text-primary size-8" aria-hidden />
      {waitingDue !== null && waitingDue > now ? (
        <>
          <h2 className="font-display text-xl font-semibold">Nearly done</h2>
          <p className="text-muted-foreground text-pretty">
            {answered > 0 ? `You have reviewed ${reviewed}. ` : ""}A card you are still learning
            comes back in {formatInterval(waitingDue - now)}. Leave this page open and it will
            appear here.
          </p>
        </>
      ) : (
        <>
          <h2 className="font-display text-xl font-semibold">Done for today</h2>
          <p className="text-muted-foreground text-pretty">
            {answered > 0 ? `You reviewed ${reviewed}. ` : ""}Everything due today is done. Come
            back tomorrow and the cards you are about to forget will be waiting.
          </p>
        </>
      )}
      <Button variant="outline" onClick={onExit}>
        Back to the deck
      </Button>
    </section>
  );
}
