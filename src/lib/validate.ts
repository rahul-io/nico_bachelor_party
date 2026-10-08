import { isAvatarDataUrl } from "./avatar";
import { alcoholGrams } from "./bac";
import type {
  ChallengeInput,
  DrinkInput,
  EventInput,
  PointEventInput,
  ProfileInput,
} from "./store/types";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): Result<never> => ({ ok: false, error });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

/** Trimmed string, or null when empty or not a string. */
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const isoDate = (value: unknown): string | null => {
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};

// Avatars arrive as small client-resized data URLs.
const MAX_AVATAR_CHARS = 150_000;

function parseAvatar(value: unknown): Result<string | null> {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value !== "string" || value.length > MAX_AVATAR_CHARS) {
    return fail("That photo didn't work. Try another one.");
  }
  // A data URL is a new upload. Any other string is the client echoing back
  // the stored URL, which applyAvatar treats as "unchanged".
  if (value.startsWith("data:") && !isAvatarDataUrl(value)) {
    return fail("That photo didn't work. Try a JPEG or PNG.");
  }
  return { ok: true, value };
}

export function parseProfileInput(body: unknown): Result<ProfileInput> {
  if (!isRecord(body)) return fail("Invalid request body");

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 30) return fail("Name must be 1–30 characters");
  if (!inRange(body.heightCm, 120, 230)) return fail("Height looks off");
  if (!inRange(body.weightKg, 35, 250)) return fail("Weight looks off");
  if (body.sex !== "male" && body.sex !== "female") return fail("Pick a sex");
  const avatar = parseAvatar(body.avatarUrl);
  if (!avatar.ok) return avatar;

  return {
    ok: true,
    value: {
      name,
      avatarUrl: avatar.value,
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

export function parseEventInput(body: unknown): Result<EventInput> {
  if (!isRecord(body)) return fail("Invalid request body");

  const title = text(body.title);
  if (!title || title.length > 80) return fail("Event needs a title (max 80 characters)");
  const startsAt = isoDate(body.startsAt);
  if (!startsAt) return fail("Event needs a start time");
  const endsAt = body.endsAt == null || body.endsAt === "" ? null : isoDate(body.endsAt);
  if (body.endsAt && !endsAt) return fail("End time is invalid");
  if (endsAt && endsAt <= startsAt) return fail("End time must be after the start");

  const location = text(body.location);
  const mapsQuery = text(body.mapsQuery);
  const notes = text(body.notes);
  if ((location?.length ?? 0) > 120 || (mapsQuery?.length ?? 0) > 200) return fail("Location is too long");
  if ((notes?.length ?? 0) > 500) return fail("Notes are too long (max 500 characters)");

  return { ok: true, value: { title, startsAt, endsAt, location, mapsQuery, notes } };
}

export function parseChallengeInput(body: unknown): Result<ChallengeInput> {
  if (!isRecord(body)) return fail("Invalid request body");

  const title = text(body.title);
  if (!title || title.length > 80) return fail("Challenge needs a title (max 80 characters)");
  const description = text(body.description) ?? "";
  if (description.length > 300) return fail("Description is too long (max 300 characters)");
  if (!Number.isInteger(body.points) || !inRange(body.points, 1, 1000)) {
    return fail("Points must be a whole number from 1 to 1000");
  }

  return { ok: true, value: { title, description, points: body.points, active: body.active !== false } };
}

export function parsePointEventInput(body: unknown): Result<PointEventInput> {
  if (!isRecord(body)) return fail("Invalid request body");

  if (typeof body.profileId !== "string" || !body.profileId) return fail("Pick a person");
  if (!Number.isInteger(body.delta) || body.delta === 0 || !inRange(body.delta, -1000, 1000)) {
    return fail("Points must be a whole number, not zero, at most 1000");
  }
  const reason = text(body.reason);
  if ((reason?.length ?? 0) > 140) return fail("Reason is too long (max 140 characters)");

  return {
    ok: true,
    value: {
      profileId: body.profileId,
      delta: body.delta,
      reason,
      challengeId: typeof body.challengeId === "string" && body.challengeId ? body.challengeId : null,
    },
  };
}
