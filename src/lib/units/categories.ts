/**
 * Unit definitions, as data.
 *
 * Every unit states its relationship to one base unit per category, so a
 * conversion is always two steps — into the base and out again — rather than
 * an n-by-n table. Three shapes cover everything here:
 *
 * - **Linear**, the overwhelming majority: `base = value × factor`.
 * - **Offset**, which only temperature needs: `base = value × factor + offset`.
 * - **Reciprocal**, which only fuel economy needs: `base = factor ÷ value`,
 *   because using less fuel per distance means covering more distance per
 *   unit of fuel.
 *
 * Factors are exact where an exact definition exists (an inch is 0.0254 m by
 * international agreement, not by measurement), so conversions round-trip.
 */

export interface Unit {
  id: string;
  /** Shown in the picker. */
  name: string;
  /** Shown beside the number. */
  symbol: string;
  /** Multiply by this to reach the base unit. */
  factor: number;
  /** Added after the factor. Temperature only. */
  offset?: number;
  /** When set, `base = factor / value`. Fuel economy only. */
  reciprocal?: boolean;
}

export interface UnitCategory {
  id: string;
  name: string;
  /** Unit id everything in this category converts through. */
  base: string;
  /** Sensible starting pair, so the tool is useful before anything is picked. */
  defaults: [from: string, to: string];
  units: readonly Unit[];
}

