import { applyAvatar } from "@/lib/avatar";
import { jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { parseProfileInput } from "@/lib/validate";

export async function POST(req: Request) {
  const input = parseProfileInput(await readJson(req));
  if (!input.ok) return jsonError(input.error, 400);

  const store = getStore();
  const created = await store.createProfile({ ...input.value, avatarUrl: null });
  const avatarUrl = await applyAvatar(store, created.profile.id, input.value.avatarUrl, null);
  if (avatarUrl) {
    created.profile = await store.updateProfile(created.profile.id, { ...input.value, avatarUrl });
  }
  return Response.json(created, { status: 201 });
}
