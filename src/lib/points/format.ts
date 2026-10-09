import type { DrinkBreakdown, PointSource } from "@/lib/store/types";

/** Points are kept to one decimal place; sums are rounded so 4.2 + 2.1 never shows as 6.300000001. */
export function roundPoints(points: number): number {
  return Math.round(points * 10) / 10;
}

/** "12" or "12.6". */
export function formatPoints(points: number): string {
  const rounded = roundPoints(points);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** "+12.6", "−3" or "0". */
export function formatDelta(points: number): string {
  const rounded = roundPoints(points);
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${formatPoints(rounded)}` : `−${formatPoints(-rounded)}`;
}

const trim = (value: number) => String(Math.round(value * 100) / 100);

/** "1.4 std × 3 = 4.2 × 1.5 hydration = 6.3" */
export function describeBreakdown(breakdown: DrinkBreakdown, delta: number): string {
  const { std, counted, rate, multipliers, multiplier, paused, note } = breakdown;
  if (paused) return `${trim(std)} std · points paused`;
  if (note) return `${trim(std)} std · ${note}`;

  let line = `${trim(std)} std`;
  if (counted < std) line += `, ${trim(counted)} under the pace cap`;
  line += ` × ${trim(rate)}`;
  if (multipliers.length === 0) return `${line} = ${formatPoints(delta)}`;

  line += ` = ${formatPoints(counted * rate)}`;
  for (const item of multipliers) line += ` × ${trim(item.factor)} ${item.label}`;
  const stacked = multipliers.reduce((product, item) => product * item.factor, 1);
  if (multiplier < stacked) line += ` (max ${trim(multiplier)}×)`;
  return `${line} = ${formatPoints(delta)}`;
}

export const sourceLabels: Record<PointSource, string> = {
  drink: "Drinks",
  water: "Water",
  cheers: "Cheers",
  hourly: "Hourly awards",
  award: "Daily awards",
  admin: "Challenges and admin",
  slot: "Slot machine",
  groom: "Groom Tax",
  wager: "Wagers",
  curse: "Curses",
  snitch: "Snitch Line",
  badge: "Badges",
};
