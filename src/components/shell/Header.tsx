"use client";

import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { NoticeBell } from "@/components/shell/NoticeBell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Wordmark } from "@/components/shell/Wordmark";
import { Avatar } from "@/components/ui/Avatar";
import { config } from "@/config";
import { useProfile } from "@/hooks/useProfile";

export function Header() {
  const { profile } = useProfile();

  return (
    <header className="sticky top-0 z-20 border-b border-gold/30 bg-chrome pt-[env(safe-area-inset-top)] text-on-chrome shadow-card">
      {/* Equal side columns keep the mascot centred whatever sits beside it. */}
      <div className="mx-auto grid h-header max-w-app grid-cols-[1fr_auto_1fr] items-center gap-2 px-4">
        <Link href="/schedule" aria-label={`${config.partyName} home`} className="justify-self-start">
          <Wordmark />
        </Link>
        {/* The badge hangs slightly below the bar, like a crest on a bow. */}
        <Link
          href="/schedule"
          tabIndex={-1}
          aria-hidden
          className="-mb-3 rounded-full bg-chrome p-0.5 ring-1 ring-gold/40"
        >
          <Logo size={52} priority />
        </Link>
        <div className="flex items-center justify-self-end">
          <NoticeBell />
          <ThemeToggle />
          <Link href="/profile" aria-label="Your profile" className="flex min-h-tap items-center pl-1">
            <Avatar name={profile?.name ?? ""} src={profile?.avatarUrl} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}
