import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { startSession } from "@/lib/session";
import { getStore } from "@/lib/store";

/**
 * Changes the signed-in person's password. Other devices are signed out; this
 * one gets a fresh session. After an admin reset, the temporary password that
 * was just used to log in stands in for the "current password" check.
 */
export async function POST(req: Request) {
  const profile = await getRequestProfile(req, { allowPasswordChangePending: true });
  if (!profile) return jsonError("Sign in first", 401);

  const body = (await readJson(req)) as Record<string, unknown> | null;
  const problem = passwordProblem(body?.next);
  if (problem) return jsonError(problem, 400);

  const store = getStore();
  if (!profile.mustChangePassword) {
    const account = await store.findAccountByName(profile.name);
    const current = typeof body?.current === "string" ? body.current : "";
    if (account?.profile.id !== profile.id || !(await verifyPassword(current, account.passwordHash))) {
      return jsonError("Current password is wrong", 401);
    }
  }

  const updated = await store.setPassword(profile.id, await hashPassword(body?.next as string), {
    mustChange: false,
    signOutEverywhere: true,
  });
  if (!updated) return jsonError("Profile not found", 404);
  await startSession(updated);
  return Response.json({ profile: updated });
}
