import { upload } from "@vercel/blob/client";
import type { Identity } from "./identity";
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
 * Shrinks a photo to at most `maxSide` px as a JPEG, which keeps phone photos
 * well under the size cap. Falls back to the original if the browser can't decode it.
 */
export async function shrinkPhoto(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  if (file.type === "image/gif") return file;
  try {
    const canvas = await drawScaled(file, maxSide);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
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
