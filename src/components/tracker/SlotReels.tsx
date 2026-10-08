"use client";

import { useEffect, useState } from "react";
import { SLOT_OUTCOMES, slotEmoji, slotNames, type SlotOutcome } from "@/lib/games/slot";

const TICK_MS = 80;
// When each reel stops, and when the overlay closes itself.
const STOPS_MS = [900, 1400, 1900];
const SKIP_AFTER_MS = 1000;
const CLOSE_AFTER_MS = 5200;

const effects: Record<SlotOutcome, string> = {
  "1x": "No change to this drink.",
  "2x": "This drink scores double.",
  "3x": "This drink scores triple.",
  bust: "This drink scores half.",
  jackpot: "Bonus points on top of this drink.",
  rob: "You took points from first place.",
  forward: "This drink's points went to someone else.",
};

/**
 * The three reels shown after a drink is logged. Display only: the result was
 * drawn on the server and is already in the ledger, so closing this early
 * changes nothing.
 */
export function SlotReels({ outcome, forShow, onDone }: { outcome: string; forShow: boolean; onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const result = (SLOT_OUTCOMES as readonly string[]).includes(outcome) ? (outcome as SlotOutcome) : "1x";

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - start), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (elapsed >= CLOSE_AFTER_MS) onDone();
  }, [elapsed, onDone]);

  const stopped = elapsed >= STOPS_MS[2];
  const canSkip = elapsed >= SKIP_AFTER_MS;

  return (
    <button
      type="button"
      onClick={() => canSkip && onDone()}
      aria-label={stopped ? `${slotNames[result]}. Close` : "Spinning"}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-navy/90 px-6 text-sand"
    >
      <div className="flex gap-3" aria-hidden>
        {STOPS_MS.map((stop, reel) => (
          <span
            key={reel}
            className="flex size-24 items-center justify-center rounded-card border-2 border-gold bg-sand text-5xl shadow-card"
          >
            {elapsed >= stop
              ? slotEmoji[result]
              : slotEmoji[SLOT_OUTCOMES[(Math.floor(elapsed / TICK_MS) + reel * 3) % SLOT_OUTCOMES.length]]}
          </span>
        ))}
      </div>
      <div className="min-h-24 text-center" aria-live="polite">
        {stopped && (
          <>
            <p className="font-display text-4xl font-bold text-gold-hi">{slotNames[result]}</p>
            <p className="mt-1 text-sand/85">
              {forShow ? "This drink earned no points, so the spin doesn't count." : effects[result]}
            </p>
          </>
        )}
      </div>
      <p className="text-sm text-sand/60">{canSkip ? "Tap to close" : " "}</p>
    </button>
  );
}
