"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Toast } from "@/components/ui/Toast";
import { useNow } from "@/hooks/useNow";
import { usePointsStatus } from "@/hooks/usePointsStatus";
import { formatDelta } from "@/lib/points/format";

const SEEN_KEY = "nbp.dispatchSeen";
const SEEN_EVENT = "nbp:dispatch-seen";

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(value: string) {
  try {
    localStorage.setItem(SEEN_KEY, value);
  } catch {
    // Private mode: the toast just shows again next time.
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

function subscribeSeen(onChange: () => void) {
  window.addEventListener(SEEN_EVENT, onChange);
  return () => window.removeEventListener(SEEN_EVENT, onChange);
}

/**
 * On every tab: the Happy Hour strip while one is running, and a one-time
 * toast for awards handed out since this phone last looked.
 */
export function PointsBanner() {
  const status = usePointsStatus();
  const now = useNow(30_000);
  const seen = useSyncExternalStore(subscribeSeen, readSeen, () => null);

  // First visit on this phone: start from now rather than announcing old news.
  useEffect(() => {
    if (readSeen() === null) writeSeen(new Date().toISOString());
  }, []);

  const unseen = seen === null ? [] : (status?.dispatches ?? []).filter((item) => item.createdAt > seen);
  const newest = unseen[0];
  const newestAt = newest?.createdAt;
  const dismiss = () => {
    if (newestAt) writeSeen(newestAt);
  };

  const happyHour = status?.happyHour;
  const minutesLeft = happyHour && now !== null ? Math.ceil((Date.parse(happyHour.endsAt) - now) / 60_000) : null;

  return (
    <>
      {happyHour && minutesLeft !== null && minutesLeft > 0 && (
        <p className="bg-linear-to-b from-gold-hi to-gold px-4 py-1.5 text-center text-sm font-semibold text-navy">
          Happy Hour · {happyHour.multiplier}× drink points · {minutesLeft} min left
        </p>
      )}
      {newest && (
        <Toast
          aboveNav
          text={`${newest.profileName}: ${newest.text} ${formatDelta(newest.delta)}${
            unseen.length > 1 ? ` · and ${unseen.length - 1} more` : ""
          }`}
          onDismiss={dismiss}
        />
      )}
    </>
  );
}
