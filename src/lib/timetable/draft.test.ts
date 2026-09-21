import { describe, expect, it } from "vitest";

import { blockRect } from "./draw";
import { draftFromEntry, entriesFromDraft, entryProblems, newEntryDraft } from "./draft";
import type { DayIndex, TimetableEntry } from "./types";

describe("entry drafts", () => {
  it("makes one entry per chosen day, each with its own id", () => {
    const draft = { ...newEntryDraft(0, 540, 3), title: " Physics ", days: [4, 0, 2] as const };
    const entries = entriesFromDraft({ ...draft, days: [...draft.days] });

    expect(entries.map((entry) => entry.day)).toEqual([0, 2, 4]);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(3);
    expect(entries[0]).toMatchObject({ title: "Physics", start: 540, end: 600, colour: 3 });
  });

  it("keeps the edited entry's id so it is updated in place", () => {
    const existing: TimetableEntry = {
      id: "keep",
      title: "Maths",
      kind: "tutorial",
      day: 1,
      start: 600,
      end: 660,
      location: "B-12",
      instructor: "",
      colour: 2,
    };
    const [updated] = entriesFromDraft({ ...draftFromEntry(existing), location: "B-14" }, "keep");
    expect(updated).toEqual({ ...existing, location: "B-14" });
  });

  it("reports what stops a draft being saved", () => {
    const draft = { ...newEntryDraft(0, 540, 1), days: [], end: "08:00" };
    expect(entryProblems(draft)).toEqual(["missing-title", "no-days", "ends-before-start"]);
    expect(entriesFromDraft(draft)).toEqual([]);
  });
});

describe("blockRect", () => {
  const grid = { days: [0, 1, 2, 3, 4] as DayIndex[], range: { start: 480, end: 1020 } };
  const nineToTen = (day: DayIndex) => ({ day, start: 540, end: 600 });
  const placed = (day: DayIndex, lane: number, lanes: number) => {
    const rect = blockRect(grid, nineToTen(day), lane, lanes);
    if (!rect) throw new Error(`expected day ${day} to be drawn`);
    return rect;
  };

  it("places a class by day and time, and not at all on a hidden day", () => {
    const monday = placed(0, 0, 1);
    const tuesday = placed(1, 0, 1);
    expect(tuesday.x).toBeGreaterThan(monday.x);
    expect(monday.height).toBeGreaterThan(60);
    expect(blockRect(grid, nineToTen(6), 0, 1)).toBeNull();
  });

  it("splits the column between clashing classes", () => {
    const whole = placed(0, 0, 1);
    const first = placed(0, 0, 2);
    const second = placed(0, 1, 2);
    expect(second.x).toBeGreaterThan(first.x);
    expect(first.width).toBeLessThan(whole.width / 2);
  });
});
