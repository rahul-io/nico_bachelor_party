import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { describeDrink } from "@/lib/drinks";
import type { DrinkLog } from "@/lib/store/types";
import { formatWeekdayTime } from "@/lib/time";

export function DrinkLogList({ drinks, onDelete }: { drinks: DrinkLog[]; onDelete: (id: string) => void }) {
  if (drinks.length === 0) {
    return <Card className="text-muted">Nothing logged yet.</Card>;
  }

  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface">
      {drinks.map((drink) => (
        <li key={drink.id} className="flex items-center gap-3 py-2 pl-4 pr-1">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{drink.name}</p>
            <p className="text-sm text-muted">
              {describeDrink(drink)} · {formatWeekdayTime(drink.consumedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDelete(drink.id)}
            disabled={drink.id.startsWith("pending-")}
            aria-label={`Delete ${drink.name}`}
            className="flex size-tap shrink-0 items-center justify-center rounded-control text-muted active:text-danger disabled:opacity-40"
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
