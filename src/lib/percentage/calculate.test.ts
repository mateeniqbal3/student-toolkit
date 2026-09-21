import { describe, expect, it } from "vitest";

import {
  applyChange,
  formatNumber,
  marksToPercent,
  parseField,
  percentChange,
  percentOf,
  reversePercent,
  weightedGrade,
  whatPercent,
  type PercentageResult,
  type WeightedComponent,
} from "./calculate";

function value(result: PercentageResult): number {
  if (!result.ok) throw new Error(`expected a result, got ${result.error.code}`);
  return result.outcome.value;
}

function errorCode(result: PercentageResult): string {
  if (result.ok) throw new Error("expected an error");
  return result.error.code;
}

describe("parseField", () => {
  it("treats blank as unanswered rather than as zero", () => {
    expect(parseField("")).toBeNull();
    expect(parseField("   ")).toBeNull();
    expect(parseField("0")).toBe(0);
  });

  it("rejects text that is not a number", () => {
    expect(parseField("abc")).toBeNull();
  });
});

describe("percentOf", () => {
  it("takes a percentage of a value", () => {
    expect(value(percentOf(15, 200))).toBeCloseTo(30, 10);
  });

  it("waits for both fields", () => {
    expect(errorCode(percentOf(15, null))).toBe("incomplete");
  });

  it("shows the working", () => {
    const result = percentOf(15, 200);
    expect(result.ok && result.outcome.formula).toContain("15% × 200");
  });
});

describe("whatPercent", () => {
  it("expresses a part as a percentage of a whole", () => {
    expect(value(whatPercent(30, 250))).toBeCloseTo(12, 10);
  });

  it("refuses to divide by a zero whole", () => {
    expect(errorCode(whatPercent(30, 0))).toBe("divide-by-zero");
  });
});

describe("percentChange", () => {
  it("measures an increase", () => {
    expect(value(percentChange(60, 72))).toBeCloseTo(20, 10);
  });

  it("measures a decrease as a negative", () => {
    expect(value(percentChange(80, 60))).toBeCloseTo(-25, 10);
  });

  it("reads the direction out in words", () => {
    const result = percentChange(80, 60);
    expect(result.ok && result.outcome.note).toContain("decrease");
  });

  it("is undefined when starting from zero", () => {
    expect(errorCode(percentChange(0, 50))).toBe("divide-by-zero");
  });

  it("measures change from a negative starting point against its magnitude", () => {
    expect(value(percentChange(-50, -25))).toBeCloseTo(50, 10);
  });
});

describe("applyChange", () => {
  it("adds a percentage on", () => {
    expect(value(applyChange(2500, 12, "increase"))).toBeCloseTo(2800, 10);
  });

  it("takes a percentage off", () => {
    expect(value(applyChange(3500, 20, "decrease"))).toBeCloseTo(2800, 10);
  });
});

describe("reversePercent", () => {
  it("recovers the original before a discount", () => {
    // The mistake this mode exists to prevent: adding 20% back gives 3360.
    expect(value(reversePercent(2800, 20, "decrease"))).toBeCloseTo(3500, 10);
  });

  it("recovers the original before a markup", () => {
    expect(value(reversePercent(2800, 12, "increase"))).toBeCloseTo(2500, 10);
  });

  it("has nothing to work back from after a total loss", () => {
    expect(errorCode(reversePercent(0, 100, "decrease"))).toBe("divide-by-zero");
  });
});

describe("marksToPercent", () => {
  it("converts marks to a percentage", () => {
    expect(value(marksToPercent(68, 80))).toBeCloseTo(85, 10);
  });

  it("flags marks above the total instead of silently reporting over 100", () => {
    const result = marksToPercent(90, 80);
    expect(result.ok && result.outcome.note).toContain("above the total");
  });

  it("rejects a total of zero", () => {
    expect(errorCode(marksToPercent(10, 0))).toBe("out-of-range");
  });
});

describe("weightedGrade", () => {
  function component(over: Partial<WeightedComponent> & { id: string }): WeightedComponent {
    return { name: "Part", obtained: "", total: "", weight: "", ...over };
  }

  it("weights each component by its share of the grade", () => {
    const result = weightedGrade([
      component({ id: "a", obtained: "18", total: "20", weight: "20" }),
      component({ id: "b", obtained: "30", total: "50", weight: "30" }),
      component({ id: "c", obtained: "40", total: "50", weight: "50" }),
    ]);
    // 90x0.2 + 60x0.3 + 80x0.5 = 76
    expect(result.percent).toBeCloseTo(76, 10);
    expect(result.countedWeight).toBe(100);
    expect(result.weightsIncomplete).toBe(false);
  });

  it("scores against the weight entered so far, not against a missing final", () => {
    const result = weightedGrade([
      component({ id: "a", obtained: "18", total: "20", weight: "40" }),
      component({ id: "b", name: "Final", weight: "60" }),
    ]);
    // The final has not happened. The answer is 90% of the 40 that has.
    expect(result.percent).toBeCloseTo(90, 10);
    expect(result.countedWeight).toBe(40);
  });

  it("notices when the weights do not add up to 100", () => {
    const result = weightedGrade([
      component({ id: "a", obtained: "18", total: "20", weight: "40" }),
      component({ id: "b", obtained: "10", total: "20", weight: "40" }),
    ]);
    expect(result.weightsIncomplete).toBe(true);
  });

  it("has no answer before anything is entered", () => {
    const result = weightedGrade([component({ id: "a" })]);
    expect(result.percent).toBeNull();
    expect(result.weightsIncomplete).toBe(false);
  });

  it("skips a component whose total is zero rather than dividing by it", () => {
    const result = weightedGrade([
      component({ id: "a", obtained: "5", total: "0", weight: "50" }),
      component({ id: "b", obtained: "25", total: "50", weight: "50" }),
    ]);
    expect(result.percent).toBeCloseTo(50, 10);
    expect(result.countedWeight).toBe(50);
  });
});

describe("formatNumber", () => {
  it("trims floating point noise", () => {
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
  });

  it("groups thousands for readability", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});
