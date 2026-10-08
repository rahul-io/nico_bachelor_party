import { isAdmin } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { parsePointEventInput } from "@/lib/validate";

export async function POST(req: Request) {
  if (!(await isAdmin())) return jsonError("Not authorized", 401);

  const input = parsePointEventInput(await readJson(req));
  if (!input.ok) return jsonError(input.error, 400);

  const store = getStore();
  const [profiles, challenges] = await Promise.all([store.listProfiles(), store.listChallenges()]);
  if (!profiles.some((profile) => profile.id === input.value.profileId)) {
    return jsonError("That person no longer exists", 404);
  }
  const challenge = challenges.find((item) => item.id === input.value.challengeId) ?? null;

  // The challenge title is copied into the reason so history survives the challenge being deleted.
  const event = await store.addPointEvent({
    ...input.value,
    challengeId: challenge?.id ?? null,
    reason: input.value.reason ?? challenge?.title ?? null,
  });
  return Response.json(event, { status: 201 });
}
