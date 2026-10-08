import { isAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { hashPassword, temporaryPassword } from "@/lib/password";
import { keys } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";

/**
 * Admin reset: gives the profile a temporary password, signs it out on every
 * device, and makes the person choose a new password at next login. The
 * temporary password is returned once, here, and stored only as a hash.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);

  const store = getStore();
  const password = temporaryPassword();
  const profile = await store.setPassword((await params).id, await hashPassword(password), {
    mustChange: true,
    signOutEverywhere: true,
  });
  if (!profile) return jsonError("Profile not found", 404);

  await store.clearAttempts(keys.loginName(profile.name));
  return Response.json({ name: profile.name, password });
}
