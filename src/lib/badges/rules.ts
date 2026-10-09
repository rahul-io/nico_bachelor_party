import { estimateBac, formatBac, type Body } from "@/lib/bac";
import { categoryDefaults, drinkTags, type DrinkCategory } from "@/lib/drinks";
import { nextDay, partyDayBounds, partyDayOf } from "@/lib/points/awards";

/**
 * What earns a badge. Pure: everything is passed in, times are ms.
 *
 * A rule-based badge carries one of the `Rule` shapes below, built in Admin.
 * `describeRule` writes its plain-English preview from the same object the
 * evaluators run, so the two can't disagree. Coded badges are the conditions
 * a rule can't express, written out as functions here.
 */

const HOUR_MS = 3_600_000;

export type What = { kind: "drink"; category?: string; tag?: string; name?: string } | { kind: "water" };

export const MOST_METRICS = [
  "photos",
  "taggedPhotos",
  "waters",
  "drinks",
  "categoryDrinks",
  "groomTaxes",
  "cursesReceived",
  "comments",
  "distinctDrinks",
  "pointsStaked",
  "wagerWinnings",
  "slotStolen",
  "snitchReports",
] as const;
export type MostMetric = (typeof MOST_METRICS)[number];

export type Rule =
  /** Merit: N matching logs inside a rolling hour, a party day, or the whole weekend. */
  | { type: "count"; what: What; n: number; window: "hour" | "day" | "weekend" }
  /** Merit: estimated BAC reaches a level. */
  | { type: "threshold"; bac: number }
  /** Merit: a matching log before or after a time of day ("HH:MM", party time). */
  | { type: "time"; what: What; when: "before" | "after"; time: string }
  /** Achievement: the first person to reach a BAC level that day. */
  | { type: "first"; bac: number }
  /** Achievement: the most of something that day. */
  | { type: "most"; metric: MostMetric; category?: string };

export const CODED = [
  "lightweight",
  "sleepingBeauty",
  "hairOfTheDog",
  "secondWind",
  // Achievements (extra.ts)
  "earlyBird",
  "nightOwl",
  "influencer",
  "woodenSpoon",
  // Merit badges found by sweeping the whole record (extra.ts)
  "jackpot",
  "bustOut",
  "robbedBlind",
  "badBeat",
  "comebackKid",
  "varietyPack",
  "bartenderDone",
  "witch",
  "identityCrisis",
  "corporateDrone",
  "groomShadow",
  "nice",
  "blazeIt",
  "jinx",
  "groundhogDay",
  "perfectlyBalanced",
  "butterfingers",
  "madScientist",
  "unoReverse",
  "selfOwn",
  "regicide",
  "lazarus",
  "midnightSnack",
  "sameTimeTomorrow",
  "sundayScaries",
  "niceTwo",
] as const;
export type CodedKey = (typeof CODED)[number];

/** Whether a rule (or coded condition) names one holder per day rather than everyone who qualifies. */
export const isAchievementRule = (rule: Rule) => rule.type === "first" || rule.type === "most";

export interface DrinkEvent {
  id: string;
  profileId: string;
  at: number;
  alcoholG: number;
  name: string;
  category: string | null;
  /** Fraction, when the drink was logged by volume and strength. */
  abv?: number | null;
  /** What the slot machine landed on, if this drink spun and it counted. */
  slot?: string | null;
}

/** A live entry in the points ledger, as much of it as badges look at. */
export interface LedgerEntry {
  profileId: string;
  delta: number;
  source: string;
  awardKey: string | null;
  drinkId: string | null;
  at: number;
}

export interface World {
  people: Array<Body & { id: string }>;
  drinks: DrinkEvent[];
  waters: Array<{ id: string; profileId: string; at: number }>;
  posts: Array<{ id: string; profileId: string; at: number; taggedIds: string[]; asleep: boolean }>;
  groomTaxes: Array<{ profileId: string; at: number }>;
  cursesReceived: Array<{ profileId: string; at: number }>;
  /** The hour a party day starts and ends (4 = 4am). */
  cutoffHour: number;

