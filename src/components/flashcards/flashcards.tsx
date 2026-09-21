"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { db, type CardRecord } from "@/lib/db/schema";

import { DeckList } from "./deck-list";
import { DeckView } from "./deck-view";
import { StudySession } from "./study-session";

type View = { kind: "decks" } | { kind: "deck"; id: number } | { kind: "study"; id: number };

const NO_CARDS: CardRecord[] = [];

export function Flashcards() {
  const [view, setView] = useState<View>({ kind: "decks" });

  const decks = useLiveQuery(
    () => db.decks.toArray().then((rows) => rows.sort((a, b) => a.createdAt - b.createdAt)),
    [],
  );
  // Every card, grouped by deck: the deck list needs counts for all of them,
  // and even a few thousand cards is a small read from IndexedDB.
  const cards = useLiveQuery(() => db.cards.toArray(), []);
  const byDeck = useMemo(() => {
    const groups = new Map<number, CardRecord[]>();
    for (const card of cards ?? []) {
      const group = groups.get(card.deckId);
      if (group) group.push(card);
      else groups.set(card.deckId, [card]);
    }
    return groups;
  }, [cards]);

  if (!decks || !cards) return <LoadingState />;

  function go(next: View) {
    setView(next);
    window.scrollTo({ top: 0 });
  }

  const deck = view.kind === "decks" ? undefined : decks.find((row) => row.id === view.id);

  if (view.kind === "study" && deck) {
    return (
      <StudySession
        deck={deck}
        cards={byDeck.get(deck.id) ?? NO_CARDS}
        onExit={() => go({ kind: "deck", id: deck.id })}
      />
    );
  }

  if (view.kind === "deck" && deck) {
    return (
      <DeckView
        deck={deck}
        cards={byDeck.get(deck.id) ?? NO_CARDS}
        onBack={() => go({ kind: "decks" })}
        onStudy={() => go({ kind: "study", id: deck.id })}
      />
    );
  }

  return (
    <DeckList
      decks={decks}
      cardsByDeck={byDeck}
      onOpen={(id) => go({ kind: "deck", id })}
      onStudy={(id) => go({ kind: "study", id })}
    />
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your decks</span>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}
