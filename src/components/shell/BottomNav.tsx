"use client";

import { BookOpenText, BottleWine, Plus, ShipWheel, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Two tabs either side of the gold "log a drink" button.
const left: Tab[] = [
  { href: "/schedule", label: "Schedule", icon: ShipWheel },
  { href: "/tracker", label: "Grog Log", icon: BottleWine },
];
const right: Tab[] = [
  { href: "/leaderboard", label: "Leaders", icon: Trophy },
  { href: "/photos", label: "Capt's Log", icon: BookOpenText },
];

function NavTab({ href, label, icon: Icon, active }: Tab & { active: boolean }) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors",
          active ? "text-gold-hi" : "text-on-chrome/55",
        )}
      >
        {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gold" aria-hidden />}
        <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
        {label}
      </Link>
    </li>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gold/30 bg-chrome pb-[env(safe-area-inset-bottom)] text-on-chrome">
      <ul className="mx-auto flex h-nav max-w-app items-stretch">
        {left.map((tab) => (
          <NavTab key={tab.href} {...tab} active={pathname.startsWith(tab.href)} />
        ))}
        <li className="flex w-16 shrink-0 items-start justify-center">
          <Link
            href="/tracker"
            aria-label="Log a drink"
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-linear-to-b from-gold-hi to-gold text-navy shadow-card ring-4 ring-chrome transition active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden />
          </Link>
        </li>
        {right.map((tab) => (
          <NavTab key={tab.href} {...tab} active={pathname.startsWith(tab.href)} />
        ))}
      </ul>
    </nav>
  );
}
