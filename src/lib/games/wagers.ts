import { roundPoints } from "@/lib/points/format";
import { getSettings } from "@/lib/points/settings-store";
import type { GameRecord, Profile, Store } from "@/lib/store/types";
import { GameError, balance, feedLine, nameOf, notify, num, spend, str } from "./common";

/**
 * Head-to-head wagers with side bets.
 *
 * A wager is a record of kind "wager" owned by the challenger: data
 * { opponentId, stake, description, reports: { [profileId]: winnerId } },
 * status "pending" → "accepted" → "settled" | "disputed" | "void", or
 * "declined". Stakes are taken when it is accepted and when a side bet is
 * placed, and refunded if it is voided, so nobody can stake the same points twice.
 *
 * A side bet is a record of kind "sidebet" owned by the bettor: data
 * { wagerId, side, stake }.
 */

const MINUTE_MS = 60_000;
const MAX_DESCRIPTION = 140;

export interface SideBet {
  profileId: string;
  side: string;
  stake: number;
}

/**
 * What each side bettor gets back. The whole pot is split among those who
 * backed the winner, in proportion to their stakes. If nobody backed the
 * winner, everyone gets their stake back.
 */
export function sideBetPayouts(bets: SideBet[], winnerId: string): Map<string, number> {
  const payouts = new Map<string, number>();
  const add = (profileId: string, amount: number) =>
    payouts.set(profileId, roundPoints((payouts.get(profileId) ?? 0) + amount));

  const pot = bets.reduce((sum, bet) => sum + bet.stake, 0);
  const winners = bets.filter((bet) => bet.side === winnerId);
  const backing = winners.reduce((sum, bet) => sum + bet.stake, 0);
  if (backing === 0) {
    for (const bet of bets) add(bet.profileId, bet.stake);
    return payouts;
  }
  for (const bet of winners) add(bet.profileId, (pot * bet.stake) / backing);
  return payouts;
}

const opponentOf = (wager: GameRecord) => str(wager.data.opponentId);
const stakeOf = (wager: GameRecord) => num(wager.data.stake);
const reportsOf = (wager: GameRecord) => (wager.data.reports ?? {}) as Record<string, string>;
const isPlayer = (wager: GameRecord, id: string) => wager.profileId === id || opponentOf(wager) === id;

async function getWager(store: Store, id: string): Promise<GameRecord> {
  const wager = await store.getRecord(id);
  if (!wager || wager.kind !== "wager") throw new GameError("That wager is gone.", 404);
  return wager;
}

async function sideBets(store: Store, wagerId: string): Promise<SideBet[]> {
  return (await store.listRecords("sidebet"))
    .filter((record) => record.data.wagerId === wagerId && record.profileId)
    .map((record) => ({ profileId: record.profileId!, side: str(record.data.side), stake: num(record.data.stake) }));
}

function expired(wager: GameRecord, expiryMinutes: number, now: number): boolean {
  return wager.status === "pending" && Date.parse(wager.createdAt) + expiryMinutes * MINUTE_MS <= now;
}

export async function challenge(
  store: Store,
  challenger: Profile,
  input: { opponentId: string; stake: number; description: string },
  now = Date.now(),
): Promise<void> {
  const [settings, profiles] = await Promise.all([getSettings(store), store.listProfiles()]);
  const opponent = profiles.find((profile) => profile.id === input.opponentId);
  const description = input.description.trim();
  if (!opponent || opponent.id === challenger.id) throw new GameError("Pick someone else to challenge.");
  if (!Number.isInteger(input.stake) || input.stake < 1 || input.stake > settings.wagerMaxStake) {
    throw new GameError(`The stake must be a whole number from 1 to ${settings.wagerMaxStake}.`);
  }
  if (description.length < 1 || description.length > MAX_DESCRIPTION) {
    throw new GameError(`Say what the wager is (max ${MAX_DESCRIPTION} characters).`);
  }
  if ((await balance(store, challenger.id)) < input.stake) throw new GameError("You don't have enough points for that stake.");

  const waiting = (await store.listRecords("wager", "pending")).some(
    (wager) =>
      wager.profileId === challenger.id &&
      opponentOf(wager) === opponent.id &&
      !expired(wager, settings.wagerExpiryMinutes, now),
  );
  if (waiting) throw new GameError(`${opponent.name} hasn't answered your last challenge yet.`);

  await store.addRecord({
    kind: "wager",
    profileId: challenger.id,
    status: "pending",
    data: { opponentId: opponent.id, stake: input.stake, description, reports: {} },
  });
  await notify(store, opponent.id, `${challenger.name} challenged you for ${input.stake}: ${description}`);
}

