import { GameError, feedLine, nameOf, notify, num, str } from "@/lib/games/common";
import { getSettings } from "@/lib/points/settings-store";
import type { GameRecord, Profile, Store } from "@/lib/store/types";
import { formatTime } from "@/lib/time";
import {
  CODED,
  MOST_METRICS,
  achievementHolder,
  codedDescriptions,
  codedMeritEarned,
  describeRule,
  firstAsleepPhoto,
  isAchievementRule,
  lightweightHolder,
  meritEarned,
  nextDay,
  partyDayBounds,
  partyDayOf,
  type CodedKey,
  type Earned,
  type Holder,
  type PriorAward,
  type Rule,
  type Trigger,
  type World,
} from "./rules";
import { CODED_ACHIEVEMENTS, CUMULATIVE, codedHolder, detect } from "./extra";
import { seedBadges, seedImage } from "./seed";

/**
 * Badges against the store. Definitions and awards are `game_records`:
 *   "badge"       data = the definition (see `Badge`)
 *   "badgeaward"  owner = the earner, status "held" | "revoked",
 *                 data { badgeId, period, sourceIds, groupId, points, reason, seen }
 *   "badgeclaim"  one per achievement per day, so a "first" badge is announced once
 *   "badgeimage"  data { dataUrl }: an uploaded 256 px image, served by /api/badges/image/[id]
 * Every award also writes a ledger entry (source "badge") under a unique key,
 * which is what stops it being given twice; revoking voids that entry.
 */

export type BadgeKind = "achievement" | "merit";
export type BadgeSource = "manual" | "rule" | "coded";

export interface Badge {
  id: string;
  /** Set on the seeded badges, so seeding can tell they exist. */
  slug: string | null;
  name: string;
  description: string;
  emoji: string;
  imageUrl: string | null;
  kind: BadgeKind;
  source: BadgeSource;
  rule: Rule | null;
  coded: CodedKey | null;
  points: number;
  active: boolean;
  /** Shown as "???" in the trophy case until someone earns it. */
  hidden: boolean;
  createdAt: string;
}

export interface BadgeInput {
  name: string;
  description: string;
  emoji: string;
  imageUrl: string | null;
  kind: BadgeKind;
  points: number;
  active: boolean;
  hidden: boolean;
  /** Only for new or rule-based badges. Coded badges keep their condition. */
  rule?: Rule | null;
}

function toBadge(record: GameRecord): Badge {
  const d = record.data;
  return {
    id: record.id,
    slug: str(d.slug) || null,
    name: str(d.name),
    description: str(d.description),
    emoji: str(d.emoji) || "🏅",
    // No image of its own: fall back to the seeded crest, if one has been added since.
    imageUrl: str(d.imageUrl) || seedImage(str(d.slug) || null),
    kind: d.kind === "achievement" ? "achievement" : "merit",
    source: d.source === "rule" || d.source === "coded" ? d.source : "manual",
    rule: (d.rule as Rule | null | undefined) ?? null,
    coded: (CODED as readonly string[]).includes(str(d.coded)) ? (d.coded as CodedKey) : null,
    points: num(d.points),
    active: d.active !== false,
    hidden: d.hidden === true,
    createdAt: record.createdAt,
  };
}

/** Every badge, seeded ones first in their set order. Creates the initial set the first time. */
export async function listBadges(store: Store): Promise<Badge[]> {
  let records = await store.listRecords("badge");
  const have = new Set(records.map((record) => str(record.data.slug)));
  const missing = seedBadges.filter((seed) => !have.has(seed.slug));
  if (missing.length > 0) {
    for (const seed of missing) await store.addRecord({ kind: "badge", profileId: null, status: "open", data: { ...seed } });
    records = await store.listRecords("badge");
  }
  // Two requests seeding at once could both insert: keep the oldest of each slug.
  const seen = new Set<string>();
  const badges = records
    .slice()
    .reverse()
    .filter((record) => {
      const slug = str(record.data.slug);
      if (!slug) return true;
      if (seen.has(slug)) return false;
      seen.add(slug);
      return true;
    })
    .map(toBadge);
  const order = (badge: Badge) => {
    const index = seedBadges.findIndex((seed) => seed.slug === badge.slug);
    return index === -1 ? seedBadges.length : index;
  };
  return badges.sort((a, b) => order(a) - order(b));
}

