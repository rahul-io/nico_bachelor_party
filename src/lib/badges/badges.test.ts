import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { balance } from "@/lib/games/common";
import { castCurse } from "@/lib/games/curses";
import { listFeedLines } from "@/lib/games/board";
import { logDrink, logWater, removeDrink, settleDue } from "@/lib/points/service";
import { saveSettings } from "@/lib/points/settings-store";
import { mockStore as store } from "@/lib/store/mock";
import type { Profile } from "@/lib/store/types";
import {
  achievementHolder,
  codedMeritEarned,
  describeRule,
  firstAsleepPhoto,
  lightweightHolder,
  meritEarned,
  partyDayBounds,
  type Rule,
  type World,
} from "./rules";
import {
  awardManually,
  buildAdminBadges,
  buildTrophyCase,
  confirmSleepingBeauty,
  listAwards,
  listBadges,
  markPopSeen,
  recalculateBadge,
  revokeAward,
  saveBadge,
  sleepingCandidates,
  unseenPops,
} from "./service";

const MIN = 60_000;
const HOUR = 60 * MIN;
const STD = 14;
const body = { sex: "male" as const, heightCm: 180, weightKg: 80 };
// One standard drink is about 0.023% for this body, so 4 reach 0.08 and 5 reach 0.10.

// Party days run 4am to 4am Pacific: Friday the 9th is 11:00Z on the 9th to 11:00Z on the 10th.
const { start, end } = partyDayBounds("2026-10-09", 4);
const EVENING = start + 16 * HOUR; // 8pm Friday

const world = (over: Partial<World> = {}): World => ({
  people: ["a", "b", "c"].map((id) => ({ id, ...body })),
  drinks: [],
  waters: [],
  posts: [],
  groomTaxes: [],
  cursesReceived: [],
  cutoffHour: 4,
  ...over,
});
let seq = 0;
const drink = (profileId: string, at: number, std = 1, extra: { name?: string; category?: string | null } = {}) => ({
  id: `d${++seq}`,
  profileId,
  at,
  alcoholG: std * STD,
  name: extra.name ?? "Beer",
  category: extra.category ?? "beer",
});
const water = (profileId: string, at: number) => ({ id: `w${++seq}`, profileId, at });
const post = (profileId: string, at: number, taggedIds: string[] = [], asleep = false) => ({
  id: `p${++seq}`,
  profileId,
  at,
  taggedIds,
  asleep,
});
const trigger = (log: { id: string; at: number }, kind: "drink" | "water" = "drink") => ({ kind, id: log.id, at: log.at });

describe("describeRule", () => {
  it("writes each rule type in plain English", () => {
    const cases: Array<[Rule, string]> = [
      [{ type: "count", what: { kind: "drink" }, n: 3, window: "hour" }, "Log 3 drinks within a rolling hour."],
      [{ type: "count", what: { kind: "drink", tag: "fruity" }, n: 1, window: "day" }, "Log a fruity drink in one day. Once a day."],
      [{ type: "count", what: { kind: "drink", category: "shot" }, n: 10, window: "weekend" }, "Log 10 shot drinks over the weekend. Once."],
      [{ type: "count", what: { kind: "drink", name: "Mai Tai" }, n: 2, window: "day" }, "Log 2 Mai Tais in one day. Once a day."],
      [{ type: "count", what: { kind: "water" }, n: 4, window: "day" }, "Log 4 waters in one day. Once a day."],
      [{ type: "threshold", bac: 0.08 }, "Reach an estimated BAC of 0.080%. Once a day."],
      [{ type: "time", what: { kind: "drink" }, when: "before", time: "10:00" }, "Log a drink before 10:00. Once a day."],
      [{ type: "time", what: { kind: "drink", category: "wine" }, when: "after", time: "23:30" }, "Log a wine after 23:30. Once a day."],
      [{ type: "first", bac: 0.08 }, "Be the first to reach an estimated BAC of 0.080% that day."],
      [{ type: "most", metric: "photos" }, "Have the most photos posted that day. A tie goes to whoever got there first."],
      [{ type: "most", metric: "categoryDrinks", category: "beer" }, "Have the most beer drinks logged that day. A tie goes to whoever got there first."],
      [{ type: "most", metric: "cursesReceived" }, "Have the most curses received that day. A tie goes to whoever got there first."],
    ];
    for (const [rule, text] of cases) expect(describeRule(rule)).toBe(text);
  });
});

