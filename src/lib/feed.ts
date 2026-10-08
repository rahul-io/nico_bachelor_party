import { del } from "@vercel/blob";
import { env } from "./env";
import type { Feed, Post, Store } from "./store/types";

const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function isBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

export async function buildFeed(store: Store): Promise<Feed> {
  const [posts, profiles] = await Promise.all([store.listPosts(), store.listProfiles()]);
  const posters = new Map(profiles.map((profile) => [profile.id, profile]));
  return {
    uploadsEnabled: env.blobToken !== null,
    posts: posts.map((post) => ({
      ...post,
      posterName: posters.get(post.profileId)?.name ?? "Someone",
      posterAvatarUrl: posters.get(post.profileId)?.avatarUrl ?? null,
    })),
  };
}

/** Deletes the files behind posts. Best effort: a missing blob must not block removing the post. */
export async function deletePostFiles(posts: Post[]): Promise<void> {
  const urls = [...new Set(posts.flatMap((post) => [post.url, post.previewUrl]).filter(
    (url): url is string => typeof url === "string" && isBlobUrl(url),
  ))];
  if (urls.length === 0 || !env.blobToken) return;
  try {
    await del(urls);
  } catch (error) {
    console.error("Failed to delete blobs", error);
  }
}
