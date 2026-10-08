import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import { GATE_COOKIE, GATE_MAX_AGE_S, checkInviteCode, isGateTokenValid, issueGateToken } from "./gate";
import { hashPassword, passwordProblem, temporaryPassword, verifyPassword } from "./password";
import { WINDOW_MS, clientIp, isLocked, keys, limits } from "./rate-limit";
import { issueSessionToken, readSessionToken } from "./session";
import { readSigned, signValue } from "./signed";
import { mockStore } from "./store/mock";

const saved = { ...process.env };

beforeEach(() => {
  process.env.INVITE_CODE = "CriderCrew";
  process.env.SESSION_SECRET = "test-secret";
});

afterEach(() => {
  process.env = { ...saved };
});

describe("signed values", () => {
  it("round-trips and rejects tampering or another key", () => {
    const token = signValue("hello:1", "key");
    expect(readSigned(token, "key")).toBe("hello:1");
    expect(readSigned(token, "other")).toBeNull();
    expect(readSigned(token.replace("hello", "hullo"), "key")).toBeNull();
    expect(readSigned("no-signature", "key")).toBeNull();
    expect(readSigned(undefined, "key")).toBeNull();
  });
});

describe("invite gate", () => {
  it("accepts the code ignoring case and spaces, and nothing else", () => {
    expect(checkInviteCode("cridercrew")).toBe(true);
    expect(checkInviteCode("  CRIDERCREW ")).toBe(true);
    expect(checkInviteCode("cridercrew1")).toBe(false);
    expect(checkInviteCode("")).toBe(false);
  });

  it("issues a token that lasts 90 days", () => {
    const now = Date.UTC(2026, 9, 8);
    const token = issueGateToken(now);
    expect(isGateTokenValid(token, now + (GATE_MAX_AGE_S - 60) * 1000)).toBe(true);
    expect(isGateTokenValid(token, now + (GATE_MAX_AGE_S + 60) * 1000)).toBe(false);
    expect(isGateTokenValid("garbage")).toBe(false);
    expect(isGateTokenValid(undefined)).toBe(false);
  });

  it("invalidates every gate cookie when the invite code changes", () => {
    const token = issueGateToken();
    expect(isGateTokenValid(token)).toBe(true);
    process.env.INVITE_CODE = "new-code";
    expect(isGateTokenValid(token)).toBe(false);
  });

  it("invalidates every gate cookie when the signing secret changes", () => {
    const token = issueGateToken();
    process.env.SESSION_SECRET = "different";
    expect(isGateTokenValid(token)).toBe(false);
  });
});

describe("proxy", () => {
  const request = (path: string, cookie?: string) =>
    new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie: `${GATE_COOKIE}=${cookie}` } : {} });

  it("returns 401 for every API route without the gate cookie", async () => {
    for (const path of ["/api/leaderboard", "/api/posts", "/api/auth/login", "/api/admin/profiles", "/api/drinks/search", "/api/avatars/x"]) {
      const response = proxy(request(path));
      expect(response.status, path).toBe(401);
      expect(await response.json()).toMatchObject({ code: "gate" });
    }
  });

  it("sends pages to /gate without the cookie", () => {
    for (const path of ["/", "/schedule", "/admin", "/welcome", "/profile"]) {
      const response = proxy(request(path));
      expect(response.status, path).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost/gate");
    }
  });

  it("lets the gate itself and the public preview files through", () => {
    for (const path of ["/gate", "/api/gate", "/manifest.webmanifest", "/og.png", "/logo.png", "/icons/icon-192.png", "/brand/lockup.webp"]) {
      expect(proxy(request(path)).headers.get("x-middleware-next"), path).toBe("1");
    }
  });

  it("rejects a forged or outdated cookie", () => {
    expect(proxy(request("/api/posts", "9999999999999.deadbeef")).status).toBe(401);
    const token = issueGateToken() as string;
    process.env.INVITE_CODE = "rotated";
    expect(proxy(request("/api/posts", token)).status).toBe(401);
  });

  it("lets everything through with a valid cookie, and skips the gate page", () => {
    const token = issueGateToken() as string;
    expect(proxy(request("/api/posts", token)).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(request("/schedule", token)).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(request("/gate", token)).headers.get("location")).toBe("http://localhost/");
  });
});

describe("sessions", () => {
  const profile = { id: "3f0c2c1e-profile", sessionVersion: 2 };

  it("carries the profile and its session version for 30 days", () => {
    const now = Date.UTC(2026, 9, 8);
    const token = issueSessionToken(profile, now);
    expect(readSessionToken(token, now + 29 * 86_400_000)).toEqual({ profileId: profile.id, version: 2, issuedAt: now });
    expect(readSessionToken(token, now + 31 * 86_400_000)).toBeNull();
  });

  it("rejects tampering and other secrets", () => {
    const token = issueSessionToken(profile) as string;
    expect(readSessionToken(token.replace(":2:", ":3:"))).toBeNull();
    process.env.SESSION_SECRET = "rotated";
    expect(readSessionToken(token)).toBeNull();
  });
});

describe("passwords", () => {
  it("enforces the length rules", () => {
    expect(passwordProblem("12345")).toMatch(/at least 6/);
    expect(passwordProblem("123456")).toBeNull();
    expect(passwordProblem("x".repeat(73))).toMatch(/too long/);
    expect(passwordProblem(undefined)).not.toBeNull();
  });

  it("stores only a bcrypt hash and verifies against it", async () => {
    const hash = await hashPassword("hunter22");
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(hash).not.toContain("hunter22");
    expect(await verifyPassword("hunter22", hash)).toBe(true);
    expect(await verifyPassword("hunter23", hash)).toBe(false);
    // An unknown account still does the work, and never succeeds.
    expect(await verifyPassword("decoy-password-nobody-has", null)).toBe(false);
  });

  it("makes readable temporary passwords that pass the rules", () => {
    const password = temporaryPassword();
    expect(password).toMatch(/^[a-z]+-\d{4}$/);
    expect(passwordProblem(password)).toBeNull();
  });
});

describe("rate limiting", () => {
  it("locks a key at the limit and frees it as failures age out", async () => {
    const key = keys.loginName(`  Test-${crypto.randomUUID()} `);
    expect(key).toBe(key.toLowerCase());
    for (let i = 0; i < limits.loginPerName - 1; i++) await mockStore.recordAttempt(key);
    expect(await isLocked(mockStore, key, limits.loginPerName)).toBe(false);
    await mockStore.recordAttempt(key);
    expect(await isLocked(mockStore, key, limits.loginPerName)).toBe(true);
    expect(await isLocked(mockStore, key, limits.loginPerName, Date.now() + WINDOW_MS + 1000)).toBe(false);
    await mockStore.clearAttempts(key);
    expect(await isLocked(mockStore, key, limits.loginPerName)).toBe(false);
  });

  it("reads the caller's address from the forwarding header", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } }))).toBe("203.0.113.7");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});
