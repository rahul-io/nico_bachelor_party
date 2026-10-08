import { getRequestProfile, jsonError } from "@/lib/http";
import { removeWater } from "@/lib/points/service";
import { getStore } from "@/lib/store";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);

  const { id } = await params;
  const deleted = await removeWater(getStore(), profile.id, id);
  if (!deleted) return jsonError("Water not found", 404);
  return Response.json({ ok: true });
}
