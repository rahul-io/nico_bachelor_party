import { estimateBac, formatBac } from "@/lib/bac";
import type {
  DrinkInput,
  DrinkLog,
  PointEvent,
  PointEventInput,
  Profile,
  Store,
  WaterLog,
} from "@/lib/store/types";
import { formatHour, formatTime } from "@/lib/time";
import {
  drunkestSailor,
  fastestClimb,
  hourIsLive,
  hourTopBac,
  hourWinner,
  hydroHomie,
  lastManStanding,
  nextDay,
  partyDayBounds,
  partyDayOf,
  smoothSailing,
  type AwardData,
  type Winner,
} from "./awards";
import { formatPoints, roundPoints } from "./format";
import { isHydrated, resolveCheers, scoreDrink, scoreWater, type CheersDrink } from "./score";
import { mergeSettings, type PointsSettings } from "./settings";

/**
 * The points economy against the store: scoring on log, voiding on delete,
 * Happy Hour and Drink of the Day, and settling awards. The rules themselves
 * live in score.ts and awards.ts.
 */

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

const SETTINGS_KEY = "points.settings";
const HAPPY_HOUR_KEY = "points.happyHour";
const DRINK_OF_DAY_KEY = "points.drinkOfDay";

export interface HappyHour {
  startsAt: string;
  endsAt: string;
}

export interface DrinkOfDay {
  type: "drink" | "category";
  value: string;
}

export async function getSettings(store: Store): Promise<PointsSettings> {
  return mergeSettings(await store.getSetting(SETTINGS_KEY));
}

export async function saveSettings(store: Store, overrides: Partial<PointsSettings>): Promise<PointsSettings> {
  await store.setSetting(SETTINGS_KEY, overrides);
  return mergeSettings(overrides);
}

function isHappyHour(value: unknown): value is HappyHour {
  const v = value as HappyHour | null;
  return !!v && typeof v.startsAt === "string" && typeof v.endsAt === "string";
}

/** The Happy Hour running at `at`, if any. */
export async function getHappyHour(store: Store, at = Date.now()): Promise<HappyHour | null> {
  const stored = await store.getSetting(HAPPY_HOUR_KEY);
  if (!isHappyHour(stored)) return null;
  return Date.parse(stored.startsAt) <= at && at < Date.parse(stored.endsAt) ? stored : null;
}

export async function startHappyHour(store: Store, minutes: number, now = Date.now()): Promise<HappyHour> {
  const happyHour = {
    startsAt: new Date(now).toISOString(),
    endsAt: new Date(now + minutes * MINUTE_MS).toISOString(),
  };
  await store.setSetting(HAPPY_HOUR_KEY, happyHour);
  return happyHour;
}

export async function stopHappyHour(store: Store, now = Date.now()): Promise<void> {
  const current = await getHappyHour(store, now);
  if (current) await store.setSetting(HAPPY_HOUR_KEY, { ...current, endsAt: new Date(now).toISOString() });
}

/** Drink of the Day for each party day that has one, keyed by day ("2026-10-08"). */
export async function getDrinksOfDay(store: Store): Promise<Record<string, DrinkOfDay>> {
  const stored = await store.getSetting(DRINK_OF_DAY_KEY);
  return typeof stored === "object" && stored !== null ? (stored as Record<string, DrinkOfDay>) : {};
}

export async function setDrinkOfDay(store: Store, day: string, pick: DrinkOfDay | null): Promise<void> {
  const all = await getDrinksOfDay(store);
  if (pick) all[day] = pick;
  else delete all[day];
  await store.setSetting(DRINK_OF_DAY_KEY, all);
}

export function matchesDrinkOfDay(drink: Pick<DrinkLog, "name" | "category">, pick: DrinkOfDay | undefined): boolean {
  if (!pick) return false;
  const value = pick.value.trim().toLowerCase();
  return pick.type === "category" ? drink.category === value : drink.name.trim().toLowerCase() === value;
}

const live = (event: PointEvent) => event.voidedAt === null;

