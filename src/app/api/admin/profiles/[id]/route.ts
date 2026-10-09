import { isAdmin } from "@/lib/auth";
import { deleteCommentFiles, deletePostFiles } from "@/lib/feed";
import { jsonError } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);

  const { id } = await params;
  const store = getStore();
  // The posts go with the profile, so their files have to go first.
  const posts = (await store.listPosts()).filter((post) => post.profileId === id);
  const postIds = new Set(posts.map((post) => post.id));
  await deletePostFiles(posts);
  await deleteCommentFiles((await store.listAllComments()).filter((comment) => comment.profileId === id || postIds.has(comment.postId)));
  const deleted = await store.deleteProfile(id);
  if (!deleted) return jsonError("Profile not found", 404);
  return Response.json({ ok: true });
}
