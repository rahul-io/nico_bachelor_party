import type { ReactNode } from "react";
import { config } from "@/config";

/**
 * The top of the screens a guest sees before they are aboard (invite code,
 * welcome, log in): the one place the full crest and a full photograph appear together.
 */
export function WelcomeHero({ children }: { children?: ReactNode }) {
  return (
    <div className="relative isolate mb-5 overflow-hidden text-center text-sand">
      {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized brand asset */}
      <img
        src="/brand/hero-sunset-tall.webp"
        alt=""
        className="absolute inset-0 -z-20 size-full object-cover object-[center_60%]"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-navy/25 via-navy/10 to-navy" aria-hidden />
      <div className="flex flex-col items-center px-6 pb-7 pt-[calc(env(safe-area-inset-top)+2rem)]">
        {/* A soft sand glow keeps the crest's navy lettering clear of the sky. */}
        <div className="rounded-full bg-radial from-sand/85 via-sand/50 to-transparent to-70% p-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized brand asset */}
          <img src="/brand/lockup.webp" alt={config.partyName} className="h-52 w-auto drop-shadow-lg" />
        </div>
        <p className="mt-4 font-script text-lg italic">Drink. Explore. Compete. Legend awaits.</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized brand asset */}
        <img src="/brand/rope.webp" alt="" className="my-3 h-4 w-auto opacity-90" />
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-gold-hi">
          {config.tagline} · {config.location}
        </p>
        {children}
      </div>
    </div>
  );
}
