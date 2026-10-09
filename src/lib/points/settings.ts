/**
 * Every number in the points economy. These are the defaults; Admin > Points
 * settings stores overrides, and the form there is generated from this list.
 */
export const settingDefs = [
  { key: "pointsPerDrink", group: "Drinks", label: "Points per standard drink", value: 3, min: 0, max: 100, step: 0.5 },
  { key: "paceCap", group: "Drinks", label: "Pace cap, standard drinks per rolling hour", value: 10, min: 1, max: 50, step: 0.5 },
  { key: "bacCeiling", group: "Drinks", label: "BAC ceiling, % (points pause at or above)", value: 0.18, min: 0.02, max: 0.5, step: 0.01 },
  { key: "maxMultiplier", group: "Drinks", label: "Maximum combined multiplier", value: 6, min: 1, max: 200, step: 0.5 },

  { key: "waterPoints", group: "Water", label: "Points per water", value: 1, min: 0, max: 20, step: 0.5 },
  { key: "waterMaxPerHour", group: "Water", label: "Scoring waters per rolling hour", value: 2, min: 0, max: 20, step: 1 },
  { key: "hydrationMultiplier", group: "Water", label: "Next drink after a water, ×", value: 1.5, min: 1, max: 10, step: 0.1 },

  { key: "happyHourMultiplier", group: "Multipliers", label: "Happy Hour, ×", value: 2, min: 1, max: 10, step: 0.5 },
  { key: "happyHourMinutes", group: "Multipliers", label: "Happy Hour length, minutes", value: 60, min: 5, max: 480, step: 5 },
  { key: "drinkOfDayMultiplier", group: "Multipliers", label: "Drink of the Day, ×", value: 2, min: 1, max: 10, step: 0.5 },

  { key: "cheersPoints", group: "Cheers", label: "Points each", value: 3, min: 0, max: 50, step: 0.5 },
  { key: "cheersMinPeople", group: "Cheers", label: "People needed", value: 4, min: 2, max: 30, step: 1 },
  { key: "cheersWindowMinutes", group: "Cheers", label: "Window, minutes", value: 5, min: 1, max: 60, step: 1 },

  { key: "hourWinnerPoints", group: "Hourly awards", label: "Hour Winner", value: 2, min: 0, max: 50, step: 0.5 },
  { key: "hourTopBacPoints", group: "Hourly awards", label: "Top BAC of the hour", value: 1, min: 0, max: 50, step: 0.5 },
  { key: "hourMinActive", group: "Hourly awards", label: "People who must log in the hour", value: 2, min: 1, max: 30, step: 1 },

  { key: "dayCutoffHour", group: "Daily awards", label: "Day ends at, hour (party time)", value: 4, min: 0, max: 11, step: 1 },
  { key: "smoothSailingPoints", group: "Daily awards", label: "Smooth Sailing", value: 15, min: 0, max: 200, step: 1 },
  { key: "bandLow", group: "Daily awards", label: "Smooth Sailing band from, %", value: 0.04, min: 0, max: 0.5, step: 0.01 },
  { key: "bandHigh", group: "Daily awards", label: "Smooth Sailing band to, %", value: 0.1, min: 0.01, max: 0.5, step: 0.01 },
  { key: "drunkestSailorPoints", group: "Daily awards", label: "Drunkest Sailor", value: 10, min: 0, max: 200, step: 1 },
  { key: "fastestClimbPoints", group: "Daily awards", label: "Fastest Climb", value: 8, min: 0, max: 200, step: 1 },
  { key: "hydroHomiePoints", group: "Daily awards", label: "Landlubber (Hydro Homie)", value: 5, min: 0, max: 200, step: 1 },
  { key: "lastManStandingPoints", group: "Daily awards", label: "Last Man Standing", value: 10, min: 0, max: 200, step: 1 },
  { key: "lastManAfterHour", group: "Daily awards", label: "Last Man Standing counts photos after, hour", value: 1, min: 0, max: 3, step: 1 },

  { key: "slotEveryDrinks", group: "Slot machine (odds must total 100)", label: "Spin on every Nth drink", value: 3, min: 1, max: 20, step: 1 },
  { key: "slotOdds1x", group: "Slot machine (odds must total 100)", label: "1×, %", value: 55, min: 0, max: 100, step: 1 },
  { key: "slotOdds2x", group: "Slot machine (odds must total 100)", label: "2×, %", value: 15, min: 0, max: 100, step: 1 },
  { key: "slotOdds3x", group: "Slot machine (odds must total 100)", label: "3×, %", value: 5, min: 0, max: 100, step: 1 },
  { key: "slotOddsBust", group: "Slot machine (odds must total 100)", label: "Bust, %", value: 12, min: 0, max: 100, step: 1 },
  { key: "slotOddsJackpot", group: "Slot machine (odds must total 100)", label: "Jackpot, %", value: 2, min: 0, max: 100, step: 1 },
  { key: "slotOddsRob", group: "Slot machine (odds must total 100)", label: "Rob the Leader, %", value: 6, min: 0, max: 100, step: 1 },
  { key: "slotOddsForward", group: "Slot machine (odds must total 100)", label: "Pay It Forward, %", value: 5, min: 0, max: 100, step: 1 },
  { key: "slotBustMultiplier", group: "Slot machine (odds must total 100)", label: "Bust, ×", value: 0.5, min: 0, max: 1, step: 0.1 },
  { key: "slotJackpotPoints", group: "Slot machine (odds must total 100)", label: "Jackpot points", value: 15, min: 0, max: 200, step: 1 },
  { key: "slotRobPoints", group: "Slot machine (odds must total 100)", label: "Rob the Leader takes", value: 5, min: 0, max: 100, step: 1 },
  { key: "slotReuseMinutes", group: "Slot machine (odds must total 100)", label: "Minutes a deleted drink's spin is reused", value: 10, min: 0, max: 120, step: 1 },

  { key: "activeHours", group: "Bartender's Choice", label: "Hours since last log to count as playing", value: 3, min: 1, max: 24, step: 1 },
  { key: "bartenderMultiplier", group: "Bartender's Choice", label: "Assigned drink, ×", value: 3, min: 1, max: 10, step: 0.5 },
  { key: "bartenderMinutes", group: "Bartender's Choice", label: "Minutes to log it", value: 60, min: 5, max: 480, step: 5 },

  { key: "groomWindowMinutes", group: "Groom Tax", label: "Minutes between the two drinks", value: 2, min: 1, max: 30, step: 1 },
  { key: "groomPhotoMinutes", group: "Groom Tax", label: "Minutes to post the photo", value: 10, min: 1, max: 120, step: 1 },
  { key: "groomMultiplier", group: "Groom Tax", label: "Player's drink, ×", value: 2, min: 1, max: 10, step: 0.5 },
  { key: "groomPoints", group: "Groom Tax", label: "Points for the groom", value: 1, min: 0, max: 50, step: 0.5 },

  { key: "curseNameCost", group: "Curses", label: "Name Hijack cost", value: 10, min: 0, max: 200, step: 1 },
  { key: "curseNameMinutes", group: "Curses", label: "Name Hijack lasts, minutes", value: 120, min: 5, max: 1440, step: 5 },
  { key: "curseDeadWeightCost", group: "Curses", label: "Dead Weight cost", value: 8, min: 0, max: 200, step: 1 },
  { key: "curseAvatarCost", group: "Curses", label: "Avatar Swap cost", value: 6, min: 0, max: 200, step: 1 },
  { key: "curseShieldCost", group: "Curses", label: "Shield cost", value: 5, min: 0, max: 200, step: 1 },

  { key: "wagerMaxStake", group: "Wagers", label: "Largest stake", value: 50, min: 1, max: 1000, step: 1 },
  { key: "wagerExpiryMinutes", group: "Wagers", label: "Minutes to answer a challenge", value: 60, min: 5, max: 1440, step: 5 },

  { key: "snitchVotes", group: "Snitch Line", label: "Upvotes needed", value: 2, min: 1, max: 20, step: 1 },
  { key: "snitchMinutes", group: "Snitch Line", label: "Minutes to get them", value: 30, min: 5, max: 480, step: 5 },
  { key: "snitchPenalty", group: "Snitch Line", label: "Points the accused loses", value: 5, min: 0, max: 100, step: 1 },
  { key: "snitchReward", group: "Snitch Line", label: "Points the reporter gains", value: 3, min: 0, max: 100, step: 1 },
] as const;

