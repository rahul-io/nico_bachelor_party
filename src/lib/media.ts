import { config } from "@/config";
import type { MediaType } from "./store/types";

/** What may be posted to the feed. Enforced by the upload token and re-checked when the post is saved. */
export const mediaRules: Record<MediaType, { contentTypes: string[]; maxBytes: number }> = {
  image: {
    contentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"],
    maxBytes: config.upload.maxImageBytes,
  },
  video: {
    contentTypes: ["video/mp4", "video/quicktime", "video/webm"],
    maxBytes: config.upload.maxVideoBytes,
  },
};

export function mediaTypeOf(contentType: string): MediaType | null {
  const base = contentType.split(";")[0].trim().toLowerCase();
  if (mediaRules.image.contentTypes.includes(base)) return "image";
  if (mediaRules.video.contentTypes.includes(base)) return "video";
  return null;
}

export const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

export const MAX_CAPTION = 280;

/** Mock mode only: posts are small inline images instead of Blob uploads. */
export const MOCK_IMAGE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
export const MOCK_IMAGE_MAX_CHARS = 700_000;
