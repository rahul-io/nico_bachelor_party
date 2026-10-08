"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { REACTIONS, type ReactionEmoji } from "@/lib/reactions";
import type { FeedPost } from "@/lib/store/types";

const LONG_PRESS_MS = 450;

interface ReactionBarProps {
  reactions: FeedPost["reactions"];
  onToggle: (emoji: ReactionEmoji, on: boolean) => void;
  /** Long-press on a reaction: show who reacted. */
  onShowReactors?: () => void;
}

export function ReactionBar({ reactions, onToggle, onShowReactors }: ReactionBarProps) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  function startPress() {
    longPressed.current = false;
    if (!onShowReactors) return;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onShowReactors();
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  return (
    <div className="flex gap-1.5">
      {REACTIONS.map((emoji) => {
        const entry = reactions.find((reaction) => reaction.emoji === emoji);
        const mine = entry?.mine ?? false;
        const count = entry?.count ?? 0;
        return (
          <button
            key={emoji}
            type="button"
            aria-pressed={mine}
            aria-label={`${emoji} ${count}`}
            onPointerDown={startPress}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(event) => event.preventDefault()}
            onClick={() => {
              // The click that ends a long-press must not also toggle.
              if (!longPressed.current) onToggle(emoji, !mine);
            }}
            className={cn(
              "flex min-h-tap flex-1 select-none items-center justify-center gap-1 rounded-control border text-base transition active:scale-95 [-webkit-touch-callout:none]",
              mine ? "border-primary bg-raised" : "border-line bg-surface",
            )}
          >
            <span aria-hidden>{emoji}</span>
            {count > 0 && (
              <span className={cn("text-sm font-semibold tabular-nums", mine ? "text-ink" : "text-muted")}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
