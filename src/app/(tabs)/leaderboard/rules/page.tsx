"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/ui/PageTitle";
import { usePolled } from "@/hooks/usePolled";
import { formatBac } from "@/lib/bac";
import { defaultSettings, type PointsSettings } from "@/lib/points/settings";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <ul className="mt-2 space-y-2">{children}</ul>
    </section>
  );
}

function Rule({ points, children }: { points?: string; children: ReactNode }) {
  return (
    <li className="flex items-baseline gap-3">
      <p className="min-w-0 flex-1">{children}</p>
      {points && <span className="shrink-0 font-display font-bold tabular-nums text-accent">{points}</span>}
    </li>
  );
}

const hour = (value: number) => `${value % 12 === 0 ? 12 : value % 12}${value < 12 ? "am" : "pm"}`;

/** Written from the current settings, so it always matches what the app is doing. */
export default function RulesPage() {
  const { data } = usePolled<PointsSettings>("/api/points/settings");
  const s = data ?? defaultSettings;
  const cutoff = hour(s.dayCutoffHour);

  return (
    <div className="space-y-4">
      <Link href="/leaderboard" className="inline-flex min-h-tap items-center gap-1.5 text-muted">
        <ArrowLeft className="size-5" aria-hidden />
        Leaderboard
      </Link>
      <PageTitle eyebrow="The Crider Cup" title="How points work" />

      <Section title="Drinks">
        <Rule points={`${s.pointsPerDrink} each`}>
          Per standard drink (14 g of alcohol), worked out from the size and strength you log. A 1.4 standard drink
          earns {(1.4 * s.pointsPerDrink).toFixed(1)}.
        </Rule>
        <Rule>
          Pace cap: {s.paceCap} standard drinks in any rolling hour. Whatever goes over the cap earns nothing.
        </Rule>
        <Rule>Points pause while your estimated BAC is {formatBac(s.bacCeiling)} or higher. Drinks still log.</Rule>
      </Section>

      <Section title="Water">
        <Rule points={`+${s.waterPoints}`}>Each water, up to {s.waterMaxPerHour} in any rolling hour.</Rule>
        <Rule points={`${s.hydrationMultiplier}×`}>Your next drink after a water. It does not stack.</Rule>
      </Section>

      <Section title="Multipliers">
        <Rule points={`${s.happyHourMultiplier}×`}>Happy Hour, while the banner is up.</Rule>
        <Rule points={`${s.drinkOfDayMultiplier}×`}>The Drink of the Day, shown on the Grog Log.</Rule>
        <Rule>Multipliers multiply together, up to {s.maxMultiplier}× on one drink.</Rule>
      </Section>

      <Section title="Cheers">
        <Rule points={`+${s.cheersPoints} each`}>
          {s.cheersMinPeople} or more people log a drink within {s.cheersWindowMinutes} minutes of each other. Not
          multiplied. One per person per round.
        </Rule>
      </Section>

      <Section title="Every hour">
        <Rule points={`+${s.hourWinnerPoints}`}>Hour Winner: the most drink points so far that day when the hour ends.</Rule>
        <Rule points={`+${s.hourTopBacPoints}`}>
          Top BAC of the hour, counted up to {formatBac(s.bacCeiling)}.
        </Rule>
        <Rule>Paid only for hours in which at least {s.hourMinActive} people logged something.</Rule>
      </Section>

      <Section title="Every day">
        <Rule>
          A day runs {cutoff} to {cutoff}. Awards are handed out at {cutoff}; ties go to whoever got there first.
        </Rule>
        <Rule points={`+${s.smoothSailingPoints}`}>
          Smooth Sailing: the most time between {formatBac(s.bandLow)} and {formatBac(s.bandHigh)}.
        </Rule>
        <Rule points={`+${s.drunkestSailorPoints}`}>
          Drunkest Sailor: the highest BAC of the day, counted up to {formatBac(s.bacCeiling)}.
        </Rule>
        <Rule points={`+${s.fastestClimbPoints}`}>
          Fastest Climb: the shortest time from 0.000% to {formatBac(s.bacCeiling)}.
        </Rule>
        <Rule points={`+${s.hydroHomiePoints}`}>Landlubber (Hydro Homie): the most waters.</Rule>
        <Rule points={`+${s.lastManStandingPoints}`}>
          Last Man Standing: the last photo posted between {hour(s.lastManAfterHour)} and {cutoff}, confirmed by an
          admin.
        </Rule>
      </Section>

      <Section title="Deleting">
        <Rule>
          Deleting a drink or a water takes back its points. If that leaves a Cheers short of people, the Cheers is
          taken back for everyone in it. Reversed entries stay in the Ledger, struck through.
        </Rule>
      </Section>
    </div>
  );
}
