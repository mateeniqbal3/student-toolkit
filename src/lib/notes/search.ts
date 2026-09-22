/**
 * Full-text search over notes with MiniSearch.
 *
 * The index is built in memory from the notes each time they change rather
 * than stored: rebuilding a few hundred notes takes milliseconds, and an
 * index persisted beside the notes is one more thing that can fall out of
 * step with them.
 */
import MiniSearch from "minisearch";

export interface SearchableNote {
  id: number;
  title: string;
  body: string;
  tags: readonly string[];
}

export type NoteIndex = MiniSearch<SearchableNote>;

export function buildIndex(notes: readonly SearchableNote[]): NoteIndex {
  const index = new MiniSearch<SearchableNote>({
    fields: ["title", "body", "tags"],
    extractField: (note, field) => {
      if (field === "tags") return note.tags.join(" ");
      if (field === "id") return String(note.id);
      return field === "title" ? note.title : note.body;
    },
    searchOptions: {
      boost: { title: 3, tags: 2 },
      // "photosynth" finds photosynthesis while typing; small typos still match.
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: "AND",
    },
  });
  index.addAll(notes);
  return index;
}

/** Matching note ids, best match first. An empty query matches nothing. */
export function searchNotes(index: NoteIndex, query: string): number[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return index.search(trimmed).map((result) => Number(result.id));
}
