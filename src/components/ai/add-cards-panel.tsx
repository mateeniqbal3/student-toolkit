"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Layers } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { addCards, addDeck } from "@/lib/db/flashcards";
import { db } from "@/lib/db/schema";
import type { CardText } from "@/lib/flashcards/transfer";

const NEW_DECK = "new";

/**
 * Generated cards go into the flashcards tool rather than staying in a chat
 * window: the point of making them is studying them, and the scheduling
 * lives there.
 */
export function AddCardsPanel({ cards }: { cards: CardText[] }) {
  const decks = useLiveQuery(
    () => db.decks.toArray().then((rows) => rows.sort((a, b) => b.updatedAt - a.updatedAt)),
    [],
  );
  const [target, setTarget] = useState<string>(NEW_DECK);
  const [name, setName] = useState("");
  const [added, setAdded] = useState(0);

  async function add() {
    const existing = Number.parseInt(target, 10);
    const deckId = Number.isSafeInteger(existing)
      ? existing
      : await addDeck(name.trim() || "AI flashcards");
    await addCards(deckId, cards);
    setAdded(cards.length);
  }

  if (added > 0) {
    return (
      <p role="status" className="bg-muted rounded-xl px-4 py-3 text-sm text-pretty">
        Added {added} {added === 1 ? "card" : "cards"}. Study them in the{" "}
        <a href="/flashcards" className="text-primary underline underline-offset-2">
          flashcards tool
        </a>
        , which brings each card back just before you would forget it.
      </p>
    );
  }

  return (
    <section
      aria-label="Save these flashcards"
      className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Layers className="text-primary size-4" aria-hidden />
        {cards.length} {cards.length === 1 ? "card" : "cards"} ready to study
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="cards-deck" className="text-muted-foreground text-xs">
            Add to
          </Label>
          <NativeSelect
            id="cards-deck"
            className="h-9"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value={NEW_DECK}>A new deck</option>
            {(decks ?? []).map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        {target === NEW_DECK ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="cards-deck-name" className="text-muted-foreground text-xs">
              Deck name
            </Label>
            <Input
              id="cards-deck-name"
              className="h-9"
              placeholder="e.g. Mitosis"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        ) : null}
        <Button className="h-9" onClick={() => void add()}>
          Add {cards.length} {cards.length === 1 ? "card" : "cards"}
        </Button>
      </div>
    </section>
  );
}
