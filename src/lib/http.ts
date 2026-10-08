import { getStore } from "./store";
import type { Profile } from "./store/types";

export function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** The profile identified by the request's identity headers, or null. */
export async function getRequestProfile(req: Request): Promise<Profile | null> {
  const id = req.headers.get("x-profile-id");
  const token = req.headers.get("x-profile-token");
  if (!id || !token) return null;
  return getStore().getProfileByToken(id, token);
}
