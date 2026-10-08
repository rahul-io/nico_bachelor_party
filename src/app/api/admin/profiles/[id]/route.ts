import { isAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);

  const deleted = await getStore().deleteProfile((await params).id);
  if (!deleted) return jsonError("Profile not found", 404);
  return Response.json({ ok: true });
}
