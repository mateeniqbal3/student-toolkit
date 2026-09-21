/**
 * The timetable model.
 *
 * Times are minutes after midnight rather than Date objects: a class is "every
 * Tuesday 10:00 to 11:30", which has no date and no time zone until it is
 * exported to a calendar, and integers make overlap checks plain arithmetic.
 */

/** Monday is 0, following ISO 8601 and the way most university timetables are printed. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const ALL_DAYS: readonly DayIndex[] = [0, 1, 2, 3, 4, 5, 6];

export const ENTRY_KINDS = ["lecture", "lab", "tutorial", "seminar", "other"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** Index into the `--course-1` … `--course-8` colour tokens. */
export const COURSE_COLOURS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type CourseColour = (typeof COURSE_COLOURS)[number];

export interface TimetableEntry {
  id: string;
  title: string;
  kind: EntryKind;
  day: DayIndex;
  /** Minutes after midnight. */
  start: number;
  /** Minutes after midnight; always after `start`. */
  end: number;
  location: string;
  instructor: string;
  colour: CourseColour;
}

/** A calendar date with no time or zone, as an `<input type="date">` gives it. */
export interface DateOnly {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
}

export interface TimetableSettings {
  /** Which days the grid shows, in week order. */
  days: DayIndex[];
  /** The earliest time the grid shows, in minutes; entries earlier than this still stretch it. */
  startMinute: number;
  endMinute: number;
  /** The term the calendar export repeats across. Unset until the student chooses. */
  termStart?: DateOnly;
  termEnd?: DateOnly;
}

export const DEFAULT_SETTINGS: TimetableSettings = {
  days: [0, 1, 2, 3, 4],
  startMinute: 8 * 60,
  endMinute: 17 * 60,
};