export const SLOT_ODDS_KEYS = [
  "slotOdds1x",
  "slotOdds2x",
  "slotOdds3x",
  "slotOddsBust",
  "slotOddsJackpot",
  "slotOddsRob",
  "slotOddsForward",
] as const;

export type SettingKey = (typeof settingDefs)[number]["key"];
export type PointsSettings = Record<SettingKey, number>;

export const defaultSettings = Object.fromEntries(
  settingDefs.map((def) => [def.key, def.value]),
) as PointsSettings;

/** Defaults with any valid stored overrides on top. Unknown keys and out-of-range values are ignored. */
export function mergeSettings(stored: unknown): PointsSettings {
  const settings = { ...defaultSettings };
  if (typeof stored !== "object" || stored === null) return settings;
  for (const def of settingDefs) {
    const value = (stored as Record<string, unknown>)[def.key];
    if (typeof value === "number" && Number.isFinite(value) && value >= def.min && value <= def.max) {
      settings[def.key] = value;
    }
  }
  return settings;
}

/** Validates an Admin edit. Returns only the values that differ from the defaults. */
export function parseSettings(
  body: unknown,
): { ok: true; value: Partial<PointsSettings> } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request body" };
  const overrides: Partial<PointsSettings> = {};
  for (const def of settingDefs) {
    const value = (body as Record<string, unknown>)[def.key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < def.min || value > def.max) {
      return { ok: false, error: `${def.label}: must be between ${def.min} and ${def.max}` };
    }
    if (value !== def.value) overrides[def.key] = value;
  }
  const merged = { ...defaultSettings, ...overrides };
  const odds = SLOT_ODDS_KEYS.reduce((sum, key) => sum + merged[key], 0);
  if (Math.abs(odds - 100) > 0.001) {
    return { ok: false, error: `The slot machine odds must total 100% (they total ${odds}%)` };
  }
  if (merged.bandLow >= merged.bandHigh) {
    return { ok: false, error: "The Smooth Sailing band must start below where it ends" };
  }
  return { ok: true, value: overrides };
}
