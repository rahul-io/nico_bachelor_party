"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { PointsHistory } from "@/components/leaderboard/PointsHistory";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { usePolled } from "@/hooks/usePolled";
import { apiFetch } from "@/lib/api";
import type { Challenge, LeaderboardEntry } from "@/lib/store/types";

export function PointsPanel() {
  const { mutate } = useSWRConfig();
  const { data: people } = usePolled<LeaderboardEntry[]>("/api/leaderboard");
  const { data: challenges } = usePolled<Challenge[]>("/api/admin/challenges");
  const { busy, status, setStatus, run } = useAction();

  const [profileId, setProfileId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const sortedPeople = [...(people ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const person = sortedPeople.find((entry) => entry.id === profileId);

  function pickChallenge(id: string) {
    setChallengeId(id);
    const challenge = challenges?.find((item) => item.id === id);
    if (challenge) {
      setAmount(String(challenge.points));
      setReason(challenge.title);
    }
  }

  async function submit(sign: 1 | -1) {
    const points = Math.abs(Number(amount));
    if (!person) return setStatus({ text: "Pick a person first.", error: true });
    if (!Number.isInteger(points) || points === 0) {
      return setStatus({ text: "Enter a whole number of points.", error: true });
    }
    const ok = await run(
      () =>
        apiFetch("/api/admin/points", {
          method: "POST",
          body: { profileId, delta: sign * points, reason, challengeId: challengeId || null },
        }),
      `${sign > 0 ? "Gave" : "Took"} ${points} ${sign > 0 ? "to" : "from"} ${person.name}`,
    );
    if (ok) {
      setChallengeId("");
      setAmount("");
      setReason("");
      await Promise.all([mutate("/api/leaderboard"), mutate("/api/points")]);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">Person</span>
          <select value={profileId} onChange={(event) => setProfileId(event.target.value)} className={inputClass}>
            <option value="">Choose…</option>
            {sortedPeople.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} ({entry.points} pts)
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">Challenge (optional)</span>
          <select value={challengeId} onChange={(event) => pickChallenge(event.target.value)} className={inputClass}>
            <option value="">None</option>
            {challenges?.map((challenge) => (
              <option key={challenge.id} value={challenge.id}>
                {challenge.title} (+{challenge.points})
              </option>
            ))}
          </select>
        </label>

        <Field
          label="Points"
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="10"
        />
        <Field
          label="Reason (optional)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={140}
          placeholder="Won beer pong"
        />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="danger" disabled={busy} onClick={() => submit(-1)}>
            Deduct
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => submit(1)}>
            Award
          </Button>
        </div>
        <Status status={status} />
      </Card>

      <h2 className="font-display text-lg font-bold">Recent</h2>
      <PointsHistory limit={15} />
    </div>
  );
}
