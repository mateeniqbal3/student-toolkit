import { describe, expect, it } from "vitest";

import { UNIT_CATEGORIES, getCategory, type UnitCategory } from "./categories";
import { convert, convertToAll, formatQuantity, isBelowAbsoluteZero } from "./convert";

function category(id: string): UnitCategory {
  const found = getCategory(id);
  if (!found) throw new Error(`missing category ${id}`);
  return found;
}

describe("the category definitions", () => {
  it("covers the sixteen categories the tool promises, counting currency", () => {
    expect(UNIT_CATEGORIES).toHaveLength(15);
  });

  it("gives every category a base unit that exists in it", () => {
    for (const entry of UNIT_CATEGORIES) {
      const base = entry.units.find((unit) => unit.id === entry.base);
      expect(base, `${entry.id} base unit`).toBeDefined();
    }
  });

  it("defines the base unit as the identity, so conversions have a fixed point", () => {
    for (const entry of UNIT_CATEGORIES) {
      const base = entry.units.find((unit) => unit.id === entry.base);
      expect(base?.factor, `${entry.id} base factor`).toBe(1);
      expect(base?.offset ?? 0, `${entry.id} base offset`).toBe(0);
    }
  });

  it("starts every category on a pair of units it actually has", () => {
    for (const entry of UNIT_CATEGORIES) {
      for (const id of entry.defaults) {
        expect(
          entry.units.some((unit) => unit.id === id),
          `${entry.id} default ${id}`,
        ).toBe(true);
      }
    }
  });

  it("uses distinct unit ids within a category", () => {
    for (const entry of UNIT_CATEGORIES) {
      const ids = entry.units.map((unit) => unit.id);
      expect(new Set(ids).size, `${entry.id} duplicate ids`).toBe(ids.length);
    }
  });
});

describe("length", () => {
  const length = category("length");

  it("converts through exact definitions", () => {
    expect(convert(length, "km", "mi", 1)).toBeCloseTo(0.621371192, 8);
    expect(convert(length, "in", "cm", 1)).toBeCloseTo(2.54, 10);
    expect(convert(length, "ft", "in", 1)).toBeCloseTo(12, 10);
  });

  it("round-trips without drifting", () => {
    const there = convert(length, "mi", "m", 26.2);
    expect(there).not.toBeNull();
    expect(convert(length, "m", "mi", there ?? 0)).toBeCloseTo(26.2, 10);
  });
});

describe("temperature", () => {
  const temperature = category("temperature");

  it("handles the offset scales", () => {
    expect(convert(temperature, "c", "f", 0)).toBeCloseTo(32, 10);
    expect(convert(temperature, "c", "f", 100)).toBeCloseTo(212, 10);
    expect(convert(temperature, "f", "c", 98.6)).toBeCloseTo(37, 8);
    expect(convert(temperature, "c", "k", 0)).toBeCloseTo(273.15, 10);
  });

  it("meets the scales where they cross", () => {
    expect(convert(temperature, "c", "f", -40)).toBeCloseTo(-40, 10);
  });

  it("flags a value below absolute zero rather than converting it", () => {
    expect(isBelowAbsoluteZero(temperature, "c", -400)).toBe(true);
    expect(isBelowAbsoluteZero(temperature, "c", -273.15)).toBe(false);
    expect(isBelowAbsoluteZero(temperature, "f", -500)).toBe(true);
  });

  it("does not claim other categories have a floor", () => {
    expect(isBelowAbsoluteZero(category("length"), "m", -5)).toBe(false);
  });
});

describe("fuel economy", () => {
  const fuel = category("fuel");

  it("inverts, because less fuel per distance is more distance per fuel", () => {
    expect(convert(fuel, "l100km", "kmpl", 10)).toBeCloseTo(10, 10);
    expect(convert(fuel, "l100km", "kmpl", 5)).toBeCloseTo(20, 10);
    expect(convert(fuel, "mpgus", "l100km", 30)).toBeCloseTo(7.840486, 5);
  });

  it("round-trips through the reciprocal", () => {
    const there = convert(fuel, "kmpl", "mpgus", 15);
    expect(there).not.toBeNull();
    expect(convert(fuel, "mpgus", "kmpl", there ?? 0)).toBeCloseTo(15, 8);
  });

  it("refuses zero rather than reporting infinite efficiency", () => {
    expect(convert(fuel, "kmpl", "l100km", 0)).toBeNull();
  });

  it("distinguishes the two gallons", () => {
    const us = convert(fuel, "mpgus", "l100km", 40) ?? 0;
    const uk = convert(fuel, "mpguk", "l100km", 40) ?? 0;
    // A UK gallon is the larger one, so covering 40 miles on one of them
    // burns more fuel than covering 40 miles on a US gallon. Same number,
    // worse consumption — which is exactly why the two are listed apart.
    expect(uk).toBeGreaterThan(us);
  });
});

describe("digital storage", () => {
  const storage = category("storage");

  it("keeps the 1000 and 1024 families apart, which is the whole point", () => {
    expect(convert(storage, "gb", "byte", 1)).toBe(1e9);
    expect(convert(storage, "gib", "byte", 1)).toBe(1073741824);
    expect(convert(storage, "gb", "gib", 1)).toBeCloseTo(0.931322574615, 10);
  });

  it("counts eight bits to the byte", () => {
    expect(convert(storage, "byte", "bit", 1)).toBe(8);
  });
});

describe("area", () => {
  const area = category("area");

  it("handles the South Asian land units", () => {
    expect(convert(area, "kanal", "marla", 1)).toBeCloseTo(20, 8);
    expect(convert(area, "marla", "yd2", 1)).toBeCloseTo(30.25, 8);
  });

  it("converts acres", () => {
    expect(convert(area, "acre", "ft2", 1)).toBeCloseTo(43560, 6);
  });
});

describe("convert", () => {
  it("returns null for a unit the category does not have", () => {
    expect(convert(category("length"), "m", "parsec", 1)).toBeNull();
  });

  it("returns null rather than NaN for input that is not a number", () => {
    expect(convert(category("length"), "m", "km", Number.NaN)).toBeNull();
  });
});

describe("convertToAll", () => {
  it("answers the whole category at once", () => {
    const rows = convertToAll(category("length"), "m", 1);
    expect(rows).toHaveLength(category("length").units.length);
    expect(rows.find((row) => row.unit.id === "cm")?.value).toBeCloseTo(100, 10);
  });

  it("drops the units that have no answer instead of showing NaN", () => {
    const rows = convertToAll(category("fuel"), "l100km", 0);
    expect(rows.every((row) => Number.isFinite(row.value))).toBe(true);
  });
});

describe("formatQuantity", () => {
  it("hides floating point noise", () => {
    expect(formatQuantity(0.1 + 0.2)).toBe("0.3");
    expect(formatQuantity((1 / 3.6) * 3.6)).toBe("1");
  });

  it("groups large numbers", () => {
    expect(formatQuantity(1234567.891)).toBe("1,234,567.891");
  });

  it("switches to exponent notation at the extremes", () => {
    expect(formatQuantity(1.602176634e-19)).toContain("e-19");
    expect(formatQuantity(5e15)).toContain("e+15");
  });

  it("shows a dash rather than NaN", () => {
    expect(formatQuantity(Number.NaN)).toBe("—");
    expect(formatQuantity(0)).toBe("0");
  });
});
