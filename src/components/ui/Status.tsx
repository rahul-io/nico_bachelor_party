import type { ActionStatus } from "@/hooks/useAction";
import { cn } from "@/lib/cn";

/** One-line result message under a form. Keeps its height when empty so layout doesn't jump. */
export function Status({ status }: { status: ActionStatus | null }) {
  return (
    <p
      aria-live="polite"
      className={cn("min-h-5 text-center text-sm", status?.error ? "text-danger" : "text-muted")}
    >
      {status?.text}
    </p>
  );
}