const BAC_RANGE = [0.01, 0.5] as const;

function checkRule(rule: unknown): Rule {
  const r = rule as Rule;
  const what = (r as { what?: { kind?: string } }).what;
  const okWhat = what?.kind === "drink" || what?.kind === "water";
  const okBac = (bac: unknown) => typeof bac === "number" && bac >= BAC_RANGE[0] && bac <= BAC_RANGE[1];
  switch (r?.type) {
    case "count":
      if (okWhat && Number.isInteger(r.n) && r.n >= 1 && r.n <= 50 && ["hour", "day", "weekend"].includes(r.window)) return r;
      break;
    case "threshold":
    case "first":
      if (okBac(r.bac)) return r;
      break;
    case "time":
      if (okWhat && (r.when === "before" || r.when === "after") && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)) return r;
      break;
    case "most":
      if (MOST_METRICS.includes(r.metric) && (r.metric !== "categoryDrinks" || r.category)) return r;
      break;
  }
  throw new GameError("That rule is incomplete.");
}

/** Creates a badge (no id) or edits one. A points change applies to future awards only. */
export async function saveBadge(store: Store, id: string | null, input: BadgeInput): Promise<Badge> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 40) throw new GameError("The badge needs a name (max 40 characters).");
  if (input.description.length > 200) throw new GameError("The description is too long (max 200 characters).");
  if (!Number.isFinite(input.points) || input.points < -200 || input.points > 200) {
    throw new GameError("Points must be between -200 and 200.");
  }
  const fields = {
    name,
    description: input.description.trim(),
    emoji: input.emoji.trim().slice(0, 8) || "🏅",
    imageUrl: input.imageUrl,
    points: input.points,
    active: input.active,
    hidden: input.hidden,
  };

  if (!id) {
    const rule = input.rule ? checkRule(input.rule) : null;
    const kind: BadgeKind = rule ? (isAchievementRule(rule) ? "achievement" : "merit") : input.kind;
    const record = await store.addRecord({
      kind: "badge",
      profileId: null,
      status: "open",
      data: { ...fields, kind, source: rule ? "rule" : "manual", rule },
    });
    return toBadge(record);
  }

  const record = await store.getRecord(id);
  if (!record || record.kind !== "badge") throw new GameError("That badge is gone.", 404);
  const current = toBadge(record);
  const data: Record<string, unknown> = { ...record.data, ...fields };
  if (current.source === "manual") data.kind = input.kind;
  if (current.source === "rule" && input.rule) {
    const rule = checkRule(input.rule);
    data.rule = rule;
    data.kind = isAchievementRule(rule) ? "achievement" : "merit";
  }
  const updated = await store.updateRecord(id, { data });
  return toBadge(updated ?? record);
}

/** Stores an uploaded badge image and returns the URL to use for it. */
export async function saveBadgeImage(store: Store, dataUrl: string): Promise<string> {
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(dataUrl) || dataUrl.length > 400_000) {
    throw new GameError("That image didn't work. Try another one.");
  }
  const record = await store.addRecord({ kind: "badgeimage", profileId: null, status: "open", data: { dataUrl } });
  return `/api/badges/image/${record.id}`;
}

export async function getBadgeImage(store: Store, id: string): Promise<string | null> {
  const record = await store.getRecord(id);
  return record?.kind === "badgeimage" ? str(record.data.dataUrl) || null : null;
}

export interface Award {
  id: string;
  badgeId: string;
  profileId: string;
  period: string;
  sourceIds: string[];
  groupId: string;
  reason: string | null;
  seen: boolean;
  createdAt: string;
}

function toAward(record: GameRecord): Award {
  return {
    id: record.id,
    badgeId: str(record.data.badgeId),
    profileId: record.profileId ?? "",
    period: str(record.data.period),
    sourceIds: Array.isArray(record.data.sourceIds) ? (record.data.sourceIds as string[]) : [],
    groupId: str(record.data.groupId),
    reason: str(record.data.reason) || null,
    seen: record.data.seen === true,
    createdAt: record.createdAt,
  };
}

/** Awards currently held, newest first. */
export async function listAwards(store: Store): Promise<Award[]> {
  return (await store.listRecords("badgeaward", "held")).map(toAward);
}

