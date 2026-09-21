"use client";

import { ArrowLeft, Check, Download, GraduationCap, Pencil, Search, Trash2 } from "lucide-react";
import { useState } from "react";

import { downloadFile, fileSlug } from "@/components/download";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addCards,
  deleteCard,
  deleteDeck,
  editCard,
  resetDeck,
  restoreCard,
  updateDeck,
  type CardRecord,
  type DeckRecord,
} from "@/lib/db/flashcards";
import { dayCounts } from "@/lib/flashcards/queue";
import { formatInterval } from "@/lib/flashcards/scheduler";
import { exportCards } from "@/lib/flashcards/transfer";

import { CardForm } from "./card-form";
import { CountPills } from "./count-pills";
import { ImportPanel } from "./import-panel";
import { useNow } from "./use-now";

export function DeckView({
  deck,
  cards,
  onBack,
  onStudy,
}: {
  deck: DeckRecord;
  cards: CardRecord[];
  onBack: () => void;
  onStudy: () => void;
}) {
  const [now] = useNow(60_000);
  const [renaming, setRenaming] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [removed, setRemoved] = useState<CardRecord | null>(null);

  const counts = dayCounts(cards, now, deck.newPerDay);
  const waiting = counts.newCards + counts.learning + counts.review;
  const ordered = [...cards].sort((a, b) => b.createdAt - a.createdAt);
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? ordered.filter((card) => `${card.front}\n${card.back}`.toLowerCase().includes(needle))
    : ordered;

  function download(delimiter: "\t" | ",") {
    const text = exportCards(cards, delimiter);
    const [extension, type] =
      delimiter === "\t" ? ["txt", "text/tab-separated-values"] : ["csv", "text/csv"];
    downloadFile(`${fileSlug(deck.name, "deck")}.${extension}`, text, `${type};charset=utf-8`);
  }

  async function remove(card: CardRecord) {
    const gone = await deleteCard(card.id);
    if (gone) setRemoved(gone);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          All decks
        </Button>
      </div>

      <header className="flex flex-col gap-3">
        {renaming ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setRenaming(false);
            }}
          >
            <Input
              aria-label="Deck name"
              className="font-display h-10 min-w-0 flex-1 text-lg font-semibold"
              defaultValue={deck.name}
              autoFocus
              onChange={(event) => {
                const name = event.target.value.trim();
                if (name) void updateDeck(deck.id, { name });
              }}
              onBlur={() => setRenaming(false)}
            />
            <Button
              type="submit"
              variant="outline"
              size="icon"
              className="size-10"
              aria-label="Done renaming"
              onMouseDown={(event) => event.preventDefault()}
            >
              <Check className="size-4" aria-hidden />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="font-display min-w-0 text-2xl font-semibold break-words">{deck.name}</h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Rename this deck"
              onClick={() => setRenaming(true)}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={waiting === 0} onClick={onStudy}>
            <GraduationCap className="size-4" aria-hidden />
            Study now
          </Button>
          <CountPills counts={counts} />
        </div>
      </header>

      <section
        aria-labelledby="add-card-heading"
        className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1"
      >
        <h3 id="add-card-heading" className="font-display font-semibold">
          Add a card
        </h3>
        <CardForm
          submitLabel="Add card"
          clearOnSubmit
          onSubmit={(card) => addCards(deck.id, [card])}
        />
      </section>

      <div className="flex flex-col gap-2">
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
            Import cards
          </summary>
          <div className="border-t p-3">
            <ImportPanel onImport={(imported) => addCards(deck.id, imported)} />
          </div>
        </details>

        <details className="rounded-lg border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
            Deck settings
          </summary>
          <DeckSettings deck={deck} onDeleted={onBack} />
        </details>
      </div>

      {removed ? (
        <div
          role="status"
          className="bg-muted flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <span className="min-w-0 flex-1 truncate">Deleted “{removed.front}”.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void restoreCard(removed);
              setRemoved(null);
            }}
          >
            Undo
          </Button>
        </div>
      ) : null}

      <section aria-labelledby="cards-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="cards-heading" className="font-display font-semibold">
            Cards <span className="text-muted-foreground font-normal">({cards.length})</span>
          </h3>
          <div className="ms-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={cards.length === 0}
              onClick={() => download("\t")}
            >
              <Download className="size-3.5" aria-hidden />
              Anki
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={cards.length === 0}
              onClick={() => download(",")}
            >
              <Download className="size-3.5" aria-hidden />
              CSV
            </Button>
          </div>
        </div>

        {cards.length > 0 ? (
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              aria-label="Search cards"
              type="search"
              className="h-9 ps-8"
              placeholder="Search cards"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No cards yet. Write one above, or import a list.
          </p>
        )}

        {needle && shown.length === 0 ? (
          <p className="text-muted-foreground text-sm">No cards match “{query.trim()}”.</p>
        ) : null}

        <ul className="flex flex-col">
          {shown.map((card) => (
            <li key={card.id} className="border-b py-3 last:border-b-0">
              {editingId === card.id ? (
                <CardForm
                  initial={{ front: card.front, back: card.back }}
                  submitLabel="Save card"
                  onSubmit={async (text) => {
                    await editCard(card.id, text);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-1 text-sm sm:grid-cols-2 sm:gap-4">
                    <p className="font-medium break-words whitespace-pre-wrap">{card.front}</p>
                    <p className="text-muted-foreground break-words whitespace-pre-wrap">
                      {card.back}
                    </p>
                  </div>
                  <span className="text-muted-foreground shrink-0 pt-0.5 text-xs tabular-nums">
                    {status(card, now)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit card ${card.front}`}
                    onClick={() => setEditingId(card.id)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete card ${card.front}`}
                    onClick={() => void remove(card)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Where a card stands, in the fewest characters: "New", "Learning", "3d", "Due". */
function status(card: CardRecord, now: number): string {
  if (card.srs.state === "new") return "New";
  if (card.srs.state !== "review") return "Learning";
  return card.srs.due <= now ? "Due" : formatInterval(card.srs.due - now);
}

function DeckSettings({ deck, onDeleted }: { deck: DeckRecord; onDeleted: () => void }) {
  return (
    <div className="flex flex-col gap-4 border-t p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-per-day" className="text-muted-foreground text-xs">
          New cards a day
        </Label>
        <Input
          id="new-per-day"
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          className="h-9 w-28"
          defaultValue={deck.newPerDay}
          onChange={(event) => {
            const value = Math.round(Number(event.target.value));
            if (Number.isFinite(value) && value >= 0 && value <= 500) {
              void updateDeck(deck.id, { newPerDay: value });
            }
          }}
        />
        <p className="text-muted-foreground text-xs text-pretty">
          Each new card adds several reviews over the following weeks. Twenty a day settles at
          around two hundred reviews a day; lower it before exams pile up.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            if (window.confirm(`Forget all progress on “${deck.name}”? The cards are kept.`)) {
              void resetDeck(deck.id);
            }
          }}
        >
          Reset progress
        </Button>
        <Button
          variant="destructive"
          onClick={async () => {
            if (
              !window.confirm(`Delete “${deck.name}” and all its cards? This cannot be undone.`)
            ) {
              return;
            }
            await deleteDeck(deck.id);
            onDeleted();
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          Delete deck
        </Button>
      </div>
    </div>
  );
}
