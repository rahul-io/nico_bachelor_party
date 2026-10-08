"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { GAMES_ME, useGamesMe } from "@/hooks/useGames";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDeviceWeekdayTime } from "@/lib/time";

/** Marks this person's notices as read, here and on the server. */
export function useMarkNoticesSeen() {
  const { mutate } = useSWRConfig();
  return async () => {
    await apiFetch(GAMES_ME, { method: "POST" }).catch(() => {});
    await mutate(GAMES_ME);
  };
}

/** The bell in the header: things that happened to you (cursed, challenged, paid, reported). */
export function NoticeBell() {
  const me = useGamesMe();
  const markSeen = useMarkNoticesSeen();
  const [open, setOpen] = useState(false);
  const unseen = me?.notices.filter((notice) => !notice.seen).length ?? 0;

  function close() {
    setOpen(false);
    if (unseen > 0) void markSeen();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unseen > 0 ? `Notices, ${unseen} new` : "Notices"}
        className="relative flex size-tap items-center justify-center text-on-chrome/80"
      >
        <Bell className="size-5" aria-hidden />
        {unseen > 0 && (
          <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[0.625rem] font-bold leading-4 text-navy">
            {unseen}
          </span>
        )}
      </button>
      {open && (
        <Sheet title="Notices" onClose={close}>
          <div className="space-y-2 p-4 text-ink">
            {me && (
              <p className="text-sm text-muted">
                You have <span className="font-semibold tabular-nums text-ink">{me.balance}</span> points to spend.
              </p>
            )}
            {me?.notices.length === 0 && <Card className="text-muted">Nothing yet.</Card>}
            <ul className="space-y-2">
              {me?.notices.map((notice) => (
                <li
                  key={notice.id}
                  className={cn(
                    "rounded-card border bg-surface px-4 py-3 shadow-card",
                    notice.seen ? "border-line" : "border-gold",
                  )}
                >
                  <p>{notice.text}</p>
                  <p className="mt-0.5 text-sm text-muted">{formatDeviceWeekdayTime(notice.createdAt)}</p>
                </li>
              ))}
            </ul>
          </div>
        </Sheet>
      )}
    </>
  );
}
