"use client";

import { useEffect, useState } from "react";
import { SLOT_OUTCOMES, slotNames, type SlotOutcome } from "@/lib/games/slot";

const TICK_MS = 100;
// When each reel stops, and when the overlay closes itself.
const STOPS_MS = [1000, 1500, 2000];
const SKIP_AFTER_MS = 1000;
const CLOSE_AFTER_MS = 5500;

// Where the reel window sits in public/brand/slot/frame.webp, as a share of the
// frame. Measured from the source artwork; see scripts/make-brand.mjs.
const WINDOW = { left: "8.9%", top: "39.5%", width: "82.2%", height: "27.8%" };

const effects: Record<SlotOutcome, string> = {
  "1x": "No change to this drink.",
  "2x": "This drink scores double.",
  "3x": "This drink scores triple.",
  bust: "This drink scores half.",
  jackpot: "Bonus points on top of this drink.",
  rob: "You took points from first place.",
  forward: "This drink's points went to someone else.",
};

const symbol = (outcome: SlotOutcome) => `/brand/slot/${outcome}.webp`;

function Symbol({ outcome, className }: { outcome: SlotOutcome; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small pre-sized brand asset
    <img src={symbol(outcome)} alt="" draggable={false} className={className} />
  );
}

/** One reel: a strip of every symbol running past, then the result dropping into place. */
function Reel({ index, stopped, result }: { index: number; stopped: boolean; result: SlotOutcome }) {
  // Each reel starts on a different symbol so the three don't run in step.
  const order = [...SLOT_OUTCOMES.slice(index * 2), ...SLOT_OUTCOMES.slice(0, index * 2)];

  return (
    <div className="relative h-full flex-1 overflow-hidden">
      {stopped ? (
        <div className="flex size-full animate-reel-land items-center justify-center">
          <Symbol outcome={result} className="h-[86%] w-auto" />
        </div>
      ) : (
        // The strip is the symbols twice over, so moving it up by half loops seamlessly.
        <div className="animate-reel blur-[1.5px]" style={{ animationDelay: `${index * -130}ms` }}>
          {[...order, ...order].map((outcome, position) => (
            <Symbol key={position} outcome={outcome} className="mx-auto aspect-square w-[86%]" />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The slot machine shown after a drink that spins. Display only: the result
 * was drawn on the server and is already in the ledger, so closing this early
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-navy/90 px-4 text-sand"
    >
      <div className="relative aspect-[900/887] w-full max-w-sm" aria-hidden>
        {/* The window is cut out of the frame, so the reels sit behind it on a sand panel. */}
        <div className="absolute flex divide-x-2 divide-gold/60 bg-sand" style={WINDOW}>
          {STOPS_MS.map((stop, index) => (
            <Reel key={index} index={index} stopped={elapsed >= stop} result={result} />
          ))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized brand asset */}
        <img src="/brand/slot/frame.webp" alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full" />
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