describe("count rules", () => {
  const triple: Rule = { type: "count", what: { kind: "drink" }, n: 3, window: "hour" };

  it("needs N inside the rolling hour, across a clock-hour boundary", () => {
    const drinks = [drink("a", EVENING - 50 * MIN), drink("a", EVENING - 10 * MIN), drink("a", EVENING + 5 * MIN)];
    const w = world({ drinks });
    expect(meritEarned(triple, w, "a", trigger(drinks[1]), [])).toBeNull();
    expect(meritEarned(triple, w, "a", trigger(drinks[2]), [])).toEqual({
      period: "2026-10-09",
      sourceIds: drinks.map((d) => d.id),
    });
    // Sixty-one minutes apart is not an hour.
    const slow = [drink("a", EVENING - 61 * MIN), drink("a", EVENING - 10 * MIN), drink("a", EVENING)];
    expect(meritEarned(triple, world({ drinks: slow }), "a", trigger(slow[2]), [])).toBeNull();
    // Someone else's drinks don't count.
    const mixed = [drink("b", EVENING - 20 * MIN), drink("a", EVENING - 10 * MIN), drink("a", EVENING)];
    expect(meritEarned(triple, world({ drinks: mixed }), "a", trigger(mixed[2]), [])).toBeNull();
  });

  it("repeats only with a fresh set of drinks", () => {
    const drinks = Array.from({ length: 6 }, (_, i) => drink("a", EVENING + i * 5 * MIN));
    const w = world({ drinks });
    const first = meritEarned(triple, w, "a", trigger(drinks[2]), [])!;
    expect(first.sourceIds).toHaveLength(3);
    const prior = [first];
    expect(meritEarned(triple, w, "a", trigger(drinks[3]), prior)).toBeNull();
    expect(meritEarned(triple, w, "a", trigger(drinks[4]), prior)).toBeNull();
    expect(meritEarned(triple, w, "a", trigger(drinks[5]), prior)?.sourceIds).toEqual(drinks.slice(3).map((d) => d.id));
  });

  it("matches by tag, category and exact name; day and weekend windows pay once", () => {
    const fruity: Rule = { type: "count", what: { kind: "drink", tag: "fruity" }, n: 1, window: "day" };
    const beer = drink("a", EVENING);
    const maiTai = drink("a", EVENING + MIN, 1, { name: "mai tai", category: "cocktail" });
    const custom = drink("a", EVENING + 2 * MIN, 1, { name: "Fruit punch from the cooler", category: null });
    const w = world({ drinks: [beer, maiTai, custom] });
    expect(meritEarned(fruity, w, "a", trigger(beer), [])).toBeNull();
    expect(meritEarned(fruity, w, "a", trigger(custom), [])).toBeNull();
    const earned = meritEarned(fruity, w, "a", trigger(maiTai), []);
    expect(earned?.sourceIds).toEqual([maiTai.id]);
    // Already held today; fine again tomorrow.
    expect(meritEarned(fruity, w, "a", trigger(maiTai), [earned!])).toBeNull();
    const tomorrow = drink("a", end + HOUR, 1, { name: "Mojito", category: "cocktail" });
    expect(meritEarned(fruity, world({ drinks: [maiTai, tomorrow] }), "a", trigger(tomorrow), [earned!])?.period).toBe("2026-10-10");

    const shots: Rule = { type: "count", what: { kind: "drink", category: "shot" }, n: 2, window: "weekend" };
    const s1 = drink("a", EVENING, 1, { category: "shot" });
    const s2 = drink("a", end + 2 * HOUR, 1, { category: "shot" });
    const ws = world({ drinks: [s1, s2] });
    expect(meritEarned(shots, ws, "a", trigger(s1), [])).toBeNull();
    expect(meritEarned(shots, ws, "a", trigger(s2), [])?.sourceIds).toEqual([s1.id, s2.id]);
    expect(meritEarned(shots, ws, "a", trigger(s2), [{ period: "2026-10-09", sourceIds: [] }])).toBeNull();

    const named: Rule = { type: "count", what: { kind: "drink", name: "Mai Tai" }, n: 1, window: "day" };
    expect(meritEarned(named, w, "a", trigger(maiTai), [])).not.toBeNull();
    expect(meritEarned(named, w, "a", trigger(beer), [])).toBeNull();

    const waters: Rule = { type: "count", what: { kind: "water" }, n: 2, window: "day" };
    const w1 = water("a", EVENING);
    const w2 = water("a", EVENING + MIN);
    const ww = world({ waters: [w1, w2], drinks: [beer] });
    expect(meritEarned(waters, ww, "a", trigger(w2, "water"), [])?.sourceIds).toEqual([w1.id, w2.id]);
    expect(meritEarned(waters, ww, "a", trigger(beer), [])).toBeNull();
  });

  it("counts the day from 4am, not midnight", () => {
    const rule: Rule = { type: "count", what: { kind: "drink" }, n: 2, window: "day" };
    const late = drink("a", end - 10 * MIN); // 3:50am Saturday: still Friday
    const early = drink("a", end + 10 * MIN); // 4:10am Saturday
    const w = world({ drinks: [late, early] });
    expect(meritEarned(rule, w, "a", trigger(early), [])).toBeNull();
    const second = drink("a", end + 20 * MIN);
    expect(meritEarned(rule, world({ drinks: [late, early, second] }), "a", trigger(second), [])?.period).toBe("2026-10-10");
  });
});

