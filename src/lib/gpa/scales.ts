/**
 * Grading scales, as data.
 *
 * Universities disagree about almost everything here: how many letters there
 * are, what each is worth, and which percentage earns it. The scale is
 * therefore a value the student picks rather than a constant baked into the
 * arithmetic, and a student whose university is not listed builds their own
 * with the same shape.
 */

/** How grades are entered for a scale. */
export type GradeEntryMode = "letter" | "percentage";

export interface GradeDefinition {
  /** What appears on the transcript: "A", "B+", "O", and so on. */
  letter: string;
  /** Grade points this letter is worth on this scale. */
  points: number;
  /**
   * Inclusive lower bound of the percentage that earns this letter. Used only
   * to translate marks into a letter; it never enters the GPA arithmetic.
   */
  minPercent: number;
}

export interface GradingScale {
  id: string;
  name: string;
  /** One line explaining who uses it, shown under the picker. */
  description: string;
  /** The highest attainable grade point. Bounds target-GPA solving. */
  max: number;
  mode: GradeEntryMode;
  /** Ordered best grade first. Empty for percentage scales. */
  grades: readonly GradeDefinition[];
}

const HEC_GRADES: readonly GradeDefinition[] = [
  { letter: "A", points: 4.0, minPercent: 85 },
  { letter: "A-", points: 3.67, minPercent: 80 },
  { letter: "B+", points: 3.33, minPercent: 75 },
  { letter: "B", points: 3.0, minPercent: 71 },
  { letter: "B-", points: 2.67, minPercent: 68 },
  { letter: "C+", points: 2.33, minPercent: 64 },
  { letter: "C", points: 2.0, minPercent: 61 },
  { letter: "C-", points: 1.67, minPercent: 58 },
  { letter: "D+", points: 1.33, minPercent: 54 },
  { letter: "D", points: 1.0, minPercent: 50 },
  { letter: "F", points: 0, minPercent: 0 },
];

const US_FOUR_POINT_GRADES: readonly GradeDefinition[] = [
  { letter: "A", points: 4.0, minPercent: 93 },
  { letter: "A-", points: 3.7, minPercent: 90 },
  { letter: "B+", points: 3.3, minPercent: 87 },
  { letter: "B", points: 3.0, minPercent: 83 },
  { letter: "B-", points: 2.7, minPercent: 80 },
  { letter: "C+", points: 2.3, minPercent: 77 },
  { letter: "C", points: 2.0, minPercent: 73 },
  { letter: "C-", points: 1.7, minPercent: 70 },
  { letter: "D+", points: 1.3, minPercent: 67 },
  { letter: "D", points: 1.0, minPercent: 63 },
  { letter: "D-", points: 0.7, minPercent: 60 },
  { letter: "F", points: 0, minPercent: 0 },
];

const FIVE_POINT_GRADES: readonly GradeDefinition[] = [
  { letter: "A", points: 5, minPercent: 70 },
  { letter: "B", points: 4, minPercent: 60 },
  { letter: "C", points: 3, minPercent: 50 },
  { letter: "D", points: 2, minPercent: 45 },
  { letter: "E", points: 1, minPercent: 40 },
  { letter: "F", points: 0, minPercent: 0 },
];

const TEN_POINT_GRADES: readonly GradeDefinition[] = [
  { letter: "O", points: 10, minPercent: 90 },
  { letter: "A+", points: 9, minPercent: 80 },
  { letter: "A", points: 8, minPercent: 70 },
  { letter: "B+", points: 7, minPercent: 60 },
  { letter: "B", points: 6, minPercent: 50 },
  { letter: "C", points: 5, minPercent: 45 },
  { letter: "P", points: 4, minPercent: 40 },
  { letter: "F", points: 0, minPercent: 0 },
];

export const BUILT_IN_SCALES: readonly GradingScale[] = [
  {
    id: "hec",
    name: "Pakistan HEC (4.0)",
    description: "The Higher Education Commission scale used by most Pakistani universities.",
    max: 4,
    mode: "letter",
    grades: HEC_GRADES,
  },
  {
    id: "four-point",
    name: "Standard 4.0",
    description: "The common American letter scale, with plus and minus grades.",
    max: 4,
    mode: "letter",
    grades: US_FOUR_POINT_GRADES,
  },
  {
    id: "five-point",
    name: "5.0 scale",
    description: "The five-point scale used in Nigeria and parts of West Africa.",
    max: 5,
    mode: "letter",
    grades: FIVE_POINT_GRADES,
  },
  {
    id: "ten-point",
    name: "10-point CGPA",
    description: "The Indian ten-point scale used by most affiliated universities.",
    max: 10,
    mode: "letter",
    grades: TEN_POINT_GRADES,
  },
  {
    id: "percentage",
    name: "Percentage",
    description: "Enter marks out of 100 directly and get a credit-weighted average.",
    max: 100,
    mode: "percentage",
    grades: [],
  },
];

export const DEFAULT_SCALE_ID = "hec";

export function getBuiltInScale(id: string): GradingScale | undefined {
  return BUILT_IN_SCALES.find((scale) => scale.id === id);
}

/**
 * Prefix marking a scale the student built themselves. Custom scales are rows
 * in IndexedDB with numeric keys, so the prefix keeps one namespace of scale
 * ids across both sources without a second "where did this come from" field.
 */
export const CUSTOM_SCALE_PREFIX = "custom:";

export function customScaleId(rowId: number): string {
  return `${CUSTOM_SCALE_PREFIX}${rowId}`;
}

export function parseCustomScaleId(id: string): number | null {
  if (!id.startsWith(CUSTOM_SCALE_PREFIX)) return null;
  const rowId = Number(id.slice(CUSTOM_SCALE_PREFIX.length));
  return Number.isInteger(rowId) ? rowId : null;
}

/**
 * Sorts grades best-first and derives the scale maximum from them, which is
 * what a custom scale needs before it can be used for target solving.
 */
export function normalizeGrades(grades: readonly GradeDefinition[]): GradeDefinition[] {
  return [...grades].sort((a, b) => b.points - a.points);
}
