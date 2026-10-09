import { head } from "@vercel/blob";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getRequestProfile } from "@/lib/http";
import { mediaRules, MOCK_IMAGE_MAX_CHARS } from "@/lib/media";
import { MAX_COMMENT } from "@/lib/reactions";
import { mockStore } from "@/lib/store/mock";
import type { Post, Profile } from "@/lib/store/types";
import { POST } from "./route";

vi.mock("@vercel/blob", () => ({ head: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/http", async (original) => ({ ...await original<typeof import("@/lib/http")>(), getRequestProfile: vi.fn() }));
vi.mock("@/lib/store", async () => {
  const { mockStore: store } = await import("@/lib/store/mock");
  return { getStore: () => store };
});

let profile: Profile;
let post: Post;
beforeEach(async () => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  profile = (await mockStore.createProfile({ name: "Commenter", avatarUrl: null, heightCm: 180, weightKg: 80, sex: "male", showBacOnPosts: false })).profile;
  post = await mockStore.createPost({ profileId: profile.id, url: "data:image/jpeg;base64,AAAA", mediaType: "image", caption: null, bacAtPost: null, lat: null, lng: null, locationSource: null, eventId: null });
  vi.mocked(getRequestProfile).mockResolvedValue(profile);
});
afterEach(async () => {
  await mockStore.deleteProfile(profile.id);
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

function send(body: unknown, id = post.id) {
  return POST(new Request("http://localhost/api/posts/p/comments", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
}

it("saves text-only, photo-only and photo-with-message comments", async () => {
  const photoUrl = "data:image/jpeg;base64,AAAA";
  for (const body of [{ body: "  Hi  " }, { photoUrl }, { body: "Hi", photoUrl }]) {
    const response = await send(body);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ body: body.body?.trim() ?? "", photoUrl: "photoUrl" in body ? photoUrl : null });
  }
  expect(await mockStore.listComments(post.id)).toHaveLength(3);
});

it("rejects empty, overlong and invalid photo comments without saving them", async () => {
  for (const body of [{}, { body: "   " }, { body: "x".repeat(MAX_COMMENT + 1) }, { photoUrl: 42 }, { photoUrl: "https://example.com/photo.jpg" }, { photoUrl: "data:image/jpeg;base64," + "A".repeat(MOCK_IMAGE_MAX_CHARS) }]) {
    expect((await send(body)).status).toBe(400);
  }
  expect(await mockStore.listComments(post.id)).toEqual([]);
});

it("requires authentication and an existing post", async () => {
  expect((await send({ photoUrl: "data:image/jpeg;base64,AAAA" }, "missing")).status).toBe(404);
  vi.mocked(getRequestProfile).mockResolvedValue(null);
  expect((await send({ body: "Hi" })).status).toBe(401);
});

it("checks uploaded photos belong to the commenter and are images within the size limit", async () => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
  const photoUrl = `https://x.public.blob.vercel-storage.com/comments/${profile.id}/photo.jpg`;
  const metadata = (contentType: string, size: number) => ({ contentType, size }) as Awaited<ReturnType<typeof head>>;
  vi.mocked(head).mockResolvedValue(metadata("image/jpeg", 100));
  expect((await send({ photoUrl })).status).toBe(201);
  expect(head).toHaveBeenCalledWith(photoUrl, { token: "test-token" });
  vi.mocked(head).mockClear();
  for (const url of [photoUrl.replace(profile.id, "someone-else"), photoUrl.replace("comments/", "posts/"), "https://example.com/photo.jpg"]) {
    expect((await send({ photoUrl: url })).status).toBe(400);
  }
  expect(head).not.toHaveBeenCalled();
  vi.mocked(head).mockResolvedValue(metadata("video/mp4", 100));
  expect((await send({ photoUrl })).status).toBe(400);
  vi.mocked(head).mockResolvedValue(metadata("image/jpeg", mediaRules.image.maxBytes + 1));
  expect((await send({ photoUrl })).status).toBe(400);
  vi.mocked(head).mockRejectedValue(new Error("Missing"));
  expect((await send({ photoUrl })).status).toBe(400);
  expect(await mockStore.listComments(post.id)).toHaveLength(1);
});
