import type { ScheduleEvent } from "./store/types";

/** How long an event without an end time counts as "happening now". */
const OPEN_ENDED_MS = 2 * 60 * 60 * 1000;

export interface Highlight {
  id: string;
  kind: "now" | "next";
}

/** The event in progress, or failing that the next one to start. `events` must be sorted by start. */
export function findHighlight(events: ScheduleEvent[], now: number): Highlight | null {
  const start = (event: ScheduleEvent) => Date.parse(event.startsAt);
  const end = (event: ScheduleEvent) =>
    event.endsAt ? Date.parse(event.endsAt) : start(event) + OPEN_ENDED_MS;

  const current = events.findLast((event) => start(event) <= now && now < end(event));
  if (current) return { id: current.id, kind: "now" };

  const next = events.find((event) => start(event) > now);
  return next ? { id: next.id, kind: "next" } : null;
}

export function mapsUrl(event: ScheduleEvent): string | null {
  const query = event.mapsQuery ?? event.location;
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