export const UNIT_CATEGORIES: readonly UnitCategory[] = [
  {
    id: "length",
    name: "Length",
    base: "m",
    defaults: ["km", "mi"],
    units: [
      { id: "nm", name: "Nanometre", symbol: "nm", factor: 1e-9 },
      { id: "um", name: "Micrometre", symbol: "µm", factor: 1e-6 },
      { id: "mm", name: "Millimetre", symbol: "mm", factor: 0.001 },
      { id: "cm", name: "Centimetre", symbol: "cm", factor: 0.01 },
      { id: "m", name: "Metre", symbol: "m", factor: 1 },
      { id: "km", name: "Kilometre", symbol: "km", factor: 1000 },
      { id: "in", name: "Inch", symbol: "in", factor: 0.0254 },
      { id: "ft", name: "Foot", symbol: "ft", factor: 0.3048 },
      { id: "yd", name: "Yard", symbol: "yd", factor: 0.9144 },
      { id: "mi", name: "Mile", symbol: "mi", factor: 1609.344 },
      { id: "nmi", name: "Nautical mile", symbol: "nmi", factor: 1852 },
    ],
  },
  {
    id: "mass",
    name: "Mass",
    base: "kg",
    defaults: ["kg", "lb"],
    units: [
      { id: "mg", name: "Milligram", symbol: "mg", factor: 1e-6 },
      { id: "g", name: "Gram", symbol: "g", factor: 0.001 },
      { id: "kg", name: "Kilogram", symbol: "kg", factor: 1 },
      { id: "t", name: "Tonne", symbol: "t", factor: 1000 },
      { id: "oz", name: "Ounce", symbol: "oz", factor: 0.028349523125 },
      { id: "lb", name: "Pound", symbol: "lb", factor: 0.45359237 },
      { id: "st", name: "Stone", symbol: "st", factor: 6.35029318 },
      // Still how gold is priced across South Asia.
      { id: "tola", name: "Tola", symbol: "tola", factor: 0.0116638038 },
    ],
  },
  {
    id: "temperature",
    name: "Temperature",
    base: "k",
    defaults: ["c", "f"],
    units: [
      { id: "c", name: "Celsius", symbol: "°C", factor: 1, offset: 273.15 },
      { id: "f", name: "Fahrenheit", symbol: "°F", factor: 5 / 9, offset: 255.3722222222222 },
      { id: "k", name: "Kelvin", symbol: "K", factor: 1, offset: 0 },
      { id: "r", name: "Rankine", symbol: "°R", factor: 5 / 9, offset: 0 },
    ],
  },
  {
    id: "area",
    name: "Area",
    base: "m2",
    defaults: ["marla", "ft2"],
    units: [
      { id: "mm2", name: "Square millimetre", symbol: "mm²", factor: 1e-6 },
      { id: "cm2", name: "Square centimetre", symbol: "cm²", factor: 1e-4 },
      { id: "m2", name: "Square metre", symbol: "m²", factor: 1 },
      { id: "ha", name: "Hectare", symbol: "ha", factor: 10000 },
      { id: "km2", name: "Square kilometre", symbol: "km²", factor: 1e6 },
      { id: "in2", name: "Square inch", symbol: "in²", factor: 0.00064516 },
      { id: "ft2", name: "Square foot", symbol: "ft²", factor: 0.09290304 },
      { id: "yd2", name: "Square yard", symbol: "yd²", factor: 0.83612736 },
      { id: "acre", name: "Acre", symbol: "acre", factor: 4046.8564224 },
      { id: "mi2", name: "Square mile", symbol: "mi²", factor: 2589988.110336 },
      // Land across Pakistan and north India is still quoted in these.
      { id: "marla", name: "Marla", symbol: "marla", factor: 25.29285264 },
      { id: "kanal", name: "Kanal", symbol: "kanal", factor: 505.8570528 },
    ],
  },
  {
    id: "volume",
    name: "Volume",
    base: "l",
    defaults: ["l", "galus"],
    units: [
      { id: "ml", name: "Millilitre", symbol: "mL", factor: 0.001 },
      { id: "cl", name: "Centilitre", symbol: "cL", factor: 0.01 },
      { id: "l", name: "Litre", symbol: "L", factor: 1 },
      { id: "m3", name: "Cubic metre", symbol: "m³", factor: 1000 },
      { id: "cm3", name: "Cubic centimetre", symbol: "cm³", factor: 0.001 },
      { id: "tsp", name: "Teaspoon (US)", symbol: "tsp", factor: 0.00492892159375 },
      { id: "tbsp", name: "Tablespoon (US)", symbol: "tbsp", factor: 0.01478676478125 },
      { id: "flozus", name: "Fluid ounce (US)", symbol: "fl oz", factor: 0.0295735295625 },
      { id: "cup", name: "Cup (US)", symbol: "cup", factor: 0.2365882365 },
      { id: "ptus", name: "Pint (US)", symbol: "pt", factor: 0.473176473 },
      { id: "qtus", name: "Quart (US)", symbol: "qt", factor: 0.946352946 },
      { id: "galus", name: "Gallon (US)", symbol: "gal", factor: 3.785411784 },
      { id: "galuk", name: "Gallon (UK)", symbol: "gal", factor: 4.54609 },
    ],
  },
  {
    id: "speed",
    name: "Speed",
    base: "ms",
    defaults: ["kmh", "mph"],
    units: [
      { id: "ms", name: "Metres per second", symbol: "m/s", factor: 1 },
      { id: "kmh", name: "Kilometres per hour", symbol: "km/h", factor: 1 / 3.6 },
      { id: "mph", name: "Miles per hour", symbol: "mph", factor: 0.44704 },
      { id: "kn", name: "Knot", symbol: "kn", factor: 1852 / 3600 },
      { id: "fts", name: "Feet per second", symbol: "ft/s", factor: 0.3048 },
    ],
  },
  {
    id: "time",
    name: "Time",
    base: "s",
    defaults: ["h", "min"],
    units: [
      { id: "ms", name: "Millisecond", symbol: "ms", factor: 0.001 },
      { id: "s", name: "Second", symbol: "s", factor: 1 },
      { id: "min", name: "Minute", symbol: "min", factor: 60 },
      { id: "h", name: "Hour", symbol: "h", factor: 3600 },
      { id: "day", name: "Day", symbol: "d", factor: 86400 },
      { id: "week", name: "Week", symbol: "wk", factor: 604800 },
      // Average calendar month and year, so the two stay consistent.
      { id: "month", name: "Month (average)", symbol: "mo", factor: 2629800 },
      { id: "year", name: "Year (average)", symbol: "yr", factor: 31557600 },
    ],
  },
  {
    id: "storage",
    name: "Digital storage",
    base: "byte",
    defaults: ["gb", "gib"],
    units: [
      { id: "bit", name: "Bit", symbol: "b", factor: 0.125 },
      { id: "byte", name: "Byte", symbol: "B", factor: 1 },
      { id: "kb", name: "Kilobyte (1000)", symbol: "KB", factor: 1000 },
      { id: "mb", name: "Megabyte (1000)", symbol: "MB", factor: 1e6 },
      { id: "gb", name: "Gigabyte (1000)", symbol: "GB", factor: 1e9 },
      { id: "tb", name: "Terabyte (1000)", symbol: "TB", factor: 1e12 },
      { id: "kib", name: "Kibibyte (1024)", symbol: "KiB", factor: 1024 },
      { id: "mib", name: "Mebibyte (1024)", symbol: "MiB", factor: 1048576 },
      { id: "gib", name: "Gibibyte (1024)", symbol: "GiB", factor: 1073741824 },
      { id: "tib", name: "Tebibyte (1024)", symbol: "TiB", factor: 1099511627776 },
    ],
  },
  {
    id: "datarate",
    name: "Data rate",
    base: "bps",
    defaults: ["mbps", "mbytes"],
    units: [
      { id: "bps", name: "Bits per second", symbol: "bit/s", factor: 1 },
      { id: "kbps", name: "Kilobits per second", symbol: "kbit/s", factor: 1000 },
      { id: "mbps", name: "Megabits per second", symbol: "Mbit/s", factor: 1e6 },
      { id: "gbps", name: "Gigabits per second", symbol: "Gbit/s", factor: 1e9 },
      { id: "kbytes", name: "Kilobytes per second", symbol: "KB/s", factor: 8000 },
      { id: "mbytes", name: "Megabytes per second", symbol: "MB/s", factor: 8e6 },
    ],
  },
  {
    id: "pressure",
    name: "Pressure",
    base: "pa",
    defaults: ["bar", "psi"],
    units: [
      { id: "pa", name: "Pascal", symbol: "Pa", factor: 1 },
      { id: "hpa", name: "Hectopascal", symbol: "hPa", factor: 100 },
      { id: "kpa", name: "Kilopascal", symbol: "kPa", factor: 1000 },
      { id: "bar", name: "Bar", symbol: "bar", factor: 100000 },
      { id: "psi", name: "Pound per square inch", symbol: "psi", factor: 6894.757293168361 },
      { id: "atm", name: "Atmosphere", symbol: "atm", factor: 101325 },
      { id: "mmhg", name: "Millimetre of mercury", symbol: "mmHg", factor: 133.322387415 },
    ],
  },
  {
    id: "energy",
    name: "Energy",
    base: "j",
    defaults: ["kcal", "kj"],
    units: [
      { id: "j", name: "Joule", symbol: "J", factor: 1 },
      { id: "kj", name: "Kilojoule", symbol: "kJ", factor: 1000 },
      { id: "cal", name: "Calorie", symbol: "cal", factor: 4.184 },
      { id: "kcal", name: "Kilocalorie (food)", symbol: "kcal", factor: 4184 },
      { id: "wh", name: "Watt hour", symbol: "Wh", factor: 3600 },
      { id: "kwh", name: "Kilowatt hour", symbol: "kWh", factor: 3600000 },
      { id: "btu", name: "British thermal unit", symbol: "BTU", factor: 1055.05585262 },
      { id: "ev", name: "Electronvolt", symbol: "eV", factor: 1.602176634e-19 },
    ],
  },
  {
    id: "power",
    name: "Power",
    base: "w",
    defaults: ["kw", "hp"],
    units: [
      { id: "w", name: "Watt", symbol: "W", factor: 1 },
      { id: "kw", name: "Kilowatt", symbol: "kW", factor: 1000 },
      { id: "mw", name: "Megawatt", symbol: "MW", factor: 1e6 },
      { id: "hp", name: "Horsepower (metric)", symbol: "PS", factor: 735.49875 },
      { id: "hpmech", name: "Horsepower (mechanical)", symbol: "hp", factor: 745.6998715822702 },
      { id: "btuh", name: "BTU per hour", symbol: "BTU/h", factor: 0.29307107017222 },
    ],
  },
  {
    id: "angle",
    name: "Angle",
    base: "rad",
    defaults: ["deg", "rad"],
    units: [
      { id: "rad", name: "Radian", symbol: "rad", factor: 1 },
      { id: "deg", name: "Degree", symbol: "°", factor: Math.PI / 180 },
      { id: "grad", name: "Gradian", symbol: "grad", factor: Math.PI / 200 },
      { id: "arcmin", name: "Arcminute", symbol: "′", factor: Math.PI / 10800 },
      { id: "arcsec", name: "Arcsecond", symbol: "″", factor: Math.PI / 648000 },
      { id: "turn", name: "Turn", symbol: "turn", factor: 2 * Math.PI },
    ],
  },
  {
    id: "frequency",
    name: "Frequency",
    base: "hz",
    defaults: ["ghz", "mhz"],
    units: [
      { id: "hz", name: "Hertz", symbol: "Hz", factor: 1 },
      { id: "khz", name: "Kilohertz", symbol: "kHz", factor: 1000 },
      { id: "mhz", name: "Megahertz", symbol: "MHz", factor: 1e6 },
      { id: "ghz", name: "Gigahertz", symbol: "GHz", factor: 1e9 },
      { id: "rpm", name: "Revolutions per minute", symbol: "rpm", factor: 1 / 60 },
    ],
  },
  {
    id: "fuel",
    name: "Fuel economy",
    base: "l100km",
    defaults: ["kmpl", "mpgus"],
    units: [
      { id: "l100km", name: "Litres per 100 km", symbol: "L/100km", factor: 1 },
      { id: "kmpl", name: "Kilometres per litre", symbol: "km/L", factor: 100, reciprocal: true },
      {
        id: "mpgus",
        name: "Miles per gallon (US)",
        symbol: "mpg",
        factor: 235.2145833333333,
        reciprocal: true,
      },
      {
        id: "mpguk",
        name: "Miles per gallon (UK)",
        symbol: "mpg",
        factor: 282.4809363318221,
        reciprocal: true,
      },
    ],
  },
];

/** Currency is a category too, but its factors arrive over the network. */
export const CURRENCY_CATEGORY_ID = "currency";

export function getCategory(id: string): UnitCategory | undefined {
  return UNIT_CATEGORIES.find((category) => category.id === id);
}

export function getUnit(category: UnitCategory, unitId: string): Unit | undefined {
  return category.units.find((unit) => unit.id === unitId);
}
