"use client";

import dynamic from "next/dynamic";
import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { useSWRConfig } from "swr";
import { LocationPicker } from "@/components/admin/LocationPicker";
import type { TimeRange } from "@/components/admin/ScheduleCalendar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { Status } from "@/components/ui/Status";
import { Toast } from "@/components/ui/Toast";
import { config } from "@/config";
import { useAction } from "@/hooks/useAction";
import { useSchedule } from "@/hooks/useSchedule";
import { apiFetch } from "@/lib/api";
import type { Coordinates } from "@/lib/location";
import type { ScheduleEvent } from "@/lib/store/types";
import { dayKey, dayParts, formatTime, partyTimeToIso, timeInputValue } from "@/lib/time";

// The calendar library is sizeable and only admins need it, so it loads on demand.
const ScheduleCalendar = dynamic(
  () => import("@/components/admin/ScheduleCalendar").then((module) => module.ScheduleCalendar),
  { ssr: false, loading: () => <Card className="text-muted">Loading calendar…</Card> },
);

const DAY_MS = 24 * 60 * 60 * 1000;

const views = [
  { value: "list", label: "List" },
  { value: "calendar", label: "Calendar" },
] as const;

type View = (typeof views)[number]["value"];

const blank = {
  title: "",
  day: config.days[0],
  start: "",
  end: "",
  location: "",
  mapsQuery: "",
  notes: "",
  position: null as Coordinates | null,
};

type Draft = typeof blank;
type TextField = Exclude<keyof Draft, "position">;

const rangeFields = (range: TimeRange) => ({
  day: dayKey(range.startsAt),
  start: timeInputValue(range.startsAt),
  end: range.endsAt ? timeInputValue(range.endsAt) : "",
});

function toDraft(event: ScheduleEvent): Draft {
  return {
    title: event.title,
    ...rangeFields(event),
    location: event.location ?? "",
    mapsQuery: event.mapsQuery ?? "",
    notes: event.notes ?? "",
    position: event.lat !== null && event.lng !== null ? { lat: event.lat, lng: event.lng } : null,
  };
}

const whenLabel = (startsAt: string) => `${dayParts(dayKey(startsAt)).weekday} ${formatTime(startsAt)}`;

interface UndoToast {
  text: string;
  undo?: () => void;
}

export function SchedulePanel() {
  const { mutate } = useSWRConfig();
  const { events } = useSchedule();
  const { busy, status, setStatus, run } = useAction();
  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  // In calendar view the form lives in a sheet that opens on demand.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<UndoToast | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const set = (key: TextField) => (event: { target: { value: string } }) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  const dayOptions = config.days.includes(draft.day) ? config.days : [draft.day, ...config.days];
  const refresh = () => mutate("/api/schedule");

  function reset() {
    setEditingId(null);
    setSheetOpen(false);
    setDraft((current) => ({ ...blank, day: current.day }));
  }

  function startEdit(event: ScheduleEvent) {
    setStatus(null);
    setEditingId(event.id);
    setDraft(toDraft(event));
    if (view === "calendar") setSheetOpen(true);
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startCreate(range: TimeRange) {
    setStatus(null);
    setEditingId(null);
    setDraft({ ...blank, ...rangeFields(range) });
    setSheetOpen(true);
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
      lat: draft.position?.lat ?? null,
      lng: draft.position?.lng ?? null,
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
      await refresh();
    }
  }

  async function remove(event: ScheduleEvent) {
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    const ok = await run(() => apiFetch(`/api/admin/events/${event.id}`, { method: "DELETE" }), "Event deleted");
    if (ok) {
      if (editingId === event.id) reset();
      await refresh();
    }
  }

  /** Saves a drag or resize from the calendar straight away and offers to undo it. */
  async function move(event: ScheduleEvent, range: TimeRange): Promise<boolean> {
    const save = (times: TimeRange) =>
      apiFetch(`/api/admin/events/${event.id}`, { method: "PATCH", body: { ...event, ...times } });

    const ok = await run(() => save(range));
    await refresh();
    if (!ok) return false;

    const resized = range.startsAt === event.startsAt;
    setToast({
      text: resized
        ? `"${event.title}" now ends ${range.endsAt ? formatTime(range.endsAt) : "open-ended"}`
        : `Moved "${event.title}" to ${whenLabel(range.startsAt)}`,
      undo: () => {
        setToast(null);
        void run(() => save({ startsAt: event.startsAt, endsAt: event.endsAt }))
          .then(refresh)
          .then(() => setToast({ text: `Put "${event.title}" back at ${whenLabel(event.startsAt)}` }));
      },
    });
    return true;
  }

  const editing = editingId ? events?.find((event) => event.id === editingId) : undefined;

  const form = (
    <form onSubmit={submit} className="space-y-3">
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
      <LocationPicker
        value={draft.position}
        onChange={(position) => setDraft((current) => ({ ...current, position }))}
        query={draft.mapsQuery || draft.location}
      />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-muted">Notes (optional)</span>
        <textarea value={draft.notes} onChange={set("notes")} maxLength={500} rows={3} className={`${inputClass} py-2`} />
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
      {editing && (
        <Button variant="danger" block disabled={busy} onClick={() => remove(editing)}>
          <Trash2 className="size-5" aria-hidden />
          Delete event
        </Button>
      )}
      <Status status={status} />
    </form>
  );

  return (
    <div className="space-y-4">
      <Segmented options={views} value={view} onChange={setView} label="Schedule view" size="sm" />

      {view === "calendar" ? (
        <>
          <ScheduleCalendar events={events ?? []} onCreate={startCreate} onEdit={startEdit} onMove={move} />
          {!sheetOpen && <Status status={status} />}
          {sheetOpen && (
            <Sheet title={editingId ? "Edit event" : "Add event"} onClose={reset}>
              <div className="p-4">{form}</div>
            </Sheet>
          )}
        </>
      ) : (
        <div className="mx-auto max-w-app space-y-4">
          <Card>
            <h2 className="mb-3 font-display text-lg font-bold">{editingId ? "Edit event" : "Add event"}</h2>
            {form}
          </Card>

          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {events?.map((event) => (
              <li key={event.id} className="flex items-center gap-1 py-2 pl-4 pr-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{event.title}</p>
                  <p className="text-sm text-muted">
                    {whenLabel(event.startsAt)}
                    {event.endsAt && ` – ${formatTime(event.endsAt)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(event)}
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
      )}

      {toast && (
        <Toast
          text={toast.text}
          action={toast.undo && { label: "Undo", onAction: toast.undo }}
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}