interface Grant {
  /** Unique per award; a second grant with the same key does nothing. */
  key: string;
  period: string;
  sourceIds?: string[];
  reason?: string | null;
  /** When it was earned, for the ledger (a day's achievement is stamped at the cutoff). */
  at?: number;
}

/** Gives a badge: ledger entry, award record, a line in the Captain's Log. False if it was already given. */
export async function awardBadge(store: Store, badge: Badge, profile: Pick<Profile, "id" | "name">, grant: Grant): Promise<boolean> {
  const groupId = crypto.randomUUID();
  const entry = await store.addPointEvent({
    profileId: profile.id,
    delta: badge.points,
    reason: `Badge · ${badge.name}${grant.reason ? ` · ${grant.reason}` : ""}`,
    challengeId: null,
    source: "badge",
    groupId,
    awardKey: `badge:${grant.key}`,
    createdAt: grant.at ? new Date(grant.at).toISOString() : undefined,
  });
  if (!entry) return false;
  await store.addRecord({
    kind: "badgeaward",
    profileId: profile.id,
    status: "held",
    data: {
      badgeId: badge.id,
      period: grant.period,
      sourceIds: grant.sourceIds ?? [],
      groupId,
      reason: grant.reason ?? null,
      seen: false,
    },
  });
  await feedLine(store, badge.emoji, `${profile.name} earned ${badge.name.toUpperCase()}`);
  return true;
}

/** Takes a badge back and voids its points. */
export async function revokeAward(store: Store, awardId: string): Promise<boolean> {
  const record = await store.getRecord(awardId);
  if (!record || record.kind !== "badgeaward") return false;
  if (!(await store.updateRecord(awardId, { status: "revoked" }, "held"))) return false;
  await store.voidPointEvents({ groupId: str(record.data.groupId) });
  return true;
}

/** When a drink or water is deleted, any merit badge resting on it goes too. */
export async function revokeForSource(store: Store, sourceId: string): Promise<void> {
  for (const award of await listAwards(store)) {
    if (award.sourceIds.includes(sourceId)) await revokeAward(store, award.id);
  }
}

