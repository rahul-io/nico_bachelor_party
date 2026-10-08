import { describe, expect, it } from "vitest";
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
} from "./awards";
import { defaultSettings } from "./settings";

const MIN = 60_000;
const HOUR = 60 * MIN;
const STD = 14;
const body = { sex: "male" as const, heightCm: 180, weightKg: 80 };
const people = ["a", "b", "c"].map((id) => ({ id, ...body }));

// Party time is Pacific (UTC−7 in October), so 4am on the 9th is 11:00Z.
const { start, end } = partyDayBounds("2026-10-09", 4);

const data = (over: Partial<AwardData> = {}): AwardData => ({
  people,
  drinks: [],
  waters: [],
  posts: [],
  drinkPoints: [],
  ...over,
});
const drink = (profileId: string, at: number, std = 1) => ({ profileId, at, alcoholG: std * STD });

describe("party days", () => {
  it("run from 4am to 4am party time", () => {
    expect(new Date(start).toISOString()).toBe("2026-10-09T11:00:00.000Z");
    expect(end - start).toBe(24 * HOUR);
    expect(partyDayOf(start, 4)).toBe("2026-10-09");
    expect(partyDayOf(start - 1, 4)).toBe("2026-10-08");
    // 2am on the 10th still belongs to the 9th.
    expect(partyDayOf(Date.parse("2026-10-10T09:00:00Z"), 4)).toBe("2026-10-09");
    expect(nextDay("2026-10-31")).toBe("2026-11-01");
  });
});

describe("daily awards", () => {
  it("Smooth Sailing goes to the most minutes inside the band", () => {
    const evening = start + 14 * HOUR;
    const result = smoothSailing(
      data({
        drinks: [
          // a: three drinks spread out, a long stay in the band.
          drink("a", evening, 1.5), drink("a", evening + 30 * MIN, 1.5), drink("a", evening + 90 * MIN, 1.5),
          // b: one drink never reaches 0.04.
          drink("b", evening),
          // c: far over the band until after the day ends.
          drink("c", end - 2 * 60 * MIN, 9),
        ],
      }),
      start,
      end,
      defaultSettings,
    );
    expect(result?.profileId).toBe("a");
    expect(result?.value).toBeGreaterThan(60);
  });

  it("Smooth Sailing only counts minutes inside the day", () => {
    // Drinks just before the cutoff: the band time after 4am belongs to the next day.
    const late = [drink("a", end - 20 * MIN, 2), drink("a", end - 10 * MIN, 1)];
    const today = smoothSailing(data({ drinks: late }), start, end, defaultSettings);
    expect(today?.value).toBeLessThanOrEqual(20);
    const tomorrow = smoothSailing(data({ drinks: late }), end, end + 24 * HOUR, defaultSettings);
    expect(tomorrow?.value).toBeGreaterThan(20);
  });

  it("Drunkest Sailor is the highest peak, counted only up to the ceiling", () => {
    const t = start + 12 * HOUR;
    const result = drunkestSailor(
      data({ drinks: [drink("a", t, 3), drink("b", t + MIN, 4), drink("c", t + 2 * MIN, 2)] }),
      start,
      end,
      defaultSettings,
    );
    expect(result?.profileId).toBe("b");
    expect(result?.value).toBeLessThan(defaultSettings.bacCeiling);
  });

  it("Drunkest Sailor ties at the ceiling go to whoever got there first", () => {
    const t = start + 12 * HOUR;
    const result = drunkestSailor(
      data({ drinks: [drink("a", t + 5 * MIN, 20), drink("b", t, 12), drink("c", t + MIN, 30)] }),
      start,
      end,
      defaultSettings,
    );
    expect(result).toMatchObject({ profileId: "b", value: defaultSettings.bacCeiling, at: t });
  });

  it("Drunkest Sailor counts BAC carried over the cutoff, and nobody when nobody drank", () => {
    expect(drunkestSailor(data(), start, end, defaultSettings)).toBeNull();
    const carried = drunkestSailor(data({ drinks: [drink("a", start - 30 * MIN, 4)] }), start, end, defaultSettings);
    expect(carried).toMatchObject({ profileId: "a", at: start });
  });

  it("Fastest Climb is the shortest time from zero to the ceiling", () => {
    const t = start + 10 * HOUR;
    const result = fastestClimb(
      data({
        drinks: [
          // a: 9 standard drinks over two hours.
          drink("a", t, 3), drink("a", t + HOUR, 3), drink("a", t + 2 * HOUR, 3),
          // b: the same over 40 minutes.
          drink("b", t + HOUR, 3), drink("b", t + HOUR + 20 * MIN, 3), drink("b", t + HOUR + 40 * MIN, 3),
          // c never gets there.
          drink("c", t, 2),
        ],
      }),
      start,
      end,
      defaultSettings,
    );
    expect(result).toMatchObject({ profileId: "b", value: 40 });
  });

  it("Fastest Climb only uses the part of each drink under the pace cap", () => {
    const t = start + 10 * HOUR;
    // 12 standard drinks at once would reach the ceiling uncapped; with a cap of 4 it does not.
    const drinks = [drink("a", t, 12)];
    expect(fastestClimb(data({ drinks }), start, end, defaultSettings)?.profileId).toBe("a");
    expect(fastestClimb(data({ drinks }), start, end, { ...defaultSettings, paceCap: 4 })).toBeNull();
  });

  it("Hydro Homie is the most waters; a tie goes to whoever got there first", () => {
    const t = start + 5 * HOUR;
    const water = (profileId: string, at: number) => ({ profileId, at });
    const result = hydroHomie(
      data({
        waters: [
          water("a", t), water("a", t + 3 * HOUR),
          water("b", t + HOUR), water("b", t + 2 * HOUR),
          water("c", t),
          // Before the day started: not counted.
          water("c", start - MIN), water("c", start - 2 * MIN),
        ],
      }),
      start,
      end,
    );
    expect(result).toMatchObject({ profileId: "b", value: 2 });
    expect(hydroHomie(data(), start, end)).toBeNull();
  });

  it("Last Man Standing is the last photo between 1am and the cutoff", () => {
    const post = (profileId: string, at: number) => ({ profileId, at });
    const posts = [
      post("a", end - 4 * HOUR), // midnight: too early
      post("b", end - 2 * HOUR), // 2am
      post("c", end - HOUR), // 3am
      post("a", end + MIN), // after the cutoff: next day
    ];
    expect(lastManStanding(data({ posts }), end, defaultSettings)).toMatchObject({ profileId: "c" });
    expect(lastManStanding(data({ posts: posts.slice(0, 1) }), end, defaultSettings)).toBeNull();
  });
});

