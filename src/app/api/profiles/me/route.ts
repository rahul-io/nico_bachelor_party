import { applyAvatar } from "@/lib/avatar";
import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { parseProfileInput } from "@/lib/validate";

export async function PATCH(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Sign in first", 401);

  const body = await readJson(req);
  const input = parseProfileInput(
    typeof body === "object" && body !== null ? { ...profile, ...body } : body,
  );
  if (!input.ok) return jsonError(input.error, 400);

  const store = getStore();
  if (await store.isNameTaken(input.value.name, profile.id)) return jsonError("That name is taken", 409);

  const avatarUrl = await applyAvatar(store, profile.id, input.value.avatarUrl, profile.avatarUrl);
  return Response.json({ profile: await store.updateProfile(profile.id, { ...input.value, avatarUrl }) });
}
