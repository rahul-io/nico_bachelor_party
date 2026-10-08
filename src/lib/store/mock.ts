import { seedEvents } from "@/data/seed";
import type { DrinkLog, Profile, ScheduleEvent, Store } from "./types";

interface MockData {
  profiles: Map<string, { profile: Profile; token: string }>;
  drinks: DrinkLog[];
  events: ScheduleEvent[];
}

// Kept on globalThis so the data survives hot reloads in dev.
const globalForMock = globalThis as typeof globalThis & { __mockData?: MockData };

function data(): MockData {
  globalForMock.__mockData ??= {
    profiles: new Map(),
    drinks: [],
    events: seedEvents.map((event) => ({ id: crypto.randomUUID(), ...event })),
  };
  return globalForMock.__mockData;
}

export const mockStore: Store = {
  async createProfile(input) {
    const profile: Profile = {
      id: crypto.randomUUID(),
      avatarUrl: null,
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

  async listDrinks(profileId) {
    return data()
      .drinks.filter((drink) => drink.profileId === profileId)
      .sort((a, b) => b.consumedAt.localeCompare(a.consumedAt));
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
    const drinks = data().drinks;
    const index = drinks.findIndex((d) => d.id === drinkId && d.profileId === profileId);
    if (index === -1) return false;
    drinks.splice(index, 1);
    return true;
  },

  async listEvents() {
    return [...data().events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },
};
