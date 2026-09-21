/**
 * Typed accessors for the timetables table.
 *
 * Invariants kept here rather than in components: there is always at least
 * one timetable, every write bumps `updatedAt`, and entries are changed with
 * read-modify-write inside a transaction so two quick edits cannot lose one
 * another.
 */
import {
  DEFAULT_SETTINGS,
  type TimetableEntry,
  type TimetableSettings,
} from "@/lib/timetable/types";

import { db, type TimetableRecord } from "./schema";

function blankTimetable(name: string): Omit<TimetableRecord, "id"> {
  const now = Date.now();
  return {
    name,
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_SETTINGS, days: [...DEFAULT_SETTINGS.days] },
    entries: [],
  };
}

/** The name is passed in because it is user-facing copy. */
export async function ensureFirstTimetable(name: string): Promise<void> {
  await db.transaction("rw", db.timetables, async () => {
    if ((await db.timetables.count()) > 0) return;
    await db.timetables.add(blankTimetable(name));
  });
}

export async function addTimetable(name: string): Promise<number> {
  return db.timetables.add(blankTimetable(name));
}

/**
 * Copies a timetable with fresh entry ids, so a student can try a different
 * section of one course without rebuilding the rest of the week.
 */
export async function duplicateTimetable(id: number, name: string): Promise<number | undefined> {
  return db.transaction("rw", db.timetables, async () => {
    const source = await db.timetables.get(id);
    if (!source) return undefined;
    const now = Date.now();
    return db.timetables.add({
      name,
      createdAt: now,
      updatedAt: now,
      settings: structuredClone(source.settings),
      entries: source.entries.map((entry) => ({ ...entry, id: crypto.randomUUID() })),
    });
  });
}

export async function renameTimetable(id: number, name: string): Promise<void> {
  await db.timetables.update(id, { name, updatedAt: Date.now() });
}

/**
 * The last timetable is emptied rather than deleted, like the GPA
 * calculator's last semester. Returns the id that should now be selected.
 */
export async function deleteTimetable(id: number, fallbackName: string): Promise<number> {
  return db.transaction("rw", db.timetables, async () => {
    const other = await db.timetables.filter((row) => row.id !== id).first();
    if (!other) {
      await db.timetables.update(id, { ...blankTimetable(fallbackName) });
      return id;
    }
    await db.timetables.delete(id);
    return other.id;
  });
}

export async function updateSettings(id: number, patch: Partial<TimetableSettings>): Promise<void> {
  await db.transaction("rw", db.timetables, async () => {
    const row = await db.timetables.get(id);
    if (!row) return;
    await db.timetables.update(id, {
      settings: { ...row.settings, ...patch },
      updatedAt: Date.now(),
    });
  });
}

async function mutateEntries(
  id: number,
  mutate: (entries: TimetableEntry[]) => TimetableEntry[],
): Promise<void> {
  await db.transaction("rw", db.timetables, async () => {
    const row = await db.timetables.get(id);
    if (!row) return;
    await db.timetables.update(id, { entries: mutate(row.entries), updatedAt: Date.now() });
  });
}

export async function addEntries(id: number, entries: TimetableEntry[]): Promise<void> {
  await mutateEntries(id, (current) => [...current, ...entries]);
}

export async function updateEntry(id: number, entry: TimetableEntry): Promise<void> {
  await mutateEntries(id, (current) =>
    current.map((existing) => (existing.id === entry.id ? entry : existing)),
  );
}

/** Returns the removed entry so the page can offer to put it back. */
export async function removeEntry(
  id: number,
  entryId: string,
): Promise<TimetableEntry | undefined> {
  let removed: TimetableEntry | undefined;
  await mutateEntries(id, (current) => {
    removed = current.find((entry) => entry.id === entryId);
    return current.filter((entry) => entry.id !== entryId);
  });
  return removed;
}

export async function clearEntries(id: number): Promise<void> {
  await mutateEntries(id, () => []);
}

export type { TimetableRecord };
