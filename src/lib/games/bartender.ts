import { drinkCatalog, type CatalogDrink, type DrinkCategory } from "@/lib/drinks";
import { getSettings } from "@/lib/points/settings-store";
import type { DrinkLog, Store } from "@/lib/store/types";
import { activePlayers, feedLine, notify, num, str } from "./common";

/**
 * Bartender's Choice: an admin assigns every active player a random drink;
 * logging exactly that within the time limit is multiplied. Records are kind
 * "bartender", owned by the player: data { name, category, volumeOz, abv,
 * expiresAt }, status "open" | "done" | "replaced".
 */

// Weighted towards what a bar actually pours.
const CATEGORY_WEIGHT: Record<DrinkCategory, number> = { cocktail: 3, beer: 3, shot: 2, wine: 1, seltzer: 1 };

export function pickDrink(random: number): CatalogDrink {
  const total = drinkCatalog.reduce((sum, drink) => sum + CATEGORY_WEIGHT[drink.category], 0);
  let mark = random * total;
  for (const drink of drinkCatalog) {
    mark -= CATEGORY_WEIGHT[drink.category];
    if (mark < 0) return drink;
  }
  return drinkCatalog[drinkCatalog.length - 1];
}

export interface Assignment {
  id: string;
  name: string;
  category: string;
  volumeOz: number;
  abv: number;
  expiresAt: string;
  multiplier: number;
}

/** Gives every active player a drink. Returns how many were assigned. */
export async function assignDrinks(store: Store, now = Date.now(), random: () => number = Math.random): Promise<number> {
  const settings = await getSettings(store);
  const players = await activePlayers(store, now, settings);
  const open = await store.listRecords("bartender", "open");
  const expiresAt = new Date(now + settings.bartenderMinutes * 60_000).toISOString();

  for (const profileId of players) {
    for (const old of open.filter((record) => record.profileId === profileId)) {
      await store.updateRecord(old.id, { status: "replaced" }, "open");
    }
    const drink = pickDrink(random());
    await store.addRecord({ kind: "bartender", profileId, status: "open", data: { ...drink, expiresAt } });
    await notify(
      store,
      profileId,
      `Bartender's Choice: log a ${drink.name} within ${settings.bartenderMinutes} minutes for ${settings.bartenderMultiplier}×.`,
    );
  }
  if (players.size > 0) await feedLine(store, "🍸", "Bartender's Choice: everyone has been poured an order");
  return players.size;
}

/** The player's open, unexpired assignment. */
export async function currentAssignment(store: Store, profileId: string, now = Date.now()): Promise<Assignment | null> {
  const settings = await getSettings(store);
  const record = (await store.listRecords("bartender", "open")).find(
    (item) => item.profileId === profileId && Date.parse(str(item.data.expiresAt)) > now,
  );
  if (!record) return null;
  return {
    id: record.id,
    name: str(record.data.name),
    category: str(record.data.category),
    volumeOz: num(record.data.volumeOz),
    abv: num(record.data.abv),
    expiresAt: str(record.data.expiresAt),
    multiplier: settings.bartenderMultiplier,
  };
}

/** If this drink is the player's assignment, marks it done and reports true. */
export async function claimAssignment(store: Store, drink: DrinkLog): Promise<boolean> {
  const at = Date.parse(drink.consumedAt);
  const assignment = await currentAssignment(store, drink.profileId, at);
  if (!assignment || assignment.name.toLowerCase() !== drink.name.trim().toLowerCase()) return false;
  return (await store.updateRecord(assignment.id, { status: "done" }, "open")) !== null;
}
