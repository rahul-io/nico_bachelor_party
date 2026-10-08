import { decodeAvatar } from "@/lib/avatar";
import { jsonError } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const data = await getStore().getAvatarData((await params).id);
  const avatar = data ? decodeAvatar(data) : null;
  if (!avatar) return jsonError("No avatar", 404);

  // The URL carries a content hash (?v=), so the image can be cached forever.
  return new Response(new Uint8Array(avatar.bytes), {
    headers: {
      "content-type": avatar.type,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
