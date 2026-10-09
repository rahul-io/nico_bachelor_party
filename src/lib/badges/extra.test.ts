import { describe, expect, it } from "vitest";
import { partyTimeToIso } from "@/lib/time";
import { CUMULATIVE, codedHolder, detect } from "./extra";
import { achievementHolder, partyDayBounds, type CodedKey, type LedgerEntry, type World } from "./rules";

const MIN = 60_000;
const HOUR = 60 * MIN;
const STD = 14;
const body = { sex: "male" as const, heightCm: 180, weightKg: 80 };
// For this body one standard drink (14 g) is 0.0229%, so 3 are 0.0687% → "0.069%".

// Party days run 4am to 4am Pacific. Friday the 9th: 11:00Z on the 9th to 11:00Z on the 10th.
const { start, end } = partyDayBounds("2026-10-09", 4);
const EVENING = start + 16 * HOUR; // 8pm Friday
const NOW = end + 30 * HOUR;
const at = (day: string, time: string) => Date.parse(partyTimeToIso(day, time));

const world = (over: Partial<World> = {}): World => ({
  people: ["a", "b", "c", "d", "e"].map((id) => ({ id, ...body })),
  drinks: [],
  waters: [],
  posts: [],
  groomTaxes: [],
  cursesReceived: [],
  cutoffHour: 4,
  comments: [],
  reactions: {},
  ledger: [],
  curses: [],
  wagers: [],
  snitches: [],
  ordersDone: [],
  deletions: [],
  sleepers: [],
  groomId: null,
  ...over,
});

let seq = 0;
const drink = (
  profileId: string,
  when: number,
  extra: { std?: number; name?: string; category?: string | null; abv?: number | null; slot?: string | null } = {},
) => ({
  id: `d${++seq}`,
  profileId,
  at: when,
  alcoholG: (extra.std ?? 1) * STD,
  name: extra.name ?? "Beer",
  category: extra.category === undefined ? "beer" : extra.category,
  abv: extra.abv ?? null,
  slot: extra.slot ?? null,
});
const entry = (profileId: string, delta: number, when: number, over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  profileId,
  delta,
  source: "drink",
  awardKey: null,
  drinkId: null,
  at: when,
  ...over,
});
const curse = (fromId: string, targetId: string, type: string, when: number, blocked = false) => ({
  id: `c${++seq}`,
  type,
  fromId,
  targetId,
  at: when,
  blocked,
});
const found = (key: CodedKey, w: World, now = NOW) => (detect(key, w, now) ?? []).map((item) => item.profileId).sort();

describe("the new 'most' metrics", () => {
  it("Reply Guy and Sommelier count comments and different drinks", () => {
    const w = world({
      comments: [{ profileId: "a", at: EVENING }, { profileId: "b", at: EVENING }, { profileId: "b", at: EVENING + MIN }],
      drinks: [
        drink("a", EVENING, { name: "Beer" }), drink("a", EVENING + MIN, { name: "beer " }), drink("a", EVENING + 2 * MIN, { name: "Beer" }),
        drink("b", EVENING, { name: "Mai Tai" }), drink("b", EVENING + MIN, { name: "Mojito" }),
      ],
    });
    expect(achievementHolder({ type: "most", metric: "comments" }, w, start, end)).toMatchObject({ profileId: "b", value: 2 });
    // Three beers are one drink; two cocktails are two.
    expect(achievementHolder({ type: "most", metric: "distinctDrinks" }, w, start, end)).toMatchObject({ profileId: "b", value: 2 });
  });

  it("Whale, The House, Robin Hood and Rat King read the ledger", () => {
    const wager = (profileId: string, delta: number, minute: number) => entry(profileId, delta, EVENING + minute * MIN, { source: "wager" });
    const ledger = [
      wager("a", -20, 0), wager("b", -20, 0), wager("a", 40, 5), // a wins 20 off b
      wager("c", -30, 6), wager("c", 30, 7), // c staked the most and got it back
      entry("d", 5, EVENING, { source: "slot", awardKey: "slot:x1:rob" }),
      entry("a", -5, EVENING, { source: "slot", awardKey: "slot:x1:robbed" }),
      entry("d", 4, EVENING + MIN, { source: "slot", awardKey: "slot:x2:rob" }),
      entry("e", 5, EVENING, { source: "slot", awardKey: "slot:x3:rob" }),
      entry("e", 3, EVENING, { source: "snitch", awardKey: "snitch:s1:reporter" }),
      entry("b", -5, EVENING, { source: "snitch", awardKey: "snitch:s1:accused" }),
      // Yesterday doesn't count.
      wager("b", -100, -24 * 60),
    ];
    const holder = (metric: "pointsStaked" | "wagerWinnings" | "slotStolen" | "snitchReports") =>
      achievementHolder({ type: "most", metric }, world({ ledger }), start, end);
    expect(holder("pointsStaked")).toMatchObject({ profileId: "c", value: 30 });
    expect(holder("wagerWinnings")).toMatchObject({ profileId: "a", value: 20 });
    expect(holder("slotStolen")).toMatchObject({ profileId: "d", value: 9 });
    expect(holder("snitchReports")).toMatchObject({ profileId: "e", value: 1 });
    // Nobody is "The House" on a day when everyone lost or broke even.
    expect(achievementHolder({ type: "most", metric: "wagerWinnings" }, world({ ledger: [wager("a", -5, 0), wager("b", 0, 1)] }), start, end)).toBeNull();
  });
});

