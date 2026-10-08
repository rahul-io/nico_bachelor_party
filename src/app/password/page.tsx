"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageTitle } from "@/components/ui/PageTitle";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { useSession, type SessionResponse } from "@/hooks/useProfile";
import { apiFetch } from "@/lib/api";
import { MIN_PASSWORD_LENGTH } from "@/lib/limits";

/** Change your password. Also where an admin reset sends you before anything else works. */
export default function PasswordPage() {
  const router = useRouter();
  const { session, mutate } = useSession();
  const { busy, status, run } = useAction();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const profile = session?.profile;
  const forced = profile?.mustChangePassword === true;

  useEffect(() => {
    if (session && !session.profile) router.replace("/welcome");
  }, [session, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await run(async () => {
      const updated = await apiFetch<SessionResponse>("/api/auth/password", {
        method: "POST",
        body: { current, next },
      });
      await mutate(updated, { revalidate: false });
    });
    if (ok) router.replace(forced ? "/schedule" : "/profile");
  }

  return (
    <main className="mx-auto w-full max-w-app flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      {!forced && (
        <Link href="/profile" className="inline-flex min-h-tap items-center gap-1.5 text-muted">
          <ArrowLeft className="size-5" aria-hidden />
          Back
        </Link>
      )}
      <div className="mb-4 mt-2">
        <PageTitle eyebrow="Crew member" title={forced ? "Choose a new password" : "Change password"} />
      </div>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          {forced ? (
            <p className="text-muted">
              An admin reset your password. Pick a new one to carry on. Your other devices have been signed out.
            </p>
          ) : (
            <Field
              label="Current password"
              type="password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoComplete="current-password"
            />
          )}
          <Field
            label={`New password (at least ${MIN_PASSWORD_LENGTH} characters)`}
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            autoComplete="new-password"
          />
          <Button
            type="submit"
            variant="primary"
            block
            disabled={busy || !profile || next.length < MIN_PASSWORD_LENGTH || (!forced && !current)}
          >
            {busy ? "Saving…" : "Save password"}
          </Button>
          <Status status={status} />
        </form>
      </Card>
    </main>
  );
}
