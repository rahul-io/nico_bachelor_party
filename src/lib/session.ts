import { cookies } from "next/headers";
import { env } from "./env";
import { readSigned, signValue } from "./signed";
import { getStore } from "./store";
import type { Profile } from "./store/types";

export const SESSION_COOKIE = "nbp_session";
const MAX_AGE_S = 30 * 24 * 60 * 60;
/** A session older than this gets a fresh 30 days the next time the app is opened. */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

interface SessionClaims {
  profileId: string;
  /** Must match the profile's current session_version; bumping that logs every device out. */
  version: number;
  issuedAt: number;
}

const sessionKey = () => (env.sessionSecret ? `${env.sessionSecret}:session` : null);

export function issueSessionToken(profile: Pick<Profile, "id" | "sessionVersion">, now = Date.now()): string | null {
  const key = sessionKey();
  return key ? signValue(`${profile.id}:${profile.sessionVersion}:${now}`, key) : null;
}

export function readSessionToken(token: string | undefined | null, now = Date.now()): SessionClaims | null {
  const key = sessionKey();
  const value = key ? readSigned(token, key) : null;
  if (!value) return null;

  const [profileId, version, issuedAt] = value.split(":");
  const claims = { profileId, version: Number(version), issuedAt: Number(issuedAt) };
  if (!profileId || !Number.isInteger(claims.version) || !Number.isFinite(claims.issuedAt)) return null;
  return claims.issuedAt + MAX_AGE_S * 1000 > now ? claims : null;
}

/** Signs this device in as `profile`. Sessions are stateless: nothing is stored server-side. */
export async function startSession(profile: Pick<Profile, "id" | "sessionVersion">): Promise<void> {
  const token = issueSessionToken(profile);
  if (!token) return;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

/** Signs this device out. Other devices are untouched. */
export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * The signed-in profile, or null. With `refresh`, an ageing cookie is re-issued
 * so regular visitors never hit the 30-day limit.
 */
export async function getSessionProfile(options: { refresh?: boolean } = {}): Promise<Profile | null> {
  const claims = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  const profile = await getStore().getProfile(claims.profileId);
  if (!profile || profile.sessionVersion !== claims.version) return null;

  if (options.refresh && Date.now() - claims.issuedAt > REFRESH_AFTER_MS) await startSession(profile);
  return profile;
}
