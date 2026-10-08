import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLeaderboard } from "@/lib/leaderboard";
import { defaultSettings } from "@/lib/points/settings";
import { saveSettings } from "@/lib/points/settings-store";
import { logDrink, logWater, removeDrink } from "@/lib/points/service";
import { mockStore as store } from "@/lib/store/mock";
import type { Profile } from "@/lib/store/types";
import { assignDrinks, currentAssignment, pickDrink } from "./bartender";
import { buildBoard, buildMe, listFeedLines, markNoticesSeen } from "./board";
import { balance } from "./common";
import { castCurse, displayStore, revertCurse } from "./curses";
import { claimGroomTax, setGroomId, voidGroomTax, listGroomTaxes } from "./groom";
import { SLOT_OUTCOMES, drawSlot, slotOdds } from "./slot";
import { reportPlayer, upvote } from "./snitch";
import { answer, challenge, placeSideBet, report, resolve, sideBetPayouts, voidWager } from "./wagers";

const MIN = 60_000;
const T = Date.parse("2026-10-10T03:00:00Z"); // 8pm party time, Friday the 9th
const beer = { name: "Pacifico", volumeOz: 12, abv: 0.045, alcoholG: 14, category: "beer" };

// Where each outcome sits on the default wheel: 1× 0–55, 2× –70, 3× –75, Bust –87, Jackpot –89, Rob –95, Forward –100.
const roll = { one: 0, two: 0.6, three: 0.72, bust: 0.8, jackpot: 0.88, rob: 0.9, forward: 0.97 };
const always = (value: number) => () => value;

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

const give = (profile: Profile, delta: number) =>
  store.addPointEvent({ profileId: profile.id, delta, reason: "Test", challengeId: null });
const notices = async (profile: Profile) => (await buildMe(store, profile)).notices.map((notice) => notice.text);
const lines = async () => (await listFeedLines(store)).map((line) => line.text);
const photo = (profile: Profile) =>
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
  });

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(T);
  (globalThis as { __mockData?: unknown }).__mockData = undefined;
  for (const profile of await store.listProfiles()) await store.deleteProfile(profile.id);
});

afterEach(() => vi.useRealTimers());

describe("slot machine odds", () => {
  it("default odds total 100 and land where the wheel says", () => {
    expect(slotOdds(defaultSettings).reduce((sum, [, weight]) => sum + weight, 0)).toBe(100);
    expect(Object.values(roll).map((value) => drawSlot(value, defaultSettings))).toEqual([...SLOT_OUTCOMES]);
    expect(drawSlot(0.5499, defaultSettings)).toBe("1x");
    expect(drawSlot(0.55, defaultSettings)).toBe("2x");
    expect(drawSlot(0.9999, defaultSettings)).toBe("forward");
  });

  it("matches the odds over many draws", () => {
    const counts: Record<string, number> = {};
    const draws = 100_000;
    for (let i = 0; i < draws; i++) {
      const outcome = drawSlot((i + 0.5) / draws, defaultSettings);
      counts[outcome] = (counts[outcome] ?? 0) + 1;
    }
    for (const [outcome, weight] of slotOdds(defaultSettings)) {
      expect(counts[outcome] / draws).toBeCloseTo(weight / 100, 3);
    }
  });

  it("rerolls excluded outcomes across the rest", () => {
    for (let i = 0; i < 1000; i++) {
      expect(["rob", "forward"]).not.toContain(drawSlot(i / 1000, defaultSettings, ["rob", "forward"]));
    }
    // With Rob and Forward out, 1× is 55 of the remaining 89.
    expect(drawSlot(0.61, defaultSettings, ["rob", "forward"])).toBe("1x");
    expect(drawSlot(0.62, defaultSettings, ["rob", "forward"])).toBe("2x");
    expect(drawSlot(0.5, { ...defaultSettings, slotOdds1x: 0, slotOdds2x: 0, slotOdds3x: 0, slotOddsBust: 0, slotOddsJackpot: 0, slotOddsForward: 0, slotOddsRob: 100 }, ["rob"])).toBe("1x");
  });
});

