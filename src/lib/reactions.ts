/** The fixed reaction set, in display order. Enforced server-side. */
export const REACTIONS = ["🍺", "😂", "🔥", "😬", "❤️", "💀"] as const;

export type ReactionEmoji = (typeof REACTIONS)[number];

/** What a double-tap on a photo adds. */
export const DOUBLE_TAP_REACTION: ReactionEmoji = "🔥";

export const isReaction = (value: unknown): value is ReactionEmoji =>
  typeof value === "string" && (REACTIONS as readonly string[]).includes(value);

export const MAX_COMMENT = 280;

interface Reacted {
  reactions: Array<{ emoji: string; count: number; mine: boolean }>;
}

/** The post as it will look once the viewer's reaction is switched on or off. Used for instant feedback. */
export function applyReaction<T extends Reacted>(post: T, emoji: ReactionEmoji, on: boolean): T {
  const current = post.reactions.find((reaction) => reaction.emoji === emoji);
  if ((current?.mine ?? false) === on) return post;

  const others = post.reactions.filter((reaction) => reaction.emoji !== emoji);
  const count = (current?.count ?? 0) + (on ? 1 : -1);
  const next = count > 0 ? [...others, { emoji, count, mine: on }] : others;
  const order = REACTIONS as readonly string[];
  return { ...post, reactions: next.sort((a, b) => order.indexOf(a.emoji) - order.indexOf(b.emoji)) };
}
