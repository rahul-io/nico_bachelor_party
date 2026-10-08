import { getSettings } from "@/lib/points/settings-store";
import { nextDay } from "@/lib/points/awards";
import type { PointsSettings } from "@/lib/points/settings";
import type { GameRecord, Profile, Store } from "@/lib/store/types";
import { dayKey, partyTimeToIso } from "@/lib/time";
import { GameError, feedLine, nameOf, notify, spend, str } from "./common";

/**
 * Curses, bought with points. A curse is a `game_records` row of kind "curse"
 * belonging to its target: data { type, fromId, value?, expiresAt? }, status
 * "active" | "used" | "blocked" | "reverted".
 */

export const CURSE_TYPES = ["name", "deadweight", "avatar", "shield"] as const;
export type CurseType = (typeof CURSE_TYPES)[number];

export const curseNames: Record<CurseType, string> = {
  name: "Name Hijack",
  deadweight: "Dead Weight",
  avatar: "Avatar Swap",
  shield: "Shield",
};

/** "a Name Hijack", "an Avatar Swap". */
const aCurse = (type: CurseType) => `${/^[AEIOU]/.test(curseNames[type]) ? "an" : "a"} ${curseNames[type]}`;

export const MAX_HIJACK_NAME = 24;

export function curseCost(type: CurseType, settings: PointsSettings): number {
  return {
    name: settings.curseNameCost,
    deadweight: settings.curseDeadWeightCost,
    avatar: settings.curseAvatarCost,
    shield: settings.curseShieldCost,
  }[type];
}

export interface Curse {
  id: string;
  type: CurseType;
  targetId: string;
  fromId: string;
  value: string | null;
  expiresAt: string | null;
}

function toCurse(record: GameRecord): Curse {
  return {
    id: record.id,
    type: str(record.data.type) as CurseType,
    targetId: record.profileId ?? "",
    fromId: str(record.data.fromId),
    value: str(record.data.value) || null,
    expiresAt: str(record.data.expiresAt) || null,
  };
}

/** Curses in force at `now`. */
export async function activeCurses(store: Store, now = Date.now()): Promise<Curse[]> {
  return (await store.listRecords("curse", "active"))
    .map(toCurse)
    .filter((curse) => !curse.expiresAt || Date.parse(curse.expiresAt) > now);
}

/**
 * The name and avatar everyone else sees for each person: their own, unless a
 * Name Hijack or Avatar Swap is in force. Login names never change.
 */
export function applyCurses<T extends Pick<Profile, "id" | "name" | "avatarUrl">>(profiles: T[], curses: Curse[]): T[] {
  return profiles.map((profile) => {
    const mine = curses.filter((curse) => curse.targetId === profile.id);
    const name = mine.find((curse) => curse.type === "name")?.value;
    const avatar = mine.find((curse) => curse.type === "avatar")?.value;
    return name || avatar ? { ...profile, name: name ?? profile.name, avatarUrl: avatar ?? profile.avatarUrl } : profile;
  });
}

/**
 * The store as guests should see it: `listProfiles()` returns display names
 * and avatars. Wrap the store with this in every guest-facing read (leaderboard,
 * feed, comments, chart, ledger); exports and Admin use the plain store.
 */
export function displayStore(store: Store, now = Date.now()): Store {
  const wrapped: Store = Object.create(store);
  wrapped.listProfiles = async () => {
    const [profiles, curses] = await Promise.all([store.listProfiles(), activeCurses(store, now)]);
    return applyCurses(profiles, curses);
  };
  return wrapped;
}

/** Midnight party time after `now`. */
function nextMidnight(now: number): string {
  return partyTimeToIso(nextDay(dayKey(now)), "00:00");
}

interface Cast {
  type: CurseType;
  targetId: string;
  /** The new name, or the id of the feed photo to use as their avatar. */
  value?: string;
}

