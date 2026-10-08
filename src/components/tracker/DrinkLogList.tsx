import { GlassWater, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { describeDrink } from "@/lib/drinks";
import { formatDelta } from "@/lib/points/format";
import type { LoggedDrink, LoggedWater } from "@/lib/store/types";
import { formatWeekdayTime } from "@/lib/time";

interface DrinkLogListProps {
  drinks: LoggedDrink[];
  waters: LoggedWater[];
  onDeleteDrink: (id: string) => void;
  onDeleteWater: (id: string) => void;
}

type Entry = ({ kind: "drink" } & LoggedDrink) | ({ kind: "water" } & LoggedWater);

export function DrinkLogList({ drinks, waters, onDeleteDrink, onDeleteWater }: DrinkLogListProps) {
  const entries: Entry[] = [
    ...drinks.map((drink) => ({ kind: "drink" as const, ...drink })),
    ...waters.map((water) => ({ kind: "water" as const, ...water })),
  ].sort((a, b) => b.consumedAt.localeCompare(a.consumedAt));

  if (entries.length === 0) {
    return <Card className="text-muted">Nothing logged yet.</Card>;
  }

  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface">
      {entries.map((entry) => {
        const name = entry.kind === "drink" ? entry.name : "Water";
        return (
          <li key={entry.id} className="flex items-center gap-3 py-2 pl-4 pr-1">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-medium">
                {entry.kind === "water" && <GlassWater className="size-4 shrink-0 text-muted" aria-hidden />}
                {name}
              </p>
              <p className="text-sm text-muted">
                {entry.kind === "drink" && `${describeDrink(entry)} · `}
                {formatWeekdayTime(entry.consumedAt)}
              </p>
              {entry.kind === "drink" && entry.pointsLine && (
                <p className="text-sm tabular-nums text-muted">{entry.pointsLine}</p>
              )}
            </div>
            {entry.points !== null && (
              <span className="shrink-0 font-display text-lg font-bold tabular-nums text-accent">
                {formatDelta(entry.points)}
              </span>
            )}
            <button
              type="button"
              onClick={() => (entry.kind === "drink" ? onDeleteDrink(entry.id) : onDeleteWater(entry.id))}
              disabled={entry.id.startsWith("pending-")}
              aria-label={`Delete ${name}`}
              className="flex size-tap shrink-0 items-center justify-center rounded-control text-muted active:text-danger disabled:opacity-40"
            >
              <Trash2 className="size-5" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
