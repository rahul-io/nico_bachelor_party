import type { PointsSettings } from "@/lib/points/settings";
import type { PointSource, Profile, Store } from "@/lib/store/types";

/**
 * Pieces every game shares: notices, lines in the Captain's Log, spending
 * points, and who counts as playing right now. Game state lives in
 * `game_records`; each game's file defines the shape of its own records.
 */

const HOUR_MS = 3_600_000;

/** A game action the player isn't allowed to take; the message is shown to them as is. */
export class GameError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Tells one person something happened to them. Shown as a toast and under the bell. */
export async function notify(store: Store, profileId: string, text: string): Promise<void> {
  await store.addRecord({ kind: "notice", profileId, status: "unseen", data: { text } });
}

/** A short line between the photos in the Captain's Log. */
export async function feedLine(store: Store, emoji: string, text: string): Promise<void> {
  await store.addRecord({ kind: "feedline", profileId: null, status: "open", data: { emoji, text } });
}

export async function totals(store: Store): Promise<Map<string, number>> {
  const sums = new Map<string, number>();
  for (const event of await store.listPointEvents()) {
    if (event.voidedAt === null) sums.set(event.profileId, (sums.get(event.profileId) ?? 0) + event.delta);
  }
  for (const [id, sum] of sums) sums.set(id, Math.round(sum * 10) / 10);
  return sums;
}

export async function balance(store: Store, profileId: string): Promise<number> {
  const events = await store.listPointEvents(profileId);
  const sum = events.reduce((total, event) => (event.voidedAt === null ? total + event.delta : total), 0);
  return Math.round(sum * 10) / 10;
}

interface Spend {
  profileId: string;
  amount: number;
  reason: string;
  source: PointSource;
  awardKey?: string;
  groupId?: string;
}

/** Takes points for a curse, a stake or a side bet. Nobody can spend below zero. */
export async function spend(store: Store, { profileId, amount, reason, source, awardKey, groupId }: Spend): Promise<void> {
  if (amount <= 0) return;
  if ((await balance(store, profileId)) < amount) throw new GameError("You don't have enough points for that.");
  await store.addPointEvent({ profileId, delta: -amount, reason, challengeId: null, source, awardKey, groupId });
}

/** Everyone who logged a drink or a water recently enough to count as playing. */
export async function activePlayers(store: Store, now: number, settings: PointsSettings): Promise<Set<string>> {
  const since = now - settings.activeHours * HOUR_MS;
  const [drinks, waters] = await Promise.all([store.listAllDrinks(), store.listAllWaters()]);
  return new Set(
    [...drinks, ...waters].filter((entry) => Date.parse(entry.consumedAt) >= since).map((entry) => entry.profileId),
  );
}

export function nameOf(profiles: Profile[], id: string): string {
  return profiles.find((profile) => profile.id === id)?.name ?? "Someone";
}

export const str = (value: unknown): string => (typeof value === "string" ? value : "");
export const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
