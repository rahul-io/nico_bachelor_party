import { alcoholGrams } from "./bac";
import type { DrinkInput, ProfileInput } from "./store/types";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): Result<never> => ({ ok: false, error });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export function parseProfileInput(body: unknown): Result<ProfileInput> {
  if (!isRecord(body)) return fail("Invalid request body");

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 30) return fail("Name must be 1–30 characters");
  if (!inRange(body.heightCm, 120, 230)) return fail("Height looks off");
  if (!inRange(body.weightKg, 35, 250)) return fail("Weight looks off");
  if (body.sex !== "male" && body.sex !== "female") return fail("Pick a sex");

  return {
    ok: true,
    value: {
      name,
      heightCm: body.heightCm,
      weightKg: body.weightKg,
      sex: body.sex,
      showBacOnPosts: body.showBacOnPosts !== false,
    },
  };
}

/** Accepts volume + ABV (grams are computed) or a bare alcohol mass. */
export function parseDrinkInput(body: unknown): Result<DrinkInput> {
  if (!isRecord(body)) return fail("Invalid request body");

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 60) return fail("Drink needs a name");

  if (body.volumeOz != null || body.abv != null) {
    if (!inRange(body.volumeOz, 0.1, 128)) return fail("Volume must be between 0.1 and 128 oz");
    if (!inRange(body.abv, 0.001, 1)) return fail("ABV must be between 0.1% and 100%");
    return {
      ok: true,
      value: {
        name,
        volumeOz: body.volumeOz,
        abv: body.abv,
        alcoholG: alcoholGrams(body.volumeOz, body.abv),
      },
    };
  }

  if (!inRange(body.alcoholG, 0.1, 500)) return fail("Drink needs a volume and ABV");
  return { ok: true, value: { name, volumeOz: null, abv: null, alcoholG: body.alcoholG } };
}
