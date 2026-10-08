"use client";

import { Trash2 } from "lucide-react";
import { useSWRConfig } from "swr";
import { Avatar } from "@/components/ui/Avatar";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { usePolled } from "@/hooks/usePolled";
import { apiFetch } from "@/lib/api";
import type { PublicProfile } from "@/lib/store/types";
import { formatWeekdayTime } from "@/lib/time";

const ADMIN_KEY = "/api/admin/profiles";

type AdminProfile = PublicProfile & { createdAt: string };

export function PeoplePanel() {
  const { mutate } = useSWRConfig();
  const { data: people } = usePolled<AdminProfile[]>(ADMIN_KEY);
  const { busy, status, run } = useAction();

  async function remove(person: AdminProfile) {
    const sure = window.confirm(
      `Delete ${person.name}? Their drinks and points go too, and this can't be undone.`,
    );
    if (!sure) return;
    const ok = await run(() => apiFetch(`${ADMIN_KEY}/${person.id}`, { method: "DELETE" }), `Deleted ${person.name}`);
    if (ok) await Promise.all([mutate(ADMIN_KEY), mutate("/api/leaderboard"), mutate("/api/points")]);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Delete duplicates left behind when someone switched phones or cleared their browser.
      </p>
      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {people?.map((person) => (
          <li key={person.id} className="flex items-center gap-3 py-2 pl-3 pr-1">
            <Avatar name={person.name} src={person.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{person.name}</p>
              <p className="text-sm text-muted">Joined {formatWeekdayTime(person.createdAt)}</p>
            </div>
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
