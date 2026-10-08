"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { WelcomeHero } from "@/components/shell/WelcomeHero";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { useSession, type SessionResponse } from "@/hooks/useProfile";
import { ApiError, apiFetch } from "@/lib/api";
import { getIdentity, setIdentity, subscribeIdentity } from "@/lib/identity";
import { MIN_PASSWORD_LENGTH } from "@/lib/limits";

type Mode = "choose" | "create" | "login";

/** After the gate: create a profile, log in, or (for profiles from before accounts) set a password. */
export default function WelcomePage() {
  const router = useRouter();
  const { session, mutate } = useSession();
  // A profile created before accounts existed leaves its id + token on the device.
  const legacy = useSyncExternalStore(subscribeIdentity, getIdentity, () => null);
  const [mode, setMode] = useState<Mode>("choose");
  const profile = session?.profile;

  useEffect(() => {
    if (profile) router.replace(profile.mustChangePassword ? "/password" : "/schedule");
  }, [profile, router]);

  function signedIn(next: SessionResponse) {
    void mutate(next, { revalidate: false });
  }

  return (
    <main className="mx-auto w-full max-w-app flex-1 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <WelcomeHero>
        <p className="mt-2 text-sand/85">Sign the crew list to come aboard.</p>
      </WelcomeHero>

      <div className="space-y-4 px-4">
        {legacy && mode === "choose" ? (
          <ClaimCard legacy={legacy} onDone={signedIn} />
        ) : mode === "choose" ? (
          <Card className="space-y-3">
            <Button variant="primary" block onClick={() => setMode("create")}>
              Create profile
            </Button>
            <Button block onClick={() => setMode("login")}>
              Log in
            </Button>
            <p className="text-center text-sm text-muted">
              Been aboard on another phone? Log in with the same name and password.
            </p>
          </Card>
        ) : mode === "login" ? (
          <Card className="space-y-3">
            <h1 className="font-display text-2xl font-bold">Log in</h1>
            <LoginForm onDone={signedIn} />
            <Button variant="ghost" block onClick={() => setMode("choose")}>
              Back
            </Button>
          </Card>
        ) : (
          <Card className="space-y-3">
            <h1 className="font-display text-2xl font-bold">Create profile</h1>
            <ProfileForm />
            <Button variant="ghost" block onClick={() => setMode("choose")}>
              Back
            </Button>
          </Card>
        )}
      </div>
    </main>
  );
}

function LoginForm({ onDone }: { onDone: (session: SessionResponse) => void }) {
  const { busy, status, run } = useAction();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      onDone(await apiFetch<SessionResponse>("/api/auth/login", { method: "POST", body: { name, password } }));
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label="Display name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="username"
        autoCapitalize="none"
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
      />
      <Button type="submit" variant="primary" block disabled={busy || !name.trim() || !password}>
        {busy ? "Checking…" : "Log in"}
      </Button>
      <p className="text-center text-sm text-muted">Forgot it? Walk the plank.</p>
      <Status status={status} />
    </form>
  );
}

/** One-time step for a profile made before accounts: choose a password and keep everything. */
function ClaimCard({
  legacy,
  onDone,
}: {
  legacy: { id: string; token: string };
  onDone: (session: SessionResponse) => void;
}) {
  const { busy, status, setStatus, run } = useAction();
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      try {
        const session = await apiFetch<SessionResponse>("/api/auth/claim", {
          method: "POST",
          body: { ...legacy, password, name: needsName ? name : undefined },
        });
        setIdentity(null);
        onDone(session);
      } catch (error) {
        if (error instanceof ApiError && error.code === "name_taken") setNeedsName(true);
        // The old profile is gone or already has a password: fall back to the normal choices.
        if (error instanceof ApiError && error.status === 401) {
          setIdentity(null);
          return;
        }
        throw error;
      }
    });
  }

  return (
    <Card className="space-y-3">
      <h1 className="font-display text-2xl font-bold">Welcome back</h1>
      <p className="text-muted">
        The Crider Cup now has logins. Set a password to keep your profile, points, drinks and photos, and to get
        back in from any phone.
      </p>
      <form onSubmit={submit} className="space-y-4">
        {needsName && (
          <Field
            label="New display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={30}
          />
        )}
        <Field
          label={`Choose a password (at least ${MIN_PASSWORD_LENGTH} characters)`}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
        <Button type="submit" variant="primary" block disabled={busy || password.length < MIN_PASSWORD_LENGTH}>
          {busy ? "Saving…" : "Keep my profile"}
        </Button>
        <Status status={status} />
      </form>
      <Button
        variant="ghost"
        block
        onClick={() => {
          setIdentity(null);
          setStatus(null);
        }}
      >
        That isn&apos;t me
      </Button>
    </Card>
  );
}
