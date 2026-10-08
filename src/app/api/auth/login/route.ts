import { jsonError, readJson } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { TOO_MANY, clientIp, isLocked, keys, limits } from "@/lib/rate-limit";
import { startSession } from "@/lib/session";
import { getStore } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await readJson(req)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!name || !password) return jsonError("Enter your name and password", 400);

  const store = getStore();
  const nameKey = keys.loginName(name);
  const ipKey = keys.loginIp(clientIp(req));
  if ((await isLocked(store, nameKey, limits.loginPerName)) || (await isLocked(store, ipKey, limits.loginPerIp))) {
    return jsonError(TOO_MANY, 429);
  }

  const account = await store.findAccountByName(name);
  // Always runs a hash comparison, so an unknown name is indistinguishable from a wrong password.
  if (!(await verifyPassword(password, account?.passwordHash ?? null)) || !account) {
    await Promise.all([store.recordAttempt(nameKey), store.recordAttempt(ipKey)]);
    return jsonError("Wrong name or password", 401);
  }

  await store.clearAttempts(nameKey);
  await startSession(account.profile);
  return Response.json({ profile: account.profile });
}
