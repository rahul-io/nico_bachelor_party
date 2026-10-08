import { jsonError, readJson } from "@/lib/http";
import { hashPassword, passwordProblem } from "@/lib/password";
import { startSession } from "@/lib/session";
import { getStore } from "@/lib/store";

/**
 * Turns a profile from before accounts existed into an account. The device
 * proves it owns the profile with the id + token it was given back then, sets
 * a password, and is signed in. The token stops working once this succeeds.
 */
export async function POST(req: Request) {
  const body = (await readJson(req)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const token = typeof body?.token === "string" ? body.token : "";

  const store = getStore();
  const profile = id && token ? await store.getProfileByToken(id, token) : null;
  if (!profile || profile.hasPassword) return jsonError("That profile can't be claimed from this device", 401);

  const problem = passwordProblem(body?.password);
  if (problem) return jsonError(problem, 400);

  // Someone else may have taken the name as an account in the meantime.
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 30) : profile.name;
  if (await store.isNameTaken(name, profile.id)) {
    return jsonError("Someone already uses that name. Pick another.", 409, { code: "name_taken" });
  }
  if (name !== profile.name) await store.updateProfile(profile.id, { ...profile, name });

  const account = await store.setPassword(profile.id, await hashPassword(body?.password as string), {
    mustChange: false,
    signOutEverywhere: false,
  });
  if (!account) return jsonError("Profile not found", 404);
  await startSession(account);
  return Response.json({ profile: account });
}