/** Logs a drink and writes its points, plus any Cheers it completes or joins. */
export async function logDrink(
  store: Store,
  profile: Profile,
  input: DrinkInput,
): Promise<{ drink: DrinkLog; entry: PointEvent | null }> {
  const [settings, priorDrinks, waters, drinksOfDay] = await Promise.all([
    getSettings(store),
    store.listDrinks(profile.id),
    store.listWaters(profile.id),
    getDrinksOfDay(store),
  ]);
  const drink = await store.addDrink(profile.id, input);
  const at = Date.parse(drink.consumedAt);

  const prior = priorDrinks.map((item) => ({ alcoholG: item.alcoholG, at: Date.parse(item.consumedAt) }));
  const lastDrinkAt = prior.length > 0 ? Math.max(...prior.map((item) => item.at)) : null;
  const happyHour = await getHappyHour(store, at);

  const { points, breakdown } = scoreDrink(
    {
      alcoholG: drink.alcoholG,
      at,
      priorDrinks: prior,
      // Just before this drink: their earlier drinks only.
      bacBefore: estimateBac(profile, priorDrinks, at).bac,
      hydrated: isHydrated(lastDrinkAt, waters.map((water) => Date.parse(water.consumedAt)), at),
      happyHour: happyHour !== null,
      drinkOfDay: matchesDrinkOfDay(drink, drinksOfDay[partyDayOf(at, settings.dayCutoffHour)]),
    },
    settings,
  );

  const entry = await store.addPointEvent({
    profileId: profile.id,
    delta: points,
    reason: drink.name,
    challengeId: null,
    source: "drink",
    breakdown,
    drinkId: drink.id,
    awardKey: `drink:${drink.id}`,
    createdAt: drink.consumedAt,
  });

  await payCheers(store, drink, settings);
  return { drink, entry };
}

async function payCheers(store: Store, drink: DrinkLog, settings: PointsSettings): Promise<void> {
  if (settings.cheersPoints <= 0) return;
  const at = Date.parse(drink.consumedAt);
  // Twice the window, so a Cheers that started just before it is still seen as closed.
  const since = at - 2 * settings.cheersWindowMinutes * MINUTE_MS;
  const [allDrinks, events] = await Promise.all([store.listAllDrinks(), store.listPointEvents()]);

  const groupOf = new Map<string, string>();
  for (const event of events) {
    if (event.source === "cheers" && live(event) && event.drinkId && event.groupId) {
      groupOf.set(event.drinkId, event.groupId);
    }
  }
  const recent: CheersDrink[] = allDrinks
    .map((item) => ({
      id: item.id,
      profileId: item.profileId,
      at: Date.parse(item.consumedAt),
      groupId: groupOf.get(item.id) ?? null,
    }))
    .filter((item) => item.at >= since && item.at <= at);
  const mine = recent.find((item) => item.id === drink.id);
  if (!mine) return;

  const result = resolveCheers(mine, recent, settings);
  if (result.kind === "none") return;
  const groupId = result.kind === "join" ? result.groupId : crypto.randomUUID();
  const drinkIds = result.kind === "join" ? [drink.id] : result.drinkIds;

  for (const id of drinkIds) {
    const member = recent.find((item) => item.id === id);
    if (!member) continue;
    await store.addPointEvent({
      profileId: member.profileId,
      delta: settings.cheersPoints,
      reason: "Cheers",
      challengeId: null,
      source: "cheers",
      drinkId: id,
      groupId,
      // A drink is paid once per Cheers. Keyed by the group as well, so drinks whose
      // Cheers was taken back can still be part of a later one.
      awardKey: `cheers:${groupId}:${id}`,
    });
  }
}

/**
 * Deletes a drink and reverses what it earned. If it was part of a Cheers
 * that no longer has enough people, the whole Cheers is reversed.
 */
