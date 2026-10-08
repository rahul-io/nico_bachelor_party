import { createHash } from "node:crypto";
import type { Store } from "./store/types";

// Raster types only: an SVG served from our own origin could run script.
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/;

export const isAvatarDataUrl = (value: string) => DATA_URL.test(value);

export function decodeAvatar(dataUrl: string): { type: string; bytes: Buffer } | null {
  const match = DATA_URL.exec(dataUrl);
  return match ? { type: match[1], bytes: Buffer.from(match[2], "base64") } : null;
}

/**
 * Stores a newly uploaded avatar and returns the short URL to keep on the
 * profile. Lists of people then carry a cacheable URL instead of the image.
 * Anything that isn't a fresh upload or a removal leaves the avatar as it was.
 */
export async function applyAvatar(
  store: Store,
  profileId: string,
  submitted: string | null,
  current: string | null,
): Promise<string | null> {
  if (submitted === null) {
    if (current) await store.setAvatarData(profileId, null);
    return null;
  }
  if (!isAvatarDataUrl(submitted)) return current;

  await store.setAvatarData(profileId, submitted);
  const version = createHash("sha1").update(submitted).digest("hex").slice(0, 10);
  return `/api/avatars/${profileId}?v=${version}`;
}
