"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { config } from "@/config";
import { useProfile } from "@/hooks/useProfile";
import type { Profile } from "@/lib/store/types";

export default function ProfilePage() {
  const { identity, profile } = useProfile();
  const editing = identity !== null;

  return (
    <main className="mx-auto w-full max-w-app flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      {identity === undefined ? null : <ProfileBody editing={editing} profile={profile} />}
    </main>
  );
}

function ProfileBody({ editing, profile }: { editing: boolean; profile: Profile | undefined }) {
  return (
    <>
      {editing ? (
        <>
          <Link href="/schedule" className="mb-2 inline-flex min-h-tap items-center gap-1.5 text-muted">
            <ArrowLeft className="size-5" aria-hidden />
            Back
          </Link>
          <h1 className="mb-5 font-display text-2xl font-bold">Your profile</h1>
        </>
      ) : (
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">{config.location}</p>
          <h1 className="font-display text-3xl font-bold">{config.partyName}</h1>
          <p className="mt-2 text-muted">Set up your profile to get in.</p>
        </div>
      )}

      {editing ? (
        profile ? (
          <ProfileForm key={profile.id} initial={profile} />
        ) : (
          <p className="text-muted">Loading…</p>
        )
      ) : (
        <ProfileForm />
      )}
    </>
  );
}
