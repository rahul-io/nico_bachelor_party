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
export function Splash({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const now = useNow(ROTATE_MS);
  // Fixed height so the layout doesn't move when the text appears or changes.
  const box = size === "lg" ? "h-11 text-4xl" : "h-9 text-[1.75rem]";
  if (now === null) return <span className={cn("block", box, className)} aria-hidden />;

  return (
    <span
      key={now}
      aria-hidden
      className={cn(
        "block -rotate-3 animate-splash whitespace-nowrap font-script font-bold italic leading-tight",
        box,
        className,
      )}
    >
      {SPLASHES[Math.floor(now / ROTATE_MS) % SPLASHES.length]}
    </span>
  );
}
