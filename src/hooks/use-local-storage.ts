"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A string preference that survives a reload.
 *
 * `localStorage` is an external store, so this is `useSyncExternalStore`
 * rather than state synced by an effect. That is not a style preference: the
 * server has no storage to read, and the hook's server snapshot is the
 * fallback, which lets React hydrate against matching HTML and then re-render
 * once with the real value. Syncing in an effect would either flash or warn.
 *
 * Storage can fail outright — Safari in private mode, a browser told to block
 * site data — so every access is guarded and failure degrades to an in-memory
 * value that still works for the rest of the session.
 */

const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // Picks up a change made in another tab; the local set below covers this one.
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useLocalStorage(key: string, fallback: string): [string, (value: string) => void] {
  const getSnapshot = useCallback(() => read(key) ?? memory.get(key) ?? fallback, [key, fallback]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: string) => {
      memory.set(key, next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // The in-memory copy above still applies for this session.
      }
      for (const listener of listeners) listener();
    },
    [key],
  );

  return [value, setValue];
}
