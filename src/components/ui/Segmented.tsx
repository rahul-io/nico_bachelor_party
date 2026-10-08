import { cn } from "@/lib/cn";

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "md" | "sm";
}

export function Segmented<T extends string>({ options, value, onChange, label, size = "md" }: SegmentedProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-control border border-line bg-surface p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-[calc(var(--radius-control)-0.25rem)] px-2 font-medium transition",
              size === "md" ? "min-h-tap text-base" : "min-h-9 text-sm",
              active ? "bg-primary text-on-primary" : "text-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
