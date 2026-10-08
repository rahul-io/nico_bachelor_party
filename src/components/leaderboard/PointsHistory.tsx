"use client";

import { Card } from "@/components/ui/Card";
import { usePolled } from "@/hooks/usePolled";
import { cn } from "@/lib/cn";
import { describeBreakdown, formatDelta } from "@/lib/points/format";
import type { PointHistoryEntry } from "@/lib/store/types";
import { formatWeekdayTime } from "@/lib/time";

/** Ledger rows. Each shows how its points were worked out; reversed entries stay, struck through. */
export function LedgerList({ entries, showName = true }: { entries: PointHistoryEntry[]; showName?: boolean }) {
  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface">
      {entries.map((entry) => {
        const voided = entry.voidedAt !== null;
        return (
          <li key={entry.id} className={cn("flex items-center gap-3 px-4 py-3", voided && "opacity-60")}>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate font-medium", voided && "line-through")}>
                {showName ? entry.profileName : (entry.reason ?? "Points")}
              </p>
              <p className="text-sm text-muted">
                {showName && entry.reason ? `${entry.reason} · ` : ""}
                {formatWeekdayTime(entry.createdAt)}
                {voided && " · reversed"}
              </p>
              {entry.breakdown && (
                <p className="text-sm tabular-nums text-muted">{describeBreakdown(entry.breakdown, entry.delta)}</p>
              )}
            </div>
            <span
              className={cn(
                "shrink-0 font-display text-lg font-bold tabular-nums",
                voided && "line-through",
                entry.delta < 0 ? "text-danger" : entry.delta === 0 ? "text-muted" : "text-accent",
              )}
            >
              {formatDelta(entry.delta)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function PointsHistory({ limit }: { limit?: number }) {
  const { data, error } = usePolled<PointHistoryEntry[]>("/api/points");

  if (!data) {
    return <Card className="text-muted">{error ? "Couldn't load the history. Retrying…" : "Loading…"}</Card>;
  }
  if (data.length === 0) {
    return <Card className="text-muted">No points handed out yet.</Card>;
  }
  return <LedgerList entries={data.slice(0, limit)} />;
}
