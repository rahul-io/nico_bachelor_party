import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { parseDrinkInput } from "@/lib/validate";

export async function GET(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);
  return Response.json(await getStore().listDrinks(profile.id));
}

export async function POST(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);

  const input = parseDrinkInput(await readJson(req));
  if (!input.ok) return jsonError(input.error, 400);
  const drink = await getStore().addDrink(profile.id, input.value);
  return Response.json(drink, { status: 201 });
}