describe("threshold and time rules", () => {
  it("awards a BAC threshold when a drink takes you there, once a day", () => {
    const rule: Rule = { type: "threshold", bac: 0.08 };
    const drinks = [drink("a", EVENING, 3), drink("a", EVENING + 5 * MIN, 1)];
    const w = world({ drinks });
    expect(meritEarned(rule, w, "a", trigger(drinks[0]), [])).toBeNull();
    const earned = meritEarned(rule, w, "a", trigger(drinks[1]), []);
    expect(earned).toEqual({ period: "2026-10-09", sourceIds: [drinks[1].id] });
    const another = drink("a", EVENING + 10 * MIN);
    expect(meritEarned(rule, world({ drinks: [...drinks, another] }), "a", trigger(another), [earned!])).toBeNull();
    // A water never triggers it.
    const sip = water("a", EVENING + 6 * MIN);
    expect(meritEarned(rule, world({ drinks, waters: [sip] }), "a", trigger(sip, "water"), [])).toBeNull();
  });

  it("reads time of day in party time, within the 4am day", () => {
    const before: Rule = { type: "time", what: { kind: "drink" }, when: "before", time: "10:00" };
    const at = (hoursIntoDay: number) => drink("a", start + hoursIntoDay * HOUR);
    const breakfast = at(5.5); // 9:30am
    const brunch = at(6.5); // 10:30am
    const nightcap = at(22); // 2am: late, not early
    const w = world({ drinks: [breakfast, brunch, nightcap] });
    expect(meritEarned(before, w, "a", trigger(breakfast), [])).not.toBeNull();
    expect(meritEarned(before, w, "a", trigger(brunch), [])).toBeNull();
    expect(meritEarned(before, w, "a", trigger(nightcap), [])).toBeNull();

    const after: Rule = { type: "time", what: { kind: "drink" }, when: "after", time: "01:00" };
    expect(meritEarned(after, w, "a", trigger(nightcap), [])).not.toBeNull();
    expect(meritEarned(after, w, "a", trigger(brunch), [])).toBeNull();
  });
});

