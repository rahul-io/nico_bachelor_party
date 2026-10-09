import { isAdmin } from "@/lib/auth";
import { deleteCommentFiles } from "@/lib/feed";
import { getRequestProfile, jsonError } from "@/lib/http";
import { getStore } from "@/lib/store";

/** People can delete their own comments; admins can delete any. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = getStore();
  const comment = await store.getComment((await params).id);
  if (!comment) return jsonError("Comment not found", 404);

  const profile = await getRequestProfile(req);
  if (profile?.id !== comment.profileId && !(await isAdmin())) {
    return jsonError("That's not your comment", 403);
  }

  await store.deleteComment(comment.id);
  await deleteCommentFiles([comment]);
  return Response.json({ ok: true });
}
