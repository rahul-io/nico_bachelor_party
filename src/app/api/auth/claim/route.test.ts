import { afterEach, expect, it, vi } from "vitest";
import { mockStore } from "@/lib/store/mock";
import type { ProfileInput } from "@/lib/store/types";
import { POST } from "./route";

const startSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({ startSession }));
// Always the in-memory store, whatever database the machine's environment points at.
vi.mock("@/lib/store", async () => {
  const { mockStore: store } = await import("@/lib/store/mock");
  return { getStore: () => store };
});

afterEach(() => vi.clearAllMocks());

const person = (name: string): ProfileInput => ({
  name,
  avatarUrl: null,
  heightCm: 180,
  weightKg: 80,
  sex: "male",
  showBacOnPosts: true,
});

const claim = (body: unknown) =>
  POST(new Request("http://localhost/api/auth/claim", { method: "POST", body: JSON.stringify(body) }));

it("lets a pre-accounts device set a password once, then retires its token", async () => {
  const name = `Old Salt ${crypto.randomUUID().slice(0, 8)}`;
  const { profile, token } = await mockStore.createProfile(person(name));

  expect((await claim({ id: profile.id, token: "wrong", password: "grog-ration" })).status).toBe(401);
  expect((await claim({ id: profile.id, token, password: "short" })).status).toBe(400);
  expect(startSession).not.toHaveBeenCalled();

  const response = await claim({ id: profile.id, token, password: "grog-ration" });
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.profile).toMatchObject({ id: profile.id, name, hasPassword: true });
  expect(JSON.stringify(body)).not.toContain("grog-ration");
  expect(startSession).toHaveBeenCalledOnce();

  // The stored value is a hash, and the same token can't be used again.
  const account = await mockStore.findAccountByName(name);
  expect(account?.passwordHash).toMatch(/^\$2[aby]\$/);
  expect((await claim({ id: profile.id, token, password: "another-go" })).status).toBe(401);
  await mockStore.deleteProfile(profile.id);
});

it("asks for a new name when an account already uses the old one", async () => {
  const name = `Deckhand ${crypto.randomUUID().slice(0, 8)}`;
  const legacy = await mockStore.createProfile(person(name));
  const taken = await mockStore.createProfile(person(name.toUpperCase()), "existing-hash");

  const clash = await claim({ id: legacy.profile.id, token: legacy.token, password: "grog-ration" });
  expect(clash.status).toBe(409);
  expect(await clash.json()).toMatchObject({ code: "name_taken" });

  const renamed = await claim({ id: legacy.profile.id, token: legacy.token, password: "grog-ration", name: `${name} II` });
  expect(renamed.status).toBe(200);
  expect((await renamed.json()).profile.name).toBe(`${name} II`);

  await mockStore.deleteProfile(legacy.profile.id);
  await mockStore.deleteProfile(taken.profile.id);
});
