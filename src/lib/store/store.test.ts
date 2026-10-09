import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import { mockStore } from "./mock";
import { createPostgresStore, type Sql } from "./postgres";
import type { ProfileInput, Store } from "./types";

/** The real schema and the real queries, run against an in-process Postgres. */
async function createPgliteStore(): Promise<Store> {
  const db = new PGlite();
  await db.exec(readFileSync("db/schema.sql", "utf8"));
  const sql: Sql = async (strings, ...values) => {
    const text = strings.reduce((query, part, index) => `${query}$${index}${part}`);
    return (await db.query<Record<string, unknown>>(text, values)).rows;
  };
  return createPostgresStore(sql);
}

vi.setConfig({ testTimeout: 30_000 });

const person: ProfileInput = {
  name: "Contract Test",
  avatarUrl: null,
  heightCm: 180.34,
  weightKg: 79.8,
  sex: "male",
  showBacOnPosts: true,
};

const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Starting the in-process database is slow, so every test shares one instance.
let shared: Promise<Store> | undefined;
const pgliteStore = () => (shared ??= createPgliteStore());

// Both implementations must behave identically; the mock starts with seed data,
// so assertions only look at rows the test created.
describe.each<[string, () => Promise<Store>]>([
  ["mock store", async () => mockStore],
  ["postgres store", pgliteStore],
])("%s", (_name, makeStore) => {
  it("creates, authenticates, updates and lists profiles", async () => {
    const store = await makeStore();
    const { profile, token } = await store.createProfile(person);

    expect(profile).toMatchObject(person);
    expect(profile.createdAt).toMatch(isoPattern);
    expect(await store.getProfileByToken(profile.id, token)).toEqual(profile);
    expect(await store.getProfileByToken(profile.id, "wrong")).toBeNull();
    expect(await store.getProfileByToken("not-a-uuid", token)).toBeNull();

    const updated = await store.updateProfile(profile.id, {
      ...person,
      name: "Renamed",
      sex: "female",
      showBacOnPosts: false,
      avatarUrl: "/api/avatars/x?v=1",
    });
    expect(updated).toMatchObject({ id: profile.id, name: "Renamed", sex: "female", showBacOnPosts: false });
    expect((await store.listProfiles()).find((p) => p.id === profile.id)).toEqual(updated);
    await expect(store.updateProfile("missing", person)).rejects.toThrow();
  });

  it("turns profiles into accounts with unique names, passwords and session versions", async () => {
    const store = await makeStore();
    const unique = `Skipper ${crypto.randomUUID().slice(0, 8)}`;

    // A legacy profile: no password, claimable with its device token.
    const legacy = await store.createProfile({ ...person, name: unique });
    expect(legacy.profile).toMatchObject({ hasPassword: false, mustChangePassword: false, sessionVersion: 1 });
    expect(await store.getProfile(legacy.profile.id)).toEqual(legacy.profile);
    expect(await store.getProfile("missing")).toBeNull();
    expect(await store.findAccountByName(unique)).toBeNull();
    expect(await store.isNameTaken(unique)).toBe(false);

    // Setting a password makes it an account and retires the token.
    const claimed = await store.setPassword(legacy.profile.id, "hash-1", { mustChange: false, signOutEverywhere: false });
    expect(claimed).toMatchObject({ hasPassword: true, mustChangePassword: false, sessionVersion: 1 });
    expect(await store.getProfileByToken(legacy.profile.id, legacy.token)).toBeNull();

    const found = await store.findAccountByName(`  ${unique.toUpperCase()} `);
    expect(found?.profile.id).toBe(legacy.profile.id);
    expect(found?.passwordHash).toBe("hash-1");
    expect(JSON.stringify(await store.listProfiles())).not.toContain("hash-1");

    expect(await store.isNameTaken(unique.toLowerCase())).toBe(true);
    expect(await store.isNameTaken(unique, legacy.profile.id)).toBe(false);

    // An admin reset: new hash, must change, every session invalid.
    const reset = await store.setPassword(legacy.profile.id, "hash-2", { mustChange: true, signOutEverywhere: true });
    expect(reset).toMatchObject({ mustChangePassword: true, sessionVersion: 2 });
    expect((await store.findAccountByName(unique))?.passwordHash).toBe("hash-2");
    expect(await store.setPassword("missing", "x", { mustChange: false, signOutEverywhere: false })).toBeNull();

    // New accounts are created with their hash.
    const other = `Bosun ${crypto.randomUUID().slice(0, 8)}`;
    const account = await store.createProfile({ ...person, name: other }, "hash-3");
    expect(account.profile.hasPassword).toBe(true);
    expect((await store.findAccountByName(other))?.passwordHash).toBe("hash-3");

    await store.deleteProfile(legacy.profile.id);
    await store.deleteProfile(account.profile.id);
    expect(await store.findAccountByName(unique)).toBeNull();
  });

  it("counts failed attempts per key within a window", async () => {
    const store = await makeStore();
    const key = `login:name:${crypto.randomUUID()}`;
    const before = Date.now() - 1000;
    expect(await store.countAttempts(key, before)).toBe(0);
    await store.recordAttempt(key);
    await store.recordAttempt(key);
    await store.recordAttempt(`${key}-other`);
    expect(await store.countAttempts(key, before)).toBe(2);
    expect(await store.countAttempts(key, Date.now() + 60_000)).toBe(0);
    await store.clearAttempts(key);
    expect(await store.countAttempts(key, before)).toBe(0);
    expect(await store.countAttempts(`${key}-other`, before)).toBe(1);
    await store.clearAttempts(`${key}-other`);
  });

  it("stores avatar data separately from the profile", async () => {
    const store = await makeStore();
    const { profile } = await store.createProfile(person);
    expect(await store.getAvatarData(profile.id)).toBeNull();
    await store.setAvatarData(profile.id, "data:image/jpeg;base64,AAAA");
    expect(await store.getAvatarData(profile.id)).toBe("data:image/jpeg;base64,AAAA");
    expect(JSON.stringify(await store.listProfiles())).not.toContain("base64");
    await store.setAvatarData(profile.id, null);
    expect(await store.getAvatarData(profile.id)).toBeNull();
    expect(await store.getAvatarData("missing")).toBeNull();
  });

  it("logs and deletes drinks per profile", async () => {
    const store = await makeStore();
    const a = (await store.createProfile(person)).profile;
    const b = (await store.createProfile(person)).profile;

    const beer = await store.addDrink(a.id, { name: "Beer", volumeOz: 12, abv: 0.05, alcoholG: 14 });
    const standard = await store.addDrink(a.id, { name: "Standard", volumeOz: null, abv: null, alcoholG: 14 });
    expect(beer).toMatchObject({ profileId: a.id, name: "Beer", volumeOz: 12, abv: 0.05, alcoholG: 14 });
    expect(standard).toMatchObject({ volumeOz: null, abv: null });
    expect(beer.consumedAt).toMatch(isoPattern);

    expect((await store.listDrinks(a.id)).map((d) => d.id).sort()).toEqual([beer.id, standard.id].sort());
    expect(await store.listDrinks(b.id)).toEqual([]);
    expect((await store.listAllDrinks()).some((d) => d.id === beer.id)).toBe(true);

    expect(await store.deleteDrink(b.id, beer.id)).toBe(false);
    expect(await store.deleteDrink(a.id, beer.id)).toBe(true);
    expect(await store.deleteDrink(a.id, beer.id)).toBe(false);
    expect((await store.listDrinks(a.id)).map((d) => d.id)).toEqual([standard.id]);
  });

  it("creates, updates, orders and deletes events", async () => {
    const store = await makeStore();
    const late = await store.createEvent({
      startsAt: "2031-01-02T03:00:00.000Z",
      endsAt: null,
      title: "Late",
      location: null,
      mapsQuery: null,
      notes: null,
      lat: null,
      lng: null,
    });
    const early = await store.createEvent({
      startsAt: "2031-01-01T03:00:00.000Z",
      endsAt: "2031-01-01T04:30:00.000Z",
      title: "Early",
      location: "Somewhere",
      mapsQuery: "Somewhere, CA",
      notes: "Bring cash",
      lat: 32.7157,
      lng: -117.1611,
    });
    expect(early).toMatchObject({
      startsAt: "2031-01-01T03:00:00.000Z",
      endsAt: "2031-01-01T04:30:00.000Z",
      location: "Somewhere",
      notes: "Bring cash",
      lat: 32.7157,
      lng: -117.1611,
    });

    const ids = (await store.listEvents()).map((e) => e.id);
    expect(ids.indexOf(early.id)).toBeLessThan(ids.indexOf(late.id));

    const moved = await store.updateEvent(late.id, { ...late, title: "Moved", startsAt: "2030-12-31T03:00:00.000Z" });
    expect(moved).toMatchObject({ id: late.id, title: "Moved", startsAt: "2030-12-31T03:00:00.000Z" });
    expect(await store.updateEvent("missing", late)).toBeNull();

    expect(await store.deleteEvent(early.id)).toBe(true);
    expect(await store.deleteEvent(early.id)).toBe(false);
  });

  it("keeps awarded points when a challenge is deleted", async () => {
    const store = await makeStore();
    const { profile } = await store.createProfile(person);
    const challenge = await store.createChallenge({ title: "Test", description: "", points: 25, active: true });
    expect(challenge).toMatchObject({ title: "Test", description: "", points: 25, active: true });

    const hidden = await store.updateChallenge(challenge.id, { ...challenge, active: false, points: 30 });
    expect(hidden).toMatchObject({ id: challenge.id, active: false, points: 30 });
    expect(await store.updateChallenge("missing", challenge)).toBeNull();
    expect((await store.listChallenges()).some((c) => c.id === challenge.id)).toBe(true);

    const award = await store.addPointEvent({
      profileId: profile.id,
      delta: 30,
      reason: "Test",
      challengeId: challenge.id,
    });
    const penalty = await store.addPointEvent({ profileId: profile.id, delta: -5, reason: null, challengeId: null });
    if (!award || !penalty) throw new Error("point events were not created");
    expect(award).toMatchObject({ profileId: profile.id, delta: 30, reason: "Test", challengeId: challenge.id });
    expect(penalty).toMatchObject({ delta: -5, reason: null, challengeId: null });

    const ids = (await store.listPointEvents()).map((e) => e.id);
    expect(ids.indexOf(penalty.id)).toBeLessThan(ids.indexOf(award.id));

    expect(await store.deleteChallenge(challenge.id)).toBe(true);
    expect(await store.deleteChallenge(challenge.id)).toBe(false);
    const kept = (await store.listPointEvents()).find((e) => e.id === award.id);
    expect(kept).toMatchObject({ delta: 30, reason: "Test", challengeId: null });
  });

  it("stores posts with their BAC snapshot and removes them with the profile", async () => {
    const store = await makeStore();
    const { profile } = await store.createProfile(person);
    const photo = await store.createPost({
      profileId: profile.id,
      url: "https://x.public.blob.vercel-storage.com/posts/a.jpg",
      previewUrl: "https://x.public.blob.vercel-storage.com/posts/preview-a.jpg",
      mediaType: "image",
      caption: "Cheers",
      bacAtPost: 0.0623,
      lat: 32.7157,
      lng: -117.1611,
      locationSource: "exif",
      eventId: null,
    });
    const video = await store.createPost({
      profileId: profile.id,
      url: "https://x.public.blob.vercel-storage.com/posts/b.mp4",
      mediaType: "video",
      caption: null,
      bacAtPost: null,
      lat: null,
      lng: null,
      locationSource: null,
      eventId: null,
    });
    expect(photo).toMatchObject({
      profileId: profile.id,
      mediaType: "image",
      caption: "Cheers",
      bacAtPost: 0.0623,
      lat: 32.7157,
      lng: -117.1611,
      locationSource: "exif",
      eventId: null,
    });
    expect(photo.createdAt).toMatch(isoPattern);
    expect(photo.previewUrl).toBe("https://x.public.blob.vercel-storage.com/posts/preview-a.jpg");
    expect((await store.listPosts()).find((p) => p.id === photo.id)?.previewUrl).toBe(photo.previewUrl);
    expect(video.previewUrl).toBeNull();
    expect(video).toMatchObject({ mediaType: "video", caption: null, bacAtPost: null, lat: null, lng: null, locationSource: null });
    expect(await store.getPost(photo.id)).toEqual(photo);
    expect(await store.getPost("missing")).toBeNull();

    const ids = (await store.listPosts()).map((p) => p.id);
    expect(ids.indexOf(video.id)).toBeLessThan(ids.indexOf(photo.id));

    expect(await store.deletePost(video.id)).toBe(true);
    expect(await store.deletePost(video.id)).toBe(false);
    await store.deleteProfile(profile.id);
    expect(await store.getPost(photo.id)).toBeNull();
  });

  it("keeps a tagged photo's coordinates when its event is deleted", async () => {
    const store = await makeStore();
    const { profile } = await store.createProfile(person);
    const event = await store.createEvent({
      startsAt: "2031-02-01T03:00:00.000Z",
      endsAt: null,
      title: "Tagged",
      location: null,
      mapsQuery: null,
      notes: null,
      lat: 32.9,
      lng: -117.24,
    });
    expect(event).toMatchObject({ lat: 32.9, lng: -117.24 });
    expect(await store.updateEvent(event.id, { ...event, lat: null, lng: null })).toMatchObject({ lat: null, lng: null });

    const post = await store.createPost({
      profileId: profile.id,
      url: "https://x.public.blob.vercel-storage.com/posts/c.jpg",
      mediaType: "image",
      caption: null,
      bacAtPost: null,
      lat: 32.9,
      lng: -117.24,
      locationSource: "event",
      eventId: event.id,
    });
    expect(post.eventId).toBe(event.id);

    await store.deleteEvent(event.id);
    expect(await store.getPost(post.id)).toMatchObject({ lat: 32.9, lng: -117.24, locationSource: "event", eventId: null });
    await store.deleteProfile(profile.id);
  });

  it("tallies reactions per post and viewer", async () => {
    const store = await makeStore();
    const a = (await store.createProfile(person)).profile;
    const b = (await store.createProfile(person)).profile;
    const base = { url: "https://x.public.blob.vercel-storage.com/posts/r.jpg", mediaType: "image" as const, caption: null, bacAtPost: null, lat: null, lng: null, locationSource: null, eventId: null };
    const post = await store.createPost({ ...base, profileId: a.id });
    const other = await store.createPost({ ...base, profileId: a.id });

    await store.setReaction({ postId: post.id, profileId: a.id, emoji: "🔥" }, true);
    await store.setReaction({ postId: post.id, profileId: a.id, emoji: "🔥" }, true);
    await store.setReaction({ postId: post.id, profileId: b.id, emoji: "🔥" }, true);
    await store.setReaction({ postId: post.id, profileId: b.id, emoji: "🍺" }, true);
    await store.setReaction({ postId: other.id, profileId: b.id, emoji: "💀" }, true);
    await store.setReaction({ postId: other.id, profileId: a.id, emoji: "💀" }, false);

    const forPost = async (viewer: string | null) =>
      (await store.reactionCounts(viewer))
        .filter((entry) => entry.postId === post.id)
        .sort((x, y) => x.emoji.localeCompare(y.emoji));
    expect(await forPost(a.id)).toEqual([
      { postId: post.id, emoji: "🍺", count: 1, mine: false },
      { postId: post.id, emoji: "🔥", count: 2, mine: true },
    ].sort((x, y) => x.emoji.localeCompare(y.emoji)));
    expect((await forPost(null)).every((entry) => entry.mine === false)).toBe(true);
    expect((await store.listPostReactions(post.id)).map((r) => r.profileId + r.emoji).sort()).toEqual(
      [a.id + "🔥", b.id + "🔥", b.id + "🍺"].sort(),
    );

    await store.setReaction({ postId: post.id, profileId: a.id, emoji: "🔥" }, false);
    expect((await forPost(a.id)).find((entry) => entry.emoji === "🔥")).toMatchObject({ count: 1, mine: false });

    // Reactions go when the reactor's profile or the post goes.
    await store.deleteProfile(b.id);
    expect(await forPost(a.id)).toEqual([]);
    await store.setReaction({ postId: other.id, profileId: a.id, emoji: "💀" }, true);
    await store.deletePost(other.id);
    expect((await store.reactionCounts(a.id)).some((entry) => entry.postId === other.id)).toBe(false);
    await store.deleteProfile(a.id);
  });

  it("stores comments with their BAC snapshot, oldest first", async () => {
    const store = await makeStore();
    const a = (await store.createProfile(person)).profile;
    const b = (await store.createProfile(person)).profile;
    const post = await store.createPost({
      profileId: a.id,
      url: "https://x.public.blob.vercel-storage.com/posts/k.jpg",
      mediaType: "image",
      caption: null,
      bacAtPost: null,
      lat: null,
      lng: null,
      locationSource: null,
      eventId: null,
    });

    const first = await store.addComment({ postId: post.id, profileId: a.id, body: "First", bacAtComment: 0.041 });
    const photoUrl = "https://x.public.blob.vercel-storage.com/comments/b/photo.jpg";
    const second = await store.addComment({ postId: post.id, profileId: b.id, body: "", photoUrl, bacAtComment: null });
    expect(first).toMatchObject({ postId: post.id, profileId: a.id, body: "First", bacAtComment: 0.041 });
    expect(first.createdAt).toMatch(isoPattern);
    expect(second.bacAtComment).toBeNull();
    expect(first.photoUrl).toBeNull();
    expect(second).toMatchObject({ body: "", photoUrl });
    expect(await store.getComment(second.id)).toEqual(second);

    expect((await store.listComments(post.id)).map((c) => c.id)).toEqual([first.id, second.id]);
    expect(await store.getComment(first.id)).toEqual(first);
    expect(await store.getComment("missing")).toBeNull();
    expect((await store.commentCounts()).find((entry) => entry.postId === post.id)?.count).toBe(2);
    expect((await store.listAllComments()).filter((c) => c.postId === post.id)).toHaveLength(2);

    expect(await store.deleteComment(first.id)).toBe(true);
    expect(await store.deleteComment(first.id)).toBe(false);
    await store.deleteProfile(b.id);
    expect(await store.listComments(post.id)).toEqual([]);
    expect((await store.commentCounts()).some((entry) => entry.postId === post.id)).toBe(false);
    await store.deleteProfile(a.id);
  });

  it("removes a profile's drinks and points with the profile", async () => {
    const store = await makeStore();
    const { profile, token } = await store.createProfile(person);
    const drink = await store.addDrink(profile.id, { name: "Beer", volumeOz: 12, abv: 0.05, alcoholG: 14 });
    const points = await store.addPointEvent({ profileId: profile.id, delta: 10, reason: null, challengeId: null });

    expect(await store.deleteProfile(profile.id)).toBe(true);
    expect(await store.deleteProfile(profile.id)).toBe(false);
    expect(await store.getProfileByToken(profile.id, token)).toBeNull();
    expect((await store.listAllDrinks()).some((d) => d.id === drink.id)).toBe(false);
    expect((await store.listPointEvents()).some((e) => e.id === points?.id)).toBe(false);
  });

  it("keeps the points ledger: decimals, sources, award keys and voids", async () => {
    const store = await makeStore();
    const { profile } = await store.createProfile(person);
    const drink = await store.addDrink(profile.id, { name: "IPA", volumeOz: 16, abv: 0.065, alcoholG: 24.3, category: "beer" });
    expect(drink.category).toBe("beer");
    expect((await store.addDrink(profile.id, { name: "Mystery", volumeOz: null, abv: null, alcoholG: 14 })).category).toBeNull();

    const breakdown = { std: 1.4, counted: 1.4, rate: 3, multipliers: [{ label: "hydration", factor: 1.5 }], multiplier: 1.5, paused: false };
    const key = `drink:${drink.id}`;
    const entry = await store.addPointEvent({
      profileId: profile.id,
      delta: 6.3,
      reason: "IPA",
      challengeId: null,
      source: "drink",
      breakdown,
      drinkId: drink.id,
      groupId: "group-1",
      awardKey: key,
      createdAt: "2026-10-09T03:00:00.000Z",
    });
    expect(entry).toMatchObject({
      delta: 6.3,
      source: "drink",
      breakdown,
      drinkId: drink.id,
      groupId: "group-1",
      awardKey: key,
      voidedAt: null,
      createdAt: "2026-10-09T03:00:00.000Z",
    });

    // The same award key can't be paid twice.
    expect(await store.addPointEvent({ profileId: profile.id, delta: 6.3, reason: null, challengeId: null, awardKey: key })).toBeNull();

    // Entries without a source are admin entries, as before.
    const manual = await store.addPointEvent({ profileId: profile.id, delta: 2, reason: null, challengeId: null });
    expect(manual).toMatchObject({ source: "admin", breakdown: null, drinkId: null, awardKey: null });

    const own = await store.listPointEvents(profile.id);
    expect(own.map((event) => event.id).sort()).toEqual([entry!.id, manual!.id].sort());
    expect((await store.listPointEvents()).length).toBeGreaterThanOrEqual(2);

    const voided = await store.voidPointEvents({ drinkId: drink.id });
    expect(voided.map((event) => event.id)).toEqual([entry!.id]);
    expect(voided[0].voidedAt).toMatch(isoPattern);
    expect(await store.voidPointEvents({ drinkId: drink.id })).toEqual([]);
    expect((await store.listPointEvents(profile.id)).find((event) => event.id === entry!.id)?.voidedAt).toMatch(isoPattern);

    const grouped = await store.addPointEvent({ profileId: profile.id, delta: 3, reason: "Cheers", challengeId: null, source: "cheers", groupId: "group-2" });
    expect((await store.voidPointEvents({ groupId: "group-2" })).map((event) => event.id)).toEqual([grouped!.id]);
  });

  it("logs and deletes waters apart from drinks", async () => {
    const store = await makeStore();
    const { profile } = await store.createProfile(person);
    const first = await store.addWater(profile.id);
    const second = await store.addWater(profile.id);
    expect(first).toMatchObject({ profileId: profile.id });
    expect(first.consumedAt).toMatch(isoPattern);

    expect((await store.listWaters(profile.id)).map((water) => water.id).sort()).toEqual([first.id, second.id].sort());
    expect((await store.listAllWaters()).some((water) => water.id === first.id)).toBe(true);
    expect(await store.listDrinks(profile.id)).toEqual([]);

    expect(await store.deleteWater("someone-else", first.id)).toBe(false);
    expect(await store.deleteWater(profile.id, first.id)).toBe(true);
    expect(await store.deleteWater(profile.id, first.id)).toBe(false);

    await store.deleteProfile(profile.id);
    expect((await store.listAllWaters()).some((water) => water.id === second.id)).toBe(false);
  });

  it("stores and replaces settings", async () => {
    const store = await makeStore();
    const key = `test.${crypto.randomUUID()}`;
    expect(await store.getSetting(key)).toBeNull();
    await store.setSetting(key, { paceCap: 6, nested: { on: true }, list: [1, "two"] });
    expect(await store.getSetting(key)).toEqual({ paceCap: 6, nested: { on: true }, list: [1, "two"] });
    await store.setSetting(key, {});
    expect(await store.getSetting(key)).toEqual({});
  });

  it("keeps game records with a guarded status change", async () => {
    const store = await makeStore();
    const { profile } = await store.createProfile(person);
    const kind = `test-${crypto.randomUUID()}`;
    const first = await store.addRecord({ kind, profileId: profile.id, status: "open", data: { stake: 5, sides: ["a", "b"] } });
    const second = await store.addRecord({ kind, profileId: null, status: "done", data: {} });
    expect(first).toMatchObject({ kind, profileId: profile.id, status: "open", data: { stake: 5, sides: ["a", "b"] } });
    expect(first.createdAt).toMatch(isoPattern);

    expect((await store.listRecords(kind)).map((record) => record.id).sort()).toEqual([first.id, second.id].sort());
    expect((await store.listRecords(kind, "open")).map((record) => record.id)).toEqual([first.id]);
    expect(await store.getRecord(first.id)).toEqual(first);
    expect(await store.getRecord("missing")).toBeNull();

    // Only one of two simultaneous accepts wins.
    expect(await store.updateRecord(first.id, { status: "accepted" }, "open")).toMatchObject({ status: "accepted", data: first.data });
    expect(await store.updateRecord(first.id, { status: "accepted" }, "open")).toBeNull();
    expect(await store.updateRecord(first.id, { data: { stake: 9 } })).toMatchObject({ status: "accepted", data: { stake: 9 } });
    expect(await store.updateRecord("missing", { status: "x" })).toBeNull();

    await store.deleteProfile(profile.id);
    expect((await store.listRecords(kind)).map((record) => record.id)).toEqual([second.id]);
  });

  it("stores photo tags, the asleep mark and the pin", async () => {
    const store = await makeStore();
    const { profile } = await store.createProfile(person);
    const base = { profileId: profile.id, url: "https://example.test/a.jpg", mediaType: "image" as const, caption: null, bacAtPost: null, lat: null, lng: null, locationSource: null, eventId: null };
    const plain = await store.createPost(base);
    expect(plain).toMatchObject({ taggedIds: [], asleep: false, pinnedUntil: null });

    const tagged = await store.createPost({ ...base, taggedIds: ["a", "b"], asleep: true });
    expect(tagged).toMatchObject({ taggedIds: ["a", "b"], asleep: true, pinnedUntil: null });

    expect(await store.updatePost(tagged.id, { taggedIds: ["b"] })).toMatchObject({ taggedIds: ["b"], asleep: true, pinnedUntil: null });
    const pinned = await store.updatePost(tagged.id, { pinnedUntil: "2026-10-10T11:00:00.000Z" });
    expect(pinned).toMatchObject({ taggedIds: ["b"], pinnedUntil: "2026-10-10T11:00:00.000Z" });
    expect(await store.getPost(tagged.id)).toEqual(pinned);
    expect((await store.updatePost(tagged.id, { pinnedUntil: null }))?.pinnedUntil).toBeNull();
    expect(await store.updatePost("missing", { taggedIds: [] })).toBeNull();
  });
});
