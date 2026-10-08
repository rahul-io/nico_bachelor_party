import { MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { mapsUrl, type Highlight } from "@/lib/schedule";
import type { ScheduleEvent } from "@/lib/store/types";
import { formatTime } from "@/lib/time";

const badge: Record<Highlight["kind"], string> = {
  now: "Happening now",
  next: "Up next",
};

export function EventCard({ event, highlight }: { event: ScheduleEvent; highlight: Highlight["kind"] | null }) {
  const maps = mapsUrl(event);

  return (
    <article
      className={cn(
        "rounded-card border bg-surface p-4",
        highlight ? "border-primary ring-1 ring-primary" : "border-line",
      )}
    >
      {highlight && (
        <p className="mb-2 inline-block rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-on-primary">
          {badge[highlight]}
        </p>
      )}
      <p className="text-sm font-semibold text-accent tabular-nums">
        {formatTime(event.startsAt)}
        {event.endsAt && ` – ${formatTime(event.endsAt)}`}
      </p>
      <h2 className="font-display text-lg font-bold leading-snug">{event.title}</h2>

      {event.location &&
        (maps ? (
          <a
            href={maps}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex min-h-tap items-center gap-1.5 text-primary underline-offset-4 active:underline"
          >
            <MapPin className="size-4 shrink-0" aria-hidden />
            {event.location}
          </a>
        ) : (
          <p className="mt-1 text-muted">{event.location}</p>
        ))}

      {event.notes && <p className="mt-1 whitespace-pre-line text-muted">{event.notes}</p>}
    </article>
  );
}
