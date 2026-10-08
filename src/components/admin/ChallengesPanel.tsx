"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { Status } from "@/components/ui/Status";
import { useAction } from "@/hooks/useAction";
import { usePolled } from "@/hooks/usePolled";
import { apiFetch } from "@/lib/api";
import type { Challenge } from "@/lib/store/types";

const ADMIN_KEY = "/api/admin/challenges";

const blank = { title: "", description: "", points: "", active: true };

export function ChallengesPanel() {
  const { mutate } = useSWRConfig();
  const { data: challenges } = usePolled<Challenge[]>(ADMIN_KEY);
  const { busy, status, setStatus, run } = useAction();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(blank);

  const refresh = () => Promise.all([mutate(ADMIN_KEY), mutate("/api/challenges")]);

  function reset() {
    setEditingId(null);
    setDraft(blank);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const points = Number(draft.points);
    if (!draft.title.trim() || !Number.isInteger(points) || points < 1) {
      return setStatus({ text: "A challenge needs a title and a whole number of points.", error: true });
    }
    const body = { ...draft, points };
    const ok = await run(
      () =>
        editingId
          ? apiFetch(`${ADMIN_KEY}/${editingId}`, { method: "PATCH", body })
          : apiFetch(ADMIN_KEY, { method: "POST", body }),
      editingId ? "Challenge updated" : "Challenge added",
    );
    if (ok) {
      reset();
      await refresh();
    }
  }

  async function remove(challenge: Challenge) {
    if (!window.confirm(`Delete "${challenge.title}"? Points already awarded stay.`)) return;
    const ok = await run(() => apiFetch(`${ADMIN_KEY}/${challenge.id}`, { method: "DELETE" }), "Challenge deleted");
    if (ok) {
      if (editingId === challenge.id) reset();
      await refresh();
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <h2 className="font-display text-lg font-bold">{editingId ? "Edit challenge" : "Add challenge"}</h2>
          <Field
            label="Title"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            maxLength={80}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Description (optional)</span>
            <textarea
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              maxLength={300}
              rows={2}
              className={`${inputClass} py-2`}
            />
          </label>
          <Field
            label="Points"
            inputMode="numeric"
            value={draft.points}
            onChange={(event) => setDraft({ ...draft, points: event.target.value })}
            placeholder="25"
          />
          <label className="flex min-h-tap cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
              className="size-5 accent-accent"
            />
            Visible to guests
          </label>
          <div className="flex gap-2">
            {editingId && (
              <Button onClick={reset} className="flex-1">
                Cancel
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={busy} className="flex-1">
              {editingId ? "Save changes" : "Add challenge"}
            </Button>
          </div>
          <Status status={status} />
        </form>
      </Card>

      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {challenges?.map((challenge) => (
          <li key={challenge.id} className="flex items-center gap-1 py-2 pl-4 pr-1">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{challenge.title}</p>
              <p className="text-sm text-muted">
                +{challenge.points}
                {!challenge.active && " · hidden"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingId(challenge.id);
                setDraft({
                  title: challenge.title,
                  description: challenge.description,
                  points: String(challenge.points),
                  active: challenge.active,
                });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              aria-label={`Edit ${challenge.title}`}
              className="flex size-tap shrink-0 items-center justify-center text-muted"
            >
              <Pencil className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => remove(challenge)}
              aria-label={`Delete ${challenge.title}`}
              className="flex size-tap shrink-0 items-center justify-center text-muted active:text-danger"
            >
              <Trash2 className="size-5" aria-hidden />
            </button>
          </li>
        ))}
        {challenges?.length === 0 && <li className="px-4 py-3 text-muted">No challenges yet.</li>}
      </ul>
    </div>
  );
}
