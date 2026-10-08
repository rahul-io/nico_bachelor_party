import { dayKey, dayParts, formatHour, timeInputValue } from "./time";

const HOUR_MS = 3_600_000;

/** Round tick values covering [min, max]; the first is <= min and the last >= max. */
export function niceTicks(min: number, max: number, target = 4, minStep = 0): number[] {
  const raw = (max - min || 1) / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = Math.max((normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude, minStep);

  const ticks: number[] = [];
  for (let value = Math.floor(min / step) * step; ; value += step) {
    ticks.push(Number(value.toFixed(6)));
    if (value >= max - 1e-9) break;
  }
  return ticks;
}

/** Time-axis ticks in the party timezone: weekdays at midnight for long ranges, hours otherwise. */
export function timeTicks(start: number, end: number): Array<{ t: number; label: string }> {
  const rangeHours = (end - start) / HOUR_MS;
  const byDay = rangeHours > 30;
  const everyHours = [1, 2, 3, 6, 12].find((step) => rangeHours / step <= 5) ?? 12;

  const ticks: Array<{ t: number; label: string }> = [];
  for (let t = Math.ceil(start / HOUR_MS) * HOUR_MS; t <= end; t += HOUR_MS) {
    const hour = Number(timeInputValue(t).slice(0, 2));
    if (byDay ? hour === 0 : hour % everyHours === 0) {
      ticks.push({ t, label: byDay ? dayParts(dayKey(t)).weekday : formatHour(t) });
    }
  }
  return ticks;
}

/**
 * Nudges label positions apart so none overlap: each ends up at least `gap`
 * from its neighbours and no lower than `max`. Returns positions in input order.
 */
export function spreadApart(positions: number[], gap: number, max: number): number[] {
  const order = positions.map((_, index) => index).sort((a, b) => positions[a] - positions[b]);
  const placed = new Array<number>(positions.length);
  let previous = -Infinity;
  for (const index of order) {
    placed[index] = Math.max(positions[index], previous + gap);
    previous = placed[index];
  }
  let limit = max;
  for (const index of [...order].reverse()) {
    placed[index] = Math.min(placed[index], limit);
    limit = placed[index] - gap;
  }
  return placed;
}
