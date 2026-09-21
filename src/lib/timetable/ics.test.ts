import { describe, expect, it } from "vitest";

import { buildIcs, escapeText, foldLine } from "./ics";
import type { TimetableEntry } from "./types";

const LECTURE: TimetableEntry = {
  id: "abc",
  title: "Linear Algebra",
  kind: "lecture",
  day: 2, // Wednesday
  start: 9 * 60,
  end: 10 * 60 + 30,
  location: "LT-3, Block A",
  instructor: "Dr. Khan",
  colour: 1,
};

const OPTIONS = {
  calendarName: "Fall 2026",
  termStart: { year: 2026, month: 9, day: 21 }, // a Monday
  termEnd: { year: 2026, month: 12, day: 31 },
  kindLabel: (kind: string) => (kind === "lecture" ? "Lecture" : kind),
  now: new Date(Date.UTC(2026, 8, 21, 12, 0, 0)),
};

function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n");
}

describe("buildIcs", () => {
  it("writes a weekly event starting on the first matching day of term", () => {
    const lines = unfold(buildIcs([LECTURE], OPTIONS));

    expect(lines).toContain("DTSTART:20260923T090000");
    expect(lines).toContain("DTEND:20260923T103000");
    expect(lines).toContain("RRULE:FREQ=WEEKLY;UNTIL=20261231T235959");
    expect(lines).toContain("SUMMARY:Linear Algebra");
    expect(lines).toContain("LOCATION:LT-3\\, Block A");
    expect(lines).toContain("DESCRIPTION:Lecture · Dr. Khan");
    expect(lines).toContain("UID:abc@student-toolkit");
    expect(lines).toContain("DTSTAMP:20260921T120000Z");
    expect(lines).toContain("X-WR-CALNAME:Fall 2026");
  });

  it("uses floating local times, with no zone for a calendar to shift", () => {
    const ics = buildIcs([LECTURE], OPTIONS);
    expect(ics).not.toMatch(/DTSTART[^:]*TZID/);
    expect(ics).not.toMatch(/DTSTART:\d{8}T\d{6}Z/);
  });

  it("ends every line with CRLF, as the standard requires", () => {
    const ics = buildIcs([LECTURE], OPTIONS);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("skips a class whose weekday never falls within the term", () => {
    const ics = buildIcs([{ ...LECTURE, day: 6 }], {
      ...OPTIONS,
      termStart: { year: 2026, month: 9, day: 21 },
      termEnd: { year: 2026, month: 9, day: 25 },
    });
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});

describe("escapeText", () => {
  it("escapes the characters iCalendar treats as structure", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Short")).toBe("SUMMARY:Short");
  });

  it("folds at 75 octets without splitting a multi-byte character", () => {
    const line = `SUMMARY:${"ریاضی ".repeat(20)}`;
    const folded = foldLine(line);
    const encoder = new TextEncoder();
    for (const part of folded.split("\r\n")) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});
