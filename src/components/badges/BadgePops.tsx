"use client";

import { useSWRConfig } from "swr";
import { BadgeIcon } from "@/components/badges/TrophyCase";
import { GAMES_ME, useGamesMe } from "@/hooks/useGames";
import { apiFetch } from "@/lib/api";
import { formatPoints } from "@/lib/points/format";

/**
 * The full-screen card shown once when this person earns a badge. Which ones
 * have been shown is kept on the server, so it doesn't repeat on a second phone.
 */
export function BadgePops() {
  const { mutate } = useSWRConfig();
  const pop = useGamesMe()?.pops[0];
  if (!pop) return null;

  async function close() {
    if (!pop) return;
    // Take it off this screen straight away; the server catches up.
    void mutate(
      GAMES_ME,
      (current: { pops: Array<{ awardId: string }> } | undefined) =>
        current && { ...current, pops: current.pops.filter((item) => item.awardId !== pop.awardId) },
      { revalidate: false },
    );
    await apiFetch("/api/badges/seen", { method: "POST", body: { awardId: pop.awardId } }).catch(() => {});
    await mutate(GAMES_ME);
  }

  return (
    <button
      type="button"
      onClick={close}
      aria-label={`You earned ${pop.name}. Close`}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-navy/95 px-6 text-center text-sand"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-hi">
        {pop.kind === "achievement" ? "Achievement" : "Merit badge"}
      </p>
      <BadgeIcon key={pop.awardId} badge={pop} size="lg" className="animate-splash" />
      <p className="font-display text-3xl font-bold text-gold-hi">{pop.name}</p>
      <p className="max-w-xs text-sand/85">{pop.description}</p>
      {pop.points > 0 && (
        <p className="font-display text-2xl font-bold tabular-nums text-gold-hi">+{formatPoints(pop.points)}</p>
      )}
      <p className="mt-2 text-sm text-sand/60">Tap to close</p>
    </button>
  );
}
