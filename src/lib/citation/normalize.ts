/**
 * Turns whatever a metadata service sent into the CSL-JSON subset this tool
 * stores.
 *
 * Every lookup result passes through here before it reaches the page or the
 * database. Services add fields we do not use (licences, reference lists,
 * funder records), disagree on type names, and occasionally send a title as
 * an array or with publisher markup in it. Picking out the known fields, and
 * checking the shape of each, keeps a surprise in one response from ending up
 * saved on the student's device.
 */
import type { CslDate, CslItem, CslItemType, CslName } from "./types";

type Json = Record<string, unknown>;

export function asRecord(value: unknown): Json | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

/**
 * Crossref's vocabulary and CSL's differ, and doi.org content negotiation
 * passes Crossref's through unchanged, so both spellings arrive in practice.
 */
const TYPE_MAP: Record<string, CslItemType> = {
  "article-journal": "article-journal",
  "journal-article": "article-journal",
  book: "book",
  monograph: "book",
  "edited-book": "book",
  "reference-book": "book",
  chapter: "chapter",
  "book-chapter": "chapter",
  "book-section": "chapter",
  "book-part": "chapter",
  "reference-entry": "chapter",
  "paper-conference": "paper-conference",
  "proceedings-article": "paper-conference",
  webpage: "webpage",
  article: "article",
  "posted-content": "article",
  preprint: "article",
  report: "report",
  thesis: "thesis",
  dissertation: "thesis",
};

export function normalizeType(value: unknown, fallback: CslItemType): CslItemType {
  return typeof value === "string" ? (TYPE_MAP[value.toLowerCase()] ?? fallback) : fallback;
}

/**
 * Publisher markup in titles: Crossref passes JATS through, and PubMed uses
 * plain HTML. Italics, bold, sub- and superscripts carry meaning (species
 * names, chemical formulae) and survive as the tags the formatter understands;
 * anything else is removed.
 */
export function cleanText(value: string): string {
  return value
    .replace(/<(\/?)jats:(italic|bold|sub|sup)>/gi, (_, slash: string, tag: string) => {
      const name = tag.toLowerCase() === "italic" ? "i" : tag.toLowerCase() === "bold" ? "b" : tag;
      return `<${slash}${name.toLowerCase()}>`;
    })
    .replace(/<(?!\/?(?:i|b|sub|sup)>)[^>]*>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A string field, or the first string of an array one. Never an empty string. */
export function readString(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value.find((entry) => typeof entry === "string") : value;
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw !== "string") return undefined;
  const text = cleanText(raw);
  return text || undefined;
}

export function readNames(value: unknown): CslName[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const names: CslName[] = [];
  for (const entry of value) {
    const raw = asRecord(entry);
    if (!raw) continue;

    const family = readString(raw.family);
    const given = readString(raw.given);
    const suffix = readString(raw.suffix);
    // Crossref sends organisations as `name`; CSL calls it `literal`.
    const literal = readString(raw.literal) ?? readString(raw.name);

    if (family) {
      const name: CslName = { family };
      if (given) name.given = given;
      if (suffix) name.suffix = suffix;
      names.push(name);
    } else if (literal) {
      names.push({ literal });
    }
  }
  return names.length > 0 ? names : undefined;
}

export function makeDate(year: number, month?: number, day?: number): CslDate | undefined {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return undefined;
  if (month === undefined || !Number.isInteger(month) || month < 1 || month > 12) {
    return { "date-parts": [[year]] };
  }
  if (day === undefined || !Number.isInteger(day) || day < 1 || day > 31) {
    return { "date-parts": [[year, month]] };
  }
  return { "date-parts": [[year, month, day]] };
}

export function readDate(value: unknown): CslDate | undefined {
  const raw = asRecord(value);
  if (!raw) return undefined;

  const parts = raw["date-parts"];
  if (Array.isArray(parts) && Array.isArray(parts[0])) {
    const [year, month, day] = (parts[0] as unknown[]).map((part) =>
      typeof part === "string" ? Number(part) : part,
    );
    if (typeof year === "number") {
      return makeDate(
        year,
        typeof month === "number" ? month : undefined,
        typeof day === "number" ? day : undefined,
      );
    }
  }

  // A few services send only `raw`; a four-digit year is the part worth keeping.
  return typeof raw.raw === "string" ? yearFromText(raw.raw) : undefined;
}

/** The first plausible publication year in free text such as "c1998, reprinted 2004". */
export function yearFromText(text: string): CslDate | undefined {
  // Digit lookarounds rather than \b, so "c1998" (circa) still matches.
  const match = /(?<!\d)(1[5-9]\d\d|20\d\d)(?!\d)/.exec(text);
  return match ? makeDate(Number(match[1])) : undefined;
}

const ORDINALS: Record<string, string> = {
  first: "1",
  second: "2",
  third: "3",
  fourth: "4",
  fifth: "5",
  sixth: "6",
  seventh: "7",
  eighth: "8",
  ninth: "9",
  tenth: "10",
  eleventh: "11",
  twelfth: "12",
};

/**
 * CSL styles add "ed." or "edition" themselves and only do it properly for a
 * bare number, so "Third Edition" and "3rd ed." are both reduced to "3".
 * Anything that is not a numbered edition ("Revised") is kept as written.
 */
export function normalizeEdition(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = value.trim();
  const digits = /^(\d+)(?:st|nd|rd|th)?\b/i.exec(text);
  if (digits) return digits[1];
  const word = /^([a-z]+)\b/i.exec(text)?.[1]?.toLowerCase();
  if (word && ORDINALS[word]) return ORDINALS[word];
  return text || undefined;
}

/** DOIs are case-insensitive; arXiv's are conventionally written with this casing. */
export function normalizeDoi(doi: string): string {
  return doi.trim().replace(/^10\.48550\/arxiv\./i, "10.48550/arXiv.");
}

/**
 * Picks the fields this tool understands out of a CSL-JSON (or near-CSL)
 * record. Returns null when there is not even a title, because a citation
 * with no title is not something any style can print.
 */
export function normalizeCslItem(
  value: unknown,
  options: { id: string; fallbackType: CslItemType },
): CslItem | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const title = readString(raw.title);
  if (!title) return null;

  const item: CslItem = {
    id: options.id,
    type: normalizeType(raw.type, options.fallbackType),
    title,
  };

  const author = readNames(raw.author);
  if (author) item.author = author;
  const editor = readNames(raw.editor);
  if (editor) item.editor = editor;

  const issued =
    readDate(raw.issued) ??
    readDate(raw["published-print"]) ??
    readDate(raw["published-online"]) ??
    readDate(raw.published);
  if (issued) item.issued = issued;

  const strings = [
    "container-title",
    "volume",
    "issue",
    "page",
    "publisher",
    "publisher-place",
    "ISBN",
    "URL",
    "PMID",
    "number",
    "genre",
  ] as const;
  for (const key of strings) {
    const text = readString(raw[key]);
    if (text) item[key] = text;
  }

  const edition = normalizeEdition(readString(raw.edition));
  if (edition) item.edition = edition;

  const doi = readString(raw.DOI);
  if (doi) {
    item.DOI = normalizeDoi(doi);
    // Every style prints the DOI in preference to a URL, and the URL a
    // service sends for a DOI record is only the DOI again as a link.
    delete item.URL;
  }

  return item;
}
