import { getSettings } from "@/lib/points/settings-store";
import type { Profile, Store } from "@/lib/store/types";
import { currentAssignment, type Assignment } from "./bartender";
import { balance, str } from "./common";
import { CURSE_TYPES, curseCost, displayStore, listCurses, type CurseType, type CurseView } from "./curses";
import { getGroomId, listGroomTaxes, type GroomTaxView } from "./groom";
import { listReports, type SnitchView } from "./snitch";
import { listWagers, type WagerView } from "./wagers";

/** What the screens read: one person's own game state, the shared Games board, and Admin's view. */

export interface Notice {
  id: string;
  text: string;
  createdAt: string;
  seen: boolean;
}

/** Polled on every tab, so it is kept small. */
export interface GamesMe {
  balance: number;
  notices: Notice[];
  bartender: Assignment | null;
  /** Curses on this person, their own Shield included. */
  curses: CurseView[];
  groomId: string | null;
}

export async function buildMe(store: Store, profile: Profile, now = Date.now()): Promise<GamesMe> {
  const [points, unseen, seen, bartender, curses, groomId] = await Promise.all([
    balance(store, profile.id),
    store.listRecords("notice", "unseen"),
    store.listRecords("notice", "seen"),
    currentAssignment(store, profile.id, now),
    listCurses(store, now, true),
    getGroomId(store),
  ]);
  const notices = [...unseen, ...seen]
    .filter((record) => record.profileId === profile.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 15)
    .map((record) => ({
      id: record.id,
      text: str(record.data.text),
      createdAt: record.createdAt,
      seen: record.status === "seen",
    }));
  return {
    balance: points,
    notices,
    bartender,
    curses: curses.filter((curse) => curse.targetId === profile.id),
    groomId,
  };
}

export async function markNoticesSeen(store: Store, profileId: string): Promise<void> {
  for (const record of await store.listRecords("notice", "unseen")) {
    if (record.profileId === profileId) await store.updateRecord(record.id, { status: "seen" }, "unseen");
  }
}

export interface GamesBoard {
  wagers: WagerView[];
  reports: SnitchView[];
  curses: CurseView[];
  prices: Record<CurseType, number>;
  maxStake: number;
  /** Everyone, under the name others currently see. */
  people: Array<{ id: string; name: string }>;
}

export async function buildBoard(store: Store, viewerId: string | null, now = Date.now()): Promise<GamesBoard> {
  const shown = displayStore(store, now);
  const [settings, wagers, reports, curses, people] = await Promise.all([
    getSettings(store),
    listWagers(shown, viewerId, now),
    listReports(shown, viewerId, now),
    listCurses(store, now),
    shown.listProfiles(),
  ]);
  return {
    wagers,
    reports,
    curses,
    prices: Object.fromEntries(CURSE_TYPES.map((type) => [type, curseCost(type, settings)])) as Record<CurseType, number>,
    maxStake: settings.wagerMaxStake,
    people: people.map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export interface FeedLine {
  id: string;
  emoji: string;
  text: string;
  createdAt: string;
}

/** The newest system lines for the Captain's Log. */
export async function listFeedLines(store: Store, limit = 30): Promise<FeedLine[]> {
  return (await store.listRecords("feedline")).slice(0, limit).map((record) => ({
    id: record.id,
    emoji: str(record.data.emoji),
    text: str(record.data.text),
    createdAt: record.createdAt,
  }));
}

export interface AdminGames {
  groomId: string | null;
  people: Array<{ id: string; name: string }>;
  /** Wagers an admin can decide or call off: disputed first, then those still running. */
  wagers: WagerView[];
  curses: CurseView[];
  groomTaxes: GroomTaxView[];
}

/** Real names throughout: Admin needs to know who is who. */
export async function buildAdminGames(store: Store, now = Date.now()): Promise<AdminGames> {
  const [groomId, people, wagers, curses, groomTaxes] = await Promise.all([
    getGroomId(store),
    store.listProfiles(),
    listWagers(store, null, now),
    listCurses(store, now, true),
    listGroomTaxes(store),
  ]);
  return {
    groomId,
    people: people.map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    wagers: wagers
      .filter((wager) => wager.status === "disputed" || wager.status === "accepted")
      .sort((a, b) => Number(b.status === "disputed") - Number(a.status === "disputed")),
    curses,
    groomTaxes,
  };
}
