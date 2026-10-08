import { seedChallenges, seedEvents, seedPeople } from "@/data/seed";
import { STANDARD_DRINK_G } from "@/lib/bac";
import type { Challenge, DrinkLog, PointEvent, Post, Profile, ScheduleEvent, Store } from "./types";

interface MockData {
  profiles: Map<string, { profile: Profile; token: string }>;
  avatars: Map<string, string>;
  drinks: DrinkLog[];
  events: ScheduleEvent[];
  challenges: Challenge[];
  pointEvents: PointEvent[];
  posts: Post[];
}

// Kept on globalThis so the data survives hot reloads in dev.
const globalForMock = globalThis as typeof globalThis & { __mockData?: MockData };

const MINUTE_MS = 60_000;

function seed(): MockData {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const data: MockData = {
    profiles: new Map(),
    avatars: new Map(),
    drinks: [],
    events: seedEvents.map((event) => ({ id: crypto.randomUUID(), ...event })),
    challenges: seedChallenges.map((challenge, index) => ({
      id: crypto.randomUUID(),
      active: true,
      createdAt: iso(now + index),
      ...challenge,
    })),
    pointEvents: [],
    posts: [],
  };

  // Demo guests so the leaderboard isn't empty in mock mode.
  for (const person of seedPeople) {
    const id = crypto.randomUUID();
    data.profiles.set(id, {
      token: crypto.randomUUID(),
      profile: {
        id,
        name: person.name,
        avatarUrl: null,
        heightCm: person.heightCm,
        weightKg: person.weightKg,
        sex: "male",
        showBacOnPosts: true,
        createdAt: iso(now),
      },
    });
    for (let i = 0; i < person.drinks; i++) {
      data.drinks.push({
        id: crypto.randomUUID(),
        profileId: id,
        name: "Beer",
        volumeOz: null,
        abv: null,
        alcoholG: STANDARD_DRINK_G,
        consumedAt: iso(now - (10 + 25 * i) * MINUTE_MS),
      });
    }
    if (person.points !== 0) {
      data.pointEvents.push({
        id: crypto.randomUUID(),
        profileId: id,
        delta: person.points,
        reason: person.reason,
        challengeId: null,
        createdAt: iso(now - 30 * MINUTE_MS),
      });
    }
  }
  return data;
}

function data(): MockData {
  globalForMock.__mockData ??= seed();
  return globalForMock.__mockData;
}

function removeWhere<T>(items: T[], match: (item: T) => boolean): boolean {
  const before = items.length;
  for (let i = items.length - 1; i >= 0; i--) {
    if (match(items[i])) items.splice(i, 1);
  }
  return items.length < before;
}

export const mockStore: Store = {
  async createProfile(input) {
    const profile: Profile = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    const token = crypto.randomUUID();
    data().profiles.set(profile.id, { profile, token });
    return { profile, token };
  },

  async getProfileByToken(id, token) {
    const entry = data().profiles.get(id);
    return entry && entry.token === token ? entry.profile : null;
  },

  async updateProfile(id, input) {
    const entry = data().profiles.get(id);
    if (!entry) throw new Error(`Profile ${id} not found`);
    entry.profile = { ...entry.profile, ...input };
    return entry.profile;
  },

  async listProfiles() {
    return [...data().profiles.values()].map((entry) => entry.profile);
  },

  async deleteProfile(id) {
    const store = data();
    if (!store.profiles.delete(id)) return false;
    store.avatars.delete(id);
    removeWhere(store.drinks, (drink) => drink.profileId === id);
    removeWhere(store.pointEvents, (event) => event.profileId === id);
    removeWhere(store.posts, (post) => post.profileId === id);
    return true;
  },

  async setAvatarData(id, dataUrl) {
    if (dataUrl) data().avatars.set(id, dataUrl);
    else data().avatars.delete(id);
  },

  async getAvatarData(id) {
    return data().avatars.get(id) ?? null;
  },

  async listDrinks(profileId) {
    // Reversed first so entries logged in the same millisecond still come out newest first.
    return data()
      .drinks.filter((drink) => drink.profileId === profileId)
      .reverse()
      .sort((a, b) => b.consumedAt.localeCompare(a.consumedAt));
  },

  async listAllDrinks() {
    return [...data().drinks];
  },

  async addDrink(profileId, input) {
    const drink: DrinkLog = {
      id: crypto.randomUUID(),
      profileId,
      consumedAt: new Date().toISOString(),
      ...input,
    };
    data().drinks.push(drink);
    return drink;
  },

  async deleteDrink(profileId, drinkId) {
    return removeWhere(data().drinks, (d) => d.id === drinkId && d.profileId === profileId);
  },

  async listEvents() {
    return [...data().events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },

  async createEvent(input) {
    const event: ScheduleEvent = { id: crypto.randomUUID(), ...input };
    data().events.push(event);
    return event;
  },

  async updateEvent(id, input) {
    const events = data().events;
    const index = events.findIndex((event) => event.id === id);
    if (index === -1) return null;
    events[index] = { id, ...input };
    return events[index];
  },

  async deleteEvent(id) {
    return removeWhere(data().events, (event) => event.id === id);
  },

  async listChallenges() {
    return [...data().challenges].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async createChallenge(input) {
    const challenge: Challenge = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    data().challenges.push(challenge);
    return challenge;
  },

  async updateChallenge(id, input) {
    const challenges = data().challenges;
    const index = challenges.findIndex((challenge) => challenge.id === id);
    if (index === -1) return null;
    challenges[index] = { ...challenges[index], ...input };
    return challenges[index];
  },

  async deleteChallenge(id) {
    const store = data();
    if (!removeWhere(store.challenges, (challenge) => challenge.id === id)) return false;
    // Awarded points stay in the ledger; they just lose the link.
    for (const event of store.pointEvents) {
      if (event.challengeId === id) event.challengeId = null;
    }
    return true;
  },

  async listPointEvents() {
    return [...data().pointEvents]
      .reverse()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async addPointEvent(input) {
    const event: PointEvent = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    data().pointEvents.push(event);
    return event;
  },

  async listPosts() {
    return [...data().posts].reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getPost(id) {
    return data().posts.find((post) => post.id === id) ?? null;
  },

  async createPost(input) {
    const post: Post = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...input, previewUrl: input.previewUrl ?? null };
    data().posts.push(post);
    return post;
  },

  async deletePost(id) {
    return removeWhere(data().posts, (post) => post.id === id);
  },
};
