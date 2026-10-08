import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { readSigned, signValue } from "./signed";

/**
 * The invite-code gate. Everything except the gate itself sits behind this
 * cookie (enforced in src/proxy.ts). No dependencies on Next request APIs, so
 * the proxy and the route handler can both use it.
 */
export const GATE_COOKIE = "nbp_gate";
export const GATE_MAX_AGE_S = 90 * 24 * 60 * 60;

/** Codes are typed on phones: ignore case and stray spaces. */
export const normalizeCode = (code: string) => code.trim().toLowerCase();

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/**
 * The signing key includes the invite code, so changing INVITE_CODE makes every
 * existing gate cookie invalid. Null means the gate can't be passed at all.
 */
function gateKey(): string | null {
  const secret = env.sessionSecret;
  const code = env.inviteCode;
  return secret && code ? `${secret}:gate:${normalizeCode(code)}` : null;
}

export function checkInviteCode(candidate: string): boolean {
  const expected = env.inviteCode;
  if (!expected) return false;
  // Hashing first gives equal-length buffers for the constant-time compare.
  return timingSafeEqual(sha256(normalizeCode(candidate)), sha256(normalizeCode(expected)));
}

export function issueGateToken(now = Date.now()): string | null {
  const key = gateKey();
  return key ? signValue(String(now + GATE_MAX_AGE_S * 1000), key) : null;
}

export function isGateTokenValid(token: string | undefined | null, now = Date.now()): boolean {
  const key = gateKey();
  if (!key) return false;
  const expires = readSigned(token, key);
  return expires !== null && Number(expires) > now;
}
