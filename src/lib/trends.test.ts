import { describe, expect, it } from "vitest";
import type { DrinkLog, PointEvent, Profile, Store } from "./store/types";
import { buildTrends } from "./trends";

const now = Date.parse("2026-10-09T22:00:00-07:00");
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

const profile = (id: string): Profile => ({
  id,
  name: id,
  avatarUrl: null,
  heightCm: 180,
  weightKg: 80,
  sex: "male",
  showBacOnPosts: true,
  hasPassword: true,
  mustChangePassword: false,
  sessionVersion: 1,
  createdAt: ago(600),
});
const drink = (profileId: string, minutes: number): DrinkLog => ({
  id: `${profileId}-${minutes}`,
  profileId,
  name: "Beer",
  volumeOz: null,
  abv: null,
  alcoholG: 14,
  category: null,
  consumedAt: ago(minutes),
});
const points = (profileId: string, delta: number, minutes: number): PointEvent => ({
  id: `${profileId}-${delta}`,
  profileId,
  delta,
  reason: null,
  challengeId: null,
  source: "admin",
  breakdown: null,
  drinkId: null,
  groupId: null,
  awardKey: null,
  voidedAt: null,
  createdAt: ago(minutes),
});

const store = {
  listProfiles: async () => [profile("a"), profile("b")],
  listAllDrinks: async () => [drink("a", 120), drink("a", 60), drink("b", 30)],
  listPointEvents: async () => [points("a", 25, 90), points("a", -5, 10), points("b", 40, 45)],
} as unknown as Store;

describe("buildTrends", () => {
  it("samples from before the first activity until now", async () => {
    const { times, players } = await buildTrends(store, now);
    expect(times.at(-1)).toBe(now);
    expect(times[0]).toBeLessThan(now - 120 * 60_000);
    expect(times.length).toBeLessThanOrEqual(150);
    expect([...times].sort((x, y) => x - y)).toEqual(times);
    for (const player of players) {
      expect(player.points).toHaveLength(times.length);
      expect(player.points[0]).toBe(0);
      expect(player.drinks[0]).toBe(0);
      expect(player.bac[0]).toBe(0);
    }
  });

  it("ends on the current totals", async () => {
    const { players } = await buildTrends(store, now);
    const [a, b] = players;
    expect([a.points.at(-1), a.drinks.at(-1)]).toEqual([20, 2]);
    expect([b.points.at(-1), b.drinks.at(-1)]).toEqual([40, 1]);
    expect(a.points).toContain(25);
    expect(a.bac.at(-1)).toBeGreaterThan(0);
    expect(Math.max(...a.bac)).toBeGreaterThan(a.bac.at(-1)!);
  });

  it("handles an empty party", async () => {
    const empty = {
      listProfiles: async () => [profile("a")],
      listAllDrinks: async () => [],
      listPointEvents: async () => [],
    } as unknown as Store;
    const { times, players } = await buildTrends(empty, now);
    expect(times.at(-1)).toBe(now);
    expect(players[0].points.every((value) => value === 0)).toBe(true);
  });
});
