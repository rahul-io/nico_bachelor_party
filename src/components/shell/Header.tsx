"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { config } from "@/config";
import { useProfile } from "@/hooks/useProfile";

export function Header() {
  const { profile } = useProfile();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-header max-w-app items-center justify-between px-4">
        <span className="font-display text-lg font-bold tracking-tight">{config.partyName}</span>
        <Link href="/profile" aria-label="Edit your profile" className="flex min-h-tap items-center">
          <Avatar name={profile?.name ?? ""} src={profile?.avatarUrl} size="sm" />
        </Link>
      </div>
    </header>
  );
}
