"use client";

import Link from "next/link";
import { useState } from "react";
import { Dispatches } from "@/components/leaderboard/Dispatches";
import { GamesBoard } from "@/components/games/GamesBoard";
import { ChallengeList } from "@/components/leaderboard/ChallengeList";
import { PointsHistory } from "@/components/leaderboard/PointsHistory";
import { Standings } from "@/components/leaderboard/Standings";
import { TrendChart } from "@/components/leaderboard/TrendChart";
import { PageTitle } from "@/components/ui/PageTitle";
import { Segmented } from "@/components/ui/Segmented";

const views = [
  { value: "standings", label: "Standings" },
  { value: "trends", label: "Trends" },
  { value: "games", label: "Games" },
  { value: "challenges", label: "Challenges" },
] as const;

// The Ledger is a fifth view, opened from the link under the title: five tabs don't fit a phone.
type View = (typeof views)[number]["value"] | "history";

export default function LeaderboardPage() {
  const [view, setView] = useState<View>("standings");

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="The Crider Cup" title="Leaderboard">
        <p className="flex gap-4 text-sm">
          <Link href="/leaderboard/rules" className="inline-flex min-h-9 items-center text-link underline">
            How points work
          </Link>
          <button
            type="button"
            onClick={() => setView("history")}
            aria-pressed={view === "history"}
            className="inline-flex min-h-9 items-center text-link underline"
          >
            Ledger
          </button>
        </p>
      </PageTitle>
      {view === "standings" && <Dispatches />}
      <Segmented
        options={views}
        value={view === "history" ? ("" as (typeof views)[number]["value"]) : view}
        onChange={setView}
        label="Leaderboard view"
        size="sm"
      />
      {view === "standings" && <Standings />}
      {view === "trends" && <TrendChart />}
      {view === "games" && <GamesBoard />}
      {view === "challenges" && <ChallengeList />}
      {view === "history" && (
        <>
          <h2 className="font-display text-xl font-bold">Ledger</h2>
          <PointsHistory />
        </>
      )}
    </div>
  );
}
