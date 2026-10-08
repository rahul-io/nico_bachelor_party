import { getSessionProfile } from "./session";
import type { Profile } from "./store/types";

export function jsonError(error: string, status: number, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error, ...extra }, { status });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * The signed-in profile for this request, from the session cookie. Nothing the
 * client sends (ids in headers or bodies) is ever trusted for identity.
 *
 * Someone whose password was reset by an admin counts as signed out until they
 * choose a new one; only the password route passes `allowPasswordChangePending`.
 */
export async function getRequestProfile(
  _req?: Request,
  options: { allowPasswordChangePending?: boolean } = {},
): Promise<Profile | null> {
  const profile = await getSessionProfile();
  if (!profile) return null;
  if (profile.mustChangePassword && !options.allowPasswordChangePending) return null;
  return profile;
}