describe("slot machine on a drink", () => {
  it("multiplies, busts and pays the jackpot", async () => {
    const [a] = await crew(1);
    expect((await logDrink(store, a, beer, always(roll.one))).entry?.delta).toBe(3);
    vi.advanceTimersByTime(MIN);
    const triple = await logDrink(store, a, beer, always(roll.three));
    expect(triple.slot).toEqual({ outcome: "3x", forShow: false });
    expect(triple.entry?.delta).toBe(9);
    expect(triple.entry?.breakdown).toMatchObject({ slot: "3x", multipliers: [{ label: "slot 3×", factor: 3 }] });
    vi.advanceTimersByTime(MIN);
    expect((await logDrink(store, a, beer, always(roll.bust))).entry?.delta).toBe(1.5);
    vi.advanceTimersByTime(MIN);

    const jackpot = await logDrink(store, a, beer, always(roll.jackpot));
    expect(jackpot.entry?.delta).toBe(3);
    expect(await balance(store, a.id)).toBe(3 + 9 + 1.5 + 3 + 15);
    expect(await lines()).toEqual(["Sailor 1 hit JACKPOT", "Sailor 1 hit BUST", "Sailor 1 hit 3×"]);

    // Deleting the drink takes the jackpot back with it.
    await removeDrink(store, a.id, jackpot.drink.id);
    expect(await balance(store, a.id)).toBe(13.5);
  });

  it("keeps slot multipliers under the maximum combined multiplier", async () => {
    const [a] = await crew(1);
    await saveSettings(store, { maxMultiplier: 4 });
    await logWater(store, a);
    vi.advanceTimersByTime(MIN);
    // 1.5 hydration × 3 slot = 4.5, held to 4.
    expect((await logDrink(store, a, beer, always(roll.three))).entry?.delta).toBe(12);
  });

  it("Rob the Leader takes from first place, at most what they have, and never from yourself", async () => {
    const [a, b] = await crew(2);
    await give(b, 2);
    const robbed = await logDrink(store, a, beer, always(roll.rob));
    expect(robbed.slot?.outcome).toBe("rob");
    expect(await balance(store, a.id)).toBe(5);
    expect(await balance(store, b.id)).toBe(0);
    expect(await notices(b)).toEqual(["Sailor 1 hit Rob the Leader and took 2 from you."]);

    // Now a leads, so the same roll is rerolled into something else.
    vi.advanceTimersByTime(MIN);
    expect((await logDrink(store, a, beer, always(roll.rob))).slot?.outcome).not.toBe("rob");

    await removeDrink(store, a.id, robbed.drink.id);
    expect(await balance(store, b.id)).toBe(2);
  });

  it("Pay It Forward gives the drink's points to another active player", async () => {
    const [a, b, c] = await crew(3);
    // Nobody else is active yet: rerolled.
    expect((await logDrink(store, a, beer, always(roll.forward))).slot?.outcome).not.toBe("forward");
    await logWater(store, b);
    vi.advanceTimersByTime(MIN);

    const forwarded = await logDrink(store, a, beer, always(roll.forward));
    expect(forwarded.slot?.outcome).toBe("forward");
    expect(forwarded.entry).toMatchObject({ delta: 0 });
    expect(forwarded.entry?.breakdown?.note).toBe("paid forward to Sailor 2");
    // b had a water (+1) and now the 3 from a's drink.
    expect(await balance(store, b.id)).toBe(1 + 3);
    expect(await balance(store, c.id)).toBe(0);
  });

  it("spins for show only when the drink earns nothing", async () => {
    const [a, b] = await crew(2);
    await give(b, 20);
    await saveSettings(store, { paceCap: 1 });
    await logDrink(store, a, beer, always(roll.one));
    vi.advanceTimersByTime(MIN);
    const over = await logDrink(store, a, beer, always(roll.jackpot));
    expect(over.slot).toEqual({ outcome: "jackpot", forShow: true });
    expect(await balance(store, a.id)).toBe(3);
    vi.advanceTimersByTime(MIN);
    expect((await logDrink(store, a, beer, always(roll.rob))).slot?.forShow).toBe(true);
    expect(await balance(store, b.id)).toBe(20);
  });

  it("reuses a deleted drink's spin instead of drawing again", async () => {
    const [a] = await crew(1);
    const bust = await logDrink(store, a, beer, always(roll.bust));
    await removeDrink(store, a.id, bust.drink.id);
    vi.advanceTimersByTime(5 * MIN);
    // The roll says 3×, but the Bust is remembered.
    expect((await logDrink(store, a, beer, always(roll.three))).slot?.outcome).toBe("bust");
    // Only once.
    vi.advanceTimersByTime(MIN);
    const next = await logDrink(store, a, beer, always(roll.three));
    expect(next.slot?.outcome).toBe("3x");

    await removeDrink(store, a.id, next.drink.id);
    vi.advanceTimersByTime(11 * MIN);
    // Too long ago: a fresh spin.
    expect((await logDrink(store, a, beer, always(roll.one))).slot?.outcome).toBe("1x");
  });
});