export async function loadWorld(store: Store): Promise<World> {
  const [settings, people, drinks, waters, posts, groomTaxes, curses, events, comments, reactionCounts, wagers, snitches, orders, awards, groom] =
    await Promise.all([
      getSettings(store),
      store.listProfiles(),
      store.listAllDrinks(),
      store.listAllWaters(),
      store.listPosts(),
      store.listRecords("groomtax", "paid"),
      store.listRecords("curse"),
      store.listPointEvents(),
      store.listAllComments(),
      store.reactionCounts(null),
      store.listRecords("wager", "settled"),
      store.listRecords("snitch", "upheld"),
      store.listRecords("bartender", "done"),
      store.listRecords("badgeaward", "held"),
      store.getSetting("games.groom"),
    ]);
  const live = events.filter((event) => event.voidedAt === null);
  const slotOf = new Map(
    live.filter((event) => event.source === "drink" && event.drinkId).map((event) => [event.drinkId!, event.breakdown?.slot ?? null]),
  );
  const reactions: Record<string, number> = {};
  for (const item of reactionCounts) reactions[item.postId] = (reactions[item.postId] ?? 0) + item.count;
  const postAt = new Map(posts.map((post) => [post.id, Date.parse(post.createdAt)]));
  const sleepingIds = new Set(
    (await store.listRecords("badge")).filter((record) => record.data.coded === "sleepingBeauty").map((record) => record.id),
  );

  return {
    comments: comments.map((comment) => ({ profileId: comment.profileId, at: Date.parse(comment.createdAt) })),
    reactions,
    ledger: live.map((event) => ({
      profileId: event.profileId,
      delta: event.delta,
      source: event.source,
      awardKey: event.awardKey,
      drinkId: event.drinkId,
      at: Date.parse(event.createdAt),
    })),
    curses: curses
      .filter((record) => record.profileId)
      .map((record) => ({
        id: record.id,
        type: str(record.data.type),
        fromId: str(record.data.fromId),
        targetId: record.profileId!,
        at: Date.parse(record.createdAt),
        blocked: record.status === "blocked",
      })),
    wagers: wagers.flatMap((record) => {
      const winnerId = str(record.data.winnerId);
      const players = [record.profileId ?? "", str(record.data.opponentId)];
      const loserId = players.find((id) => id !== winnerId);
      // Settled when the winner was paid.
      const paid = live.find((event) => event.awardKey === `wager:${record.id}:win:${winnerId}`);
      return loserId ? [{ id: record.id, stake: num(record.data.stake), winnerId, loserId, at: Date.parse(paid?.createdAt ?? record.createdAt) }] : [];
    }),
    snitches: snitches.map((record) => {
      const paid = live.find((event) => event.awardKey === `snitch:${record.id}:accused`);
      return {
        id: record.id,
        reporterId: record.profileId ?? "",
        accusedId: str(record.data.accusedId),
        at: Date.parse(paid?.createdAt ?? record.createdAt),
      };
    }),
    ordersDone: orders.filter((record) => record.profileId).map((record) => ({ id: record.id, profileId: record.profileId!, at: Date.parse(record.createdAt) })),
    // A deleted drink leaves its ledger entry behind, voided at the moment of deletion.
    deletions: events
      .filter((event) => event.source === "drink" && event.voidedAt !== null)
      .map((event) => ({ profileId: event.profileId, at: Date.parse(event.voidedAt!) })),
    sleepers: awards
      .filter((record) => sleepingIds.has(str(record.data.badgeId)) && record.profileId)
      .flatMap((record) => {
        const postId = Array.isArray(record.data.sourceIds) ? String(record.data.sourceIds[0] ?? "") : "";
        const at = postAt.get(postId);
        return at === undefined ? [] : [{ profileId: record.profileId!, postId, at }];
      }),
    groomId: typeof groom === "string" && groom ? groom : null,
    people,
    drinks: drinks.map((drink) => ({
      id: drink.id,
      profileId: drink.profileId,
      at: Date.parse(drink.consumedAt),
      alcoholG: drink.alcoholG,
      name: drink.name,
      category: drink.category,
      abv: drink.abv,
      slot: slotOf.get(drink.id) ?? null,
    })),
    waters: waters.map((water) => ({ id: water.id, profileId: water.profileId, at: Date.parse(water.consumedAt) })),
    posts: posts.map((post) => ({
      id: post.id,
      profileId: post.profileId,
      at: Date.parse(post.createdAt),
      taggedIds: post.taggedIds ?? [],
      asleep: post.asleep ?? false,
    })),
    groomTaxes: groomTaxes.map((record) => ({ profileId: str(record.data.playerId), at: Date.parse(record.createdAt) })),
    // Shields are bought for yourself, and a blocked curse never landed.
    cursesReceived: curses
      .filter((record) => record.data.type !== "shield" && record.status !== "blocked" && record.profileId)
      .map((record) => ({ profileId: record.profileId!, at: Date.parse(record.createdAt) })),
    cutoffHour: settings.dayCutoffHour,
  };
}

/** Who holds an achievement for one party day, from the data as it stands. */
function holderFor(badge: Badge, world: World, day: string): Holder | null {
  const { start, end } = partyDayBounds(day, world.cutoffHour);
  if (badge.coded === "lightweight") return lightweightHolder(world, start, end);
  if (badge.coded) return codedHolder(badge.coded, world, start, end);
  return badge.rule ? achievementHolder(badge.rule, world, start, end) : null;
}

const settles = (badge: Badge) =>
  badge.active &&
  badge.kind === "achievement" &&
  ((badge.coded !== null && CODED_ACHIEVEMENTS.includes(badge.coded)) || (badge.rule !== null && isAchievementRule(badge.rule)));

/**
 * Checks the merit badges a just-logged drink or water could earn, and
 * announces a "first to…" achievement the moment it is claimed (it is paid
 * at the cutoff with the rest).
 */
