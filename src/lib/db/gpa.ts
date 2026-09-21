/**
 * Typed accessors for the GPA tables.
 *
 * Components call these rather than touching Dexie directly, which keeps the
 * write patterns — read-modify-write on an embedded array, ordering rules,
 * the "always at least one semester" invariant — in one place where they can
 * be reasoned about.
 */
import type { Course } from "@/lib/gpa/calculate";
import { normalizeGrades, type GradeDefinition } from "@/lib/gpa/scales";

import { db, type GradingScaleRecord, type SemesterRecord } from "./schema";

/** Most courses are three credit hours, so that is the row a student starts from. */
const DEFAULT_CREDITS = 3;
const DEFAULT_ROWS = 4;

export function newCourse(): Course {
  return { id: crypto.randomUUID(), name: "", credits: DEFAULT_CREDITS, grade: "" };
}

function blankCourses(count = DEFAULT_ROWS): Course[] {
  return Array.from({ length: count }, newCourse);
}

/**
 * Gives a first-time visitor something to type into. The calculator is
 * useless with no rows, and an empty state that asks them to press "add
 * semester" before they can do anything is a step with no purpose.
 */
export async function ensureFirstSemester(): Promise<void> {
  await db.transaction("rw", db.semesters, async () => {
    if ((await db.semesters.count()) > 0) return;
    await db.semesters.add({ name: "Semester 1", order: 0, courses: blankCourses() });
  });
}

export async function addSemester(): Promise<number> {
  return db.transaction("rw", db.semesters, async () => {
    const existing = await db.semesters.toArray();
    const nextOrder = existing.reduce((max, row) => Math.max(max, row.order), -1) + 1;
    return db.semesters.add({
      name: `Semester ${existing.length + 1}`,
      order: nextOrder,
      courses: blankCourses(),
    });
  });
}

export async function renameSemester(id: number, name: string): Promise<void> {
  await db.semesters.update(id, { name });
}

/**
 * Deleting the last semester would leave the page with nothing to render, so
 * the final one is emptied rather than removed.
 */
export async function deleteSemester(id: number): Promise<void> {
  await db.transaction("rw", db.semesters, async () => {
    if ((await db.semesters.count()) <= 1) {
      await db.semesters.update(id, { name: "Semester 1", courses: blankCourses() });
      return;
    }
    await db.semesters.delete(id);
  });
}

async function mutateCourses(
  semesterId: number,
  mutate: (courses: Course[]) => Course[],
): Promise<void> {
  await db.transaction("rw", db.semesters, async () => {
    const semester = await db.semesters.get(semesterId);
    if (!semester) return;
    await db.semesters.update(semesterId, { courses: mutate(semester.courses) });
  });
}

export async function addCourse(semesterId: number): Promise<void> {
  await mutateCourses(semesterId, (courses) => [...courses, newCourse()]);
}

export async function updateCourse(
  semesterId: number,
  courseId: string,
  patch: Partial<Omit<Course, "id">>,
): Promise<void> {
  await mutateCourses(semesterId, (courses) =>
    courses.map((course) => (course.id === courseId ? { ...course, ...patch } : course)),
  );
}

export async function removeCourse(semesterId: number, courseId: string): Promise<void> {
  await mutateCourses(semesterId, (courses) => {
    const remaining = courses.filter((course) => course.id !== courseId);
    // Same reasoning as the last semester: never leave nothing to type into.
    return remaining.length > 0 ? remaining : blankCourses(1);
  });
}

export async function clearSemesters(): Promise<void> {
  await db.transaction("rw", db.semesters, async () => {
    await db.semesters.clear();
    await db.semesters.add({ name: "Semester 1", order: 0, courses: blankCourses() });
  });
}

export async function saveCustomScale(
  scale: Omit<GradingScaleRecord, "id" | "max"> & { id?: number },
): Promise<number> {
  const grades: GradeDefinition[] = normalizeGrades(scale.grades);
  const max = grades.reduce((highest, grade) => Math.max(highest, grade.points), 0);

  if (scale.id !== undefined) {
    await db.gradingScales.update(scale.id, { name: scale.name, grades, max });
    return scale.id;
  }
  return db.gradingScales.add({ name: scale.name, grades, max });
}

export async function deleteCustomScale(id: number): Promise<void> {
  await db.gradingScales.delete(id);
}

export type { GradingScaleRecord, SemesterRecord };
