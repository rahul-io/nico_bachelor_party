import { upload } from "@vercel/blob/client";
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
 * The GPS position stored inside a photo, if it has one, for placing it on the
 * photo map. Phones often strip this before a web page ever sees the file, so
 * null is the common case.
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
 * Makes a lightweight feed preview. The original file is uploaded separately,
 * untouched. Skip animated GIFs and formats the browser can't decode.
 */
export async function createPhotoPreview(file: File, maxSide = 1600, quality = 0.8): Promise<File | null> {
  if (file.type === "image/gif") return null;
  try {
    const canvas = await drawScaled(file, maxSide);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return null;
    return new File([blob], "preview-" + file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

/** Mock mode: a small inline image instead of a real upload. */
export async function inlinePhoto(file: File): Promise<string> {
  return (await drawScaled(file, 1000)).toDataURL("image/jpeg", 0.7);
}

/** Uploads straight from the browser to Vercel Blob and returns the file's URL. */
export async function uploadMedia(
  file: File,
  kind: MediaType,
  identity: { id: string },
  onProgress: (percentage: number) => void,
): Promise<string> {
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-60) || "upload";
  const blob = await upload(`posts/${identity.id}/${safeName}`, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    // Who is uploading comes from the session cookie; the server only needs the kind.
    clientPayload: JSON.stringify({ kind }),
    contentType: file.type || undefined,
    multipart: file.size > MULTIPART_ABOVE_BYTES,
    onUploadProgress: ({ percentage }) => onProgress(percentage),
  });
  return blob.url;
}

/** Store original bytes for export and a separate, optional image for the feed. */
export async function uploadPostMedia(
  file: File,
  kind: MediaType,
  identity: { id: string },
  onProgress: (percentage: number) => void,
): Promise<{ url: string; previewUrl: string | null }> {
  const preview = kind === "image" ? await createPhotoPreview(file) : null;
  const totalBytes = file.size + (preview?.size ?? 0);
  const url = await uploadMedia(file, kind, identity, (percentage) => {
    onProgress(totalBytes ? (percentage * file.size) / totalBytes : percentage);
  });
  let previewUrl: string | null = null;
  if (preview) {
    previewUrl = await uploadMedia(preview, "image", identity, (percentage) => {
      onProgress((100 * file.size + percentage * preview.size) / totalBytes);
    });
  }
  return { url, previewUrl };
}
