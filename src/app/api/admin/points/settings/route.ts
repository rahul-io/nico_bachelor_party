import { isAdmin } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { saveSettings } from "@/lib/points/service";
import { parseSettings } from "@/lib/points/settings";

export async function PUT(req: Request) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  const input = parseSettings(await readJson(req));
  if (!input.ok) return jsonError(input.error, 400);
  return Response.json(await saveSettings(getStore(), input.value));
}

/** Back to the defaults. */
export async function DELETE() {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  return Response.json(await saveSettings(getStore(), {}));
}
