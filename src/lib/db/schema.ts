import Dexie, { type EntityTable, type Table } from "dexie";

import type { CitationStyleId, CslItem } from "@/lib/citation/types";
import type { SrsState } from "@/lib/flashcards/scheduler";
import type { RateTable } from "@/lib/currency/rates";
import type { Course } from "@/lib/gpa/calculate";
import type { TimetableEntry, TimetableSettings } from "@/lib/timetable/types";
import type { GradeDefinition } from "@/lib/gpa/scales";

/**
 * The single IndexedDB database for the whole app.
 *
 * Every tool that stores more than a preference gets a table here. Two rules
 * hold across all of them:
 *
 * - **Embedded over relational.** A semester's courses live inside the
 *   semester record. IndexedDB has no joins, these collections are small and
 *   always read together, and one `put` is then one atomic save.
 * - **Migrations are additive.** Each schema change is a new `version(n)`
 *   block and earlier blocks are never edited. A student who last opened the
 *   app six months ago must be upgraded, never reset.
 *
 * Constructing the class is safe on the server; only queries need a real
 * IndexedDB, which is why every caller is a client component.
 */

export interface SemesterRecord {
  id: number;
  name: string;
  /** Position in the transcript. Kept explicit so semesters can be reordered. */
  order: number;
  courses: Course[];
}

export interface GradingScaleRecord {
  id: number;
  name: string;
  /** Highest attainable grade point, derived from the grades on save. */
  max: number;
  grades: GradeDefinition[];
}

/**
 * One cached rate table per base currency, keyed by the base itself rather
 * than an auto-increment id: there is only ever one current table per base,
 * and keying it this way makes a refresh a `put` instead of a find-then-update.
 */
export type CurrencyRateRecord = RateTable;

/** A named bibliography: one essay, one thesis chapter, one module. */
export interface CitationProjectRecord {
  id: number;
  name: string;
  /** Each project remembers its style, because each assignment has its own. */
  style: CitationStyleId;
  createdAt: number;
}

/**
 * One source. The CSL-JSON is stored as-is, which is what lets the same
 * record render in any style and export to BibTeX or RIS unchanged.
 */
export interface CitationRecord {
  id: number;
  projectId: number;
  createdAt: number;
  updatedAt: number;
  item: CslItem;
}

/**
 * One named timetable — a semester, or one of several options a student is
 * weighing up. Its classes are embedded: they are always read together, and
 * one `put` saves the whole week atomically.
 */
export interface TimetableRecord {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: TimetableSettings;
  entries: TimetableEntry[];
}

export interface DeckRecord {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** How many unseen cards a day's study may introduce. */
  newPerDay: number;
}

/**
 * One flashcard. Cards are their own table, not embedded in the deck: they
 * are reviewed one at a time, dozens of times a session, and a deck can hold
 * hundreds, so rewriting the whole deck on every answer would be waste.
 */
export interface CardRecord {
  id: number;
  deckId: number;
  front: string;
  back: string;
  createdAt: number;
  updatedAt: number;
  srs: SrsState;
}

class StudentToolkitDatabase extends Dexie {
  semesters!: EntityTable<SemesterRecord, "id">;
  gradingScales!: EntityTable<GradingScaleRecord, "id">;
  currencyRates!: Table<CurrencyRateRecord, string>;
  citationProjects!: EntityTable<CitationProjectRecord, "id">;
  citations!: EntityTable<CitationRecord, "id">;
  timetables!: EntityTable<TimetableRecord, "id">;
  decks!: EntityTable<DeckRecord, "id">;
  cards!: EntityTable<CardRecord, "id">;

  constructor() {
    super("student-toolkit");

    // Version 1 — GPA calculator. Courses are embedded in the semester; only
    // the fields queried or sorted on are indexed.
    this.version(1).stores({
      semesters: "++id, order",
      gradingScales: "++id, name",
    });

    // Version 2 — the currency side of the unit converter.
    this.version(2).stores({
      currencyRates: "base",
    });

    // Version 3 — the citation generator. Sources are their own table rather
    // than embedded in the project, because they are edited one at a time and
    // a bibliography can grow to hundreds of them.
    this.version(3).stores({
      citationProjects: "++id, name",
      citations: "++id, projectId, createdAt",
    });

    // Version 4 — the timetable maker. Classes are embedded in the timetable.
    this.version(4).stores({
      timetables: "++id, name, updatedAt",
    });

    // Version 5 — flashcards. Cards are read a deck at a time and the study
    // queue is worked out in memory, so the deck is the only index needed.
    this.version(5).stores({
      decks: "++id, name, updatedAt",
      cards: "++id, deckId",
    });
  }
}

export const db = new StudentToolkitDatabase();
