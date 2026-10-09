import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLeaderboard } from "@/lib/leaderboard";
import { mockStore as store } from "@/lib/store/mock";
import type { Profile } from "@/lib/store/types";
import { withDrinkPoints } from "./log";
import {
  buildStatus,
  confirmLastMan,
  lastManCandidates,
  logDrink,
  logWater,
  pointsBySource,
  removeDrink,
  removeWater,
  saveSettings,
  setDrinkOfDay,
  settleDue,
  startHappyHour,
  stopHappyHour,
} from "./service";

const MIN = 60_000;
const HOUR = 60 * MIN;
// 8pm party time on Friday the 9th.
const T = Date.parse("2026-10-10T03:00:00Z");
const beer = { name: "Pacifico", volumeOz: 12, abv: 0.045, alcoholG: 14, category: "beer" };

async function crew(count: number): Promise<Profile[]> {
  const made: Profile[] = [];
  for (let i = 0; i < count; i++) {
    const { profile } = await store.createProfile({
      name: `Sailor ${i + 1}`,
      avatarUrl: null,
      heightCm: 180,
      weightKg: 80,
      sex: "male",
      showBacOnPosts: true,
    });
    made.push(profile);
  }
  return made;
}

const total = async (profileId: string) =>
  (await buildLeaderboard(store, Date.now())).find((entry) => entry.id === profileId)?.points;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(T);
  // A fresh mock store without the demo guests.
  (globalThis as { __mockData?: unknown }).__mockData = undefined;
  for (const profile of await store.listProfiles()) await store.deleteProfile(profile.id);
});

afterEach(() => vi.useRealTimers());

describe("logging", () => {
  it("scores a drink when it is logged and shows the working", async () => {
    const [a] = await crew(1);
    const { drink, entry } = await logDrink(store, a, beer, () => 0);
    expect(entry).toMatchObject({ source: "drink", delta: 3, drinkId: drink.id, reason: "Pacifico", voidedAt: null });
    expect(await total(a.id)).toBe(3);

    const [logged] = withDrinkPoints([drink], await store.listPointEvents(a.id));
    expect(logged).toMatchObject({ points: 3, pointsLine: "1 std × 3 = 3" });
  });

  it("applies water, Happy Hour and Drink of the Day, then spends the water", async () => {
    const [a] = await crew(1);
    await setDrinkOfDay(store, "2026-10-09", { type: "category", value: "beer" });
    await startHappyHour(store, 30);

    expect((await logWater(store, a)).entry?.delta).toBe(1);
    vi.advanceTimersByTime(MIN);
    const first = await logDrink(store, a, beer, () => 0);
    expect(first.entry?.delta).toBe(18);
    expect(first.entry?.breakdown?.multipliers.map((item) => item.label)).toEqual([
      "hydration",
      "Happy Hour",
      "Drink of the Day",
    ]);

    vi.advanceTimersByTime(MIN);
    // The boost is spent, and a cocktail is not the Drink of the Day.
    expect((await logDrink(store, a, { ...beer, name: "Mai Tai", category: "cocktail" }, () => 0)).entry?.delta).toBe(6);

    await stopHappyHour(store);
    vi.advanceTimersByTime(MIN);
    expect((await logDrink(store, a, beer, () => 0)).entry?.delta).toBe(6);
    expect(await total(a.id)).toBe(31);
  });

  it("matches a Drink of the Day by name, ignoring case", async () => {
    const [a] = await crew(1);
    await setDrinkOfDay(store, "2026-10-09", { type: "drink", value: "pacifico" });
    expect((await logDrink(store, a, beer, () => 0)).entry?.delta).toBe(6);
    await setDrinkOfDay(store, "2026-10-09", null);
    vi.advanceTimersByTime(MIN);
    expect((await logDrink(store, a, beer, () => 0)).entry?.delta).toBe(3);
  });

  it("uses the party day, so 2am still gets yesterday's Drink of the Day", async () => {
    const [a] = await crew(1);
    await setDrinkOfDay(store, "2026-10-09", { type: "category", value: "beer" });
    vi.setSystemTime(Date.parse("2026-10-10T09:00:00Z")); // 2am Saturday
    expect((await logDrink(store, a, beer, () => 0)).entry?.delta).toBe(6);
    vi.setSystemTime(Date.parse("2026-10-10T11:30:00Z")); // 4:30am Saturday
    expect((await logDrink(store, a, beer, () => 0)).entry?.delta).toBe(3);
  });

  it("logs a drink over the BAC ceiling for zero points", async () => {
    const [a] = await crew(1);
    await logDrink(store, a, { ...beer, name: "Punch bowl", alcoholG: 14 * 9 }, () => 0);
    vi.advanceTimersByTime(MIN);
    const { entry } = await logDrink(store, a, beer, () => 0);
    expect(entry).toMatchObject({ delta: 0 });
    expect(entry?.breakdown?.paused).toBe(true);
    expect((await store.listDrinks(a.id)).length).toBe(2);
  });

  it("stops paying for water past the hourly limit", async () => {
    const [a] = await crew(1);
    const deltas: number[] = [];
    for (let i = 0; i < 3; i++) {
      deltas.push((await logWater(store, a)).entry?.delta ?? -1);
      vi.advanceTimersByTime(10 * MIN);
    }
    expect(deltas).toEqual([1, 1, 0]);
    vi.advanceTimersByTime(45 * MIN);
    expect((await logWater(store, a)).entry?.delta).toBe(1);
  });

  it("reads edited settings", async () => {
    const [a] = await crew(1);
    await saveSettings(store, { pointsPerDrink: 5 });
    expect((await logDrink(store, a, beer, () => 0)).entry?.delta).toBe(5);
  });
});

