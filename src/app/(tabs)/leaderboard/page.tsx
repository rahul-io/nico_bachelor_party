"use client";

import { useState } from "react";
import { ChallengeList } from "@/components/leaderboard/ChallengeList";
import { PointsHistory } from "@/components/leaderboard/PointsHistory";
import { Standings } from "@/components/leaderboard/Standings";
import { TrendChart } from "@/components/leaderboard/TrendChart";
import { PageTitle } from "@/components/ui/PageTitle";
import { Segmented } from "@/components/ui/Segmented";

const views = [
  { value: "standings", label: "Standings" },
  { value: "trends", label: "Trends" },
  { value: "challenges", label: "Challenges" },
  { value: "history", label: "Ledger" },
] as const;

type View = (typeof views)[number]["value"];

export default function LeaderboardPage() {
  const [view, setView] = useState<View>("standings");

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="The Crider Cup" title="Leaderboard" />
      <Segmented options={views} value={view} onChange={setView} label="Leaderboard view" size="sm" />
      {view === "standings" && <Standings />}
      {view === "trends" && <TrendChart />}
      {view === "challenges" && <ChallengeList />}
      {view === "history" && <PointsHistory />}
    </div>
  );
}