describe("Bartender's Choice", () => {
  it("is weighted, and always a catalogue drink", () => {
    expect(pickDrink(0).name).toBeTruthy();
    expect(pickDrink(0.999999).name).toBeTruthy();
  });

  it("assigns active players a drink worth 3× within the hour", async () => {
    const [a, b, c] = await crew(3);
    await logWater(store, a);
    await logWater(store, b);
    expect(await assignDrinks(store, Date.now(), always(0))).toBe(2);
    expect(await currentAssignment(store, c.id)).toBeNull();

    const order = await currentAssignment(store, a.id);
    expect(order).toMatchObject({ multiplier: 3, expiresAt: new Date(T + 60 * MIN).toISOString() });
    expect((await notices(a))[0]).toContain(`Bartender's Choice: log a ${order!.name}`);

    vi.advanceTimersByTime(10 * MIN);
    // Something else doesn't count, and doesn't use the order up.
    const wrong = await logDrink(store, a, { ...beer, name: "Not that" }, always(roll.one));
    expect(wrong.entry?.breakdown?.multipliers.map((item) => item.label)).toEqual(["hydration"]);
    vi.advanceTimersByTime(MIN);
    const right = await logDrink(store, a, { ...beer, name: order!.name.toUpperCase() }, always(roll.one));
    expect(right.entry?.delta).toBe(9);
    expect(right.entry?.breakdown?.multipliers).toEqual([{ label: "Bartender's Choice", factor: 3 }]);
    expect(await currentAssignment(store, a.id)).toBeNull();

    // b lets it run out.
    vi.advanceTimersByTime(60 * MIN);
    expect(await currentAssignment(store, b.id)).toBeNull();
    expect((await logDrink(store, b, { ...beer, name: order!.name }, always(roll.one))).entry?.breakdown?.multipliers).toEqual([
      { label: "hydration", factor: 1.5 },
    ]);
  });
});

