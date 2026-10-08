import { estimateBac } from "./bac";
import { roundPoints } from "./points/format";
import type { Store, TrendPlayer, Trends } from "./store/types";

const MINUTE_MS = 60_000;
const STEPS_MIN = [5, 10, 15, 30, 60, 120, 240];
const MAX_SAMPLES = 150;

/**
 * Everyone's points, drink count and estimated BAC sampled over time, from the
 * first logged activity until `now`. Built server-side so body metrics stay private.
 */
export async function buildTrends(store: Store, now = Date.now()): Promise<Trends> {
  const [profiles, drinks, pointEvents] = await Promise.all([
    store.listProfiles(),
    store.listAllDrinks(),
    store.listPointEvents(),
  ]);

  const drinkTimes = drinks.map((drink) => ({ ...drink, t: Date.parse(drink.consumedAt) }));
  const pointTimes = pointEvents
    .filter((event) => event.voidedAt === null)
    .map((event) => ({ ...event, t: Date.parse(event.createdAt) }));
  const first = Math.min(now, ...drinkTimes.map((d) => d.t), ...pointTimes.map((p) => p.t));

  const stepMs =
    (STEPS_MIN.find((minutes) => (now - first) / (minutes * MINUTE_MS) <= MAX_SAMPLES - 2) ??
      STEPS_MIN[STEPS_MIN.length - 1]) * MINUTE_MS;
  // Start one step early so every line begins at zero, and always end exactly at `now`.
  const times: number[] = [];
  for (let t = Math.floor(first / stepMs) * stepMs - stepMs; t < now; t += stepMs) times.push(t);
  times.push(now);

  const players: TrendPlayer[] = profiles.map((profile) => {
    const ownDrinks = drinkTimes.filter((d) => d.profileId === profile.id);
    const ownPoints = pointTimes.filter((p) => p.profileId === profile.id);
    return {
      id: profile.id,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      points: times.map((t) => roundPoints(ownPoints.reduce((sum, p) => (p.t <= t ? sum + p.delta : sum), 0))),
      drinks: times.map((t) => ownDrinks.reduce((count, d) => (d.t <= t ? count + 1 : count), 0)),
      bac: times.map((t) => Math.round(estimateBac(profile, ownDrinks, t).bac * 10_000) / 10_000),
    };
  });

  return { times, players };
}
