"use client";

import { useState } from "react";
import { DayPicker } from "@/components/schedule/DayPicker";
import { EventCard } from "@/components/schedule/EventCard";
import { Card } from "@/components/ui/Card";
import { config } from "@/config";
import { useNow } from "@/hooks/useNow";
import { useSchedule } from "@/hooks/useSchedule";
import { findHighlight } from "@/lib/schedule";
import { dayKey, dayParts } from "@/lib/time";

function defaultDay(today: string): string {
  if (config.days.includes(today)) return today;
  return today < config.days[0] ? config.days[0] : config.days[config.days.length - 1];
}

export default function SchedulePage() {
  const { events, error } = useSchedule();
  const now = useNow(30_000);
  const [picked, setPicked] = useState<string | null>(null);

  // The day picker depends on today's date, which only the browser knows.
  if (now === null) return <Card className="text-muted">Loading…</Card>;

  const today = dayKey(now);
  const selected = picked ?? defaultDay(today);
  const highlight = events ? findHighlight(events, now) : null;
  const dayEvents = events?.filter((event) => dayKey(event.startsAt) === selected);

  return (
    <div className="space-y-4">
      <DayPicker days={config.days} selected={selected} today={today} onSelect={setPicked} />
      <h1 className="font-display text-xl font-bold">{dayParts(selected).long}</h1>

      {!events && error && <Card className="text-muted">Couldn&apos;t load the schedule. Retrying…</Card>}
      {!events && !error && <Card className="text-muted">Loading…</Card>}
      {dayEvents?.length === 0 && <Card className="text-muted">Nothing planned yet for this day.</Card>}

      <ol className="space-y-3">
        {dayEvents?.map((event) => (
          <li key={event.id}>
            <EventCard event={event} highlight={highlight?.id === event.id ? highlight.kind : null} />
          </li>
        ))}
      </ol>
    </div>
  );
}
