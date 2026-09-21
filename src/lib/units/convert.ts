/**
 * Conversion arithmetic.
 *
 * Every conversion goes through the category's base unit, which keeps the
 * number of relationships linear in the unit count rather than quadratic, and
 * means adding a unit is adding one factor.
 */
import { getUnit, type Unit, type UnitCategory } from "./categories";

export function toBase(unit: Unit, value: number): number {
  if (unit.reciprocal) {
    // Zero litres per 100km is not "infinitely efficient", it is unanswerable.
    return value === 0 ? Number.NaN : unit.factor / value;
  }
  return value * unit.factor + (unit.offset ?? 0);
}

export function fromBase(unit: Unit, base: number): number {
  if (unit.reciprocal) {
    return base === 0 ? Number.NaN : unit.factor / base;
  }
  return (base - (unit.offset ?? 0)) / unit.factor;
}

export function convert(
  category: UnitCategory,
  fromId: string,
  toId: string,
  value: number,
): number | null {
  const from = getUnit(category, fromId);
  const to = getUnit(category, toId);
  if (!from || !to || !Number.isFinite(value)) return null;

  const result = fromBase(to, toBase(from, value));
  return Number.isFinite(result) ? result : null;
}

/**
 * Every unit in the category at once.
 *
 * Typing a number and seeing the whole category answers the question the
 * student had and the one they were about to ask, which is worth more than a
 * tidier single-answer layout.
 */
export function convertToAll(
  category: UnitCategory,
  fromId: string,
  value: number,
): { unit: Unit; value: number }[] {
  const from = getUnit(category, fromId);
  if (!from || !Number.isFinite(value)) return [];

  const base = toBase(from, value);
  return category.units
    .map((unit) => ({ unit, value: fromBase(unit, base) }))
    .filter((row) => Number.isFinite(row.value));
}

/**
 * Nothing can be colder than absolute zero, and a converter that cheerfully
 * reports −400°C as 33 K is lying rather than converting.
 */
export function isBelowAbsoluteZero(
  category: UnitCategory,
  unitId: string,
  value: number,
): boolean {
  if (category.id !== "temperature") return false;
  const unit = getUnit(category, unitId);
  if (!unit || !Number.isFinite(value)) return false;
  return toBase(unit, value) < 0;
}

/**
 * Formats a converted quantity.
 *
 * Ten significant digits is well inside a double's honest precision and is
 * what stops `1 / 3.6 × 3.6` from rendering as 0.9999999999999999, while
 * still showing enough detail for a value like 0.000254 m.
 */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";

  const magnitude = Math.abs(value);
  if (magnitude < 1e-6 || magnitude >= 1e12) return value.toExponential(6);

  return Number(value.toPrecision(10)).toLocaleString("en-US", { maximumFractionDigits: 10 });
}
