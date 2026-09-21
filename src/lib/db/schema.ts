import Dexie, { type EntityTable } from "dexie";

import type { Course } from "@/lib/gpa/calculate";
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

class StudentToolkitDatabase extends Dexie {
  semesters!: EntityTable<SemesterRecord, "id">;
  gradingScales!: EntityTable<GradingScaleRecord, "id">;

  constructor() {
    super("student-toolkit");

    // Version 1 — GPA calculator. Courses are embedded in the semester; only
    // the fields queried or sorted on are indexed.
    this.version(1).stores({
      semesters: "++id, order",
      gradingScales: "++id, name",
    });
  }
}

export const db = new StudentToolkitDatabase();
