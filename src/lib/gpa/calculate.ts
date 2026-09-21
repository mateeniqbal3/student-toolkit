/**
 * GPA arithmetic.
 *
 * Everything here is a pure function over plain data so the rules can be
 * unit-tested directly, without a component in the way. The only subtlety is
 * that a half-filled row is normal — a student types a course name before they
 * have a grade for it — so incomplete rows are skipped rather than treated as
 * zeros, which would silently drag the average down.
 */
import type { GradeDefinition, GradingScale } from "./scales";

export interface Course {
  /** Stable across reorders and edits, so React keys and updates behave. */
  id: string;
  name: string;
  /** Credit hours. Zero-credit courses are audited and excluded. */
  credits: number;
  /** A letter for letter scales, a number as text for percentage scales. */
  grade: string;
}

export interface Semester {
  id: string;
  name: string;
  courses: Course[];
}

export interface GpaResult {
  /** Null when nothing countable has been entered yet. */
  gpa: number | null;
  /** Credits that actually counted, ignoring incomplete rows. */
  totalCredits: number;
  /** Sum of points times credits — the numerator of the average. */
  qualityPoints: number;
  countedCourses: number;
  /** Rows skipped because the grade or the credits were missing or invalid. */
  skippedCourses: number;
}

export interface SemesterResult {
  id: string;
  name: string;
  result: GpaResult;
}

export interface CgpaResult extends GpaResult {
  semesters: SemesterResult[];
}

const EMPTY_RESULT: GpaResult = {
  gpa: null,
  totalCredits: 0,
  qualityPoints: 0,
  countedCourses: 0,
  skippedCourses: 0,
};

/**
 * Resolves what a typed grade is worth, or null when it is not a grade on this
 * scale yet. Letter matching ignores case and surrounding space because a
 * student typing "a-" means the same thing as picking "A-".
 */
export function pointsForGrade(scale: GradingScale, grade: string): number | null {
  const entry = grade.trim();
  if (entry === "") return null;

  if (scale.mode === "percentage") {
    const percent = Number(entry);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
    return percent;
  }

  const match = scale.grades.find(
    (definition) => definition.letter.toLowerCase() === entry.toLowerCase(),
  );
  return match ? match.points : null;
}

/** The letter a mark earns on this scale, for the marks-to-grade helper. */
export function letterForPercent(scale: GradingScale, percent: number): GradeDefinition | null {
  if (!Number.isFinite(percent) || scale.mode === "percentage") return null;
  return scale.grades.find((definition) => percent >= definition.minPercent) ?? null;
}

function isCountableCredits(credits: number): boolean {
  return Number.isFinite(credits) && credits > 0;
}

export function calculateGpa(courses: readonly Course[], scale: GradingScale): GpaResult {
  let qualityPoints = 0;
  let totalCredits = 0;
  let countedCourses = 0;
  let skippedCourses = 0;

  for (const course of courses) {
    const points = pointsForGrade(scale, course.grade);
    if (points === null || !isCountableCredits(course.credits)) {
      // A row the student has not finished filling in. Counting it as a zero
      // would be worse than useless: it would show a failing GPA mid-typing.
      skippedCourses += 1;
      continue;
    }

    qualityPoints += points * course.credits;
    totalCredits += course.credits;
    countedCourses += 1;
  }

  return {
    gpa: totalCredits > 0 ? qualityPoints / totalCredits : null,
    totalCredits,
    qualityPoints,
    countedCourses,
    skippedCourses,
  };
}

/**
 * Cumulative GPA is the credit-weighted average over every course in every
 * semester, not the average of the semester GPAs. Those two differ whenever
 * semesters carry different credit loads, and the second one is the mistake
 * students most often make by hand.
 */
export function calculateCgpa(semesters: readonly Semester[], scale: GradingScale): CgpaResult {
  const perSemester = semesters.map((semester) => ({
    id: semester.id,
    name: semester.name,
    result: calculateGpa(semester.courses, scale),
  }));

  const totals = perSemester.reduce<GpaResult>(
    (accumulator, { result }) => ({
      gpa: null,
      totalCredits: accumulator.totalCredits + result.totalCredits,
      qualityPoints: accumulator.qualityPoints + result.qualityPoints,
      countedCourses: accumulator.countedCourses + result.countedCourses,
      skippedCourses: accumulator.skippedCourses + result.skippedCourses,
    }),
    EMPTY_RESULT,
  );

  return {
    ...totals,
    gpa: totals.totalCredits > 0 ? totals.qualityPoints / totals.totalCredits : null,
    semesters: perSemester,
  };
}

export type TargetVerdict =
  | "invalid"
  | "already-there"
  | "achievable"
  | "impossible"
  /** Reachable only with a perfect or near-perfect term — worth flagging. */
  | "demanding";

export interface TargetInput {
  targetCgpa: number;
  currentCgpa: number;
  completedCredits: number;
  /** Credits the student is about to take. The unknown is their average. */
  plannedCredits: number;
  scaleMax: number;
}

export interface TargetResult {
  /** The GPA the coming term must average. Null when the question is ill-posed. */
  required: number | null;
  verdict: TargetVerdict;
  /** The arithmetic written out, so the answer can be checked by hand. */
  formula: string | null;
}

/**
 * Solves the question students actually ask: "what do I need this semester?"
 *
 *   target = (current x completed + required x planned) / (completed + planned)
 *
 * rearranged for `required`.
 */
export function gpaNeededForTarget(input: TargetInput): TargetResult {
  const { targetCgpa, currentCgpa, completedCredits, plannedCredits, scaleMax } = input;

  const finite = [targetCgpa, currentCgpa, completedCredits, plannedCredits, scaleMax].every(
    (value) => Number.isFinite(value),
  );
  const inRange =
    finite &&
    plannedCredits > 0 &&
    completedCredits >= 0 &&
    scaleMax > 0 &&
    targetCgpa >= 0 &&
    targetCgpa <= scaleMax &&
    currentCgpa >= 0 &&
    currentCgpa <= scaleMax;

  if (!inRange) return { required: null, verdict: "invalid", formula: null };

  const totalCredits = completedCredits + plannedCredits;
  const required = (targetCgpa * totalCredits - currentCgpa * completedCredits) / plannedCredits;

  const formula =
    `(${targetCgpa} × ${totalCredits} − ${currentCgpa} × ${completedCredits}) ÷ ${plannedCredits}` +
    ` = ${required.toFixed(2)}`;

  if (required <= 0) return { required, verdict: "already-there", formula };
  if (required > scaleMax) return { required, verdict: "impossible", formula };
  // Within a rounding step of the ceiling: technically possible, practically a
  // clean sweep, and saying so is more useful than a bare number.
  if (required > scaleMax - 0.15) return { required, verdict: "demanding", formula };
  return { required, verdict: "achievable", formula };
}

/** Grade points are conventionally shown to two decimals, and never rounded up. */
export function formatPoints(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}
