import { connection } from "next/server";
import { isAdmin } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { config } from "@/config";
import { categories } from "@/lib/drinks";
import { getDrinksOfDay, setDrinkOfDay } from "@/lib/points/service";

export async function GET() {
  await connection();
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  return Response.json(await getDrinksOfDay(getStore()));
}

/** Sets the pick for one day; an empty value clears it. */
export async function PUT(req: Request) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  const body = (await readJson(req)) as { day?: unknown; type?: unknown; value?: unknown } | null;
  const day = typeof body?.day === "string" ? body.day : "";
  if (!config.days.includes(day)) return jsonError("Pick one of the party days", 400);

  const value = typeof body?.value === "string" ? body.value.trim() : "";
  const store = getStore();
  if (!value) {
    await setDrinkOfDay(store, day, null);
  } else if (body?.type === "category") {
    if (!(categories as string[]).includes(value)) return jsonError("Unknown category", 400);
    await setDrinkOfDay(store, day, { type: "category", value });
  } else {
    if (value.length > 60) return jsonError("Drink name is too long", 400);
    await setDrinkOfDay(store, day, { type: "drink", value });
  }
  return Response.json(await getDrinksOfDay(store));
}
