/**
 * Converting between minutes after midnight and the strings people read and
 * the browser's time and date inputs produce.
 */
import type { DateOnly, DayIndex } from "./types";

export const MINUTES_PER_DAY = 24 * 60;

/** Reads "09:30" (what `<input type="time">` always gives, whatever the locale). */
export function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** The value an `<input type="time">` expects: zero-padded 24-hour time. */
export function toTimeInput(minutes: number): string {
  const clamped = Math.min(Math.max(Math.round(minutes), 0), MINUTES_PER_DAY - 1);
  const hours = Math.floor(clamped / 60);
  return `${String(hours).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

export type ClockFormat = "12h" | "24h";

/**
 * "14:30" or "2:30 pm". Midnight at the end of a day is written 24:00 in the
 * 24-hour clock, because a class ending at midnight ends at the end of the
 * day, not at its start.
 */
export function formatTime(minutes: number, clock: ClockFormat): string {
  const hours = Math.floor(minutes / 60);
  const mins = String(minutes % 60).padStart(2, "0");
  if (clock === "24h") return `${String(hours).padStart(2, "0")}:${mins}`;

  const period = hours % 24 < 12 ? "am" : "pm";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${mins} ${period}`;
}

export function formatRange(start: number, end: number, clock: ClockFormat): string {
  return `${formatTime(start, clock)}–${formatTime(end, clock)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Reads "2026-09-21", the value of an `<input type="date">`. */
export function parseDateInput(value: string): DateOnly | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  // Round-tripping through UTC rejects 31 February and friends.
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return check.getUTCMonth() === date.month - 1 && check.getUTCDate() === date.day ? date : null;
}

export function toDateInput(date: DateOnly): string {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

/**
 * Date arithmetic is done in UTC, where every day is 24 hours long. Doing it
 * in local time would skip or repeat a day across a daylight-saving change.
 */
function toUtc(date: DateOnly): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

function fromUtc(ms: number): DateOnly {
  const date = new Date(ms);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function addDays(date: DateOnly, days: number): DateOnly {
  return fromUtc(toUtc(date) + days * 86_400_000);
}

export function compareDates(a: DateOnly, b: DateOnly): number {
  return toUtc(a) - toUtc(b);
}

/** Monday-based, to match DayIndex. */
export function dayOfWeek(date: DateOnly): DayIndex {
  return ((new Date(toUtc(date)).getUTCDay() + 6) % 7) as DayIndex;
}

/** The first date on or after `from` that falls on `day`. */
export function nextWeekday(from: DateOnly, day: DayIndex): DateOnly {
  return addDays(from, (day - dayOfWeek(from) + 7) % 7);
}

export function todayDate(now = new Date()): DateOnly {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}
