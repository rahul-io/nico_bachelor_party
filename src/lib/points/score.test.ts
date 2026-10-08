import { describe, expect, it } from "vitest";
import { describeBreakdown, formatDelta, formatPoints } from "./format";
import { isHydrated, resolveCheers, scoreDrink, scoreWater, type CheersDrink, type ScoreDrinkInput } from "./score";
import { defaultSettings, mergeSettings, parseSettings } from "./settings";

const MIN = 60_000;
const T = Date.parse("2026-10-09T03:00:00Z");
const STD = 14;

const input = (over: Partial<ScoreDrinkInput> = {}): ScoreDrinkInput => ({
  alcoholG: STD,
  at: T,
  priorDrinks: [],
  bacBefore: 0,
  hydrated: false,
  happyHour: false,
  drinkOfDay: false,
  ...over,
});

describe("scoreDrink", () => {
  it("pays the base rate per standard drink, to one decimal", () => {
    expect(scoreDrink(input(), defaultSettings).points).toBe(3);
    expect(scoreDrink(input({ alcoholG: STD * 1.4 }), defaultSettings).points).toBe(4.2);
  });

  it("gives partial credit at the pace cap and nothing past it", () => {
    const settings = { ...defaultSettings, paceCap: 3 };
    const prior = [
      { alcoholG: STD, at: T - 50 * MIN },
      { alcoholG: STD * 1.5, at: T - 20 * MIN },
    ];
    // 2.5 of 3 used in the last hour: half of this drink counts.
    const partial = scoreDrink(input({ priorDrinks: prior }), settings);
    expect(partial.breakdown.counted).toBeCloseTo(0.5);
    expect(partial.points).toBe(1.5);

    const over = scoreDrink(input({ priorDrinks: [...prior, { alcoholG: STD, at: T - MIN }] }), settings);
    expect(over.points).toBe(0);
    expect(over.breakdown.paused).toBe(false);
  });

  it("only counts the rolling hour towards the cap", () => {
    const settings = { ...defaultSettings, paceCap: 2 };
    const prior = [
      { alcoholG: STD * 2, at: T - 61 * MIN },
      { alcoholG: STD, at: T - 59 * MIN },
    ];
    expect(scoreDrink(input({ priorDrinks: prior }), settings).points).toBe(3);
  });

  it("defaults to a cap of 10 standard drinks an hour", () => {
    const prior = Array.from({ length: 9 }, (_, i) => ({ alcoholG: STD, at: T - (i + 1) * MIN }));
    expect(scoreDrink(input({ priorDrinks: prior }), defaultSettings).points).toBe(3);
    expect(scoreDrink(input({ priorDrinks: [...prior, { alcoholG: STD, at: T - 30 * MIN }] }), defaultSettings).points).toBe(0);
  });

  it("pauses points at the BAC ceiling", () => {
    expect(scoreDrink(input({ bacBefore: 0.179 }), defaultSettings).points).toBe(3);
    const paused = scoreDrink(input({ bacBefore: 0.18, happyHour: true }), defaultSettings);
    expect(paused.points).toBe(0);
    expect(paused.breakdown.paused).toBe(true);
  });

  it("stacks multipliers by multiplying them", () => {
    expect(scoreDrink(input({ hydrated: true }), defaultSettings).points).toBe(4.5);
    expect(scoreDrink(input({ happyHour: true, drinkOfDay: true }), defaultSettings).points).toBe(12);
    const all = scoreDrink(input({ hydrated: true, happyHour: true, drinkOfDay: true }), defaultSettings);
    expect(all.breakdown.multiplier).toBe(6);
    expect(all.points).toBe(18);
  });

  it("holds the combined multiplier to the maximum", () => {
    const settings = { ...defaultSettings, maxMultiplier: 4 };
    const capped = scoreDrink(input({ hydrated: true, happyHour: true, drinkOfDay: true }), settings);
    expect(capped.breakdown.multiplier).toBe(4);
    expect(capped.points).toBe(12);
    expect(describeBreakdown(capped.breakdown, capped.points)).toBe(
      "1 std × 3 = 3 × 1.5 hydration × 2 Happy Hour × 2 Drink of the Day (max 4×) = 12",
    );
  });
});