  // Everything below feeds the wider set of badges (extra.ts).
  comments: Array<{ profileId: string; at: number }>;
  /** Total reactions on each photo, by post id. */
  reactions: Record<string, number>;
  ledger: LedgerEntry[];
  /** Every curse cast, Shields and blocked ones included. */
  curses: Array<{ id: string; type: string; fromId: string; targetId: string; at: number; blocked: boolean }>;
  /** Settled wagers. */
  wagers: Array<{ id: string; stake: number; winnerId: string; loserId: string; at: number }>;
  /** Snitch Line reports that were upheld. */
  snitches: Array<{ id: string; reporterId: string; accusedId: string; at: number }>;
  /** Bartender's Choice orders that were logged in time. */
  ordersDone: Array<{ id: string; profileId: string; at: number }>;
  /** When each person deleted a drink. */
  deletions: Array<{ profileId: string; at: number }>;
  /** Confirmed Sleeping Beauty photos: who was asleep, and when the photo was posted. */
  sleepers: Array<{ profileId: string; postId: string; at: number }>;
  groomId: string | null;
}

/** The log that might have just earned something. */
export interface Trigger {
  kind: "drink" | "water";
  id: string;
  at: number;
}

/** A live award this person already holds for the badge being checked. */
export interface PriorAward {
  period: string;
  sourceIds: string[];
}

export interface Earned {
  /** The party day it was earned in. */
  period: string;
  /** The logs it rests on; deleting any of them takes the badge back. */
  sourceIds: string[];
}

