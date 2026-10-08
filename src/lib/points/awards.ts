import { ELIMINATION_PER_HOUR, STANDARD_DRINK_G, estimateBac, widmarkR, type Body } from "@/lib/bac";
import { dayKey, partyTimeToIso } from "@/lib/time";
import { paceCapped } from "./score";
import type { PointsSettings } from "./settings";

/**
 * Who wins each hourly and daily award. Pure: everything is passed in, times
 * are ms. Ties always go to whoever got there first.
 */

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export interface AwardData {
  people: Array<Body & { id: string }>;
  drinks: Array<{ profileId: string; alcoholG: number; at: number }>;
  waters: Array<{ profileId: string; at: number }>;
  posts: Array<{ profileId: string; at: number }>;
  /** Live ledger entries from drinks. */
  drinkPoints: Array<{ profileId: string; delta: number; at: number }>;
}

export interface Winner {
  profileId: string;
  /** The winning figure: minutes, BAC, a count or points, depending on the award. */
  value: number;
  /** When they got there; the tie-break. */
  at: number;
}

/** The "day" an instant belongs to when days run cutoff to cutoff, e.g. 2am Saturday is still Friday. */
export function partyDayOf(at: number, cutoffHour: number): string {
  return dayKey(at - cutoffHour * HOUR_MS);
}

export function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + 24 * HOUR_MS).toISOString().slice(0, 10);
}

/** Start (inclusive) and end (exclusive) of a party day, in ms. */
export function partyDayBounds(day: string, cutoffHour: number): { start: number; end: number } {
  const time = `${String(cutoffHour).padStart(2, "0")}:00`;
  return {
    start: Date.parse(partyTimeToIso(day, time)),
    end: Date.parse(partyTimeToIso(nextDay(day), time)),
  };
}

/** Higher value wins; equal values go to the earlier `at`. */
function best(candidates: Winner[], lowerWins = false): Winner | null {
  let winner: Winner | null = null;
  for (const candidate of candidates) {
    const better =
      !winner ||
      (lowerWins ? candidate.value < winner.value : candidate.value > winner.value) ||
      (candidate.value === winner.value && candidate.at < winner.at);
    if (better) winner = candidate;
  }
  return winner;
}

function drinksOf(data: AwardData, profileId: string) {
  return data.drinks
    .filter((drink) => drink.profileId === profileId)
    .map((drink) => ({ alcoholG: drink.alcoholG, consumedAt: drink.at, at: drink.at }))
    .sort((a, b) => a.at - b.at);
}

/** Highest BAC a person reached in [start, end), counted only up to the ceiling, and when they first got there. */
function peakBac(data: AwardData, person: AwardData["people"][number], start: number, end: number, ceiling: number): Winner | null {
  const drinks = drinksOf(data, person.id);
  // BAC only rises at a drink, so the peak is at the start of the period or right after a drink in it.
  const instants = [start, ...drinks.filter((drink) => drink.at >= start && drink.at < end).map((drink) => drink.at)];
  const peak = best(
    instants.map((at) => ({
      profileId: person.id,
      value: Math.min(estimateBac(person, drinks, at).bac, ceiling),
      at,
    })),
  );
  return peak && peak.value > 0 ? peak : null;
}

/** Most minutes of the day with estimated BAC inside the band. */
export function smoothSailing(data: AwardData, start: number, end: number, settings: PointsSettings): Winner | null {
  const candidates: Winner[] = [];
  for (const person of data.people) {
    const drinks = drinksOf(data, person.id);
    if (drinks.length === 0) continue;
    let minutes = 0;
    let first = 0;
    for (let at = start; at < end; at += MINUTE_MS) {
      const { bac } = estimateBac(person, drinks, at);
      if (bac >= settings.bandLow && bac <= settings.bandHigh) {
        minutes += 1;
        first ||= at;
      }
    }
    if (minutes > 0) candidates.push({ profileId: person.id, value: minutes, at: first });
  }
  return best(candidates);
}

