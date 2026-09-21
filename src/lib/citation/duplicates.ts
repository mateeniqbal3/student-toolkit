/**
 * Spotting a source that is already in the bibliography.
 *
 * Pasting the same DOI twice is the most common way a reference list ends up
 * with a duplicate entry, and the second copy then renders as a different
 * source — "2020a" and "2020b" of the same paper. Identifiers are compared
 * first because they are exact; a matching title and year catches the same
 * source typed in by hand.
 */
import type { CslItem } from "./types";

function comparable(text: string | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function year(item: CslItem): number | undefined {
  return item.issued?.["date-parts"][0][0];
}

export function isSameSource(a: CslItem, b: CslItem): boolean {
  if (a.DOI && b.DOI) return a.DOI.toLowerCase() === b.DOI.toLowerCase();
  if (a.ISBN && b.ISBN) return a.ISBN === b.ISBN;
  if (a.PMID && b.PMID) return a.PMID === b.PMID;

  const title = comparable(a.title);
  return title !== "" && title === comparable(b.title) && year(a) === year(b);
}

export function findDuplicate<T extends { item: CslItem }>(
  records: readonly T[],
  candidate: CslItem,
): T | undefined {
  return records.find(
    (record) => record.item.id !== candidate.id && isSameSource(record.item, candidate),
  );
}
