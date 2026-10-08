"use client";

import { MessageCircle, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { ReactionBar } from "@/components/photos/ReactionBar";
import { Avatar } from "@/components/ui/Avatar";
import { DOUBLE_TAP_REACTION, type ReactionEmoji } from "@/lib/reactions";
import type { FeedPost } from "@/lib/store/types";
import { formatDeviceWeekdayTime } from "@/lib/time";

/** How long a single tap waits to see whether it becomes a double-tap. */
const DOUBLE_TAP_MS = 260;

interface PostCardProps {
  post: FeedPost;
  canDelete: boolean;
  onDelete: (post: FeedPost) => void;
  onOpen: (post: FeedPost) => void;
  onReact: (post: FeedPost, emoji: ReactionEmoji, on: boolean) => void;
}

export function PostCard({ post, canDelete, onDelete, onOpen, onReact }: PostCardProps) {
  const noun = post.mediaType === "video" ? "video" : "photo";
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [burst, setBurst] = useState(0);

  function tapPhoto() {
    if (tapTimer.current) {
      // Second tap in time: a double-tap adds the reaction and never removes it.
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onReact(post, DOUBLE_TAP_REACTION, true);
      setBurst((n) => n + 1);
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      onOpen(post);
    }, DOUBLE_TAP_MS);
  }

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <header className="flex items-center gap-3 py-2 pl-3 pr-1">
        <Avatar name={post.posterName} src={post.posterAvatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="leading-snug">
            <span className="font-semibold">{post.posterName}</span>
            {/* The BAC stored with the post when it was made; not a live number. */}
            {post.bacAtPost !== null && (
              <span className="tabular-nums text-accent"> ({post.bacAtPost.toFixed(2)}%)</span>
            )}{" "}
            <span className="text-muted">logged a {noun}</span>
          </p>
          <p className="text-sm text-muted">{formatDeviceWeekdayTime(post.createdAt)}</p>
        </div>
        {canDelete ? (
          <button
            type="button"
            onClick={() => onDelete(post)}
            aria-label={`Delete this ${noun}`}
            className="flex size-tap shrink-0 items-center justify-center text-muted active:text-danger"
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
        ) : (
          <span className="size-2 shrink-0" />
        )}
      </header>

      <div className="relative bg-navy">
        {post.mediaType === "video" ? (
          // Taps on a video belong to its own controls, so no double-tap here.
          <video src={post.url} controls playsInline preload="metadata" className="max-h-[75vh] w-full" />
        ) : (
          <button type="button" onClick={tapPhoto} aria-label="Open photo. Double-tap to react." className="block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- lightweight preview served straight from Blob */}
            <img
              src={post.previewUrl ?? post.url}
              alt={post.caption ?? `Photo by ${post.posterName}`}
              loading="lazy"
              draggable={false}
              className="max-h-[75vh] w-full select-none object-contain"
            />
          </button>
        )}
        {burst > 0 && (
          <span
            key={burst}
            aria-hidden
            className="pointer-events-none absolute inset-0 flex animate-pop items-center justify-center text-8xl"
          >
            {DOUBLE_TAP_REACTION}
          </span>
        )}
      </div>

      {post.caption && <p className="whitespace-pre-line px-4 pt-3">{post.caption}</p>}

      <div className="space-y-1 p-3">
        <ReactionBar
          reactions={post.reactions}
          onToggle={(emoji, on) => onReact(post, emoji, on)}
          onShowReactors={() => onOpen(post)}
        />
        <button
          type="button"
          onClick={() => onOpen(post)}
          className="flex min-h-tap w-full items-center gap-2 px-1 text-left text-muted"
        >
          <MessageCircle className="size-5" aria-hidden />
          {post.commentCount === 0
            ? "Add a comment"
            : `${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}`}
        </button>
      </div>
    </article>
  );
}