describe("coded achievements", () => {
  it("Early Bird and Night Owl are the first and last drink of the 4am day", () => {
    const drinks = [
      drink("a", start - MIN), // 3:59am: still yesterday, and yesterday's Night Owl
      drink("b", start + 3 * HOUR),
      drink("c", start + 5 * HOUR),
      drink("d", end - 5 * MIN),
      drink("e", end + MIN), // tomorrow's Early Bird
    ];
    const w = world({ drinks });
    expect(codedHolder("earlyBird", w, start, end)?.profileId).toBe("b");
    expect(codedHolder("nightOwl", w, start, end)?.profileId).toBe("d");
    expect(codedHolder("nightOwl", w, start - 24 * HOUR, start)?.profileId).toBe("a");
    expect(codedHolder("earlyBird", w, end, end + 24 * HOUR)?.profileId).toBe("e");
    expect(codedHolder("earlyBird", world(), start, end)).toBeNull();
  });

  it("Influencer is the poster of the single most-reacted photo; a tie goes to the earlier one", () => {
    const post = (id: string, profileId: string, when: number) => ({ id, profileId, at: when, taggedIds: [], asleep: false });
    const posts = [post("p1", "a", EVENING), post("p2", "a", EVENING + MIN), post("p3", "b", EVENING + 2 * MIN), post("p4", "c", start - HOUR)];
    // a has 6 reactions over two photos; b has 5 on one.
    expect(codedHolder("influencer", world({ posts, reactions: { p1: 3, p2: 3, p3: 5, p4: 50 } }), start, end)).toMatchObject({ profileId: "b", value: 5 });
    expect(codedHolder("influencer", world({ posts, reactions: { p2: 4, p3: 4 } }), start, end)?.profileId).toBe("a");
    expect(codedHolder("influencer", world({ posts }), start, end)).toBeNull();
  });

  it("Wooden Spoon is last place at the cutoff among those who drank that day", () => {
    const drinks = [drink("a", EVENING), drink("b", EVENING + MIN), drink("c", EVENING + 2 * MIN)];
    const ledger = [entry("a", 30, EVENING), entry("b", 4, EVENING), entry("c", 9, EVENING), entry("b", 10, end + MIN)];
    // d and e have nothing, but didn't log a drink, so they can't take it.
    expect(codedHolder("woodenSpoon", world({ drinks, ledger }), start, end)).toMatchObject({ profileId: "b", value: 4 });
    // Points scored after the cutoff don't rescue anyone; a tie goes to whoever drank first.
    const tied = [entry("a", 5, EVENING), entry("b", 5, EVENING), entry("c", 9, EVENING)];
    expect(codedHolder("woodenSpoon", world({ drinks, ledger: tied }), start, end)?.profileId).toBe("a");
    expect(codedHolder("woodenSpoon", world({ ledger }), start, end)).toBeNull();
  });
});