export async function checkBadges(store: Store, profile: Profile, trigger: Trigger): Promise<void> {
  const [badges, world, awards] = await Promise.all([listBadges(store), loadWorld(store), listAwards(store)]);
  const day = partyDayOf(trigger.at, world.cutoffHour);

  for (const badge of badges) {
    if (!badge.active) continue;
    if (badge.kind === "merit" && badge.source !== "manual") {
      const prior: PriorAward[] = awards.filter((award) => award.badgeId === badge.id && award.profileId === profile.id);
      const earned: Earned | null = badge.coded
        ? codedMeritEarned(badge.coded, world, profile.id, trigger, prior)
        : badge.rule
          ? meritEarned(badge.rule, world, profile.id, trigger, prior)
          : null;
      if (earned) {
        await awardBadge(store, badge, profile, {
          key: `${badge.id}:${profile.id}:${trigger.id}`,
          period: earned.period,
          sourceIds: earned.sourceIds,
          at: trigger.at,
        });
      }
    }
    // "First to" badges can't change hands, so they are announced as soon as they are claimed.
    const firstTo = badge.rule?.type === "first" || badge.coded === "lightweight" || badge.coded === "earlyBird";
    if (settles(badge) && firstTo && trigger.kind === "drink") {
      const holder = holderFor(badge, world, day);
      if (holder?.profileId !== profile.id || holder.at !== trigger.at) continue;
      const claims = await store.listRecords("badgeclaim");
      if (claims.some((claim) => claim.data.badgeId === badge.id && claim.data.day === day)) continue;
      await store.addRecord({ kind: "badgeclaim", profileId: profile.id, status: "open", data: { badgeId: badge.id, day } });
      await feedLine(store, badge.emoji, `${profile.name} has claimed ${badge.name.toUpperCase()} for today`);
      await notify(store, profile.id, `You've claimed ${badge.name} for today. It is awarded at the day's end if it holds.`);
    }
  }
  await sweepBadges(store, Math.max(Date.now(), trigger.at));
}

/**
 * Awards the detector badges (extra.ts): looks over the whole record for
 * every time each one's condition has been met and awards any not yet given.
 * Cheap to repeat, so it runs after anything that could have earned one.
 */
export async function sweepBadges(store: Store, now = Date.now()): Promise<number> {
  const badges = (await listBadges(store)).filter((badge) => badge.active && badge.coded && badge.kind === "merit");
  if (badges.length === 0) return 0;
  const [world, profiles] = await Promise.all([loadWorld(store), store.listProfiles()]);
  let given = 0;
  for (const badge of badges) {
    const found = detect(badge.coded!, world, now);
    if (!found) continue;
    const since = CUMULATIVE.includes(badge.coded!) ? 0 : Date.parse(badge.createdAt);
    for (const occurrence of found) {
      if (occurrence.at < since || occurrence.at > now) continue;
      const profile = profiles.find((item) => item.id === occurrence.profileId);
      if (!profile) continue;
      const awarded = await awardBadge(store, badge, profile, {
        key: `${badge.id}:${occurrence.profileId}:${occurrence.key}`,
        period: partyDayOf(occurrence.at, world.cutoffHour),
        sourceIds: occurrence.sourceIds,
        at: occurrence.at,
      });
      if (awarded) given += 1;
    }
  }
  return given;
}

const DAYS_BACK = 2;

/** Locks in the achievements of every party day that has ended. Safe to repeat. */
export async function settleAchievements(store: Store, now = Date.now()): Promise<number> {
  const [badges, world, profiles] = await Promise.all([listBadges(store), loadWorld(store), store.listProfiles()]);
  let paid = 0;
  let day = partyDayOf(now - (DAYS_BACK + 1) * 24 * 3_600_000, world.cutoffHour);
  for (let i = 0; i <= DAYS_BACK; i++) {
    day = nextDay(day);
    const { end } = partyDayBounds(day, world.cutoffHour);
    if (end > now) continue;
    for (const badge of badges.filter(settles)) {
      const holder = holderFor(badge, world, day);
      const profile = profiles.find((item) => item.id === holder?.profileId);
      if (!profile) continue;
      // One holder per badge per day: the key has no person in it.
      if (await awardBadge(store, badge, profile, { key: `${badge.id}:${day}`, period: day, at: end })) paid += 1;
    }
  }
  // Some detector badges are about the clock (4:20, a finished day), not a log.
  return paid + (await sweepBadges(store, now));
}

export interface SleepingCandidate {
  day: string;
  postId: string | null;
  photoUrl: string | null;
  sleepers: string[];
  time: string | null;
  confirmed: boolean;
}

const sleepingBadge = (badges: Badge[]) => badges.find((badge) => badge.coded === "sleepingBeauty" && badge.active) ?? null;

