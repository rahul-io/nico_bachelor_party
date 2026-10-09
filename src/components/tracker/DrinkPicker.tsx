"use client";

import { Beer, BottleWine, GlassWater, Martini, Search, Wine, X, type LucideIcon } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
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
import type { FoodFactsDrink } from "@/lib/open-food-facts";

const quickPicks: Array<{ label: string; icon: LucideIcon; drink: () => DrinkInput; editable?: boolean }> = [
  { label: "Beer", icon: Beer, drink: () => ({ ...categoryDrink("beer"), category: "beer" }), editable: true },
  { label: "Liquor", icon: BottleWine, drink: () => ({ name: "Liquor", volumeOz: 2, abv: 0.4, alcoholG: 0, category: "shot" }), editable: true },
  { label: "Wine", icon: Wine, drink: () => categoryDrink("wine") },
  { label: "Cocktail", icon: Martini, drink: () => categoryDrink("cocktail") },
  { label: "Standard", icon: GlassWater, drink: () => standardDrink() },
];

const optionClass =
  "flex min-h-tap flex-col items-center justify-center rounded-control border border-line bg-raised px-2 py-2 text-center transition active:scale-[0.97]";

export function DrinkPicker({ onAdd }: { onAdd: (drink: DrinkInput) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [selectedQuick, setSelectedQuick] = useState<DrinkInput | null>(null);
  const [volume, setVolume] = useState("");
  const [abv, setAbv] = useState("");
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [online, setOnline] = useState<{ query: string; drinks?: FoodFactsDrink[]; error?: string } | null>(null);
  const [selected, setSelected] = useState<FoodFactsDrink | null>(null);
  const searchVersion = useRef(0);

  const results = useMemo(() => searchDrinks(query), [query]);
  const typed = query.trim();
  const noMatch = typed.length > 0 && results.length === 0;

  function changeQuery(value: string) {
    searchVersion.current += 1;
    setQuery(value);
    setOnline(null);
    setSelected(null);
    setSelectedQuick(null);
    setVolume("");
    setAbv("");
  }

  function selectQuick(drink: DrinkInput) {
    changeQuery("");
    setShowOther(false);
    setSelectedQuick(drink);
    setStatus(null);
    setAbv(String((drink.abv ?? 0) * 100));
    setVolume(String(drink.volumeOz ?? ""));
  }

  async function searchOnline() {
    const version = ++searchVersion.current;
    setOnline({ query: typed });
    setSelected(null);
    try {
      const response = await fetch(`/api/drinks/search?q=${encodeURIComponent(typed)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't search more drinks.");
      if (version === searchVersion.current) setOnline({ query: typed, drinks: data.drinks });
    } catch (error) {
      if (version === searchVersion.current) setOnline({ query: typed,
        error: error instanceof Error ? error.message : "Couldn't search more drinks." });
    }
  }

  function selectOnline(drink: FoodFactsDrink) {
    setSelected(drink);
    setShowOther(false);
    setVolume(String(categoryDefaults.beer.volumeOz));
    setAbv(drink.abvPercent === null ? "" : String(drink.abvPercent));
  }

  function log(drink: DrinkInput) {
    setStatus({ text: `Added ${drink.name}` });
    changeQuery("");
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
    if (!(volumeOz >= 0.1 && volumeOz <= 128) || !(abvPercent >= 0.1 && abvPercent <= 100)) {
      setStatus({ text: "Enter 0.1–128 oz and an ABV between 0.1 and 100%.", error: true });
      return;
    }
    log({
      name: selectedQuick?.name || selected?.name || typed || "Custom drink",
      volumeOz,
      abv: abvPercent / 100,
      alcoholG: 0,
      ...(selectedQuick ? { category: selectedQuick.category } : {}),
    });
  }

  return (
    <Card className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {quickPicks.map(({ label, icon: Icon, drink, editable }) => (
          <button
            key={label}
            type="button"
            onClick={() => editable ? selectQuick(drink()) : log(drink())}
            className={cn(optionClass, "gap-1 py-3 text-sm font-medium")}
          >
            <Icon className="size-6 text-accent" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {selectedQuick && (
        <form onSubmit={submitCustom} className="space-y-3 rounded-control border border-line p-3">
          <p className="font-medium">{selectedQuick.name}</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="ABV" suffix="%" inputMode="decimal" required value={abv}
              onChange={(event) => setAbv(event.target.value)} />
            <Field label="Volume" suffix="oz" inputMode="decimal" required value={volume}
              onChange={(event) => setVolume(event.target.value)} />
          </div>
          <Button type="submit" variant="primary" block>Add {selectedQuick.name.toLowerCase()}</Button>
          <Button type="button" variant="ghost" block onClick={() => changeQuery("")}>Cancel</Button>
        </form>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          placeholder="Search drinks (Modelo, High Noon…)"
          aria-label="Search drinks"
          autoComplete="off"
          enterKeyHint="search"
          className={cn(inputClass, "px-10 [&::-webkit-search-cancel-button]:hidden")}
        />
        {query && (
          <button
            type="button"
            onClick={() => changeQuery("")}
            aria-label="Clear search"
            className="absolute right-0 top-0 flex size-tap items-center justify-center text-muted"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      {!selected && results.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-control border border-line">
          {results.map((drink) => (
            <li key={drink.name}>
              <button
                type="button"
                onClick={() => selectQuick({ ...drink, alcoholG: 0 })}
                className="flex min-h-tap w-full items-center justify-between gap-3 bg-raised px-3 py-2 text-left active:bg-line"
              >
                <span className="font-medium">{drink.name}</span>
                <span className="shrink-0 text-sm text-muted">{describeDrink({ ...drink, alcoholG: 0 })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!selected && typed.length >= 2 && (
        <Button block disabled={typed.length > 80 || !!(online && !online.drinks && !online.error)}
          onClick={() => void searchOnline()}>
          {online && !online.drinks && !online.error ? "Searching…" : "Search more drinks"}
        </Button>
      )}

      {online && (
        <div className="space-y-2">
          <p aria-live="polite" className="text-sm text-muted">
            {online.error || (online.drinks
              ? online.drinks.length ? `More matches for “${online.query}”` : `No additional drinks found for “${online.query}”. Try a brand name or log a custom drink.`
              : "Searching Open Food Facts…")}
          </p>
          {!selected && !!online.drinks?.length && (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-control border border-line">
              {online.drinks.map((drink) => (
                <li key={drink.code}>
                  <button type="button" onClick={() => selectOnline(drink)}
                    className="flex min-h-tap w-full flex-col gap-1 bg-raised px-3 py-2 text-left active:bg-line">
                    <span className="font-medium">{drink.name}</span>
                    <span className="text-sm text-muted">
                      {drink.abvPercent === null ? "ABV needed" : `${drink.abvPercent}% ABV`}
                      {drink.packageQuantity && ` · Package: ${drink.packageQuantity}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">
            Data from <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" className="underline">Open Food Facts</a>
            {" · "}<a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer" className="underline">ODbL</a>
          </p>
        </div>
      )}

      {selected && (
        <div className="space-y-3 rounded-control border border-line p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{selected.name}</p>
            <button type="button" aria-label="Cancel drink selection" onClick={() => setSelected(null)} className="flex size-tap shrink-0 items-center justify-center text-muted">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <p className="text-sm text-muted">Enter how much you drank and check the ABV on the label.</p>
          <a href={`https://world.openfoodfacts.org/product/${selected.code}`} target="_blank" rel="noreferrer" className="text-sm text-muted underline">View product</a>
          <form onSubmit={submitCustom} className="flex items-end gap-2">
            <Field label="Volume" suffix="oz" inputMode="decimal" required value={volume}
              onChange={(event) => setVolume(event.target.value)} placeholder="12" />
            <Field label="ABV" suffix="%" inputMode="decimal" required value={abv}
              onChange={(event) => setAbv(event.target.value)} placeholder="5" />
            <Button type="submit" variant="primary" className="shrink-0">Add</Button>
          </form>
        </div>
      )}

      {!selected && !selectedQuick && (noMatch || showOther) ? (
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
      ) : !selected && !selectedQuick && (
        <Button variant="ghost" block onClick={() => { setSelected(null); setShowOther(true); }}>
          Something else or custom
        </Button>
      )}

      <p aria-live="polite" className={cn("min-h-5 text-center text-sm", status?.error ? "text-danger" : "text-muted")}>
        {status?.text}
      </p>
    </Card>
  );
}
