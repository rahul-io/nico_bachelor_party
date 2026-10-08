import { PhotoBand } from "@/components/ui/PhotoBand";
import { formatBac, type BacEstimate } from "@/lib/bac";
import { formatTime } from "@/lib/time";

/**
 * The gauge at the top of the Rum Log, set against the tiki bar. The number is
 * sand, like all lettering on photographs: it is never coloured teal or green,
 * which would read as a verdict.
 */
export function BacCard({ estimate }: { estimate: BacEstimate | null }) {
  return (
    <PhotoBand
      image="/brand/tiki.webp"
      focus="object-left"
      wash="bg-linear-to-l from-navy via-navy/75 to-navy/10"
    >
      <div className="ml-auto flex min-h-48 w-[62%] flex-col justify-center py-5 pr-5 text-right">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-hi">Blood alcohol</p>
        <p className="font-display text-5xl font-bold leading-tight tabular-nums">
          {estimate ? formatBac(estimate.bac) : "–"}
        </p>
        <p className="text-sm text-sand/85">
          {estimate?.sessionStart
            ? `${estimate.sessionDrinks} ${estimate.sessionDrinks === 1 ? "drink" : "drinks"} since ${formatTime(estimate.sessionStart)}`
            : "Nothing in the log. Pour something."}
        </p>
      </div>
    </PhotoBand>
  );
}