describe("hourly awards", () => {
  const hourStart = start + 15 * HOUR;
  const hourEnd = hourStart + HOUR;

  it("needs two different people to have logged in the hour", () => {
    const one = data({ drinks: [drink("a", hourStart + MIN), drink("a", hourStart + 2 * MIN)] });
    expect(hourIsLive(one, hourStart, hourEnd, defaultSettings)).toBe(false);
    const two = data({ drinks: [drink("a", hourStart + MIN)], waters: [{ profileId: "b", at: hourStart + 5 * MIN }] });
    expect(hourIsLive(two, hourStart, hourEnd, defaultSettings)).toBe(true);
    // A drink on the hour belongs to the next hour.
    const edge = data({ drinks: [drink("a", hourStart + MIN), drink("b", hourEnd)] });
    expect(hourIsLive(edge, hourStart, hourEnd, defaultSettings)).toBe(false);
  });

  it("Hour Winner has the most drink points so far that day", () => {
    const entry = (profileId: string, delta: number, at: number) => ({ profileId, delta, at });
    const drinkPoints = [
      entry("a", 9, start + 2 * HOUR), // earlier today: counts
      entry("b", 6, hourStart + MIN),
      entry("b", 4.5, hourStart + 2 * MIN),
      entry("c", 30, start - MIN), // yesterday: does not count
      entry("a", 3, hourEnd + MIN), // next hour: not yet
    ];
    expect(hourWinner(data({ drinkPoints }), start, hourEnd)).toMatchObject({ profileId: "b", value: 10.5 });
    // An hour later a's extra drink ties it up at 12 each?  No: a has 12, b 10.5.
    expect(hourWinner(data({ drinkPoints }), start, hourEnd + HOUR)).toMatchObject({ profileId: "a", value: 12 });
  });

  it("Hour Winner ties go to whoever reached the total first", () => {
    const drinkPoints = [
      { profileId: "a", delta: 6, at: hourStart + 30 * MIN },
      { profileId: "b", delta: 6, at: hourStart + 10 * MIN },
    ];
    expect(hourWinner(data({ drinkPoints }), start, hourEnd)?.profileId).toBe("b");
    expect(hourWinner(data(), start, hourEnd)).toBeNull();
  });

  it("Top BAC of the hour is the highest reached in it, up to the ceiling", () => {
    const drinks = [
      drink("a", hourStart - 3 * HOUR, 5), // high earlier, fading by now
      drink("b", hourStart + 10 * MIN, 4),
      drink("c", hourEnd + MIN, 12), // next hour
    ];
    expect(hourTopBac(data({ drinks }), hourStart, hourEnd, defaultSettings)?.profileId).toBe("b");
    expect(hourTopBac(data({ drinks }), hourEnd, hourEnd + HOUR, defaultSettings)).toMatchObject({
      profileId: "c",
      value: defaultSettings.bacCeiling,
    });
  });
});
