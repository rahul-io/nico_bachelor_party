"use client";

import { usePointsStatus } from "@/hooks/usePointsStatus";
import { formatDelta } from "@/lib/points/format";

/** The latest awards and Cheers, at the top of the Leaderboard. Nothing is shown until there is news. */
export function Dispatches() {
  const dispatches = usePointsStatus()?.dispatches ?? [];
  if (dispatches.length === 0) return null;

  return (
    <section className="rounded-card border border-gold/50 bg-surface px-4 py-3 shadow-card">
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Dispatches</h2>
      <ul className="mt-1 divide-y divide-line">
        {dispatches.slice(0, 4).map((item) => (
          <li key={item.id} className="flex items-baseline gap-3 py-1.5">
            <p className="min-w-0 flex-1">
              <span className="font-semibold">{item.profileName}</span>{" "}
              <span className="text-muted">{item.text}</span>
            </p>
            <span className="shrink-0 font-display font-bold tabular-nums text-accent">{formatDelta(item.delta)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
