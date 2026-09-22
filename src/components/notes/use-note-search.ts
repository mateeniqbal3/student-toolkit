"use client";

import { useEffect, useMemo, useState } from "react";

import type { NoteRecord } from "@/lib/db/notes";

type SearchModule = typeof import("@/lib/notes/search");

/** A plain substring match, used for the moment before the search index is ready. */
function substringMatches(notes: readonly NoteRecord[], query: string): number[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return notes
    .filter((note) => {
      const text = `${note.title}\n${note.body}\n${note.tags.join(" ")}`.toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .map((note) => note.id);
}

/**
 * Note ids matching the query, best first, or null when there is no query.
 *
 * MiniSearch loads the first time someone searches rather than with the
 * page. Until it arrives, a few milliseconds later, a substring match stands
 * in, so typing never shows an empty list.
 */
export function useNoteSearch(notes: readonly NoteRecord[], query: string): number[] | null {
  const [search, setSearch] = useState<SearchModule | null>(null);
  const searching = query.trim().length > 0;

  useEffect(() => {
    if (!searching || search) return;
    let active = true;
    import("@/lib/notes/search")
      .then((module) => {
        if (active) setSearch(module);
      })
      .catch(() => {
        // Offline before the index was ever cached: the substring match remains.
      });
    return () => {
      active = false;
    };
  }, [searching, search]);

  // Built only while searching, and rebuilt when the notes change.
  const index = useMemo(
    () => (search && searching ? search.buildIndex(notes) : null),
    [search, searching, notes],
  );

  return useMemo(() => {
    if (!searching) return null;
    if (search && index) return search.searchNotes(index, query);
    return substringMatches(notes, query);
  }, [searching, search, index, notes, query]);
}
