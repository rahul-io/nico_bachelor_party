"use client";

import { LedgerList } from "@/components/leaderboard/PointsHistory";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { usePolled } from "@/hooks/usePolled";
import { formatPoints, sourceLabels } from "@/lib/points/format";
import type { PointHistoryEntry, PointSource, PublicProfile } from "@/lib/store/types";

interface PersonPointsData {
  bySource: Array<{ source: PointSource; points: number }>;
  entries: PointHistoryEntry[];
}

/** One person's points: where they came from, then their latest entries. */
export function PersonPoints({ person, onClose }: { person: PublicProfile; onClose: () => void }) {
  const { data, error } = usePolled<PersonPointsData>(`/api/points?profile=${person.id}`);

  return (
    <Sheet title={person.name} onClose={onClose}>
      <div className="space-y-4 p-4">
        {!data && <Card className="text-muted">{error ? "Couldn't load. Retrying…" : "Loading…"}</Card>}
        {data && data.entries.length === 0 && <Card className="text-muted">No points yet.</Card>}
        {data && data.bySource.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Points by source</h3>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {data.bySource.map((item) => (
                <li key={item.source} className="flex items-center justify-between px-4 py-2.5">
                  <span>{sourceLabels[item.source]}</span>
                  <span className="font-display text-lg font-bold tabular-nums text-accent">
                    {formatPoints(item.points)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {data && data.entries.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Latest entries</h3>
            <LedgerList entries={data.entries} showName={false} />
          </section>
        )}
      </div>
    </Sheet>
  );
}
