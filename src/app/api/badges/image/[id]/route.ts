import { getBadgeImage } from "@/lib/badges/service";
import { jsonError } from "@/lib/http";
import { getStore } from "@/lib/store";

/** An uploaded badge image. Each upload gets a new id, so it can be cached for good. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const dataUrl = await getBadgeImage(getStore(), (await params).id);
  const match = dataUrl ? /^data:(image\/[a-z]+);base64,(.+)$/.exec(dataUrl) : null;
  if (!match) return jsonError("No image", 404);
  return new Response(new Uint8Array(Buffer.from(match[2], "base64")), {
    headers: { "content-type": match[1], "cache-control": "public, max-age=31536000, immutable" },
  });
}
