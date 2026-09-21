/**
 * Recognises what a student pasted into the "find my source" box.
 *
 * Detection is deliberately generous about surrounding noise ("doi:", a full
 * https://doi.org/ link, hyphenated ISBNs) and strict about the identifier
 * itself: an ISBN must pass its check digit, so a mistyped one is reported as
 * invalid on the spot instead of costing a network round trip to learn that
 * nothing has that number.
 */
import type { ParsedIdentifier } from "./types";

// Crossref's own guidance for matching modern DOIs.
const DOI_PATTERN = /10\.\d{4,9}\/[^\s"<>]+/i;
const ARXIV_NEW = /^\d{4}\.\d{4,5}(v\d+)?$/;
const ARXIV_OLD = /^[a-z-]+(\.[A-Z]{2})?\/\d{7}(v\d+)?$/i;

/** Trailing punctuation that belongs to the sentence a DOI was copied from. */
function trimDoi(doi: string): string {
  return doi.replace(/[.,;:)\]}'"]+$/, "");
}

export function isValidIsbn10(digits: string): boolean {
  if (!/^\d{9}[\dXx]$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const char = digits[i];
    const value = char === "X" || char === "x" ? 10 : Number(char);
    sum += value * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

export function isbn10To13(isbn10: string): string {
  const body = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return `${body}${(10 - (sum % 10)) % 10}`;
}

/**
 * Returns the ISBN as 13 bare digits, or null when the input is not a valid
 * ISBN. Every ISBN-10 has exactly one ISBN-13 form, so normalising to that
 * means a book found by either spelling is the same book.
 */
export function normalizeIsbn(input: string): string | null {
  const bare = input.replace(/[\s-]/g, "");
  if (isValidIsbn13(bare)) return bare;
  if (isValidIsbn10(bare)) return isbn10To13(bare.toUpperCase());
  return null;
}

export type IdentifierResult =
  | { ok: true; identifier: ParsedIdentifier }
  | { ok: false; reason: "empty" | "invalid-isbn" | "unrecognised" };

export function parseIdentifier(input: string): IdentifierResult {
  const text = input.trim();
  if (!text) return { ok: false, reason: "empty" };

  // A DOI is unambiguous wherever it appears, including inside a URL.
  const doi = DOI_PATTERN.exec(text);
  if (doi && !/arxiv\.org\//i.test(text)) {
    const value = trimDoi(doi[0]);
    // Crossref DOIs for arXiv preprints are DataCite ones; route them the way
    // the student would expect, by the arXiv id inside.
    const embedded = /^10\.48550\/arxiv\.(.+)$/i.exec(value);
    if (embedded) return { ok: true, identifier: { kind: "arxiv", value: embedded[1] } };
    return { ok: true, identifier: { kind: "doi", value } };
  }

  const arxivUrl = /arxiv\.org\/(?:abs|pdf)\/([^\s?#]+?)(?:\.pdf)?$/i.exec(text);
  const arxivPrefixed = /^arxiv:\s*(\S+)$/i.exec(text);
  const arxivCandidate = arxivUrl?.[1] ?? arxivPrefixed?.[1] ?? text;
  if (ARXIV_NEW.test(arxivCandidate) || ARXIV_OLD.test(arxivCandidate)) {
    return { ok: true, identifier: { kind: "arxiv", value: arxivCandidate.replace(/v\d+$/, "") } };
  }

  const pubmedUrl = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d{1,9})/i.exec(text);
  const pmidPrefixed = /^pmid:?\s*(\d{1,9})$/i.exec(text);
  const pmid = pubmedUrl?.[1] ?? pmidPrefixed?.[1];
  if (pmid) return { ok: true, identifier: { kind: "pmid", value: pmid } };

  const isbnPrefixed = /^isbn(?:-1[03])?:?\s*(.+)$/i.exec(text);
  const isbnCandidate = (isbnPrefixed?.[1] ?? text).replace(/[\s-]/g, "");
  if (/^\d{9}[\dXx]$/.test(isbnCandidate) || /^\d{13}$/.test(isbnCandidate)) {
    const isbn = normalizeIsbn(isbnCandidate);
    return isbn
      ? { ok: true, identifier: { kind: "isbn", value: isbn } }
      : { ok: false, reason: "invalid-isbn" };
  }

  // A bare run of up to nine digits is a PubMed id; longer runs were handled
  // as ISBNs above, so there is no overlap.
  if (/^\d{1,9}$/.test(text)) return { ok: true, identifier: { kind: "pmid", value: text } };

  return { ok: false, reason: "unrecognised" };
}
