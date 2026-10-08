import Fuse from "fuse.js";
import catalog from "@/data/drinks.json";
import { STANDARD_DRINK_G } from "./bac";
import type { DrinkInput } from "./store/types";

export type DrinkCategory = "beer" | "wine" | "seltzer" | "cocktail" | "shot";

export interface CatalogDrink {
  name: string;
  category: DrinkCategory;
  volumeOz: number;
  /** Fraction, e.g. 0.05 for 5%. */
  abv: number;
}

export const drinkCatalog = catalog as CatalogDrink[];

/** Defaults used when a drink isn't in the catalogue. */
export const categoryDefaults: Record<DrinkCategory, { label: string; volumeOz: number; abv: number }> = {
  beer: { label: "Beer", volumeOz: 12, abv: 0.05 },
  wine: { label: "Wine", volumeOz: 5, abv: 0.12 },
  seltzer: { label: "Seltzer", volumeOz: 12, abv: 0.05 },
  cocktail: { label: "Cocktail", volumeOz: 5, abv: 0.15 },
  shot: { label: "Shot", volumeOz: 1.5, abv: 0.4 },
};

export const categories = Object.keys(categoryDefaults) as DrinkCategory[];

const fuse = new Fuse(drinkCatalog, {
  keys: ["name"],
  threshold: 0.35,
  ignoreLocation: true,
});

export function searchDrinks(query: string, limit = 6): CatalogDrink[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return fuse.search(trimmed, { limit }).map((result) => result.item);
}

export function categoryDrink(category: DrinkCategory, name?: string): DrinkInput {
  const { label, volumeOz, abv } = categoryDefaults[category];
  return { name: name?.trim() || label, volumeOz, abv, alcoholG: 0 };
}

export function standardDrink(name?: string): DrinkInput {
  return {
    name: name?.trim() || "Standard drink",
    volumeOz: null,
    abv: null,
    alcoholG: STANDARD_DRINK_G,
  };
}

/** "12 oz · 4.2%" or "14 g alcohol". */
export function describeDrink(drink: Pick<DrinkInput, "volumeOz" | "abv" | "alcoholG">): string {
  if (drink.volumeOz == null || drink.abv == null) {
    return `${Math.round(drink.alcoholG)} g alcohol`;
  }
  return `${drink.volumeOz} oz · ${+(drink.abv * 100).toFixed(1)}%`;
}
