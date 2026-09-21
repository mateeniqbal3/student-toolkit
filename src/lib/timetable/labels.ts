/**
 * User-facing names for the timetable's vocabulary, kept apart from the
 * logic so translation has one place to plug in.
 *
 * Day names come from Intl rather than a hard-coded list, so they translate
 * themselves once the locale changes. The locale is fixed for now, because
 * letting the server and the browser choose separately would render
 * different text and fail hydration.
 */
import type { DayIndex, EntryKind } from "./types";

export const TIMETABLE_LOCALE = "en-GB";

/** 1 January 2024 was a Monday, so day N of the week is N days later. */
const A_MONDAY = Date.UTC(2024, 0, 1);

const formatters = {
  long: new Intl.DateTimeFormat(TIMETABLE_LOCALE, { weekday: "long", timeZone: "UTC" }),
  short: new Intl.DateTimeFormat(TIMETABLE_LOCALE, { weekday: "short", timeZone: "UTC" }),
};

export function dayName(day: DayIndex, width: "long" | "short" = "long"): string {
  return formatters[width].format(new Date(A_MONDAY + day * 86_400_000));
}

export const KIND_LABELS: Record<EntryKind, string> = {
  lecture: "Lecture",
  lab: "Lab",
  tutorial: "Tutorial",
  seminar: "Seminar",
  other: "Other",
};
