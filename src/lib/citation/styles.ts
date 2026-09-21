/**
 * The five citation styles, as data.
 *
 * Each style's CSL definition is a separate generated module behind a dynamic
 * import, so a student who only ever writes APA never downloads Chicago's
 * 100KB of rules.
 */
import type { CitationStyleId } from "./types";

export interface CitationStyle {
  id: CitationStyleId;
  /** What a student recognises it as. */
  name: string;
  /** The edition the CSL definition implements, shown so the claim is checkable. */
  edition: string;
  /**
   * Numeric styles number the reference list in citation order, and an
   * in-text citation is that number. Author-date styles sort alphabetically.
   */
  numeric: boolean;
  /** Whether the reference list is printed with a hanging indent. */
  hangingIndent: boolean;
  load: () => Promise<string>;
}

export const CITATION_STYLES: readonly CitationStyle[] = [
  {
    id: "apa",
    name: "APA",
    edition: "7th edition",
    numeric: false,
    hangingIndent: true,
    load: () => import("./styles/generated/apa").then((module) => module.default),
  },
  {
    id: "mla",
    name: "MLA",
    edition: "9th edition",
    numeric: false,
    hangingIndent: true,
    load: () => import("./styles/generated/mla").then((module) => module.default),
  },
  {
    id: "chicago",
    name: "Chicago",
    edition: "18th edition, author-date",
    numeric: false,
    hangingIndent: true,
    load: () => import("./styles/generated/chicago").then((module) => module.default),
  },
  {
    id: "ieee",
    name: "IEEE",
    edition: "2023 reference guide",
    numeric: true,
    hangingIndent: false,
    load: () => import("./styles/generated/ieee").then((module) => module.default),
  },
  {
    id: "harvard",
    name: "Harvard",
    edition: "Cite Them Right, 12th edition",
    numeric: false,
    hangingIndent: true,
    load: () => import("./styles/generated/harvard").then((module) => module.default),
  },
];

export const DEFAULT_STYLE: CitationStyleId = "apa";

export function getStyle(id: string): CitationStyle {
  return CITATION_STYLES.find((style) => style.id === id) ?? CITATION_STYLES[0];
}

export function isStyleId(value: string): value is CitationStyleId {
  return CITATION_STYLES.some((style) => style.id === value);
}
