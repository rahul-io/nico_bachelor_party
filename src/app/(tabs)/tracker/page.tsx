"use client";

import { BacCard } from "@/components/tracker/BacCard";
import { DrinkLogList } from "@/components/tracker/DrinkLogList";
import { DrinkPicker } from "@/components/tracker/DrinkPicker";
import { Card } from "@/components/ui/Card";
import { PageTitle } from "@/components/ui/PageTitle";
import { useDrinks } from "@/hooks/useDrinks";
import { useNow } from "@/hooks/useNow";
import { useProfile } from "@/hooks/useProfile";
import { estimateBac } from "@/lib/bac";

export default function TrackerPage() {
  const { profile } = useProfile();
  const { drinks, error, addDrink, removeDrink } = useDrinks();
  const now = useNow(60_000);

  // A just-logged drink can be stamped slightly after the last tick; include it right away.
  const at = Math.max(now ?? 0, ...(drinks ?? []).map((drink) => Date.parse(drink.consumedAt)));
  const estimate = profile && drinks && now !== null ? estimateBac(profile, drinks, at) : null;

  return (
    <div className="space-y-4">
      <PageTitle eyebrow="Ship's stores" title="Rum Log" />
      <BacCard estimate={estimate} />
      <DrinkPicker onAdd={addDrink} />

      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold">
          Entries{drinks && drinks.length > 0 && ` (${drinks.length})`}
        </h2>
        {drinks ? (
          <DrinkLogList drinks={drinks} onDelete={(id) => void removeDrink(id).catch(() => {})} />
        ) : (
          <Card className="text-muted">{error ? "Couldn't load your drinks. Retrying…" : "Loading…"}</Card>
        )}
      </section>
    </div>
  );
}