/** Recent days and the asleep photo that would win Sleeping Beauty for each, for Admin to confirm. */
export async function sleepingCandidates(store: Store, now = Date.now()): Promise<SleepingCandidate[]> {
  const [badges, world, awards, profiles, posts] = await Promise.all([
    listBadges(store),
    loadWorld(store),
    listAwards(store),
    store.listProfiles(),
    store.listPosts(),
  ]);
  const badge = sleepingBadge(badges);
  if (!badge) return [];
  const candidates: SleepingCandidate[] = [];
  let day = partyDayOf(now - 3 * 24 * 3_600_000, world.cutoffHour);
  for (let i = 0; i < 3; i++) {
    day = nextDay(day);
    const { start, end } = partyDayBounds(day, world.cutoffHour);
    const photo = firstAsleepPhoto(world, start, end);
    const post = posts.find((item) => item.id === photo?.id);
    candidates.push({
      day,
      postId: photo?.id ?? null,
      // The preview, never the original file: see forGuests in feed.ts.
      photoUrl: post ? (post.previewUrl ?? post.url) : null,
      sleepers: (photo?.taggedIds ?? []).map((id) => nameOf(profiles, id)),
      time: photo ? formatTime(photo.at) : null,
      confirmed: awards.some((award) => award.badgeId === badge.id && award.period === day),
    });
  }
  return candidates.reverse();
}

/** Admin confirms the day's first asleep photo: everyone tagged in it gets the badge and the photo is pinned. */
export async function confirmSleepingBeauty(store: Store, day: string): Promise<number> {
  const [badges, world, profiles] = await Promise.all([listBadges(store), loadWorld(store), store.listProfiles()]);
  const badge = sleepingBadge(badges);
  if (!badge) throw new GameError("Sleeping Beauty is switched off.");
  const { start, end } = partyDayBounds(day, world.cutoffHour);
  const photo = firstAsleepPhoto(world, start, end);
  if (!photo) throw new GameError("There is no asleep photo with someone tagged for that day.");

  let given = 0;
  for (const id of photo.taggedIds) {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) continue;
    if (await awardBadge(store, badge, profile, { key: `${badge.id}:${day}:${id}`, period: day, sourceIds: [photo.id] })) given += 1;
  }
  // Pinned to the top of the feed until the day ends.
  if (given > 0) await store.updatePost(photo.id, { pinnedUntil: new Date(end).toISOString() });
  await sweepBadges(store);
  return given;
}

export async function awardManually(store: Store, badgeId: string, profileId: string, reason: string): Promise<void> {
  const [badges, profiles, settings] = await Promise.all([listBadges(store), store.listProfiles(), getSettings(store)]);
  const badge = badges.find((item) => item.id === badgeId);
  const profile = profiles.find((item) => item.id === profileId);
  if (!badge || !profile) throw new GameError("Pick a badge and a person.", 404);
  if (reason.length > 140) throw new GameError("The reason is too long (max 140 characters).");
  await awardBadge(store, badge, profile, {
    key: `${badge.id}:manual:${crypto.randomUUID()}`,
    period: partyDayOf(Date.now(), settings.dayCutoffHour),
    reason: reason.trim() || "Awarded by an admin",
  });
}

/** Re-prices every award of a badge already given, at the badge's current points. */
export async function recalculateBadge(store: Store, badgeId: string): Promise<number> {
  const [badges, awards] = await Promise.all([listBadges(store), listAwards(store)]);
  const badge = badges.find((item) => item.id === badgeId);
  if (!badge) throw new GameError("That badge is gone.", 404);
  let changed = 0;
  for (const award of awards.filter((item) => item.badgeId === badgeId)) {
    const record = await store.getRecord(award.id);
    if (!record) continue;
    const [old] = await store.voidPointEvents({ groupId: award.groupId });
    const groupId = crypto.randomUUID();
    await store.addPointEvent({
      profileId: award.profileId,
      delta: badge.points,
      reason: `Badge · ${badge.name} · recalculated`,
      challengeId: null,
      source: "badge",
      groupId,
      awardKey: `badge:recalc:${award.id}:${groupId}`,
      createdAt: old?.createdAt,
    });
    await store.updateRecord(award.id, { data: { ...record.data, groupId } });
    changed += 1;
  }
  return changed;
}

export interface BadgeView {
  id: string;
  name: string;
  description: string;
  emoji: string;
  imageUrl: string | null;
  kind: BadgeKind;
  points: number;
}

