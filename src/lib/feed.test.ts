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
