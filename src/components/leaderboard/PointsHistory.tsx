"use client";

import { Card } from "@/components/ui/Card";
import { usePolled } from "@/hooks/usePolled";
import { cn } from "@/lib/cn";
import type { PointHistoryEntry } from "@/lib/store/types";
import { formatWeekdayTime } from "@/lib/time";

export function PointsHistory({ limit }: { limit?: number }) {
  const { data, error } = usePolled<PointHistoryEntry[]>("/api/points");

  if (!data) {
    return <Card className="text-muted">{error ? "Couldn't load the history. Retrying…" : "Loading…"}</Card>;
  }
  if (data.length === 0) {
    return <Card className="text-muted">No points handed out yet.</Card>;
  }

  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface">
      {data.slice(0, limit).map((entry) => (
        <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{entry.profileName}</p>
            <p className="text-sm text-muted">
              {entry.reason ? `${entry.reason} · ` : ""}
              {formatWeekdayTime(entry.createdAt)}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 font-display text-lg font-bold tabular-nums",
              entry.delta < 0 ? "text-danger" : "text-accent",
            )}
          >
            {entry.delta > 0 ? `+${entry.delta}` : `−${Math.abs(entry.delta)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