const view = (badge: Badge): BadgeView => ({
  id: badge.id,
  name: badge.name,
  description:
    badge.description || (badge.rule ? describeRule(badge.rule) : badge.coded ? codedDescriptions[badge.coded] : ""),
  emoji: badge.emoji,
  imageUrl: badge.imageUrl,
  kind: badge.kind,
  points: badge.points,
});

const mystery = (badge: Badge): BadgeView => ({
  id: badge.id,
  name: "???",
  description: "Hidden until someone earns it.",
  emoji: "❔",
  imageUrl: null,
  kind: badge.kind,
  points: badge.points,
});

export interface TrophyCase {
  /** Badges this person has, with how many times. */
  earned: Array<BadgeView & { count: number }>;
  /** Achievements they are leading today; awarded at the day's end if it holds. */
  leading: BadgeView[];
  /** Everything else, greyed out. */
  locked: BadgeView[];
}

export async function buildTrophyCase(store: Store, profileId: string, now = Date.now()): Promise<TrophyCase> {
  const [badges, awards, world] = await Promise.all([listBadges(store), listAwards(store), loadWorld(store)]);
  const today = partyDayOf(now, world.cutoffHour);
  const everEarned = new Set(awards.map((award) => award.badgeId));
  const mine = awards.filter((award) => award.profileId === profileId);

  const earned: TrophyCase["earned"] = [];
  const leading: BadgeView[] = [];
  const locked: BadgeView[] = [];
  for (const badge of badges) {
    const count = mine.filter((award) => award.badgeId === badge.id).length;
    if (count > 0) earned.push({ ...view(badge), count });
    if (!badge.active) continue;
    if (settles(badge) && holderFor(badge, world, today)?.profileId === profileId) leading.push(view(badge));
    else if (count === 0) locked.push(badge.hidden && !everEarned.has(badge.id) ? mystery(badge) : view(badge));
  }
  return { earned, leading, locked };
}

export interface BadgePop extends BadgeView {
  awardId: string;
}

/** Badges this person has earned and not yet been shown full-screen. */
export async function unseenPops(store: Store, profileId: string): Promise<BadgePop[]> {
  const awards = (await listAwards(store)).filter((award) => award.profileId === profileId && !award.seen);
  if (awards.length === 0) return [];
  const badges = await listBadges(store);
  return awards
    .reverse()
    .flatMap((award) => {
      const badge = badges.find((item) => item.id === award.badgeId);
      return badge ? [{ ...view(badge), awardId: award.id }] : [];
    })
    .slice(0, 5);
}

export async function markPopSeen(store: Store, profileId: string, awardId: string): Promise<void> {
  const record = await store.getRecord(awardId);
  if (record?.kind !== "badgeaward" || record.profileId !== profileId) return;
  await store.updateRecord(awardId, { data: { ...record.data, seen: true } });
}

export interface AdminBadge extends Badge {
  /** What it takes, in plain English (the rule's preview, or the coded condition). */
  condition: string | null;
  holders: Array<{ awardId: string; profileId: string; name: string; period: string; reason: string | null }>;
  /** Who is leading it today, for achievements that settle at the cutoff. */
  leader: string | null;
}

export interface AdminBadges {
  badges: AdminBadge[];
  people: Array<{ id: string; name: string }>;
  sleeping: SleepingCandidate[];
}

/** Everything Admin > Badges shows. Real names throughout. */
export async function buildAdminBadges(store: Store, now = Date.now()): Promise<AdminBadges> {
  const [badges, awards, profiles, world, sleeping] = await Promise.all([
    listBadges(store),
    listAwards(store),
    store.listProfiles(),
    loadWorld(store),
    sleepingCandidates(store, now),
  ]);
  const today = partyDayOf(now, world.cutoffHour);
  return {
    badges: badges.map((badge) => {
      const leader = settles(badge) ? holderFor(badge, world, today) : null;
      return {
        ...badge,
        condition: badge.rule ? describeRule(badge.rule) : badge.coded ? codedDescriptions[badge.coded] : null,
        holders: awards
          .filter((award) => award.badgeId === badge.id)
          .map((award) => ({
            awardId: award.id,
            profileId: award.profileId,
            name: nameOf(profiles, award.profileId),
            period: award.period,
            reason: award.reason,
          })),
        leader: leader ? nameOf(profiles, leader.profileId) : null,
      };
    }),
    people: profiles.map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    sleeping,
  };
}
