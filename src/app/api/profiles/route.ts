import { jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { parseProfileInput } from "@/lib/validate";

export async function POST(req: Request) {
  const input = parseProfileInput(await readJson(req));
  if (!input.ok) return jsonError(input.error, 400);
  const created = await getStore().createProfile(input.value);
  return Response.json(created, { status: 201 });
}
