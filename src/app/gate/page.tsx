"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { WelcomeHero } from "@/components/shell/WelcomeHero";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { apiFetch } from "@/lib/api";

interface GateInfo {
  configured: boolean;
  devCode: boolean;
}

/** The first screen anyone sees: nothing else in the app loads without the invite code. */
export default function GatePage() {
  const { data: info } = useSWR<GateInfo>("/api/gate", (path: string) => apiFetch<GateInfo>(path));
  const { busy, status, run } = useAction();
  const [code, setCode] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await run(() => apiFetch("/api/gate", { method: "POST", body: { code } }));
    // A full page load, so the request goes back through the gate with the new cookie.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- must not be a client-side navigation
    if (ok) window.location.assign("/");
  }

  return (
    <main className="mx-auto w-full max-w-app flex-1 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <WelcomeHero>
        <p className="mt-2 text-sand/85">Members and invited guests only.</p>
      </WelcomeHero>
      <div className="px-4">
        <Card>
          {info && !info.configured ? (
            <p className="text-muted">
              The gangway is up: no invite code has been set on the server yet. Ask whoever runs the site.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Field
                label="Invite code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
              />
              {info?.devCode && (
                <p className="text-sm text-muted">
                  Local dev: no <code className="font-mono">INVITE_CODE</code> is set, so the code is{" "}
                  <code className="font-mono text-ink">ahoy</code>.
                </p>
              )}
              <Button type="submit" variant="primary" block disabled={busy || !code.trim()}>
                {busy ? "Checking…" : "Come aboard"}
              </Button>
              <Status status={status} />
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
