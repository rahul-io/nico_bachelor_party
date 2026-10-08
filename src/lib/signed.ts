import { createHmac, timingSafeEqual } from "node:crypto";

const mac = (value: string, key: string) => createHmac("sha256", key).update(value).digest();

/** `value.signature`: the value is readable, but can't be altered without the key. */
export function signValue(value: string, key: string): string {
  return `${value}.${mac(value, key).toString("hex")}`;
}

/** The value inside a signed token, or null if it was tampered with or signed with another key. */
export function readSigned(token: string | undefined | null, key: string): string | null {
  if (!token) return null;
  const split = token.lastIndexOf(".");
  if (split <= 0) return null;

  const value = token.slice(0, split);
  const given = Buffer.from(token.slice(split + 1), "hex");
  const expected = mac(value, key);
  return given.length === expected.length && timingSafeEqual(given, expected) ? value : null;
}
