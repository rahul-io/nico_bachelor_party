import { afterEach, expect, it, vi } from "vitest";
import { del } from "@vercel/blob";
import { deletePostFiles } from "./feed";
import type { Post } from "./store/types";

vi.mock("@vercel/blob", () => ({ del: vi.fn() }));
vi.mock("./env", () => ({ env: { blobToken: "test-token" } }));

afterEach(() => vi.resetAllMocks());

it("deletes both originals and previews, including posts without previews", async () => {
  const original = "https://x.public.blob.vercel-storage.com/posts/p/original.heic";
  const preview = "https://x.public.blob.vercel-storage.com/posts/p/preview.jpg";
  const legacy = "https://x.public.blob.vercel-storage.com/posts/p/legacy.jpg";
  const posts = [
    { url: original, previewUrl: preview },
    { url: legacy },
    { url: "data:image/jpeg;base64,AAAA" },
  ] as Post[];

  await deletePostFiles(posts);
  expect(del).toHaveBeenCalledExactlyOnceWith([original, preview, legacy]);
});

import { buildExportFeed, buildFeed, buildPostDetail, forGuests } from "./feed";
import type { Store } from "./store/types";

const originalUrl = "https://x.public.blob.vercel-storage.com/posts/p/IMG_1-abc.jpg";
const previewOnly = "https://x.public.blob.vercel-storage.com/posts/p/preview-IMG_1-xyz.jpg";
const videoUrl = "https://x.public.blob.vercel-storage.com/posts/p/clip-abc.mp4";

const stored = [
  { id: "photo", profileId: "p", url: originalUrl, previewUrl: previewOnly, mediaType: "image" },
  { id: "video", profileId: "p", url: videoUrl, previewUrl: null, mediaType: "video" },
].map((post) => ({ caption: null, bacAtPost: null, lat: null, lng: null, locationSource: null, eventId: null, createdAt: "2026-10-09T04:00:00.000Z", ...post })) as Post[];

const fakeStore = {
  listPosts: async () => stored,
  listProfiles: async () => [],
  reactionCounts: async () => [],
  commentCounts: async () => [],
  listPostReactions: async () => [],
  listComments: async () => [],
} as unknown as Store;

it("never sends a photo's original URL to guests", async () => {
  const feed = await buildFeed(fakeStore, "viewer");
  const detail = await buildPostDetail(fakeStore, "photo", "viewer");
  expect(JSON.stringify([feed, detail])).not.toContain(originalUrl);
  expect(feed.posts.find((post) => post.id === "photo")).toMatchObject({ url: previewOnly, previewUrl: null });
  expect(detail?.post).toMatchObject({ url: previewOnly, previewUrl: null });
});

it("still shows posts that have no preview", async () => {
  const feed = await buildFeed(fakeStore);
  expect(feed.posts.find((post) => post.id === "video")?.url).toBe(videoUrl);
  expect(forGuests(stored[1])).toBe(stored[1]);
});

it("keeps originals for the admin export", async () => {
  const posts = await buildExportFeed(fakeStore);
  expect(posts.find((post) => post.id === "photo")).toMatchObject({ url: originalUrl, previewUrl: previewOnly });
});
