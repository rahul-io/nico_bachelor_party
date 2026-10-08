"use client";

import { useEffect } from "react";

interface ToastProps {
  text: string;
  /** Optional button, e.g. "Undo". */
  action?: { label: string; onAction: () => void };
  onDismiss: () => void;
  durationMs?: number;
}

/** A short message pinned to the bottom of the screen that goes away on its own. */
export function Toast({ text, action, onDismiss, durationMs = 7000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [text, onDismiss, durationMs]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 mx-auto flex max-w-app items-center gap-3 rounded-control border border-line bg-raised py-1 pl-4 pr-1 shadow-lg"
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
