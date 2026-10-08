"use client";

import { useState } from "react";
import { ChallengeList } from "@/components/leaderboard/ChallengeList";
import { PointsHistory } from "@/components/leaderboard/PointsHistory";
import { Standings } from "@/components/leaderboard/Standings";
import { Segmented } from "@/components/ui/Segmented";

const views = [
  { value: "standings", label: "Standings" },
  { value: "challenges", label: "Challenges" },
  { value: "history", label: "History" },
] as const;

type View = (typeof views)[number]["value"];

export default function LeaderboardPage() {
  const [view, setView] = useState<View>("standings");

  return (
    <div className="space-y-4">
      <Segmented options={views} value={view} onChange={setView} label="Leaderboard view" />
      {view === "standings" && <Standings />}
      {view === "challenges" && <ChallengeList />}
      {view === "history" && <PointsHistory />}
    </div>
  );
}
