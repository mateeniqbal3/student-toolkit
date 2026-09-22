import { describe, expect, it } from "vitest";

import { addDays, chartCeiling, dayTotal, startOfWeek, weekTotals, wholeMinutes } from "./stats";
import { MINUTE } from "./timer";

// Tuesday 22 September 2026, mid-morning.
const NOW = new Date(2026, 8, 22, 10, 30).getTime();

function session(start: Date, minutes: number, completed = true) {
  return { startedAt: start.getTime(), durationMs: minutes * MINUTE, completed };
}

describe("weeks and days", () => {
  it("starts the week on Monday at local midnight", () => {
    expect(startOfWeek(NOW)).toBe(new Date(2026, 8, 21).getTime());
    // A Sunday belongs to the week that began six days earlier.
    expect(startOfWeek(new Date(2026, 8, 27, 23, 0).getTime())).toBe(
      new Date(2026, 8, 21).getTime(),
    );
  });

  it("steps by calendar day, across a month end", () => {
    expect(addDays(new Date(2026, 8, 28).getTime(), 3)).toBe(new Date(2026, 9, 1).getTime());
  });
});

describe("totals", () => {
  const sessions = [
    session(new Date(2026, 8, 21, 9, 0), 25),
    session(new Date(2026, 8, 22, 8, 0), 25),
    session(new Date(2026, 8, 22, 9, 0), 12, false),
    // Started just before midnight on Monday: counted on Monday.
    session(new Date(2026, 8, 21, 23, 50), 25),
    // The Sunday before this week.
    session(new Date(2026, 8, 20, 18, 0), 50),
  ];

  it("sums today, counting only full pomodoros as pomodoros", () => {
    expect(dayTotal(sessions, NOW)).toEqual({
      start: new Date(2026, 8, 22).getTime(),
      focusMs: 37 * MINUTE,
      pomodoros: 1,
    });
  });

  it("gives seven days, Monday first, and leaves last week out", () => {
    const week = weekTotals(sessions, startOfWeek(NOW));
    expect(week).toHaveLength(7);
    expect(week.map((day) => wholeMinutes(day.focusMs))).toEqual([50, 37, 0, 0, 0, 0, 0]);
    expect(week[0]?.pomodoros).toBe(2);
  });
});

describe("chartCeiling", () => {
  it("rounds the busiest day up to a tidy scale", () => {
    expect(chartCeiling(0)).toBe(30);
    expect(chartCeiling(50)).toBe(60);
    expect(chartCeiling(125)).toBe(180);
    expect(chartCeiling(2000)).toBe(2040);
  });
});