export interface Holder {
  profileId: string;
  /** The winning figure: a count, a BAC, or a number of drinks. */
  value: number;
  /** When they got there; earliest wins a tie. */
  at: number;
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const categoryLabel = (category: string) =>
  categoryDefaults[category as DrinkCategory]?.label.toLowerCase() ?? category;

function whatNoun(what: What, plural: boolean): string {
  if (what.kind === "water") return plural ? "waters" : "water";
  if (what.name) return plural ? `${what.name}s` : what.name;
  const kind = what.tag ? `${what.tag} ` : "";
  const noun = what.category ? categoryLabel(what.category) : "drink";
  // "Wine" and "seltzer" read badly as plurals of a category, so say what is meant.
  const many = what.category ? `${noun} drinks` : "drinks";
  return `${kind}${plural ? many : noun}`;
}

const metricNouns: Record<MostMetric, string> = {
  photos: "photos posted",
  taggedPhotos: "photos posted that tag someone else",
  waters: "waters logged",
  drinks: "drinks logged",
  categoryDrinks: "drinks logged",
  groomTaxes: "Groom Taxes",
  cursesReceived: "curses received",
  comments: "comments posted",
  distinctDrinks: "different drinks logged",
  pointsStaked: "points staked on wagers",
  wagerWinnings: "points won on wagers, net",
  slotStolen: "points stolen with the slot machine",
  snitchReports: "Snitch Line reports upheld",
};

/** "Log 3 drinks within a rolling hour." */
export function describeRule(rule: Rule): string {
  switch (rule.type) {
    case "count": {
      const noun = whatNoun(rule.what, rule.n !== 1);
      const amount = rule.n === 1 ? article(noun) : String(rule.n);
      const window = { hour: "within a rolling hour", day: "in one day", weekend: "over the weekend" }[rule.window];
      const repeat = { hour: "", day: " Once a day.", weekend: " Once." }[rule.window];
      return `Log ${amount} ${noun} ${window}.${repeat}`;
    }
    case "threshold":
      return `Reach an estimated BAC of ${formatBac(rule.bac)}. Once a day.`;
    case "time": {
      const noun = whatNoun(rule.what, false);
      return `Log ${article(noun)} ${noun} ${rule.when} ${rule.time}. Once a day.`;
    }
    case "first":
      return `Be the first to reach an estimated BAC of ${formatBac(rule.bac)} that day.`;
    case "most": {
      const noun =
        rule.metric === "categoryDrinks" && rule.category
          ? `${categoryLabel(rule.category)} drinks logged`
          : metricNouns[rule.metric];
      return `Have the most ${noun} that day. A tie goes to whoever got there first.`;
    }
  }
}

export const codedDescriptions: Record<CodedKey, string> = {
  lightweight: "Reach 0.100% that day on the fewest drinks. A tie goes to whoever got there first.",
  sleepingBeauty: "Be the first caught asleep that day: a photo marked asleep with you tagged, confirmed by an admin.",
  hairOfTheDog: "Log your first drink of the day before noon, after going over 0.080% the day before.",
  secondWind: "Drop back to 0.000%, then climb back over 0.050%, in the same day.",
  earlyBird: "Log the first drink of the day.",
  nightOwl: "Log the last drink before the day ends.",
  influencer: "Post the photo with the most reactions that day. A tie goes to the earlier photo.",
  woodenSpoon: "Be in last place on points when the day ends, having logged at least one drink that day.",
  jackpot: "Hit a Jackpot on the slot machine.",
  bustOut: "Bust on three spins in a row.",
  robbedBlind: "Be robbed by someone's Rob the Leader spin.",
  badBeat: "Lose a wager with a stake of 20 points or more.",
  comebackKid: "Go from last place to the top three within one day (with at least five people playing).",
  varietyPack: "Log a beer, a wine, a shot, a cocktail and a seltzer in one day.",
  bartenderDone: "Log your Bartender's Choice order in time.",
  witch: "Cast all four kinds of curse.",
  identityCrisis: "Have your name hijacked.",
  corporateDrone: "Have a Snitch Line report against you upheld.",
  groomShadow: "Be tagged in 10 photos that also tag the groom.",
  nice: "Log a drink that takes your estimated BAC to exactly 0.069%. Once a day.",
  blazeIt: "Have an estimated BAC of exactly 0.042% at 4:20, morning or afternoon, party time.",
  jinx: "Log the same drink as someone else in the same minute. Both earn it.",
  groundhogDay: "Log the same drink five times in a row.",
  perfectlyBalanced: "Finish a day with the same number of drinks and waters, at least five of each.",
  butterfingers: "Delete three drinks in one day.",
  madScientist: "Log a drink of your own making that is over 50% alcohol.",
  unoReverse: "Curse the person who cursed you within five minutes.",
  selfOwn: "Hit Pay It Forward and have the points go to whoever last cursed you.",
  regicide: "Land a curse on the groom.",
  lazarus: "Log a drink within an hour of your confirmed Sleeping Beauty photo.",
  midnightSnack: "Log a drink at exactly 12:00am.",
  sameTimeTomorrow: "Log drinks at the same minute of the clock on two days running.",
  sundayScaries: "Log your first Sunday drink before 9am.",
  niceTwo: "Have exactly 69 points at any moment.",
};

function matches(what: What, world: World, trigger: { kind: "drink" | "water"; id: string }): boolean {
  if (what.kind !== trigger.kind) return false;
  if (what.kind === "water") return true;
  const drink = world.drinks.find((item) => item.id === trigger.id);
  if (!drink) return false;
  if (what.category && drink.category !== what.category) return false;
  if (what.name && drink.name.trim().toLowerCase() !== what.name.trim().toLowerCase()) return false;
  if (what.tag && !drinkTags(drink.name).includes(what.tag)) return false;
  return true;
}

/** The person's logs of the kind a rule counts, oldest first. */
function matching(what: What, world: World, profileId: string): Array<{ id: string; at: number }> {
  const logs: Array<{ id: string; at: number; profileId: string }> = what.kind === "water" ? world.waters : world.drinks;
  return logs
    .filter((log) => log.profileId === profileId && matches(what, world, { kind: what.kind, id: log.id }))
    .sort((a, b) => a.at - b.at);
}

const drinksOf = (world: World, profileId: string) =>
  world.drinks
    .filter((drink) => drink.profileId === profileId)
    .map((drink) => ({ ...drink, consumedAt: drink.at }))
    .sort((a, b) => a.at - b.at);

const bacAt = (world: World, person: Body & { id: string }, at: number) => estimateBac(person, drinksOf(world, person.id), at);

/** Minutes since the party day began, for an instant and for a "HH:MM" wall time. */
function dayMinutes(world: World, at: number): number {
  const { start } = partyDayBounds(partyDayOf(at, world.cutoffHour), world.cutoffHour);
  return (at - start) / 60_000;
}

function clockMinutes(world: World, time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return ((hours * 60 + minutes - world.cutoffHour * 60) % 1440 + 1440) % 1440;
}

/** Whether the log that just happened earns this person a merit badge under a rule. */
export function meritEarned(rule: Rule, world: World, profileId: string, trigger: Trigger, prior: PriorAward[]): Earned | null {
  const person = world.people.find((item) => item.id === profileId);
  if (!person) return null;
  const period = partyDayOf(trigger.at, world.cutoffHour);
  const today = partyDayBounds(period, world.cutoffHour);
  const heldToday = prior.some((award) => award.period === period);

  switch (rule.type) {
    case "count": {
      if (!matches(rule.what, world, trigger)) return null;
      const logs = matching(rule.what, world, profileId).filter((log) => log.at <= trigger.at);
      if (rule.window === "hour") {
        // Repeatable, but only with a fresh set: no log counts twice towards the same badge.
        const used = new Set(prior.flatMap((award) => award.sourceIds));
        const fresh = logs.filter((log) => log.at > trigger.at - HOUR_MS && !used.has(log.id));
        return fresh.length >= rule.n ? { period, sourceIds: fresh.map((log) => log.id) } : null;
      }
      if (rule.window === "day" ? heldToday : prior.length > 0) return null;
      const counted = rule.window === "day" ? logs.filter((log) => log.at >= today.start) : logs;
      return counted.length >= rule.n ? { period, sourceIds: counted.slice(-rule.n).map((log) => log.id) } : null;
    }
    case "threshold":
      if (trigger.kind !== "drink" || heldToday) return null;
      return bacAt(world, person, trigger.at).bac >= rule.bac ? { period, sourceIds: [trigger.id] } : null;
    case "time": {
      if (heldToday || !matches(rule.what, world, trigger)) return null;
      const before = dayMinutes(world, trigger.at) < clockMinutes(world, rule.time);
      return before === (rule.when === "before") ? { period, sourceIds: [trigger.id] } : null;
    }
    default:
      return null;
  }
}

/** The coded merit badges. */
export function codedMeritEarned(key: CodedKey, world: World, profileId: string, trigger: Trigger, prior: PriorAward[]): Earned | null {
  const person = world.people.find((item) => item.id === profileId);
  if (!person || trigger.kind !== "drink") return null;
  const period = partyDayOf(trigger.at, world.cutoffHour);
  if (prior.some((award) => award.period === period)) return null;
  const today = partyDayBounds(period, world.cutoffHour);
  const drinks = drinksOf(world, profileId);
  const earned = { period, sourceIds: [trigger.id] };

  if (key === "hairOfTheDog") {
    const firstToday = drinks.find((drink) => drink.at >= today.start);
    const beforeNoon = trigger.at < today.start + (12 - world.cutoffHour) * HOUR_MS;
    if (firstToday?.id !== trigger.id || !beforeNoon) return null;
    // "The night before": anything in the previous party day.
    const yesterday = { start: today.start - 24 * HOUR_MS, end: today.start };
    const peak = Math.max(
      0,
      ...drinks
        .filter((drink) => drink.at >= yesterday.start && drink.at < yesterday.end)
        .map((drink) => estimateBac(person, drinks, drink.at).bac),
    );
    return peak > 0.08 ? earned : null;
  }

  if (key === "secondWind") {
    const now = estimateBac(person, drinks, trigger.at);
    if (now.bac <= 0.05 || now.sessionStart === null || now.sessionStart < today.start) return null;
    // This session began today after an earlier one ran down to zero.
    const sessionStart = now.sessionStart;
    const earlierToday =
      drinks.some((drink) => drink.at >= today.start && drink.at < sessionStart) ||
      estimateBac(person, drinks, today.start).bac > 0;
    return earlierToday ? earned : null;
  }
  return null;
}

/** Higher value wins unless `lowest`; equal values go to the earlier `at`. */
export function best(candidates: Holder[], lowest = false): Holder | null {
  let winner: Holder | null = null;
  for (const candidate of candidates) {
    const better =
      !winner ||
      (lowest ? candidate.value < winner.value : candidate.value > winner.value) ||
      (candidate.value === winner.value && candidate.at < winner.at);
    if (better) winner = candidate;
  }
  return winner;
}

/** The first drink in [start, end) that took each person to `bac` or beyond. */
function reached(world: World, start: number, end: number, bac: number): Array<Holder & { sessionDrinks: number }> {
  return world.people.flatMap((person) => {
    const drinks = drinksOf(world, person.id);
    for (const drink of drinks) {
      if (drink.at < start || drink.at >= end) continue;
      const estimate = estimateBac(person, drinks, drink.at);
      if (estimate.bac >= bac) {
        return [{ profileId: person.id, value: estimate.bac, at: drink.at, sessionDrinks: estimate.sessionDrinks }];
      }
    }
    return [];
  });
}

type Tally = { profileId: string; at: number; amount?: number };

function countsFor(rule: Extract<Rule, { type: "most" }>, world: World, start: number, end: number): Tally[] {
  switch (rule.metric) {
    case "comments":
      return world.comments;
    case "distinctDrinks": {
      // One per person per drink name: the first time they logged it that day.
      const seen = new Set<string>();
      return [...world.drinks]
        .sort((a, b) => a.at - b.at)
        .filter((drink) => {
          if (drink.at < start || drink.at >= end) return false;
          const key = `${drink.profileId}:${drink.name.trim().toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }
    case "pointsStaked":
      return world.ledger
        .filter((entry) => entry.source === "wager" && entry.delta < 0)
        .map((entry) => ({ profileId: entry.profileId, at: entry.at, amount: -entry.delta }));
    case "wagerWinnings":
      // Net: stakes out, winnings and refunds in.
      return world.ledger
        .filter((entry) => entry.source === "wager")
        .map((entry) => ({ profileId: entry.profileId, at: entry.at, amount: entry.delta }));
    case "slotStolen":
      return world.ledger
        .filter((entry) => /^slot:.*:rob$/.test(entry.awardKey ?? ""))
        .map((entry) => ({ profileId: entry.profileId, at: entry.at, amount: entry.delta }));
    case "snitchReports":
      return world.ledger.filter((entry) => /^snitch:.*:reporter$/.test(entry.awardKey ?? ""));
    case "photos":
      return world.posts;
    case "taggedPhotos":
      return world.posts.filter((post) => post.taggedIds.some((id) => id !== post.profileId));
    case "waters":
      return world.waters;
    case "drinks":
      return world.drinks;
    case "categoryDrinks":
      return world.drinks.filter((drink) => drink.category === rule.category);
    case "groomTaxes":
      return world.groomTaxes;
    case "cursesReceived":
      return world.cursesReceived;
  }
}

/** Who holds a rule-based achievement for the party day [start, end). */
export function achievementHolder(rule: Rule, world: World, start: number, end: number): Holder | null {
  if (rule.type === "first") {
    const first = reached(world, start, end, rule.bac).sort((a, b) => a.at - b.at)[0];
    return first ? { profileId: first.profileId, value: first.value, at: first.at } : null;
  }
  if (rule.type === "most") {
    const tally = new Map<string, Holder>();
    for (const item of countsFor(rule, world, start, end)) {
      if (item.at < start || item.at >= end) continue;
      const current = tally.get(item.profileId);
      tally.set(item.profileId, {
        profileId: item.profileId,
        value: Math.round(((current?.value ?? 0) + (item.amount ?? 1)) * 10) / 10,
        at: Math.max(current?.at ?? 0, item.at),
      });
    }
    // Nobody wins "most" with nothing, or with a net loss.
    return best([...tally.values()].filter((holder) => holder.value > 0));
  }
  return null;
}

/** Lightweight: of everyone who reached 0.10% that day, whoever had logged the fewest drinks in that session. */
export function lightweightHolder(world: World, start: number, end: number): Holder | null {
  return best(
    reached(world, start, end, 0.1).map((item) => ({ profileId: item.profileId, value: item.sessionDrinks, at: item.at })),
    true,
  );
}

/** Sleeping Beauty: the day's first photo marked asleep with someone tagged. An admin confirms it. */
export function firstAsleepPhoto(world: World, start: number, end: number): World["posts"][number] | null {
  return (
    world.posts
      .filter((post) => post.asleep && post.taggedIds.length > 0 && post.at >= start && post.at < end)
      .sort((a, b) => a.at - b.at)[0] ?? null
  );
}

export { nextDay, partyDayBounds, partyDayOf };
