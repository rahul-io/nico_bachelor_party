"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Card } from "@/components/ui/Card";
import { PageTitle } from "@/components/ui/PageTitle";
import { config } from "@/config";
import { useProfile } from "@/hooks/useProfile";
import type { Profile } from "@/lib/store/types";

export default function ProfilePage() {
  const { identity, profile } = useProfile();
  const editing = identity !== null;

  return (
    <main className="mx-auto w-full max-w-app flex-1 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      {identity === undefined ? null : <ProfileBody editing={editing} profile={profile} />}
    </main>
  );
}

function ProfileBody({ editing, profile }: { editing: boolean; profile: Profile | undefined }) {
  if (!editing) {
    return (
      <>
        <Welcome />
        <div className="px-4">
          <Card>
            <ProfileForm />
          </Card>
        </div>
      </>
    );
  }

  return (
    <div className="px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="flex items-center justify-between">
        <Link href="/schedule" className="inline-flex min-h-tap items-center gap-1.5 text-muted">
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Link>
        <span className="rounded-full bg-chrome">
          <ThemeToggle />
        </span>
      </div>
      <div className="mb-4">
        <PageTitle eyebrow="Crew member" title="Your papers" />
      </div>
      <Card>{profile ? <ProfileForm key={profile.id} initial={profile} /> : <p className="text-muted">Loading…</p>}</Card>
    </div>
  );
}

/** First screen for a new guest: the one place the full crest and a full photograph appear together. */
function Welcome() {
  return (
    <div className="relative isolate mb-5 overflow-hidden text-center text-sand">
      {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized brand asset */}
      <img src="/brand/hero-sunset-tall.webp" alt="" className="absolute inset-0 -z-20 size-full object-cover object-[center_60%]" />
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-navy/25 via-navy/10 to-navy" aria-hidden />
      <div className="flex flex-col items-center px-6 pb-7 pt-[calc(env(safe-area-inset-top)+2rem)]">
        {/* A soft sand glow keeps the crest's navy lettering clear of the sky. */}
        <div className="rounded-full bg-radial from-sand/85 via-sand/50 to-transparent to-70% p-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized brand asset */}
          <img src="/brand/lockup.webp" alt={config.partyName} className="h-52 w-auto drop-shadow-lg" />
        </div>
        <p className="mt-4 font-script text-lg italic">Drink. Explore. Compete. Legend awaits.</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized brand asset */}
        <img src="/brand/rope.webp" alt="" className="my-3 h-4 w-auto opacity-90" />
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-gold-hi">
          {config.tagline} · {config.location}
        </p>
        <p className="mt-2 text-sand/85">Sign the crew list to come aboard.</p>
      </div>
    </div>
  );
}
