/**
 * Cached exchange rates.
 *
 * The cache is what makes the currency converter honest offline: rather than
 * failing or, worse, silently showing nothing, the tool shows the last table
 * it managed to fetch and says when that was.
 */
import { fetchRates, isStale, type RateTable } from "@/lib/currency/rates";

import { db } from "./schema";

export async function readCachedRates(base: string): Promise<RateTable | undefined> {
  return db.currencyRates.get(base.toUpperCase());
}

export async function writeCachedRates(table: RateTable): Promise<void> {
  await db.currencyRates.put(table);
}

export interface RateLoad {
  table: RateTable | undefined;
  /** True when the number on screen came from the cache, not the network. */
  fromCache: boolean;
  /** Set when the network was tried and failed, even if a cache was found. */
  error: string | null;
}

/**
 * Returns the cached table immediately when it is fresh, and otherwise tries
 * the network and falls back to whatever is cached.
 *
 * A stale rate is very nearly always better than no rate: a student working
 * out roughly what a 40 dollar textbook costs does not need this morning's
 * mid-market fix, they need the order of magnitude, and the UI tells them how
 * old the number is either way.
 */
export async function loadRates(base: string, force = false): Promise<RateLoad> {
  const code = base.toUpperCase();
  const cached = await readCachedRates(code);

  if (!force && cached && !isStale(cached)) {
    return { table: cached, fromCache: true, error: null };
  }

  try {
    const fresh = await fetchRates(code);
    await writeCachedRates(fresh);
    return { table: fresh, fromCache: false, error: null };
  } catch {
    return {
      table: cached,
      fromCache: true,
      error: cached
        ? "Could not reach the rate providers, so these are the last rates this device saw."
        : "Could not reach the rate providers, and there are no saved rates on this device yet.",
    };
  }
}
