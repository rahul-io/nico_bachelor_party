"use client";

import { Card } from "@/components/ui/Card";
import { usePolled } from "@/hooks/usePolled";
import type { Challenge } from "@/lib/store/types";

export function ChallengeList() {
  const { data, error } = usePolled<Challenge[]>("/api/challenges");

  if (!data) {
    return <Card className="text-muted">{error ? "Couldn't load challenges. Retrying…" : "Loading…"}</Card>;
  }
  if (data.length === 0) {
    return <Card className="text-muted">No challenges yet. Check back soon.</Card>;
  }

  return (
    <ul className="space-y-3">
      {data.map((challenge) => (
        <li key={challenge.id}>
          <Card className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold leading-snug">{challenge.title}</h2>
              {challenge.description && (
                <p className="mt-0.5 whitespace-pre-line text-muted">{challenge.description}</p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-accent px-3 py-1 font-display font-bold tabular-nums text-on-accent">
              +{challenge.points}
            </span>
          </Card>
        </li>
      ))}
    </ul>
  );
}
