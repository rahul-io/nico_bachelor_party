import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { GATE_COOKIE, GATE_MAX_AGE_S, checkInviteCode, issueGateToken } from "@/lib/gate";
import { jsonError, readJson } from "@/lib/http";
import { TOO_MANY, clientIp, isLocked, keys, limits } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";

/** Tells the gate screen whether a code can work at all, and whether to show the dev hint. */
export async function GET() {
  return Response.json({ configured: env.inviteCode !== null, devCode: env.usingDevInviteCode });
}

/** Checks the invite code and, if right, sets the long-lived gate cookie. */
export async function POST(req: Request) {
  const store = getStore();
  const ipKey = keys.gateIp(clientIp(req));
  if (await isLocked(store, ipKey, limits.gatePerIp)) return jsonError(TOO_MANY, 429);

  const body = (await readJson(req)) as Record<string, unknown> | null;
  const code = typeof body?.code === "string" ? body.code : "";
  const token = checkInviteCode(code) ? issueGateToken() : null;
  if (!token) {
    await store.recordAttempt(ipKey);
    return jsonError("That's not the code.", 401);
  }

  (await cookies()).set(GATE_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: GATE_MAX_AGE_S,
  });
  return Response.json({ ok: true });
}
