// Keep this file free of runtime imports: scripts/export-photos.mts loads it with plain Node.
import type { FeedPost, Post, Profile, ReactionCount } from "./store/types";

/** Joins posts with their posters, reaction tallies and comment counts. */
export function assembleFeed(
  posts: Post[],
  profiles: Profile[],
  reactionCounts: ReactionCount[],
  commentCounts: Array<{ postId: string; count: number }>,
  emojiOrder: readonly string[],
): FeedPost[] {
  const posters = new Map(profiles.map((profile) => [profile.id, profile]));
  const comments = new Map(commentCounts.map((entry) => [entry.postId, entry.count]));
  const reactions = new Map<string, ReactionCount[]>();
  for (const entry of reactionCounts) {
    reactions.set(entry.postId, [...(reactions.get(entry.postId) ?? []), entry]);
  }

  return posts.map((post) => ({
    ...post,
    posterName: posters.get(post.profileId)?.name ?? "Someone",
    posterAvatarUrl: posters.get(post.profileId)?.avatarUrl ?? null,
    reactions: (reactions.get(post.id) ?? [])
      .filter((entry) => emojiOrder.includes(entry.emoji))
      .sort((a, b) => emojiOrder.indexOf(a.emoji) - emojiOrder.indexOf(b.emoji))
      .map(({ emoji, count, mine }) => ({ emoji, count, mine })),
    commentCount: comments.get(post.id) ?? 0,
  }));
}
