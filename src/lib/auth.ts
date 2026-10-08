import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";

const COOKIE = "nbp_admin";
const MAX_AGE_S = 7 * 24 * 60 * 60;

const sha256 = (value: string) => createHash("sha256").update(value).digest();

function sign(expires: string, key: string): Buffer {
  return createHmac("sha256", key).update(expires).digest();
}

export function checkAdminPassword(candidate: string): boolean {
  const expected = env.adminPassword;
  if (!expected) return false;
  // Hashing first gives equal-length buffers for the constant-time compare.
  return timingSafeEqual(sha256(candidate), sha256(expected));
}

export async function startAdminSession(): Promise<void> {
  const key = env.sessionKey;
  if (!key) return;
  const expires = String(Date.now() + MAX_AGE_S * 1000);
  (await cookies()).set(COOKIE, `${expires}.${sign(expires, key).toString("hex")}`, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Whether the request carries a valid, unexpired admin cookie. */
export async function isAdmin(): Promise<boolean> {
  const key = env.sessionKey;
  const [expires, signature] = (await cookies()).get(COOKIE)?.value.split(".") ?? [];
  if (!key || !expires || !signature) return false;
  if (!(Number(expires) > Date.now())) return false;

  const expected = sign(expires, key);
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