describe("achievements", () => {
  it("first to a BAC goes to the earliest, counting only that day", () => {
    const rule: Rule = { type: "first", bac: 0.08 };
    const drinks = [
      drink("a", EVENING + 30 * MIN, 4),
      drink("b", EVENING + 10 * MIN, 4),
      drink("c", EVENING, 3),
      // Yesterday's doesn't count for today.
      drink("c", start - 2 * HOUR, 6),
    ];
    expect(achievementHolder(rule, world({ drinks }), start, end)).toMatchObject({ profileId: "b", at: EVENING + 10 * MIN });
    expect(achievementHolder(rule, world({ drinks }), start - 24 * HOUR, start)?.profileId).toBe("c");
    expect(achievementHolder(rule, world({ drinks: [drinks[2]] }), start, end)).toBeNull();
  });

  it("most of something goes to the highest count; a tie to whoever got there first", () => {
    const waters = [water("a", EVENING), water("a", EVENING + 3 * HOUR), water("b", EVENING + HOUR), water("b", EVENING + 2 * HOUR), water("c", EVENING)];
    expect(achievementHolder({ type: "most", metric: "waters" }, world({ waters }), start, end)).toMatchObject({ profileId: "b", value: 2 });
    // Either side of the 4am cutoff.
    const edge = [water("a", end - MIN), water("b", end), water("b", end + MIN)];
    expect(achievementHolder({ type: "most", metric: "waters" }, world({ waters: edge }), start, end)?.profileId).toBe("a");
    expect(achievementHolder({ type: "most", metric: "waters" }, world({ waters: edge }), end, end + 24 * HOUR)?.profileId).toBe("b");
    expect(achievementHolder({ type: "most", metric: "waters" }, world(), start, end)).toBeNull();
  });

  it("counts photos, tagged photos, drinks, a category, Groom Taxes and curses", () => {
    const posts = [post("a", EVENING), post("a", EVENING + MIN), post("a", EVENING + 2 * MIN, ["a"]), post("b", EVENING + 3 * MIN, ["a", "c"])];
    const w = world({
      posts,
      drinks: [drink("a", EVENING, 1, { category: "shot" }), drink("b", EVENING), drink("b", EVENING + MIN)],
      groomTaxes: [{ profileId: "c", at: EVENING }],
      cursesReceived: [{ profileId: "a", at: EVENING }, { profileId: "a", at: EVENING + MIN }, { profileId: "b", at: EVENING }],
    });
    const holder = (rule: Rule) => achievementHolder(rule, w, start, end)?.profileId;
    expect(holder({ type: "most", metric: "photos" })).toBe("a");
    // Tagging only yourself is not tagging someone else.
    expect(holder({ type: "most", metric: "taggedPhotos" })).toBe("b");
    expect(holder({ type: "most", metric: "drinks" })).toBe("b");
    expect(holder({ type: "most", metric: "categoryDrinks", category: "shot" })).toBe("a");
    expect(holder({ type: "most", metric: "groomTaxes" })).toBe("c");
    expect(holder({ type: "most", metric: "cursesReceived" })).toBe("a");
  });

  it("Lightweight is whoever reached 0.10% on the fewest drinks", () => {
    const drinks = [
      // a: five singles.
      ...Array.from({ length: 5 }, (_, i) => drink("a", EVENING + i * 5 * MIN)),
      // b: two big pours, later.
      drink("b", EVENING + HOUR, 3),
      drink("b", EVENING + HOUR + 5 * MIN, 2),
      // c: never gets there.
      drink("c", EVENING, 2),
    ];
    expect(lightweightHolder(world({ drinks }), start, end)).toMatchObject({ profileId: "b", value: 2 });
    // The same number of drinks: whoever got there first.
    const tie = [drink("a", EVENING + 10 * MIN, 5), drink("b", EVENING, 5)];
    expect(lightweightHolder(world({ drinks: tie }), start, end)?.profileId).toBe("b");
    expect(lightweightHolder(world({ drinks: [drinks[7]] }), start, end)).toBeNull();
  });

  it("Sleeping Beauty looks for the day's first asleep photo with someone tagged", () => {
    const posts = [
      post("a", EVENING, [], true), // nobody tagged
      post("a", EVENING + HOUR, ["b"]), // not marked asleep
      post("c", EVENING + 3 * HOUR, ["a", "b"], true),
      post("a", EVENING + 2 * HOUR, ["c"], true),
      post("b", end + MIN, ["a"], true), // tomorrow
    ];
    expect(firstAsleepPhoto(world({ posts }), start, end)).toMatchObject({ profileId: "a", taggedIds: ["c"] });
    expect(firstAsleepPhoto(world({ posts }), end, end + 24 * HOUR)?.profileId).toBe("b");
    expect(firstAsleepPhoto(world({ posts: posts.slice(0, 2) }), start, end)).toBeNull();
  });
});

