import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { isReaction } from "@/lib/reactions";
import { getStore } from "@/lib/store";

/** Sets one of the viewer's reactions on or off. Idempotent, so a double-tap can't remove one. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);

  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!isReaction(body?.emoji) || typeof body?.on !== "boolean") return jsonError("Unknown reaction", 400);

  const store = getStore();
  const post = await store.getPost((await params).id);
  if (!post) return jsonError("Post not found", 404);

  await store.setReaction({ postId: post.id, profileId: profile.id, emoji: body.emoji }, body.on);
  return Response.json({ ok: true });
}
