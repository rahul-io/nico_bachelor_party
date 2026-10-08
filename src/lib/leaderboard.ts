import { estimateBac } from "./bac";
import type { DrinkLog, LeaderboardEntry, PointHistoryEntry, Store } from "./store/types";

/** Everyone's totals. BAC is computed here so body metrics never leave the server. */
export async function buildLeaderboard(store: Store, now = Date.now()): Promise<LeaderboardEntry[]> {
  const [profiles, drinks, pointEvents] = await Promise.all([
    store.listProfiles(),
    store.listAllDrinks(),
    store.listPointEvents(),
  ]);

  const drinksByProfile = new Map<string, DrinkLog[]>();
  for (const drink of drinks) {
    const list = drinksByProfile.get(drink.profileId) ?? [];
    list.push(drink);
    drinksByProfile.set(drink.profileId, list);
  }

  const pointsByProfile = new Map<string, number>();
  for (const event of pointEvents) {
    pointsByProfile.set(event.profileId, (pointsByProfile.get(event.profileId) ?? 0) + event.delta);
  }

  return profiles.map((profile) => {
    const own = drinksByProfile.get(profile.id) ?? [];
    return {
      id: profile.id,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      points: pointsByProfile.get(profile.id) ?? 0,
      drinks: own.length,
      bac: estimateBac(profile, own, now).bac,
    };
  });
}

export async function buildPointsHistory(store: Store): Promise<PointHistoryEntry[]> {
  const [profiles, pointEvents] = await Promise.all([store.listProfiles(), store.listPointEvents()]);
  const names = new Map(profiles.map((profile) => [profile.id, profile.name]));
  return pointEvents.map((event) => ({
    ...event,
    profileName: names.get(event.profileId) ?? "Someone",
  }));
}
