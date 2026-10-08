import type { ReactNode } from "react";

interface PageTitleProps {
  /** Small-caps line above the title. */
  eyebrow?: string;
  title: string;
  /** One decorative line in the script face. Use sparingly. */
  flourish?: string;
  children?: ReactNode;
}

/** A screen's heading: functional eyebrow, Fraunces title, optional script flourish. */
export function PageTitle({ eyebrow, title, flourish, children }: PageTitleProps) {
  return (
    <header>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>}
      <h1 className="font-display text-3xl font-bold leading-tight">{title}</h1>
      {flourish && <p className="font-script text-lg italic text-muted">{flourish}</p>}
      {children}
    </header>
  );
}
