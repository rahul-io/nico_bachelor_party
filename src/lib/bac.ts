import type { Sex } from "./store/types";

export const ML_PER_OZ = 29.5735;
export const ETHANOL_G_PER_ML = 0.789;
export const STANDARD_DRINK_G = 14;
/** BAC percentage points eliminated per hour. */
export const ELIMINATION_PER_HOUR = 0.015;

const FALLBACK_R: Record<Sex, number> = { male: 0.68, female: 0.55 };
const R_MIN = 0.4;
const R_MAX = 0.9;
const MS_PER_HOUR = 3_600_000;

export interface Body {
  sex: Sex;
  heightCm: number;
  weightKg: number;
}

export interface BacDrink {
  alcoholG: number;
  consumedAt: string | number | Date;
}

export interface BacEstimate {
  /** Estimated BAC in percent, e.g. 0.062. Never negative. */
  bac: number;
  /** When the current drinking session started (ms), or null if BAC is 0. */
  sessionStart: number | null;
  /** Drinks logged in the current session. */
  sessionDrinks: number;
}

/** Grams of ethanol in a drink. `abv` is a fraction (0.05 for 5%). */
export function alcoholGrams(volumeOz: number, abv: number): number {
  return volumeOz * ML_PER_OZ * abv * ETHANOL_G_PER_ML;
}

/** Widmark distribution factor via Seidl, with fixed fallbacks for implausible results. */
export function widmarkR({ sex, heightCm, weightKg }: Body): number {
  const r =
    sex === "male"
      ? 0.31608 - 0.004821 * weightKg + 0.004632 * heightCm
      : 0.31223 - 0.006446 * weightKg + 0.004466 * heightCm;
  return Number.isFinite(r) && r >= R_MIN && r <= R_MAX ? r : FALLBACK_R[sex];
}

/**
 * Widmark estimate at time `at`. Drinks are absorbed instantly and eliminated
 * at a constant rate from the first drink of a session; when BAC reaches 0 the
 * session ends and the next drink starts a new one. Drinks after `at` are ignored.
 */
export function estimateBac(
  body: Body,
  drinks: BacDrink[],
  at: number | Date = Date.now(),
): BacEstimate {
  const atMs = new Date(at).getTime();
  const perGram = 100 / (body.weightKg * 1000 * widmarkR(body));
  const timeline = drinks
    .map((drink) => ({ g: drink.alcoholG, t: new Date(drink.consumedAt).getTime() }))
    .filter((drink) => drink.t <= atMs)
    .sort((a, b) => a.t - b.t);

  let bac = 0;
  let lastT = 0;
  let sessionStart: number | null = null;
  let sessionDrinks = 0;

  const eliminateUntil = (t: number) => {
    bac = Math.max(0, bac - (ELIMINATION_PER_HOUR * (t - lastT)) / MS_PER_HOUR);
    lastT = t;
    if (bac === 0) {
      sessionStart = null;
      sessionDrinks = 0;
    }
  };

  for (const drink of timeline) {
    eliminateUntil(drink.t);
    sessionStart ??= drink.t;
    sessionDrinks += 1;
    bac += drink.g * perGram;
  }
  eliminateUntil(atMs);

  return { bac, sessionStart, sessionDrinks };
}

/** "0.062%" */
export function formatBac(bac: number): string {
  return `${bac.toFixed(3)}%`;
}