describe("coded merit badges", () => {
  it("Hair of the Dog: first drink of the day before noon, after going over 0.08% the day before", () => {
    const night = [drink("a", start + 17 * HOUR, 4)]; // 9pm Friday, about 0.092%
    const morning = drink("a", end + 6 * HOUR); // 10am Saturday
    const w = world({ drinks: [...night, morning] });
    expect(codedMeritEarned("hairOfTheDog", w, "a", trigger(morning), [])).toEqual({ period: "2026-10-10", sourceIds: [morning.id] });

    // Not the first drink of the day.
    const second = drink("a", end + 7 * HOUR);
    expect(codedMeritEarned("hairOfTheDog", world({ drinks: [...night, morning, second] }), "a", trigger(second), [])).toBeNull();
    // After noon.
    const lunch = drink("a", end + 8.5 * HOUR);
    expect(codedMeritEarned("hairOfTheDog", world({ drinks: [...night, lunch] }), "a", trigger(lunch), [])).toBeNull();
    // A quiet night before.
    const quiet = [drink("a", start + 17 * HOUR, 2)];
    expect(codedMeritEarned("hairOfTheDog", world({ drinks: [...quiet, morning] }), "a", trigger(morning), [])).toBeNull();
    // A 3am drink belongs to the night before, so it is not "the first of the day".
    const threeAm = drink("a", end - HOUR);
    expect(codedMeritEarned("hairOfTheDog", world({ drinks: [...night, threeAm] }), "a", trigger(threeAm), [])).toBeNull();
  });

  it("Second Wind: back to zero, then over 0.05% again the same day", () => {
    const lunch = drink("a", start + 8 * HOUR, 1); // noon: gone by about 1:30pm
    const evening = [drink("a", start + 15 * HOUR, 2), drink("a", start + 15 * HOUR + 10 * MIN, 1)];
    const w = world({ drinks: [lunch, ...evening] });
    // Two drinks is about 0.046%: not yet.
    expect(codedMeritEarned("secondWind", w, "a", trigger(evening[0]), [])).toBeNull();
    expect(codedMeritEarned("secondWind", w, "a", trigger(evening[1]), [])).toEqual({ period: "2026-10-09", sourceIds: [evening[1].id] });
    // Once a day.
    expect(codedMeritEarned("secondWind", w, "a", trigger(evening[1]), [{ period: "2026-10-09", sourceIds: [] }])).toBeNull();
    // No earlier session today: this is just the first wind.
    expect(codedMeritEarned("secondWind", world({ drinks: evening }), "a", trigger(evening[1]), [])).toBeNull();
    // Never dropped to zero in between.
    const steady = [drink("a", start + 14 * HOUR, 2), ...evening];
    expect(codedMeritEarned("secondWind", world({ drinks: steady }), "a", trigger(evening[1]), [])).toBeNull();
    // Carried over from the night before, slept it off, back at it: counts.
    const carried = [drink("a", start - HOUR, 2), ...evening];
    expect(codedMeritEarned("secondWind", world({ drinks: carried }), "a", trigger(evening[1]), [])).not.toBeNull();
  });
});

