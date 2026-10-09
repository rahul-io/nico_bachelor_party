/**
 * Center-crops an image file to a square and returns it as a small data URL:
 * JPEG by default, or WebP (PNG where the browser can't write WebP) to keep
 * a transparent background.
 */
export async function squareThumbnail(
  file: File,
  size = 192,
  quality = 0.8,
  type: "image/jpeg" | "image/webp" = "image/jpeg",
): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
    return canvas.toDataURL(type, quality);
  } finally {
    bitmap.close();
  }
}