describe("Groom Tax", () => {
  it("doubles the player's drink and pays the groom when the photo is in time", async () => {
    const [groom, player, other] = await crew(3);
    await expect(claimGroomTax(store, player, player.id, await photo(player))).rejects.toThrow("No groom has been set");
    await setGroomId(store, groom.id);

    await logDrink(store, groom, beer, always(roll.one));
    vi.advanceTimersByTime(90_000);
    const drink = await logDrink(store, player, { ...beer, alcoholG: 28 }, always(roll.two));
    expect(drink.entry?.delta).toBe(12);

    await expect(claimGroomTax(store, other, player.id, await photo(other))).rejects.toThrow("Only the groom or the player");
    await expect(claimGroomTax(store, groom, groom.id, await photo(groom))).rejects.toThrow("can't tax himself");

    vi.advanceTimersByTime(5 * MIN);
    await claimGroomTax(store, groom, player.id, await photo(groom));
    expect(await balance(store, player.id)).toBe(24);
    expect(await balance(store, groom.id)).toBe(3 + 1);
    expect(await lines()).toContain("Groom Tax: Sailor 2 drank with the groom");
    // The same drink can't be taxed twice.
    await expect(claimGroomTax(store, player, player.id, await photo(player))).rejects.toThrow("No Groom Tax");

    const [tax] = await listGroomTaxes(store);
    expect(await voidGroomTax(store, tax.id)).toBe(true);
    expect(await voidGroomTax(store, tax.id)).toBe(false);
    expect(await balance(store, player.id)).toBe(12);
    expect(await balance(store, groom.id)).toBe(3);
  });

  it("needs the drinks close together and the photo soon after", async () => {
    const [groom, player] = await crew(2);
    await setGroomId(store, groom.id);
    await logDrink(store, groom, beer, always(roll.one));
    vi.advanceTimersByTime(3 * MIN);
    await logDrink(store, player, beer, always(roll.one));
    await expect(claimGroomTax(store, player, player.id, await photo(player))).rejects.toThrow("within 2 minutes");

    vi.advanceTimersByTime(MIN);
    await logDrink(store, groom, beer, always(roll.one));
    vi.advanceTimersByTime(11 * MIN);
    await expect(claimGroomTax(store, player, player.id, await photo(player))).rejects.toThrow("the photo within 10");
  });

  it("is reversed when the taxed drink is deleted", async () => {
    const [groom, player] = await crew(2);
    await setGroomId(store, groom.id);
    await logDrink(store, groom, beer, always(roll.one));
    const { drink } = await logDrink(store, player, beer, always(roll.one));
    await claimGroomTax(store, player, player.id, await photo(player));
    expect(await balance(store, player.id)).toBe(6);
    await removeDrink(store, player.id, drink.id);
    expect(await balance(store, player.id)).toBe(0);
  });
});

