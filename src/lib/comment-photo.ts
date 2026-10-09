import { head } from "@vercel/blob";
import { env } from "./env";
import { isBlobUrl } from "./feed";
import { mediaRules, mediaTypeOf, MOCK_IMAGE, MOCK_IMAGE_MAX_CHARS } from "./media";

/** Re-check ownership, type and size before attaching an uploaded photo. */
export async function commentPhotoError(url: string, profileId: string): Promise<string | null> {
  const token = env.blobToken;
  if (!token) {
    return url.length <= MOCK_IMAGE_MAX_CHARS && MOCK_IMAGE.test(url)
      ? null
      : "Demo mode only takes small photos";
  }
  if (!isBlobUrl(url) || !new URL(url).pathname.startsWith(`/comments/${profileId}/`)) {
    return "That photo didn't come from this app";
  }
  try {
    const blob = await head(url, { token });
    if (mediaTypeOf(blob.contentType) !== "image") return "Comments only take photos";
    if (blob.size > mediaRules.image.maxBytes) return "That photo is too large";
    return null;
  } catch {
    return "Couldn't find that photo. Try again.";
  }
}