describe("slot machine and wager badges", () => {
  it("Jackpot goes to the drink that hit it", () => {
    const drinks = [drink("a", EVENING, { slot: "jackpot" }), drink("b", EVENING, { slot: "2x" }), drink("c", EVENING)];
    expect(found("jackpot", world({ drinks }))).toEqual(["a"]);
  });

  it("Bust Out needs three busts in a row, counting only drinks that spun", () => {
    const spin = (profileId: string, minute: number, slot: string | null) => drink(profileId, EVENING + minute * MIN, { slot });
    const drinks = [
      // a: bust, (no spin), bust, bust → three in a row.
      spin("a", 0, "bust"), spin("a", 1, null), spin("a", 2, "bust"), spin("a", 3, "bust"),
      // b: a 1× in the middle breaks it.
      spin("b", 0, "bust"), spin("b", 1, "bust"), spin("b", 2, "1x"), spin("b", 3, "bust"),
    ];
    const hits = detect("bustOut", world({ drinks }), NOW)!;
    expect(hits.map((hit) => hit.profileId)).toEqual(["a"]);
    expect(hits[0].sourceIds).toEqual([drinks[0].id, drinks[2].id, drinks[3].id]);
    // Six in a row is two.
    const six = Array.from({ length: 6 }, (_, i) => spin("c", i, "bust"));
    expect(found("bustOut", world({ drinks: six }))).toEqual(["c", "c"]);
  });

  it("Robbed Blind goes to whoever was robbed; Self-Own when Pay It Forward pays your last curser", () => {
    const gift = drink("a", EVENING + 10 * MIN, { slot: "forward" });
    const ledger = [
      entry("b", -5, EVENING, { source: "slot", awardKey: "slot:d0:robbed", drinkId: "d0" }),
      entry("c", 5, EVENING, { source: "slot", awardKey: "slot:d0:rob", drinkId: "d0" }),
      entry("b", 3, gift.at, { source: "slot", awardKey: `slot:${gift.id}:forward`, drinkId: gift.id }),
    ];
    expect(found("robbedBlind", world({ ledger }))).toEqual(["b"]);

    // b cursed a last, and a's Pay It Forward went to b.
    const curses = [curse("c", "a", "deadweight", EVENING), curse("b", "a", "name", EVENING + 5 * MIN)];
    expect(found("selfOwn", world({ drinks: [gift], ledger, curses }))).toEqual(["a"]);
    // If c was the last to curse a, it is just a gift.
    expect(found("selfOwn", world({ drinks: [gift], ledger, curses: [curses[1], curse("c", "a", "avatar", EVENING + 6 * MIN)] }))).toEqual([]);
    // A curse cast after the spin doesn't count.
    expect(found("selfOwn", world({ drinks: [gift], ledger, curses: [curse("b", "a", "name", gift.at + MIN)] }))).toEqual([]);
  });

  it("Bad Beat is losing a wager of 20 or more", () => {
    const wagers = [
      { id: "w1", stake: 20, winnerId: "a", loserId: "b", at: EVENING },
      { id: "w2", stake: 19, winnerId: "a", loserId: "c", at: EVENING },
      { id: "w3", stake: 50, winnerId: "d", loserId: "b", at: EVENING + MIN },
    ];
    expect(found("badBeat", world({ wagers }))).toEqual(["b", "b"]);
  });

  it("Comeback Kid goes from last place to the top three in one day", () => {
    const base = [entry("a", 50, start - HOUR), entry("b", 40, start - HOUR), entry("c", 30, start - HOUR), entry("d", 20, start - HOUR), entry("e", 5, start - HOUR)];
    // e starts the day last and climbs past c.
    const climb = [...base, entry("e", 10, EVENING), entry("e", 20, EVENING + HOUR)];
    const hits = detect("comebackKid", world({ ledger: climb, drinks: [drink("e", EVENING)] }), NOW)!;
    expect(hits).toMatchObject([{ profileId: "e", key: "2026-10-09", at: EVENING + HOUR }]);

    // Fourth place isn't the top three.
    expect(found("comebackKid", world({ ledger: [...base, entry("e", 16, EVENING)], drinks: [drink("e", EVENING)] }))).toEqual([]);
    // Last yesterday, top three today: not within one day... unless they were still last when today began.
    const overnight = [...base, entry("e", 40, start + HOUR)];
    expect(found("comebackKid", world({ ledger: overnight, drinks: [drink("e", EVENING)] }))).toEqual(["e"]);
    // With everyone level nobody is "last", and four people is too few.
    expect(found("comebackKid", world({ ledger: [entry("a", 5, EVENING)], drinks: [drink("a", EVENING)] }))).toEqual([]);
    expect(found("comebackKid", world({ people: world().people.slice(0, 4), ledger: climb.filter((item) => item.profileId !== "d"), drinks: [drink("e", EVENING)] }))).toEqual([]);
  });
});

