"use client";

import { useState, type FormEvent } from "react";
import type { AdminSession } from "@/app/admin/page";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { apiFetch } from "@/lib/api";

export function AdminLogin({ session, onLoggedIn }: { session: AdminSession; onLoggedIn: () => void }) {
  const [password, setPassword] = useState("");
  const { busy, status, run } = useAction();

  if (!session.loginEnabled) {
    return (
      <Card className="text-muted">
        Admin is switched off because no <code className="font-mono text-ink">ADMIN_PASSWORD</code> is set on the
        server.
      </Card>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await run(() => apiFetch("/api/admin/login", { method: "POST", body: { password } }));
    if (ok) onLoggedIn();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label="Admin password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
      />
      {session.devPassword && (
        <p className="text-sm text-muted">
          Local dev: no <code className="font-mono">ADMIN_PASSWORD</code> is set, so the password is{" "}
          <code className="font-mono text-ink">admin</code>.
        </p>
      )}
      <Button type="submit" variant="primary" block disabled={busy || !password}>
        {busy ? "Checking…" : "Log in"}
      </Button>
      <Status status={status} />
    </form>
  );
}
