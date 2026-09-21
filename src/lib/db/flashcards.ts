/**
 * Typed accessors for decks and cards.
 */
import { newSrsState, schedule, type Grade } from "@/lib/flashcards/scheduler";
import type { CardText } from "@/lib/flashcards/transfer";

import { db, type CardRecord, type DeckRecord } from "./schema";

/** Anki's default. Twenty new cards a day is roughly 200 reviews a day a month later. */
export const DEFAULT_NEW_PER_DAY = 20;

export async function addDeck(name: string): Promise<number> {
  const now = Date.now();
  return db.decks.add({ name, createdAt: now, updatedAt: now, newPerDay: DEFAULT_NEW_PER_DAY });
}

export async function updateDeck(
  id: number,
  patch: Partial<Pick<DeckRecord, "name" | "newPerDay">>,
): Promise<void> {
  await db.decks.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteDeck(id: number): Promise<void> {
  await db.transaction("rw", db.decks, db.cards, async () => {
    await db.cards.where("deckId").equals(id).delete();
    await db.decks.delete(id);
  });
}

export function deckCards(deckId: number): Promise<CardRecord[]> {
  return db.cards.where("deckId").equals(deckId).toArray();
}

export async function addCards(deckId: number, cards: readonly CardText[]): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.decks, db.cards, async () => {
    // Staggered by a millisecond so new cards keep the order they were given in.
    await db.cards.bulkAdd(
      cards.map((card, index) => ({
        deckId,
        front: card.front,
        back: card.back,
        createdAt: now + index,
        updatedAt: now + index,
        srs: newSrsState(now),
      })),
    );
    await db.decks.update(deckId, { updatedAt: now });
  });
}

export async function editCard(id: number, text: CardText): Promise<void> {
  await db.cards.update(id, { ...text, updatedAt: Date.now() });
}

/** Returns the deleted card, so the page can offer to put it back. */
export async function deleteCard(id: number): Promise<CardRecord | undefined> {
  return db.transaction("rw", db.cards, async () => {
    const card = await db.cards.get(id);
    if (card) await db.cards.delete(id);
    return card;
  });
}

/** Puts a card back exactly as it was: after a delete, or to undo an answer. */
export async function restoreCard(card: CardRecord): Promise<void> {
  await db.cards.put(card);
}

/** Records an answer. Returns the card as it was before, for undo. */
export async function answerCard(
  id: number,
  grade: Grade,
  now: number,
): Promise<CardRecord | undefined> {
  return db.transaction("rw", db.cards, async () => {
    const card = await db.cards.get(id);
    if (!card) return undefined;
    await db.cards.update(id, { srs: schedule(card.srs, grade, now) });
    return card;
  });
}

/** Forgets all progress on a deck, keeping the cards. */
export async function resetDeck(deckId: number): Promise<void> {
  const now = Date.now();
  await db.cards
    .where("deckId")
    .equals(deckId)
    .modify({ srs: newSrsState(now) });
}

export type { CardRecord, DeckRecord };