describe("drink-log badges", () => {
  it("Variety Pack needs all five categories in one day", () => {
    const five = ["beer", "wine", "shot", "cocktail", "seltzer"];
    const drinks = five.map((category, i) => drink("a", EVENING + i * MIN, { category }));
    const hits = detect("varietyPack", world({ drinks }), NOW)!;
    expect(hits).toMatchObject([{ profileId: "a", at: EVENING + 4 * MIN }]);
    expect(hits[0].sourceIds).toHaveLength(5);
    // Four today and the fifth after the cutoff is not one day.
    const split = [...drinks.slice(0, 4), drink("a", end + MIN, { category: "seltzer" })];
    expect(found("varietyPack", world({ drinks: split }))).toEqual([]);
  });

  it("Groundhog Day is the same drink five times running", () => {
    const same = Array.from({ length: 5 }, (_, i) => drink("a", EVENING + i * MIN, { name: i % 2 ? "MAI TAI" : "Mai Tai" }));
    expect(found("groundhogDay", world({ drinks: same }))).toEqual(["a"]);
    const broken = [...same.slice(0, 4), drink("a", EVENING + 4 * MIN + 1, { name: "Beer" }), drink("a", EVENING + 5 * MIN, { name: "Mai Tai" })];
    expect(found("groundhogDay", world({ drinks: broken }))).toEqual([]);
  });

  it("Jinx pays both when two people log the same drink in the same clock minute", () => {
    const minute = Math.floor(EVENING / MIN) * MIN;
    const drinks = [
      drink("a", minute + 2_000, { name: "Paloma" }),
      drink("b", minute + 55_000, { name: "paloma" }),
      drink("c", minute + 61_000, { name: "Paloma" }), // the next minute
      drink("d", minute + 3_000, { name: "Beer" }),
      drink("a", minute + 4_000, { name: "Beer", std: 0.5 }), // the same person twice is no jinx
    ];
    expect(found("jinx", world({ drinks: drinks.filter((item) => item.profileId !== "d") }))).toEqual(["a", "b"]);
    expect(found("jinx", world({ drinks }))).toEqual(["a", "a", "b", "d"]);
  });

  it("Mad Scientist is a custom drink over 50%, not a catalogue one", () => {
    const drinks = [
      drink("a", EVENING, { name: "Jungle Juice", abv: 0.6 }),
      drink("b", EVENING, { name: "Jungle Juice", abv: 0.5 }),
      drink("c", EVENING, { name: "Beer", abv: null }),
      drink("d", EVENING, { name: "mai tai", abv: 0.9 }),
    ];
    expect(found("madScientist", world({ drinks }))).toEqual(["a"]);
  });

  it("Midnight Snack is a drink in the 12:00am minute, party time", () => {
    const drinks = [
      drink("a", at("2026-10-10", "00:00") + 30_000),
      drink("b", at("2026-10-10", "00:01")),
      drink("c", at("2026-10-09", "23:59") + 59_000),
      drink("d", at("2026-10-10", "12:00")),
    ];
    expect(found("midnightSnack", world({ drinks }))).toEqual(["a"]);
  });

  it("Same Time Tomorrow matches the clock minute on consecutive calendar days", () => {
    const drinks = [
      drink("a", at("2026-10-09", "19:42") + 5_000),
      drink("a", at("2026-10-10", "19:42") + 50_000),
      drink("b", at("2026-10-09", "19:42")),
      drink("b", at("2026-10-10", "19:43")),
      drink("c", at("2026-10-08", "19:42")),
      drink("c", at("2026-10-10", "19:42")), // two days apart
    ];
    const hits = detect("sameTimeTomorrow", world({ drinks }), NOW)!;
    expect(hits).toMatchObject([{ profileId: "a", sourceIds: [drinks[0].id, drinks[1].id] }]);
  });

  it("Sunday Scaries is the first drink of the Sunday party day, before 9am", () => {
    // Sunday is the 11th. A 2am Sunday drink belongs to Saturday night.
    const early = [drink("a", at("2026-10-11", "02:00")), drink("a", at("2026-10-11", "08:30"))];
    expect(found("sundayScaries", world({ drinks: early }), at("2026-10-12", "12:00"))).toEqual(["a"]);
    // First Sunday drink at 9:05 is too late, even with an earlier Saturday one.
    const late = [drink("b", at("2026-10-10", "08:00")), drink("b", at("2026-10-11", "09:05"))];
    expect(found("sundayScaries", world({ drinks: late }), at("2026-10-12", "12:00"))).toEqual([]);
    // Only the first Sunday drink counts.
    const second = [drink("c", at("2026-10-11", "04:30")), drink("c", at("2026-10-11", "08:00"))];
    expect(detect("sundayScaries", world({ drinks: second }), at("2026-10-12", "12:00"))).toMatchObject([{ sourceIds: [second[0].id] }]);
  });

  it("Butterfingers is three deletions in a 4am day", () => {
    const del = (profileId: string, when: number) => ({ profileId, at: when });
    const deletions = [del("a", EVENING), del("a", EVENING + MIN), del("a", EVENING + 2 * MIN), del("a", EVENING + 3 * MIN), del("b", end - MIN), del("b", end + MIN), del("b", end + 2 * MIN)];
    expect(detect("butterfingers", world({ deletions }), NOW)).toMatchObject([{ profileId: "a", key: "2026-10-09", at: EVENING + 2 * MIN }]);
  });

  it("Perfectly Balanced is judged on a finished day: equal drinks and waters, five or more", () => {
    const five = (profileId: string, n = 5) => Array.from({ length: n }, (_, i) => drink(profileId, EVENING + i * MIN));
    const waters = (profileId: string, n = 5) => Array.from({ length: n }, (_, i) => ({ id: `w${++seq}`, profileId, at: EVENING + i * MIN }));
    const w = world({ drinks: [...five("a"), ...five("b"), ...five("c", 4)], waters: [...waters("a"), ...waters("b", 6), ...waters("c", 4)] });
    expect(found("perfectlyBalanced", w)).toEqual(["a"]);
    // Not while the day is still running: a sixth drink could unbalance it.
    expect(found("perfectlyBalanced", w, end - MIN)).toEqual([]);
  });
});

