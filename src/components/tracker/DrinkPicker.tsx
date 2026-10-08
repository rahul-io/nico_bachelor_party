"use client";

import { Beer, GlassWater, Martini, Search, Wine, X, type LucideIcon } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import {
  categories,
  categoryDefaults,
  categoryDrink,
  describeDrink,
  searchDrinks,
  standardDrink,
} from "@/lib/drinks";
import type { DrinkInput } from "@/lib/store/types";

const quickPicks: Array<{ label: string; icon: LucideIcon; drink: () => DrinkInput }> = [
  { label: "Beer", icon: Beer, drink: () => categoryDrink("beer") },
  { label: "Wine", icon: Wine, drink: () => categoryDrink("wine") },
  { label: "Cocktail", icon: Martini, drink: () => categoryDrink("cocktail") },
  { label: "Standard", icon: GlassWater, drink: () => standardDrink() },
];

const optionClass =
  "flex min-h-tap flex-col items-center justify-center rounded-control border border-line bg-raised px-2 py-2 text-center transition active:scale-[0.97]";

export function DrinkPicker({ onAdd }: { onAdd: (drink: DrinkInput) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [volume, setVolume] = useState("");
  const [abv, setAbv] = useState("");
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);

  const results = useMemo(() => searchDrinks(query), [query]);
  const typed = query.trim();
  const noMatch = typed.length > 0 && results.length === 0;

  function log(drink: DrinkInput) {
    setStatus({ text: `Added ${drink.name}` });
    setQuery("");
    setShowOther(false);
    setVolume("");
    setAbv("");
    onAdd(drink).catch(() =>
      setStatus({ text: `Couldn't log ${drink.name}. Try again.`, error: true }),
    );
  }

  function submitCustom(event: FormEvent) {
    event.preventDefault();
    const volumeOz = Number(volume);
    const abvPercent = Number(abv);
    if (!(volumeOz > 0 && volumeOz <= 128) || !(abvPercent > 0 && abvPercent <= 100)) {
      setStatus({ text: "Enter a volume in oz and an ABV between 0 and 100%.", error: true });
      return;
    }
    log({ name: typed || "Custom drink", volumeOz, abv: abvPercent / 100, alcoholG: 0 });
  }

  return (
    <Card className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {quickPicks.map(({ label, icon: Icon, drink }) => (
          <button
            key={label}
            type="button"
            onClick={() => log(drink())}
            className={cn(optionClass, "gap-1 py-3 text-sm font-medium")}
          >
            <Icon className="size-6 text-accent" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search drinks (Modelo, High Noon…)"
          aria-label="Search drinks"
          autoComplete="off"
          enterKeyHint="search"
          className={cn(inputClass, "px-10 [&::-webkit-search-cancel-button]:hidden")}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-0 top-0 flex size-tap items-center justify-center text-muted"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-control border border-line">
          {results.map((drink) => (
            <li key={drink.name}>
              <button
                type="button"
                onClick={() => log({ ...drink, alcoholG: 0 })}
                className="flex min-h-tap w-full items-center justify-between gap-3 bg-raised px-3 py-2 text-left active:bg-line"
              >
                <span className="font-medium">{drink.name}</span>
                <span className="shrink-0 text-sm text-muted">{describeDrink({ ...drink, alcoholG: 0 })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {noMatch || showOther ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {noMatch ? `No match for “${typed}”. Log it as:` : "Log it as:"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => log(categoryDrink(category, typed))}
                className={optionClass}
              >
                <span className="text-sm font-medium">{categoryDefaults[category].label}</span>
                <span className="text-xs text-muted">
                  {describeDrink({ ...categoryDefaults[category], alcoholG: 0 })}
                </span>
              </button>
            ))}
            <button type="button" onClick={() => log(standardDrink(typed))} className={optionClass}>
              <span className="text-sm font-medium">Standard</span>
              <span className="text-xs text-muted">14 g alcohol</span>
            </button>
          </div>

          <form onSubmit={submitCustom} className="flex items-end gap-2">
            <Field
              label="Volume"
              suffix="oz"
              inputMode="decimal"
              value={volume}
              onChange={(event) => setVolume(event.target.value)}
              placeholder="12"
            />
            <Field
              label="ABV"
              suffix="%"
              inputMode="decimal"
              value={abv}
              onChange={(event) => setAbv(event.target.value)}
              placeholder="5"
            />
            <Button type="submit" variant="primary" className="shrink-0">
              Add
            </Button>
          </form>
        </div>
      ) : (
        <Button variant="ghost" block onClick={() => setShowOther(true)}>
          Something else or custom
        </Button>
      )}

      <p aria-live="polite" className={cn("min-h-5 text-center text-sm", status?.error ? "text-danger" : "text-muted")}>
        {status?.text}
      </p>
    </Card>
  );
}
