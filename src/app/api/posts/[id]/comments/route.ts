import { bacSnapshot } from "@/lib/feed";
import { commentPhotoError } from "@/lib/comment-photo";
import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { MAX_COMMENT } from "@/lib/reactions";
import { getStore } from "@/lib/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);

  const body = (await readJson(req)) as Record<string, unknown> | null;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (body?.photoUrl != null && typeof body.photoUrl !== "string") return jsonError("Invalid photo", 400);
  const photoUrl = typeof body?.photoUrl === "string" ? body.photoUrl : null;
  if (!text && !photoUrl) return jsonError("Write something or add a photo first", 400);
  if (text.length > MAX_COMMENT) return jsonError(`Comments are limited to ${MAX_COMMENT} characters`, 400);

  const store = getStore();
  const post = await store.getPost((await params).id);
  if (!post) return jsonError("Post not found", 404);

  if (photoUrl) {
    const error = await commentPhotoError(photoUrl, profile.id);
    if (error) return jsonError(error, 400);
  }

  const comment = await store.addComment({
    postId: post.id,
    profileId: profile.id,
    body: text,
    photoUrl: photoUrl || null,
    bacAtComment: await bacSnapshot(store, profile),
  });
  return Response.json(comment, { status: 201 });
}
