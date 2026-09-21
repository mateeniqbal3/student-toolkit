/**
 * Which card to show next, and what is left for today.
 *
 * The order is Anki's: learning cards whose step has come due first (they are
 * about to be forgotten), then reviews due today, then new cards up to the
 * day's limit. If nothing else is left, a learning card due within the next
 * twenty minutes is shown early rather than making the student wait.
 */
import { MINUTE, type SrsState } from "./scheduler";

export const LEARN_AHEAD = 20 * MINUTE;

export interface QueueCard {
  id: number;
  srs: SrsState;
  createdAt: number;
}

export interface DayCounts {
  /** New cards that could still be introduced today. */
  newCards: number;
  /** Cards in learning or relearning due within the learn-ahead window. */
  learning: number;
  /** Graduated cards due by the end of today. */
  review: number;
}

/** Local midnight at the end of the day containing `now`. */
export function endOfDay(now: number): number {
  const date = new Date(now);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}

export function startOfDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

const isLearning = (card: QueueCard) =>
  card.srs.state === "learning" || card.srs.state === "relearning";

/** How many new cards the limit still allows today. */
export function newAllowance(cards: readonly QueueCard[], now: number, newPerDay: number): number {
  const since = startOfDay(now);
  const introduced = cards.filter(
    (card) => card.srs.introducedAt !== undefined && card.srs.introducedAt >= since,
  ).length;
  return Math.max(0, newPerDay - introduced);
}

export function dayCounts(cards: readonly QueueCard[], now: number, newPerDay: number): DayCounts {
  const unseen = cards.filter((card) => card.srs.state === "new").length;
  return {
    newCards: Math.min(unseen, newAllowance(cards, now, newPerDay)),
    learning: cards.filter((card) => isLearning(card) && card.srs.due <= now + LEARN_AHEAD).length,
    review: cards.filter((card) => card.srs.state === "review" && card.srs.due < endOfDay(now))
      .length,
  };
}

const byDue = (a: QueueCard, b: QueueCard) => a.srs.due - b.srs.due || a.id - b.id;

/** The next card to study, or null when today's work is done. */
export function nextCard(
  cards: readonly QueueCard[],
  now: number,
  newPerDay: number,
): QueueCard | null {
  const learning = cards.filter(isLearning).sort(byDue);
  const dueLearning = learning.find((card) => card.srs.due <= now);
  if (dueLearning) return dueLearning;

  const review = cards
    .filter((card) => card.srs.state === "review" && card.srs.due < endOfDay(now))
    .sort(byDue)[0];
  if (review) return review;

  if (newAllowance(cards, now, newPerDay) > 0) {
    // New cards in the order they were written, which is usually the order
    // they make sense in.
    const fresh = cards
      .filter((card) => card.srs.state === "new")
      .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)[0];
    if (fresh) return fresh;
  }

  return learning.find((card) => card.srs.due <= now + LEARN_AHEAD) ?? null;
}

/** When the next learning card comes due, if any are waiting beyond the learn-ahead window. */
export function nextWaitingDue(cards: readonly QueueCard[]): number | null {
  const waiting = cards.filter(isLearning).map((card) => card.srs.due);
  return waiting.length > 0 ? Math.min(...waiting) : null;
}
