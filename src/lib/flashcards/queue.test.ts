import { describe, expect, it } from "vitest";

import { dayCounts, newAllowance, nextCard, type QueueCard } from "./queue";
import { DAY, MINUTE, newSrsState, type SrsState } from "./scheduler";

const NOW = new Date(2026, 8, 21, 10, 0, 0).getTime();

function card(id: number, srs: Partial<SrsState>, createdAt = id): QueueCard {
  return { id, createdAt, srs: { ...newSrsState(0), ...srs } };
}

describe("nextCard", () => {
  it("shows a due learning card before reviews and new cards", () => {
    const cards = [
      card(1, { state: "new" }),
      card(2, { state: "review", due: NOW - DAY, interval: 3 }),
      card(3, { state: "learning", due: NOW - MINUTE }),
    ];
    expect(nextCard(cards, NOW, 20)?.id).toBe(3);
  });

  it("shows reviews due today, most overdue first, before new cards", () => {
    const cards = [
      card(1, { state: "new" }),
      card(2, { state: "review", due: NOW + 2 * 60 * MINUTE, interval: 3 }),
      card(3, { state: "review", due: NOW - DAY, interval: 3 }),
    ];
    expect(nextCard(cards, NOW, 20)?.id).toBe(3);
  });

  it("introduces new cards in the order they were written", () => {
    const cards = [card(1, { state: "new" }, 50), card(2, { state: "new" }, 10)];
    expect(nextCard(cards, NOW, 20)?.id).toBe(2);
  });

  it("stops introducing new cards at the daily limit", () => {
    const cards = [
      card(1, { state: "review", due: NOW + 3 * DAY, introducedAt: NOW - MINUTE }),
      card(2, { state: "new" }),
    ];
    expect(newAllowance(cards, NOW, 1)).toBe(0);
    expect(nextCard(cards, NOW, 1)).toBeNull();
  });

  it("does not count cards introduced on an earlier day against today", () => {
    const cards = [card(1, { state: "review", due: NOW + DAY, introducedAt: NOW - 2 * DAY })];
    expect(newAllowance(cards, NOW, 1)).toBe(1);
  });

  it("shows a learning card early rather than make the student wait, within 20 minutes", () => {
    expect(nextCard([card(1, { state: "learning", due: NOW + 10 * MINUTE })], NOW, 20)?.id).toBe(1);
    expect(nextCard([card(1, { state: "learning", due: NOW + 30 * MINUTE })], NOW, 20)).toBeNull();
  });

  it("does not show reviews due tomorrow", () => {
    const tomorrow = new Date(2026, 8, 22, 8, 0, 0).getTime();
    expect(nextCard([card(1, { state: "review", due: tomorrow })], NOW, 20)).toBeNull();
  });
});

describe("dayCounts", () => {
  it("counts what is left to study today", () => {
    const cards = [
      card(1, { state: "new" }),
      card(2, { state: "new" }),
      card(3, { state: "new" }),
      card(4, { state: "learning", due: NOW + 5 * MINUTE }),
      card(5, { state: "review", due: NOW - DAY }),
      card(6, { state: "review", due: NOW + 5 * DAY }),
    ];
    expect(dayCounts(cards, NOW, 2)).toEqual({ newCards: 2, learning: 1, review: 1 });
  });
});
