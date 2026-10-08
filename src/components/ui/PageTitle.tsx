import type { ReactNode } from "react";
import { Splash } from "@/components/ui/Splash";

interface PageTitleProps {
  /** Small-caps line above the title. */
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}

/** A screen's heading: functional eyebrow and Fraunces title, with the rotating toast beside it. */
export function PageTitle({ eyebrow, title, children }: PageTitleProps) {
  return (
    <header>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>}
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold leading-tight">{title}</h1>
        <Splash className="shrink-0 pb-0.5 text-accent" />
      </div>
      {children}
    </header>
  );
}