describe("exact-BAC badges", () => {
  it("Nice. is a drink that takes BAC to 0.069% to three decimals, once a day", () => {
    const drinks = [drink("a", EVENING, { std: 3 }), drink("b", EVENING, { std: 2.9 }), drink("c", EVENING, { std: 3.1 })];
    // 3 std = 0.0687 → 0.069; 2.9 = 0.0664 → 0.066; 3.1 = 0.0710 → 0.071.
    const hits = detect("nice", world({ drinks }), NOW)!;
    expect(hits).toMatchObject([{ profileId: "a", key: "2026-10-09", sourceIds: [drinks[0].id] }]);
    // Reached by topping up as it wears off: 0.0687 − 0.0150 after an hour, plus two-thirds of a drink.
    const topUp = [drink("d", EVENING, { std: 3 }), drink("d", EVENING + HOUR, { std: 0.655 })];
    expect(detect("nice", world({ drinks: topUp }), NOW)!.map((hit) => hit.key)).toEqual(["2026-10-09", "2026-10-09"]);
  });

  it("Blaze It is 0.042% at 4:20, am or pm, party time", () => {
    const pm = at("2026-10-09", "16:20");
    // 2 std is 0.0458% at the pour; fifteen minutes later it is 0.0421%.
    const hit = world({ drinks: [drink("a", pm - 15 * MIN, { std: 2 })] });
    expect(detect("blazeIt", hit, NOW)).toMatchObject([{ profileId: "a", key: "2026-10-09 16:20", at: pm }]);
    // An hour off it is not 0.042%.
    expect(found("blazeIt", world({ drinks: [drink("a", pm - 75 * MIN, { std: 2 })] }))).toEqual([]);
    // A drink landing inside the 4:20 minute counts too.
    const inside = world({ drinks: [drink("b", pm + 20_000, { std: 1.835 })] });
    expect(found("blazeIt", inside)).toEqual(["b"]);
    // The morning one, and not before the moment has passed.
    const am = at("2026-10-10", "04:20");
    const morning = world({ drinks: [drink("c", am - 15 * MIN, { std: 2 })] });
    expect(detect("blazeIt", morning, NOW)).toMatchObject([{ profileId: "c", key: "2026-10-10 04:20" }]);
    expect(found("blazeIt", morning, am - MIN)).toEqual([]);
  });

  it("Nice II is a running total of exactly 69 points at some moment", () => {
    const ledger = [entry("a", 60, EVENING), entry("a", 9, EVENING + MIN), entry("a", 5, EVENING + 2 * MIN), entry("b", 68.9, EVENING), entry("b", 0.2, EVENING + MIN)];
    expect(detect("niceTwo", world({ ledger }), NOW)).toMatchObject([{ profileId: "a", key: "once", at: EVENING + MIN }]);
    // Passing back through 69 reports again, under the same key.
    const again = [...ledger, entry("a", -5, EVENING + 3 * MIN)];
    expect(detect("niceTwo", world({ ledger: again }), NOW)!.filter((hit) => hit.profileId === "a").map((hit) => hit.key)).toEqual(["once", "once"]);
  });
});