describe("curses", () => {
  it("costs points, and nobody can spend below zero", async () => {
    const [a, b] = await crew(2);
    await give(a, 7);
    await expect(castCurse(store, a, { type: "deadweight", targetId: b.id })).rejects.toThrow("enough points");
    await expect(castCurse(store, a, { type: "avatar", targetId: a.id })).rejects.toThrow("can't curse yourself");
    expect(await castCurse(store, a, { type: "avatar", targetId: b.id, value: (await photo(a)).id })).toBe("cast");
    expect(await balance(store, a.id)).toBe(1);
    expect(await notices(b)).toEqual(["Sailor 1 cursed you: Avatar Swap."]);
  });

  it("Name Hijack and Avatar Swap change what everyone else sees, then wear off", async () => {
    const [a, b] = await crew(2);
    await give(a, 30);
    await expect(castCurse(store, a, { type: "name", targetId: b.id, value: "x".repeat(25) })).rejects.toThrow("1–24 characters");
    await castCurse(store, a, { type: "name", targetId: b.id, value: "Captain Clown" });
    await castCurse(store, a, { type: "avatar", targetId: b.id, value: (await photo(a)).id });
    await expect(castCurse(store, a, { type: "name", targetId: b.id, value: "Again" })).rejects.toThrow("already has a Name Hijack");

    const seen = async () => (await buildLeaderboard(displayStore(store))).find((entry) => entry.id === b.id);
    // The preview, never the original file.
    expect(await seen()).toMatchObject({ name: "Captain Clown", avatarUrl: "https://example.test/preview.jpg" });
    expect((await store.getProfile(b.id))?.name).toBe("Sailor 2");
    expect((await buildBoard(store, a.id)).people.map((person) => person.name)).toContain("Captain Clown");

    // The name lasts two hours; the avatar until midnight party time (four hours from 8pm).
    vi.advanceTimersByTime(121 * MIN);
    expect(await seen()).toMatchObject({ name: "Sailor 2", avatarUrl: "https://example.test/preview.jpg" });
    vi.advanceTimersByTime(120 * MIN);
    expect(await seen()).toMatchObject({ name: "Sailor 2", avatarUrl: null });
  });

  it("an admin can revert a curse", async () => {
    const [a, b] = await crew(2);
    await give(a, 30);
    await castCurse(store, a, { type: "name", targetId: b.id, value: "Barnacle" });
    const [curse] = (await buildBoard(store, null)).curses;
    expect(curse).toMatchObject({ name: "Name Hijack", target: "Sailor 2", from: "Sailor 1" });
    expect(await revertCurse(store, curse.id)).toBe(true);
    expect((await displayStore(store).listProfiles()).find((profile) => profile.id === b.id)?.name).toBe("Sailor 2");
    expect(await balance(store, a.id)).toBe(20);
  });

  it("Dead Weight zeroes the next drink only: no spin, no Cheers", async () => {
    const [a, b] = await crew(2);
    await give(a, 8);
    await saveSettings(store, { cheersMinPeople: 2 });
    await castCurse(store, a, { type: "deadweight", targetId: b.id });
    await logDrink(store, a, beer, always(roll.one));

    const dead = await logDrink(store, b, beer, always(roll.jackpot));
    expect(dead.slot).toBeNull();
    expect(dead.entry).toMatchObject({ delta: 0 });
    expect(dead.entry?.breakdown?.note).toBe("Dead Weight");
    expect(await balance(store, b.id)).toBe(0);

    vi.advanceTimersByTime(MIN);
    expect((await logDrink(store, b, beer, always(roll.one))).entry?.delta).toBe(3);
  });

  it("a Shield blocks the next curse, and the curser still pays", async () => {
    const [a, b] = await crew(2);
    await give(a, 20);
    await give(b, 5);
    expect(await castCurse(store, b, { type: "shield", targetId: "" })).toBe("cast");
    await expect(castCurse(store, b, { type: "shield", targetId: "" })).rejects.toThrow("already have a Shield");
    // Shields are private: not on the board.
    expect((await buildBoard(store, a.id)).curses).toEqual([]);
    expect((await buildMe(store, b)).curses.map((curse) => curse.name)).toEqual(["Shield"]);

    expect(await castCurse(store, a, { type: "name", targetId: b.id, value: "Nope" })).toBe("blocked");
    expect(await balance(store, a.id)).toBe(10);
    expect((await displayStore(store).listProfiles()).find((profile) => profile.id === b.id)?.name).toBe("Sailor 2");
    expect((await notices(b))[0]).toBe("Your Shield blocked a Name Hijack from Sailor 1.");

    // The Shield is spent.
    expect(await castCurse(store, a, { type: "name", targetId: b.id, value: "Yep" })).toBe("cast");
  });
});

