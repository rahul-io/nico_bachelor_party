import { getRequestProfile, jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { parseProfileInput } from "@/lib/validate";

export async function GET(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);
  return Response.json(profile);
}

export async function PATCH(req: Request) {
  const profile = await getRequestProfile(req);
  if (!profile) return jsonError("Unknown profile", 401);

  const body = await readJson(req);
  const input = parseProfileInput(
    typeof body === "object" && body !== null ? { ...profile, ...body } : body,
  );
  if (!input.ok) return jsonError(input.error, 400);
  return Response.json(await getStore().updateProfile(profile.id, input.value));
}