export async function removeDrink(store: Store, profileId: string, drinkId: string): Promise<boolean> {
  if (!(await store.deleteDrink(profileId, drinkId))) return false;
  const voided = await store.voidPointEvents({ drinkId });

  const groupId = voided.find((event) => event.source === "cheers")?.groupId;
  if (groupId) {
    const [settings, events] = await Promise.all([getSettings(store), store.listPointEvents()]);
    const remaining = events.filter((event) => event.groupId === groupId && live(event)).length;
    if (remaining < settings.cheersMinPeople) await store.voidPointEvents({ groupId });
  }
  return true;
}

/** Logs a water and its point, if the person is under the hourly limit. */
export async function logWater(store: Store, profile: Profile): Promise<{ water: WaterLog; entry: PointEvent | null }> {
  const [settings, events] = await Promise.all([getSettings(store), store.listPointEvents(profile.id)]);
  const water = await store.addWater(profile.id);
  const scoring = events
    .filter((event) => event.source === "water" && live(event) && event.delta > 0)
    .map((event) => Date.parse(event.createdAt));
  const points = scoreWater(Date.parse(water.consumedAt), scoring, settings);

  const entry = await store.addPointEvent({
    profileId: profile.id,
    delta: points,
    reason: points > 0 ? "Water" : "Water · hourly limit reached",
    challengeId: null,
    source: "water",
    drinkId: water.id,
    awardKey: `water:${water.id}`,
    createdAt: water.consumedAt,
  });
  return { water, entry };
}

export async function removeWater(store: Store, profileId: string, waterId: string): Promise<boolean> {
  if (!(await store.deleteWater(profileId, waterId))) return false;
  await store.voidPointEvents({ drinkId: waterId });
  return true;
}

async function loadAwardData(store: Store): Promise<AwardData> {
  const [profiles, drinks, waters, posts, events] = await Promise.all([
    store.listProfiles(),
    store.listAllDrinks(),
    store.listAllWaters(),
    store.listPosts(),
    store.listPointEvents(),
  ]);
  return {
    people: profiles,
    drinks: drinks.map((drink) => ({ profileId: drink.profileId, alcoholG: drink.alcoholG, at: Date.parse(drink.consumedAt) })),
    waters: waters.map((water) => ({ profileId: water.profileId, at: Date.parse(water.consumedAt) })),
    posts: posts.map((post) => ({ profileId: post.profileId, at: Date.parse(post.createdAt) })),
    drinkPoints: events
      .filter((event) => event.source === "drink" && live(event))
      .map((event) => ({ profileId: event.profileId, delta: event.delta, at: Date.parse(event.createdAt) })),
  };
}

const duration = (minutes: number) => {
  const whole = Math.round(minutes);
  return whole < 60 ? `${whole}m` : `${Math.floor(whole / 60)}h ${whole % 60}m`;
};

function award(
  winner: Winner | null,
  points: number,
  key: string,
  source: "hourly" | "award",
  reason: (winner: Winner) => string,
  at: number,
): PointEventInput[] {
  if (!winner || points <= 0) return [];
  return [
    {
      profileId: winner.profileId,
      delta: points,
      reason: reason(winner),
      challengeId: null,
      source,
      awardKey: key,
      createdAt: new Date(at).toISOString(),
    },
  ];
}

/** Awards for one finished clock hour. */
export function hourAwards(data: AwardData, hourStart: number, settings: PointsSettings): PointEventInput[] {
  const hourEnd = hourStart + HOUR_MS;
  if (!hourIsLive(data, hourStart, hourEnd, settings)) return [];
  const day = partyDayBounds(partyDayOf(hourStart, settings.dayCutoffHour), settings.dayCutoffHour);
  const key = new Date(hourStart).toISOString();
  const hour = formatHour(hourStart);
  return [
    ...award(hourWinner(data, day.start, hourEnd), settings.hourWinnerPoints, `hour:${key}:winner`, "hourly",
      (w) => `Hour Winner · ${hour} · ${formatPoints(w.value)} drink pts today`, hourEnd),
    ...award(hourTopBac(data, hourStart, hourEnd, settings), settings.hourTopBacPoints, `hour:${key}:bac`, "hourly",
      (w) => `Top BAC of the hour · ${hour} · ${formatBac(w.value)}`, hourEnd),
  ];
}

