import { cn } from "@/lib/cn";

/**
 * "THE CRIDER CUP" set in the brand faces. Live text rather than an image so it
 * stays sharp at any size and can sit on navy, sand or a photograph.
 */
export function Wordmark({ size = "sm", className }: { size?: "sm" | "lg"; className?: string }) {
  return (
    <span className={cn("inline-flex flex-col items-center leading-none", className)}>
      <span
        className={cn(
          "font-semibold uppercase tracking-[0.35em] text-gold",
          size === "lg" ? "text-xs" : "text-[0.5rem]",
        )}
      >
        The
      </span>
      <span
        className={cn(
          "font-display font-bold uppercase tracking-wide",
          size === "lg" ? "mt-1 text-4xl" : "mt-0.5 text-[1.05rem]",
        )}
      >
        Crider Cup
      </span>
    </span>
  );
}
