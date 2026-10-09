import { markPopSeen } from "@/lib/badges/service";
import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";

/** Marks one of this person's badge announcements as shown. */
export async function POST(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);
  const body = (await readJson(req)) as { awardId?: unknown } | null;
  if (typeof body?.awardId !== "string") return jsonError("Invalid request body", 400);
  await markPopSeen(getStore(), profile.id, body.awardId);
  return Response.json({ ok: true });
}
