import { del } from "@vercel/blob";
import { estimateBac } from "./bac";
import { env } from "./env";
import { assembleFeed } from "./feed-assemble";
import { listFeedLines } from "./games/board";
import { REACTIONS } from "./reactions";
import type { Feed, FeedComment, FeedPost, Post, PostDetail, Profile, Store } from "./store/types";

const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function isBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/**
 * A post as guests receive it. Original photo files are kept untouched for
 * exports and can carry camera metadata, including where the photo was taken,
 * so their URLs never leave the server: the preview stands in for the photo.
 * Posts without a preview (videos, GIFs, formats the browser couldn't decode,
 * and posts from before previews existed) have only the one file to show.
 */
export function forGuests<T extends Post>(post: T): T {
  return post.previewUrl ? { ...post, url: post.previewUrl, previewUrl: null } : post;
}

async function feedPosts(store: Store, viewerId: string | null): Promise<{ posts: FeedPost[]; profiles: Profile[] }> {
  const [posts, profiles, reactionCounts, commentCounts] = await Promise.all([
    store.listPosts(),
    store.listProfiles(),
    store.reactionCounts(viewerId),
    store.commentCounts(),
  ]);
  return { posts: assembleFeed(posts, profiles, reactionCounts, commentCounts, REACTIONS), profiles };
}

/**
 * The feed as guests see it. `viewerId` only decides which reactions are
 * flagged as "mine". Original file URLs are withheld; see `forGuests`.
 */
export async function buildFeed(store: Store, viewerId: string | null = null): Promise<Feed> {
  const [{ posts }, lines] = await Promise.all([feedPosts(store, viewerId), listFeedLines(store)]);
  return { uploadsEnabled: env.blobToken !== null, posts: posts.map(forGuests), lines };
}

/** Every post with its original file URL. Server-side use only (the admin export). */
export async function buildExportFeed(store: Store): Promise<FeedPost[]> {
  return (await feedPosts(store, null)).posts;
}

export async function buildPostDetail(store: Store, postId: string, viewerId: string | null): Promise<PostDetail | null> {
  const [{ posts, profiles }, reactions, comments] = await Promise.all([
    feedPosts(store, viewerId),
    store.listPostReactions(postId),
    store.listComments(postId),
  ]);
  const post = posts.find((candidate) => candidate.id === postId);
  if (!post) return null;

  const people = new Map(profiles.map((profile) => [profile.id, profile]));
  return {
    post: forGuests(post),
    reactors: REACTIONS.map((emoji) => ({
      emoji,
      names: reactions
        .filter((reaction) => reaction.emoji === emoji)
        .map((reaction) => people.get(reaction.profileId)?.name ?? "Someone"),
    })).filter((entry) => entry.names.length > 0),
    comments: comments.map((comment) => ({
      ...comment,
      authorName: people.get(comment.profileId)?.name ?? "Someone",
      authorAvatarUrl: people.get(comment.profileId)?.avatarUrl ?? null,
    })),
  };
}

/** Every comment with its author's name, for the export. */
export async function buildAllComments(store: Store): Promise<FeedComment[]> {
  const [comments, profiles] = await Promise.all([store.listAllComments(), store.listProfiles()]);
  const people = new Map(profiles.map((profile) => [profile.id, profile]));
  return comments.map((comment) => ({
    ...comment,
    authorName: people.get(comment.profileId)?.name ?? "Someone",
    authorAvatarUrl: people.get(comment.profileId)?.avatarUrl ?? null,
  }));
}

/**
 * The BAC stamped on a new post or comment: taken once, now, and only when
 * the person has "show my BAC" switched on. Callers store it and never recompute it.
 */
export async function bacSnapshot(store: Store, profile: Profile): Promise<number | null> {
  if (!profile.showBacOnPosts) return null;
  return Math.round(estimateBac(profile, await store.listDrinks(profile.id)).bac * 10_000) / 10_000;
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
