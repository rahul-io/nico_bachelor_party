import { isAdmin } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { parseChallengeInput } from "@/lib/validate";

/** All challenges, including inactive ones. */
export async function GET() {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);
  return Response.json(await getStore().listChallenges());
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);

  const input = parseChallengeInput(await readJson(req));
  if (!input.ok) return jsonError(input.error, 400);
  return Response.json(await getStore().createChallenge(input.value), { status: 201 });
}