/** Awards for one finished party day, apart from Last Man Standing, which an admin confirms. */
export function dayAwards(data: AwardData, day: string, settings: PointsSettings): PointEventInput[] {
  const { start, end } = partyDayBounds(day, settings.dayCutoffHour);
  return [
    ...award(smoothSailing(data, start, end, settings), settings.smoothSailingPoints, `day:${day}:smooth`, "award",
      (w) => `Smooth Sailing · ${duration(w.value)} in the band`, end),
    ...award(drunkestSailor(data, start, end, settings), settings.drunkestSailorPoints, `day:${day}:peak`, "award",
      (w) => `Drunkest Sailor · ${formatBac(w.value)}`, end),
    ...award(fastestClimb(data, start, end, settings), settings.fastestClimbPoints, `day:${day}:climb`, "award",
      (w) => `Fastest Climb · ${duration(w.value)}`, end),
    ...award(hydroHomie(data, start, end), settings.hydroHomiePoints, `day:${day}:water`, "award",
      (w) => `Landlubber (Hydro Homie) · ${w.value} ${w.value === 1 ? "water" : "waters"}`, end),
  ];
}

// How far back a settle looks. Anything older has been settled by an earlier request.
const HOURS_BACK = 12;
const DAYS_BACK = 2;

const globalForSettle = globalThis as typeof globalThis & { __settledHour?: number };

/**
 * Pays any hourly and daily awards that have come due. There is no scheduler,
 * so this runs on the first request after an hour or a day ends; the unique
 * award key means two phones asking at once can't pay an award twice.
 */
export async function settleDue(store: Store, now = Date.now(), force = false): Promise<number> {
  const currentHour = Math.floor(now / HOUR_MS);
  if (!force && globalForSettle.__settledHour === currentHour) return 0;

  const [settings, data] = await Promise.all([getSettings(store), loadAwardData(store)]);
  const due: PointEventInput[] = [];
  for (let hour = currentHour - HOURS_BACK; hour < currentHour; hour++) {
    due.push(...hourAwards(data, hour * HOUR_MS, settings));
  }
  let day = partyDayOf(now - (DAYS_BACK + 1) * 24 * HOUR_MS, settings.dayCutoffHour);
  for (let i = 0; i <= DAYS_BACK; i++) {
    day = nextDay(day);
    if (partyDayBounds(day, settings.dayCutoffHour).end <= now) due.push(...dayAwards(data, day, settings));
  }

  let paid = 0;
  for (const input of due) {
    if (await store.addPointEvent(input)) paid += 1;
  }
  globalForSettle.__settledHour = currentHour;
  return paid;
}

export interface LastManCandidate {
  day: string;
  profileId: string | null;
  name: string | null;
  /** When their photo was posted, e.g. "2:41 AM". */
  time: string | null;
  confirmed: boolean;
}

const lastManKey = (day: string) => `day:${day}:lastman`;

/** Finished party days and who would get Last Man Standing for each, for Admin to confirm. */
export async function lastManCandidates(store: Store, now = Date.now()): Promise<LastManCandidate[]> {
  const [settings, data, profiles, events] = await Promise.all([
    getSettings(store),
    loadAwardData(store),
    store.listProfiles(),
    store.listPointEvents(),
  ]);
  const names = new Map(profiles.map((profile) => [profile.id, profile.name]));
  const candidates: LastManCandidate[] = [];
  let day = partyDayOf(now - 4 * 24 * HOUR_MS, settings.dayCutoffHour);
  for (let i = 0; i < 4; i++) {
    day = nextDay(day);
    const { end } = partyDayBounds(day, settings.dayCutoffHour);
    if (end > now) continue;
    const winner = lastManStanding(data, end, settings);
    const key = lastManKey(day);
    candidates.push({
      day,
      profileId: winner?.profileId ?? null,
      name: winner ? (names.get(winner.profileId) ?? null) : null,
      time: winner ? formatTime(winner.at) : null,
      confirmed: events.some((event) => event.awardKey === key),
    });
  }
  return candidates.reverse();
}

