import type { PointsSettings } from "@/lib/points/settings";
import type { Profile, Store } from "@/lib/store/types";
import { activePlayers, str, totals } from "./common";
import { SLOT_OUTCOMES, drawSlot, type SlotOutcome } from "./slot";

/**
 * Draws the slot result for a drink, on the server. The reels in the browser
 * only show it. A deleted drink's result is remembered (record kind
 * "slotmemo") and reused by the next drink logged soon after, so deleting and
 * re-logging can't be used to spin again.
 */

export interface Spin {
  outcome: SlotOutcome;
  /** Rob the Leader: who gets robbed. */
  leaderId?: string;
  /** How much the leader has, so the robber can't take more. */
  leaderPoints?: number;
  /** Pay It Forward: who receives this drink's points. */
  recipientId?: string;
}

export async function spinSlot(
  store: Store,
  profile: Profile,
  at: number,
  settings: PointsSettings,
  random: () => number = Math.random,
): Promise<Spin> {
  const [sums, players] = await Promise.all([totals(store), activePlayers(store, at, settings)]);
  const [leaderId, leaderPoints] = [...sums].sort((a, b) => b[1] - a[1])[0] ?? [];
  const others = [...players].filter((id) => id !== profile.id);

  // The leader can't rob themselves, and there must be someone to pay forward to.
  const exclude: SlotOutcome[] = [];
  if (!leaderId || leaderId === profile.id || (leaderPoints ?? 0) <= 0) exclude.push("rob");
  if (others.length === 0) exclude.push("forward");

  let outcome: SlotOutcome | null = null;
  const memo = (await store.listRecords("slotmemo", "open")).find(
    (record) =>
      record.profileId === profile.id && Date.parse(record.createdAt) > at - settings.slotReuseMinutes * 60_000,
  );
  if (memo && (await store.updateRecord(memo.id, { status: "used" }, "open"))) {
    const remembered = str(memo.data.outcome) as SlotOutcome;
    if (SLOT_OUTCOMES.includes(remembered) && !exclude.includes(remembered)) outcome = remembered;
  }
  outcome ??= drawSlot(random(), settings);
  // Landed on something that can't happen right now: spin again without it.
  if (exclude.includes(outcome)) outcome = drawSlot(random(), settings, exclude);

  return {
    outcome,
    ...(outcome === "rob" ? { leaderId, leaderPoints } : {}),
    ...(outcome === "forward" ? { recipientId: others[Math.floor(random() * others.length)] } : {}),
  };
}

/** Remembers a deleted drink's result for the next drink. */
export async function rememberSpin(store: Store, profileId: string, outcome: string): Promise<void> {
  await store.addRecord({ kind: "slotmemo", profileId, status: "open", data: { outcome } });
}
