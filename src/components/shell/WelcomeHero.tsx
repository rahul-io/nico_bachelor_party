import type { ReactNode } from "react";
import { Splash } from "@/components/ui/Splash";
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
        {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized brand asset */}
        <img src="/brand/lockup.webp" alt={config.partyName} className="h-64 w-auto drop-shadow-xl" />
        <Splash size="lg" className="mt-3 text-gold-hi drop-shadow-lg" />
        {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized brand asset */}
        <img src="/brand/rope.webp" alt="" className="my-2 h-10 w-auto" />
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-gold-hi">
          {config.tagline} · {config.location}
        </p>
        {children}
      </div>
    </div>
  );
}
