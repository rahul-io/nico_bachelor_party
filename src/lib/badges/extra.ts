import { estimateBac } from "@/lib/bac";
import { drinkCatalog } from "@/lib/drinks";
import { dayKey, partyTimeToIso, timeInputValue } from "@/lib/time";
import { best, nextDay, partyDayBounds, partyDayOf, type CodedKey, type Holder, type World } from "./rules";

/**
 * The wider set of coded badges. Pure, like rules.ts.
 *
 * Achievements here name one holder for a party day. The merit badges are
 * written as detectors: each looks over the whole record and lists every
 * time its condition was met. The service awards each occurrence under its
 * own key, so running a detector again never awards twice, and a badge only
 * counts occurrences from after it was created.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export interface Occurrence {
  profileId: string;
  /** Distinguishes this time from any other time the same person met the condition. */
  key: string;
  at: number;
  /** The drinks it rests on; deleting one takes the badge back. */
  sourceIds: string[];
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const byTime = <T extends { at: number }>(items: T[]) => [...items].sort((a, b) => a.at - b.at);
const drinksOf = (world: World, profileId: string) =>
  byTime(world.drinks.filter((drink) => drink.profileId === profileId)).map((drink) => ({ ...drink, consumedAt: drink.at }));
const bodyOf = (world: World, profileId: string) => world.people.find((person) => person.id === profileId);
const day = (world: World, at: number) => partyDayOf(at, world.cutoffHour);
/** BAC to three decimals, as an integer of thousandths: 0.069% is 69. */
const thousandths = (bac: number) => Math.round(bac * 1000);
/** Points to one decimal, as an integer of tenths. */
const tenths = (points: number) => Math.round(points * 10);

function bacAt(world: World, profileId: string, at: number): number {
  const body = bodyOf(world, profileId);
  return body ? estimateBac(body, drinksOf(world, profileId), at).bac : 0;
}

/** Everyone's points just before `at`, from the live ledger. */
function totalsBefore(world: World, at: number): Map<string, number> {
  const totals = new Map(world.people.map((person) => [person.id, 0]));
  for (const entry of world.ledger) {
    if (entry.at < at && totals.has(entry.profileId)) totals.set(entry.profileId, totals.get(entry.profileId)! + entry.delta);
  }
  return totals;
}

// ---------------------------------------------------------------- achievements

/** Who holds a coded achievement for the party day [start, end), or null if this isn't one. */
export function codedHolder(key: CodedKey, world: World, start: number, end: number): Holder | null {
  const today = world.drinks.filter((drink) => drink.at >= start && drink.at < end);
  switch (key) {
    case "earlyBird": {
      const first = byTime(today)[0];
      return first ? { profileId: first.profileId, value: 1, at: first.at } : null;
    }
    case "nightOwl": {
      const last = byTime(today).pop();
      return last ? { profileId: last.profileId, value: 1, at: last.at } : null;
    }
    case "influencer":
      // The single photo with the most reactions; its poster holds the badge.
      return best(
        world.posts
          .filter((post) => post.at >= start && post.at < end && (world.reactions[post.id] ?? 0) > 0)
          .map((post) => ({ profileId: post.profileId, value: world.reactions[post.id], at: post.at })),
      );
    case "woodenSpoon": {
      // Last place among those who logged a drink that day; a tie goes to whoever logged first.
      const totals = totalsBefore(world, end);
      const firstDrink = new Map<string, number>();
      for (const drink of byTime(today)) if (!firstDrink.has(drink.profileId)) firstDrink.set(drink.profileId, drink.at);
      return best(
        [...firstDrink].map(([profileId, at]) => ({ profileId, value: tenths(totals.get(profileId) ?? 0) / 10, at })),
        true,
      );
    }
    default:
      return null;
  }
}

export const CODED_ACHIEVEMENTS: CodedKey[] = ["lightweight", "earlyBird", "nightOwl", "influencer", "woodenSpoon"];

// ------------------------------------------------------------------ detectors

type Detector = (world: World, now: number) => Occurrence[];

