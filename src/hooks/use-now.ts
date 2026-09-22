"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The current time as state, so rendering stays pure. It ticks on an
 * interval — a flashcard due in ten minutes appears without a reload, and
 * today's focus total rolls over at midnight — and `refresh` moves it on
 * immediately after something changes.
 */
export function useNow(intervalMs = 15_000): [number, () => void] {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  const refresh = useCallback(() => setNow(Date.now()), []);
  return [now, refresh];
}
