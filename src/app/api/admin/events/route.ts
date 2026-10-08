import { isAdmin } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { parseEventInput } from "@/lib/validate";

export async function POST(req: Request) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);

  const input = parseEventInput(await readJson(req));
  if (!input.ok) return jsonError(input.error, 400);
  return Response.json(await getStore().createEvent(input.value), { status: 201 });
}
