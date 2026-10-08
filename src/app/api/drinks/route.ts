import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { withDrinkPoints } from "@/lib/points/log";
import { logDrink } from "@/lib/points/service";
import { getStore } from "@/lib/store";
import { parseDrinkInput } from "@/lib/validate";

export async function GET(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);
  const store = getStore();
  const [drinks, events] = await Promise.all([store.listDrinks(profile.id), store.listPointEvents(profile.id)]);
  return Response.json(withDrinkPoints(drinks, events));
}

export async function POST(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);

  const input = parseDrinkInput(await readJson(req));
  if (!input.ok) return jsonError(input.error, 400);
  const store = getStore();
  const { drink } = await logDrink(store, profile, input.value);
  // Read back so a Cheers this drink completed is included.
  const [logged] = withDrinkPoints([drink], await store.listPointEvents(profile.id));
  return Response.json(logged, { status: 201 });
}
