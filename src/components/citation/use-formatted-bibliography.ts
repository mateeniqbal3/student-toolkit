"use client";

import { useEffect, useState } from "react";

import { formatBibliography, type FormattedEntry } from "@/lib/citation/format";
import type { CitationStyleId, CslItem } from "@/lib/citation/types";

export interface FormattedState {
  /** Null until the first render finishes. Kept while a re-render runs, so the list does not flash. */
  entries: FormattedEntry[] | null;
  /** The formatter could not be loaded — offline before it was ever cached. */
  failed: boolean;
  retry: () => void;
}

/**
 * Runs the citation processor off the render path. It is asynchronous twice
 * over — the engine is a dynamic import, and a style's rules are another —
 * so the result arrives as state rather than being computed in render.
 */
export function useFormattedBibliography(
  items: readonly CslItem[] | undefined,
  style: CitationStyleId,
): FormattedState {
  const [entries, setEntries] = useState<FormattedEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (items === undefined) return;
    let active = true;

    formatBibliography(items, style).then(
      (next) => {
        if (!active) return;
        setEntries(next);
        setFailed(false);
      },
      () => {
        if (active) setFailed(true);
      },
    );

    return () => {
      active = false;
    };
  }, [items, style, attempt]);

  return { entries, failed, retry: () => setAttempt((count) => count + 1) };
}
