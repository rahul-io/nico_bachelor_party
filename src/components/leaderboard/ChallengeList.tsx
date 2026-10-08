"use client";

import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { usePolled } from "@/hooks/usePolled";
import type { Challenge } from "@/lib/store/types";

export function ChallengeList() {
  const { data, error } = usePolled<Challenge[]>("/api/challenges");

  return (
    <div className="space-y-3">
      {/* The lockup's lettering is navy, so it always sits on a sand plaque, day or night. */}
      <div className="flex justify-center rounded-card border border-gold/50 bg-sand px-4 py-3 shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized brand asset */}
        <img src="/brand/commodores-challenge.webp" alt="The Commodore's Challenge" className="h-36 w-auto" />
      </div>

      {!data && (
        <Card className="text-muted">{error ? "Couldn't load challenges. Retrying…" : "Loading…"}</Card>
      )}
      {data?.length === 0 && <Card className="text-muted">The Commodore has issued no challenges. Yet.</Card>}

      <ul className="space-y-3">
        {data?.map((challenge) => (
          <li key={challenge.id}>
            <Card className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-bold leading-snug">{challenge.title}</h2>
                {challenge.description && (
                  <p className="mt-0.5 whitespace-pre-line text-muted">{challenge.description}</p>
                )}
              </div>
              {/* Gold is for rewards. */}
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-linear-to-b from-gold-hi to-gold px-3 py-1 font-bold tabular-nums text-navy">
                <Trophy className="size-4" aria-hidden />
                {challenge.points}
              </span>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