describe("wagers", () => {
  it("splits the side pot among the winning side in proportion to stakes", () => {
    const bets = [
      { profileId: "x", side: "a", stake: 10 },
      { profileId: "y", side: "a", stake: 5 },
      { profileId: "z", side: "b", stake: 6 },
    ];
    expect(Object.fromEntries(sideBetPayouts(bets, "a"))).toEqual({ x: 14, y: 7 });
    expect(Object.fromEntries(sideBetPayouts(bets, "b"))).toEqual({ z: 21 });
    // Nobody backed the winner: stakes go back.
    expect(Object.fromEntries(sideBetPayouts(bets.slice(0, 2), "b"))).toEqual({ x: 10, y: 5 });
    // Nobody backed the loser: winners just get their own stake.
    expect(Object.fromEntries(sideBetPayouts(bets.slice(0, 2), "a"))).toEqual({ x: 10, y: 5 });
    expect(sideBetPayouts([], "a").size).toBe(0);
  });

  it("runs from challenge to payout, holding stakes on the way", async () => {
    const [a, b, c, d] = await crew(4);
    for (const person of [a, b, c, d]) await give(person, 20);

    await expect(challenge(store, a, { opponentId: a.id, stake: 5, description: "x" })).rejects.toThrow("someone else");
    await expect(challenge(store, a, { opponentId: b.id, stake: 21, description: "x" })).rejects.toThrow("enough points");
    await expect(challenge(store, a, { opponentId: b.id, stake: 2.5, description: "x" })).rejects.toThrow("whole number");
    await challenge(store, a, { opponentId: b.id, stake: 10, description: "Beer pong" });
    await expect(challenge(store, a, { opponentId: b.id, stake: 1, description: "Another" })).rejects.toThrow("hasn't answered");
    expect(await notices(b)).toEqual(["Sailor 1 challenged you for 10: Beer pong"]);

    const [pending] = (await buildBoard(store, c.id)).wagers;
    expect(pending).toMatchObject({ status: "pending", stake: 10, description: "Beer pong" });
    // Nothing is held, and no side bets, until it is accepted.
    expect(await balance(store, a.id)).toBe(20);
    await expect(placeSideBet(store, c, pending.id, a.id, 5)).rejects.toThrow("closed");
    await expect(answer(store, c, pending.id, true)).rejects.toThrow("Only the person challenged");

    await answer(store, b, pending.id, true);
    await answer(store, b, pending.id, true).catch(() => {});
    expect(await balance(store, a.id)).toBe(10);
    expect(await balance(store, b.id)).toBe(10);

    await expect(placeSideBet(store, a, pending.id, a.id, 5)).rejects.toThrow("You're in this wager");
    await placeSideBet(store, c, pending.id, a.id, 10);
    await placeSideBet(store, d, pending.id, b.id, 5);
    await expect(placeSideBet(store, c, pending.id, b.id, 1)).rejects.toThrow("other side");
    await expect(placeSideBet(store, d, pending.id, b.id, 16)).rejects.toThrow("enough points");
    expect((await buildBoard(store, c.id)).wagers[0]).toMatchObject({
      status: "accepted",
      sidePots: { [a.id]: 10, [b.id]: 5 },
      mySide: { side: a.id, stake: 10 },
    });

    await expect(report(store, c, pending.id, a.id)).rejects.toThrow("Only the two players");
    await report(store, a, pending.id, a.id);
    // Side bets close at the first report.
    await expect(placeSideBet(store, d, pending.id, b.id, 1)).rejects.toThrow("closed");
    await report(store, b, pending.id, a.id);

    expect(await balance(store, a.id)).toBe(30);
    expect(await balance(store, b.id)).toBe(10);
    expect(await balance(store, c.id)).toBe(25);
    expect(await balance(store, d.id)).toBe(15);
    expect((await buildBoard(store, c.id)).wagers[0]).toMatchObject({ status: "settled", winnerId: a.id });
    expect(await lines()).toContain("Sailor 1 won 10 off Sailor 2: Beer pong");
  });

  it("can be declined, withdrawn, or left to expire, with nothing held", async () => {
    const [a, b] = await crew(2);
    await give(a, 20);
    await give(b, 20);
    await challenge(store, a, { opponentId: b.id, stake: 5, description: "First" });
    await answer(store, b, (await buildBoard(store, null)).wagers[0].id, false);
    expect((await buildBoard(store, null)).wagers).toEqual([]);

    await challenge(store, a, { opponentId: b.id, stake: 5, description: "Second" });
    await answer(store, a, (await buildBoard(store, null)).wagers[0].id, false);
    expect((await notices(b))[0]).toBe("Sailor 1 withdrew the wager: Second");

    await challenge(store, a, { opponentId: b.id, stake: 5, description: "Third" });
    const { id } = (await buildBoard(store, null)).wagers[0];
    vi.advanceTimersByTime(61 * MIN);
    expect((await buildBoard(store, null)).wagers).toEqual([]);
    await expect(answer(store, b, id, true)).rejects.toThrow("no longer open");
    // An expired challenge doesn't block a new one.
    await challenge(store, a, { opponentId: b.id, stake: 5, description: "Fourth" });
    expect(await balance(store, a.id)).toBe(20);
  });

  it("sends a disagreement to Admin, who can pick a winner or call it off", async () => {
    const [a, b, c] = await crew(3);
    for (const person of [a, b, c]) await give(person, 20);
    const open = async (description: string) => {
      await challenge(store, a, { opponentId: b.id, stake: 10, description });
      const { id } = (await buildBoard(store, null)).wagers.find((wager) => wager.description === description)!;
      await answer(store, b, id, true);
      await placeSideBet(store, c, id, b.id, 4);
      await report(store, a, id, a.id);
      await report(store, b, id, b.id);
      return id;
    };

    const first = await open("Arm wrestle");
    expect((await buildBoard(store, null)).wagers[0].status).toBe("disputed");
    expect(await balance(store, a.id)).toBe(10);
    expect(await voidWager(store, first)).toBe(true);
    expect(await voidWager(store, first)).toBe(false);
    expect([await balance(store, a.id), await balance(store, b.id), await balance(store, c.id)]).toEqual([20, 20, 20]);

    const second = await open("Rematch");
    expect(await resolve(store, second, b.id)).toBe(true);
    expect(await resolve(store, second, a.id)).toBe(false);
    expect([await balance(store, a.id), await balance(store, b.id), await balance(store, c.id)]).toEqual([10, 30, 20]);
  });
});

