import { cn } from "@/lib/cn";
import { dayParts } from "@/lib/time";

interface DayPickerProps {
  days: readonly string[];
  selected: string;
  today: string;
  onSelect: (day: string) => void;
}

export function DayPicker({ days, selected, today, onSelect }: DayPickerProps) {
  return (
    <div className="flex gap-2" role="tablist" aria-label="Day">
      {days.map((day) => {
        const { weekday, day: dayOfMonth } = dayParts(day);
        const active = day === selected;
        return (
          <button
            key={day}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(day)}
            className={cn(
              "flex min-h-tap flex-1 flex-col items-center rounded-control border py-2 transition active:scale-[0.97]",
              active ? "border-select bg-select text-on-select" : "border-line bg-surface text-muted",
            )}
          >
            <span className="text-xs font-medium uppercase tracking-wide">{weekday}</span>
            <span className="font-display text-xl font-bold">{dayOfMonth}</span>
            <span
              className={cn(
                "mt-0.5 size-1.5 rounded-full",
                day === today ? (active ? "bg-on-select" : "bg-accent") : "bg-transparent",
              )}
              aria-hidden
            />
            {day === today && <span className="sr-only">Today</span>}
          </button>
        );
      })}
    </div>
  );
}
