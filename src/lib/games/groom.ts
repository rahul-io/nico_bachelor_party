import { roundPoints } from "@/lib/points/format";
import { getSettings } from "@/lib/points/settings-store";
import type { Post, Profile, Store } from "@/lib/store/types";
import { GameError, feedLine, nameOf, notify, str } from "./common";

/**
 * Groom Tax: a player and the groom drink within a couple of minutes of each
 * other and one of them posts the photo to prove it. The player's drink is
 * doubled and the groom gets a point. Who is really in the photo is on the
 * honour system; an admin can void it. Records are kind "groomtax": data
 * { postId, playerId, groomId, groupId }, status "paid" | "voided".
 */

const GROOM_KEY = "games.groom";
const MINUTE_MS = 60_000;

export async function getGroomId(store: Store): Promise<string | null> {
  const stored = await store.getSetting(GROOM_KEY);
  return typeof stored === "string" && stored ? stored : null;
}

export async function setGroomId(store: Store, profileId: string | null): Promise<void> {
  await store.setSetting(GROOM_KEY, profileId ?? "");
}

/** Pays a Groom Tax claimed by a photo. Throws a GameError saying why not, if not. */
export async function claimGroomTax(store: Store, poster: Profile, playerId: string, post: Post): Promise<void> {
  const [settings, groomId, profiles] = await Promise.all([getSettings(store), getGroomId(store), store.listProfiles()]);
  if (!groomId || !profiles.some((profile) => profile.id === groomId)) {
    throw new GameError("No groom has been set yet.");
  }
  if (playerId === groomId) throw new GameError("The groom can't tax himself.");
  if (poster.id !== groomId && poster.id !== playerId) {
    throw new GameError("Only the groom or the player can claim a Groom Tax.");
  }

  const now = Date.parse(post.createdAt);
  const since = now - settings.groomPhotoMinutes * MINUTE_MS;
  const recent = (id: string) =>
    store.listDrinks(id).then((drinks) => drinks.filter((drink) => Date.parse(drink.consumedAt) >= since));
  const [playerDrinks, groomDrinks, events] = await Promise.all([
    recent(playerId),
    recent(groomId),
    store.listPointEvents(playerId),
  ]);
  const taxed = new Set(events.filter((event) => event.source === "groom" && !event.voidedAt).map((event) => event.drinkId));

  // The player's newest untaxed drink that has a groom's drink close enough to it.
  const windowMs = settings.groomWindowMinutes * MINUTE_MS;
  for (const drink of playerDrinks) {
    if (taxed.has(drink.id)) continue;
    const partner = groomDrinks.find(
      (other) => Math.abs(Date.parse(other.consumedAt) - Date.parse(drink.consumedAt)) <= windowMs,
    );
    if (!partner) continue;

    const own = events.find((event) => event.source === "drink" && event.drinkId === drink.id && !event.voidedAt);
    const bonus = roundPoints((own?.delta ?? 0) * (settings.groomMultiplier - 1));
    const groupId = crypto.randomUUID();
    const paid = await store.addPointEvent({
      profileId: playerId,
      delta: bonus,
      reason: `Groom Tax · ${drink.name} × ${settings.groomMultiplier}`,
      challengeId: null,
      source: "groom",
      drinkId: drink.id,
      groupId,
      awardKey: `groom:${drink.id}`,
    });
    if (!paid) continue;
    await store.addPointEvent({
      profileId: groomId,
      delta: settings.groomPoints,
      reason: `Groom Tax from ${nameOf(profiles, playerId)}`,
      challengeId: null,
      source: "groom",
      drinkId: partner.id,
      groupId,
      awardKey: `groom:${drink.id}:groom`,
    });
    await store.addRecord({
      kind: "groomtax",
      profileId: playerId,
      status: "paid",
      data: { postId: post.id, playerId, groomId, groupId },
    });
    await notify(store, poster.id === playerId ? groomId : playerId, `Groom Tax: ${poster.name} posted the proof.`);
    await feedLine(store, "🤵", `Groom Tax: ${nameOf(profiles, playerId)} drank with the groom`);
    return;
  }
  throw new GameError(
    `No Groom Tax: the two drinks must be logged within ${settings.groomWindowMinutes} minutes of each other, and the photo within ${settings.groomPhotoMinutes}.`,
  );
}

export interface GroomTaxView {
  id: string;
  player: string;
  createdAt: string;
}

/** Paid Groom Taxes, newest first, for Admin. */
export async function listGroomTaxes(store: Store): Promise<GroomTaxView[]> {
  const [records, profiles] = await Promise.all([store.listRecords("groomtax", "paid"), store.listProfiles()]);
  return records
    .slice(0, 20)
    .map((record) => ({ id: record.id, player: nameOf(profiles, str(record.data.playerId)), createdAt: record.createdAt }));
}

/** Admin: takes a Groom Tax back from both of them. */
export async function voidGroomTax(store: Store, id: string): Promise<boolean> {
  const record = await store.getRecord(id);
  if (!record || record.kind !== "groomtax") return false;
  if (!(await store.updateRecord(id, { status: "voided" }, "paid"))) return false;
  await store.voidPointEvents({ groupId: str(record.data.groupId) });
  return true;
}
