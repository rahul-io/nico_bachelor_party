"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

interface ToastProps {
  text: string;
  /** Optional button, e.g. "Undo". */
  action?: { label: string; onAction: () => void };
  onDismiss: () => void;
  durationMs?: number;
  /** Sit above the bottom nav instead of over it. */
  aboveNav?: boolean;
}

/** A short message pinned to the bottom of the screen that goes away on its own. */
export function Toast({ text, action, onDismiss, durationMs = 7000, aboveNav = false }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [text, onDismiss, durationMs]);

  return (
    <div
      role="status"
      className={cn(
        "fixed inset-x-4 z-50 mx-auto flex max-w-app items-center gap-3 rounded-control border border-line bg-raised py-1 pl-4 pr-1 shadow-lg",
        aboveNav
          ? "bottom-[calc(var(--spacing-nav)+env(safe-area-inset-bottom)+1.75rem)]"
          : "bottom-[calc(env(safe-area-inset-bottom)+1rem)]",
      )}
    >
      <p className="min-w-0 flex-1 py-2 text-sm">{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.onAction}
          className="min-h-tap shrink-0 rounded-control px-3 font-semibold text-accent"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
