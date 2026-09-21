import { describe, expect, it } from "vitest";

import {
  DAY,
  MINUTE,
  formatInterval,
  newSrsState,
  previewIntervals,
  schedule,
  type Grade,
  type SrsState,
} from "./scheduler";

const NOW = Date.UTC(2026, 8, 21, 9, 0, 0);

function answer(card: SrsState, ...grades: Grade[]): SrsState {
  return grades.reduce((state, grade) => schedule(state, grade, NOW), card);
}

describe("new and learning cards", () => {
  const fresh = newSrsState(NOW);

  it("walks through the learning steps and graduates to one day", () => {
    const first = schedule(fresh, "good", NOW);
    expect(first).toMatchObject({ state: "learning", step: 1, due: NOW + 10 * MINUTE });

    const graduated = schedule(first, "good", NOW);
    expect(graduated).toMatchObject({ state: "review", interval: 1, due: NOW + DAY });
  });

  it("restarts the steps on Again", () => {
    expect(answer(fresh, "good", "again")).toMatchObject({ state: "learning", step: 0 });
    expect(schedule(fresh, "again", NOW).due).toBe(NOW + MINUTE);
  });

  it("puts Hard between Again and Good", () => {
    const intervals = previewIntervals(fresh, NOW);
    expect(intervals.again).toBeLessThan(intervals.hard);
    expect(intervals.hard).toBeLessThan(intervals.good);
    expect(intervals.hard).toBe(5.5 * MINUTE);
  });

  it("skips the steps entirely on Easy", () => {
    expect(schedule(fresh, "easy", NOW)).toMatchObject({ state: "review", interval: 4 });
  });

  it("records when a card was first studied, once", () => {
    const later = NOW + DAY;
    const studied = schedule(schedule(fresh, "good", NOW), "good", later);
    expect(studied.introducedAt).toBe(NOW);
  });
});

describe("review cards", () => {
  const review: SrsState = {
    state: "review",
    due: NOW,
    interval: 10,
    ease: 2.5,
    step: 0,
    reps: 5,
    lapses: 0,
  };

  it("multiplies the interval by the ease on Good", () => {
    expect(schedule(review, "good", NOW)).toMatchObject({ interval: 25, ease: 2.5 });
  });

  it("grows slowly and lowers the ease on Hard", () => {
    expect(schedule(review, "hard", NOW)).toMatchObject({ interval: 12, ease: 2.35 });
  });

  it("grows fastest and raises the ease on Easy", () => {
    const easy = schedule(review, "easy", NOW);
    expect(easy.interval).toBe(33);
    expect(easy.ease).toBeCloseTo(2.65);
  });

  it("never gives a better answer a shorter interval", () => {
    for (const card of [review, { ...review, interval: 1, ease: 1.3 }]) {
      const days = (grade: Grade) => schedule(card, grade, NOW).interval;
      expect(days("hard")).toBeGreaterThan(card.interval);
      expect(days("good")).toBeGreaterThanOrEqual(days("hard"));
      expect(days("easy")).toBeGreaterThan(days("good"));
    }
  });

  it("sends a forgotten card to relearning, harder and with a lapse", () => {
    const lapsed = schedule(review, "again", NOW);
    expect(lapsed).toMatchObject({ state: "relearning", lapses: 1, interval: 1 });
    expect(lapsed.ease).toBeCloseTo(2.3);
    expect(lapsed.due).toBe(NOW + 10 * MINUTE);

    expect(schedule(lapsed, "good", NOW)).toMatchObject({ state: "review", interval: 1 });
  });

  it("does not let the ease fall below 1.3", () => {
    let card: SrsState = { ...review, ease: 1.4 };
    for (let i = 0; i < 5; i += 1) card = schedule({ ...card, state: "review" }, "again", NOW);
    expect(card.ease).toBe(1.3);
  });
});

describe("formatInterval", () => {
  it("uses the compact units students know from Anki", () => {
    expect(formatInterval(MINUTE)).toBe("1m");
    expect(formatInterval(5.5 * MINUTE)).toBe("6m");
    expect(formatInterval(3 * 60 * MINUTE)).toBe("3h");
    expect(formatInterval(DAY)).toBe("1d");
    expect(formatInterval(75 * DAY)).toBe("2.5mo");
    expect(formatInterval(400 * DAY)).toBe("1.1y");
  });
});