describe("curse, snitch and photo badges", () => {
  it("Witch has cast all four kinds; it counts curses from before the badge existed", () => {
    const curses = [curse("a", "b", "name", EVENING), curse("a", "c", "deadweight", EVENING + MIN), curse("a", "b", "avatar", EVENING + 2 * MIN), curse("a", "a", "shield", EVENING + 3 * MIN), curse("b", "a", "name", EVENING)];
    expect(detect("witch", world({ curses }), NOW)).toMatchObject([{ profileId: "a", key: "once", at: EVENING + 3 * MIN }]);
    expect(found("witch", world({ curses: curses.slice(0, 3) }))).toEqual([]);
    expect(CUMULATIVE).toEqual(["witch", "groomShadow"]);
  });

  it("Identity Crisis, Regicide and Uno Reverse", () => {
    const curses = [
      curse("a", "b", "name", EVENING),
      curse("c", "d", "name", EVENING, true), // blocked by a Shield: it never landed
      curse("b", "a", "deadweight", EVENING + 4 * MIN), // b curses a back inside five minutes
      curse("d", "c", "avatar", EVENING + 6 * MIN), // too slow
      curse("e", "e", "shield", EVENING),
    ];
    const w = world({ curses, groomId: "a" });
    expect(found("identityCrisis", w)).toEqual(["b"]);
    expect(found("unoReverse", w)).toEqual(["b"]);
    expect(found("regicide", w)).toEqual(["b"]);
    expect(found("regicide", world({ curses, groomId: "d" }))).toEqual([]);
    expect(found("regicide", world({ curses }))).toEqual([]);
  });

  it("Corporate Drone and Midori Sour Survivor", () => {
    const w = world({
      snitches: [{ id: "s1", reporterId: "a", accusedId: "b", at: EVENING }],
      ordersDone: [{ id: "o1", profileId: "c", at: EVENING }, { id: "o2", profileId: "c", at: EVENING + HOUR }],
    });
    expect(found("corporateDrone", w)).toEqual(["b"]);
    expect(found("bartenderDone", w)).toEqual(["c", "c"]);
  });

  it("Nico's Shadow is being tagged in ten photos that also tag the groom", () => {
    const post = (taggedIds: string[], i: number) => ({ id: `p${++seq}`, profileId: "e", at: EVENING + i * MIN, taggedIds, asleep: false });
    const posts = [...Array.from({ length: 10 }, (_, i) => post(["a", "b"], i)), ...Array.from({ length: 9 }, (_, i) => post(["a", "c"], 20 + i)), post(["c", "d"], 40)];
    expect(detect("groomShadow", world({ posts, groomId: "a" }), NOW)).toMatchObject([{ profileId: "b", key: "once", at: EVENING + 9 * MIN }]);
    expect(found("groomShadow", world({ posts }))).toEqual([]);
  });

  it("Lazarus is a drink within an hour of your confirmed Sleeping Beauty photo", () => {
    const sleepers = [{ profileId: "a", postId: "p1", at: EVENING }, { profileId: "b", postId: "p1", at: EVENING }];
    const drinks = [drink("a", EVENING + 59 * MIN), drink("a", EVENING + 60 * MIN), drink("b", EVENING + 61 * MIN), drink("c", EVENING + MIN)];
    const hits = detect("lazarus", world({ sleepers, drinks }), NOW)!;
    expect(hits).toMatchObject([{ profileId: "a", key: "p1", sourceIds: [drinks[0].id] }]);
  });
});

describe("detect", () => {
  it("is null for badges that are not detector badges", () => {
    expect(detect("lightweight", world(), NOW)).toBeNull();
    expect(detect("earlyBird", world(), NOW)).toBeNull();
    expect(detect("jackpot", world(), NOW)).toEqual([]);
  });
});
