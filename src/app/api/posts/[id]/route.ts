import { isAdmin } from "@/lib/auth";
import { deletePostFiles } from "@/lib/feed";
import { getRequestProfile, jsonError } from "@/lib/http";
import { getStore } from "@/lib/store";

/** Posters can delete their own posts; admins can delete any. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