/** Buys a curse. Returns "blocked" when the target's Shield ate it (the curser still pays). */
export async function castCurse(store: Store, caster: Profile, cast: Cast, now = Date.now()): Promise<"cast" | "blocked"> {
  const [settings, profiles, curses] = await Promise.all([
    getSettings(store),
    store.listProfiles(),
    activeCurses(store, now),
  ]);
  const { type } = cast;
  const targetId = type === "shield" ? caster.id : cast.targetId;
  const target = profiles.find((profile) => profile.id === targetId);
  if (!target) throw new GameError("That person isn't here any more.", 404);
  if (type !== "shield" && target.id === caster.id) throw new GameError("You can't curse yourself.");
  if (curses.some((curse) => curse.targetId === target.id && curse.type === type)) {
    throw new GameError(
      type === "shield" ? "You already have a Shield up." : `${target.name} already has ${aCurse(type)} on them.`,
    );
  }

  let value: string | null = null;
  let expiresAt: string | null = null;
  if (type === "name") {
    value = (cast.value ?? "").trim();
    if (value.length < 1 || value.length > MAX_HIJACK_NAME) {
      throw new GameError(`The new name must be 1–${MAX_HIJACK_NAME} characters.`);
    }
    expiresAt = new Date(now + settings.curseNameMinutes * 60_000).toISOString();
  }
  if (type === "avatar") {
    const post = cast.value ? await store.getPost(cast.value) : null;
    if (!post || post.mediaType !== "image") throw new GameError("Pick a photo from the Captain's Log.");
    // The preview, never the original file: see forGuests in feed.ts.
    value = post.previewUrl ?? post.url;
    expiresAt = nextMidnight(now);
  }

  await spend(store, {
    profileId: caster.id,
    amount: curseCost(type, settings),
    reason: type === "shield" ? "Shield" : `${curseNames[type]} on ${target.name}`,
    source: "curse",
  });

  const shield = type === "shield" ? undefined : curses.find((curse) => curse.targetId === target.id && curse.type === "shield");
  if (shield && (await store.updateRecord(shield.id, { status: "used" }, "active"))) {
    await store.addRecord({ kind: "curse", profileId: target.id, status: "blocked", data: { type, fromId: caster.id } });
    await notify(store, target.id, `Your Shield blocked ${aCurse(type)} from ${caster.name}.`);
    await notify(store, caster.id, `${target.name}'s Shield blocked your ${curseNames[type]}.`);
    return "blocked";
  }

  await store.addRecord({
    kind: "curse",
    profileId: target.id,
    status: "active",
    data: { type, fromId: caster.id, value, expiresAt },
  });
  if (type !== "shield") {
    await notify(store, target.id, `${caster.name} cursed you: ${curseNames[type]}.`);
    await feedLine(store, "🧿", `${caster.name} put ${aCurse(type)} on ${target.name}`);
  }
  return "cast";
}

/** Uses up a Dead Weight on this person, if they have one: their drink then scores nothing. */
export async function spendDeadWeight(store: Store, profileId: string, now = Date.now()): Promise<boolean> {
  const curse = (await activeCurses(store, now)).find((item) => item.targetId === profileId && item.type === "deadweight");
  return !!curse && (await store.updateRecord(curse.id, { status: "used" }, "active")) !== null;
}

/** Admin: lifts a curse early. Nothing is refunded. */
export async function revertCurse(store: Store, curseId: string): Promise<boolean> {
  const record = await store.getRecord(curseId);
  if (!record || record.kind !== "curse") return false;
  return (await store.updateRecord(curseId, { status: "reverted" }, "active")) !== null;
}

export interface CurseView {
  id: string;
  type: CurseType;
  name: string;
  targetId: string;
  target: string;
  from: string;
  expiresAt: string | null;
}

/** Active curses with real names, for the Games board and Admin. Shields are private to their owner. */
export async function listCurses(store: Store, now = Date.now(), includeShields = false): Promise<CurseView[]> {
  const [profiles, curses] = await Promise.all([store.listProfiles(), activeCurses(store, now)]);
  return curses
    .filter((curse) => includeShields || curse.type !== "shield")
    .map((curse) => ({
      id: curse.id,
      type: curse.type,
      name: curseNames[curse.type],
      targetId: curse.targetId,
      target: nameOf(profiles, curse.targetId),
      from: nameOf(profiles, curse.fromId),
      expiresAt: curse.expiresAt,
    }));
}
