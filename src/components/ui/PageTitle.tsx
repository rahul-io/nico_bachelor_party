import type { ReactNode } from "react";
import { Splash } from "@/components/ui/Splash";

interface PageTitleProps {
  /** Small-caps line above the title. */
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}

/** A screen's heading: eyebrow with the rotating toast opposite it, then the Fraunces title. */
export function PageTitle({ eyebrow, title, children }: PageTitleProps) {
  return (
    <header>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
        <Splash className="shrink-0 text-accent" />
      </div>
      <h1 className="font-display text-3xl font-bold leading-tight">{title}</h1>
      {children}
    </header>
  );
}