describe("deleting", () => {
  it("reverses a drink's points but keeps the entry in the ledger", async () => {
    const [a] = await crew(1);
    const { drink } = await logDrink(store, a, beer, () => 0);
    expect(await removeDrink(store, a.id, drink.id)).toBe(true);
    expect(await removeDrink(store, a.id, drink.id)).toBe(false);
    expect(await total(a.id)).toBe(0);

    const [entry] = await store.listPointEvents(a.id);
    expect(entry.voidedAt).not.toBeNull();
    expect(pointsBySource(await store.listPointEvents(a.id))).toEqual([]);
  });

  it("reverses a water", async () => {
    const [a] = await crew(1);
    const { water } = await logWater(store, a);
    expect(await removeWater(store, a.id, water.id)).toBe(true);
    expect(await total(a.id)).toBe(0);
    // With the water gone the next drink has no boost.
    vi.advanceTimersByTime(MIN);
    expect((await logDrink(store, a, beer, () => 0)).entry?.delta).toBe(3);
  });
});

describe("Cheers", () => {
  const cheersFor = async (profileId: string) =>
    (await store.listPointEvents(profileId)).filter((event) => event.source === "cheers" && !event.voidedAt);

  it("pays everyone when the fourth person logs, and a fifth who joins in time", async () => {
    const people = await crew(6);
    const drinks = [];
    for (const person of people.slice(0, 4)) {
      drinks.push((await logDrink(store, person, beer, () => 0)).drink);
      vi.advanceTimersByTime(MIN);
    }
    for (const person of people.slice(0, 4)) {
      expect(await cheersFor(person.id)).toHaveLength(1);
      expect(await total(person.id)).toBe(6);
    }

    await logDrink(store, people[4], beer, () => 0);
    expect(await cheersFor(people[4].id)).toHaveLength(1);
    // A second drink in the same round is not a second Cheers.
    vi.advanceTimersByTime(MIN / 2);
    await logDrink(store, people[0], beer, () => 0);
    expect(await cheersFor(people[0].id)).toHaveLength(1);

    // Too late for the sixth.
    vi.advanceTimersByTime(6 * MIN);
    await logDrink(store, people[5], beer, () => 0);
    expect(await cheersFor(people[5].id)).toHaveLength(0);

    const status = await buildStatus(store, Date.now());
    const cheers = status.dispatches.filter((item) => item.text === "Cheers");
    expect(cheers).toHaveLength(1);
    expect(cheers[0].profileName.split(", ")).toHaveLength(5);
  });

  it("takes the whole Cheers back when a delete leaves it short", async () => {
    const people = await crew(5);
    const drinks = [];
    for (const person of people) {
      drinks.push((await logDrink(store, person, beer, () => 0)).drink);
      vi.advanceTimersByTime(30_000);
    }
    // Five in it: losing one still leaves four.
    await removeDrink(store, people[4].id, drinks[4].id);
    expect(await cheersFor(people[0].id)).toHaveLength(1);
    expect(await total(people[4].id)).toBe(0);

    await removeDrink(store, people[3].id, drinks[3].id);
    for (const person of people.slice(0, 3)) {
      expect(await cheersFor(person.id)).toHaveLength(0);
      expect(await total(person.id)).toBe(3);
    }
  });
});

