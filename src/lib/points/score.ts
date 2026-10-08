import { STANDARD_DRINK_G } from "@/lib/bac";
import type { DrinkBreakdown } from "@/lib/store/types";
import { roundPoints } from "./format";
import type { PointsSettings } from "./settings";

/**
 * The scoring rules. Pure: no database and no clock, so every cap and
 * multiplier can be tested with plain inputs. Times are in ms.
 */

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export interface ScoreDrinkInput {
  alcoholG: number;
  at: number;
  /** The person's earlier drinks. Only those in the hour before `at` matter. */
  priorDrinks: Array<{ alcoholG: number; at: number }>;
  /** Estimated BAC just before this drink. */
  bacBefore: number;
  /** A water has been logged since their last drink. */
  hydrated: boolean;
  happyHour: boolean;
  drinkOfDay: boolean;
}

/** The part of a pour (in standard drinks) that fits under the rolling-hour pace cap. */
export function paceCapped(
  alcoholG: number,
  at: number,
  priorDrinks: Array<{ alcoholG: number; at: number }>,
  paceCap: number,
): number {
  const std = alcoholG / STANDARD_DRINK_G;
  const inLastHour = priorDrinks
    .filter((drink) => drink.at > at - HOUR_MS && drink.at <= at)
    .reduce((sum, drink) => sum + drink.alcoholG / STANDARD_DRINK_G, 0);
  return Math.min(std, Math.max(0, paceCap - inLastHour));
}

/**
 * Standard drinks → pace cap → × rate → multipliers (up to the maximum) → BAC ceiling.
 * A paused drink still uses up a banked hydration boost.
 */
export function scoreDrink(input: ScoreDrinkInput, settings: PointsSettings): { points: number; breakdown: DrinkBreakdown } {
  const std = input.alcoholG / STANDARD_DRINK_G;
  const counted = paceCapped(input.alcoholG, input.at, input.priorDrinks, settings.paceCap);

  const multipliers: DrinkBreakdown["multipliers"] = [];
  if (input.hydrated && settings.hydrationMultiplier !== 1) {
    multipliers.push({ label: "hydration", factor: settings.hydrationMultiplier });
  }
  if (input.happyHour) multipliers.push({ label: "Happy Hour", factor: settings.happyHourMultiplier });
  if (input.drinkOfDay) multipliers.push({ label: "Drink of the Day", factor: settings.drinkOfDayMultiplier });

  const stacked = multipliers.reduce((product, item) => product * item.factor, 1);
  const multiplier = Math.min(stacked, settings.maxMultiplier);
  const paused = input.bacBefore >= settings.bacCeiling;
  const points = paused ? 0 : roundPoints(counted * settings.pointsPerDrink * multiplier);

  return {
    points,
    breakdown: { std, counted, rate: settings.pointsPerDrink, multipliers, multiplier, paused },
  };
}

/** A water scores unless the person already has the hourly maximum of scoring waters. */
export function scoreWater(at: number, scoringWaterTimes: number[], settings: PointsSettings): number {
  const recent = scoringWaterTimes.filter((time) => time > at - HOUR_MS && time <= at).length;
  return recent < settings.waterMaxPerHour ? settings.waterPoints : 0;
}

/** The boost is banked by any water logged after the person's latest drink. It does not stack. */
export function isHydrated(lastDrinkAt: number | null, waterTimes: number[], at: number): boolean {
  return waterTimes.some((time) => time <= at && (lastDrinkAt === null || time > lastDrinkAt));
}

export interface CheersDrink {
  id: string;
  profileId: string;
  at: number;
  /** The Cheers this drink was already paid for, if any. */
  groupId: string | null;
}

export type CheersResult =
  | { kind: "none" }
  /** The new drink joins a Cheers that is still open. */
  | { kind: "join"; groupId: string }
  /** Enough people have now logged: these drinks form a new Cheers. */
  | { kind: "new"; drinkIds: string[] };

/**
 * Decides what a just-logged drink does for Cheers. `drinks` is everyone's
 * recent drinks, including the new one. One Cheers per person per window: a
 * person already in a Cheers that started inside the window can't start or
 * join another.
 */
export function resolveCheers(newDrink: CheersDrink, drinks: CheersDrink[], settings: PointsSettings): CheersResult {
  const windowMs = settings.cheersWindowMinutes * MINUTE_MS;
  const inWindow = drinks.filter((drink) => drink.at >= newDrink.at - windowMs && drink.at <= newDrink.at);

  // Open groups: their first drink is still inside the window.
  const groupStart = new Map<string, number>();
  for (const drink of drinks) {
    if (!drink.groupId) continue;
    groupStart.set(drink.groupId, Math.min(groupStart.get(drink.groupId) ?? Infinity, drink.at));
  }
  const openGroups = [...groupStart].filter(([, start]) => start >= newDrink.at - windowMs).map(([id]) => id);
  const paidPeople = new Set(
    drinks.filter((drink) => drink.groupId && openGroups.includes(drink.groupId)).map((drink) => drink.profileId),
  );

  if (paidPeople.has(newDrink.profileId)) return { kind: "none" };
  if (openGroups.length > 0) {
    // Earliest open group, so the answer doesn't depend on the order of the list.
    const groupId = openGroups.sort((a, b) => groupStart.get(a)! - groupStart.get(b)!)[0];
    return { kind: "join", groupId };
  }

  // One drink per person: their latest in the window.
  const latest = new Map<string, CheersDrink>();
  for (const drink of inWindow) {
    if (drink.groupId) continue;
    const current = latest.get(drink.profileId);
    if (!current || drink.at >= current.at) latest.set(drink.profileId, drink);
  }
  if (latest.size < settings.cheersMinPeople) return { kind: "none" };
  return { kind: "new", drinkIds: [...latest.values()].map((drink) => drink.id) };
}
