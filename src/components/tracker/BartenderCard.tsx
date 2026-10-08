"use client";

import { Button } from "@/components/ui/Button";
import { useNow } from "@/hooks/useNow";
import type { Assignment } from "@/lib/games/bartender";
import type { DrinkInput } from "@/lib/store/types";

/** The drink the bartender poured for this player, with the time left and a one-tap log. */
export function BartenderCard({ order, onLog }: { order: Assignment; onLog: (drink: DrinkInput) => void }) {
  const now = useNow(15_000);
  const left = now === null ? null : Date.parse(order.expiresAt) - now;
  if (left !== null && left <= 0) return null;
  const minutes = left === null ? null : Math.max(1, Math.round(left / 60_000));

  return (
    <div className="rounded-card border border-gold/50 bg-surface px-4 py-3 shadow-card">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Bartender&apos;s Choice</span>
        {minutes !== null && <span className="text-sm tabular-nums text-muted">{minutes} min left</span>}
      </p>
      <p className="mt-1 font-display text-xl font-bold">
        {order.name} <span className="tabular-nums text-accent">{order.multiplier}×</span>
      </p>
      <Button
        variant="primary"
        block
        className="mt-2"
        onClick={() =>
          onLog({ name: order.name, volumeOz: order.volumeOz, abv: order.abv, alcoholG: 0, category: order.category })
        }
      >
        Log it
      </Button>
    </div>
  );
}