/** Pays Last Man Standing for a finished day. Null if there is nobody to pay or it was already paid. */
export async function confirmLastMan(store: Store, day: string, now = Date.now()): Promise<PointEvent | null> {
  const [settings, data] = await Promise.all([getSettings(store), loadAwardData(store)]);
  const { end } = partyDayBounds(day, settings.dayCutoffHour);
  if (end > now) return null;
  const [input] = award(lastManStanding(data, end, settings), settings.lastManStandingPoints, lastManKey(day), "award",
    (w) => `Last Man Standing · photo at ${formatTime(w.at)}`, end);
  return input ? store.addPointEvent(input) : null;
}

export interface Dispatch {
  id: string;
  profileName: string;
  text: string;
  delta: number;
  createdAt: string;
}

/** What every screen polls: running multipliers and the latest award announcements. Kept small. */
export interface PointsStatus {
  bacCeiling: number;
  happyHour: { endsAt: string; multiplier: number } | null;
  drinkOfDay: (DrinkOfDay & { multiplier: number }) | null;
  dispatches: Dispatch[];
}

const DISPATCH_SOURCES = new Set(["cheers", "hourly", "award"]);

export async function buildStatus(store: Store, now = Date.now()): Promise<PointsStatus> {
  await settleDue(store, now);
  const [settings, happyHour, drinksOfDay, profiles, events] = await Promise.all([
    getSettings(store),
    getHappyHour(store, now),
    getDrinksOfDay(store),
    store.listProfiles(),
    store.listPointEvents(),
  ]);
  const names = new Map(profiles.map((profile) => [profile.id, profile.name]));
  const pick = drinksOfDay[partyDayOf(now, settings.dayCutoffHour)];

  return {
    bacCeiling: settings.bacCeiling,
    happyHour: happyHour ? { endsAt: happyHour.endsAt, multiplier: settings.happyHourMultiplier } : null,
    drinkOfDay: pick ? { ...pick, multiplier: settings.drinkOfDayMultiplier } : null,
    dispatches: buildDispatches(events, names, now),
  };
}

function buildDispatches(events: PointEvent[], names: Map<string, string>, now: number): Dispatch[] {
  const dispatches = new Map<string, Dispatch & { people: string[] }>();
  for (const event of events) {
    if (!DISPATCH_SOURCES.has(event.source) || !live(event)) continue;
    if (Date.parse(event.createdAt) <= now - 24 * HOUR_MS) continue;
    const name = names.get(event.profileId) ?? "Someone";
    // Everyone in one Cheers shares a line.
    const id = event.source === "cheers" && event.groupId ? event.groupId : event.id;
    const existing = dispatches.get(id);
    if (existing) {
      existing.people.push(name);
      existing.profileName = existing.people.slice().reverse().join(", ");
    } else {
      dispatches.set(id, {
        id,
        profileName: name,
        people: [name],
        text: event.reason ?? "",
        delta: event.delta,
        createdAt: event.createdAt,
      });
    }
  }
  return [...dispatches.values()].slice(0, 8).map((dispatch) => ({
    id: dispatch.id,
    profileName: dispatch.profileName,
    text: dispatch.text,
    delta: dispatch.delta,
    createdAt: dispatch.createdAt,
  }));
}

/** One person's live points split by where they came from. */
export function pointsBySource(events: PointEvent[]): Array<{ source: PointEvent["source"]; points: number }> {
  const totals = new Map<PointEvent["source"], number>();
  for (const event of events) {
    if (live(event)) totals.set(event.source, (totals.get(event.source) ?? 0) + event.delta);
  }
  return [...totals]
    .map(([source, points]) => ({ source, points: roundPoints(points) }))
    .filter((item) => item.points !== 0)
    .sort((a, b) => b.points - a.points);
}
