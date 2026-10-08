import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PhotoBandProps {
  /** A file in /public/brand. Photography is used on a few chosen screens only. */
  image: string;
  /** Where the photograph's subject sits, e.g. "object-left". */
  focus?: string;
  /** How the navy wash is laid over the photo so sand lettering stays readable. */
  wash?: string;
  className?: string;
  children: ReactNode;
}

/** A photograph with a navy wash and sand lettering on top. Looks the same by day and night. */
export function PhotoBand({
  image,
  focus = "object-center",
  wash = "bg-linear-to-t from-navy via-navy/60 to-navy/5",
  className,
  children,
}: PhotoBandProps) {
  return (
    <section className={cn("relative isolate overflow-hidden rounded-card text-sand shadow-card", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized brand asset */}
      <img src={image} alt="" className={cn("absolute inset-0 -z-20 size-full object-cover", focus)} />
      <div className={cn("absolute inset-0 -z-10", wash)} aria-hidden />
      {children}
    </section>
  );
}
