/**
 * Percentage arithmetic.
 *
 * Every mode returns the working alongside the answer. That is the point of
 * the tool: a student who can see `(72 − 60) ÷ 60 × 100` can check it, repeat
 * it in an exam, and notice when they have picked the wrong mode. A bare
 * number teaches nothing and hides mistakes.
 */

export interface PercentageOutcome {
  value: number;
  /** The arithmetic written out with the student's own numbers in it. */
  formula: string;
  /** A plain-language reading, where the number alone is ambiguous. */
  note?: string;
}

export type PercentageErrorCode = "incomplete" | "divide-by-zero" | "out-of-range";

export interface PercentageError {
  code: PercentageErrorCode;
  message: string;
}

export type PercentageResult =
  { ok: true; outcome: PercentageOutcome } | { ok: false; error: PercentageError };

const INCOMPLETE: PercentageResult = {
  ok: false,
  error: { code: "incomplete", message: "Fill in both fields to see the answer." },
};

function fail(code: PercentageErrorCode, message: string): PercentageResult {
  return { ok: false, error: { code, message } };
}

/**
 * Trims the float noise that makes `0.1 + 0.2` embarrassing without rounding
 * away precision a student actually typed.
 */
export function formatNumber(value: number, maxDecimals = 4): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(maxDecimals));
  return rounded.toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
}

/** Parses a field, treating blank as "not answered yet" rather than as zero. */
export function parseField(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** "What is 15% of 200?" */
export function percentOf(percent: number | null, value: number | null): PercentageResult {
  if (percent === null || value === null) return INCOMPLETE;
  const result = (percent / 100) * value;
  return {
    ok: true,
    outcome: {
      value: result,
      formula: `${formatNumber(percent)}% × ${formatNumber(value)} = ${formatNumber(percent)} ÷ 100 × ${formatNumber(value)} = ${formatNumber(result)}`,
    },
  };
}

/** "30 is what percent of 250?" */
export function whatPercent(part: number | null, whole: number | null): PercentageResult {
  if (part === null || whole === null) return INCOMPLETE;
  if (whole === 0) {
    return fail("divide-by-zero", "Nothing can be a percentage of zero.");
  }
  const result = (part / whole) * 100;
  return {
    ok: true,
    outcome: {
      value: result,
      formula: `${formatNumber(part)} ÷ ${formatNumber(whole)} × 100 = ${formatNumber(result)}%`,
    },
  };
}

/** "My marks went from 60 to 72. What changed?" */
export function percentChange(from: number | null, to: number | null): PercentageResult {
  if (from === null || to === null) return INCOMPLETE;
  if (from === 0) {
    return fail("divide-by-zero", "Change from zero has no percentage — it is undefined.");
  }
  const difference = to - from;
  const result = (difference / Math.abs(from)) * 100;
  const direction = difference > 0 ? "increase" : difference < 0 ? "decrease" : "no change";
  return {
    ok: true,
    outcome: {
      value: result,
      formula: `(${formatNumber(to)} − ${formatNumber(from)}) ÷ ${formatNumber(Math.abs(from))} × 100 = ${formatNumber(result)}%`,
      note:
        direction === "no change"
          ? "The two values are the same."
          : `That is a ${formatNumber(Math.abs(result))}% ${direction}.`,
    },
  };
}

/** "What is 2500 after a 12% rise?" */
export function applyChange(
  value: number | null,
  percent: number | null,
  direction: "increase" | "decrease",
): PercentageResult {
  if (value === null || percent === null) return INCOMPLETE;
  const signed = direction === "increase" ? percent : -percent;
  const result = value * (1 + signed / 100);
  const sign = direction === "increase" ? "+" : "−";
  return {
    ok: true,
    outcome: {
      value: result,
      formula: `${formatNumber(value)} × (1 ${sign} ${formatNumber(percent)} ÷ 100) = ${formatNumber(result)}`,
      note: `The change itself is ${formatNumber(Math.abs(result - value))}.`,
    },
  };
}

/**
 * The reverse question, and the one students get wrong most often: a price is
 * 2800 after a 20% discount, so the original was 3500, not 3360. Taking 20%
 * back off the reduced number is not the same operation.
 */
export function reversePercent(
  finalValue: number | null,
  percent: number | null,
  direction: "increase" | "decrease",
): PercentageResult {
  if (finalValue === null || percent === null) return INCOMPLETE;
  const signed = direction === "increase" ? percent : -percent;
  const factor = 1 + signed / 100;
  if (factor === 0) {
    return fail("divide-by-zero", "A 100% decrease leaves nothing to work back from.");
  }
  const result = finalValue / factor;
  const sign = direction === "increase" ? "+" : "−";
  return {
    ok: true,
    outcome: {
      value: result,
      formula: `${formatNumber(finalValue)} ÷ (1 ${sign} ${formatNumber(percent)} ÷ 100) = ${formatNumber(result)}`,
      note: `Before the ${direction}, the value was ${formatNumber(result)}.`,
    },
  };
}

/** "I scored 68 out of 80." */
export function marksToPercent(obtained: number | null, total: number | null): PercentageResult {
  if (obtained === null || total === null) return INCOMPLETE;
  if (total <= 0) {
    return fail("out-of-range", "The total marks must be greater than zero.");
  }
  const result = (obtained / total) * 100;
  return {
    ok: true,
    outcome: {
      value: result,
      formula: `${formatNumber(obtained)} ÷ ${formatNumber(total)} × 100 = ${formatNumber(result)}%`,
      note: obtained > total ? "That is above the total — check the marks." : undefined,
    },
  };
}

export interface WeightedComponent {
  id: string;
  /** "Assignments", "Midterm", "Final". */
  name: string;
  obtained: string;
  total: string;
  /** Share of the final grade, as a percentage of it. */
  weight: string;
}

export interface WeightedResult {
  /** The grade so far, out of the weight that has been entered. */
  percent: number | null;
  /** Total weight of the components that had usable numbers. */
  countedWeight: number;
  /** True when the entered weights do not add up to 100. */
  weightsIncomplete: boolean;
  rows: { id: string; name: string; percent: number; contribution: number }[];
}

/**
 * Weighted marks, scored against the weight actually entered rather than
 * against 100. A student who has sat the midterm but not the final wants to
 * know how they are doing so far, not a number depressed by a paper that does
 * not exist yet.
 */
export function weightedGrade(components: readonly WeightedComponent[]): WeightedResult {
  const rows: WeightedResult["rows"] = [];
  let weightedSum = 0;
  let countedWeight = 0;
  let enteredWeight = 0;

  for (const component of components) {
    const weight = parseField(component.weight);
    if (weight !== null && weight > 0) enteredWeight += weight;

    const obtained = parseField(component.obtained);
    const total = parseField(component.total);
    if (obtained === null || total === null || weight === null || total <= 0 || weight <= 0) {
      continue;
    }

    const percent = (obtained / total) * 100;
    const contribution = (percent * weight) / 100;
    rows.push({ id: component.id, name: component.name, percent, contribution });
    weightedSum += contribution;
    countedWeight += weight;
  }

  return {
    percent: countedWeight > 0 ? (weightedSum / countedWeight) * 100 : null,
    countedWeight,
    weightsIncomplete: enteredWeight > 0 && Math.abs(enteredWeight - 100) > 0.001,
    rows,
  };
}
