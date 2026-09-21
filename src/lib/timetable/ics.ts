/**
 * iCalendar export, so a timetable can be imported into Google Calendar,
 * Apple Calendar or Outlook as recurring events.
 *
 * Every class becomes one weekly-repeating event that starts on its first
 * occurrence in the term and repeats until the term ends.
 *
 * Times are written as "floating" local times (RFC 5545 §3.3.5): no time zone,
 * so a 9:00 class is 9:00 in whatever zone the calendar is set to. That is
 * exactly what a class timetable means, and it avoids hand-writing VTIMEZONE
 * definitions, which are where hand-rolled iCalendar files usually go wrong.
 */
import { compareDates, nextWeekday } from "./time";
import type { DateOnly, EntryKind, TimetableEntry } from "./types";

export interface IcsOptions {
  calendarName: string;
  termStart: DateOnly;
  termEnd: DateOnly;
  /** The label for a kind of class, supplied by the caller because it is user-facing copy. */
  kindLabel: (kind: EntryKind) => string;
  /** Stamp for DTSTAMP; injectable so tests are deterministic. */
  now?: Date;
}

/** Commas, semicolons, backslashes and newlines are structural in iCalendar text. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Lines longer than 75 octets must be folded (§3.1). Octets, not characters:
 * an Urdu or accented course name is several bytes per letter, and folding in
 * the middle of one corrupts it, so this never splits a character.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let size = 0;
  // The first line may hold 75 octets; continuation lines lose one to the leading space.
  let limit = 75;

  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
      limit = 74;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

function localDateTime(date: DateOnly, minutes: number): string {
  return `${pad(date.year, 4)}${pad(date.month)}${pad(date.day)}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;
}

function utcStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

export function buildIcs(entries: readonly TimetableEntry[], options: IcsOptions): string {
  const stamp = utcStamp(options.now ?? new Date());
  // UNTIL must match DTSTART's form, so it is floating too; 23:59:59 on the
  // last day includes a class that meets that day.
  const until = localDateTime(options.termEnd, 23 * 60 + 59).replace(/00$/, "59");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Student Toolkit//Timetable Maker//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.calendarName)}`,
  ];

  const ordered = [...entries].sort((a, b) => a.day - b.day || a.start - b.start);
  for (const entry of ordered) {
    const first = nextWeekday(options.termStart, entry.day);
    // A class whose weekday never falls inside the term has nothing to export.
    if (compareDates(first, options.termEnd) > 0) continue;

    const kind = options.kindLabel(entry.kind);
    const details = [kind, entry.instructor.trim()].filter(Boolean).join(" · ");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${entry.id}@student-toolkit`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${localDateTime(first, entry.start)}`,
      `DTEND:${localDateTime(first, entry.end)}`,
      `RRULE:FREQ=WEEKLY;UNTIL=${until}`,
      `SUMMARY:${escapeText(entry.title.trim() || kind)}`,
    );
    if (entry.location.trim()) lines.push(`LOCATION:${escapeText(entry.location.trim())}`);
    if (details) lines.push(`DESCRIPTION:${escapeText(details)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // CRLF line endings are required, including after the last line.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
