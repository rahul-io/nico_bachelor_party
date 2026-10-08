import { MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { mapsUrl, type Highlight } from "@/lib/schedule";
import type { ScheduleEvent } from "@/lib/store/types";
import { formatTime } from "@/lib/time";

// Coral is the playful alert (it's happening); gold marks what's next.
const badge: Record<Highlight["kind"], { label: string; className: string }> = {
  now: { label: "Under way", className: "bg-coral text-navy" },
  next: { label: "Next port of call", className: "bg-primary text-on-primary" },
};

export function EventCard({ event, highlight }: { event: ScheduleEvent; highlight: Highlight["kind"] | null }) {
  const maps = mapsUrl(event);

  return (
    <article
      className={cn(
        "rounded-card border bg-surface p-4 shadow-card",
        highlight ? "border-accent ring-1 ring-accent" : "border-line",
      )}
    >
      {highlight && (
        <p
          className={cn(
            "mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
            badge[highlight].className,
          )}
        >
          {badge[highlight].label}
        </p>
      )}
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent tabular-nums">
        {formatTime(event.startsAt)}
        {event.endsAt && ` – ${formatTime(event.endsAt)}`}
      </p>
      <h3 className="font-display text-xl font-bold leading-snug">{event.title}</h3>

      {event.location &&
        (maps ? (
          <a
            href={maps}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex min-h-tap items-center gap-1.5 text-link underline-offset-4 active:underline"
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
