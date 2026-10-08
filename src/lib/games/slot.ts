import type { PointsSettings } from "@/lib/points/settings";

/** The slot machine's odds and draw. Pure: the random number is passed in. */

export const SLOT_OUTCOMES = ["1x", "2x", "3x", "bust", "jackpot", "rob", "forward"] as const;
export type SlotOutcome = (typeof SLOT_OUTCOMES)[number];

export const slotNames: Record<SlotOutcome, string> = {
  "1x": "1×",
  "2x": "2×",
  "3x": "3×",
  bust: "BUST",
  jackpot: "JACKPOT",
  rob: "ROB THE LEADER",
  forward: "PAY IT FORWARD",
};

export const slotEmoji: Record<SlotOutcome, string> = {
  "1x": "🍺",
  "2x": "🍻",
  "3x": "🏴‍☠️",
  bust: "💀",
  jackpot: "🎰",
  rob: "🦜",
  forward: "🎁",
};

export function slotOdds(settings: PointsSettings): Array<[SlotOutcome, number]> {
  return [
    ["1x", settings.slotOdds1x],
    ["2x", settings.slotOdds2x],
    ["3x", settings.slotOdds3x],
    ["bust", settings.slotOddsBust],
    ["jackpot", settings.slotOddsJackpot],
    ["rob", settings.slotOddsRob],
    ["forward", settings.slotOddsForward],
  ];
}

/**
 * Picks an outcome from `random` in [0, 1). Excluded outcomes (a leader can't
 * rob themselves; nobody to pay forward to) are rerolled by sharing their odds
 * among the rest in proportion.
 */
export function drawSlot(random: number, settings: PointsSettings, exclude: SlotOutcome[] = []): SlotOutcome {
  const odds = slotOdds(settings).filter(([outcome, weight]) => weight > 0 && !exclude.includes(outcome));
  const total = odds.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return "1x";
  let mark = random * total;
  for (const [outcome, weight] of odds) {
    if (mark < weight) return outcome;
    mark -= weight;
  }
  return odds[odds.length - 1][0];
}

/** The multiplier an outcome puts on the drink, if it is that kind of outcome. */
export function slotFactor(outcome: SlotOutcome, settings: PointsSettings): number | null {
  if (outcome === "2x") return 2;
  if (outcome === "3x") return 3;
  if (outcome === "bust") return settings.slotBustMultiplier;
  return null;
}
