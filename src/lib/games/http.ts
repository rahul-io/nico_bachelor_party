import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import type { Profile, Store } from "@/lib/store/types";
import { GameError } from "./common";

type Body = Record<string, unknown>;

/**
 * A signed-in player's game action: resolves the profile, reads the JSON body,
 * and turns a GameError into its message with the right status.
 */
export async function playerAction(
  req: Request,
  action: (store: Store, profile: Profile, body: Body) => Promise<unknown>,
): Promise<Response> {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);
  const body = ((await readJson(req)) ?? {}) as Body;
  try {
    return Response.json((await action(getStore(), profile, body)) ?? { ok: true });
  } catch (error) {
    if (error instanceof GameError) return jsonError(error.message, error.status);
    throw error;
  }
}
