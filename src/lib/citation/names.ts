/**
 * Turning the name strings metadata services send into CSL names.
 *
 * Structured family/given pairs are always preferred when a source has them.
 * These parsers exist for the sources that only send a display string, and
 * they are deliberately conservative: a name they cannot confidently split is
 * kept whole as the family name, which prints correctly in every style,
 * rather than being cut in the wrong place.
 */
import type { CslName } from "./types";

const SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "2nd", "3rd"]);

/**
 * Lower-case words that belong to the family name when they come before it:
 * "Ludwig van Beethoven", "Walter de Azevedo". CSL calls these particles.
 */
const PARTICLES = new Set([
  "al",
  "bin",
  "binti",
  "da",
  "das",
  "de",
  "del",
  "della",
  "der",
  "di",
  "dos",
  "du",
  "el",
  "ibn",
  "la",
  "le",
  "st.",
  "ten",
  "ter",
  "van",
  "von",
]);

function isSuffix(token: string): boolean {
  return SUFFIXES.has(token.toLowerCase());
}

/** "Jr." and "Jr" both print as the style wants, so the dot is dropped. */
function cleanSuffix(token: string): string {
  const bare = token.replace(/\.$/, "");
  return /^[ivx]+$/i.test(bare) ? bare.toUpperCase() : bare;
}

/**
 * Splits a name written the way it is spoken, "Thomas H. Cormen", into the
 * given and family parts. Handles "Family, Given" too, since that ordering is
 * unambiguous and common in library catalogues.
 */
export function splitDisplayName(input: string): CslName | null {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return null;

  if (text.includes(",")) {
    const [family, ...rest] = text.split(",").map((part) => part.trim());
    const tail = rest.filter(Boolean);
    const suffix = tail.length > 1 && isSuffix(tail[tail.length - 1]) ? tail.pop() : undefined;
    const given = tail.join(" ");
    if (family && given) {
      return suffix ? { family, given, suffix: cleanSuffix(suffix) } : { family, given };
    }
    if (family) return { family };
  }

  const tokens = text.split(" ");
  const suffix =
    tokens.length > 2 && isSuffix(tokens[tokens.length - 1]) ? tokens.pop() : undefined;
  if (tokens.length === 1) return { family: tokens[0] };

  // Walk back from the last word while the word before it is a particle.
  let start = tokens.length - 1;
  while (start > 1 && PARTICLES.has(tokens[start - 1].toLowerCase())) start -= 1;

  const name: CslName = {
    family: tokens.slice(start).join(" "),
    given: tokens.slice(0, start).join(" "),
  };
  if (suffix) name.suffix = cleanSuffix(suffix);
  return name;
}

/**
 * Parses MEDLINE's compact author form, "de Azevedo WF Jr": family name, then
 * the given-name initials run together, then an optional suffix.
 */
export function parseMedlineName(input: string): CslName | null {
  const tokens = input.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (tokens.length === 0) return null;

  const suffix =
    tokens.length > 2 && isSuffix(tokens[tokens.length - 1]) ? tokens.pop() : undefined;
  const last = tokens[tokens.length - 1];

  // Initials are one to three capitals. Anything else is not MEDLINE form,
  // most often a collective author such as a trial group.
  if (tokens.length < 2 || !/^[A-Z]{1,3}$/.test(last)) {
    return { literal: [...tokens, ...(suffix ? [suffix] : [])].join(" ") };
  }

  const name: CslName = {
    family: tokens.slice(0, -1).join(" "),
    given: last
      .split("")
      .map((initial) => `${initial}.`)
      .join(" "),
  };
  if (suffix) name.suffix = cleanSuffix(suffix);
  return name;
}
