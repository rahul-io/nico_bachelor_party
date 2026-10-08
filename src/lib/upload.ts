import { upload } from "@vercel/blob/client";
import type { Identity } from "./identity";
import { parseCoordinates, type Coordinates } from "./location";
import type { MediaType } from "./store/types";

const MULTIPART_ABOVE_BYTES = 8 * 1024 * 1024;

async function drawScaled(file: File, maxSide: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

/**
 * The GPS position stored inside a photo, if it has one. Must be read from the
 * original file: shrinking the photo throws its metadata away. Phones often
 * strip this before a web page ever sees the file, so null is the common case.
 */
export async function readPhotoGps(file: File): Promise<Coordinates | null> {
  try {
    const { gps } = await import("exifr");
    const position = await gps(file);
    return position ? parseCoordinates({ lat: position.latitude, lng: position.longitude }) : null;
  } catch {
    return null;
  }
}

/**
 * Re-encodes a photo as a JPEG of at most `maxSide` px. This keeps phone
 * photos well under the size cap and, because it redraws the pixels, removes
 * every piece of metadata (including GPS) from what gets uploaded.
 *
 * Throws if the browser can't decode the file: uploading the untouched
 * original instead would publish whatever location is embedded in it.
 */
export async function shrinkPhoto(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  // Animated GIFs would lose their animation; they carry no camera metadata.
  if (file.type === "image/gif") return file;
  let blob: Blob | null = null;
  try {
    const canvas = await drawScaled(file, maxSide);
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  } catch {
    blob = null;
  }
  if (!blob) throw new Error("This browser couldn't process that photo. Try a JPEG or a screenshot of it.");
  return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" });
}

/** Mock mode: a small inline image instead of a real upload. */
export async function inlinePhoto(file: File): Promise<string> {
  return (await drawScaled(file, 1000)).toDataURL("image/jpeg", 0.7);
}

/** Uploads straight from the browser to Vercel Blob and returns the file's URL. */
export async function uploadMedia(
  file: File,
  kind: MediaType,
  identity: Identity,
  onProgress: (percentage: number) => void,
): Promise<string> {
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-60) || "upload";
  const blob = await upload(`posts/${identity.id}/${safeName}`, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    clientPayload: JSON.stringify({ ...identity, kind }),
    contentType: file.type || undefined,
    multipart: file.size > MULTIPART_ABOVE_BYTES,
    onUploadProgress: ({ percentage }) => onProgress(percentage),
  });
  return blob.url;
}
