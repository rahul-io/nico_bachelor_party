import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";

/**
 * Changes who is tagged in a photo. The poster can tag and untag anyone;
 * someone who is tagged can only take themselves off.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);

  const store = getStore();
  const post = await store.getPost((await params).id);
  if (!post) return jsonError("Post not found", 404);

  const body = (await readJson(req)) as { taggedIds?: unknown } | null;
  const known = new Set((await store.listProfiles()).map((item) => item.id));
  const wanted = [
    ...new Set(Array.isArray(body?.taggedIds) ? body.taggedIds.filter((id): id is string => typeof id === "string") : []),
  ].filter((id) => known.has(id));

  const current = post.taggedIds ?? [];
  if (post.profileId !== profile.id) {
    const withoutMe = current.filter((id) => id !== profile.id);
    const onlyRemovedSelf =
      current.includes(profile.id) && wanted.length === withoutMe.length && withoutMe.every((id) => wanted.includes(id));
    if (!onlyRemovedSelf) return jsonError("Only the poster can change the tags; you can remove your own.", 403);
  }
  const updated = await store.updatePost(post.id, { taggedIds: wanted });
  return Response.json({ taggedIds: updated?.taggedIds ?? [] });
}
