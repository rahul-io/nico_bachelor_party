import { isAdmin } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { getSettings, startHappyHour, stopHappyHour } from "@/lib/points/service";

export async function POST(req: Request) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  const body = (await readJson(req)) as { minutes?: unknown } | null;
  const store = getStore();
  const fallback = (await getSettings(store)).happyHourMinutes;
  const minutes = typeof body?.minutes === "number" ? body.minutes : fallback;
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 720) {
    return jsonError("Happy Hour must be between 1 and 720 minutes", 400);
  }
  return Response.json(await startHappyHour(store, minutes), { status: 201 });
}

export async function DELETE() {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  await stopHappyHour(getStore());
  return Response.json({ ok: true });
}
