/**
 * The class form's model.
 *
 * A new class can be put on several days at once, because a Monday-
 * Wednesday-Friday lecture is one thing to the student even though it is
 * three blocks on the grid. Once saved, each day is its own entry, so moving
 * Friday's lecture to a different room does not move Monday's.
 */
import { parseTime, toTimeInput } from "./time";
import type { CourseColour, DayIndex, EntryKind, TimetableEntry } from "./types";

export interface EntryDraft {
  title: string;
  kind: EntryKind;
  days: DayIndex[];
  /** As `<input type="time">` values. */
  start: string;
  end: string;
  location: string;
  instructor: string;
  colour: CourseColour;
}

export function newEntryDraft(
  day: DayIndex,
  start: number,
  colour: CourseColour,
  length = 60,
): EntryDraft {
  return {
    title: "",
    kind: "lecture",
    days: [day],
    start: toTimeInput(start),
    end: toTimeInput(Math.min(start + length, 24 * 60 - 1)),
    location: "",
    instructor: "",
    colour,
  };
}

export function draftFromEntry(entry: TimetableEntry): EntryDraft {
  return {
    title: entry.title,
    kind: entry.kind,
    days: [entry.day],
    start: toTimeInput(entry.start),
    end: toTimeInput(entry.end),
    location: entry.location,
    instructor: entry.instructor,
    colour: entry.colour,
  };
}

export type EntryProblem = "missing-title" | "no-days" | "bad-time" | "ends-before-start";

export function entryProblems(draft: EntryDraft): EntryProblem[] {
  const problems: EntryProblem[] = [];
  if (!draft.title.trim()) problems.push("missing-title");
  if (draft.days.length === 0) problems.push("no-days");

  const start = parseTime(draft.start);
  const end = parseTime(draft.end);
  if (start === null || end === null) problems.push("bad-time");
  else if (end <= start) problems.push("ends-before-start");
  return problems;
}

/** The parsed times of a draft, or null while they are not yet valid. */
export function draftTimes(draft: EntryDraft): { start: number; end: number } | null {
  const start = parseTime(draft.start);
  const end = parseTime(draft.end);
  return start !== null && end !== null && end > start ? { start, end } : null;
}

/**
 * One entry per chosen day. An edit keeps its id on the first day, so the
 * entry being edited is updated in place rather than replaced.
 */
export function entriesFromDraft(draft: EntryDraft, keepId?: string): TimetableEntry[] {
  const times = draftTimes(draft);
  if (!times || !draft.title.trim()) return [];

  const days = [...new Set(draft.days)].sort((a, b) => a - b);
  return days.map((day, index) => ({
    id: index === 0 && keepId ? keepId : crypto.randomUUID(),
    title: draft.title.trim(),
    kind: draft.kind,
    day,
    start: times.start,
    end: times.end,
    location: draft.location.trim(),
    instructor: draft.instructor.trim(),
    colour: draft.colour,
  }));
}
