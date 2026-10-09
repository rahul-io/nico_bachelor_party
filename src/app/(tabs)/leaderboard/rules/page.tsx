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
        <Rule points={`+${s.hourWinnerPoints}`}>
          Hour Winner: the most drink points so far that day when the hour ends
          {s.hourWinnerMinDrinks > 0 &&
            `, if they logged at least ${s.hourWinnerMinDrinks} ${s.hourWinnerMinDrinks === 1 ? "drink" : "drinks"} that hour`}
          .
        </Rule>
        <Rule points={`+${s.hourTopBacPoints}`}>
          Top BAC of the hour, counted up to {formatBac(s.bacCeiling)}.
        </Rule>
        <Rule points={`+${s.hydroHomiePoints}`}>
          Landlubber (Hydro Homie): the most waters so far that day, if they logged one that hour.
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
        <Rule points={`+${s.lastManStandingPoints}`}>
          Last Man Standing: the last photo posted between {hour(s.lastManAfterHour)} and {cutoff}, confirmed by an
          admin.
        </Rule>
      </Section>

      <Section title="Slot machine">
        <Rule>
          {s.slotEveryDrinks === 1
            ? "Every drink you log spins."
            : `Every ${s.slotEveryDrinks} drinks you log, the last one spins: drink number ${s.slotEveryDrinks}, ${2 * s.slotEveryDrinks}, ${3 * s.slotEveryDrinks} and so on.`}{" "}
          The result is drawn when you log it; the reels just show it. If that drink earns no points, the spin
          doesn&apos;t count.
        </Rule>
        <Rule points={`${s.slotOdds1x}%`}>1×: no change.</Rule>
        <Rule points={`${s.slotOdds2x}%`}>2×: the drink scores double.</Rule>
        <Rule points={`${s.slotOdds3x}%`}>3×: the drink scores triple.</Rule>
        <Rule points={`${s.slotOddsBust}%`}>Bust: the drink scores {s.slotBustMultiplier}×.</Rule>
        <Rule points={`${s.slotOddsJackpot}%`}>Jackpot: +{s.slotJackpotPoints} on top.</Rule>
        <Rule points={`${s.slotOddsRob}%`}>
          Rob the Leader: take {s.slotRobPoints} from first place. If that is you, it spins again.
        </Rule>
        <Rule points={`${s.slotOddsForward}%`}>
          Pay It Forward: the drink&apos;s points go to a random other player who has logged in the last{" "}
          {s.activeHours} hours.
        </Rule>
        <Rule>
          Slot multipliers count towards the {s.maxMultiplier}× maximum. Delete a drink and log another within{" "}
          {s.slotReuseMinutes} minutes and you get the same result, not a new spin.
        </Rule>
      </Section>

      <Section title="Bartender's Choice">
        <Rule points={`${s.bartenderMultiplier}×`}>
          When an admin pours a round, everyone playing gets a drink on the Grog Log. Log exactly that within{" "}
          {s.bartenderMinutes} minutes.
        </Rule>
      </Section>

      <Section title="Groom Tax">
        <Rule points={`${s.groomMultiplier}×`}>
          Log a drink within {s.groomWindowMinutes} minutes of the groom logging one, then either of you posts the
          photo within {s.groomPhotoMinutes} minutes and marks it Groom Tax. Your drink&apos;s points are multiplied.
        </Rule>
        <Rule points={`+${s.groomPoints}`}>For the groom, each time.</Rule>
      </Section>

      <Section title="Wagers">
        <Rule>
          Challenge someone on the Games tab for up to {s.wagerMaxStake} points each. They have{" "}
          {s.wagerExpiryMinutes} minutes to accept. Stakes are held once it is accepted.
        </Rule>
        <Rule>Both of you report who won. If you agree, the winner takes both stakes. If not, an admin decides.</Rule>
        <Rule>
          Anyone else can back a side until the first result is reported. The side pot is split among those who
          backed the winner, in proportion to what they staked. If nobody backed the winner, side bets are returned.
        </Rule>
      </Section>

      <Section title="Curses">
        <Rule>Bought with your points. You can&apos;t spend below zero, and the target is told who did it.</Rule>
        <Rule points={String(s.curseNameCost)}>
          Name Hijack: they show under a name you choose for {s.curseNameMinutes} minutes.
        </Rule>
        <Rule points={String(s.curseDeadWeightCost)}>Dead Weight: their next drink scores nothing at all.</Rule>
        <Rule points={String(s.curseAvatarCost)}>
          Avatar Swap: their picture becomes a photo you pick from the Captain&apos;s Log, until midnight.
        </Rule>
        <Rule points={String(s.curseShieldCost)}>
          Shield: blocks the next curse aimed at you. Whoever sent it still pays.
        </Rule>
        <Rule>One curse of each kind per person at a time.</Rule>
      </Section>

      <Section title="Snitch Line">
        <Rule>
          Report someone with a photo from the Captain&apos;s Log and a reason. If {s.snitchVotes} other players
          upvote within {s.snitchMinutes} minutes, it stands.
        </Rule>
        <Rule points={`−${s.snitchPenalty}`}>For the accused.</Rule>
        <Rule points={`+${s.snitchReward}`}>For whoever reported it.</Rule>
      </Section>

      <Section title="Badges">
        <Rule>
          Merit badges go to anyone who meets the condition, as it happens. Achievements have one holder a day and are
          awarded when the day ends at {cutoff}; until then the leader is shown as holding it for now.
        </Rule>
        <Rule>Tap anyone&apos;s name or picture to see their trophy case and what each badge takes.</Rule>
        <Rule>Deleting the drink or water a merit badge rests on takes the badge back.</Rule>
      </Section>

      <Section title="Deleting">
        <Rule>
          Deleting a drink or a water takes back its points and anything it set off: a Jackpot, a robbery, points
          paid forward, a Groom Tax. If it leaves a Cheers short of people, the Cheers is taken back for everyone in
          it. Reversed entries stay in the Ledger, struck through.
        </Rule>
      </Section>
    </div>
  );
}
