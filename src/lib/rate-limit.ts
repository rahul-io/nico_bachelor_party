import type { Store } from "./store/types";

/** Failed attempts are counted over this window; a locked key frees itself as old failures age out. */
export const WINDOW_MS = 5 * 60 * 1000;

export const limits = {
  /** Wrong invite codes from one IP. Loose, because a whole house shares one Wi-Fi address. */
  gatePerIp: 20,
  /** Wrong passwords for one name before it is locked for the window. */
  loginPerName: 10,
  /** Wrong passwords from one IP, whatever the names. */
  loginPerIp: 30,
};

export const keys = {
  gateIp: (ip: string) => `gate:ip:${ip}`,
  loginName: (name: string) => `login:name:${name.trim().toLowerCase()}`,
  loginIp: (ip: string) => `login:ip:${ip}`,
};

/**
 * Counted in the store, not in memory: serverless instances don't share memory,
 * so an in-process counter would reset on every cold start.
 */
export async function isLocked(store: Store, key: string, max: number, now = Date.now()): Promise<boolean> {
  return (await store.countAttempts(key, now - WINDOW_MS)) >= max;
}

/** The caller's address as Vercel reports it; one shared bucket when there is none (local dev). */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export const TOO_MANY = "Too many tries. Give it five minutes.";
