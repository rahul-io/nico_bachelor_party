import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

// text-base (16px) keeps iOS Safari from zooming in on focus.
export const inputClass =
  "min-h-tap w-full rounded-control border border-line bg-raised px-3 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  suffix?: ReactNode;
}

export function Field({ label, suffix, className, ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      <span className="relative block">
        <input className={cn(inputClass, suffix != null && "pr-10", className)} {...props} />
        {suffix != null && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}