describe("badges against the store", () => {
  const T = EVENING;
  const beer = { name: "Pacifico", volumeOz: 12, abv: 0.045, alcoholG: STD, category: "beer" };
  const roll = () => 0;

  async function crew(count: number): Promise<Profile[]> {
    const made: Profile[] = [];
    for (let i = 0; i < count; i++) {
      const { profile } = await store.createProfile({ name: `Sailor ${i + 1}`, avatarUrl: null, ...body, showBacOnPosts: true });
      made.push(profile);
    }
    return made;
  }
  const badgeNamed = async (name: string) => (await listBadges(store)).find((badge) => badge.name === name)!;
  const held = async (profile: Profile) => {
    const badges = await listBadges(store);
    return (await listAwards(store))
      .filter((award) => award.profileId === profile.id)
      .map((award) => badges.find((badge) => badge.id === award.badgeId)?.name)
      .sort();
  };
  const photo = (profile: Profile, taggedIds: string[] = [], asleep = false) =>
    store.createPost({
      profileId: profile.id,
      url: "https://example.test/original.jpg",
      previewUrl: "https://example.test/preview.jpg",
      mediaType: "image",
      caption: null,
      bacAtPost: null,
      lat: null,
      lng: null,
      locationSource: null,
      eventId: null,
      taggedIds,
      asleep,
    });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(T);
    (globalThis as { __mockData?: unknown }).__mockData = undefined;
    for (const profile of await store.listProfiles()) await store.deleteProfile(profile.id);
    // Cheers and the slot machine out of the way, so points here are drinks and badges only.
    await saveSettings(store, { cheersMinPeople: 30, slotEveryDrinks: 20 });
  });
  afterEach(() => vi.useRealTimers());

  it("seeds the initial set once: rule-based where the builder can, coded where it can't", async () => {
    const badges = await listBadges(store);
    expect(badges.map((badge) => badge.name)).toEqual([
      "Designated Driver", "Hydro Hero", "Perez Hilton", "Paparazzi", "Lightweight", "Sleeping Beauty",
      "Take the Wheel Cap'n", "Triple Kill", "Quadkill", "Pentakill", "Sophisticated Gentleman",
      "Breakfast of Champions", "Hair of the Dog", "Second Wind",
    ]);
    expect(badges.filter((badge) => badge.source === "coded").map((badge) => badge.name)).toEqual([
      "Lightweight", "Sleeping Beauty", "Hair of the Dog", "Second Wind",
    ]);
    expect(badges.filter((badge) => badge.kind === "achievement")).toHaveLength(6);
    expect(await badgeNamed("Sleeping Beauty")).toMatchObject({ points: 10, imageUrl: "/brand/badges/sleeping-beauty.webp" });
    expect(await badgeNamed("Triple Kill")).toMatchObject({ points: 2, kind: "merit" });
    expect((await badgeNamed("Second Wind")).imageUrl).toBeNull();
    expect((await listBadges(store)).length).toBe(14);
  });

  it("earns the Kill badges in turn, pays their points, and takes them back with the drink", async () => {
    const [a] = await crew(1);
    const drinks = [];
    for (let i = 0; i < 5; i++) {
      drinks.push((await logDrink(store, a, beer, roll)).drink);
      vi.advanceTimersByTime(5 * MIN);
    }
    // Five beers also reach 0.08%.
    expect(await held(a)).toEqual(["Pentakill", "Quadkill", "Take the Wheel Cap'n", "Triple Kill"]);
    expect(await balance(store, a.id)).toBe(15 + 4 * 2);
    expect((await listFeedLines(store)).map((line) => line.text)).toContain("Sailor 1 earned PENTAKILL");
    expect((await store.listPointEvents(a.id)).filter((event) => event.source === "badge")).toHaveLength(4);

    await removeDrink(store, a.id, drinks[4].id);
    expect(await held(a)).toEqual(["Quadkill", "Take the Wheel Cap'n", "Triple Kill"]);
    expect(await balance(store, a.id)).toBe(12 + 3 * 2);

    // A sixth drink is only the fifth now, so Pentakill again, on a different drink.
    await logDrink(store, a, beer, roll);
    expect(await held(a)).toContain("Pentakill");
  });

  it("gives the fruity, breakfast and water-count badges from the log", async () => {
    const [a] = await crew(1);
    vi.setSystemTime(Date.parse("2026-10-09T16:30:00Z")); // 9:30am
    await logDrink(store, a, { ...beer, name: "Mimosa", category: "cocktail" }, roll);
    expect(await held(a)).toEqual(["Breakfast of Champions", "Sophisticated Gentleman"]);
    vi.advanceTimersByTime(HOUR);
    await logDrink(store, a, { ...beer, name: "Mimosa", category: "cocktail" }, roll);
    expect(await held(a)).toHaveLength(2);

    const fourWaters = await saveBadge(store, null, {
      name: "Camel", description: "", emoji: "🐪", imageUrl: null, kind: "merit", points: 3, active: true, hidden: false,
      rule: { type: "count", what: { kind: "water" }, n: 2, window: "day" },
    });
    expect(fourWaters).toMatchObject({ source: "rule", kind: "merit" });
    await logWater(store, a);
    await logWater(store, a);
    expect(await held(a)).toContain("Camel");
  });

  it("announces a 'first' achievement when claimed, and awards achievements at the 4am cutoff", async () => {
    const [a, b] = await crew(2);
    await logDrink(store, a, { ...beer, alcoholG: STD * 4 }, roll);
    vi.advanceTimersByTime(10 * MIN);
    await logDrink(store, b, { ...beer, alcoholG: STD * 5 }, roll);
    await logWater(store, b);
    await photo(b, [a.id]);

    const lines = (await listFeedLines(store)).map((line) => line.text);
    expect(lines.filter((line) => line.includes("DESIGNATED DRIVER"))).toEqual(["Sailor 1 has claimed DESIGNATED DRIVER for today"]);
    // Nothing is paid yet, but the trophy case shows who is leading.
    const driverId = (await badgeNamed("Designated Driver")).id;
    expect((await listAwards(store)).filter((award) => award.badgeId === driverId)).toEqual([]);
    // a got to 0.08% first; only b's five reached 0.10%.
    expect((await buildTrophyCase(store, a.id)).leading.map((badge) => badge.name)).toEqual(["Designated Driver"]);
    expect((await buildTrophyCase(store, b.id)).leading.map((badge) => badge.name)).toEqual(["Hydro Hero", "Perez Hilton", "Paparazzi", "Lightweight"]);

    vi.setSystemTime(end - MIN);
    await settleDue(store, Date.now(), true);
    expect(await held(a)).toEqual(["Take the Wheel Cap'n"]);

    vi.setSystemTime(end + MIN);
    await settleDue(store, Date.now(), true);
    await settleDue(store, Date.now(), true);
    expect(await held(a)).toEqual(["Designated Driver", "Take the Wheel Cap'n"]);
    expect(await held(b)).toEqual(["Hydro Hero", "Lightweight", "Paparazzi", "Perez Hilton", "Take the Wheel Cap'n"]);
    const driver = (await store.listPointEvents(a.id)).find((event) => event.reason === "Badge · Designated Driver");
    expect(driver).toMatchObject({ delta: 5, source: "badge", createdAt: new Date(end).toISOString() });
    // The new day has no leaders yet.
    expect((await buildTrophyCase(store, a.id)).leading).toEqual([]);
  });

  it("Sleeping Beauty waits for an admin, awards everyone tagged, and pins the photo", async () => {
    const [a, b, c] = await crew(3);
    const caught = await photo(a, [b.id, c.id], true);
    vi.advanceTimersByTime(MIN);
    await photo(c, [a.id], true);
    expect((await sleepingCandidates(store))[0]).toMatchObject({
      day: "2026-10-09", postId: caught.id, sleepers: ["Sailor 2", "Sailor 3"], confirmed: false, photoUrl: "https://example.test/preview.jpg",
    });
    expect(await held(b)).toEqual([]);

    expect(await confirmSleepingBeauty(store, "2026-10-09")).toBe(2);
    expect(await confirmSleepingBeauty(store, "2026-10-09")).toBe(0);
    expect(await held(b)).toEqual(["Sleeping Beauty"]);
    expect(await held(c)).toEqual(["Sleeping Beauty"]);
    expect(await held(a)).toEqual([]);
    expect(await balance(store, b.id)).toBe(10);
    expect((await store.getPost(caught.id))?.pinnedUntil).toBe(new Date(end).toISOString());
    expect((await sleepingCandidates(store))[0].confirmed).toBe(true);
    await expect(confirmSleepingBeauty(store, "2026-10-08")).rejects.toThrow("no asleep photo");
  });

  it("lets an admin award and revoke by hand, with the reason in the points history", async () => {
    const [a] = await crew(1);
    const manual = await saveBadge(store, null, {
      name: "Best Dressed", description: "Voted at dinner.", emoji: "🎩", imageUrl: null, kind: "achievement", points: 7, active: true, hidden: true,
    });
    expect(manual).toMatchObject({ source: "manual", kind: "achievement", hidden: true });
    // Hidden until earned.
    expect((await buildTrophyCase(store, a.id)).locked.find((badge) => badge.id === manual.id)).toMatchObject({ name: "???" });

    await awardManually(store, manual.id, a.id, "Captain's hat and a blazer");
    await awardManually(store, manual.id, a.id, "");
    expect(await balance(store, a.id)).toBe(14);
    expect((await store.listPointEvents(a.id)).map((event) => event.reason)).toContain("Badge · Best Dressed · Captain's hat and a blazer");
    expect((await buildTrophyCase(store, a.id)).earned).toMatchObject([{ name: "Best Dressed", count: 2 }]);

    const admin = await buildAdminBadges(store);
    const row = admin.badges.find((badge) => badge.id === manual.id)!;
    expect(row.holders).toHaveLength(2);
    expect(await revokeAward(store, row.holders[0].awardId)).toBe(true);
    expect(await revokeAward(store, row.holders[0].awardId)).toBe(false);
    expect(await balance(store, a.id)).toBe(7);
    expect((await buildTrophyCase(store, a.id)).earned[0].count).toBe(1);
  });

  it("applies a points change to future awards only, until Recalculate all", async () => {
    const [a, b] = await crew(2);
    const badge = await saveBadge(store, null, {
      name: "Good Sport", description: "", emoji: "🤝", imageUrl: null, kind: "merit", points: 4, active: true, hidden: false,
    });
    await awardManually(store, badge.id, a.id, "");
    await saveBadge(store, badge.id, { ...badge, points: 10 });
    await awardManually(store, badge.id, b.id, "");
    expect([await balance(store, a.id), await balance(store, b.id)]).toEqual([4, 10]);

    expect(await recalculateBadge(store, badge.id)).toBe(2);
    expect([await balance(store, a.id), await balance(store, b.id)]).toEqual([10, 10]);
    // Still revocable afterwards.
    const [award] = (await listAwards(store)).filter((item) => item.profileId === a.id);
    await revokeAward(store, award.id);
    expect(await balance(store, a.id)).toBe(0);
  });

  it("validates edits and keeps a coded badge's condition", async () => {
    const base = { name: "X", description: "", emoji: "", imageUrl: null, kind: "merit" as const, points: 1, active: true, hidden: false };
    await expect(saveBadge(store, null, { ...base, name: " " })).rejects.toThrow("needs a name");
    await expect(saveBadge(store, null, { ...base, points: -1 })).rejects.toThrow("between 0 and 200");
    await expect(saveBadge(store, null, { ...base, rule: { type: "count", what: { kind: "drink" }, n: 0, window: "hour" } })).rejects.toThrow("incomplete");
    await expect(saveBadge(store, null, { ...base, rule: { type: "time", what: { kind: "drink" }, when: "before", time: "25:00" } })).rejects.toThrow("incomplete");
    expect((await saveBadge(store, null, { ...base, rule: { type: "first", bac: 0.05 } })).kind).toBe("achievement");

    const lightweight = await badgeNamed("Lightweight");
    const edited = await saveBadge(store, lightweight.id, { ...lightweight, name: "Featherweight", points: 9, active: false, rule: { type: "threshold", bac: 0.2 } });
    expect(edited).toMatchObject({ name: "Featherweight", points: 9, active: false, source: "coded", coded: "lightweight", rule: null, kind: "achievement" });
  });

  it("switching a badge off stops it being earned", async () => {
    const [a] = await crew(1);
    const triple = await badgeNamed("Triple Kill");
    await saveBadge(store, triple.id, { ...triple, active: false });
    for (let i = 0; i < 3; i++) await logDrink(store, a, beer, roll);
    expect(await held(a)).toEqual([]);
  });

  it("counts curses received, and queues a full-screen pop until it is seen", async () => {
    const [a, b] = await crew(2);
    await store.addPointEvent({ profileId: a.id, delta: 30, reason: "Float", challengeId: null });
    const cursed = await saveBadge(store, null, {
      name: "Jinxed", description: "", emoji: "🧿", imageUrl: null, kind: "achievement", points: 1, active: true, hidden: false,
      rule: { type: "most", metric: "cursesReceived" },
    });
    await castCurse(store, a, { type: "deadweight", targetId: b.id });
    expect((await buildTrophyCase(store, b.id)).leading.map((badge) => badge.id)).toContain(cursed.id);

    await awardManually(store, cursed.id, b.id, "");
    const [pop] = await unseenPops(store, b.id);
    expect(pop).toMatchObject({ name: "Jinxed", emoji: "🧿", points: 1 });
    await markPopSeen(store, a.id, pop.awardId); // someone else can't dismiss it
    expect(await unseenPops(store, b.id)).toHaveLength(1);
    await markPopSeen(store, b.id, pop.awardId);
    expect(await unseenPops(store, b.id)).toEqual([]);
  });
});
