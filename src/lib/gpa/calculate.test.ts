import { describe, expect, it } from "vitest";

import {
  calculateCgpa,
  calculateGpa,
  formatPoints,
  gpaNeededForTarget,
  letterForPercent,
  pointsForGrade,
  type Course,
} from "./calculate";
import { getBuiltInScale } from "./scales";

function scale(id: string) {
  const found = getBuiltInScale(id);
  if (!found) throw new Error(`missing test scale ${id}`);
  return found;
}

const hec = scale("hec");
const percentage = scale("percentage");
const tenPoint = scale("ten-point");

function course(grade: string, credits: number, name = "Course"): Course {
  return { id: `${name}-${grade}-${credits}`, name, credits, grade };
}

describe("pointsForGrade", () => {
  it("resolves a letter on the scale", () => {
    expect(pointsForGrade(hec, "A")).toBe(4);
    expect(pointsForGrade(hec, "B+")).toBe(3.33);
  });

  it("ignores case and surrounding space, because typing is not picking", () => {
    expect(pointsForGrade(hec, "  b+ ")).toBe(3.33);
  });

  it("returns null for a letter that is not on the scale", () => {
    expect(pointsForGrade(hec, "D-")).toBeNull();
    expect(pointsForGrade(hec, "")).toBeNull();
  });

  it("reads percentage scales as the number itself", () => {
    expect(pointsForGrade(percentage, "87.5")).toBe(87.5);
  });

  it("rejects percentages outside 0 to 100", () => {
    expect(pointsForGrade(percentage, "120")).toBeNull();
    expect(pointsForGrade(percentage, "-1")).toBeNull();
  });
});

describe("letterForPercent", () => {
  it("picks the highest letter the mark reaches", () => {
    expect(letterForPercent(hec, 86)?.letter).toBe("A");
    expect(letterForPercent(hec, 85)?.letter).toBe("A");
    expect(letterForPercent(hec, 84.9)?.letter).toBe("A-");
    expect(letterForPercent(hec, 12)?.letter).toBe("F");
  });

  it("has no answer on a percentage scale, where the mark is the grade", () => {
    expect(letterForPercent(percentage, 80)).toBeNull();
  });
});

describe("calculateGpa", () => {
  it("weights each course by its credit hours", () => {
    const result = calculateGpa([course("A", 3), course("C", 1)], hec);
    // (4 x 3 + 2 x 1) / 4
    expect(result.gpa).toBeCloseTo(3.5, 10);
    expect(result.totalCredits).toBe(4);
    expect(result.countedCourses).toBe(2);
  });

  it("skips half-filled rows instead of scoring them as zero", () => {
    const result = calculateGpa([course("A", 3), course("", 3), course("B", 0)], hec);
    expect(result.gpa).toBe(4);
    expect(result.totalCredits).toBe(3);
    expect(result.skippedCourses).toBe(2);
  });

  it("has no answer when nothing countable has been entered", () => {
    expect(calculateGpa([], hec).gpa).toBeNull();
    expect(calculateGpa([course("", 3)], hec).gpa).toBeNull();
  });

  it("counts an F, which is a grade and not a blank", () => {
    const result = calculateGpa([course("A", 3), course("F", 3)], hec);
    expect(result.gpa).toBe(2);
    expect(result.skippedCourses).toBe(0);
  });

  it("averages marks by credit on a percentage scale", () => {
    const result = calculateGpa([course("90", 4), course("70", 1)], percentage);
    expect(result.gpa).toBeCloseTo(86, 10);
  });
});

describe("calculateCgpa", () => {
  const semesters = [
    { id: "s1", name: "Semester 1", courses: [course("A", 3), course("B", 3)] },
    { id: "s2", name: "Semester 2", courses: [course("C", 9)] },
  ];

  it("weights every course across every semester, not the semester averages", () => {
    const result = calculateCgpa(semesters, hec);
    // Averaging the two semester GPAs would give 2.75. The credit-weighted
    // answer is (4x3 + 3x3 + 2x9) / 15 = 2.6.
    expect(result.gpa).toBeCloseTo(2.6, 10);
    expect(result.totalCredits).toBe(15);
  });

  it("reports each semester alongside the cumulative figure", () => {
    const result = calculateCgpa(semesters, hec);
    expect(result.semesters).toHaveLength(2);
    expect(result.semesters[0].result.gpa).toBeCloseTo(3.5, 10);
    expect(result.semesters[1].result.gpa).toBe(2);
  });

  it("has no answer for empty semesters", () => {
    expect(calculateCgpa([{ id: "s", name: "Empty", courses: [] }], hec).gpa).toBeNull();
  });
});

describe("gpaNeededForTarget", () => {
  const base = { currentCgpa: 3.0, completedCredits: 60, plannedCredits: 15, scaleMax: 4 };

  it("solves for the term average that reaches the target", () => {
    const result = gpaNeededForTarget({ ...base, targetCgpa: 3.2 });
    // (3.2 x 75 - 3.0 x 60) / 15 = 4.0
    expect(result.required).toBeCloseTo(4, 10);
    expect(result.verdict).toBe("demanding");
  });

  it("calls a target beyond the scale impossible rather than returning a number to chase", () => {
    const result = gpaNeededForTarget({ ...base, targetCgpa: 3.5 });
    expect(result.verdict).toBe("impossible");
    expect(result.required).toBeGreaterThan(4);
  });

  it("says the target is already met when no effort is required", () => {
    const result = gpaNeededForTarget({ ...base, targetCgpa: 2.4 });
    expect(result.verdict).toBe("already-there");
  });

  it("reports a comfortable target as achievable", () => {
    const result = gpaNeededForTarget({ ...base, targetCgpa: 3.05 });
    expect(result.required).toBeCloseTo(3.25, 10);
    expect(result.verdict).toBe("achievable");
  });

  it("works for a first semester, where nothing is completed yet", () => {
    const result = gpaNeededForTarget({
      currentCgpa: 0,
      completedCredits: 0,
      plannedCredits: 18,
      scaleMax: 4,
      targetCgpa: 3.5,
    });
    expect(result.required).toBeCloseTo(3.5, 10);
  });

  it("refuses ill-posed questions instead of dividing by zero", () => {
    expect(gpaNeededForTarget({ ...base, targetCgpa: 3.2, plannedCredits: 0 }).verdict).toBe(
      "invalid",
    );
    expect(gpaNeededForTarget({ ...base, targetCgpa: 9 }).verdict).toBe("invalid");
    expect(gpaNeededForTarget({ ...base, targetCgpa: -1 }).verdict).toBe("invalid");
  });

  it("respects a scale whose maximum is not 4", () => {
    const result = gpaNeededForTarget({
      currentCgpa: 7,
      completedCredits: 40,
      plannedCredits: 20,
      scaleMax: tenPoint.max,
      targetCgpa: 8,
    });
    expect(result.required).toBeCloseTo(10, 10);
    expect(result.verdict).toBe("demanding");
  });
});

describe("formatPoints", () => {
  it("shows two decimals", () => {
    expect(formatPoints(3.456)).toBe("3.46");
    expect(formatPoints(4)).toBe("4.00");
  });

  it("shows a dash rather than NaN when there is no answer", () => {
    expect(formatPoints(null)).toBe("—");
    expect(formatPoints(Number.NaN)).toBe("—");
  });
});
