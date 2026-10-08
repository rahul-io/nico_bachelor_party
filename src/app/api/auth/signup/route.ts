import { applyAvatar } from "@/lib/avatar";
import { jsonError, readJson } from "@/lib/http";
import { hashPassword, passwordProblem } from "@/lib/password";
import { startSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { parseProfileInput } from "@/lib/validate";

/** Creates an account (name + password + the profile fields) and signs this device in. */
export async function POST(req: Request) {
  const body = (await readJson(req)) as Record<string, unknown> | null;
  const input = parseProfileInput(body);
  if (!input.ok) return jsonError(input.error, 400);
  const problem = passwordProblem(body?.password);
  if (problem) return jsonError(problem, 400);

  const store = getStore();
  if (await store.isNameTaken(input.value.name)) {
    return jsonError("That name is taken. Pick another, or log in if it's yours.", 409);
  }

  const created = await store.createProfile(
    { ...input.value, avatarUrl: null },
    await hashPassword(body?.password as string),
  );
  let profile = created.profile;
  const avatarUrl = await applyAvatar(store, profile.id, input.value.avatarUrl, null);
  if (avatarUrl) profile = await store.updateProfile(profile.id, { ...input.value, avatarUrl });

  await startSession(profile);
  return Response.json({ profile }, { status: 201 });
}
