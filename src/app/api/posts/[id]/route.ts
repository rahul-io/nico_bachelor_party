import { isAdmin } from "@/lib/auth";
import { buildPostDetail, deletePostFiles } from "@/lib/feed";
import { getRequestProfile, jsonError } from "@/lib/http";
import { getStore } from "@/lib/store";

type Context = { params: Promise<{ id: string }> };

/** The opened-photo view: the post, who reacted, and the comment thread. */
export async function GET(req: Request, { params }: Context) {
  const detail = await buildPostDetail(getStore(), (await params).id, req.headers.get("x-profile-id"));
  if (!detail) return jsonError("Post not found", 404);
  return Response.json(detail);
}

/** Posters can delete their own posts; admins can delete any. */
export async function DELETE(req: Request, { params }: Context) {
  const store = getStore();
  const post = await store.getPost((await params).id);
  if (!post) return jsonError("Post not found", 404);

  const profile = await getRequestProfile(req);
  if (profile?.id !== post.profileId && !(await isAdmin())) {
    return jsonError("That's not your post", 403);
  }

  await deletePostFiles([post]);
  await store.deletePost(post.id);
  return Response.json({ ok: true });
}