/** Highest estimated BAC of the day, counted only up to the ceiling. */
export function drunkestSailor(data: AwardData, start: number, end: number, settings: PointsSettings): Winner | null {
  return best(
    data.people.flatMap((person) => peakBac(data, person, start, end, settings.bacCeiling) ?? []),
  );
}

/**
 * Shortest time from 0.00 to the ceiling, reaching it during the day. Only
 * the part of each drink under the pace cap counts towards the climb.
 */
export function fastestClimb(data: AwardData, start: number, end: number, settings: PointsSettings): Winner | null {
  const candidates: Winner[] = [];
  for (const person of data.people) {
    const drinks = drinksOf(data, person.id);
    const perGram = 100 / (person.weightKg * 1000 * widmarkR(person));
    let bac = 0;
    let lastAt = 0;
    let sessionStart = 0;
    let reached = false;

    drinks.forEach((drink, index) => {
      bac = Math.max(0, bac - (ELIMINATION_PER_HOUR * (drink.at - lastAt)) / HOUR_MS);
      lastAt = drink.at;
      if (bac === 0) {
        sessionStart = drink.at;
        reached = false;
      }
      const counted = paceCapped(drink.alcoholG, drink.at, drinks.slice(0, index), settings.paceCap);
      bac += counted * STANDARD_DRINK_G * perGram;
      if (!reached && bac >= settings.bacCeiling) {
        reached = true;
        if (drink.at >= start && drink.at < end) {
          candidates.push({ profileId: person.id, value: (drink.at - sessionStart) / MINUTE_MS, at: drink.at });
        }
      }
    });
  }
  return best(candidates, true);
}

/** Most waters logged in the day. */
export function hydroHomie(data: AwardData, start: number, end: number): Winner | null {
  const byPerson = new Map<string, number[]>();
  for (const water of data.waters) {
    if (water.at < start || water.at >= end) continue;
    byPerson.set(water.profileId, [...(byPerson.get(water.profileId) ?? []), water.at]);
  }
  return best(
    [...byPerson].map(([profileId, times]) => ({ profileId, value: times.length, at: Math.max(...times) })),
  );
}

/** Whoever posted the last photo between the after-hour (1am) and the cutoff that ends the day. */
export function lastManStanding(data: AwardData, end: number, settings: PointsSettings): Winner | null {
  const from = end - (settings.dayCutoffHour - settings.lastManAfterHour) * HOUR_MS;
  const posts = data.posts.filter((post) => post.at >= from && post.at < end);
  if (posts.length === 0) return null;
  const last = posts.reduce((a, b) => (b.at > a.at ? b : a));
  return { profileId: last.profileId, value: last.at, at: last.at };
}

/** Whether enough different people logged a drink or a water in the hour for its awards to count. */
export function hourIsLive(data: AwardData, hourStart: number, hourEnd: number, settings: PointsSettings): boolean {
  const active = new Set(
    [...data.drinks, ...data.waters]
      .filter((entry) => entry.at >= hourStart && entry.at < hourEnd)
      .map((entry) => entry.profileId),
  );
  return active.size >= settings.hourMinActive;
}

/** Whoever has the most drink points so far that day when the hour ends. */
export function hourWinner(data: AwardData, dayStart: number, hourEnd: number): Winner | null {
  const totals = new Map<string, Winner>();
  for (const entry of data.drinkPoints) {
    if (entry.at < dayStart || entry.at >= hourEnd || entry.delta <= 0) continue;
    const current = totals.get(entry.profileId);
    totals.set(entry.profileId, {
      profileId: entry.profileId,
      value: Math.round(((current?.value ?? 0) + entry.delta) * 10) / 10,
      at: Math.max(current?.at ?? 0, entry.at),
    });
  }
  return best([...totals.values()]);
}

/** Highest estimated BAC reached in the hour, counted only up to the ceiling. */
export function hourTopBac(data: AwardData, hourStart: number, hourEnd: number, settings: PointsSettings): Winner | null {
  return best(
    data.people.flatMap((person) => peakBac(data, person, hourStart, hourEnd, settings.bacCeiling) ?? []),
  );
}