/** The opponent accepts or declines; the challenger can withdraw with "decline" too. */
export async function answer(store: Store, profile: Profile, wagerId: string, accept: boolean, now = Date.now()): Promise<void> {
  const [settings, wager] = await Promise.all([getSettings(store), getWager(store, wagerId)]);
  if (wager.status !== "pending" || expired(wager, settings.wagerExpiryMinutes, now)) {
    throw new GameError("That challenge is no longer open.");
  }
  if (!accept) {
    if (!isPlayer(wager, profile.id)) throw new GameError("That isn't your wager.", 403);
    if (await store.updateRecord(wager.id, { status: "declined" }, "pending")) {
      const other = wager.profileId === profile.id ? opponentOf(wager) : wager.profileId!;
      await notify(store, other, `${profile.name} ${wager.profileId === profile.id ? "withdrew" : "declined"} the wager: ${str(wager.data.description)}`);
    }
    return;
  }

  if (opponentOf(wager) !== profile.id) throw new GameError("Only the person challenged can accept.", 403);
  const stake = stakeOf(wager);
  const [mine, theirs] = await Promise.all([balance(store, profile.id), balance(store, wager.profileId!)]);
  if (mine < stake) throw new GameError("You don't have enough points to cover the stake.");
  if (theirs < stake) throw new GameError("The challenger can no longer cover the stake.");
  if (!(await store.updateRecord(wager.id, { status: "accepted" }, "pending"))) return;

  const reason = `Wager stake · ${str(wager.data.description)}`;
  for (const profileId of [wager.profileId!, profile.id]) {
    await store.addPointEvent({
      profileId,
      delta: -stake,
      reason,
      challengeId: null,
      source: "wager",
      groupId: wager.id,
      awardKey: `wager:${wager.id}:hold:${profileId}`,
    });
  }
  const profiles = await store.listProfiles();
  await notify(store, wager.profileId!, `${profile.name} accepted your wager: ${str(wager.data.description)}`);
  await feedLine(
    store,
    "🤝",
    `${nameOf(profiles, wager.profileId!)} and ${profile.name} have ${stake} riding on: ${str(wager.data.description)}`,
  );
}

/** Stakes points on one of the two players. Side bets close when the first result is reported. */
export async function placeSideBet(store: Store, profile: Profile, wagerId: string, side: string, stake: number): Promise<void> {
  const [settings, wager] = await Promise.all([getSettings(store), getWager(store, wagerId)]);
  if (wager.status !== "accepted" || Object.keys(reportsOf(wager)).length > 0) {
    throw new GameError("Side bets on that wager are closed.");
  }
  if (isPlayer(wager, profile.id)) throw new GameError("You're in this wager; side bets are for everyone else.");
  if (!isPlayer(wager, side)) throw new GameError("Pick one of the two players.");
  if (!Number.isInteger(stake) || stake < 1 || stake > settings.wagerMaxStake) {
    throw new GameError(`The stake must be a whole number from 1 to ${settings.wagerMaxStake}.`);
  }
  const mine = (await sideBets(store, wager.id)).find((bet) => bet.profileId === profile.id);
  if (mine && mine.side !== side) throw new GameError("You've already backed the other side.");

  await spend(store, {
    profileId: profile.id,
    amount: stake,
    reason: `Side bet · ${str(wager.data.description)}`,
    source: "wager",
    groupId: wager.id,
  });
  await store.addRecord({ kind: "sidebet", profileId: profile.id, status: "open", data: { wagerId: wager.id, side, stake } });
}

async function pay(store: Store, wager: GameRecord, profileId: string, amount: number, reason: string, key: string) {
  if (amount <= 0) return;
  await store.addPointEvent({
    profileId,
    delta: amount,
    reason,
    challengeId: null,
    source: "wager",
    groupId: wager.id,
    awardKey: `wager:${wager.id}:${key}:${profileId}`,
  });
}

async function settle(store: Store, wager: GameRecord, winnerId: string, from: string): Promise<boolean> {
  if (!(await store.updateRecord(wager.id, { status: "settled", data: { ...wager.data, winnerId } }, from))) return false;
  const description = str(wager.data.description);
  await pay(store, wager, winnerId, 2 * stakeOf(wager), `Won the wager · ${description}`, "win");
  for (const [profileId, amount] of sideBetPayouts(await sideBets(store, wager.id), winnerId)) {
    await pay(store, wager, profileId, amount, `Side bet paid · ${description}`, "side");
    await notify(store, profileId, `Your side bet paid ${amount}: ${description}`);
  }
  const profiles = await store.listProfiles();
  const loserId = winnerId === wager.profileId ? opponentOf(wager) : wager.profileId!;
  await notify(store, winnerId, `You won the wager: ${description}`);
  await notify(store, loserId, `You lost the wager: ${description}`);
  await feedLine(store, "💰", `${nameOf(profiles, winnerId)} won ${stakeOf(wager)} off ${nameOf(profiles, loserId)}: ${description}`);
  return true;
}

