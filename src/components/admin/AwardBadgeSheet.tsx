"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { usePolled } from "@/hooks/usePolled";
import { apiFetch } from "@/lib/api";
import type { AdminBadges } from "@/lib/badges/service";
import { formatDelta } from "@/lib/points/format";

const PATH = "/api/admin/badges";

/** Award a badge to one person by hand, from their row in Admin > People. It can be given as often as it happens. */
export function AwardBadgeSheet({ person, onClose }: { person: { id: string; name: string }; onClose: () => void }) {
  const { mutate } = useSWRConfig();
  const { data } = usePolled<AdminBadges>(PATH);
  const { busy, status, run } = useAction();
  const [badgeId, setBadgeId] = useState("");
  const [reason, setReason] = useState("");

  // The hand-awarded badges first: they are what this is usually for.
  const badges = [...(data?.badges ?? [])].sort((a, b) => Number(b.source === "manual") - Number(a.source === "manual"));
  const badge = badges.find((item) => item.id === badgeId);
  const held = badge?.holders.filter((holder) => holder.profileId === person.id).length ?? 0;

  async function award() {
    if (!badge) return;
    const ok = await run(
      () => apiFetch(PATH, { method: "POST", body: { action: "award", badgeId, profileId: person.id, reason } }),
      `Gave ${person.name} ${badge.name} (${formatDelta(badge.points)})`,
    );
    if (ok) {
      setReason("");
      await Promise.all([PATH, "/api/leaderboard", "/api/points"].map((key) => mutate(key)));
    }
  }

  return (
    <Sheet
      title={`Badge for ${person.name}`}
      onClose={onClose}
      footer={
        <Button variant="primary" block disabled={busy || !badge} onClick={award}>
          {badge ? `Award ${badge.name} (${formatDelta(badge.points)})` : "Award"}
        </Button>
      }
    >
      <div className="space-y-3 p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">Badge</span>
          <select value={badgeId} onChange={(event) => setBadgeId(event.target.value)} className={inputClass}>
            <option value="">{data ? "Choose…" : "Loading…"}</option>
            {badges.map((item) => (
              <option key={item.id} value={item.id}>
                {item.emoji} {item.name} ({formatDelta(item.points)}){item.source === "manual" ? "" : ` · ${item.source}`}
              </option>
            ))}
          </select>
        </label>
        {badge && (
          <p className="text-sm text-muted">
            {badge.description}
            {held > 0 && ` ${person.name} has it ${held === 1 ? "once" : `${held} times`} already; this adds another.`}
          </p>
        )}
        <Field label="Reason (shown in the points history)" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={140} />
        <Status status={status} />
      </div>
    </Sheet>
  );
}
