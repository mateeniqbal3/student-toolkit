/**
 * Page ranges as people type them: "1-3, 5, 8-". Pages are numbered from 1
 * here, as printed; everything else in `lib/pdf` works in 0-based indexes.
 */

export interface PageRange {
  /** 1-based, inclusive. */
  from: number;
  to: number;
}

export type RangeError =
  | { kind: "empty" }
  | { kind: "invalid"; token: string }
  | { kind: "out-of-range"; token: string; pageCount: number }
  | { kind: "backwards"; token: string };

export type RangeResult = { ok: true; ranges: PageRange[] } | { ok: false; error: RangeError };

/**
 * Reads "1-3, 5, 8-" against a document of `pageCount` pages. An open end
 * ("8-") runs to the last page, "-3" starts at the first, and spaces and
 * en dashes are forgiven. Order is kept: "5, 1-2" means page 5 first.
 */
export function parsePageRanges(input: string, pageCount: number): RangeResult {
  const tokens = input
    .split(/[,;]/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return { ok: false, error: { kind: "empty" } };

  const ranges: PageRange[] = [];
  for (const token of tokens) {
    const match = /^(\d*)\s*(?:[-–—]\s*(\d*))?$/.exec(token);
    if (!match || (match[1] === "" && match[2] === undefined) || token === "-") {
      return { ok: false, error: { kind: "invalid", token } };
    }
    const isRange = match[2] !== undefined;
    const from = match[1] ? Number(match[1]) : 1;
    const to = isRange ? (match[2] ? Number(match[2]) : pageCount) : from;
    if (from < 1 || to < 1 || from > pageCount || to > pageCount) {
      return { ok: false, error: { kind: "out-of-range", token, pageCount } };
    }
    if (to < from) return { ok: false, error: { kind: "backwards", token } };
    ranges.push({ from, to });
  }
  return { ok: true, ranges };
}

/** The 0-based page indexes a set of ranges covers, in order, repeats kept. */
export function rangeIndexes(ranges: readonly PageRange[]): number[] {
  return ranges.flatMap(({ from, to }) =>
    Array.from({ length: to - from + 1 }, (_, offset) => from - 1 + offset),
  );
}

/** Chunks of `size` pages: 10 pages every 4 is 1-4, 5-8, 9-10. */
export function everyNPages(pageCount: number, size: number): PageRange[] {
  const step = Math.max(1, Math.floor(size));
  const ranges: PageRange[] = [];
  for (let from = 1; from <= pageCount; from += step) {
    ranges.push({ from, to: Math.min(pageCount, from + step - 1) });
  }
  return ranges;
}

/** "1-3" or "5", for file names and labels. */
export function formatRange({ from, to }: PageRange): string {
  return from === to ? String(from) : `${from}-${to}`;
}