/** Each player says who won. Agreement pays out; disagreement goes to Admin. */
export async function report(store: Store, profile: Profile, wagerId: string, winnerId: string): Promise<void> {
  const wager = await getWager(store, wagerId);
  if (wager.status !== "accepted") throw new GameError("That wager isn't waiting for a result.");
  if (!isPlayer(wager, profile.id)) throw new GameError("Only the two players can report the result.", 403);
  if (!isPlayer(wager, winnerId)) throw new GameError("Pick one of the two players.");

  const reports = { ...reportsOf(wager), [profile.id]: winnerId };
  const updated = await store.updateRecord(wager.id, { data: { ...wager.data, reports } }, "accepted");
  if (!updated) return;
  const answers = Object.values(reports);
  if (answers.length < 2) {
    const other = wager.profileId === profile.id ? opponentOf(wager) : wager.profileId!;
    await notify(store, other, `${profile.name} reported the result of: ${str(wager.data.description)}. Report yours.`);
    return;
  }
  if (answers[0] === answers[1]) {
    await settle(store, updated, winnerId, "accepted");
    return;
  }
  await store.updateRecord(wager.id, { status: "disputed" }, "accepted");
  for (const id of [wager.profileId!, opponentOf(wager)]) {
    await notify(store, id, `You two disagree on who won: ${str(wager.data.description)}. An admin will decide.`);
  }
}

/** Admin: decides a disputed (or stuck) wager. */
export async function resolve(store: Store, wagerId: string, winnerId: string): Promise<boolean> {
  const wager = await getWager(store, wagerId);
  if (!isPlayer(wager, winnerId)) throw new GameError("Pick one of the two players.");
  if (wager.status !== "disputed" && wager.status !== "accepted") return false;
  return settle(store, wager, winnerId, wager.status);
}

/** Admin: calls a wager off and gives every stake back. */
export async function voidWager(store: Store, wagerId: string): Promise<boolean> {
  const wager = await getWager(store, wagerId);
  if (wager.status !== "disputed" && wager.status !== "accepted") return false;
  if (!(await store.updateRecord(wager.id, { status: "void" }, wager.status))) return false;
  const description = str(wager.data.description);
  for (const profileId of [wager.profileId!, opponentOf(wager)]) {
    await pay(store, wager, profileId, stakeOf(wager), `Wager called off · ${description}`, "refund");
    await notify(store, profileId, `An admin called off the wager: ${description}. Stakes are back.`);
  }
  const refunds = new Map<string, number>();
  for (const bet of await sideBets(store, wager.id)) refunds.set(bet.profileId, (refunds.get(bet.profileId) ?? 0) + bet.stake);
  for (const [profileId, amount] of refunds) {
    await pay(store, wager, profileId, amount, `Side bet refunded · ${description}`, "siderefund");
  }
  return true;
}

export interface WagerView {
  id: string;
  status: "pending" | "accepted" | "disputed" | "settled";
  description: string;
  stake: number;
  challenger: { id: string; name: string };
  opponent: { id: string; name: string };
  /** Who has reported a result so far (not what they said). */
  reported: string[];
  winnerId: string | null;
  /** Points staked on each player by side bettors. */
  sidePots: Record<string, number>;
  mySide: { side: string; stake: number } | null;
  expiresAt: string | null;
}

const SHOWN = new Set(["pending", "accepted", "disputed", "settled"]);

/** Open wagers, plus the few most recently settled. Names are display names. */
export async function listWagers(store: Store, viewerId: string | null, now = Date.now()): Promise<WagerView[]> {
  const [settings, wagers, bets, profiles] = await Promise.all([
    getSettings(store),
    store.listRecords("wager"),
    store.listRecords("sidebet"),
    store.listProfiles(),
  ]);
  const person = (id: string) => ({ id, name: nameOf(profiles, id) });
  let settledShown = 0;

  return wagers
    .filter((wager) => SHOWN.has(wager.status) && !expired(wager, settings.wagerExpiryMinutes, now))
    .filter((wager) => wager.status !== "settled" || settledShown++ < 5)
    .map((wager) => {
      const own = bets.filter((bet) => bet.data.wagerId === wager.id);
      const sidePots: Record<string, number> = {};
      for (const bet of own) sidePots[str(bet.data.side)] = (sidePots[str(bet.data.side)] ?? 0) + num(bet.data.stake);
      const mine = own.filter((bet) => bet.profileId === viewerId);
      return {
        id: wager.id,
        status: wager.status as WagerView["status"],
        description: str(wager.data.description),
        stake: stakeOf(wager),
        challenger: person(wager.profileId ?? ""),
        opponent: person(opponentOf(wager)),
        reported: Object.keys(reportsOf(wager)),
        winnerId: str(wager.data.winnerId) || null,
        sidePots,
        mySide:
          mine.length > 0
            ? { side: str(mine[0].data.side), stake: mine.reduce((sum, bet) => sum + num(bet.data.stake), 0) }
            : null,
        expiresAt:
          wager.status === "pending"
            ? new Date(Date.parse(wager.createdAt) + settings.wagerExpiryMinutes * MINUTE_MS).toISOString()
            : null,
      };
    });
}
