"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { Status } from "@/components/ui/Status";
import { config } from "@/config";
import { useAction } from "@/hooks/useAction";
import { useSchedule } from "@/hooks/useSchedule";
import { apiFetch } from "@/lib/api";
import type { ScheduleEvent } from "@/lib/store/types";
import { dayKey, dayParts, formatTime, partyTimeToIso, timeInputValue } from "@/lib/time";

const DAY_MS = 24 * 60 * 60 * 1000;

const blank = {
  title: "",
  day: config.days[0],
  start: "",
  end: "",
  location: "",
  mapsQuery: "",
  notes: "",
};

type Draft = typeof blank;

function toDraft(event: ScheduleEvent): Draft {
  return {
    title: event.title,
    day: dayKey(event.startsAt),
    start: timeInputValue(event.startsAt),
    end: event.endsAt ? timeInputValue(event.endsAt) : "",
    location: event.location ?? "",
    mapsQuery: event.mapsQuery ?? "",
    notes: event.notes ?? "",
  };
}

export function SchedulePanel() {
  const { mutate } = useSWRConfig();
  const { events } = useSchedule();
  const { busy, status, setStatus, run } = useAction();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);

  const set = (key: keyof Draft) => (event: { target: { value: string } }) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  const dayOptions = config.days.includes(draft.day) ? config.days : [draft.day, ...config.days];

  function reset() {
    setEditingId(null);
    setDraft((current) => ({ ...blank, day: current.day }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.start) {
      return setStatus({ text: "An event needs a title and a start time.", error: true });
    }
    const startsAt = partyTimeToIso(draft.day, draft.start);
    let endsAt = draft.end ? partyTimeToIso(draft.day, draft.end) : null;
    // An end time earlier than the start means it runs past midnight.
    if (endsAt && endsAt <= startsAt) endsAt = new Date(Date.parse(endsAt) + DAY_MS).toISOString();

    const body = {
      title: draft.title,
      startsAt,
      endsAt,
      location: draft.location,
      mapsQuery: draft.mapsQuery,
      notes: draft.notes,
    };
    const ok = await run(
      () =>
        editingId
          ? apiFetch(`/api/admin/events/${editingId}`, { method: "PATCH", body })
          : apiFetch("/api/admin/events", { method: "POST", body }),
      editingId ? "Event updated" : "Event added",
    );
    if (ok) {
      reset();
      await mutate("/api/schedule");
    }
  }

  async function remove(event: ScheduleEvent) {
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    const ok = await run(() => apiFetch(`/api/admin/events/${event.id}`, { method: "DELETE" }), "Event deleted");
    if (ok) {
      if (editingId === event.id) reset();
      await mutate("/api/schedule");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <h2 className="font-display text-lg font-bold">{editingId ? "Edit event" : "Add event"}</h2>
          <Field label="Title" value={draft.title} onChange={set("title")} maxLength={80} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Day</span>
            <select value={draft.day} onChange={set("day")} className={inputClass}>
              {dayOptions.map((day) => (
                <option key={day} value={day}>
                  {dayParts(day).long}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Starts" type="time" value={draft.start} onChange={set("start")} />
            <Field label="Ends (optional)" type="time" value={draft.end} onChange={set("end")} />
          </div>
          <Field label="Location (optional)" value={draft.location} onChange={set("location")} maxLength={120} />
          <Field
            label="Google Maps search (optional)"
            value={draft.mapsQuery}
            onChange={set("mapsQuery")}
            maxLength={200}
            placeholder="Defaults to the location"
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Notes (optional)</span>
            <textarea
              value={draft.notes}
              onChange={set("notes")}
              maxLength={500}
              rows={3}
              className={`${inputClass} py-2`}
            />
          </label>
          <div className="flex gap-2">
            {editingId && (
              <Button onClick={reset} className="flex-1">
                Cancel
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={busy} className="flex-1">
              {editingId ? "Save changes" : "Add event"}
            </Button>
          </div>
          <Status status={status} />
        </form>
      </Card>

      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {events?.map((event) => (
          <li key={event.id} className="flex items-center gap-1 py-2 pl-4 pr-1">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{event.title}</p>
              <p className="text-sm text-muted">
                {dayParts(dayKey(event.startsAt)).weekday} {formatTime(event.startsAt)}
                {event.endsAt && ` – ${formatTime(event.endsAt)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingId(event.id);
                setDraft(toDraft(event));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              aria-label={`Edit ${event.title}`}
              className="flex size-tap shrink-0 items-center justify-center text-muted"
            >
              <Pencil className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => remove(event)}
              aria-label={`Delete ${event.title}`}
              className="flex size-tap shrink-0 items-center justify-center text-muted active:text-danger"
            >
              <Trash2 className="size-5" aria-hidden />
            </button>
          </li>
        ))}
        {events?.length === 0 && <li className="px-4 py-3 text-muted">No events yet.</li>}
      </ul>
    </div>
  );
}
