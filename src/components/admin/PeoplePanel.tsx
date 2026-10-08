"use client";

import { KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { usePolled } from "@/hooks/usePolled";
import { apiFetch } from "@/lib/api";
import type { PublicProfile } from "@/lib/store/types";
import { formatWeekdayTime } from "@/lib/time";

const ADMIN_KEY = "/api/admin/profiles";

type AdminProfile = PublicProfile & { createdAt: string; hasPassword: boolean };

export function PeoplePanel() {
  const { mutate } = useSWRConfig();
  const { data: people } = usePolled<AdminProfile[]>(ADMIN_KEY);
  const { busy, status, run } = useAction();
  // Shown once, right after a reset, for the admin to pass on. It is not stored anywhere readable.
  const [issued, setIssued] = useState<{ name: string; password: string } | null>(null);

  async function remove(person: AdminProfile) {
    const sure = window.confirm(
      `Delete ${person.name}? Their drinks, points and photos go too, and this can't be undone.`,
    );
    if (!sure) return;
    const ok = await run(() => apiFetch(`${ADMIN_KEY}/${person.id}`, { method: "DELETE" }), `Deleted ${person.name}`);
    if (ok) await Promise.all([mutate(ADMIN_KEY), mutate("/api/leaderboard"), mutate("/api/points")]);
  }

  async function resetPassword(person: AdminProfile) {
    const sure = window.confirm(
      `Reset ${person.name}'s password? They'll be logged out everywhere and must choose a new one.`,
    );
    if (!sure) return;
    setIssued(null);
    const ok = await run(async () => {
      setIssued(
        await apiFetch<{ name: string; password: string }>(`${ADMIN_KEY}/${person.id}/password`, { method: "POST" }),
      );
    });
    if (ok) await mutate(ADMIN_KEY);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Reset a forgotten password, or delete a profile nobody is using.
      </p>

      {issued && (
        <Card className="space-y-1 border-accent">
          <p className="text-sm text-muted">Temporary password for {issued.name}. Pass it on now; it won&apos;t be shown again.</p>
          <p className="select-all font-mono text-2xl font-bold">{issued.password}</p>
          <p className="text-sm text-muted">They&apos;ll be asked to choose their own as soon as they log in with it.</p>
        </Card>
      )}

      <ul className="divide-y divide-line rounded-card border border-line bg-surface shadow-card">
        {people?.map((person) => (
          <li key={person.id} className="flex items-center gap-3 py-2 pl-3 pr-1">
            <Avatar name={person.name} src={person.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{person.name}</p>
              <p className="text-sm text-muted">
                Joined {formatWeekdayTime(person.createdAt)}
                {!person.hasPassword && " · no password yet"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => resetPassword(person)}
              disabled={busy}
              aria-label={`Reset password for ${person.name}`}
              className="flex size-tap shrink-0 items-center justify-center text-muted disabled:opacity-40"
            >
              <KeyRound className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => remove(person)}
              disabled={busy}
              aria-label={`Delete ${person.name}`}
              className="flex size-tap shrink-0 items-center justify-center text-muted active:text-danger disabled:opacity-40"
            >
              <Trash2 className="size-5" aria-hidden />
            </button>
          </li>
        ))}
        {people?.length === 0 && <li className="px-4 py-3 text-muted">Nobody has joined yet.</li>}
      </ul>
      <Status status={status} />
    </div>
  );
}