describe("settling awards", () => {
  it("pays an hour once, however many times it is asked", async () => {
    const [a, b] = await crew(2);
    await logDrink(store, a, beer, () => 0);
    vi.advanceTimersByTime(5 * MIN);
    await logDrink(store, a, beer, () => 0);
    vi.advanceTimersByTime(5 * MIN);
    await logDrink(store, b, beer, () => 0);

    expect(await settleDue(store, Date.now(), true)).toBe(0); // the hour is still running
    vi.setSystemTime(T + HOUR + MIN);
    expect(await settleDue(store, Date.now(), true)).toBe(2);
    expect(await settleDue(store, Date.now(), true)).toBe(0);

    const hourly = (await store.listPointEvents()).filter((event) => event.source === "hourly");
    expect(hourly.map((event) => [event.profileId, event.delta]).sort()).toEqual(
      [
        [a.id, 1],
        [a.id, 1],
      ].sort(),
    );
    expect(hourly[0].createdAt).toBe(new Date(T + HOUR).toISOString());
    expect(hourly.map((event) => event.reason).sort()[0]).toBe("Hour Winner · 8 PM · 6 drink pts today");
    expect(await total(a.id)).toBe(8);
  });

  it("gives no Hour Winner to a leader who logged a single drink that hour", async () => {
    const [a, b] = await crew(2);
    await logDrink(store, a, { ...beer, alcoholG: 28 }, () => 0);
    vi.advanceTimersByTime(10 * MIN);
    await logDrink(store, b, beer, () => 0);
    vi.setSystemTime(T + HOUR + MIN);
    await settleDue(store, Date.now(), true);
    const first = (await store.listPointEvents()).filter((event) => event.source === "hourly");
    // Top BAC of the hour still pays; the lead is not handed to the runner-up.
    expect(first.map((event) => event.reason?.split(" · ")[0])).toEqual(["Top BAC of the hour"]);

    // Next hour the same leader logs two, and collects.
    await logDrink(store, a, beer, () => 0);
    vi.advanceTimersByTime(5 * MIN);
    await logDrink(store, a, beer, () => 0);
    await logDrink(store, b, beer, () => 0);
    vi.setSystemTime(T + 2 * HOUR + MIN);
    await settleDue(store, Date.now(), true);
    const winners = (await store.listPointEvents()).filter((event) => event.reason?.startsWith("Hour Winner"));
    expect(winners).toMatchObject([{ profileId: a.id, delta: 1 }]);

    // The threshold is a setting.
    await saveSettings(store, { hourWinnerMinDrinks: 3, hourWinnerPoints: 4 });
    await logDrink(store, a, beer, () => 0);
    await logDrink(store, a, beer, () => 0);
    await logDrink(store, b, beer, () => 0);
    vi.setSystemTime(T + 3 * HOUR + MIN);
    await settleDue(store, Date.now(), true);
    expect((await store.listPointEvents()).filter((event) => event.reason?.startsWith("Hour Winner"))).toHaveLength(1);
  });

  it("skips an hour in which only one person logged", async () => {
    const [a] = await crew(1);
    await logDrink(store, a, beer, () => 0);
    vi.setSystemTime(T + HOUR + MIN);
    expect(await settleDue(store, Date.now(), true)).toBe(0);
  });

  it("pays the day's awards after the 4am cutoff, not before", async () => {
    const [a, b] = await crew(2);
    await logDrink(store, a, { ...beer, alcoholG: 14 * 3 }, () => 0);
    await logWater(store, b);
    vi.advanceTimersByTime(2 * HOUR);
    await logDrink(store, b, beer, () => 0);

    vi.setSystemTime(Date.parse("2026-10-10T10:59:00Z")); // 3:59am
    await settleDue(store, Date.now(), true);
    const before = (await store.listPointEvents()).filter((event) => event.source === "award");
    expect(before).toHaveLength(0);

    vi.setSystemTime(Date.parse("2026-10-10T11:01:00Z")); // 4:01am
    await settleDue(store, Date.now(), true);
    expect(await settleDue(store, Date.now(), true)).toBe(0);
    const awards = (await store.listPointEvents()).filter((event) => event.source === "award");
    const won = (text: string) => awards.find((event) => event.reason?.startsWith(text));
    expect(won("Smooth Sailing")).toMatchObject({ profileId: a.id, delta: 15, awardKey: "day:2026-10-09:smooth" });
    expect(won("Drunkest Sailor")).toMatchObject({ profileId: a.id, delta: 10 });
    expect(won("Landlubber (Hydro Homie)")).toMatchObject({ profileId: b.id, delta: 5, reason: "Landlubber (Hydro Homie) · 1 water" });
    // Nobody reached the ceiling, so there is no Fastest Climb.
    expect(won("Fastest Climb")).toBeUndefined();
    expect(awards.every((event) => event.createdAt === "2026-10-10T11:00:00.000Z")).toBe(true);
  });

  it("holds Last Man Standing until an admin confirms it, and pays it once", async () => {
    const [a, b] = await crew(2);
    const post = { url: "x", mediaType: "image" as const, caption: null, bacAtPost: null, lat: null, lng: null, locationSource: null, eventId: null };
    vi.setSystemTime(Date.parse("2026-10-10T08:30:00Z")); // 1:30am
    await store.createPost({ ...post, profileId: a.id });
    vi.setSystemTime(Date.parse("2026-10-10T09:41:00Z")); // 2:41am
    await store.createPost({ ...post, profileId: b.id });

    expect(await confirmLastMan(store, "2026-10-09")).toBeNull(); // the day has not ended
    vi.setSystemTime(Date.parse("2026-10-10T17:00:00Z"));
    await settleDue(store, Date.now(), true);
    expect(await total(b.id)).toBe(0);

    const [candidate] = await lastManCandidates(store, Date.now());
    expect(candidate).toMatchObject({ day: "2026-10-09", profileId: b.id, time: "2:41 AM", confirmed: false });

    expect(await confirmLastMan(store, "2026-10-09")).toMatchObject({ profileId: b.id, delta: 10 });
    expect(await confirmLastMan(store, "2026-10-09")).toBeNull();
    expect((await lastManCandidates(store, Date.now()))[0].confirmed).toBe(true);
    expect(await total(b.id)).toBe(10);
  });
});

describe("status", () => {
  it("reports the running Happy Hour and today's Drink of the Day", async () => {
    await setDrinkOfDay(store, "2026-10-09", { type: "drink", value: "Mai Tai" });
    await startHappyHour(store, 30);
    const status = await buildStatus(store, Date.now());
    expect(status).toMatchObject({
      bacCeiling: 0.18,
      happyHour: { endsAt: new Date(T + 30 * MIN).toISOString(), multiplier: 2 },
      drinkOfDay: { type: "drink", value: "Mai Tai", multiplier: 2 },
    });
    expect((await buildStatus(store, T + 31 * MIN)).happyHour).toBeNull();
  });
});
