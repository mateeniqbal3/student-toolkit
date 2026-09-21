/**
 * Clash detection and grid layout.
 */
import type { CourseColour, DayIndex, TimetableEntry } from "./types";
import { COURSE_COLOURS } from "./types";

export interface Clash {
  a: TimetableEntry;
  b: TimetableEntry;
  day: DayIndex;
  /** The overlapping window, which is what a student needs to resolve it. */
  start: number;
  end: number;
}

/**
 * Two classes clash when their times overlap on the same day. Back-to-back
 * classes — one ending at 10:00, the next starting at 10:00 — do not clash:
 * that is how most timetables are built.
 */
export function overlaps(a: TimetableEntry, b: TimetableEntry): boolean {
  return a.day === b.day && a.start < b.end && b.start < a.end;
}

export function findClashes(entries: readonly TimetableEntry[]): Clash[] {
  const sorted = [...entries].sort((x, y) => x.day - y.day || x.start - y.start || x.end - y.end);
  const clashes: Clash[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i];
      const b = sorted[j];
      // Sorted by day then start, so once b starts after a ends, nothing later can overlap a.
      if (b.day !== a.day || b.start >= a.end) break;
      clashes.push({
        a,
        b,
        day: a.day,
        start: Math.max(a.start, b.start),
        end: Math.min(a.end, b.end),
      });
    }
  }
  return clashes;
}

export function clashingIds(clashes: readonly Clash[]): Set<string> {
  return new Set(clashes.flatMap((clash) => [clash.a.id, clash.b.id]));
}

/** Which of the existing entries a proposed one would clash with. */
export function clashesWith(
  candidate: Pick<TimetableEntry, "day" | "start" | "end">,
  entries: readonly TimetableEntry[],
  ignoreId?: string,
): TimetableEntry[] {
  return entries.filter(
    (entry) =>
      entry.id !== ignoreId &&
      entry.day === candidate.day &&
      entry.start < candidate.end &&
      candidate.start < entry.end,
  );
}

export interface PlacedEntry {
  entry: TimetableEntry;
  /** Which side-by-side column the entry takes within its group of overlapping entries. */
  lane: number;
  /** How many columns that group needs. */
  lanes: number;
}

/**
 * Lays out one day's entries so clashing ones sit side by side instead of on
 * top of each other, the way calendar apps do. Entries are grouped into runs
 * that overlap transitively; each run gets as many lanes as its busiest
 * moment needs, and each entry takes the first lane free when it starts.
 */
export function layoutDay(entries: readonly TimetableEntry[]): PlacedEntry[] {
  const sorted = [...entries].sort((x, y) => x.start - y.start || y.end - x.end);
  const placed: PlacedEntry[] = [];

  let group: PlacedEntry[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;

  const closeGroup = () => {
    for (const item of group) item.lanes = laneEnds.length;
    placed.push(...group);
    group = [];
    laneEnds = [];
  };

  for (const entry of sorted) {
    if (group.length > 0 && entry.start >= groupEnd) closeGroup();

    let lane = laneEnds.findIndex((end) => end <= entry.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(entry.end);
    } else {
      laneEnds[lane] = entry.end;
    }

    group.push({ entry, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, entry.end);
  }
  if (group.length > 0) closeGroup();

  return placed;
}

/**
 * The time range the grid draws: the student's chosen hours, stretched to
 * whole hours around any class that falls outside them, so no entry is ever
 * cut off because the settings are narrower than the timetable.
 */
export function visibleRange(
  entries: readonly TimetableEntry[],
  startMinute: number,
  endMinute: number,
): { start: number; end: number } {
  const earliest = Math.min(startMinute, ...entries.map((entry) => entry.start));
  const latest = Math.max(endMinute, ...entries.map((entry) => entry.end));
  const start = Math.floor(earliest / 60) * 60;
  const end = Math.max(Math.ceil(latest / 60) * 60, start + 60);
  return { start, end };
}

/**
 * The same course keeps the same colour: a new "Physics" lab picks up the
 * colour the "Physics" lecture already has. A new course takes the least-used
 * colour, so the grid stays as varied as it can.
 */
export function suggestColour(entries: readonly TimetableEntry[], title: string): CourseColour {
  const key = title.trim().toLowerCase();
  if (key) {
    const match = entries.find((entry) => entry.title.trim().toLowerCase() === key);
    if (match) return match.colour;
  }

  const usage = new Map<CourseColour, number>(COURSE_COLOURS.map((colour) => [colour, 0]));
  for (const entry of entries) usage.set(entry.colour, (usage.get(entry.colour) ?? 0) + 1);
  return COURSE_COLOURS.reduce((best, colour) =>
    (usage.get(colour) ?? 0) < (usage.get(best) ?? 0) ? colour : best,
  );
}

/** Weekly contact hours, the number students compare between timetable options. */
export function weeklyMinutes(entries: readonly TimetableEntry[]): number {
  return entries.reduce((total, entry) => total + (entry.end - entry.start), 0);
}
