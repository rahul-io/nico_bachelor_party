"use client";

import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/cn";

/** The toast, as the crew spells it. Shown one at a time, in rotation, exactly as written. */
export const SPLASHES = [
  "Slange Va!",
  "Slanger Var!",
  "Slan Terfa!",
  "SlaanjeVa!",
  "Slag Na Va!",
  "Slamma Ga!",
  "Slainchawa",
  "Slanj a Var!",
];

const ROTATE_MS = 6000;

/**
 * A tilted line of splash text that moves on to the next spelling every few
 * seconds. Renders nothing on the server, because which one shows depends on the clock.
 */
export function Splash({ className }: { className?: string }) {
  const now = useNow(ROTATE_MS);
  if (now === null) return <span className={cn("block h-7", className)} aria-hidden />;

  return (
    <span
      key={now}
      aria-hidden
      className={cn("block h-7 -rotate-3 animate-splash font-script text-xl italic", className)}
    >
      {SPLASHES[Math.floor(now / ROTATE_MS) % SPLASHES.length]}
    </span>
  );
}