/** Runs of consecutive drinks that satisfy `same`, yielding an occurrence at every `length`-th one. */
function runs(world: World, length: number, same: (a: World["drinks"][number], b: World["drinks"][number]) => boolean, only?: (drink: World["drinks"][number]) => boolean): Occurrence[] {
  const found: Occurrence[] = [];
  for (const person of world.people) {
    const drinks = drinksOf(world, person.id).filter((drink) => !only || only(drink));
    let run: typeof drinks = [];
    for (const drink of drinks) {
      run = run.length > 0 && same(run[run.length - 1], drink) ? [...run, drink] : [drink];
      if (run.length === length) {
        found.push({ profileId: person.id, key: drink.id, at: drink.at, sourceIds: run.map((item) => item.id) });
        run = [];
      }
    }
  }
  return found;
}

/** The calendar days (party time) from the first drink to `now`. */
function calendarDays(world: World, now: number): string[] {
  if (world.drinks.length === 0) return [];
  const days: string[] = [];
  const last = dayKey(now);
  for (let key = dayKey(Math.min(...world.drinks.map((drink) => drink.at))); key <= last; key = nextDay(key)) days.push(key);
  return days;
}

const detectors: Partial<Record<CodedKey, Detector>> = {
  jackpot: (world) =>
    world.drinks
      .filter((drink) => drink.slot === "jackpot")
      .map((drink) => ({ profileId: drink.profileId, key: drink.id, at: drink.at, sourceIds: [drink.id] })),

  // Three spins in a row, counting only drinks that spun.
  bustOut: (world) => runs(world, 3, (a, b) => a.slot === "bust" && b.slot === "bust", (drink) => !!drink.slot).filter((found) => {
    const drinks = world.drinks.filter((drink) => found.sourceIds.includes(drink.id));
    return drinks.every((drink) => drink.slot === "bust");
  }),

  robbedBlind: (world) =>
    world.ledger
      .filter((entry) => /^slot:.*:robbed$/.test(entry.awardKey ?? "") && entry.drinkId)
      .map((entry) => ({ profileId: entry.profileId, key: entry.drinkId!, at: entry.at, sourceIds: [entry.drinkId!] })),

  badBeat: (world) =>
    world.wagers
      .filter((wager) => wager.stake >= 20)
      .map((wager) => ({ profileId: wager.loserId, key: wager.id, at: wager.at, sourceIds: [] })),

  comebackKid: (world, now) => {
    if (world.people.length < 5) return [];
    const found: Occurrence[] = [];
    const entries = byTime(world.ledger);
    for (const key of calendarDays(world, now)) {
      const { start, end } = partyDayBounds(key, world.cutoffHour);
      const totals = totalsBefore(world, start);
      const wasLast = new Set<string>();
      const done = new Set<string>();
      const look = (at: number) => {
        const values = [...totals.values()];
        const low = Math.min(...values);
        if (low === Math.max(...values)) return; // everyone level: nobody is last
        for (const [profileId, total] of totals) {
          if (tenths(total) === tenths(low)) wasLast.add(profileId);
          else if (wasLast.has(profileId) && !done.has(profileId) && values.filter((value) => tenths(value) > tenths(total)).length < 3) {
            done.add(profileId);
            found.push({ profileId, key, at, sourceIds: [] });
          }
        }
      };
      look(start);
      for (const entry of entries) {
        if (entry.at < start || entry.at >= end || !totals.has(entry.profileId)) continue;
        totals.set(entry.profileId, totals.get(entry.profileId)! + entry.delta);
        look(entry.at);
      }
    }
    return found;
  },

  varietyPack: (world) => {
    const wanted = ["beer", "wine", "shot", "cocktail", "seltzer"];
    const found: Occurrence[] = [];
    for (const person of world.people) {
      const perDay = new Map<string, Map<string, string>>();
      for (const drink of drinksOf(world, person.id)) {
        if (!drink.category || !wanted.includes(drink.category)) continue;
        const key = day(world, drink.at);
        const seen = perDay.get(key) ?? new Map<string, string>();
        perDay.set(key, seen);
        if (seen.size === wanted.length || seen.has(drink.category)) continue;
        seen.set(drink.category, drink.id);
        if (seen.size === wanted.length) found.push({ profileId: person.id, key, at: drink.at, sourceIds: [...seen.values()] });
      }
    }
    return found;
  },

  bartenderDone: (world) =>
    world.ordersDone.map((order) => ({ profileId: order.profileId, key: order.id, at: order.at, sourceIds: [] })),

  witch: (world) => {
    const found: Occurrence[] = [];
    const cast = new Map<string, Set<string>>();
    for (const curse of byTime(world.curses)) {
      const types = cast.get(curse.fromId) ?? new Set<string>();
      cast.set(curse.fromId, types);
      if (types.size === 4) continue;
      types.add(curse.type);
      if (types.size === 4) found.push({ profileId: curse.fromId, key: "once", at: curse.at, sourceIds: [] });
    }
    return found;
  },

  identityCrisis: (world) =>
    world.curses
      .filter((curse) => curse.type === "name" && !curse.blocked)
      .map((curse) => ({ profileId: curse.targetId, key: curse.id, at: curse.at, sourceIds: [] })),

  corporateDrone: (world) =>
    world.snitches.map((snitch) => ({ profileId: snitch.accusedId, key: snitch.id, at: snitch.at, sourceIds: [] })),

  groomShadow: (world) => {
    const groomId = world.groomId;
    if (!groomId) return [];
    const count = new Map<string, number>();
    const found: Occurrence[] = [];
    for (const post of byTime(world.posts)) {
      if (!post.taggedIds.includes(groomId)) continue;
      for (const id of post.taggedIds) {
        if (id === groomId) continue;
        count.set(id, (count.get(id) ?? 0) + 1);
        if (count.get(id) === 10) found.push({ profileId: id, key: "once", at: post.at, sourceIds: [] });
      }
    }
    return found;
  },

  // BAC peaks at the moment a drink is logged, so that is when "exactly 0.069%" is checked.
  nice: (world) => {
    // Keyed by the day, so it is awarded once a day however many drinks land on it.
    return byTime(world.drinks)
      .filter((drink) => thousandths(bacAt(world, drink.profileId, drink.at)) === 69)
      .map((drink) => ({ profileId: drink.profileId, key: day(world, drink.at), at: drink.at, sourceIds: [drink.id] }));
  },

  // Checked at both ends of the 4:20 minute, since a drink can land inside it.
  blazeIt: (world, now) => {
    const found: Occurrence[] = [];
    for (const key of calendarDays(world, now)) {
      for (const time of ["04:20", "16:20"]) {
        const at = Date.parse(partyTimeToIso(key, time));
        if (at > now) continue;
        for (const person of world.people) {
          if ([at, at + MINUTE_MS - 1].some((instant) => instant <= now && thousandths(bacAt(world, person.id, instant)) === 42)) {
            found.push({ profileId: person.id, key: `${key} ${time}`, at, sourceIds: [] });
          }
        }
      }
    }
    return found;
  },

  jinx: (world) => {
    const found: Occurrence[] = [];
    for (const drink of world.drinks) {
      const twin = world.drinks.find(
        (other) =>
          other.profileId !== drink.profileId &&
          sameName(other.name, drink.name) &&
          Math.floor(other.at / MINUTE_MS) === Math.floor(drink.at / MINUTE_MS),
      );
      if (twin) found.push({ profileId: drink.profileId, key: drink.id, at: Math.max(drink.at, twin.at), sourceIds: [drink.id, twin.id] });
    }
    return found;
  },

  groundhogDay: (world) => runs(world, 5, (a, b) => sameName(a.name, b.name)),

  // Judged on the day's final count, so only once the day has ended.
  perfectlyBalanced: (world, now) => {
    const found: Occurrence[] = [];
    for (const key of calendarDays(world, now)) {
      const { start, end } = partyDayBounds(key, world.cutoffHour);
      if (end > now) continue;
      for (const person of world.people) {
        const inDay = (item: { profileId: string; at: number }) => item.profileId === person.id && item.at >= start && item.at < end;
        const drinks = world.drinks.filter(inDay).length;
        if (drinks >= 5 && drinks === world.waters.filter(inDay).length) found.push({ profileId: person.id, key, at: end, sourceIds: [] });
      }
    }
    return found;
  },

  butterfingers: (world) => {
    const found: Occurrence[] = [];
    const count = new Map<string, number>();
    for (const deletion of byTime(world.deletions)) {
      const key = `${deletion.profileId}:${day(world, deletion.at)}`;
      count.set(key, (count.get(key) ?? 0) + 1);
      if (count.get(key) === 3) found.push({ profileId: deletion.profileId, key: day(world, deletion.at), at: deletion.at, sourceIds: [] });
    }
    return found;
  },

  madScientist: (world) =>
    world.drinks
      .filter((drink) => (drink.abv ?? 0) > 0.5 && !drinkCatalog.some((item) => sameName(item.name, drink.name)))
      .map((drink) => ({ profileId: drink.profileId, key: drink.id, at: drink.at, sourceIds: [drink.id] })),

  unoReverse: (world) =>
    world.curses
      .filter((back) => back.type !== "shield" && back.fromId !== back.targetId)
      .filter((back) =>
        world.curses.some(
          (first) =>
            first.type !== "shield" &&
            first.fromId === back.targetId &&
            first.targetId === back.fromId &&
            first.at < back.at &&
            back.at - first.at <= 5 * MINUTE_MS,
        ),
      )
      .map((back) => ({ profileId: back.fromId, key: back.id, at: back.at, sourceIds: [] })),

  selfOwn: (world) =>
    world.ledger
      .filter((entry) => /^slot:.*:forward$/.test(entry.awardKey ?? "") && entry.drinkId)
      .flatMap((entry) => {
        const giver = world.drinks.find((drink) => drink.id === entry.drinkId)?.profileId;
        const lastCurse = byTime(world.curses)
          .filter((curse) => curse.type !== "shield" && curse.targetId === giver && curse.at < entry.at)
          .pop();
        return giver && lastCurse?.fromId === entry.profileId
          ? [{ profileId: giver, key: entry.drinkId!, at: entry.at, sourceIds: [entry.drinkId!] }]
          : [];
      }),

  regicide: (world) =>
    world.curses
      .filter((curse) => curse.type !== "shield" && !curse.blocked && curse.targetId === world.groomId)
      .map((curse) => ({ profileId: curse.fromId, key: curse.id, at: curse.at, sourceIds: [] })),

  lazarus: (world) =>
    world.sleepers.flatMap((sleeper) => {
      const drink = drinksOf(world, sleeper.profileId).find((item) => item.at > sleeper.at && item.at <= sleeper.at + HOUR_MS);
      return drink ? [{ profileId: sleeper.profileId, key: sleeper.postId, at: drink.at, sourceIds: [drink.id] }] : [];
    }),

  midnightSnack: (world) =>
    world.drinks
      .filter((drink) => timeInputValue(drink.at) === "00:00")
      .map((drink) => ({ profileId: drink.profileId, key: drink.id, at: drink.at, sourceIds: [drink.id] })),

  sameTimeTomorrow: (world) => {
    const found: Occurrence[] = [];
    for (const person of world.people) {
      const drinks = drinksOf(world, person.id);
      for (const drink of drinks) {
        const yesterday = drinks.find(
          (earlier) => nextDay(dayKey(earlier.at)) === dayKey(drink.at) && timeInputValue(earlier.at) === timeInputValue(drink.at),
        );
        if (yesterday) found.push({ profileId: person.id, key: drink.id, at: drink.at, sourceIds: [yesterday.id, drink.id] });
      }
    }
    return found;
  },

  // "Sunday" is the party day: it starts at the cutoff, so a 2am drink is still Saturday night.
  sundayScaries: (world) => {
    const found: Occurrence[] = [];
    for (const person of world.people) {
      const seen = new Set<string>();
      for (const drink of drinksOf(world, person.id)) {
        const key = day(world, drink.at);
        if (seen.has(key)) continue;
        seen.add(key);
        const sunday = new Date(`${key}T12:00:00Z`).getUTCDay() === 0;
        if (sunday && timeInputValue(drink.at) < "09:00") found.push({ profileId: person.id, key, at: drink.at, sourceIds: [drink.id] });
      }
    }
    return found;
  },

  niceTwo: (world) => {
    const found: Occurrence[] = [];
    const totals = new Map<string, number>();
    for (const entry of byTime(world.ledger)) {
      const total = (totals.get(entry.profileId) ?? 0) + entry.delta;
      totals.set(entry.profileId, total);
      // Every time it lands on 69; the shared key means it is only awarded once.
      if (tenths(total) === 690) found.push({ profileId: entry.profileId, key: "once", at: entry.at, sourceIds: [] });
    }
    return found;
  },
};

/** Badges about a running total (all four curses, ten photos): they count what happened before the badge existed too. */
export const CUMULATIVE: CodedKey[] = ["witch", "groomShadow"];

/** Every time a detector badge's condition has been met, or null if `key` isn't a detector badge. */
export function detect(key: CodedKey, world: World, now: number): Occurrence[] | null {
  return detectors[key]?.(world, now) ?? null;
}
