"use client";

import { useState } from "react";
import { DayPicker } from "@/components/schedule/DayPicker";
import { EventCard } from "@/components/schedule/EventCard";
import { Card } from "@/components/ui/Card";
import { PhotoBand } from "@/components/ui/PhotoBand";
import { Splash } from "@/components/ui/Splash";
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
  const highlighted = highlight ? events?.find((event) => event.id === highlight.id) : undefined;
  const dayEvents = events?.filter((event) => dayKey(event.startsAt) === selected);

  return (
    <div className="space-y-4">
      <PhotoBand image="/brand/hero-sunset.webp" focus="object-[70%_center]">
        <Splash className="absolute right-4 top-4 text-gold-hi" />
        <div className="px-5 pb-5 pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-hi">Ahoy, crew</p>
          <h1 className="font-display text-3xl font-bold leading-tight">The Voyage</h1>
          {highlighted && (
            <p className="mt-0.5 text-sand/90">
              {highlight?.kind === "now" ? "Under way" : "Next port of call"}: {highlighted.title}
            </p>
          )}
        </div>
      </PhotoBand>

      <DayPicker days={config.days} selected={selected} today={today} onSelect={setPicked} />
      <h2 className="font-display text-xl font-bold">{dayParts(selected).long}</h2>

      {!events && error && <Card className="text-muted">Couldn&apos;t load the schedule. Retrying…</Card>}
      {!events && !error && <Card className="text-muted">Loading…</Card>}
      {dayEvents?.length === 0 && <Card className="text-muted">Nothing charted for this day yet.</Card>}

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