describe("water", () => {
  it("scores up to the hourly limit, then not until an earlier one ages out", () => {
    expect(scoreWater(T, [], defaultSettings)).toBe(1);
    expect(scoreWater(T, [T - 10 * MIN], defaultSettings)).toBe(1);
    expect(scoreWater(T, [T - 50 * MIN, T - 10 * MIN], defaultSettings)).toBe(0);
    expect(scoreWater(T, [T - 61 * MIN, T - 10 * MIN], defaultSettings)).toBe(1);
  });

  it("banks one boost for the next drink, and does not stack", () => {
    expect(isHydrated(null, [T - MIN], T)).toBe(true);
    expect(isHydrated(T - 30 * MIN, [T - 40 * MIN], T)).toBe(false);
    expect(isHydrated(T - 30 * MIN, [T - 20 * MIN, T - 10 * MIN], T)).toBe(true);
    expect(isHydrated(T - 30 * MIN, [], T)).toBe(false);
  });
});

describe("resolveCheers", () => {
  const drink = (id: string, profileId: string, minutesAgo: number, groupId: string | null = null): CheersDrink => ({
    id,
    profileId,
    at: T - minutesAgo * MIN,
    groupId,
  });

  it("needs four different people inside five minutes", () => {
    const mine = drink("d4", "d", 0);
    const three = [drink("a1", "a", 4), drink("b1", "b", 3), drink("c1", "c", 1)];
    expect(resolveCheers(mine, [...three, mine], defaultSettings)).toEqual({
      kind: "new",
      drinkIds: ["a1", "b1", "c1", "d4"],
    });
    // The first drink is just outside the window.
    expect(resolveCheers(mine, [drink("a1", "a", 5.1), ...three.slice(1), mine], defaultSettings)).toEqual({ kind: "none" });
    // Two drinks from the same person count once.
    expect(resolveCheers(mine, [drink("a1", "a", 4), drink("a2", "a", 2), drink("b1", "b", 3), mine], defaultSettings)).toEqual({ kind: "none" });
  });

  it("uses one drink per person: their latest", () => {
    const mine = drink("d4", "d", 0);
    const result = resolveCheers(
      mine,
      [drink("a1", "a", 4), drink("a2", "a", 2), drink("b1", "b", 3), drink("c1", "c", 1), mine],
      defaultSettings,
    );
    expect(result).toEqual({ kind: "new", drinkIds: ["a2", "b1", "c1", "d4"] });
  });

  it("lets a latecomer join an open Cheers, but pays nobody twice", () => {
    const group = [drink("a1", "a", 4, "g"), drink("b1", "b", 3, "g"), drink("c1", "c", 2, "g"), drink("d1", "d", 2, "g")];
    const late = drink("e1", "e", 0);
    expect(resolveCheers(late, [...group, late], defaultSettings)).toEqual({ kind: "join", groupId: "g" });

    const again = drink("a2", "a", 0);
    expect(resolveCheers(again, [...group, again], defaultSettings)).toEqual({ kind: "none" });
  });

  it("ignores a Cheers that started before the window", () => {
    const old = [drink("a1", "a", 9, "g"), drink("b1", "b", 8, "g"), drink("c1", "c", 8, "g"), drink("d1", "d", 7, "g")];
    const late = drink("e1", "e", 0);
    expect(resolveCheers(late, [...old, late], defaultSettings)).toEqual({ kind: "none" });
  });
});

describe("formatting and settings", () => {
  it("formats points and breakdown lines", () => {
    expect(formatPoints(12)).toBe("12");
    expect(formatPoints(4.2 + 2.1)).toBe("6.3");
    expect(formatDelta(-3)).toBe("−3");
    expect(formatDelta(0)).toBe("0");

    const plain = scoreDrink(input({ alcoholG: STD * 1.4 }), defaultSettings);
    expect(describeBreakdown(plain.breakdown, plain.points)).toBe("1.4 std × 3 = 4.2");
    const boosted = scoreDrink(input({ alcoholG: STD * 1.4, hydrated: true }), defaultSettings);
    expect(describeBreakdown(boosted.breakdown, boosted.points)).toBe("1.4 std × 3 = 4.2 × 1.5 hydration = 6.3");
    const paused = scoreDrink(input({ bacBefore: 0.2 }), defaultSettings);
    expect(describeBreakdown(paused.breakdown, paused.points)).toBe("1 std · points paused");
  });

  it("merges stored overrides over the defaults and rejects bad edits", () => {
    expect(mergeSettings(null)).toEqual(defaultSettings);
    expect(mergeSettings({ paceCap: 6, bacCeiling: "high", nonsense: 1, maxMultiplier: -2 })).toEqual({
      ...defaultSettings,
      paceCap: 6,
    });
    expect(parseSettings({ paceCap: 6, pointsPerDrink: 3 })).toEqual({ ok: true, value: { paceCap: 6 } });
    expect(parseSettings({ paceCap: 0 }).ok).toBe(false);
    expect(parseSettings({ bandLow: 0.12 }).ok).toBe(false);
  });
});
