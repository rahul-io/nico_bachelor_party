import { isAdmin } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { parseEventInput } from "@/lib/validate";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);

  const input = parseEventInput(await readJson(req));
  if (!input.ok) return jsonError(input.error, 400);
  const updated = await getStore().updateEvent((await params).id, input.value);
  if (!updated) return jsonError("Event not found", 404);
  return Response.json(updated);
}

export async function DELETE(_req: Request, { params }: Context) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);

  const deleted = await getStore().deleteEvent((await params).id);
  if (!deleted) return jsonError("Event not found", 404);
  return Response.json({ ok: true });
}