describe("Snitch Line", () => {
  it("pays out when two other players upvote in time", async () => {
    const [reporter, accused, v1, v2] = await crew(4);
    const post = await photo(reporter);
    await expect(reportPlayer(store, reporter, { accusedId: reporter.id, reason: "x", postId: post.id })).rejects.toThrow("someone else");
    await expect(reportPlayer(store, reporter, { accusedId: accused.id, reason: "x", postId: "nope" })).rejects.toThrow("Attach a photo");
    await reportPlayer(store, reporter, { accusedId: accused.id, reason: "Poured one out", postId: post.id });
    await expect(reportPlayer(store, reporter, { accusedId: v1.id, reason: "y", postId: post.id })).rejects.toThrow("One at a time");

    const [open] = (await buildBoard(store, v1.id)).reports;
    expect(open).toMatchObject({ reason: "Poured one out", votes: 0, needed: 2, voted: false, photoUrl: "https://example.test/preview.jpg" });
    await expect(upvote(store, reporter, open.id)).rejects.toThrow("don't get a vote");
    await expect(upvote(store, accused, open.id)).rejects.toThrow("don't get a vote");

    await upvote(store, v1, open.id);
    await upvote(store, v1, open.id);
    expect((await buildBoard(store, v1.id)).reports[0]).toMatchObject({ votes: 1, voted: true });
    expect(await balance(store, accused.id)).toBe(0);

    await upvote(store, v2, open.id);
    expect(await balance(store, accused.id)).toBe(-5);
    expect(await balance(store, reporter.id)).toBe(3);
    expect((await buildBoard(store, v1.id)).reports).toEqual([]);
    expect(await lines()).toContain("Sailor 2 was snitched on: Poured one out");
  });

  it("expires without enough votes", async () => {
    const [reporter, accused, v1, v2] = await crew(4);
    await reportPlayer(store, reporter, { accusedId: accused.id, reason: "Late", postId: (await photo(reporter)).id });
    const [open] = (await buildBoard(store, null)).reports;
    await upvote(store, v1, open.id);
    vi.advanceTimersByTime(31 * MIN);
    await expect(upvote(store, v2, open.id)).rejects.toThrow("closed");
    expect(await balance(store, accused.id)).toBe(0);
    // And the reporter may file again.
    await reportPlayer(store, reporter, { accusedId: accused.id, reason: "Again", postId: (await photo(reporter)).id });
  });
});

describe("notices", () => {
  it("are per person and can be marked read", async () => {
    const [a, b] = await crew(2);
    await give(a, 20);
    await challenge(store, a, { opponentId: b.id, stake: 5, description: "Darts" });
    expect((await buildMe(store, a)).notices).toEqual([]);
    expect((await buildMe(store, b)).notices).toMatchObject([{ seen: false }]);
    await markNoticesSeen(store, b.id);
    expect((await buildMe(store, b)).notices).toMatchObject([{ seen: true, text: "Sailor 1 challenged you for 10: Darts".replace("10", "5") }]);
  });
});
