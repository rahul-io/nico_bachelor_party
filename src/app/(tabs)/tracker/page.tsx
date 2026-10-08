"use client";

import { GlassWater } from "lucide-react";
import { useState } from "react";
import { BacCard } from "@/components/tracker/BacCard";
import { BartenderCard } from "@/components/tracker/BartenderCard";
import { DrinkLogList } from "@/components/tracker/DrinkLogList";
import { DrinkPicker } from "@/components/tracker/DrinkPicker";
import { SlotReels } from "@/components/tracker/SlotReels";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageTitle } from "@/components/ui/PageTitle";
import { useDrinks } from "@/hooks/useDrinks";
import { useGamesMe, useRefreshGames } from "@/hooks/useGames";
import { useNow } from "@/hooks/useNow";
import { usePointsStatus } from "@/hooks/usePointsStatus";
import { useProfile } from "@/hooks/useProfile";
import { useWaters } from "@/hooks/useWaters";
import { estimateBac } from "@/lib/bac";
import { categoryDefaults, type DrinkCategory } from "@/lib/drinks";

export default function TrackerPage() {
  const { profile } = useProfile();
  const { drinks, error, addDrink, removeDrink, spin, clearSpin } = useDrinks();
  const me = useGamesMe();
  const refreshGames = useRefreshGames();
  const deadWeight = me?.curses.find((curse) => curse.type === "deadweight");
  const { waters, addWater, removeWater } = useWaters();
  const status = usePointsStatus();
  const now = useNow(60_000);
  const [pouring, setPouring] = useState(false);

  // A just-logged drink can be stamped slightly after the last tick; include it right away.
  const at = Math.max(now ?? 0, ...(drinks ?? []).map((drink) => Date.parse(drink.consumedAt)));
  const estimate = profile && drinks && now !== null ? estimateBac(profile, drinks, at) : null;
  const paused = !!estimate && !!status && estimate.bac >= status.bacCeiling;

  const pick = status?.drinkOfDay;
  const pickName =
    pick?.type === "category" ? `Any ${categoryDefaults[pick.value as DrinkCategory]?.label.toLowerCase() ?? pick.value}` : pick?.value;

  async function water() {
    setPouring(true);
    await addWater().catch(() => {});
    setPouring(false);
  }

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Ship's stores" title="Grog Log" />
      <BacCard estimate={estimate} paused={paused} />
      {pick && (
        <p className="flex items-baseline justify-between gap-3 rounded-card border border-gold/50 bg-surface px-4 py-2.5 shadow-card">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Drink of the Day</span>
          <span className="min-w-0 truncate font-semibold">
            {pickName} <span className="tabular-nums text-accent">{pick.multiplier}×</span>
          </span>
        </p>
      )}
      {me?.bartender && (
        <BartenderCard order={me.bartender} onLog={(drink) => void addDrink(drink).then(refreshGames).catch(() => {})} />
      )}
      {deadWeight && (
        <p className="rounded-card border border-coral/60 bg-surface px-4 py-2.5 text-sm shadow-card">
          <span className="font-semibold">Dead Weight</span> from {deadWeight.from}: your next drink scores nothing.
        </p>
      )}
      <DrinkPicker onAdd={(drink) => addDrink(drink).then(() => void refreshGames())} />
      {spin && <SlotReels outcome={spin.outcome} forShow={spin.forShow} onDone={clearSpin} />}
      <Button block disabled={pouring} onClick={water}>
        <GlassWater className="size-5" aria-hidden />
        Log a water
      </Button>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold">
          Entries{drinks && drinks.length > 0 && ` (${drinks.length})`}
        </h2>
        {drinks ? (
          <DrinkLogList
            drinks={drinks}
            waters={waters ?? []}
            onDeleteDrink={(id) => void removeDrink(id).catch(() => {})}
            onDeleteWater={(id) => void removeWater(id).catch(() => {})}
          />
        ) : (
          <Card className="text-muted">{error ? "Couldn't load your drinks. Retrying…" : "Loading…"}</Card>
        )}
      </section>
    </div>
  );
}
