import { buildMe, markNoticesSeen } from "@/lib/games/board";
import { getRequestProfile, jsonError } from "@/lib/http";
import { getStore } from "@/lib/store";

/** This person's balance, notices, Bartender's Choice order and curses. */
export async function GET(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);
  return Response.json(await buildMe(getStore(), profile));
}

/** Marks this person's notices as read. */
export async function POST(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);
  await markNoticesSeen(getStore(), profile.id);
  return Response.json({ ok: true });
}
