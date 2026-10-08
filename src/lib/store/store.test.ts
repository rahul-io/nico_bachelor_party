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
    });
    const early = await store.createEvent({
      startsAt: "2031-01-01T03:00:00.000Z",
      endsAt: "2031-01-01T04:30:00.000Z",
      title: "Early",
      location: "Somewhere",
      mapsQuery: "Somewhere, CA",
      notes: "Bring cash",
    });
    expect(early).toMatchObject({
      startsAt: "2031-01-01T03:00:00.000Z",
      endsAt: "2031-01-01T04:30:00.000Z",
      location: "Somewhere",
      notes: "Bring cash",
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
      mediaType: "image",
      caption: "Cheers",
      bacAtPost: 0.0623,
    });
    const video = await store.createPost({
      profileId: profile.id,
      url: "https://x.public.blob.vercel-storage.com/posts/b.mp4",
      mediaType: "video",
      caption: null,
      bacAtPost: null,
    });
    expect(photo).toMatchObject({ profileId: profile.id, mediaType: "image", caption: "Cheers", bacAtPost: 0.0623 });
    expect(photo.createdAt).toMatch(isoPattern);
    expect(video).toMatchObject({ mediaType: "video", caption: null, bacAtPost: null });
    expect(await store.getPost(photo.id)).toEqual(photo);
    expect(await store.getPost("missing")).toBeNull();

    const ids = (await store.listPosts()).map((p) => p.id);
    expect(ids.indexOf(video.id)).toBeLessThan(ids.indexOf(photo.id));

    expect(await store.deletePost(video.id)).toBe(true);
    expect(await store.deletePost(video.id)).toBe(false);
    await store.deleteProfile(profile.id);
    expect(await store.getPost(photo.id)).toBeNull();
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
    expect((await store.listPointEvents()).some((e) => e.id === points.id)).toBe(false);
  });
});
