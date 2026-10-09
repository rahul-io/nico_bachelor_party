import type { BadgeView, TrophyCase as Trophies } from "@/lib/badges/service";
import { cn } from "@/lib/cn";
import { formatDelta } from "@/lib/points/format";

const sizes = { sm: "size-14 text-3xl", md: "size-20 text-5xl", lg: "size-64 text-9xl" };

/** A badge's crest, or its emoji when it has no image. */
export function BadgeIcon({
  badge,
  size = "sm",
  className,
}: {
  badge: Pick<BadgeView, "imageUrl" | "emoji">;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center", sizes[size], className)} aria-hidden>
      {badge.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized badge art
        <img src={badge.imageUrl} alt="" loading="lazy" draggable={false} className="size-full object-contain" />
      ) : (
        badge.emoji
      )}
    </span>
  );
}

const eyebrow = "text-xs font-semibold uppercase tracking-[0.16em] text-accent";

function Row({ badge, count, locked = false }: { badge: BadgeView; count?: number; locked?: boolean }) {
  return (
    <li className={cn("flex items-center gap-3 px-3 py-2.5", locked && "opacity-55")}>
      <BadgeIcon badge={badge} className={cn(locked && "grayscale")} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {badge.name}
          {count !== undefined && count > 1 && <span className="ml-1.5 tabular-nums text-accent">×{count}</span>}
        </p>
        <p className="text-sm text-muted">{badge.description}</p>
      </div>
      {badge.points !== 0 && (
        <span className={cn("shrink-0 font-display font-bold tabular-nums", badge.points < 0 ? "text-danger" : "text-accent")}>
          {formatDelta(badge.points)}
        </span>
      )}
    </li>
  );
}

const list = "divide-y divide-line rounded-card border border-line bg-surface";

/**
 * A person's badges: what they have, the day's achievements they are leading
 * (awarded when the day ends), and everything still to be earned, greyed out.
 */
export function TrophyCase({ trophies }: { trophies: Trophies }) {
  return (
    <div className="space-y-4">
      {trophies.leading.length > 0 && (
        <section className="space-y-2">
          <h3 className={eyebrow}>Holding today</h3>
          <ul className={cn(list, "border-gold/60")}>
            {trophies.leading.map((badge) => (
              <Row key={badge.id} badge={badge} />
            ))}
          </ul>
          <p className="text-sm text-muted">Awarded when the day ends, if it holds.</p>
        </section>
      )}

      <section className="space-y-2">
        <h3 className={eyebrow}>Earned</h3>
        {trophies.earned.length === 0 ? (
          <p className="rounded-card border border-line bg-surface px-4 py-3 text-muted">Nothing in the case yet.</p>
        ) : (
          <ul className={list}>
            {trophies.earned.map((badge) => (
              <Row key={badge.id} badge={badge} count={badge.count} />
            ))}
          </ul>
        )}
      </section>

      {trophies.locked.length > 0 && (
        <section className="space-y-2">
          <h3 className={eyebrow}>Still to earn</h3>
          <ul className={list}>
            {trophies.locked.map((badge) => (
              <Row key={badge.id} badge={badge} locked />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
