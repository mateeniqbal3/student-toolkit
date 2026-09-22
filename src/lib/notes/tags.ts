/**
 * Tags as students type them — "#Biology, exam prep" — normalised so that
 * the same tag is always spelled the same way.
 */

export const MAX_TAG_LENGTH = 40;

/** "#Exam Prep" becomes "exam-prep". Returns null for anything that is not a tag. */
export function normaliseTag(raw: string): string | null {
  const tag = raw
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[,#]/g, "")
    .slice(0, MAX_TAG_LENGTH)
    .replace(/^-+|-+$/g, "");
  return tag || null;
}

/** Reads a comma- or space-separated list, dropping repeats and keeping order. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  // Commas separate tags; without any, each hashtag or word is its own tag.
  const parts = input.includes(",") ? input.split(",") : input.split(/\s+/);
  for (const part of parts) {
    const tag = normaliseTag(part);
    if (tag) seen.add(tag);
  }
  return [...seen];
}

export function formatTags(tags: readonly string[]): string {
  return tags.join(", ");
}

export interface TagCount {
  tag: string;
  count: number;
}

/** Every tag in use, most used first, then alphabetically. */
export function countTags(notes: readonly { tags: readonly string[] }[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
