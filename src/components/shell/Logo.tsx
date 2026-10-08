import Image from "next/image";
import { config } from "@/config";
import { cn } from "@/lib/cn";

/** The Crider Cup mascot badge. Regenerate the file with scripts/make-logo.mjs. */
export function Logo({ size, className, priority }: { size: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt={config.partyName}
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 select-none", className)}
    />
  );
}
