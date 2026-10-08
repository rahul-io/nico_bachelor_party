"use client";

import { Crown } from "lucide-react";
import { useState } from "react";
import { PersonPoints } from "@/components/leaderboard/PersonPoints";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { usePolled } from "@/hooks/usePolled";
import { useIdentity } from "@/hooks/useProfile";
import { formatBac } from "@/lib/bac";
import { cn } from "@/lib/cn";
import { formatPoints } from "@/lib/points/format";
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
  const [openId, setOpenId] = useState<string | null>(null);

  if (!data) {
    return <Card className="text-muted">{error ? "Couldn't load the leaderboard. Retrying…" : "Loading…"}</Card>;
  }

  const ranked = [...data].sort((a, b) => b[sort] - a[sort] || a.name.localeCompare(b.name));
  const open = data.find((entry) => entry.id === openId);
  const stat = (entry: LeaderboardEntry, key: Sort) =>
    key === "bac" ? formatBac(entry.bac) : key === "points" ? formatPoints(entry.points) : String(entry.drinks);
  const unit = (entry: LeaderboardEntry, key: Sort) =>
    key === "bac" ? "BAC" : key === "points" ? "pts" : entry.drinks === 1 ? "drink" : "drinks";

  return (
    <div className="space-y-3">
      <Segmented options={sorts} value={sort} onChange={setSort} label="Sort by" size="sm" />

      <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {ranked.map((entry, index) => (
          <li key={entry.id}>
            {/* Tap a row for that person's points by source. */}
            <button
              type="button"
              onClick={() => setOpenId(entry.id)}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-3 text-left",
                // Gold for whoever leads; a quiet tint so you can find yourself.
                index === 0 ? "bg-gold/20" : entry.id === identity?.id && "bg-raised",
              )}
            >
            <span className="flex w-5 shrink-0 justify-center font-display font-bold tabular-nums text-muted">
              {index === 0 ? <Crown className="size-5 text-accent" aria-label="1" /> : index + 1}
            </span>
            <Avatar name={entry.name} src={entry.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {entry.name}
                {entry.id === identity?.id && <span className="ml-1.5 text-sm font-normal text-link">you</span>}
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
              <p className="text-xs uppercase tracking-wide text-muted">{unit(entry, sort)}</p>
            </div>
            </button>
          </li>
        ))}
      </ol>
      {open && <PersonPoints person={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
