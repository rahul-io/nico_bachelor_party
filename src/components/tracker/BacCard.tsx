import { Card } from "@/components/ui/Card";
import { formatBac, type BacEstimate } from "@/lib/bac";
import { formatTime } from "@/lib/time";

export function BacCard({ estimate }: { estimate: BacEstimate | null }) {
  return (
    <Card className="text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">Estimated BAC</p>
      <p className="my-1 font-display text-6xl font-bold tabular-nums text-accent">
        {estimate ? formatBac(estimate.bac) : "–"}
      </p>
      <p className="text-muted">
        {estimate?.sessionStart
          ? `${estimate.sessionDrinks} ${estimate.sessionDrinks === 1 ? "drink" : "drinks"} since ${formatTime(estimate.sessionStart)}`
          : "Log a drink to get started"}
      </p>
      <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">
        A rough guess, just for fun. It can&apos;t tell you whether anyone is able to drive, so
        never use it for that.
      </p>
    </Card>
  );
}
