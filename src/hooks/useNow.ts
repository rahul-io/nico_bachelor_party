"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Current time in ms, rounded down to `intervalMs` and re-rendering each time
 * it ticks over. `null` on the server and during hydration, so time-dependent
 * UI never mismatches the prerendered shell.
 */
export function useNow(intervalMs = 60_000): number | null {
  const subscribe = useCallback(
    (onTick: () => void) => {
      const id = setInterval(onTick, Math.min(intervalMs, 5_000));
      return () => clearInterval(id);
    },
    [intervalMs],
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
}
