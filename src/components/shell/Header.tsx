"use client";

import Link from "next/link";
import { Logo } from "@/components/shell/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { config } from "@/config";
import { useProfile } from "@/hooks/useProfile";

export function Header() {
  const { profile } = useProfile();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      {/* Equal side columns keep the logo centred whatever sits beside it. */}
      <div className="mx-auto grid h-header max-w-app grid-cols-[1fr_auto_1fr] items-center gap-2 px-4">
        <span className="truncate font-display text-base font-bold leading-tight tracking-tight">
          {config.partyName}
        </span>
        <Link href="/schedule" aria-label={`${config.partyName} home`} className="flex items-center">
          <Logo size={48} priority />
        </Link>
        <Link href="/profile" aria-label="Edit your profile" className="flex min-h-tap items-center justify-self-end">
          <Avatar name={profile?.name ?? ""} src={profile?.avatarUrl} size="sm" />
        </Link>
      </div>
    </header>
  );
}
