import { getRequestProfile, jsonError } from "@/lib/http";
import { withWaterPoints } from "@/lib/points/log";
import { logWater } from "@/lib/points/service";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);
  const store = getStore();
  const [waters, events] = await Promise.all([store.listWaters(profile.id), store.listPointEvents(profile.id)]);
  return Response.json(withWaterPoints(waters, events));
}

export async function POST(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);
  const { water, entry } = await logWater(getStore(), profile);
  return Response.json({ ...water, points: entry?.delta ?? null }, { status: 201 });
}
