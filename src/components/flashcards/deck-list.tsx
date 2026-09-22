"use client";

import { GraduationCap, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDeck, type CardRecord, type DeckRecord } from "@/lib/db/flashcards";
import { dayCounts } from "@/lib/flashcards/queue";

import { CountPills } from "./count-pills";
import { useNow } from "@/hooks/use-now";

export function DeckList({
  decks,
  cardsByDeck,
  onOpen,
  onStudy,
}: {
  decks: DeckRecord[];
  cardsByDeck: ReadonlyMap<number, CardRecord[]>;
  onOpen: (id: number) => void;
  onStudy: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [now] = useNow(60_000);

  async function create(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = await addDeck(trimmed);
    setName("");
    onOpen(id);
  }

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-1.5" onSubmit={(event) => void create(event)}>
        <Label htmlFor="new-deck" className="text-muted-foreground text-xs">
          New deck
        </Label>
        <div className="flex gap-2">
          <Input
            id="new-deck"
            className="h-9 min-w-0 flex-1"
            placeholder="e.g. Organic Chemistry — reactions"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" className="h-9 shrink-0" disabled={!name.trim()}>
            <Plus className="size-4" aria-hidden />
            Create deck
          </Button>
        </div>
      </form>

      <section aria-labelledby="decks-heading" className="flex flex-col gap-3">
        <h2 id="decks-heading" className="font-display font-semibold">
          Your decks
        </h2>

        {decks.length === 0 ? (
          <p className="text-muted-foreground text-sm text-pretty">
            No decks yet. Create one above, then write cards into it or import them from Anki,
            Quizlet or a spreadsheet. Each card comes back just before you would forget it, so a few
            minutes a day is enough.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {decks.map((deck) => {
              const cards = cardsByDeck.get(deck.id) ?? [];
              const counts = dayCounts(cards, now, deck.newPerDay);
              const waiting = counts.newCards + counts.learning + counts.review;
              return (
                <li
                  key={deck.id}
                  className="bg-card ring-foreground/10 flex flex-wrap items-center gap-3 rounded-xl p-4 ring-1"
                >
                  <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
                    <h3 className="font-display truncate font-semibold">{deck.name}</h3>
                    <p className="text-muted-foreground text-xs">
                      {cards.length === 1 ? "1 card" : `${cards.length} cards`}
                    </p>
                    <CountPills counts={counts} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      aria-label={`Open ${deck.name}`}
                      onClick={() => onOpen(deck.id)}
                    >
                      Open
                    </Button>
                    <Button
                      disabled={waiting === 0}
                      aria-label={`Study ${deck.name}`}
                      onClick={() => onStudy(deck.id)}
                    >
                      <GraduationCap className="size-4" aria-hidden />
                      Study
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
