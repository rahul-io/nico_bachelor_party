"use client";

import { ArrowLeft, KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageTitle } from "@/components/ui/PageTitle";
import { useSession } from "@/hooks/useProfile";
import { apiFetch } from "@/lib/api";

/** Edit your profile, change your password, or log out of this device. */
export default function ProfilePage() {
  const router = useRouter();
  const { session, mutate } = useSession();
  const profile = session?.profile;

  useEffect(() => {
    if (session && !session.profile) router.replace("/welcome");
  }, [session, router]);

  async function logOut() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    await mutate({ profile: null }, { revalidate: false });
    router.replace("/welcome");
  }

  return (
    <main className="mx-auto w-full max-w-app flex-1 space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="flex items-center justify-between">
        <Link href="/schedule" className="inline-flex min-h-tap items-center gap-1.5 text-muted">
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Link>
        <span className="rounded-full bg-chrome">
          <ThemeToggle />
        </span>
      </div>
      <PageTitle eyebrow="Crew member" title="Your papers" />

      <Card>{profile ? <ProfileForm key={profile.id} initial={profile} /> : <p className="text-muted">Loading…</p>}</Card>

      {profile && (
        <Card className="space-y-2">
          <h2 className="font-display text-lg font-bold">Account</h2>
          <Link
            href="/password"
            className="flex min-h-tap items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 font-medium"
          >
            <KeyRound className="size-5" aria-hidden />
            Change password
          </Link>
          <Button block onClick={logOut}>
            <LogOut className="size-5" aria-hidden />
            Log out of this device
          </Button>
        </Card>
      )}
    </main>
  );
}
