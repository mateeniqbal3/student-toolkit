import { describe, expect, it } from "vitest";

import {
  clashesWith,
  findClashes,
  layoutDay,
  suggestColour,
  visibleRange,
  weeklyMinutes,
} from "./schedule";
import type { DayIndex, TimetableEntry } from "./types";

function entry(
  id: string,
  day: DayIndex,
  start: string,
  end: string,
  extra: Partial<TimetableEntry> = {},
): TimetableEntry {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return {
    id,
    title: id,
    kind: "lecture",
    day,
    start: minutes(start),
    end: minutes(end),
    location: "",
    instructor: "",
    colour: 1,
    ...extra,
  };
}

describe("findClashes", () => {
  it("reports overlapping classes with the overlapping window", () => {
    const clashes = findClashes([
      entry("maths", 1, "09:00", "10:30"),
      entry("physics", 1, "10:00", "11:00"),
    ]);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toMatchObject({ day: 1, start: 600, end: 630 });
  });

  it("does not count back-to-back classes as a clash", () => {
    expect(findClashes([entry("a", 0, "09:00", "10:00"), entry("b", 0, "10:00", "11:00")])).toEqual(
      [],
    );
  });

  it("does not compare classes on different days", () => {
    expect(findClashes([entry("a", 0, "09:00", "10:00"), entry("b", 1, "09:00", "10:00")])).toEqual(
      [],
    );
  });

  it("finds every pair when a long class overlaps several short ones", () => {
    const clashes = findClashes([
      entry("lab", 2, "09:00", "12:00"),
      entry("a", 2, "09:30", "10:00"),
      entry("b", 2, "11:00", "11:30"),
    ]);
    expect(clashes.map((clash) => [clash.a.id, clash.b.id])).toEqual([
      ["lab", "a"],
      ["lab", "b"],
    ]);
  });
});

describe("clashesWith", () => {
  it("ignores the entry being edited", () => {
    const existing = [entry("a", 0, "09:00", "10:00")];
    expect(clashesWith({ day: 0, start: 540, end: 600 }, existing, "a")).toEqual([]);
    expect(clashesWith({ day: 0, start: 570, end: 630 }, existing)).toHaveLength(1);
  });
});

describe("layoutDay", () => {
  it("gives a lone class the full width", () => {
    expect(layoutDay([entry("a", 0, "09:00", "10:00")])).toMatchObject([{ lane: 0, lanes: 1 }]);
  });

  it("puts clashing classes side by side", () => {
    const placed = layoutDay([entry("a", 0, "09:00", "10:30"), entry("b", 0, "10:00", "11:00")]);
    expect(placed.map((item) => [item.entry.id, item.lane, item.lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
    ]);
  });

  it("reuses a lane once it is free, and only widens the group that needs it", () => {
    const placed = layoutDay([
      entry("long", 0, "09:00", "12:00"),
      entry("first", 0, "09:00", "10:00"),
      entry("second", 0, "10:00", "11:00"),
      entry("later", 0, "13:00", "14:00"),
    ]);
    const byId = Object.fromEntries(placed.map((item) => [item.entry.id, item]));
    expect(byId.first.lane).toBe(1);
    expect(byId.second.lane).toBe(1);
    expect(byId.long.lanes).toBe(2);
    expect(byId.later).toMatchObject({ lane: 0, lanes: 1 });
  });
});

describe("visibleRange", () => {
  it("uses the chosen hours, stretched to whole hours around outlying classes", () => {
    expect(visibleRange([], 480, 1020)).toEqual({ start: 480, end: 1020 });
    expect(visibleRange([entry("early", 0, "07:30", "08:15")], 480, 1020)).toEqual({
      start: 420,
      end: 1020,
    });
    expect(visibleRange([entry("late", 0, "17:00", "18:10")], 480, 1020)).toEqual({
      start: 480,
      end: 1140,
    });
  });
});

describe("suggestColour", () => {
  it("keeps a course's colour for its other classes", () => {
    const existing = [entry("x", 0, "09:00", "10:00", { title: "Physics", colour: 5 })];
    expect(suggestColour(existing, " physics ")).toBe(5);
  });

  it("gives a new course the least-used colour", () => {
    const existing = [
      entry("a", 0, "09:00", "10:00", { colour: 1 }),
      entry("b", 0, "10:00", "11:00", { colour: 2 }),
    ];
    expect(suggestColour(existing, "Chemistry")).toBe(3);
    expect(suggestColour([], "")).toBe(1);
  });
});

describe("weeklyMinutes", () => {
  it("adds up contact time", () => {
    expect(weeklyMinutes([entry("a", 0, "09:00", "10:30"), entry("b", 3, "14:00", "15:00")])).toBe(
      150,
    );
  });
});
