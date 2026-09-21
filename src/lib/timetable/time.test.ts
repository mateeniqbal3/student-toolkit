import { describe, expect, it } from "vitest";

import {
  addDays,
  dayOfWeek,
  formatDuration,
  formatRange,
  formatTime,
  nextWeekday,
  parseDateInput,
  parseTime,
  toDateInput,
  toTimeInput,
} from "./time";

describe("times", () => {
  it("round-trips the time input's format", () => {
    expect(parseTime("09:30")).toBe(570);
    expect(toTimeInput(570)).toBe("09:30");
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("9.30")).toBeNull();
  });

  it("formats both clocks, including noon and midnight", () => {
    expect(formatTime(14 * 60 + 5, "24h")).toBe("14:05");
    expect(formatTime(14 * 60 + 5, "12h")).toBe("2:05 pm");
    expect(formatTime(12 * 60, "12h")).toBe("12:00 pm");
    expect(formatTime(0, "12h")).toBe("12:00 am");
    expect(formatTime(24 * 60, "24h")).toBe("24:00");
    expect(formatRange(540, 630, "24h")).toBe("09:00–10:30");
  });

  it("describes durations the way people say them", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(810)).toBe("13 h 30 min");
  });
});

describe("dates", () => {
  it("reads and writes the date input's format, rejecting impossible dates", () => {
    expect(parseDateInput("2026-09-21")).toEqual({ year: 2026, month: 9, day: 21 });
    expect(parseDateInput("2026-02-30")).toBeNull();
    expect(toDateInput({ year: 2026, month: 1, day: 5 })).toBe("2026-01-05");
  });

  it("counts weekdays from Monday", () => {
    expect(dayOfWeek({ year: 2026, month: 9, day: 21 })).toBe(0); // a Monday
    expect(dayOfWeek({ year: 2026, month: 9, day: 27 })).toBe(6); // a Sunday
  });

  it("finds the next occurrence of a weekday, including the same day", () => {
    const monday = { year: 2026, month: 9, day: 21 };
    expect(nextWeekday(monday, 0)).toEqual(monday);
    expect(nextWeekday(monday, 2)).toEqual({ year: 2026, month: 9, day: 23 });
    expect(nextWeekday({ year: 2026, month: 9, day: 24 }, 0)).toEqual({
      year: 2026,
      month: 9,
      day: 28,
    });
  });

  it("adds days across month, year and daylight-saving boundaries", () => {
    expect(addDays({ year: 2026, month: 12, day: 30 }, 3)).toEqual({
      year: 2027,
      month: 1,
      day: 2,
    });
    // Europe and North America change clocks in late March.
    expect(addDays({ year: 2026, month: 3, day: 28 }, 2)).toEqual({
      year: 2026,
      month: 3,
      day: 30,
    });
  });
});
