"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { usePolled } from "@/hooks/usePolled";
import { useIdentity } from "@/hooks/useProfile";
import { formatBac } from "@/lib/bac";
import type { LeaderboardEntry } from "@/lib/store/types";

const sorts = [
  { value: "points", label: "Points" },
  { value: "drinks", label: "Drinks" },
  { value: "bac", label: "BAC" },
] as const;

type Sort = (typeof sorts)[number]["value"];

export function Standings() {
  const identity = useIdentity();
  const { data, error } = usePolled<LeaderboardEntry[]>("/api/leaderboard");
  const [sort, setSort] = useState<Sort>("points");

  if (!data) {
    return <Card className="text-muted">{error ? "Couldn't load the leaderboard. Retrying…" : "Loading…"}</Card>;
  }

  const ranked = [...data].sort((a, b) => b[sort] - a[sort] || a.name.localeCompare(b.name));
  const stat = (entry: LeaderboardEntry, key: Sort) =>
    key === "bac" ? formatBac(entry.bac) : String(entry[key]);
  const unit = (entry: LeaderboardEntry, key: Sort) =>
    key === "bac" ? "BAC" : key === "points" ? "pts" : entry.drinks === 1 ? "drink" : "drinks";

  return (
    <div className="space-y-3">
      <Segmented options={sorts} value={sort} onChange={setSort} label="Sort by" size="sm" />

      <ol className="divide-y divide-line rounded-card border border-line bg-surface">
        {ranked.map((entry, index) => (
          <li key={entry.id} className="flex items-center gap-3 px-3 py-3">
            <span className="w-5 shrink-0 text-center font-display font-bold tabular-nums text-muted">
              {index + 1}
            </span>
            <Avatar name={entry.name} src={entry.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {entry.name}
                {entry.id === identity?.id && <span className="ml-1.5 text-sm font-normal text-primary">you</span>}
              </p>
              <p className="text-sm tabular-nums text-muted">
                {sorts
                  .filter((option) => option.value !== sort)
                  .map((option) => `${stat(entry, option.value)} ${unit(entry, option.value)}`)
                  .join(" · ")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-xl font-bold tabular-nums text-accent">{stat(entry, sort)}</p>
              <p className="text-xs uppercase tracking-wide text-muted">
                {sort === "bac" ? "est. BAC" : unit(entry, sort)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <p className="px-1 text-xs text-muted">
        BAC numbers are rough guesses, just for fun. They can&apos;t tell you whether anyone is able to drive.
      </p>
    </div>
  );
}
