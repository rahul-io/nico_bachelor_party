"use client";

import { Share, SquarePlus, X } from "lucide-react";
import { useSyncExternalStore } from "react";

const KEY = "nbp.installTipDismissed";
const listeners = new Set<() => void>();

type Platform = "ios" | "other";

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Which instructions to show, or null when already installed or dismissed. */
function getPlatform(): Platform | null {
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (installed) return null;
  try {
    if (window.localStorage.getItem(KEY)) return null;
  } catch {
    return null;
  }
  // iPadOS reports itself as a Mac, hence the touch check.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

function dismiss() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Storage unavailable; the tip just comes back next visit.
  }
  listeners.forEach((listener) => listener());
}

/** One-time nudge to add the app to the home screen. Browsers offer no reliable install button. */
export function InstallTip() {
  const platform = useSyncExternalStore(subscribe, getPlatform, () => null);
  if (!platform) return null;

  return (
    <div className="mx-auto flex w-full max-w-app items-center gap-3 px-4 pt-3">
      <div className="flex flex-1 items-center gap-3 rounded-control border border-line bg-surface py-2 pl-3 pr-1 text-sm">
        <SquarePlus className="size-5 shrink-0 text-accent" aria-hidden />
        <p className="flex-1 text-muted">
          <span className="font-medium text-ink">Put this on your home screen.</span>{" "}
          {platform === "ios" ? (
            <>
              Tap <Share className="inline size-4 align-text-bottom" aria-label="Share" />, then &ldquo;Add to Home
              Screen&rdquo;.
            </>
          ) : (
            <>Open the browser menu, then &ldquo;Add to Home screen&rdquo; or &ldquo;Install app&rdquo;.</>
          )}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex size-tap shrink-0 items-center justify-center text-muted"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
